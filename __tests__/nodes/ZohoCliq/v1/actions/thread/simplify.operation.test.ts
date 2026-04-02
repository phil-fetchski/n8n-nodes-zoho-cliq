import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/thread/list.operation';
import * as getMainMessage from '../../../../../../nodes/ZohoCliq/v1/actions/thread/getMainMessage.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const MOCK_THREAD_LIST_RESPONSE = {
	url: '/api/v2/threads',
	type: 'chat_thread',
	has_more: true,
	next_token: 'next-page-token',
	sync_token: 'sync-token',
	data: [
		{
			chat_id: 'CT_9001245010012354810_3467821-T-9001245010938461210',
			title: 'Daily Updates',
			thread_state: 'open',
			thread_message_id: '1629426730589_40288830613',
			parent_chat_id: 'CT_9001245010012354810_3467821',
			parent_message_sender: '45321098',
			is_follower: true,
			follower_count: 5,
			last_message_information: {
				sender_id: '45321098',
				message_type: 'text',
				time: '2024-12-12T10:45:00+05:30',
				text: 'Final report has been uploaded to the portal.',
			},
		},
	],
};

const MOCK_MAIN_MESSAGE_RESPONSE = {
	id: '1629426730589_40288830613',
	time: '1629426730589',
	type: 'text',
	is_read: false,
	revision: 1,
	ack_key: 'ack_123',
	parent_resource_id: 'Customer support',
	content: {
		text: 'Client reports the app is still very slow this morning.',
	},
	sender: {
		name: 'Zylker',
		id: '15067889',
	},
	thread_state_info: {
		thread_state: 'open',
	},
	thread_message: {
		msg: 'Team, any update on this issue?',
		msgid: '1629465328058',
		msguid: '1629465328414_83277101498',
		id: '1629465328414_83277101498',
		time: '1629465328414',
	},
	thread_information: {
		is_follower: true,
		message_count: 19,
		follower_count: 2,
		thread_message_id: '1629426730589_40288830613',
		title: 'Client slowness',
		chat_id: 'CT_1256254372211218512_15067887-T-1256254377053952763',
	},
};

