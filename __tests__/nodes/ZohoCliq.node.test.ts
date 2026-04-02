import type { IExecuteFunctions, IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ZohoCliqV1 } from '../../nodes/ZohoCliq/v1/ZohoCliqV1.node';
import * as transportModule from '../../nodes/ZohoCliq/v1/transport';

// Mock the transport module
jest.mock('../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq Node', () => {
	let nodeInstance: ZohoCliqV1;
	let mockExecuteFunctions: IExecuteFunctions;
	let mockZohoCliqApiRequest: jest.Mock;

	const createGetNodeParameterMock = (params: IDataObject) => {
		return (
			paramName: string,
			_itemIndex?: number,
			defaultValue?: unknown,
			options?: { extractValue?: boolean },
		) => {
			if (paramName === 'channelId' && params.channelId !== undefined) {
				return options?.extractValue
					? params.channelId
					: { mode: 'id', value: params.channelId as string };
			}
			return params[paramName] ?? defaultValue;
		};
	};

	beforeEach(() => {
		nodeInstance = new ZohoCliqV1();

		mockZohoCliqApiRequest = jest.fn();
		(transportModule.zohoCliqApiRequest as jest.Mock) = mockZohoCliqApiRequest;

		mockExecuteFunctions = {
			getNode: jest.fn(() => ({
				name: 'Zoho Cliq',
				type: 'n8n-nodes-zoho-cliq.zohoCliq',
				typeVersion: 1,
				position: [0, 0],
				parameters: {},
			})),
			getNodeParameter: jest.fn(),
			getInputData: jest.fn(() => [{ json: { test: 'data' } }]),
			getCredentials: jest.fn(async () => ({
				dc: 'us',
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret',
				scope:
					'ZohoCliq.Channels.CREATE,ZohoCliq.Bots.CREATE,ZohoCliq.Chats.CREATE,ZohoCliq.Messages.CREATE',
				oauthTokenData: {
					access_token: 'test-access-token',
					scope:
						'ZohoCliq.Channels.CREATE,ZohoCliq.Bots.CREATE,ZohoCliq.Chats.CREATE,ZohoCliq.Messages.CREATE',
				},
			})),
			continueOnFail: jest.fn(() => false),
			helpers: {
				httpRequestWithAuthentication: jest.fn().mockResolvedValue({
					status: 'success',
					message_id: '12345',
				}),
				constructExecutionMetaData: jest.fn((data, options) =>
					data.map((item: IDataObject) => ({
						...item,
						pairedItem:
							options?.itemData?.item !== undefined ? { item: options.itemData.item } : undefined,
					})),
				),
			},
		} as unknown as IExecuteFunctions;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Node Description', () => {
		it('should have correct display name', () => {
			expect(nodeInstance.description.displayName).toBe('Zoho Cliq');
		});

		it('should have correct node name', () => {
			expect(nodeInstance.description.name).toBe('zohoCliq');
		});

		it('should have version 1', () => {
			expect(nodeInstance.description.version).toBe(1);
		});

		it('should have operation property with post', () => {
			const operationProperty = nodeInstance.description.properties.find(
				(p: { name: string }) => p.name === 'operation',
			);
			expect(operationProperty).toBeDefined();
			expect(operationProperty?.type).toBe('options');
			const options = operationProperty?.options as Array<{ value: string }>;
			expect(options.map((o) => o.value)).toContain('post');
		});

		it('should have target property with message targets', () => {
			const targetProperty = nodeInstance.description.properties.find(
				(p: { name: string }) => p.name === 'target',
			);
			expect(targetProperty).toBeDefined();
			expect(targetProperty?.type).toBe('options');
			const options = targetProperty?.options as Array<{ value: string }>;
			expect(options.map((o) => o.value)).toEqual([
				'agentChoice',
				'bot',
				'channel',
				'chat',
				'thread',
				'user',
			]);
		});

		it('should have credentials configuration', () => {
			expect(nodeInstance.description.credentials).toHaveLength(1);
			expect(nodeInstance.description.credentials?.[0].name).toBe('zohoCliqOAuth2Api');
			expect(nodeInstance.description.credentials?.[0].required).toBe(true);
		});

		it('should show AI Error Mode globally and expose a dedicated copy for agent card payload builder', () => {
			const aiErrorModeProperties = nodeInstance.description.properties.filter(
				(p: { name: string }) => p.name === 'enableAiErrorMode',
			);

			expect(aiErrorModeProperties).toHaveLength(2);
			expect(aiErrorModeProperties[0]?.displayOptions?.hide?.resource).toEqual([
				'messageComponentBuilder',
			]);
			expect(aiErrorModeProperties[1]?.displayOptions?.show).toMatchObject({
				resource: ['messageComponentBuilder'],
				operation: ['buildAgentCardPayload'],
			});
		});
	});

	describe('Channel Message Sending', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'channel',
					messageType: 'text',
					channelId: 'test-channel',
					text: 'Test message',
					includeEnhancedOutput: false,
					additionalFields: {},
				}),
			);

			mockZohoCliqApiRequest.mockResolvedValue({
				status: 'success',
				message_id: '12345',
			});
		});

		it('should send message to channel successfully', async () => {
			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toEqual({
				status: 'success',
				message_id: '12345',
			});

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{ text: 'Test message' },
			);
		});

		it('should validate channel name is not empty', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'channelId') return '';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Channel ID is required',
			);
		});

		it('should validate channel name format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'channelId') return 'invalid@channel!';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Invalid Channel ID format',
			);
		});

		it('should validate channel name length', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'channelId') return 'a'.repeat(101);
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Invalid Channel ID format',
			);
		});

		it('should trim channel name whitespace', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'channelId') return '  test-channel  ';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await nodeInstance.execute.call(mockExecuteFunctions);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				expect.any(Object),
			);
		});

		it('should check required OAuth scope for channel', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'us',
				scope: 'ZohoCliq.Bots.CREATE',
				oauthTokenData: { access_token: 'test-token', scope: 'ZohoCliq.Bots.CREATE' },
			});

			const execPromise = nodeInstance.execute.call(mockExecuteFunctions);
			await expect(execPromise).rejects.toThrow(NodeOperationError);
			await expect(execPromise).rejects.toThrow('Missing OAuth scope for');
		});
	});

	describe('Bot Message Sending', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'bot',
					messageType: 'text',
					botUniqueName: 'testbot',
					text: 'Hello from bot',
					additionalFields: {},
				}),
			);

			mockZohoCliqApiRequest.mockResolvedValue({
				status: 'success',
				message_id: '67890',
			});
		});

		it('should send message via bot successfully', async () => {
			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toEqual({
				status: 'success',
				message_id: '67890',
			});

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/bots/testbot/message', {
				text: 'Hello from bot',
			});
		});

		it('should validate bot name is not empty', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'botUniqueName') return '';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'bot';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Bot Unique Name is required',
			);
		});

		it('should validate bot name format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'botUniqueName') return 'invalid@bot!';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'bot';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Invalid Bot Unique Name format',
			);
		});

		it('should check required OAuth scope for bot', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'us',
				scope: 'ZohoCliq.Channels.CREATE',
				oauthTokenData: { access_token: 'test-token', scope: 'ZohoCliq.Channels.CREATE' },
			});

			const execPromise = nodeInstance.execute.call(mockExecuteFunctions);
			await expect(execPromise).rejects.toThrow(NodeOperationError);
			await expect(execPromise).rejects.toThrow('Missing OAuth scope for');
		});
	});

	describe('Chat Message Sending', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'chat',
					messageType: 'text',
					chatId: 'CT_2230642524712404875_64396981',
					text: 'Hello user',
					additionalFields: {},
				}),
			);

			mockZohoCliqApiRequest.mockResolvedValue({
				status: 'success',
				message_id: 'abc123',
			});
		});

		it('should send chat message successfully', async () => {
			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toEqual({
				status: 'success',
				message_id: 'abc123',
			});

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{ text: 'Hello user' },
			);
		});

		it('should validate chat ID is not empty', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'chat';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Chat ID is required and cannot be empty',
			);
		});

		it('should validate chat ID format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'invalid!chat';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'chat';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Invalid Chat ID format. Only alphanumeric characters, @, dots, hyphens, and underscores are allowed.',
			);
		});

		it('should reject email format for chat ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'user@example.com';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'chat';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Chat ID must start with a number or "CT_"',
			);
		});

		it('should reject numeric-prefixed malformed chat IDs', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '123@example.com';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'chat';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Chat ID must start with a number or "CT_"',
			);
		});

		it('should check required OAuth scope for chat', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'us',
				scope: 'ZohoCliq.Channels.CREATE',
				oauthTokenData: { access_token: 'test-token', scope: 'ZohoCliq.Channels.CREATE' },
			});

			const execPromise = nodeInstance.execute.call(mockExecuteFunctions);
			await expect(execPromise).rejects.toThrow(NodeOperationError);
			await expect(execPromise).rejects.toThrow('Missing OAuth scope for');
		});
	});

	describe('Message Type Validation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'channel',
					messageType: 'text',
					channelId: 'test-channel',
					text: 'Test message',
					additionalFields: {},
				}),
			);

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		});

		it('should send plain text message', async () => {
			await nodeInstance.execute.call(mockExecuteFunctions);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', expect.any(String), {
				text: 'Test message',
			});
		});

		it('should validate text is a string', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'text') return 12345;
					if (paramName === 'channelId') return 'test';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Invalid text message: must be a string',
			);
		});

		it('should validate text message length', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'text') return 'x'.repeat(5001);
					if (paramName === 'channelId') return 'test';
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Text message is too long',
			);
		});

		it('should send JSON payload message', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'json';
					if (paramName === 'jsonBody') return { text: 'JSON message', card: { title: 'Test' } };
					if (paramName === 'channelId') return 'test';
					if (paramName === 'additionalFields') return {};
					return defaultValue;
				},
			);

			await nodeInstance.execute.call(mockExecuteFunctions);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					text: 'JSON message',
					card: JSON.stringify({ title: 'Test' }),
				}),
			);
		});

		it('should reject non-object JSON body', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'json';
					if (paramName === 'jsonBody') return 'invalid string';
					if (paramName === 'channelId') return 'test';
					if (paramName === 'additionalFields') return {};
					return defaultValue;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'jsonBody must be valid JSON',
			);
		});

		it('should prevent prototype pollution in JSON body', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'json';
					// Use constructor as it's more reliably detected
					if (paramName === 'jsonBody') return { constructor: { admin: true }, text: 'test' };
					if (paramName === 'channelId') return 'test';
					if (paramName === 'additionalFields') return {};
					return defaultValue;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsafe key "constructor" is not allowed in jsonBody',
			);
		});
	});

	describe('Additional Fields', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'chat',
					messageType: 'text',
					chatId: 'CT_2230642524712404875_64396981',
					postToThread: true,
					threadId: 'thread123',
					text: 'Test',
					optionalFields: {},
				}),
			);

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });
		});

		it('should append thread ID to chat ID when posting to thread', async () => {
			await nodeInstance.execute.call(mockExecuteFunctions);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981-thread123/message',
				expect.objectContaining({ text: 'Test' }),
			);
		});

		it('should validate thread_id format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'chat',
					messageType: 'text',
					chatId: 'CT_2230642524712404875_64396981',
					postToThread: true,
					threadId: 'invalid@thread!',
					text: 'test',
					optionalFields: {},
				}),
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Invalid Thread ID format',
			);
		});

		it('should validate thread_id length', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'chat',
					messageType: 'text',
					chatId: 'CT_2230642524712404875_64396981',
					postToThread: true,
					threadId: 'a'.repeat(101),
					text: 'test',
					optionalFields: {},
				}),
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Thread ID is too long',
			);
		});
	});

	describe('Credentials Validation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'channel',
					messageType: 'text',
					channelId: 'test',
					text: 'test',
					additionalFields: {},
				}),
			);
		});

		it('should throw error when credentials not found', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue(null);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'No credentials configured',
			);
		});

		it('should throw error when OAuth token not found', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'us',
				scope: 'ZohoCliq.Channels.CREATE',
				oauthTokenData: {},
			});

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'OAuth token not found',
			);
		});

		it('should fail safely when token scope data is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'us',
				scope: 'InvalidScope',
				oauthTokenData: { access_token: 'test-token' },
			});

			const execPromise = nodeInstance.execute.call(mockExecuteFunctions);
			await expect(execPromise).rejects.toThrow(NodeOperationError);
			await expect(execPromise).rejects.toThrow('OAuth token scope data is missing');
		});

		it('should accept wildcard scope permission', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'us',
				scope: 'invalid_scope',
				oauthTokenData: {
					access_token: 'test-token',
					scope: 'ZohoCliq.Messages.ALL,ZohoCliq.Webhooks.CREATE',
				},
			});

			mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

			await nodeInstance.execute.call(mockExecuteFunctions);

			expect(mockZohoCliqApiRequest).toHaveBeenCalled();
		});
	});

	describe('Batch Processing', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'channel',
					messageType: 'text',
					channelId: 'test-channel',
					text: 'Test message',
					additionalFields: {},
				}),
			);

			mockZohoCliqApiRequest.mockResolvedValue({
				status: 'success',
				message_id: '123',
			});
		});

		it('should process multiple items', async () => {
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue([
				{ json: { item: 1 } },
				{ json: { item: 2 } },
				{ json: { item: 3 } },
			]);

			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(3);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(3);
		});

		it('should include pairedItem information', async () => {
			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			expect(result[0][0]).toHaveProperty('pairedItem');
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				createGetNodeParameterMock({
					resource: 'message',
					operation: 'post',
					target: 'channel',
					messageType: 'text',
					channelId: 'test-channel',
					text: 'Test',
					additionalFields: {},
				}),
			);
		});

		it('should throw error when continueOnFail is false', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
			mockZohoCliqApiRequest.mockRejectedValue(new Error('API Error'));

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow('API Error');
		});

		it('should return sanitized error when continueOnFail is true', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			const apiError = new Error('API Error') as Error & {
				response?: { status: number; data: IDataObject };
			};
			apiError.response = {
				status: 404,
				data: {
					error: 'Channel not found',
					message: 'Not found',
					code: '404',
				},
			};
			mockZohoCliqApiRequest.mockRejectedValue(apiError);

			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('success', false);
			expect(result[0][0].json).toHaveProperty('details');
			const details = (result[0][0].json as IDataObject).details as IDataObject;
			expect(details.statusCode).toBe(404);
		});

		it('should not expose sensitive data in error response', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			const apiError = new Error('API Error') as Error & {
				response?: { status: number; data: IDataObject };
			};
			apiError.response = {
				status: 401,
				data: {
					error: 'Unauthorized',
					access_token: 'secret-token',
				},
			};
			mockZohoCliqApiRequest.mockRejectedValue(apiError);

			const result = await nodeInstance.execute.call(mockExecuteFunctions);

			const details = (result[0][0].json as IDataObject).details as IDataObject;
			expect(details).not.toHaveProperty('access_token');
		});
	});

	describe('Operation Type Validation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'invalidResource';
					if (paramName === 'operation') return 'invalidOperation';
					if (paramName === 'messageType') return 'text';
					return {};
				},
			);
		});

		it('should reject invalid operation type', async () => {
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported resource',
			);
		});
	});

	describe('Target Type Validation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'invalidTarget';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);
		});

		it('should reject invalid target type', async () => {
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Target must be one of: "agentChoice", "channel", "bot", "chat", "thread", "user".',
			);
		});
	});

	describe('Edge Case: Length Validation', () => {
		it('should throw error when bot name exceeds 100 characters', async () => {
			const longBotName = 'a'.repeat(101);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'bot';
					if (paramName === 'botUniqueName') return longBotName;
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Bot Unique Name is too long. Maximum length is 100 characters.',
			);
		});

		it('should throw error when chat ID exceeds 255 characters', async () => {
			const longChatId = 'a'.repeat(256);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'post';
					if (paramName === 'target') return 'chat';
					if (paramName === 'chatId') return longChatId;
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Test';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				NodeOperationError,
			);
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow(
				'Chat ID is too long. Maximum length is 255 characters.',
			);
		});
	});

	describe('Edge Case: Error Response Handling', () => {
		it('should throw error when continueOnFail is false', async () => {
			// Use channel list operation with proper OAuth scope
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'resource') return 'channel';
					if (paramName === 'operation') return 'list';
					if (paramName === 'returnAll') return false;
					if (paramName === 'limit') return 50;
					if (paramName === 'filters') return {};
					if (paramName === 'additionalFields') return {};
					return defaultValue;
				},
			);

			// Set proper OAuth scope for channel list
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'us',
				clientId: 'test-client-id',
				clientSecret: 'test-client-secret',
				scope: 'ZohoCliq.Channels.READ',
				oauthTokenData: {
					access_token: 'test-access-token',
					scope: 'ZohoCliq.Channels.READ',
				},
			});

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);

			// Mock API to throw error
			const apiError = new Error('API Error');
			mockZohoCliqApiRequest.mockRejectedValue(apiError);

			// Should throw when continueOnFail is false
			await expect(nodeInstance.execute.call(mockExecuteFunctions)).rejects.toThrow('API Error');
		});
	});
});
