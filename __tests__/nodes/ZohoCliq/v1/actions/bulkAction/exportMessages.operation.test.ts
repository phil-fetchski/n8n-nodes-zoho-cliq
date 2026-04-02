import type { INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { createBulkActionTestContext } from './createBulkActionTestContext';

import * as exportMessages from '../../../../../../nodes/ZohoCliq/v1/actions/bulkAction/exportMessages.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - BulkAction - ExportMessages Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const exportMessageScopes = SCOPES.ORGANIZATION_MESSAGES_READ_WITH_CHAT_LOOKUP;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should export messages successfully', async () => {
		const context = createBulkActionTestContext('exportMessages');
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ id: '1528182303637_7763880281', time: 1528182303637 }],
		});

		const result = await exportMessages.execute.call(context, items, exportMessageScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats/1277744317795524707/messages',
			undefined,
			undefined,
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
		expect(result).toEqual([
			{
				json: {
					data: [{ id: '1528182303637_7763880281', time: 1528182303637 }],
				},
			},
		]);
	});

	it('should include next_token when provided', async () => {
		const context = createBulkActionTestContext('exportMessages', {
			nextToken: 'next_page_1',
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ id: '1528182303637_7763880281', time: 1528182303637 }],
		});

		await exportMessages.execute.call(context, items, exportMessageScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats/1277744317795524707/messages',
			undefined,
			{ next_token: 'next_page_1' },
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should omit next_token when the parameter resolves to undefined', async () => {
		const context = createBulkActionTestContext('exportMessages', {
			nextToken: undefined,
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ id: '1528182303637_7763880281', time: 1528182303637 }],
		});

		await exportMessages.execute.call(context, items, exportMessageScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/maintenanceapi/v2/chats/1277744317795524707/messages',
			undefined,
			undefined,
			{ headers: { 'Content-Type': 'text/csv' }, json: false },
		);
	});

	it('should throw for missing scope when recoverable mode is disabled', async () => {
		const context = createBulkActionTestContext('exportMessages');

		let thrownError: unknown;
		try {
			await exportMessages.execute.call(context, items, '');
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
			operation: 'exportMessages',
			requiredScopes: [SCOPES.ORGANIZATION_MESSAGES_READ],
			missingScopes: [SCOPES.ORGANIZATION_MESSAGES_READ],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should throw for invalid chat ID when recoverable mode is disabled', async () => {
		const context = createBulkActionTestContext('exportMessages', {
			chatId: 'bad id with spaces',
		});

		await expect(exportMessages.execute.call(context, items, exportMessageScopes)).rejects.toThrow(
			'Invalid Chat ID format',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createBulkActionTestContext(
			'exportMessages',
			{ chatId: '' },
			{ continueOnFail: true },
		);

		const result = await exportMessages.execute.call(context, items, exportMessageScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportMessages',
				reason: 'INVALID_CHAT_ID',
			}),
		);
	});

	it('should return a recoverable validation error when chat ID is undefined in continueOnFail mode', async () => {
		const context = createBulkActionTestContext(
			'exportMessages',
			{ chatId: undefined },
			{ continueOnFail: true },
		);

		const result = await exportMessages.execute.call(context, items, exportMessageScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportMessages',
				reason: 'INVALID_CHAT_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('chat_id');
	});

	it('should return a mapped recoverable API error in AI Error Mode', async () => {
		const context = createBulkActionTestContext('exportMessages', {}, { enableAiErrorMode: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Chat not found',
		});

		const result = await exportMessages.execute.call(context, items, exportMessageScopes);

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
				operation: 'exportMessages',
				chat_id: '1277744317795524707',
				reason: 'CHAT_NOT_FOUND',
			}),
		);
	});

	it('should return a recoverable next-token validation error in AI Error Mode', async () => {
		const context = createBulkActionTestContext(
			'exportMessages',
			{ nextToken: 'a'.repeat(1025) },
			{ enableAiErrorMode: true },
		);

		const result = await exportMessages.execute.call(context, items, exportMessageScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bulkAction',
				operation: 'exportMessages',
				reason: 'INVALID_NEXT_TOKEN',
				next_token: '[REDACTED]',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(exportMessages.description[exportMessages.description.length - 2]?.name).toBe(
			'exportMessagesDocsNotice',
		);
		expect(exportMessages.description[exportMessages.description.length - 1]?.name).toBe(
			'exportMessagesAiToolGuideNotice',
		);
	});
});
