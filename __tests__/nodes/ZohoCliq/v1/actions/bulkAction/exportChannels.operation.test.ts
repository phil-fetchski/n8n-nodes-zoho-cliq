import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

import * as exportChannels from '../../../../../../nodes/ZohoCliq/v1/actions/bulkAction/exportChannels.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - BulkAction - ExportChannels Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { channelFields?: string[]; nextToken?: string } = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const channelFields = Object.prototype.hasOwnProperty.call(values, 'channelFields')
			? values.channelFields
			: ['name', 'channel_id', 'participant_count'];
		const nextToken = Object.prototype.hasOwnProperty.call(values, 'nextToken')
			? values.nextToken
			: '';
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'channelFields') return channelFields;
				if (name === 'nextToken') return nextToken;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				if (name === 'resource') return 'bulkAction';
				if (name === 'operation') return 'exportChannels';
				return fallback;
			}),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should export channels successfully', async () => {
		const context = createContext({ channelFields: ['name', 'channel_id'] });
		mockZohoCliqApiRequest.mockResolvedValue(
			'name,channel_id\n#general,1' as unknown as Record<string, never>,
		);

		const result = await exportChannels.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHANNELS_READ,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/channels',
			undefined,
			{ fields: 'name,channel_id' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
		expect(result).toEqual([{ json: { csv: 'name,channel_id\n#general,1' } }]);
	});

	it('should include next_token when provided', async () => {
		const context = createContext({ nextToken: 'next_page_1' });
		mockZohoCliqApiRequest.mockResolvedValue(
			'name,channel_id\n#general,1\n\n\nnext_token=next_page_2' as unknown as Record<string, never>,
		);

		await exportChannels.execute.call(context, items, SCOPES.ORGANIZATION_CHANNELS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/channels',
			undefined,
			{ fields: 'name,channel_id,participant_count', next_token: 'next_page_1' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should omit next_token when the parameter resolves to undefined', async () => {
		const context = createContext({ nextToken: undefined });
		mockZohoCliqApiRequest.mockResolvedValue(
			'name,channel_id\n#general,1' as unknown as Record<string, never>,
		);

		await exportChannels.execute.call(context, items, SCOPES.ORGANIZATION_CHANNELS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/channels',
			undefined,
			{ fields: 'name,channel_id,participant_count' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should throw for missing scope when recoverable mode is disabled', async () => {
		const context = createContext();

		let thrownError: unknown;
		try {
			await exportChannels.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'bulkAction',
			operation: 'exportChannels',
			requiredScopes: [SCOPES.ORGANIZATION_CHANNELS_READ],
			missingScopes: [SCOPES.ORGANIZATION_CHANNELS_READ],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should throw for invalid channel fields when recoverable mode is disabled', async () => {
		const context = createContext({ channelFields: ['name', 'role'] });

		await expect(
			exportChannels.execute.call(context, items, SCOPES.ORGANIZATION_CHANNELS_READ),
		).rejects.toThrow('Unsupported Channel Fields value: "role"');
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ channelFields: ['name', 'name'] }, { continueOnFail: true });

		const result = await exportChannels.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHANNELS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportChannels',
				reason: 'INVALID_CHANNEL_FIELDS',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 429,
			message: 'Too many requests',
		});

		const result = await exportChannels.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHANNELS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportChannels',
				fields: 'name,channel_id,participant_count',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
	});

	it('should return a recoverable next-token validation error in AI Error Mode', async () => {
		const context = createContext({ nextToken: 'a'.repeat(1025) }, { enableAiErrorMode: true });

		const result = await exportChannels.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHANNELS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportChannels',
				reason: 'INVALID_NEXT_TOKEN',
				next_token: '[REDACTED]',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(exportChannels.description[exportChannels.description.length - 2]?.name).toBe(
			'exportChannelsDocsNotice',
		);
		expect(exportChannels.description[exportChannels.description.length - 1]?.name).toBe(
			'exportChannelsAiToolGuideNotice',
		);
	});
});