describe('ZohoCliq - Thread - Simplify Operation Tests', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createListContext = (
		values: {
			channelId?: string;
			additionalFields?: IDataObject;
			simplify?: boolean;
			simplifyMode?: string;
			simplifyFields?: string[];
		} = {},
	): IExecuteFunctions => {
		const {
			channelId = 'CH_123_456',
			additionalFields = {},
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'channelId') return channelId;
				if (name === 'additionalFields') return additionalFields;
				if (name === 'simplify') return simplify;
				if (name === 'simplifyMode') return simplifyMode;
				if (name === 'simplifyFields') return simplifyFields;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	};

	const createGetMainMessageContext = (
		values: {
			threadChatId?: string;
			simplify?: boolean;
			simplifyMode?: string;
			simplifyFields?: string[];
		} = {},
	): IExecuteFunctions => {
		const {
			threadChatId = 'CT_123-T-456',
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'threadChatId') return threadChatId;
				if (name === 'simplify') return simplify;
				if (name === 'simplifyMode') return simplifyMode;
				if (name === 'simplifyFields') return simplifyFields;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	// -----------------------------------------------------------------------
	// Description tests
	// -----------------------------------------------------------------------

	describe('description', () => {
		it('list should expose simplify, simplifyMode, simplifyFields params', () => {
			const paramNames = list.description.map((p) => p.name);
			expect(paramNames).toContain('simplify');
			expect(paramNames).toContain('simplifyMode');
			expect(paramNames).toContain('simplifyFields');
		});

		it('getMainMessage should expose simplify, simplifyMode, simplifyFields params', () => {
			const paramNames = getMainMessage.description.map((p) => p.name);
			expect(paramNames).toContain('simplify');
			expect(paramNames).toContain('simplifyMode');
			expect(paramNames).toContain('simplifyFields');
		});
	});

	// -----------------------------------------------------------------------
	// Thread List - Simplify
	// -----------------------------------------------------------------------

	describe('thread/list simplify', () => {
		it('should return single item with full wrapper response in raw mode (simplify=false)', async () => {
			const ctx = createListContext({ simplify: false });
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_THREAD_LIST_RESPONSE);

			const result = await list.execute.call(ctx, items, SCOPES.CHATS_READ);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('data');
			expect(result[0].json).toHaveProperty('has_more', true);
			expect(result[0].json).toHaveProperty('next_token', 'next-page-token');
			expect(result[0].json).toHaveProperty('sync_token', 'sync-token');
			expect(result[0].json.data as IDataObject[]).toHaveLength(1);
		});

		it('should return _pagination item + individual simplified items when simplify is enabled', async () => {
			const ctx = createListContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_THREAD_LIST_RESPONSE);

			const result = await list.execute.call(ctx, items, SCOPES.CHATS_READ);

			// First item is _pagination, second is the simplified thread item
			expect(result).toHaveLength(2);

			// Pagination item
			expect(result[0].json).toEqual({
				_pagination: {
					has_more: true,
					next_token: 'next-page-token',
					sync_token: 'sync-token',
				},
			});

			// Simplified thread item
			const threadItem = result[1].json;
			expect(threadItem).toEqual({
				chat_id: 'CT_9001245010012354810_3467821-T-9001245010938461210',
				title: 'Daily Updates',
				thread_state: 'open',
				thread_message_id: '1629426730589_40288830613',
				parent_chat_id: 'CT_9001245010012354810_3467821',
				parent_message_sender: '45321098',
				is_follower: true,
				follower_count: 5,
				last_message_text: 'Final report has been uploaded to the portal.',
				last_message_time: '2024-12-12T10:45:00+05:30',
			});

			// Should NOT contain non-simplified keys
			expect(threadItem).not.toHaveProperty('last_message_information');
			expect(threadItem).not.toHaveProperty('url');
			expect(threadItem).not.toHaveProperty('type');
		});

		it('should return _pagination + items with only chat_id + selected fields', async () => {
			const ctx = createListContext({
				simplify: true,
				simplifyMode: 'selectedFields',
				simplifyFields: ['title', 'thread_state'],
			});
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_THREAD_LIST_RESPONSE);

			const result = await list.execute.call(ctx, items, SCOPES.CHATS_READ);

			expect(result).toHaveLength(2);

			// Pagination item
			expect(result[0].json).toEqual({
				_pagination: {
					has_more: true,
					next_token: 'next-page-token',
					sync_token: 'sync-token',
				},
			});

			// Selected fields item: idKey (chat_id) is always included + selected fields
			expect(result[1].json).toEqual({
				chat_id: 'CT_9001245010012354810_3467821-T-9001245010938461210',
				title: 'Daily Updates',
				thread_state: 'open',
			});

			// Should NOT have unselected keys
			expect(result[1].json).not.toHaveProperty('thread_message_id');
			expect(result[1].json).not.toHaveProperty('is_follower');
			expect(result[1].json).not.toHaveProperty('follower_count');
			expect(result[1].json).not.toHaveProperty('last_message_text');
		});

		it('should omit _pagination when no pagination keys are present in the response', async () => {
			const noPaginationResponse = {
				data: [...MOCK_THREAD_LIST_RESPONSE.data],
			};
			const ctx = createListContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValue(noPaginationResponse);

			const result = await list.execute.call(ctx, items, SCOPES.CHATS_READ);

			// Only the simplified items, no _pagination
			expect(result).toHaveLength(1);
			expect(result[0].json).not.toHaveProperty('_pagination');
			expect(result[0].json).toHaveProperty('chat_id');
		});
	});

	// -----------------------------------------------------------------------
	// Thread Get Main Message - Simplify
	// -----------------------------------------------------------------------

	describe('thread/getMainMessage simplify', () => {
		it('should return full response as-is in raw mode (simplify=false)', async () => {
			const ctx = createGetMainMessageContext({ simplify: false });
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_MAIN_MESSAGE_RESPONSE);

			const result = await getMainMessage.execute.call(ctx, items, SCOPES.MESSAGES_READ);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('id', '1629426730589_40288830613');
			expect(result[0].json).toHaveProperty('revision', 1);
			expect(result[0].json).toHaveProperty('ack_key', 'ack_123');
			expect(result[0].json).toHaveProperty('content');
			expect(result[0].json).toHaveProperty('sender');
			expect(result[0].json).toHaveProperty('thread_state_info');
			expect(result[0].json).toHaveProperty('thread_message');
			expect(result[0].json).toHaveProperty('thread_information');
		});

		it('should return simplified output with flattened fields when simplify is enabled', async () => {
			const ctx = createGetMainMessageContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_MAIN_MESSAGE_RESPONSE);

			const result = await getMainMessage.execute.call(ctx, items, SCOPES.MESSAGES_READ);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({
				id: '1629426730589_40288830613',
				time: '1629426730589',
				type: 'text',
				is_read: false,
				content_text: 'Client reports the app is still very slow this morning.',
				sender_name: 'Zylker',
				sender_id: '15067889',
				thread_state: 'open',
				thread_title: 'Client slowness',
				thread_message_count: 19,
			});

			// Should NOT have non-simplified keys
			expect(result[0].json).not.toHaveProperty('revision');
			expect(result[0].json).not.toHaveProperty('ack_key');
			expect(result[0].json).not.toHaveProperty('parent_resource_id');
			expect(result[0].json).not.toHaveProperty('content');
			expect(result[0].json).not.toHaveProperty('sender');
			expect(result[0].json).not.toHaveProperty('thread_state_info');
			expect(result[0].json).not.toHaveProperty('thread_message');
			expect(result[0].json).not.toHaveProperty('thread_information');
		});

		it('should return id + selected fields only when simplifyMode is selectedFields', async () => {
			const ctx = createGetMainMessageContext({
				simplify: true,
				simplifyMode: 'selectedFields',
				simplifyFields: ['type', 'is_read'],
			});
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_MAIN_MESSAGE_RESPONSE);

			const result = await getMainMessage.execute.call(ctx, items, SCOPES.MESSAGES_READ);

			expect(result).toHaveLength(1);

			// idKey (id) is always included + selected fields
			expect(result[0].json).toEqual({
				id: '1629426730589_40288830613',
				type: 'text',
				is_read: false,
			});

			// Should NOT have unselected keys
			expect(result[0].json).not.toHaveProperty('time');
			expect(result[0].json).not.toHaveProperty('content_text');
			expect(result[0].json).not.toHaveProperty('sender_name');
			expect(result[0].json).not.toHaveProperty('thread_state');
		});
	});
});
