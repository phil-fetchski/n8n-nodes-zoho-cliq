import { type IExecuteFunctions, type INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as remindAssignees from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/remindAssignees.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Remind Assignees Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			reminderId?: string;
			inputMode?: string;
			userIds?: string | string[];
			remindAssigneesPayload?: unknown;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const {
			reminderId = 'rem_123',
			inputMode = 'structured',
			userIds = 'user_1,user_2',
			remindAssigneesPayload = { user_ids: ['user_1', 'user_2'] },
		} = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
				if (name === 'inputMode') return inputMode;
				if (name === 'userIds') return userIds;
				if (name === 'remindAssigneesPayload') return remindAssigneesPayload;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: { constructExecutionMetaData: jest.fn((data) => data) },
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

	it('should remind assignees in structured mode', async () => {
		const context = createContext();

		await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123/remind', {
			user_ids: ['user_1', 'user_2'],
		});
	});

	it('should remind assignees in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			remindAssigneesPayload: { user_ids: ['user_1', 'user_2'] },
		});

		await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123/remind', {
			user_ids: ['user_1', 'user_2'],
		});
	});

	it('should fail when OAuth scope is missing', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'remindAssignees');
		const promise = remindAssignees.execute.call(context, items, '');

		await expect(promise).rejects.toBeInstanceOf(NodeOperationError);
		await expect(promise).rejects.toMatchObject({
			zohoCliqScopeErrorPayload: expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		});
	});

	it('should return a recoverable input-mode error when continueOnFail is enabled', async () => {
		const context = createContext({ inputMode: 'later' }, { continueOnFail: true });

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'INVALID_INPUT_MODE',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable batch-limit error in AI Error Mode', async () => {
		const context = createContext(
			{ inputMode: 'structured', userIds: 'u1,u2,u3,u4,u5' },
			{ enableAiErrorMode: 'true' },
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'USER_BATCH_LIMIT_EXCEEDED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable unsupported-payload-field error in AI Error Mode', async () => {
		const context = createContext(
			{ inputMode: 'raw', remindAssigneesPayload: { user_ids: ['user_1'], extra: true } },
			{ enableAiErrorMode: 'true' },
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'UNSUPPORTED_PAYLOAD_FIELD',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a generic recoverable error when reminder and input-mode values are non-string', async () => {
		const context = createContext(
			{
				reminderId: 123 as unknown as string,
				inputMode: 123 as unknown as string,
				userIds: { broken: true } as unknown as string,
			},
			{ continueOnFail: true },
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json).not.toHaveProperty('reminder_id');
	});

	it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await remindAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${getRequiredScopeForOperation('reminders', 'get')}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_123');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'REMINDER_NOT_FOUND',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return USER_IDS_NOT_FOUND when shared user preflight proves one or more assignees are missing', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [{ id: 'user_1' }],
		});

		const result = await remindAssignees.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${getRequiredScopeForOperation('user', 'list')}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			{ limit: 100, fields: 'display_name' },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'USER_IDS_NOT_FOUND',
				user_ids: ['user_1', 'user_2'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a generic BAD_REQUEST payload when user lookup scope is unavailable and the endpoint later fails', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'user id invalid for remind batch',
		});

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'BAD_REQUEST',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a mapped Others-category recoverable error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Uh-Oh! You are not authorized to do this operation.'),
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'OTHERS_CATEGORY_REQUIRED',
				reminder_id: 'rem_123',
				user_ids: ['user_1', 'user_2'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should preserve user_ids for stringified raw JSON payloads in recoverable output', async () => {
		const context = createContext(
			{
				inputMode: 'raw',
				remindAssigneesPayload: JSON.stringify({ user_ids: ['user_9', 'user_10'] }),
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Remind operation works only for others category reminders'),
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'OTHERS_CATEGORY_REQUIRED',
				user_ids: ['user_9', 'user_10'],
				user_count: 2,
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should omit user_ids when raw JSON payload text cannot be parsed in recoverable output', async () => {
		const context = createContext(
			{
				inputMode: 'raw',
				remindAssigneesPayload: '{"user_ids": [bad json]}',
			},
			{ continueOnFail: true },
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json).not.toHaveProperty('user_ids');
		expect(result[0].json).not.toHaveProperty('user_count');
	});

	it('should omit user_ids when stringified raw JSON payload does not contain an array', async () => {
		const context = createContext(
			{
				inputMode: 'raw',
				remindAssigneesPayload: JSON.stringify({ user_ids: 'user_1' }),
			},
			{ continueOnFail: true },
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json).not.toHaveProperty('user_ids');
		expect(result[0].json).not.toHaveProperty('user_count');
	});

	it('should preserve structured array user IDs in recoverable context output', async () => {
		const context = createContext(
			{ inputMode: 'structured', userIds: ['user_1', 'user_2'] },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Remind operation works only for others category reminders'),
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'OTHERS_CATEGORY_REQUIRED',
				user_ids: ['user_1', 'user_2'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should keep structured array user IDs in validation recoverable output', async () => {
		const context = createContext(
			{ inputMode: 'structured', userIds: ['u1', 'u2', 'u3', 'u4', 'u5'] },
			{ enableAiErrorMode: 'true' },
		);

		const result = await remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignees',
				reason: 'USER_BATCH_LIMIT_EXCEEDED',
				user_ids: ['u1', 'u2', 'u3', 'u4', 'u5'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should rethrow non-category API errors', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Unexpected API failure'));

		await expect(
			remindAssignees.execute.call(context, items, SCOPES.REMINDERS_UPDATE),
		).rejects.toThrow('Unexpected API failure');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(remindAssignees.description[remindAssignees.description.length - 2]?.name).toBe(
			'remindAssigneesReminderDocsNotice',
		);
		expect(remindAssignees.description[remindAssignees.description.length - 1]?.name).toBe(
			'remindAssigneesReminderAiToolGuideNotice',
		);
		expect(
			String(remindAssignees.description[remindAssignees.description.length - 2]?.displayName),
		).toContain('REQUIRED SCOPES:');
	});
});
