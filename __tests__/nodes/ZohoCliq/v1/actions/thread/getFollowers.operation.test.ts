import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import * as getFollowers from '../../../../../../nodes/ZohoCliq/v1/actions/thread/getFollowers.operation';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Thread - Get Followers Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			threadChatId?: string;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			threadChatId = 'CT_123-T-456',
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'threadChatId') return threadChatId;
				if (name === 'resource') return 'thread';
				if (name === 'operation') return 'getFollowers';
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
	});

	it('should get followers successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ user_id: '15066855', email_id: 'scott.fisher@zylker.com', name: 'Scott' }],
		});

		const result = await getFollowers.execute.call(context, items, SCOPES.CHATS_READ);

		expect(result[0].json).toEqual({
			data: [{ user_id: '15066855', email_id: 'scott.fisher@zylker.com', name: 'Scott' }],
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/threads/CT_123-T-456/followers',
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();

		await expect(getFollowers.execute.call(context, items, '')).rejects.toThrow(NodeOperationError);
	});

	it('should return a recoverable validation payload when continueOnFail is enabled', async () => {
		const context = createContext({ threadChatId: '   ', continueOnFail: true });

		const result = await getFollowers.execute.call(context, items, SCOPES.CHATS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'getFollowers',
				reason: 'INVALID_THREAD_CHAT_ID',
				hint: 'Use the exact thread chat ID returned by List Threads for Channel or Get Main Message before retrieving followers.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable validation payload when the thread chat ID format is invalid', async () => {
		const context = createContext({ threadChatId: 'bad/id', continueOnFail: true });

		const result = await getFollowers.execute.call(context, items, SCOPES.CHATS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'getFollowers',
				thread_chat_id: 'bad/id',
				reason: 'INVALID_THREAD_CHAT_ID',
				hint: 'Use the exact thread chat ID returned by List Threads for Channel or Get Main Message before retrieving followers.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable validation payload when the thread chat ID is too long', async () => {
		const context = createContext({ threadChatId: `CT_${'1'.repeat(201)}`, continueOnFail: true });

		const result = await getFollowers.execute.call(context, items, SCOPES.CHATS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'getFollowers',
				reason: 'INVALID_THREAD_CHAT_ID',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should preflight the thread chat ID in recoverable mode before requesting followers', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({
			data: [{ user_id: '15066855', email_id: 'scott.fisher@zylker.com', name: 'Scott' }],
		});

		await getFollowers.execute.call(context, items, SCOPES.CHATS_READ);

		expect(mockZohoCliqApiRequest.mock.calls).toEqual([
			['GET', '/api/v2/chats/CT_123-T-456/members', {}, {}],
			['GET', '/api/v2/threads/CT_123-T-456/followers'],
		]);
	});

	it('should return THREAD_NOT_FOUND when shared preflight proves the thread chat ID is missing', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				statusCode: 404,
				data: { message: 'Request URL is invalid' },
			},
		});

		const result = await getFollowers.execute.call(context, items, SCOPES.CHATS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'thread',
				operation: 'getFollowers',
				thread_chat_id: 'CT_123-T-456',
				message: 'The supplied thread chat ID could not be found in Zoho Cliq.',
				reason: 'THREAD_NOT_FOUND',
				hint: 'Use List Threads for Channel or Get Main Message to discover a valid thread chat ID in the authenticated account before retrying.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123-T-456/members',
			{},
			{},
		);
	});

	it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
		const context = createContext({ continueOnFail: true });

		const result = await getFollowers.execute.call(context, items, '');

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'getFollowers',
				}),
			},
		]);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices at the bottom of the description', () => {
		const names = getFollowers.description.map((property) => property.name);
		expect(names.slice(-2)).toEqual([
			'getThreadFollowersDocsNotice',
			'getThreadFollowersAiToolGuideNotice',
		]);
	});
});
