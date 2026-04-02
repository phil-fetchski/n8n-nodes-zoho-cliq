import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as listCallRecordings from '../../../../../../nodes/ZohoCliq/v1/actions/callsMeeting/listCallRecordings.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - CallsMeeting - ListCallRecordings Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should list call recordings successfully with supported filters', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			type: ['video_conference', 'assembly'],
			filter: 'viewed',
			search: 'Marketing Campaigns',
			from: 1643283406317,
			to: 1643361458859,
			lastModified: 1643361458859,
			hostId: '62440502',
			recipientId: '62439860',
			recipientIds: '62439860,62440502',
			limit: 25,
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		const result = await listCallRecordings.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/mediasessions', undefined, {
			type: 'video_conference,assembly',
			filter: 'viewed',
			search: 'Marketing Campaigns',
			from: 1643283406317,
			to: 1643361458859,
			last_modified: 1643361458859,
			host_id: '62440502',
			recipient_id: '62439860',
			recipient_ids: '62439860,62440502',
			limit: 25,
		});
	});

	it('should return raw array response when simplify is off', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _itemIndex: number, fallback?: unknown) => {
				if (paramName === 'simplify') return false;
				return fallback ?? {};
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue([{ nrs_id: 'MS_12345' }] as unknown as IDataObject);

		const result = await listCallRecordings.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual([{ nrs_id: 'MS_12345' }]);
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('callsMeeting', 'listCallRecordings');
		let thrownError: unknown;
		try {
			await listCallRecordings.execute.call(mockExecuteFunctions, items, '');
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
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should throw for invalid type', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			type: ['invalid_type'],
		});

		await expect(
			listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Type must be one of');
	});

	it('should omit empty pagination tokens from query', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			nextToken: '',
			syncToken: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions',
			undefined,
			{},
		);
	});

	it('should omit whitespace-only sync token from query', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			syncToken: '   ',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions',
			undefined,
			{},
		);
	});

	it('should omit whitespace-only optional string fields from query', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			filter: '   ',
			search: '   ',
			hostId: '   ',
			recipientId: '   ',
			recipientIds: '   ',
			nextToken: '   ',
			syncToken: '   ',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions',
			undefined,
			{},
		);
	});

	it('should allow next token as the only query parameter', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			nextToken: 'next-1',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/mediasessions', undefined, {
			next_token: 'next-1',
		});
	});

	it('should allow sync token as the only query parameter', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			syncToken: 'sync-1',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/mediasessions', undefined, {
			sync_token: 'sync-1',
		});
	});

	it('should reject combining next token with other params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			nextToken: 'next-1',
			limit: 10,
		});

		await expect(
			listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(
			'Next Token and Sync Token cannot be combined with any other query parameter',
		);
	});

	it('should reject missed filter when type is not direct_call', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			type: ['video_conference'],
			filter: 'missed',
		});

		await expect(
			listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(
			'Filter "Missed", "Received", and "Dialled" require Type to be only "Direct Call"',
		);
	});

	it('should reject filter when type is all', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			type: ['all'],
			filter: 'live',
		});

		await expect(
			listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Filter cannot be used when Type is set to "All"');
	});

	it('should reject when from time is greater than to time', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			from: 200,
			to: 100,
		});

		await expect(
			listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('From Time cannot be greater than To Time');
	});

	it('should validate zero timestamps and omit from/to/last_modified from query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			from: 0,
			to: 0,
			lastModified: 0,
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listCallRecordings.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions',
			undefined,
			{},
		);
	});

	it('should return paired item error when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({
			type: ['video_conference'],
			filter: 'missed',
		});

		const result = await listCallRecordings.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Filter "Missed", "Received", and "Dialled" require Type to be only "Direct Call"',
			}),
		);
	});

	it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'callsMeeting';
			if (paramName === 'operation') return 'listCallRecordings';
			return undefined;
		});

		const result = await listCallRecordings.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'callsMeeting',
				operation: 'listCallRecordings',
			}),
		);
	});

	it('should return generic error when continueOnFail is enabled and non-object error is thrown', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockRejectedValue(null);

		const result = await listCallRecordings.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'An unexpected issue occurred with the API request',
			}),
		);
	});
});
