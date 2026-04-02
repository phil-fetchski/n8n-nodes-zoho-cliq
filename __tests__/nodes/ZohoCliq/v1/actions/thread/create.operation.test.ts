import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/thread/create.operation';
import { createRichMessageParameterMock } from '../shared/testUtils';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Thread - Create Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const threadCreateWithChatLookupScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHATS_READ}`;

	let mockExecuteFunctions: IExecuteFunctions;

	const setupParameterMock = (params: Record<string, unknown>) => {
		createRichMessageParameterMock(mockExecuteFunctions.getNodeParameter as jest.Mock, params);
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('execute', () => {
		it('should create a thread successfully with fixed Channel target', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: { threadTitle: 'Thread Title' },
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({
				message_id: '1772612422798_209244327054',
			});
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/CH_123_456/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
					text: 'Thread message text',
					thread_title: 'Thread Title',
				}),
			);
		});

		it('should preflight fixed Channel targets when recoverable mode is enabled and channel-read scope is granted', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({ id: 'CH_123_456' })
				.mockResolvedValueOnce({ message_id: '1772612422798_209244327054' });

			await create.execute.call(
				mockExecuteFunctions,
				items,
				`${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`,
			);

			expect(mockZohoCliqApiRequest.mock.calls).toEqual([
				['GET', '/api/v2/channels/CH_123_456'],
				[
					'POST',
					'/api/v2/channels/CH_123_456/message',
					expect.objectContaining({
						thread_message_id: 'MSG_123_456',
						text: 'Thread message text',
					}),
				],
			]);
		});

		it('should create a thread successfully with a fixed Channel resource locator object', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'target') return 'channel';
					if (paramName === 'channelId') return { mode: 'id', value: 'CH_123_456' };
					if (paramName === 'threadMessageId') return 'MSG_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Thread message text';
					if (paramName === 'additionalFields') return {};
					if (paramName === 'postAsBot') return false;
					return defaultValue;
				},
			);

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			const [, , requestBody] = mockZohoCliqApiRequest.mock.calls[0];
			expect(requestBody).not.toHaveProperty('bot');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/CH_123_456/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
					text: 'Thread message text',
				}),
			);
		});

		it('should create a thread successfully with fixed Channel (By Unique Name) target', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channelUniqueName',
				channelUniqueName: 'eng-updates',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channelsbyname/eng-updates/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
				}),
			);
		});

		it('should return CHANNEL_NOT_FOUND when channel unique name preflight proves the target is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			});
			setupParameterMock({
				target: 'channelUniqueName',
				channelUniqueName: 'eng-updates',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockRejectedValueOnce({
				response: {
					statusCode: 404,
					data: { message: 'Request URL is invalid' },
				},
			});

			const result = await create.execute.call(
				mockExecuteFunctions,
				items,
				`${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`,
			);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'create',
						channel_unique_name: 'eng-updates',
						reason: 'CHANNEL_NOT_FOUND',
						hint: 'Use Get Channel or List Channels to confirm the exact channel ID or channel unique name before retrying.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/channelsbyname/eng-updates',
			);
		});

		it('should skip channel preflight gracefully when recoverable mode is enabled but channel-read scope is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValueOnce({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(mockZohoCliqApiRequest.mock.calls).toEqual([
				[
					'POST',
					'/api/v2/channels/CH_123_456/message',
					expect.objectContaining({
						thread_message_id: 'MSG_123_456',
						text: 'Thread message text',
					}),
				],
			]);
		});

		it('should create a thread successfully with fixed Chat target', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'chat',
				chatId: 'CT_1234567890_1234567890',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			const result = await create.execute.call(
				mockExecuteFunctions,
				items,
				threadCreateWithChatLookupScopes,
			);

			expect(result[0].json).toEqual({ message_id: '1772612422798_209244327054' });
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_1234567890_1234567890/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
				}),
			);
		});

		it('should create a thread successfully with Agent Selected Target = channel_id', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'channel_id',
				agentChannelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/CH_123_456/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
				}),
			);
		});

		it('should create a thread successfully with Agent Selected Target = channel_unique_name', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'channel_unique_name',
				agentChannelUniqueName: 'eng-updates',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channelsbyname/eng-updates/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
				}),
			);
		});

		it('should create a thread successfully with Agent Selected Target = chat_id after shared preflight in recoverable mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'chat_id',
				agentChatId: 'CT_1234567890_1234567890',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({})
				.mockResolvedValueOnce({ message_id: '1772612422798_209244327054' });

			await create.execute.call(mockExecuteFunctions, items, threadCreateWithChatLookupScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/members',
				{},
				{},
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'POST',
				'/api/v2/chats/CT_1234567890_1234567890/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
				}),
			);
		});

		it('should reject fixed Channel target when a legacy channel unique-name locator mode is supplied', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(
					paramName: string,
					_itemIndex: number,
					defaultValue?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (paramName === 'target') return 'channel';
					if (paramName === 'channelId' && options?.extractValue) return 'eng-updates';
					if (paramName === 'channelId') return { mode: 'name', value: 'eng-updates' };
					if (paramName === 'threadMessageId') return 'MSG_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Thread message text';
					if (paramName === 'additionalFields') return {};
					if (paramName === 'postAsBot') return false;
					return defaultValue;
				},
			);

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(
				'Target "Channel" accepts channel list selection or Channel ID only. Use Target "Channel (By Unique Name)" when routing by channel unique name.',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Target is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow('Target is required');
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Target is invalid', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'thread',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(
				'Target must be one of: "agentChoice", "channel", "channelUniqueName", "chat".',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Channel ID is missing for fixed Channel target', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when fixed Channel locator is an empty object', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'target') return 'channel';
					if (paramName === 'channelId') return {};
					if (paramName === 'threadMessageId') return 'MSG_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Thread message text';
					if (paramName === 'additionalFields') return {};
					if (paramName === 'postAsBot') return false;
					return defaultValue;
				},
			);

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when fixed Channel locator is an array', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'target') return 'channel';
					if (paramName === 'channelId') return [];
					if (paramName === 'threadMessageId') return 'MSG_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Thread message text';
					if (paramName === 'additionalFields') return {};
					if (paramName === 'postAsBot') return false;
					return defaultValue;
				},
			);

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should reject agent-choice calls with extra identifier fields from another target family', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'channel_id',
				agentChannelId: 'CH_123_456',
				agentChatId: 'CT_1234567890_1234567890',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(
				'When Agent Selected Target is "channel_id", only the matching target identifier field may be provided. Clear "Chat ID".',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Agent Selected Target is missing for agentChoice routing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(
				'Agent Selected Target is required when Target is set to "Agent\'s Choice".',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Agent Selected Target is invalid for agentChoice routing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'channelId',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(
				'Agent Selected Target must be one of: "channel_id", "channel_unique_name", "chat_id".',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Agent Selected Target is channel_id but Channel ID is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'channel_id',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow('Channel ID is required when Agent Selected Target is "channel_id".');
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Agent Selected Target is channel_unique_name but Channel Unique Name is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'channel_unique_name',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(
				'Channel Unique Name is required when Agent Selected Target is "channel_unique_name".',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				resource: 'thread',
				operation: 'create',
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
			});

			let thrownError: unknown;
			try {
				await create.execute.call(mockExecuteFunctions, items, '');
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toContain('Missing OAuth scope for');
			expect(
				(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
			).toEqual({
				success: false,
				resource: 'thread',
				operation: 'create',
				requiredScopes: [SCOPES.WEBHOOKS_CREATE],
				missingScopes: [SCOPES.WEBHOOKS_CREATE],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should skip chat preflight and still create with fixed Chat target when chat-read scope is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'chat',
				chatId: 'CT_1234567890_1234567890',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(result[0].json).toEqual({ message_id: '1772612422798_209244327054' });
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_1234567890_1234567890/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
				}),
			);
		});

		it('should skip chat preflight and still create with agent-selected chat_id when chat-read scope is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'chat_id',
				agentChatId: 'CT_1234567890_1234567890',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(result[0].json).toEqual({ message_id: '1772612422798_209244327054' });
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_1234567890_1234567890/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
				}),
			);
		});

		it('should return a recoverable API payload in continueOnFail mode for fixed Channel target', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});
			mockZohoCliqApiRequest.mockRejectedValue(new Error('API request failed'));

			const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'create',
						target_selection: 'channel',
						channel_id: 'CH_123_456',
						thread_message_id: 'MSG_123_456',
						message: 'API request failed',
					}),
				},
			]);
		});

		it('should return a mapped CHAT_NOT_FOUND recoverable payload in continueOnFail mode for fixed Chat target', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				target: 'chat',
				chatId: 'CT_1234567890_1234567890',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});
			mockZohoCliqApiRequest.mockRejectedValueOnce({
				response: {
					status: 404,
					data: {
						message: 'chat not found',
					},
				},
			});

			const result = await create.execute.call(
				mockExecuteFunctions,
				items,
				threadCreateWithChatLookupScopes,
			);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'create',
					target_selection: 'chat',
					chat_id: 'CT_1234567890_1234567890',
					reason: 'CHAT_NOT_FOUND',
					hint: 'Use a valid chat ID that belongs to a conversation accessible to the authenticated Zoho Cliq account. If you intended a channel conversation, use the conversation chat ID rather than the channel ID.',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		});

		it('should return a recoverable validation payload in AI Error Mode for agent-selected chat_id input errors', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			});
			setupParameterMock({
				target: 'agentChoice',
				agentSelectedTarget: 'chat_id',
				agentChatId: '   ',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: {},
			});

			const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'create',
						target_selection: 'agentChoice',
						agent_selected_target: 'chat_id',
						message: 'Chat ID is required when Agent Selected Target is "chat_id".',
					}),
				},
			]);
		});

		it('should include bot_unique_name query when Post as Bot is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				postAsBot: true,
				botUniqueName: 'MyBot123',
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/CH_123_456/message',
				expect.objectContaining({ thread_message_id: 'MSG_123_456' }),
				{ bot_unique_name: 'MyBot123' },
			);
		});

		it('should include post_in_parent and sync_message when enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: { postInParent: true, syncMessage: true },
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/CH_123_456/message',
				expect.objectContaining({
					thread_message_id: 'MSG_123_456',
					post_in_parent: true,
					sync_message: true,
				}),
			);
		});

		it('should decode sync_message response message id variants before returning them', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: { syncMessage: true },
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798%20209244327054',
				thread_information: {
					thread_message_id: '1773676805202%20412172172370',
				},
			});

			const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			expect(result[0].json).toEqual({
				message_id: '1772612422798_209244327054',
				thread_information: {
					thread_message_id: '1773676805202_412172172370',
				},
			});
		});

		it('should throw when Thread Title is not a string', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: { threadTitle: 123 },
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow('Thread Title must be a string');
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should ignore a whitespace-only Thread Title', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: { threadTitle: '   ' },
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			const [, , requestBody] = mockZohoCliqApiRequest.mock.calls[0];
			expect(requestBody).toMatchObject({
				thread_message_id: 'MSG_123_456',
				text: 'Thread message text',
			});
			expect(requestBody).not.toHaveProperty('thread_title');
		});

		it('should throw when Post In Parent is not a boolean', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: { postInParent: 'yes' },
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow('Post In Parent must be a boolean');
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when Sync Message is not a boolean', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'text',
				text: 'Thread message text',
				additionalFields: { syncMessage: 'yes' },
			});

			await expect(
				create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow('Sync Message must be a boolean');
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should create a thread with rich message payload for fixed Channel target', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			setupParameterMock({
				target: 'channel',
				channelId: 'CH_123_456',
				threadMessageId: 'MSG_123_456',
				messageType: 'rich',
				richMessage: {
					text: 'Structured thread message',
					cardTitle: 'Thread Card',
					slides: {
						slide: [{ type: 'text', title: 'Slide 1', textData: 'A' }],
					},
				},
				additionalFields: {},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				message_id: '1772612422798_209244327054',
			});

			await create.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

			const [, , requestBody] = mockZohoCliqApiRequest.mock.calls[0];
			expect(requestBody).toMatchObject({
				thread_message_id: 'MSG_123_456',
				text: 'Structured thread message',
				card: JSON.stringify({ title: 'Thread Card' }),
			});
			expect(requestBody).toHaveProperty('slides', expect.any(String));
		});
	});

	describe('description', () => {
		it('should expose target-first routing fields for the Create Thread overhaul', () => {
			const targetProperty = create.description.find((property) => property.name === 'target');
			const agentSelectedTargetProperty = create.description.find(
				(property) => property.name === 'agentSelectedTarget',
			);

			expect(targetProperty?.displayName).toBe('Target');
			expect(agentSelectedTargetProperty?.options).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ value: 'channel_id' }),
					expect.objectContaining({ value: 'channel_unique_name' }),
					expect.objectContaining({ value: 'chat_id' }),
				]),
			);
		});

		it('should keep message payload fields scoped to thread/create', () => {
			const textField = create.description.find((property) => property.name === 'text');
			const jsonField = create.description.find((property) => property.name === 'jsonBody');
			const botUniqueNameField = create.description.find(
				(property) => property.name === 'botUniqueName',
			);
			const botDisplayNameField = create.description.find(
				(property) => property.name === 'botDisplayName',
			);
			const botImageField = create.description.find((property) => property.name === 'botImage');
			const markdownNotice = create.description.find(
				(property) => property.name === 'plainTextMarkdownNotice',
			);

			expect(textField?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['create'],
			});

			expect(textField).not.toHaveProperty('displayOptions.show.messageType');

			expect(jsonField?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['create'],
			});

			expect(jsonField).not.toHaveProperty('displayOptions.show.messageType');

			expect(botUniqueNameField?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['create'],
			});
			expect(botUniqueNameField).not.toHaveProperty('displayOptions.show.postAsBot');
			expect(botDisplayNameField).toBeUndefined();
			expect(botImageField).toBeUndefined();

			expect(markdownNotice?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['create'],
				messageType: ['text'],
			});
		});

		it('should keep docs notices and AI guide notice at the bottom', () => {
			const names = create.description.map((property) => property.name);

			expect(names.slice(-5)).toEqual([
				'createThreadChannelDocsNotice',
				'createThreadChannelUniqueNameDocsNotice',
				'createThreadChatDocsNotice',
				'createThreadAgentChoiceDocsNotice',
				'createThreadAiToolGuideNotice',
			]);
		});
	});
});
