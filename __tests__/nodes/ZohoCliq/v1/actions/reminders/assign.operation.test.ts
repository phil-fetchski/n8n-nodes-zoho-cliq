import { type IExecuteFunctions, type INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as assign from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/assign.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Assign Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { reminderId?: string; userIds?: string | string[] } = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { reminderId = 'rem_123', userIds = 'user_123,user_234' } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
				if (name === 'userIds') return userIds;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
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
		mockZohoCliqApiRequest.mockClear();
	});

	it('should assign reminder users successfully', async () => {
		const context = createContext({ userIds: ' user_123 , user_234 ' });
		mockZohoCliqApiRequest.mockResolvedValue({ success: true });

		await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders/rem_123/users', {
			user_ids: ['user_123', 'user_234'],
		});
	});

	it('should return REMINDER_TYPE_NOT_ASSIGNABLE when read preflight detects a chat-targeted reminder', async () => {
		const context = createContext(
			{ reminderId: 'rem_chat', userIds: 'user_123' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: 'rem_chat',
			chats: [{ chat_id: 'CT_123' }],
		});

		const result = await assign.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_chat');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reminder_id: 'rem_chat',
				user_ids: ['user_123'],
				reason: 'REMINDER_TYPE_NOT_ASSIGNABLE',
				hint: 'User assignment is supported only for users-type reminders in the Others category. Chat-targeted reminders do not support assignee updates.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
		const context = createContext(
			{ reminderId: 'rem_missing', userIds: 'user_123' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await assign.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_missing');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reminder_id: 'rem_missing',
				user_ids: ['user_123'],
				reason: 'REMINDER_NOT_FOUND',
				message: 'No reminder found for Reminder ID "rem_missing".',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should continue past read preflight when the reminder is users-type and has no chats array entries', async () => {
		const context = createContext(
			{ reminderId: 'rem_users', userIds: 'user_123' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_users',
				users: [{ id: 'user_123' }],
				chats: [],
			})
			.mockResolvedValueOnce({ success: true });

		await assign.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_users');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/reminders/rem_users/users',
			{
				user_ids: ['user_123'],
			},
		);
	});

	it('should continue past read preflight when the reminder response omits chats entirely', async () => {
		const context = createContext(
			{ reminderId: 'rem_users_no_chats', userIds: 'user_123' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_users_no_chats',
				users: [{ id: 'user_123' }],
			})
			.mockResolvedValueOnce({ success: true });

		await assign.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/reminders/rem_users_no_chats',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/reminders/rem_users_no_chats/users',
			{
				user_ids: ['user_123'],
			},
		);
	});

	it('should skip the shared reminder preflight when reminder read scope is unavailable', async () => {
		const context = createContext({ reminderId: 'rem_users_no_read', userIds: 'user_123' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ success: true });

		await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'POST',
			'/api/v2/reminders/rem_users_no_read/users',
			{
				user_ids: ['user_123'],
			},
		);
	});

	it('should stop before the assign request when the active reminder preflight gets a malformed payload', async () => {
		const context = createContext(
			{ reminderId: 'rem_users_null', userIds: 'user_123' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce(null as unknown as Record<string, never>);

		const result = await assign.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_users_null');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reminder_id: 'rem_users_null',
				user_ids: ['user_123'],
				message: 'The reminder preflight did not return an object response.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should stop before the assign request when the active reminder preflight lookup fails', async () => {
		const context = createContext(
			{ reminderId: 'rem_123', userIds: 'user_123' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Lookup failed'));

		const result = await assign.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_123');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reminder_id: 'rem_123',
				user_ids: ['user_123'],
				message: 'Lookup failed',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();

		const requiredScope = getRequiredScopeForOperation('reminders', 'assign');
		let thrownError: unknown;
		try {
			await assign.execute.call(context, items, '');
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

	it('should return a recoverable batch-limit error when continueOnFail is enabled', async () => {
		const context = createContext({ userIds: 'u1,u2,u3,u4,u5' }, { continueOnFail: true });

		const result = await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reason: 'USER_BATCH_LIMIT_EXCEEDED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable invalid-reminder error in AI Error Mode', async () => {
		const context = createContext({ reminderId: 'bad/id' }, { enableAiErrorMode: 'true' });

		const result = await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a generic recoverable error when reminder and user inputs are non-string values', async () => {
		const context = createContext(
			{ reminderId: 123 as unknown as string, userIds: { broken: true } as unknown as string },
			{ continueOnFail: true },
		);

		const result = await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json).not.toHaveProperty('reminder_id');
		expect(result[0].json).not.toHaveProperty('user_ids');
	});

	it('should return a mapped Others-category recoverable error in AI Error Mode', async () => {
		const context = createContext({ userIds: 'user_123' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Uh-Oh! You are not authorized to do this operation.'),
		);

		const result = await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reason: 'OTHERS_CATEGORY_REQUIRED',
				reminder_id: 'rem_123',
				user_ids: ['user_123'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should map alternate invalid-user API wording in AI Error Mode', async () => {
		const context = createContext({ userIds: 'user_123' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Assigned user id is invalid for assignment'),
		);

		const result = await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reason: 'INVALID_USER_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should map alternate Others-category API wording in AI Error Mode', async () => {
		const context = createContext({ userIds: 'user_123' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Assign operation is supported only for others category reminders'),
		);

		const result = await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reason: 'OTHERS_CATEGORY_REQUIRED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a generic BAD_REQUEST payload when assign preflight is skipped and the endpoint later fails', async () => {
		const context = createContext(
			{ reminderId: 'rem_404', userIds: 'user_123' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'assign',
				reminder_id: 'rem_404',
				user_ids: ['user_123'],
				reason: 'BAD_REQUEST',
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should rethrow API errors when recoverable mode is disabled', async () => {
		const context = createContext({ userIds: 'user_123' });
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Request failed'));

		await expect(assign.execute.call(context, items, SCOPES.REMINDERS_UPDATE)).rejects.toThrow(
			'Request failed',
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(assign.description[assign.description.length - 2]?.name).toBe(
			'assignReminderDocsNotice',
		);
		expect(assign.description[assign.description.length - 1]?.name).toBe(
			'assignReminderAiToolGuideNotice',
		);
		expect(String(assign.description[assign.description.length - 2]?.displayName)).toContain(
			'REQUIRED SCOPES:',
		);
	});
});
