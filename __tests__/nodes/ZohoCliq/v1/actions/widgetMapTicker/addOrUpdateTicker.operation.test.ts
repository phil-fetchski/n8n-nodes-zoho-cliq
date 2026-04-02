import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as addOrUpdateTicker from '../../../../../../nodes/ZohoCliq/v1/actions/widgetMapTicker/addOrUpdateTicker.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - WidgetMapTicker - AddOrUpdateTicker Operation', () => {
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

	it('should add or update ticker with structured payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
				case 'tickerEntries':
					return {
						ticker: [
							{
								tickerId: 'chennai',
								title: 'TN 07 AL 9916',
								type: 'van',
								color: 'green',
								lastModifiedTime: 1721329461,
								latitude: 12.84567,
								longitude: 80.06092,
								info: 'Towards Zoho Corporation',
							},
						],
					};
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'addOrUpdateTicker',
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ticker_ids: ['chennai'],
				data: { status: 'success' },
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			{
				tickers: {
					chennai: {
						title: 'TN 07 AL 9916',
						type: 'van',
						color: 'green',
						last_modified_time: 1721329461000,
						latitude: 12.84567,
						longitude: 80.06092,
						info: 'Towards Zoho Corporation',
					},
				},
			},
			{},
		);
	});

	it('should use extension endpoint without requiring widget id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
				case 'tickerEntries':
					return {
						ticker: [
							{
								tickerId: 'chennai',
								title: 'TN 07 AL 9916',
								type: 'van',
								color: 'yellow',
								lastModifiedTime: 1721329461,
								latitude: 12.84567,
								longitude: 80.06092,
							},
						],
					};
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'widgetMapTicker',
				operation: 'addOrUpdateTicker',
				map_id: 'MAP_123',
				ticker_ids: ['chennai'],
				data: { status: 'success' },
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/extensions/widgets/maps/MAP_123',
			{
				tickers: {
					chennai: {
						title: 'TN 07 AL 9916',
						type: 'van',
						color: 'yellow',
						last_modified_time: 1721329461000,
						latitude: 12.84567,
						longitude: 80.06092,
					},
				},
			},
			{ appkey: 'app_key_1' },
		);
	});

	it('should ignore non-object structured entries and omit empty info', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
				case 'tickerEntries':
					return {
						ticker: [
							'ignore-me',
							{
								tickerId: 'mumbai',
								title: 'Zylker Office',
								type: 'office',
								lastModifiedTime: 1721329462000,
								latitude: 19.076,
								longitude: 72.8777,
								info: '   ',
							},
						],
					};
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			{
				tickers: {
					mumbai: {
						title: 'Zylker Office',
						type: 'office',
						last_modified_time: 1721329462000,
						latitude: 19.076,
						longitude: 72.8777,
					},
				},
			},
			{},
		);
	});

	it('should add or update ticker with raw payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
				case 'tickerPayload':
					return {
						tickers: {
							mumbai: {
								title: 'Zylker Office',
								type: 'office',
								color: 'red',
								last_modified_time: 1721329462000,
								latitude: 19.076,
								longitude: 72.8777,
								info: 'Mumbai HQ',
							},
						},
					};
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			expect.objectContaining({
				tickers: expect.objectContaining({
					mumbai: expect.objectContaining({
						type: 'office',
						color: 'red',
					}),
				}),
			}),
			{},
		);
	});

	it('should support raw stringified json payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
				case 'tickerPayload':
					return '{"tickers":{"mumbai":{"title":"Zylker Office","type":"office","last_modified_time":1721329462000,"latitude":19.076,"longitude":72.8777}}}';
				case 'includeEnhancedOutput':
					return true;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/widgets/WD_123/maps/MAP_123',
			expect.objectContaining({
				tickers: expect.objectContaining({
					mumbai: expect.objectContaining({
						type: 'office',
					}),
				}),
			}),
			{},
		);
	});

	it('should return raw api response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
				case 'tickerPayload':
					return {
						tickers: {
							mumbai: {
								title: 'Zylker Office',
								type: 'office',
								last_modified_time: 1721329462000,
								latitude: 19.076,
								longitude: 72.8777,
							},
						},
					};
				case 'includeEnhancedOutput':
					return false;
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ status: 'success' });
	});

	it('should surface status false as an operation error in continueOnFail mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerPayload':
					return {
						tickers: {
							CA3271183570: {
								title: 'Truck 3570',
								type: 'van',
								last_modified_time: 1721329462000,
								latitude: 19.076,
								longitude: 72.8777,
							},
						},
					};
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: false });
		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'widgetMapTicker',
				operation: 'addOrUpdateTicker',
				map_id: 'fleet_map',
				ticker_ids: ['CA3271183570'],
				appkey: 'app_key_1',
				message: expect.stringContaining('status=false'),
			}),
		);
	});

	it('should prefer api message when status false is returned', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerPayload':
					return {
						tickers: {
							chennai: {
								title: 'Truck 3570',
								type: 'van',
								last_modified_time: 1721329462000,
								latitude: 19.076,
								longitude: 72.8777,
							},
						},
					};
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: false, message: 'Ticker rejected' });
		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json.message).toContain('Ticker rejected');
	});

	it('should fall back to api error when status false omits message', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerPayload':
					return {
						tickers: {
							chennai: {
								title: 'Truck 3570',
								type: 'van',
								last_modified_time: 1721329462000,
								latitude: 19.076,
								longitude: 72.8777,
							},
						},
					};
				default:
					return '';
			}
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: false, error: 'Ticker failed' });
		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json.message).toContain('Ticker failed');
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const requiredScope = getRequiredScopeForOperation('widgetMapTicker', 'addOrUpdateTicker');

		let thrownError: unknown;
		try {
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, '');
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
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerEntries':
					return { ticker: [] };
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toEqual([
			expect.objectContaining({
				pairedItem: { item: 0 },
				json: expect.objectContaining({
					success: false,
					resource: 'widgetMapTicker',
					operation: 'addOrUpdateTicker',
				}),
			}),
		]);
	});

	it('should reject invalid input mode and continue on fail per item', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			switch (name) {
				case 'inputMode':
					return 'invalid-mode';
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Input Mode must be either "structured" or "raw"',
			}),
		);
	});

	it('should reject invalid boolean map extension toggle and continue on fail', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					return 'yes';
				case 'tickerPayload':
					return {
						tickers: {
							a: {
								title: 'x',
								type: 'person',
								last_modified_time: 1721329461,
								latitude: 1,
								longitude: 1,
							},
						},
					};
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Map Is Custom Extension must be a boolean value',
			}),
		);
	});

	it('should reject missing app key when extension mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					return ' ';
				case 'tickerPayload':
					return {
						tickers: {
							a: {
								title: 'x',
								type: 'person',
								last_modified_time: 1721329461,
								latitude: 1,
								longitude: 1,
							},
						},
					};
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('App Key is required');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				map_id: 'MAP_123',
				ticker_ids: ['a'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should preserve identifiers and appkey when add request extraction fails before api call', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					return 'app_key_1';
				case 'tickerPayload':
					return '{';
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Ticker Payload must be valid JSON',
				map_id: 'MAP_123',
				appkey: 'app_key_1',
			}),
		);
		expect(result[0].json).not.toHaveProperty('widget_id');
	});

	it('should include api error details in continueOnFail output', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerPayload':
					return {
						tickers: {
							a: {
								title: 'x',
								type: 'person',
								last_modified_time: 1721329461,
								latitude: 1,
								longitude: 1,
							},
						},
					};
				default:
					return '';
			}
		});

		const apiError = new Error('Bad request') as Error & { response: unknown };
		apiError.response = {
			status: 400,
			data: {
				error: 'bad_request',
				message: 'Invalid ticker',
				code: '4001',
				error_code: 'E4001',
				status: 'error',
			},
		};
		mockZohoCliqApiRequest.mockRejectedValue(apiError);

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'widgetMapTicker',
				operation: 'addOrUpdateTicker',
				status_code: 400,
				status_class: '4xx',
				reason: 'BAD_REQUEST',
				details: expect.objectContaining({
					statusCode: 400,
					message: 'Invalid ticker',
					code: '4001',
				}),
			}),
		);
		expect(String(result[0].json.message)).toContain('Bad request');
	});

	it('should fail when structured tickerEntries has no ticker array key', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerEntries':
					return {};
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('tickers must include at least one ticker entry');
	});

	it('should fail gracefully when structured tickerEntries ticker key is an object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerEntries':
					return { ticker: { tickerId: 'chennai' } };
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('tickers must include at least one ticker entry');
	});

	it('should fail when structured ticker entry is missing tickerId', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
				case 'tickerEntries':
					return {
						ticker: [
							{
								title: 'Zylker Office',
								type: 'office',
								lastModifiedTime: 1721329462000,
								latitude: 19.076,
								longitude: 72.8777,
							},
						],
					};
				default:
					return '';
			}
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json.message).toContain('Ticker ID is required');
	});

	it('should return scope payload in ai error mode without continueOnFail', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') {
				return true;
			}
			return '';
		});

		const result = await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, '');
		expect(result[0]).toEqual(
			expect.objectContaining({
				pairedItem: { item: 0 },
				json: expect.objectContaining({
					success: false,
					requiredScopes: [SCOPES.APPLICATIONS_UPDATE],
					missingScopes: [SCOPES.APPLICATIONS_UPDATE],
				}),
			}),
		);
	});

	describe('destination support', () => {
		it('should include destination in structured payload when addDestination is true', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'MIKE',
									title: 'MIKE - the BIKE',
									type: 'bicycle',
									lastModifiedTime: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									color: 'yellow',
									info: 'MIKE - the BIKE.',
									addDestination: true,
									destinationLatitude: 42.3550316,
									destinationLongitude: -73.7243119,
								},
							],
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			const result = await addOrUpdateTicker.execute.call(
				mockExecuteFunctions,
				items,
				grantedScopes,
			);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'PUT',
				'/api/v2/widgets/WD_123/maps/MAP_123',
				{
					tickers: {
						MIKE: {
							title: 'MIKE - the BIKE',
							type: 'bicycle',
							last_modified_time: 1770128241614,
							latitude: 40.7298713,
							longitude: -73.9722416,
							color: 'yellow',
							info: 'MIKE - the BIKE.',
							destination: {
								latitude: 42.3550316,
								longitude: -73.7243119,
							},
						},
					},
				},
				{},
			);
		});

		it('should omit destination when addDestination is false', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'MIKE',
									title: 'MIKE - the BIKE',
									type: 'bicycle',
									lastModifiedTime: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									addDestination: false,
									destinationLatitude: 42.3550316,
									destinationLongitude: -73.7243119,
								},
							],
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callBody = mockZohoCliqApiRequest.mock.calls[0][2] as {
				tickers: { MIKE: { destination?: unknown } };
			};
			expect(callBody.tickers.MIKE).not.toHaveProperty('destination');
		});

		it('should omit destination when addDestination is not provided', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'chennai',
									title: 'TN 07 AL 9916',
									type: 'van',
									lastModifiedTime: 1721329461,
									latitude: 12.84567,
									longitude: 80.06092,
								},
							],
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callBody = mockZohoCliqApiRequest.mock.calls[0][2] as {
				tickers: { chennai: { destination?: unknown } };
			};
			expect(callBody.tickers.chennai).not.toHaveProperty('destination');
		});

		it('should normalize destination coordinates to 7 decimal places', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'truck1',
									title: 'Truck 1',
									type: 'van',
									lastModifiedTime: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									addDestination: true,
									destinationLatitude: 42.355031612345,
									destinationLongitude: -73.72,
								},
							],
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callBody = mockZohoCliqApiRequest.mock.calls[0][2] as {
				tickers: {
					truck1: { destination: { latitude: number; longitude: number } };
				};
			};
			expect(callBody.tickers.truck1.destination.latitude).toBe(42.3550316);
			expect(callBody.tickers.truck1.destination.longitude).toBe(-73.72);
		});

		it('should omit destination when addDestination is true but coordinates are non-finite', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'truck1',
									title: 'Truck 1',
									type: 'van',
									lastModifiedTime: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									addDestination: true,
									destinationLatitude: undefined,
									destinationLongitude: undefined,
								},
							],
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callBody = mockZohoCliqApiRequest.mock.calls[0][2] as {
				tickers: { truck1: { destination?: unknown } };
			};
			expect(callBody.tickers.truck1).not.toHaveProperty('destination');
		});

		it('should reject out-of-range destination latitude in structured mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'truck1',
									title: 'Truck 1',
									type: 'van',
									lastModifiedTime: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									addDestination: true,
									destinationLatitude: 91,
									destinationLongitude: -73.7243119,
								},
							],
						};
					default:
						return '';
				}
			});

			const result = await addOrUpdateTicker.execute.call(
				mockExecuteFunctions,
				items,
				grantedScopes,
			);
			expect(result[0].json.message).toContain('destination.latitude must be between -90 and 90');
		});

		it('should reject out-of-range destination longitude in structured mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'truck1',
									title: 'Truck 1',
									type: 'van',
									lastModifiedTime: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									addDestination: true,
									destinationLatitude: 42.3550316,
									destinationLongitude: -181,
								},
							],
						};
					default:
						return '';
				}
			});

			const result = await addOrUpdateTicker.execute.call(
				mockExecuteFunctions,
				items,
				grantedScopes,
			);
			expect(result[0].json.message).toContain(
				'destination.longitude must be between -180 and 180',
			);
		});

		it('should normalize high-precision destination coordinates in structured mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerEntries':
						return {
							ticker: [
								{
									tickerId: 'truck1',
									title: 'Truck 1',
									type: 'van',
									lastModifiedTime: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									addDestination: true,
									destinationLatitude: 42.355031612,
									destinationLongitude: -73.724311912,
								},
							],
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callBody = mockZohoCliqApiRequest.mock.calls[0][2] as {
				tickers: {
					truck1: { destination: { latitude: number; longitude: number } };
				};
			};
			expect(callBody.tickers.truck1.destination.latitude).toBe(42.3550316);
			expect(callBody.tickers.truck1.destination.longitude).toBe(-73.7243119);
		});

		it('should validate destination in raw JSON payload', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerPayload':
						return {
							tickers: {
								MIKE: {
									title: 'MIKE - the BIKE',
									type: 'bicycle',
									last_modified_time: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									destination: {
										latitude: 42.3550316,
										longitude: -73.7243119,
									},
								},
							},
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callBody = mockZohoCliqApiRequest.mock.calls[0][2] as {
				tickers: {
					MIKE: { destination: { latitude: number; longitude: number } };
				};
			};
			expect(callBody.tickers.MIKE.destination).toEqual({
				latitude: 42.3550316,
				longitude: -73.7243119,
			});
		});

		it('should reject invalid destination latitude in raw JSON payload', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					case 'tickerPayload':
						return {
							tickers: {
								MIKE: {
									title: 'MIKE',
									type: 'bicycle',
									last_modified_time: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									destination: {
										latitude: 91,
										longitude: -73.7243119,
									},
								},
							},
						};
					default:
						return '';
				}
			});

			const result = await addOrUpdateTicker.execute.call(
				mockExecuteFunctions,
				items,
				grantedScopes,
			);
			expect(result[0].json.message).toContain('destination.latitude must be between -90 and 90');
		});

		it('should reject invalid destination longitude in raw JSON payload', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					case 'tickerPayload':
						return {
							tickers: {
								MIKE: {
									title: 'MIKE',
									type: 'bicycle',
									last_modified_time: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									destination: {
										latitude: 42.3550316,
										longitude: -181,
									},
								},
							},
						};
					default:
						return '';
				}
			});

			const result = await addOrUpdateTicker.execute.call(
				mockExecuteFunctions,
				items,
				grantedScopes,
			);
			expect(result[0].json.message).toContain(
				'destination.longitude must be between -180 and 180',
			);
		});

		it('should reject non-object destination in raw JSON payload', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;
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
					case 'tickerPayload':
						return {
							tickers: {
								MIKE: {
									title: 'MIKE',
									type: 'bicycle',
									last_modified_time: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
									destination: 'invalid',
								},
							},
						};
					default:
						return '';
				}
			});

			const result = await addOrUpdateTicker.execute.call(
				mockExecuteFunctions,
				items,
				grantedScopes,
			);
			expect(result[0].json.message).toContain(
				'destination must be a JSON object with latitude and longitude',
			);
		});

		it('should omit destination from raw JSON when not provided', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.APPLICATIONS_UPDATE;

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
					case 'tickerPayload':
						return {
							tickers: {
								MIKE: {
									title: 'MIKE',
									type: 'bicycle',
									last_modified_time: 1770128241614,
									latitude: 40.7298713,
									longitude: -73.9722416,
								},
							},
						};
					case 'includeEnhancedOutput':
						return true;
					default:
						return '';
				}
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
			await addOrUpdateTicker.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callBody = mockZohoCliqApiRequest.mock.calls[0][2] as {
				tickers: { MIKE: { destination?: unknown } };
			};
			expect(callBody.tickers.MIKE).not.toHaveProperty('destination');
		});
	});
});
