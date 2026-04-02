import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as removeAssignees from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/removeAssignees.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Remove Assignees Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			reminderId?: string;
			userIds?: string | string[];
			includeEnhancedOutput?: boolean;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const {
			reminderId = 'rem_123',
			userIds = 'user_1,user_2',
			includeEnhancedOutput = true,
		} = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
				if (name === 'userIds') return userIds;
				if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
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

	it('should remove assignees successfully with enhanced output by default', async () => {
		const context = createContext();
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'rem_123', users: [{ id: 'user_2' }] })
			.mockResolvedValueOnce({ id: 'rem_123', users: [] });

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_2',
		);
		expect(result[0].json).toEqual({
			id: 'rem_123',
			users: [],
			deleted: true,
			success: true,
			resource: 'reminders',
			operation: 'removeAssignees',
			reminder_id: 'rem_123',
			removed_user_ids: ['user_1', 'user_2'],
			user_count: 2,
			api_call_count: 2,
			single_user_endpoint_used: true,
		});
	});

	it('should return LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED when read preflight detects a users-type reminder would lose its final assignee', async () => {
		const context = createContext({ userIds: '904715551' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: 'rem_123',
			users: [{ id: '904715551', name: 'Jordan Schools' }],
			creator: { id: '839367970', name: 'Philip Schools' },
		});

		const result = await removeAssignees.execute.call(
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
				operation: 'removeAssignees',
				reminder_id: 'rem_123',
				user_ids: ['904715551'],
				user_count: 1,
				reason: 'LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED',
				hint: 'A users-type reminder must keep at least one assignee. Remove fewer users, or use Delete Reminder if the reminder should be removed entirely.',
			}),
		);
	});

	it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await removeAssignees.execute.call(
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
				operation: 'removeAssignees',
				reminder_id: 'rem_123',
				user_ids: ['user_1'],
				user_count: 1,
				reason: 'REMINDER_NOT_FOUND',
				message: 'No reminder found for Reminder ID "rem_123".',
			}),
		);
	});

	it('should skip the shared reminder preflight when reminder read scope is unavailable', async () => {
		const context = createContext({ userIds: 'user_1' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: 'rem_123', users: [] });

		await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
	});

	it('should return a generic BAD_REQUEST payload when remove-assignees preflight is skipped and the endpoint later fails', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				reminder_id: 'rem_123',
				user_ids: ['user_1'],
				user_count: 1,
				reason: 'BAD_REQUEST',
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			}),
		);
	});

	it('should stop before delete calls when the active reminder preflight gets a malformed payload', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValueOnce(null as unknown as Record<string, never>);

		const result = await removeAssignees.execute.call(
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
				operation: 'removeAssignees',
				reminder_id: 'rem_123',
				user_ids: ['user_1'],
				message: 'The reminder preflight did not return an object response.',
			}),
		);
	});

	it('should skip last-assignee preflight blocking for chat-targeted reminders', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_123',
				chats: [{ chat_id: 'CT_123', title: 'Zylker Appathon' }],
				users: [{ id: 'user_1' }],
			})
			.mockResolvedValueOnce({ id: 'rem_123', users: [] });

		await removeAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
	});

	it('should skip last-assignee preflight blocking for message-linked reminders', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_123',
				message: {
					message_id: 1772395354414,
					chat_id: 'CT_123',
				},
				users: [{ id: 'user_1' }],
			})
			.mockResolvedValueOnce({ id: 'rem_123', users: [] });

		await removeAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
	});

	it('should continue to batched delete calls when the reminder lookup has no assigned users array', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_123',
				creator: { id: '839367970' },
			})
			.mockResolvedValueOnce({ id: 'rem_123', users: [] });

		await removeAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
	});

	it('should ignore malformed or blank user entries when counting current assignees in preflight', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_123',
				users: [null, [], {}, { id: '   ' }, { id: 'user_1' }, { id: 'user_2' }],
			})
			.mockResolvedValueOnce({ id: 'rem_123', users: [{ id: 'user_2' }] });

		await removeAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
	});

	it('should continue to batched delete calls when removing one assignee still leaves another assignee on the reminder', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_123',
				users: [{ id: 'user_1' }, { id: 'user_2' }],
			})
			.mockResolvedValueOnce({ id: 'rem_123', users: [{ id: 'user_2' }] });

		await removeAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_1',
		);
	});

	it('should continue to batched delete calls when requested removals do not match any currently assigned user', async () => {
		const context = createContext({ userIds: 'user_9' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: 'rem_123',
				users: [{ id: 'user_1' }, { id: 'user_2' }],
			})
			.mockResolvedValueOnce({ id: 'rem_123', users: [{ id: 'user_1' }, { id: 'user_2' }] });

		await removeAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/reminders/rem_123/users/user_9',
		);
	});

	it('should stop before delete calls when the active reminder preflight lookup fails', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Lookup failed'));

		const result = await removeAssignees.execute.call(
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
				operation: 'removeAssignees',
				reminder_id: 'rem_123',
				user_ids: ['user_1'],
				message: 'Lookup failed',
			}),
		);
	});

	it("should return Cliq's standard final response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false, userIds: 'user_1' });
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123', users: [] });

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual({ deleted: true, id: 'rem_123', users: [] });
	});

	it('should fall back to an empty raw response object when the final API response is undefined', async () => {
		const context = createContext({ userIds: 'user_1' });
		mockZohoCliqApiRequest.mockResolvedValue(undefined as unknown as Record<string, never>);

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'reminders',
			operation: 'removeAssignees',
			reminder_id: 'rem_123',
			removed_user_ids: ['user_1'],
			user_count: 1,
			api_call_count: 1,
			single_user_endpoint_used: true,
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();

		const requiredScope = getRequiredScopeForOperation('reminders', 'removeAssignees');
		let thrownError: unknown;
		try {
			await removeAssignees.execute.call(context, items, '');
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
		const context = createContext(
			{ userIds: 'user_1,user_2,user_3,user_4,user_5' },
			{ continueOnFail: true },
		);

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				reason: 'USER_BATCH_LIMIT_EXCEEDED',
				user_ids: ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'],
			}),
		);
	});

	it('should rebuild user_ids from array input in recoverable validation output', async () => {
		const context = createContext(
			{ userIds: ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'] },
			{ continueOnFail: true },
		);

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				reason: 'USER_BATCH_LIMIT_EXCEEDED',
				user_ids: ['user_1', 'user_2', 'user_3', 'user_4', 'user_5'],
			}),
		);
	});

	it('should fall back to omitting user_ids when userIds cannot be re-read in recoverable output', async () => {
		const brokenContext = {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return 'rem_123';
				if (name === 'userIds') {
					const calls = (brokenContext.getNodeParameter as jest.Mock).mock.calls.filter(
						([calledName]) => calledName === 'userIds',
					).length;
					if (calls === 1) return { broken: true };
					throw new Error('userIds unavailable');
				}
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			}),
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: false },
			})),
		} as unknown as IExecuteFunctions;

		const result = await removeAssignees.execute.call(
			brokenContext,
			items,
			SCOPES.REMINDERS_UPDATE,
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_ids');
	});

	it('should rebuild user_ids from an array during the nested fallback path', async () => {
		const fallbackArrayContext = {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return 'rem_123';
				if (name === 'userIds') {
					const calls = (fallbackArrayContext.getNodeParameter as jest.Mock).mock.calls.filter(
						([calledName]) => calledName === 'userIds',
					).length;
					if (calls === 1) return { broken: true };
					return ['user_1', 'user_2'];
				}
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			}),
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: false },
			})),
		} as unknown as IExecuteFunctions;

		const result = await removeAssignees.execute.call(
			fallbackArrayContext,
			items,
			SCOPES.REMINDERS_UPDATE,
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				user_ids: ['user_1', 'user_2'],
				user_count: 2,
			}),
		);
	});

	it('should leave user_ids undefined when the nested fallback re-read is neither string nor array', async () => {
		const fallbackUnknownContext = {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return 'rem_123';
				if (name === 'userIds') {
					const calls = (fallbackUnknownContext.getNodeParameter as jest.Mock).mock.calls.filter(
						([calledName]) => calledName === 'userIds',
					).length;
					if (calls === 1) return { broken: true };
					return 42;
				}
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			}),
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: false },
			})),
		} as unknown as IExecuteFunctions;

		const result = await removeAssignees.execute.call(
			fallbackUnknownContext,
			items,
			SCOPES.REMINDERS_UPDATE,
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_ids');
	});

	it('should return a generic recoverable error for ambiguous not-authorized API wording in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'rem_123', users: [{ id: 'user_2' }] })
			.mockRejectedValueOnce(new Error('Uh-Oh! You are not authorized to do this operation.'));

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				reminder_id: 'rem_123',
				user_ids: ['user_1', 'user_2'],
				user_id: 'user_2',
			}),
		);
		expect(result[0].json).not.toHaveProperty('reason', 'OTHERS_CATEGORY_REQUIRED');
	});

	it('should preserve failing-user context for alternate invalid-user API wording in AI Error Mode', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('user id invalid for assignee removal'));

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				reason: 'INVALID_USER_ID',
				message: 'user id invalid for assignee removal',
				user_id: 'user_1',
			}),
		);
	});

	it('should map invalid-reminder API wording in AI Error Mode', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce(
			new Error('reminder id invalid for assignee removal'),
		);

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
	});

	it('should map alternate Others-category API wording in AI Error Mode', async () => {
		const context = createContext({ userIds: 'user_1' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce(
			new Error('Remove operation is supported only for others category reminders'),
		);

		const result = await removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'removeAssignees',
				reason: 'OTHERS_CATEGORY_REQUIRED',
			}),
		);
	});

	it('should rethrow per-user delete failures when recoverable mode is disabled', async () => {
		const context = createContext();
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'rem_123', users: [{ id: 'user_2' }] })
			.mockRejectedValueOnce('raw transport failure');

		await expect(
			removeAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE),
		).rejects.toThrow(
			'Failed to remove assignee "user_2" from reminder "rem_123": raw transport failure',
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(removeAssignees.description[removeAssignees.description.length - 2]?.name).toBe(
			'removeAssigneesReminderDocsNotice',
		);
		expect(removeAssignees.description[removeAssignees.description.length - 1]?.name).toBe(
			'removeAssigneesReminderAiToolGuideNotice',
		);
		expect(
			String(removeAssignees.description[removeAssignees.description.length - 2]?.displayName),
		).toContain('REQUIRED SCOPES:');
	});
});
