import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as deleteTicker from '../../../../../../nodes/ZohoCliq/v1/actions/widgetMapTicker/deleteTicker.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - WidgetMapTicker - DeleteTicker Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn(
					(
						data: INodeExecutionData[],
						metadata?: {
							itemData?: {
								item: number;
							};
						},
					) =>
						data.map((entry) => ({
							...entry,
							pairedItem: metadata?.itemData ? { item: metadata.itemData.item } : undefined,
						})),
				),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			continueOnFail: jest.fn(() => false),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should delete ticker with structured payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'chennai' }, { tickerId: 'mumbai' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({});
		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			{ ids: ['chennai', 'mumbai'] },
			{},
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				deleted: true,
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ids: ['chennai', 'mumbai'],
				data: {},
			}),
		);
	});

	it('should use extension endpoint without requiring widget id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'chennai' }, { tickerId: 'mumbai' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({});
		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/extensions/widgets/maps/MAP_123',
			{ ids: ['chennai', 'mumbai'] },
			{ appkey: 'app_key_1' },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				deleted: true,
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'MAP_123',
				ids: ['chennai', 'mumbai'],
				data: {},
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should treat known extension delete false-negative http method error as success', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'LOUISE' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const wrappedError = new NodeApiError(
			{
				id: '1',
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			},
			{
				message: 'Bad request - please check your parameters',
				statusCode: 400,
				response: {
					status: 400,
					data: {
						message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
					},
				},
			},
			{
				message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				description: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
			},
		);
		mockZohoCliqApiRequest.mockRejectedValue(wrappedError);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				deleted: true,
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['LOUISE'],
				data: expect.objectContaining({
					success: true,
					ids: ['LOUISE'],
				}),
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should ignore non-object structured delete entries', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'tickerIdsEntries':
					return { id: ['ignore-me', { tickerId: 'chennai' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({});
		await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			{ ids: ['chennai'] },
			{},
		);
	});

	it('should delete ticker with raw payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			{ ids: ['chennai'] },
			{},
		);
	});

	it('should support raw stringified json payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return '{"ids":["chennai","chennai","mumbai"]}';
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			{ ids: ['chennai', 'mumbai'] },
			{},
		);
	});

	it('should handle null api response as empty object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockImplementationOnce(async () => null as unknown as never);
		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				deleted: true,
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				ids: ['chennai'],
				data: {},
			}),
		);
	});

	it('should return raw api response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				case 'includeEnhancedOutput':
					return false;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ deleted: true, status: 'success' });
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const requiredScope = getRequiredScopeForOperation('widgetMapTicker', 'deleteTicker');

		let thrownError: unknown;
		try {
			await deleteTicker.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
	});

	it('should return per-item continueOnFail error', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'tickerIdsEntries':
					return { id: [] };
				default:
					return '';
			}
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toEqual([
			expect.objectContaining({
				pairedItem: { item: 0 },
				json: expect.objectContaining({
					success: false,
					resource: 'widgetMapTicker',
					operation: 'deleteTicker',
				}),
			}),
		]);
	});

	it('should preserve primitive api errors without adding debug objects', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'deleteTickerPayload':
					return { ids: ['LOUISE'] };
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockRejectedValue('plain failure');

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'plain failure',
				map_id: 'fleet_map',
				ids: ['LOUISE'],
				appkey: 'app_key_1',
			}),
		);
		expect(result[0].json).not.toHaveProperty('debug_response');
		expect(result[0].json).not.toHaveProperty('debug_transport');
	});

	it('should omit debug_response when error object has no structured debug payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockRejectedValue(new Error('Delete failed without metadata'));

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Delete failed without metadata',
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ids: ['chennai'],
				debug_error_name: 'Error',
				debug_error_message: 'Delete failed without metadata',
			}),
		);
		expect(result[0].json).not.toHaveProperty('debug_response');
	});

	it('should reject invalid input mode and continue on fail', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'bad';
			return '';
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Input Mode must be either "structured" or "raw"',
			}),
		);
	});

	it('should reject invalid boolean extension toggle and continue on fail', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return 'on';
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toBe('Map Is Custom Extension must be a boolean value');
	});

	it('should reject missing app key in extension mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return '';
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('App Key is required');
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should preserve identifiers and appkey when request extraction fails before api call', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'deleteTickerPayload':
					return '{';
				default:
					return '';
			}
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Delete Ticker Payload must be valid JSON',
				map_id: 'MAP_123',
				appkey: 'app_key_1',
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should include delete context in recoverable api error payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai', 'mumbai'] };
				default:
					return '';
			}
		});

		const apiError = new Error('Delete failed') as Error & { response: unknown };
		apiError.response = {
			status: 404,
			body: {
				message: 'Ticker not found in body',
				code: '4041-body',
			},
			data: {
				message: 'Ticker not found',
				code: '4041',
			},
		};
		mockZohoCliqApiRequest.mockRejectedValue(apiError);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ids: ['chennai', 'mumbai'],
				status_code: 404,
				status_class: '4xx',
				reason: 'NOT_FOUND',
				debug_status_code: 404,
				debug_response: expect.objectContaining({
					status: 404,
					data: expect.objectContaining({
						message: 'Ticker not found',
						code: '4041',
					}),
				}),
			}),
		);
	});

	it('should include wrapped NodeApiError debug fields in recoverable payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'deleteTickerPayload':
					return { ids: ['LOUISE'] };
				default:
					return '';
			}
		});

		const wrappedError = new NodeApiError(
			{
				id: '1',
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			},
			{
				message: 'orig',
				statusCode: 405,
				response: {
					status: 405,
					data: {
						message: 'Ticker deletion failed unexpectedly.',
					},
					body: {
						debug: 'body',
					},
				},
			},
			{
				message: 'wrapped',
				description: 'Ticker deletion failed unexpectedly.',
			},
		);
		mockZohoCliqApiRequest.mockRejectedValue(wrappedError);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				map_id: 'fleet_map',
				ids: ['LOUISE'],
				appkey: 'app_key_1',
				debug_error_name: 'NodeApiError',
				debug_error_message: 'wrapped',
				debug_error_properties: expect.arrayContaining([
					'message',
					'description',
					'errorResponse',
					'context',
					'httpCode',
				]),
				debug_status_code: 405,
				debug_description: 'Ticker deletion failed unexpectedly.',
				debug_error_response: {
					message: 'orig',
					status: 405,
				},
				debug_response: {
					status: 405,
					description: 'Ticker deletion failed unexpectedly.',
					data: {
						message: 'Ticker deletion failed unexpectedly.',
					},
				},
			}),
		);
	});

	it('should prefer httpCode when building delete debug status details', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete failed with httpCode'), {
			httpCode: 418,
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				debug_status_code: 418,
				debug_response: {
					status: 418,
				},
			}),
		);
	});

	it('should use response.statusCode when response.status is not present', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete failed with response statusCode'), {
			response: {
				statusCode: 409,
				data: {
					message: 'Conflict deleting ticker',
				},
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				debug_status_code: 409,
				debug_response: {
					status: 409,
					data: {
						message: 'Conflict deleting ticker',
					},
				},
			}),
		);
	});

	it('should project safe context keys and response body metadata in debug output', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete failed with projected metadata'), {
			context: {
				requestId: 'req_123',
				accountId: 42,
				userId: true,
				ignored: 'skip-me',
			},
			response: {
				status: 422,
				statusText: 'Unprocessable Entity',
				headers: {
					'x-cliq-request-id': 'req_123',
				},
				body: {
					message: 'Ticker body fallback',
				},
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				debug_status_code: 422,
				debug_context: {
					requestId: 'req_123',
					accountId: 42,
					userId: true,
				},
				debug_response: {
					status: 422,
					context: {
						requestId: 'req_123',
						accountId: 42,
						userId: true,
					},
					statusText: 'Unprocessable Entity',
					headers: {
						'x-cliq-request-id': 'req_123',
					},
					data: {
						message: 'Ticker body fallback',
					},
				},
			}),
		);
		expect(result[0].json.debug_context).not.toHaveProperty('ignored');
	});

	it('should keep projected response metadata without debug data when response has no data or body', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete failed with response metadata only'), {
			response: {
				statusText: 'Accepted',
				headers: {
					'x-cliq-request-id': 'req_meta',
				},
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				debug_response: {
					statusText: 'Accepted',
					headers: {
						'x-cliq-request-id': 'req_meta',
					},
				},
			}),
		);
		expect(result[0].json.debug_response).not.toHaveProperty('data');
	});

	it('should ignore response objects that do not contain projected debug fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete failed with ignored response object'), {
			response: {
				ignored: 'skip-me',
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Delete failed with ignored response object',
			}),
		);
		expect(result[0].json).not.toHaveProperty('debug_response');
	});

	it('should surface fallback errorResponse and transport debug details when no response exists', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Fallback delete error'), {
			errorResponse: {
				statusCode: 400,
				message: 'fallback response body',
			},
			zohoCliqDebug: {
				original_message: 'Bad request - please check your parameters',
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Fallback delete error',
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ids: ['chennai'],
				debug_status_code: 400,
				debug_error_response: {
					message: 'fallback response body',
					status: 400,
				},
				debug_transport: {
					original_message: 'Bad request - please check your parameters',
				},
				debug_response: {
					status: 400,
					error_response: {
						message: 'fallback response body',
						status: 400,
					},
				},
			}),
		);
	});

	it('should project safe errorResponse fields when response is absent', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Fallback delete error with details'), {
			errorResponse: {
				status: 409,
				message: 'fallback response body',
				code: 'CONFLICT',
				details: {
					ticker: 'chennai',
				},
				ignored: 'skip-me',
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				debug_error_response: {
					status: 409,
					message: 'fallback response body',
					code: 'CONFLICT',
					details: {
						ticker: 'chennai',
					},
				},
				debug_response: {
					error_response: {
						status: 409,
						message: 'fallback response body',
						code: 'CONFLICT',
						details: {
							ticker: 'chennai',
						},
					},
				},
			}),
		);
		expect(result[0].json.debug_error_response).not.toHaveProperty('ignored');
	});

	it('should ignore empty errorResponse objects in projected debug fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'raw';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'deleteTickerPayload':
					return { ids: ['chennai'] };
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Fallback delete error with empty errorResponse'), {
			errorResponse: {},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Fallback delete error with empty errorResponse',
			}),
		);
		expect(result[0].json).not.toHaveProperty('debug_error_response');
		expect(result[0].json).not.toHaveProperty('debug_response.error_response');
	});

	it('should treat extension delete false-negative as success when message sources are JSON strings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'JSON_ONE' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete returned JSON string payloads'), {
			context: {
				data: '   ',
			},
			response: {
				data: '123',
				body: '{"code":"METHOD_INVALID"}',
			},
			zohoCliqDebug: {
				original_message: '{"message":"Bad request - please check your parameters"}',
				response_data: '"   "',
				response_body:
					'{"message":"The HTTP Method you are trying is invalid. Please check the HTTP method."}',
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['JSON_ONE'],
				data: {
					success: true,
					ids: ['JSON_ONE'],
				},
			}),
		);
	});

	it('should treat extension delete false-negative as success when text comes from fallback response and transport payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'LOUISE' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete returned fallback payload'), {
			errorResponse: {
				response: {
					body: {
						message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
					},
				},
			},
			zohoCliqDebug: {
				original_message: 'Bad request - please check your parameters',
				response_data: {
					message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				},
				response_body: {
					message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				},
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['LOUISE'],
				data: {
					success: true,
					ids: ['LOUISE'],
				},
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should treat extension delete false-negative as success when text is available across all direct response message sources', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'SALLY' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete returned direct response payload'), {
			description: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
			context: {
				data: {
					message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				},
			},
			response: {
				data: {
					message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				},
				body: {
					message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				},
			},
			zohoCliqDebug: {
				original_message: 'Bad request - please check your parameters',
				response_data: {
					message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				},
				response_body: {
					message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
				},
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['SALLY'],
				data: {
					success: true,
					ids: ['SALLY'],
				},
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should treat extension delete false-negative as success when text is available through errorResponse.response fallback', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'THELMA' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete returned fallback response payload'), {
			errorResponse: {
				response: {
					data: {
						message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
					},
					body: {
						message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
					},
				},
			},
			zohoCliqDebug: {
				original_message: 'Bad request - please check your parameters',
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['THELMA'],
				data: {
					success: true,
					ids: ['THELMA'],
				},
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should treat extension delete false-negative as success when collector sees non-object direct payload fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'LOUISE' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete returned mixed direct payload fields'), {
			description: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
			context: {
				data: 'not-an-object',
			},
			response: {
				data: 'not-an-object',
				body: 'not-an-object',
			},
			zohoCliqDebug: {
				response_data: 'not-an-object',
				response_body: 'not-an-object',
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['LOUISE'],
				data: {
					success: true,
					ids: ['LOUISE'],
				},
			}),
		);
	});

	it('should treat extension delete false-negative as success when fallback response exists but is not an object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'SALLY' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete returned non-object fallback response'), {
			description: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
			errorResponse: {
				response: 'not-an-object',
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['SALLY'],
				data: {
					success: true,
					ids: ['SALLY'],
				},
			}),
		);
	});

	it('should treat extension delete false-negative as success when only description is available', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'fleet_map';
				case 'widgetId':
					throw new Error('Could not get parameter');
				case 'mapIsCustomExtension':
					return true;
				case 'appKey':
					return 'app_key_1';
				case 'tickerIdsEntries':
					return { id: [{ tickerId: 'THELMA' }] };
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		const error = Object.assign(new Error('Delete returned description-only payload'), {
			description: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
		});
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'deleteTicker',
				map_id: 'fleet_map',
				ids: ['THELMA'],
				data: {
					success: true,
					ids: ['THELMA'],
				},
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should fail when structured tickerIdsEntries has no id array key', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'tickerIdsEntries':
					return {};
				default:
					return '';
			}
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('Delete Ticker Payload.ids cannot be empty');
	});

	it('should fail gracefully when structured tickerIdsEntries id key is an object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'tickerIdsEntries':
					return { id: { tickerId: 'chennai' } };
				default:
					return '';
			}
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('Delete Ticker Payload.ids cannot be empty');
	});

	it('should fail when structured delete entry is missing tickerId', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_DELETE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'structured';
				case 'mapId':
					return 'MAP_123';
				case 'widgetId':
					return 'WD_123';
				case 'mapIsCustomExtension':
					return false;
				case 'tickerIdsEntries':
					return { id: [{ foo: 'bar' }] };
				default:
					return '';
			}
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('Ticker ID at index 0 is required');
	});

	it('should return scope payload in ai error mode without continueOnFail', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') {
				return true;
			}
			return '';
		});

		const result = await deleteTicker.execute.call(mockExecuteFunctions, items, '');
		expect(result[0]).toEqual(
			expect.objectContaining({
				pairedItem: { item: 0 },
				json: expect.objectContaining({
					success: false,
					requiredScopes: [SCOPES.APPLICATIONS_DELETE],
					missingScopes: [SCOPES.APPLICATIONS_DELETE],
				}),
			}),
		);
	});
});
