import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import * as removeFollowers from '../../../../../../nodes/ZohoCliq/v1/actions/thread/removeFollowers.operation';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Thread - Remove Followers Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			threadChatId?: string;
			userIds?: unknown;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			threadChatId = 'CT_123-T-456',
			userIds = '15066855,15071629',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'threadChatId') return threadChatId;
				if (name === 'userIds') return userIds;
				if (name === 'resource') return 'thread';
				if (name === 'operation') return 'removeFollowers';
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
		mockZohoCliqApiRequest.mockReset();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);
	});

	it('should return enhanced output by default for minimal success responses', async () => {
		const context = createContext();

		const result = await removeFollowers.execute.call(context, items, SCOPES.CHATS_DELETE);

		expect(result[0].json).toEqual({
			data: '',
			deleted: true,
			success: true,
			resource: 'thread',
			operation: 'removeFollowers',
			thread_chat_id: 'CT_123-T-456',
			user_ids: ['15066855', '15071629'],
			removed_count: 2,
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/threads/CT_123-T-456/followers',
			{ user_ids: ['15066855', '15071629'] },
		);
	});

	it('should preflight the thread and user IDs when compatible read scopes are granted', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [] })
			.mockResolvedValueOnce({
				data: [
					{ id: '15066855', email_id: 'alpha@example.com' },
					{ user_id: '15071629', email_id: 'beta@example.com' },
				],
				has_more: false,
			})
			.mockResolvedValueOnce('' as unknown as Record<string, never>);

		await removeFollowers.execute.call(
			context,
			items,
			`${SCOPES.CHATS_DELETE},${SCOPES.CHATS_READ},${SCOPES.USERS_READ}`,
		);

		expect(mockZohoCliqApiRequest.mock.calls).toEqual([
			['GET', '/api/v2/chats/CT_123-T-456/members', {}, {}],
			['GET', '/api/v2/users', {}, { limit: 100, fields: 'display_name' }],
			['DELETE', '/api/v2/threads/CT_123-T-456/followers', { user_ids: ['15066855', '15071629'] }],
		]);
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });

		const result = await removeFollowers.execute.call(context, items, SCOPES.CHATS_DELETE);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();

		await expect(removeFollowers.execute.call(context, items, '')).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should return a recoverable invalid thread payload when continueOnFail is enabled', async () => {
		const context = createContext({
			threadChatId: '   ',
			userIds: '15066855',
			continueOnFail: true,
		});

		const result = await removeFollowers.execute.call(context, items, SCOPES.CHATS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'removeFollowers',
				user_ids: ['15066855'],
				reason: 'INVALID_THREAD_CHAT_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable invalid user_ids payload when continueOnFail is enabled', async () => {
		const context = createContext({
			userIds: '   ',
			continueOnFail: true,
		});

		const result = await removeFollowers.execute.call(context, items, SCOPES.CHATS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'removeFollowers',
				thread_chat_id: 'CT_123-T-456',
				reason: 'INVALID_USER_IDS',
				hint: 'Provide one or more thread follower user IDs as a comma-separated string. Reuse `data[].user_id` from Get Followers for the safest retry.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable invalid user_ids payload when a user ID has an invalid format', async () => {
		const context = createContext({
			userIds: 'bad/id',
			continueOnFail: true,
		});

		const result = await removeFollowers.execute.call(context, items, SCOPES.CHATS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'removeFollowers',
				reason: 'INVALID_USER_IDS',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should fall back to generic NOT_FOUND in AI Error Mode when chat-read scope is unavailable', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				statusCode: 404,
				data: { message: 'Thread not found' },
			},
		});

		const result = await removeFollowers.execute.call(context, items, SCOPES.CHATS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'removeFollowers',
				thread_chat_id: 'CT_123-T-456',
				user_ids: ['15066855', '15071629'],
				message: 'Thread not found',
				status_code: 404,
				reason: 'NOT_FOUND',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return USER_IDS_NOT_FOUND when user roster preflight exhaustively misses requested IDs', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
			data: [{ id: '15066855', email_id: 'alpha@example.com' }],
			has_more: false,
		});

		const result = await removeFollowers.execute.call(
			context,
			items,
			`${SCOPES.CHATS_DELETE},${SCOPES.CHATS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'removeFollowers',
				reason: 'USER_IDS_NOT_FOUND',
				message: 'One or more supplied user IDs could not be found in Zoho Cliq.',
				invalid_user_ids: ['15071629'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
		const context = createContext({ continueOnFail: true });

		const result = await removeFollowers.execute.call(context, items, '');

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'removeFollowers',
				}),
			},
		]);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices at the bottom of the description', () => {
		const names = removeFollowers.description.map((property) => property.name);
		expect(names.slice(-2)).toEqual([
			'removeThreadFollowersDocsNotice',
			'removeThreadFollowersAiToolGuideNotice',
		]);
	});
});
