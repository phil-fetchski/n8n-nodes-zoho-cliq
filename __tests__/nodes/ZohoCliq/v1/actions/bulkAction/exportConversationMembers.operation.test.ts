import type { INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { createBulkActionTestContext } from './createBulkActionTestContext';

import * as exportConversationMembers from '../../../../../../nodes/ZohoCliq/v1/actions/bulkAction/exportConversationMembers.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - BulkAction - ExportConversationMembers Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const exportConversationMemberScopes =
		SCOPES.ORGANIZATION_CONVERSATION_MEMBERS_READ_WITH_CHAT_LOOKUP;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should export conversation members successfully', async () => {
		const context = createBulkActionTestContext('exportConversationMembers');
		mockZohoCliqApiRequest.mockResolvedValue(
			'name,email_id\nScott,scott@example.com' as unknown as Record<string, never>,
		);

		const result = await exportConversationMembers.execute.call(
			context,
			items,
			exportConversationMemberScopes,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats/1277744317795524707/members',
			undefined,
			{ fields: 'name,email_id' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
		expect(result).toEqual([{ json: { csv: 'name,email_id\nScott,scott@example.com' } }]);
	});

	it('should include next_token when provided', async () => {
		const context = createBulkActionTestContext('exportConversationMembers', {
			nextToken: 'next_page_1',
		});
		mockZohoCliqApiRequest.mockResolvedValue(
			'name,email_id\nScott,scott@example.com\n\n\nnext_token=next_page_2' as unknown as Record<
				string,
				never
			>,
		);

		await exportConversationMembers.execute.call(context, items, exportConversationMemberScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats/1277744317795524707/members',
			undefined,
			{ fields: 'name,email_id', next_token: 'next_page_1' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should omit next_token when the parameter resolves to undefined', async () => {
		const context = createBulkActionTestContext('exportConversationMembers', {
			nextToken: undefined,
		});
		mockZohoCliqApiRequest.mockResolvedValue(
			'name,email_id\nScott,scott@example.com' as unknown as Record<string, never>,
		);

		await exportConversationMembers.execute.call(context, items, exportConversationMemberScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats/1277744317795524707/members',
			undefined,
			{ fields: 'name,email_id' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should throw for missing scope when recoverable mode is disabled', async () => {
		const context = createBulkActionTestContext('exportConversationMembers');

		let thrownError: unknown;
		try {
			await exportConversationMembers.execute.call(context, items, '');
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
			operation: 'exportConversationMembers',
			requiredScopes: [SCOPES.ORGANIZATION_CONVERSATION_MEMBERS_READ],
			missingScopes: [SCOPES.ORGANIZATION_CONVERSATION_MEMBERS_READ],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should throw for invalid chat ID when recoverable mode is disabled', async () => {
		const context = createBulkActionTestContext('exportConversationMembers', {
			chatId: 'bad id with spaces',
		});

		await expect(
			exportConversationMembers.execute.call(context, items, exportConversationMemberScopes),
		).rejects.toThrow('Invalid Chat ID format');
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createBulkActionTestContext(
			'exportConversationMembers',
			{ memberFields: ['email', 'name'] },
			{ continueOnFail: true },
		);

		const result = await exportConversationMembers.execute.call(
			context,
			items,
			exportConversationMemberScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportConversationMembers',
				chat_id: '1277744317795524707',
				reason: 'INVALID_MEMBER_FIELDS',
			}),
		);
	});

	it('should return a recoverable validation error when chat ID is omitted in continueOnFail mode', async () => {
		const context = createBulkActionTestContext(
			'exportConversationMembers',
			{ chatId: undefined },
			{ continueOnFail: true },
		);

		const result = await exportConversationMembers.execute.call(
			context,
			items,
			exportConversationMemberScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportConversationMembers',
				reason: 'INVALID_CHAT_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('chat_id');
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createBulkActionTestContext(
			'exportConversationMembers',
			{},
			{ enableAiErrorMode: true },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Chat not found',
		});

		const result = await exportConversationMembers.execute.call(
			context,
			items,
			exportConversationMemberScopes,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/1277744317795524707/members',
			{},
			{},
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportConversationMembers',
				chat_id: '1277744317795524707',
				reason: 'CHAT_NOT_FOUND',
			}),
		);
	});

	it('should return a recoverable next-token validation error in AI Error Mode', async () => {
		const context = createBulkActionTestContext(
			'exportConversationMembers',
			{ nextToken: 'a'.repeat(1025) },
			{ enableAiErrorMode: true },
		);

		const result = await exportConversationMembers.execute.call(
			context,
			items,
			exportConversationMemberScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportConversationMembers',
				reason: 'INVALID_NEXT_TOKEN',
				next_token: '[REDACTED]',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(
			exportConversationMembers.description[exportConversationMembers.description.length - 2]?.name,
		).toBe('exportConversationMembersDocsNotice');
		expect(
			exportConversationMembers.description[exportConversationMembers.description.length - 1]?.name,
		).toBe('exportConversationMembersAiToolGuideNotice');
	});
});
