import { type IExecuteFunctions, type INodeExecutionData, NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as remindAssignee from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/remindAssignee.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Remind Assignee Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { reminderId?: string; userId?: string } = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { reminderId = 'rem_123', userId = 'user_1' } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
				if (name === 'userId') return userId;
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

	it('should remind a single assignee', async () => {
		const context = createContext();

		await remindAssignee.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/reminders/rem_123/users/user_1/remind',
		);
	});

	it('should fail when OAuth scope is missing', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'remindAssignee');
		const promise = remindAssignee.execute.call(context, items, '');

		await expect(promise).rejects.toBeInstanceOf(NodeOperationError);
		await expect(promise).rejects.toMatchObject({
			zohoCliqScopeErrorPayload: expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		});
	});

	it('should return a recoverable invalid-user error when continueOnFail is enabled', async () => {
		const context = createContext({ userId: 'bad/id' }, { continueOnFail: true });

		const result = await remindAssignee.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignee',
				reason: 'INVALID_USER_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a generic recoverable error when reminder and user inputs are non-string values', async () => {
		const context = createContext(
			{ reminderId: 123 as unknown as string, userId: { broken: true } as unknown as string },
			{ continueOnFail: true },
		);

		const result = await remindAssignee.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignee',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json).not.toHaveProperty('reminder_id');
		expect(result[0].json).not.toHaveProperty('user_id');
	});

	it('should return a mapped Others-category recoverable error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Uh-Oh! You are not authorized to do this operation.'),
		);

		const result = await remindAssignee.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignee',
				reason: 'OTHERS_CATEGORY_REQUIRED',
				reminder_id: 'rem_123',
				user_id: 'user_1',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await remindAssignee.execute.call(
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
				operation: 'remindAssignee',
				reason: 'REMINDER_NOT_FOUND',
				reminder_id: 'rem_123',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return USER_NOT_FOUND when shared user preflight proves the assignee is missing', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [{ id: 'user_other' }],
		});

		const result = await remindAssignee.execute.call(
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
				operation: 'remindAssignee',
				reason: 'USER_NOT_FOUND',
				user_id: 'user_1',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a generic BAD_REQUEST payload when user lookup scope is unavailable and the endpoint later fails', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'Selected user id is invalid for this nudge',
		});

		const result = await remindAssignee.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignee',
				reason: 'BAD_REQUEST',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should map alternate Others-category API wording in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('Remind operation works only for others category reminders'),
		);

		const result = await remindAssignee.execute.call(context, items, SCOPES.REMINDERS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'remindAssignee',
				reason: 'OTHERS_CATEGORY_REQUIRED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should rethrow non-category API errors', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Unexpected API failure'));

		await expect(
			remindAssignee.execute.call(context, items, SCOPES.REMINDERS_UPDATE),
		).rejects.toThrow('Unexpected API failure');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(remindAssignee.description[remindAssignee.description.length - 2]?.name).toBe(
			'remindAssigneeReminderDocsNotice',
		);
		expect(remindAssignee.description[remindAssignee.description.length - 1]?.name).toBe(
			'remindAssigneeReminderAiToolGuideNotice',
		);
		expect(
			String(remindAssignee.description[remindAssignee.description.length - 2]?.displayName),
		).toContain('REQUIRED SCOPES:');
	});
});
