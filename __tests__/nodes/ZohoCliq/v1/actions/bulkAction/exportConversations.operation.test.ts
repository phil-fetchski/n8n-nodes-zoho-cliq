import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

import * as exportConversations from '../../../../../../nodes/ZohoCliq/v1/actions/bulkAction/exportConversations.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - BulkAction - ExportConversations Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { conversationFields?: string[]; nextToken?: string } = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const conversationFields = Object.prototype.hasOwnProperty.call(values, 'conversationFields')
			? values.conversationFields
			: ['title', 'chat_id'];
		const nextToken = Object.prototype.hasOwnProperty.call(values, 'nextToken')
			? values.nextToken
			: '';
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'conversationFields') return conversationFields;
				if (name === 'nextToken') return nextToken;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				if (name === 'resource') return 'bulkAction';
				if (name === 'operation') return 'exportConversations';
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

	it('should export conversations successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue(
			'title,chat_id\nA,1' as unknown as Record<string, never>,
		);

		const result = await exportConversations.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHATS_READ,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats',
			undefined,
			{ fields: 'title,chat_id' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
		expect(result).toEqual([{ json: { csv: 'title,chat_id\nA,1' } }]);
	});

	it('should include next_token when provided', async () => {
		const context = createContext({ nextToken: 'next_page_1' });
		mockZohoCliqApiRequest.mockResolvedValue(
			'title,chat_id\nA,1\n\n\nnext_token=next_page_2' as unknown as Record<string, never>,
		);

		await exportConversations.execute.call(context, items, SCOPES.ORGANIZATION_CHATS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats',
			undefined,
			{ fields: 'title,chat_id', next_token: 'next_page_1' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should omit next_token when the parameter resolves to undefined', async () => {
		const context = createContext({ nextToken: undefined });
		mockZohoCliqApiRequest.mockResolvedValue(
			'title,chat_id\nA,1' as unknown as Record<string, never>,
		);

		await exportConversations.execute.call(context, items, SCOPES.ORGANIZATION_CHATS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats',
			undefined,
			{ fields: 'title,chat_id' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should throw for missing scope when recoverable mode is disabled', async () => {
		const context = createContext();

		let thrownError: unknown;
		try {
			await exportConversations.execute.call(context, items, '');
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
			operation: 'exportConversations',
			requiredScopes: [SCOPES.ORGANIZATION_CHATS_READ],
			missingScopes: [SCOPES.ORGANIZATION_CHATS_READ],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should throw for invalid conversation fields when recoverable mode is disabled', async () => {
		const context = createContext({ conversationFields: [] });

		await expect(
			exportConversations.execute.call(context, items, SCOPES.ORGANIZATION_CHATS_READ),
		).rejects.toThrow('Conversation Fields must include at least one field');
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext(
			{ conversationFields: ['title', 'title'] },
			{ continueOnFail: true },
		);

		const result = await exportConversations.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHATS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportConversations',
				reason: 'INVALID_CONVERSATION_FIELDS',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 500,
			message: 'Internal server error',
		});

		const result = await exportConversations.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHATS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportConversations',
				fields: 'title,chat_id',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
	});

	it('should return a recoverable next-token validation error in AI Error Mode', async () => {
		const context = createContext({ nextToken: 'a'.repeat(1025) }, { enableAiErrorMode: 'true' });

		const result = await exportConversations.execute.call(
			context,
			items,
			SCOPES.ORGANIZATION_CHATS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportConversations',
				reason: 'INVALID_NEXT_TOKEN',
				next_token: '[REDACTED]',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(exportConversations.description[exportConversations.description.length - 2]?.name).toBe(
			'exportConversationsDocsNotice',
		);
		expect(exportConversations.description[exportConversations.description.length - 1]?.name).toBe(
			'exportConversationsAiToolGuideNotice',
		);
	});
});
