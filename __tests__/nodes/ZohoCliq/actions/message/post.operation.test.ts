/**
 * Tests for Post Message Operation
 * Verifies message posting to channels, bots, and chats
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/message/post.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';
import * as messagePayload from '../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';
import { ZOHO_CLIQ_PASSTHROUGH_KEYS } from '../../v1/actions/shared/testUtils';

// Mock dependencies
jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('Post Message Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];
	const mockScopes = 'ZohoCliq.Messages.CREATE,ZohoCliq.Users.READ';

	// Helper function to setup parameter mocks
	const setupParameterMock = (params: Record<string, unknown>) => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				paramName: string,
				itemIndex: number,
				defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (paramName === 'channelId' && params.channelId !== undefined) {
					const channelValue = params.channelId;
					if (options?.extractValue) {
						if (
							channelValue &&
							typeof channelValue === 'object' &&
							'value' in (channelValue as Record<string, unknown>)
						) {
							return (channelValue as { value: unknown }).value;
						}
						return channelValue;
					}
					if (typeof channelValue === 'string') {
						return { mode: 'id', value: channelValue };
					}
					return channelValue;
				}

				if (params[paramName] !== undefined) {
					return params[paramName];
				}

				const rich = params.richMessage as Record<string, unknown> | undefined;
				if (rich) {
					if (ZOHO_CLIQ_PASSTHROUGH_KEYS.includes(paramName)) {
						if (paramName === 'richText') {
							return rich.richText ?? rich.text ?? defaultValue;
						}
						return rich[paramName] !== undefined ? rich[paramName] : defaultValue;
					}
				}

				return defaultValue;
			},
		);
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue(mockItems),
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data, meta) =>
					data.map((d: INodeExecutionData) => ({
						...d,
						pairedItem: meta.itemData,
					})),
				),
			},
		} as unknown as IExecuteFunctions;

		// Mock utility functions
		(utils.validateChannelName as jest.Mock).mockImplementation((_, name) =>
			typeof name === 'string' ? name.trim() : name,
		);
		(utils.validateChannelId as jest.Mock).mockImplementation((_, id) =>
			typeof id === 'string' ? id.trim() : id,
		);
		(utils.validateThreadId as jest.Mock).mockImplementation((_, id) =>
			typeof id === 'string' ? id.trim() : id,
		);
		(utils.validateMessageId as jest.Mock).mockImplementation((_, id) =>
			typeof id === 'string' ? id.trim() : id,
		);
		(utils.validateEmail as jest.Mock).mockImplementation((_, email) =>
			typeof email === 'string' ? email.trim() : email,
		);
		(utils.sanitizeJsonBody as jest.Mock).mockImplementation((_, body) => body);
		(utils.checkRequiredScope as jest.Mock).mockImplementation(() => {});
		(utils.isBoolean as unknown as jest.Mock).mockImplementation(
			(value: unknown) => typeof value === 'boolean',
		);

		// Mock API response
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			message_id: 'M123',
			text: 'Test message',
			timestamp: Date.now(),
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Channel Messages', () => {
		it('should post text message to channel', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'channelId') return 'test-channel';
					if (paramName === 'text') return 'Hello World';
					if (paramName === 'optionalFields') return {};
					if (paramName === 'postAsBot') return false;
					if (paramName === 'broadcast') return false;
					return undefined;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{ text: 'Hello World' },
			);
			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('message_id', 'M123');
		});

		it('should validate channel ID in ID mode', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'channelId') return '  test-channel  ';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'optionalFields') return {};
					if (paramName === 'postAsBot') return false;
					if (paramName === 'broadcast') return false;
					return undefined;
				},
			);

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateChannelId).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'  test-channel  ',
				0,
			);
		});

		it('should post to channel by unique name in name mode', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: { mode: 'name', value: 'engineering' },
				text: 'Hello by name',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateChannelName).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'engineering',
				0,
			);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channelsbyname/engineering/message',
				{ text: 'Hello by name' },
			);
		});

		it('should default missing channel locator mode to channel ID path', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: { value: 'C1234567890' },
				text: 'Hello by id',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateChannelId).toHaveBeenCalledWith(mockExecuteFunctions, 'C1234567890', 0);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/C1234567890/message',
				{ text: 'Hello by id' },
			);
		});

		it('should check required scope for channel', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				mockScopes,
				'ZohoCliq.Webhooks.CREATE',
				0,
			);
		});

		it('should URL encode channel id', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test channel/123?&=',
				text: 'Hello',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[1]).toBe(
				`/api/v2/channels/${encodeURIComponent('test channel/123?&=')}/message`,
			);
		});

		it('should default missing booleans and null optionalFields safely', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'target') return 'channel';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'channelId') return 'test-channel';
					if (paramName === 'text') return 'Hello with defaults';
					if (paramName === 'optionalFields') return null;
					if (paramName === 'postAsBot') return undefined;
					if (paramName === 'broadcast') return undefined;
					return defaultValue;
				},
			);

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{ text: 'Hello with defaults' },
			);
		});
	});

	describe('Bot Messages', () => {
		it('should post text message via bot', async () => {
			setupParameterMock({
				target: 'bot',
				messageType: 'text',
				botUniqueName: 'mybot',
				text: 'Bot message',
				optionalFields: {},
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/bots/mybot/message',
				{ text: 'Bot message' },
			);
			expect(result).toHaveLength(1);
		});

		it('should validate bot name format', async () => {
			setupParameterMock({
				target: 'bot',
				messageType: 'text',
				botUniqueName: 'invalid bot!',
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for empty bot name', async () => {
			setupParameterMock({
				target: 'bot',
				messageType: 'text',
				botUniqueName: '  ',
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Bot Unique Name is required',
			);
		});

		it('should check required scope for bot', async () => {
			setupParameterMock({
				target: 'bot',
				messageType: 'text',
				botUniqueName: 'mybot',
				text: 'Hello',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				mockScopes,
				'ZohoCliq.Webhooks.CREATE',
				0,
			);
		});

		it('should throw error for bot name too long', async () => {
			const longBotName = 'a'.repeat(101);
			setupParameterMock({
				target: 'bot',
				messageType: 'text',
				botUniqueName: longBotName,
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Bot Unique Name is too long',
			);
		});
	});

	describe('Chat Messages', () => {
		it('should post text message to chat', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				text: 'Direct message',
				optionalFields: {},
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{ text: 'Direct message' },
			);
			expect(result).toHaveLength(1);
		});

		it('should include bot_unique_name query param when posting to chat as a bot', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				text: 'Direct message',
				postAsBot: true,
				botUniqueName: 'supportbot',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{ text: 'Direct message' },
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should validate chat ID format', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'invalid chat!',
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for empty chat ID', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: '  ',
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Chat ID is required and cannot be empty',
			);
		});

		it('should check required scope for chat', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				text: 'Hello',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				mockScopes,
				'ZohoCliq.Webhooks.CREATE',
				0,
			);
		});

		it('should throw error for chat ID too long', async () => {
			const longChatId = 'a'.repeat(256);
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: longChatId,
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Chat ID is too long',
			);
		});
	});

	describe('Message Types', () => {
		it('should post plain text message', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).toEqual({ text: 'Plain text message' });
		});

		it('should attach slides/buttons payloads to plain text message when enabled', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: [{ type: 'table', data: { headers: ['Name'], rows: [['A']] } }],
				attachedButtons: {
					label: 'Open',
					action: { type: 'open.url', data: { url: 'https://example.com' } },
				},
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{
					text: 'Plain text message',
					slides: [{ type: 'table', data: { headers: ['Name'], rows: [['A']] } }],
					buttons: [
						{
							label: 'Open',
							action: { type: 'open.url', data: { url: 'https://example.com' } },
						},
					],
				},
			);
		});

		it('should fail when attachComponentPayloads is true but both payload inputs are empty', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: '[]',
				attachedButtons: '[]',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Provide at least one slides or buttons payload',
			);
		});

		it('should parse attached slides from JSON string payload', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: '[{"type":"table","data":{"headers":["Name"],"rows":[["A"]]}}]',
				attachedButtons: '[]',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{
					text: 'Plain text message',
					slides: [{ type: 'table', data: { headers: ['Name'], rows: [['A']] } }],
				},
			);
		});

		it('should throw for invalid attached buttons JSON string', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: '[]',
				attachedButtons: '{invalid-json',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'buttons must be valid JSON object/array',
			);
		});

		it('should validate attachComponentPayloads as a boolean', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: 'true',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'attachComponentPayloads must be a boolean',
			);
		});

		it('should treat null attached payload values as empty', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: null,
				attachedButtons: null,
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Provide at least one slides or buttons payload',
			);
		});

		it('should treat blank attached payload strings as empty', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: '   ',
				attachedButtons: '   ',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Provide at least one slides or buttons payload',
			);
		});

		it('should reject non-object entries inside attached slides arrays', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: '[1]',
				attachedButtons: '[]',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'slides[0] must be a JSON object',
			);
		});

		it('should reject primitive attached buttons payloads', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: '[]',
				attachedButtons: '123',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'buttons must be a JSON object or array',
			);
		});

		it('should allow null slides when buttons payload is present', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: null,
				attachedButtons: {
					label: 'Open',
					action: { type: 'open.url', data: { url: 'https://example.com' } },
				},
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{
					text: 'Plain text message',
					buttons: [
						{
							label: 'Open',
							action: { type: 'open.url', data: { url: 'https://example.com' } },
						},
					],
				},
			);
		});

		it('should allow blank buttons string when slides payload is present', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				attachComponentPayloads: true,
				attachedSlides: { type: 'table', data: { headers: ['Name'], rows: [['A']] } },
				attachedButtons: '   ',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{
					text: 'Plain text message',
					slides: [{ type: 'table', data: { headers: ['Name'], rows: [['A']] } }],
				},
			);
		});

		it('should include bot_unique_name query param for text message when postAsBot is enabled', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				postAsBot: true,
				botUniqueName: 'supportbot',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{ text: 'Plain text message' },
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should include optional bot identity in text payload when postAsBot is enabled', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				postAsBot: true,
				botUniqueName: 'supportbot',
				botDisplayName: 'Support Bot',
				botImage: 'https://example.com/support-bot.png',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{
					text: 'Plain text message',
					bot: {
						name: 'Support Bot',
						image: 'https://example.com/support-bot.png',
					},
				},
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should throw when postAsBot is enabled without botUniqueName for text message', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Plain text message',
				postAsBot: true,
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Bot Unique Name is required when Post as Bot is enabled',
			);
		});

		it('should post JSON message', async () => {
			const jsonBody = { text: 'JSON message', card: { title: 'Card' } };
			setupParameterMock({
				target: 'channel',
				messageType: 'json',
				channelId: 'test-channel',
				jsonBody: jsonBody,
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.sanitizeJsonBody).toHaveBeenCalledWith(mockExecuteFunctions, jsonBody, 0);
		});

		it('should include optional bot identity in JSON payload when postAsBot is enabled', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'json',
				channelId: 'test-channel',
				postAsBot: true,
				botUniqueName: 'supportbot',
				botDisplayName: 'Support Bot',
				jsonBody: { text: 'JSON message' },
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{
					text: 'JSON message',
					bot: { name: 'Support Bot' },
				},
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should post structured rich message', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'rich',
				channelId: 'test-channel',
				richMessage: {
					text: 'Rich text',
					cardTitle: 'Card title',
					buttons: {
						button: [
							{
								label: 'Open',
								type: '+',
								actionType: 'open.url',
								actionDataInputMode: 'raw',
								actionData: { url: 'https://example.com' },
							},
						],
					},
				},
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).toMatchObject({
				text: 'Rich text',
				card: JSON.stringify({ title: 'Card title' }),
			});
			expect(callArgs[2]).toHaveProperty('buttons', expect.any(String));
		});

		it('should include bot_unique_name query param when posting rich message as bot', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'rich',
				channelId: 'test-channel',
				richMessage: {
					postAsBot: true,
					botDisplayName: 'Support Bot',
					botUniqueName: 'supportbot',
					text: 'Rich text',
				},
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/test-channel/message',
				{ text: 'Rich text', bot: { name: 'Support Bot' } },
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should reject bot unique name with special characters when postAsBot is enabled', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'rich',
				channelId: 'test-channel',
				richMessage: {
					postAsBot: true,
					botDisplayName: 'Support Bot',
					botUniqueName: 'support-bot',
					text: 'Rich text',
				},
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Bot Unique Name must contain only letters and numbers',
			);
		});

		it('should validate text is string', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 123,
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid text message: must be a string',
			);
		});

		it('should throw error for text exceeding 5000 characters', async () => {
			const longText = 'a'.repeat(5001);
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: longText,
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Text message is too long',
			);
		});

		it('should accept text at 5000 character limit', async () => {
			const maxText = 'a'.repeat(5000);
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: maxText,
				optionalFields: {},
			});

			await expect(
				execute.call(mockExecuteFunctions, mockItems, mockScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Thread Support', () => {
		it('should post message to thread from chat target when postToThread is enabled', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				postToThread: true,
				threadId: 'T123',
				text: 'Thread reply',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateThreadId).toHaveBeenCalledWith(mockExecuteFunctions, 'T123', 0);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981-T123/message',
				{ text: 'Thread reply' },
			);
		});

		it('should post regular chat message when postToThread is disabled', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				postToThread: false,
				text: 'Regular message',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{ text: 'Regular message' },
			);
		});

		it('should default null postToThread to false', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				postToThread: null,
				text: 'Regular message',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{ text: 'Regular message' },
			);
		});

		it('should fallback to chat post when postToThread is true but threadId is empty', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				postToThread: true,
				threadId: '   ',
				text: 'Regular message',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{ text: 'Regular message' },
			);
		});

		it('should post message using dedicated thread target', async () => {
			setupParameterMock({
				target: 'thread',
				messageType: 'text',
				threadChatId: 'CT_123456789',
				threadTargetId: 'T67890',
				text: 'Thread target post',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateThreadId).toHaveBeenCalledWith(mockExecuteFunctions, 'T67890', 0);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123456789-T67890/message',
				{ text: 'Thread target post' },
			);
		});

		it('should include mark_as_read when posting with thread target', async () => {
			setupParameterMock({
				target: 'thread',
				messageType: 'text',
				threadChatId: 'CT_123456789',
				threadTargetId: 'T67890',
				text: 'Thread target post',
				optionalFields: { markAsRead: true },
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123456789-T67890/message',
				{ text: 'Thread target post', mark_as_read: true },
			);
		});

		it('should throw for missing threadChatId in thread target', async () => {
			setupParameterMock({
				target: 'thread',
				messageType: 'text',
				threadChatId: '   ',
				threadTargetId: 'T67890',
				text: 'Thread target post',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Thread Chat ID is required',
			);
		});

		it('should throw for invalid threadChatId format in thread target', async () => {
			setupParameterMock({
				target: 'thread',
				messageType: 'text',
				threadChatId: 'invalid chat!',
				threadTargetId: 'T67890',
				text: 'Thread target post',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid Thread Chat ID format',
			);
		});

		it('should include reply_to when replyTo is provided', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Reply message',
				optionalFields: { replyTo: 'MSG_456' },
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateMessageId).toHaveBeenCalledWith(mockExecuteFunctions, 'MSG_456', 0);
			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).toEqual({ text: 'Reply message', reply_to: 'MSG_456' });
		});

		it('should include sync_message when syncMessage is true', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Sync me',
				optionalFields: { syncMessage: true },
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).toEqual({ text: 'Sync me', sync_message: true });
		});
	});

	describe('Target Validation', () => {
		it('should throw error for invalid target type', async () => {
			setupParameterMock({
				target: 'invalid',
				messageType: 'text',
				channelId: 'test',
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Target must be one of: "agentChoice", "channel", "bot", "chat", "thread", "user".',
			);
		});

		it('should throw when postAsBot is not a boolean', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				postAsBot: 'true',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'postAsBot must be a boolean',
			);
		});

		it('should throw when broadcast is not a boolean', async () => {
			setupParameterMock({
				target: 'bot',
				messageType: 'text',
				botUniqueName: 'testbot',
				text: 'Hello',
				broadcast: 'true',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'broadcast must be a boolean',
			);
		});

		it('should throw when syncMessage is not a boolean', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: { syncMessage: 'true' },
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'syncMessage must be a boolean',
			);
		});

		it('should throw when markAsRead is not a boolean', async () => {
			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: { markAsRead: 'true' },
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'markAsRead must be a boolean',
			);
		});

		it('should throw when postAsBot is true for non-channel targets', async () => {
			setupParameterMock({
				target: 'bot',
				messageType: 'text',
				botUniqueName: 'testbot',
				text: 'Hello',
				postAsBot: true,
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Post as Bot is only supported when Target is Channel',
			);
		});

		it('should throw when postToThread is not a boolean', async () => {
			setupParameterMock({
				target: 'chat',
				messageType: 'text',
				chatId: 'CT_2230642524712404875_64396981',
				postToThread: 'true',
				text: 'Hello',
				optionalFields: {},
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'postToThread must be a boolean',
			);
		});

		it('should only accept valid target types', async () => {
			const validTargets = ['channel', 'bot', 'chat', 'thread', 'user'];

			for (const target of validTargets) {
				jest.clearAllMocks();
				setupParameterMock({
					target: target,
					messageType: 'text',
					channelId: 'test-target',
					botUniqueName: 'testtarget',
					chatId: 'CT_2230642524712404875_64396981',
					threadChatId: 'CT_test_target',
					threadTargetId: 'T_test_target',
					emailOrZuid: target === 'user' ? 'test-user@example.com' : undefined,
					text: 'Hello',
					optionalFields: {},
				});

				await expect(
					execute.call(mockExecuteFunctions, mockItems, mockScopes),
				).resolves.toBeDefined();
			}
		});
	});

	describe('Batch Processing', () => {
		it('should process multiple items', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Message',
				optionalFields: {},
			});

			const result = await execute.call(mockExecuteFunctions, multipleItems, mockScopes);

			expect(result).toHaveLength(3);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledTimes(3);
		});

		describe('Target-Specific Optional Behavior', () => {
			it('should read optional fields from nested field object', async () => {
				setupParameterMock({
					target: 'channel',
					messageType: 'text',
					channelId: 'test-channel',
					text: 'Nested optional fields',
					optionalFields: {
						field: {
							replyTo: 'MSG_789',
							syncMessage: true,
							markAsRead: true,
						},
					},
				});

				await execute.call(mockExecuteFunctions, mockItems, mockScopes);

				expect(utils.validateMessageId).toHaveBeenCalledWith(mockExecuteFunctions, 'MSG_789', 0);
				expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
					'POST',
					'/api/v2/channels/test-channel/message',
					{ text: 'Nested optional fields', reply_to: 'MSG_789', sync_message: true },
					{ mark_as_read: true },
				);
			});

			it('should include mark_as_read in channel query params when enabled', async () => {
				setupParameterMock({
					target: 'channel',
					messageType: 'text',
					channelId: 'test-channel',
					text: 'Hello',
					optionalFields: { markAsRead: true },
				});

				await execute.call(mockExecuteFunctions, mockItems, mockScopes);

				expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
					'POST',
					'/api/v2/channels/test-channel/message',
					{ text: 'Hello' },
					{ mark_as_read: true },
				);
			});

			it('should include broadcast in bot payload when enabled', async () => {
				setupParameterMock({
					target: 'bot',
					messageType: 'text',
					botUniqueName: 'testbot',
					text: 'Hello bot users',
					broadcast: true,
					optionalFields: {},
				});

				await execute.call(mockExecuteFunctions, mockItems, mockScopes);

				expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
					'POST',
					'/api/v2/bots/testbot/message',
					{ text: 'Hello bot users', broadcast: true },
				);
			});

			it('should include validated userids when targeting bot without broadcast', async () => {
				setupParameterMock({
					target: 'bot',
					messageType: 'text',
					botUniqueName: 'testbot',
					text: 'Hello selected users',
					broadcast: false,
					userIds: 'user_1, user-2',
					optionalFields: {},
				});

				await execute.call(mockExecuteFunctions, mockItems, mockScopes);

				expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
					'POST',
					'/api/v2/bots/testbot/message',
					{ text: 'Hello selected users', userids: 'user_1,user-2' },
				);
			});

			it('should throw when userIds are provided but resolve to empty values', async () => {
				setupParameterMock({
					target: 'bot',
					messageType: 'text',
					botUniqueName: 'testbot',
					text: 'Hello',
					broadcast: false,
					userIds: ', ,',
					optionalFields: {},
				});

				await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
					'User IDs must include at least one valid ID when provided',
				);
			});

			it('should throw when userIds contains an invalid entry', async () => {
				setupParameterMock({
					target: 'bot',
					messageType: 'text',
					botUniqueName: 'testbot',
					text: 'Hello',
					broadcast: false,
					userIds: 'valid_user, invalid user',
					optionalFields: {},
				});

				await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
					'Invalid user ID in User IDs list: "invalid user"',
				);
			});

			it('should include mark_as_read in chat payload when enabled', async () => {
				setupParameterMock({
					target: 'chat',
					messageType: 'text',
					chatId: 'CT_2230642524712404875_64396981',
					text: 'Hello chat',
					optionalFields: { markAsRead: true },
				});

				await execute.call(mockExecuteFunctions, mockItems, mockScopes);

				expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
					'POST',
					'/api/v2/chats/CT_2230642524712404875_64396981/message',
					{ text: 'Hello chat', mark_as_read: true },
				);
			});

			it('should post to user target and include mark_as_read when enabled', async () => {
				setupParameterMock({
					target: 'user',
					messageType: 'text',
					emailOrZuid: 'user@example.com',
					text: 'Hello user',
					optionalFields: { markAsRead: true },
				});

				await execute.call(mockExecuteFunctions, mockItems, mockScopes);

				expect(utils.validateEmail).toHaveBeenCalledWith(
					mockExecuteFunctions,
					'user@example.com',
					0,
				);
				expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
					'POST',
					'/api/v2/buddies/user%40example.com/message',
					{ text: 'Hello user', mark_as_read: true },
				);
			});
		});

		it('should construct execution metadata for each item', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Message',
				optionalFields: {},
			});

			await execute.call(mockExecuteFunctions, multipleItems, mockScopes);

			expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenCalledTimes(2);
		});
	});

	describe('API Response Handling', () => {
		it('should return API response in json field', async () => {
			const mockResponse = {
				message_id: 'M456',
				text: 'Test message',
				timestamp: 1234567890,
				user: { id: 'U123', name: 'Test User' },
			};
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				includeEnhancedOutput: false,
				optionalFields: {},
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(mockResponse);
		});

		it('should preserve all response fields', async () => {
			const mockResponse = {
				message_id: 'M789',
				text: 'Test',
				thread_id: 'T123',
				bot_name: 'mybot',
				custom_field: 'value',
			};
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: {},
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toHaveProperty('custom_field', 'value');
		});

		it('should normalize URL-encoded message_id by decoding and restoring separators', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: '1772142435619%202049860549923',
			});

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: { syncMessage: true },
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);
			expect(result[0].json).toHaveProperty('message_id', '1772142435619_2049860549923');
		});

		it('should decode other encoded separators in message_id', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: '1772142435619%2D2049860549923',
			});

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: { syncMessage: true },
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);
			expect(result[0].json).toHaveProperty('message_id', '1772142435619-2049860549923');
		});

		it('should treat plus signs as encoded spaces in message_id normalization', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: '1772142435619+2049860549923',
			});

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: { syncMessage: true },
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);
			expect(result[0].json).toHaveProperty('message_id', '1772142435619_2049860549923');
		});

		it('should preserve malformed percent-encoding in message_id safely', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: '1772142435619%E0%A4%A',
			});

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: { syncMessage: true },
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);
			expect(result[0].json).toHaveProperty('message_id', '1772142435619%E0%A4%A');
		});

		it('should keep response unchanged when message_id is missing', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				status: 'ok',
				custom_field: 'value',
			});

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				includeEnhancedOutput: false,
				optionalFields: { syncMessage: true },
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);
			expect(result[0].json).toEqual({
				status: 'ok',
				custom_field: 'value',
			});
		});
	});

	describe('Agent Choice Targeting', () => {
		const setupAgentChoiceMock = (params: Record<string, unknown>) => {
			setupParameterMock({
				target: 'agentChoice',
				messageType: 'text',
				text: 'Hello from agent choice',
				postAsBot: false,
				optionalFields: {},
				...params,
			});
		};

		it('should route to a channel by ID and omit an empty query object', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'channelId',
				agentChannelId: 'CHAN_123',
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateChannelId).toHaveBeenCalledWith(mockExecuteFunctions, 'CHAN_123', 0);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/CHAN_123/message',
				{ text: 'Hello from agent choice' },
			);
		});

		it('should route to a channel by unique name and include bot sender query params', async () => {
			jest
				.spyOn(messagePayload, 'resolveBotUniqueNameQueryParam')
				.mockReturnValue({ bot_unique_name: 'assistantbot' });

			setupAgentChoiceMock({
				agentSelectedTarget: 'channelUniqueName',
				agentChannelUniqueName: 'engineering-room',
				postAsBot: true,
				botUniqueName: 'assistantbot',
				optionalFields: { markAsRead: true },
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateChannelName).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'engineering-room',
				0,
			);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channelsbyname/engineering-room/message',
				{ text: 'Hello from agent choice' },
				{ bot_unique_name: 'assistantbot', mark_as_read: true },
			);
		});

		it('should allow bot sender metadata when routing to a channel by ID', async () => {
			jest
				.spyOn(messagePayload, 'resolveBotUniqueNameQueryParam')
				.mockReturnValue({ bot_unique_name: 'assistantbot' });

			setupAgentChoiceMock({
				agentSelectedTarget: 'channelId',
				agentChannelId: 'CHAN_456',
				postAsBot: true,
				botUniqueName: 'assistantbot',
				botDisplayName: 'Assistant Bot',
				botImage: 'https://example.com/assistant.png',
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/CHAN_456/message',
				{
					text: 'Hello from agent choice',
					bot: {
						name: 'Assistant Bot',
						image: 'https://example.com/assistant.png',
					},
				},
				{ bot_unique_name: 'assistantbot' },
			);
		});

		it('should require Agent Selected Target when using Agent Choice', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: '   ',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Agent Selected Target is required when Target is set to "Agent\'s Choice".',
			);
		});

		it('should reject unsupported Agent Selected Target values', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'mailingList',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Agent Selected Target must be one of: "channelId", "channelUniqueName", "bot", "chat", "thread", "user".',
			);
		});

		it('should reject extra identifier fields that do not match the selected target family', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'channelId',
				agentChannelId: 'CHAN_123',
				agentChatId: 'CT_998877665544332211_12345678',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'When Agent Selected Target is "channelId", only the matching target identifier field(s) may be provided. Clear "Chat ID".',
			);
		});

		it('should require a channel ID when channelId is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'channelId',
				agentChannelId: '   ',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Channel ID is required when Agent Selected Target is "channelId".',
			);
		});

		it('should require a channel unique name when channelUniqueName is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'channelUniqueName',
				agentChannelUniqueName: '   ',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Channel Unique Name is required when Agent Selected Target is "channelUniqueName".',
			);
		});

		it('should route to a bot conversation when bot is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'bot',
				agentBotUniqueName: 'AssistantBot',
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/bots/AssistantBot/message',
				{ text: 'Hello from agent choice' },
			);
		});

		it('should require a bot unique name when bot is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'bot',
				agentBotUniqueName: undefined,
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Bot Unique Name is required when Agent Selected Target is "bot".',
			);
		});

		it('should reject Post as Bot for unsupported Agent Choice targets', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'bot',
				agentBotUniqueName: 'AssistantBot',
				postAsBot: true,
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Post as Bot is only supported when targeting Channel, Channel (By Unique Name), or Chat.',
			);
		});

		it('should route to a chat and add mark_as_read to the body', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'chat',
				agentChatId: 'CT_2230642524712404875_64396981',
				optionalFields: { markAsRead: true },
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{ text: 'Hello from agent choice', mark_as_read: true },
			);
		});

		it('should allow bot sender metadata for chat routing without forcing mark_as_read', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'chat',
				agentChatId: 'CT_2230642524712404875_64396981',
				postAsBot: true,
				agentBotUniqueName: 'assistantbot',
				botDisplayName: 'Assistant Bot',
				botImage: 'https://example.com/assistant.png',
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_2230642524712404875_64396981/message',
				{
					text: 'Hello from agent choice',
					bot: {
						name: 'Assistant Bot',
						image: 'https://example.com/assistant.png',
					},
				},
				{ bot_unique_name: 'assistantbot' },
			);
		});

		it('should require a chat ID when chat is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'chat',
				agentChatId: '   ',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Chat ID is required when Agent Selected Target is "chat".',
			);
		});

		it('should route to a thread and add mark_as_read to the body', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'thread',
				agentThreadChatId: 'CT_123456789',
				agentThreadId: 'TH_987654321',
				optionalFields: { markAsRead: true },
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateThreadId).toHaveBeenCalledWith(mockExecuteFunctions, 'TH_987654321', 0);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				`/api/v2/chats/${encodeURIComponent('CT_123456789-TH_987654321')}/message`,
				{ text: 'Hello from agent choice', mark_as_read: true },
			);
		});

		it('should omit mark_as_read when routing to a thread and the flag is disabled', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'thread',
				agentThreadChatId: 'CT_123456789',
				agentThreadId: 'TH_987654321',
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				`/api/v2/chats/${encodeURIComponent('CT_123456789-TH_987654321')}/message`,
				{ text: 'Hello from agent choice' },
			);
		});

		it('should require a thread chat ID when thread is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'thread',
				agentThreadChatId: '   ',
				agentThreadId: 'TH_987654321',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Thread Chat ID is required when Agent Selected Target is "thread".',
			);
		});

		it('should require a thread ID when thread is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'thread',
				agentThreadChatId: 'CT_123456789',
				agentThreadId: '   ',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Thread ID is required when Agent Selected Target is "thread".',
			);
		});

		it('should route to a user and add mark_as_read to the body', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'user',
				agentEmailOrZuid: 'alerts+ops@example.com',
				optionalFields: { markAsRead: true },
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateEmail).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'alerts+ops@example.com',
				0,
			);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/buddies/alerts%2Bops%40example.com/message',
				{ text: 'Hello from agent choice', mark_as_read: true },
			);
		});

		it('should omit mark_as_read when routing to a user and the flag is disabled', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'user',
				agentEmailOrZuid: 'alerts+ops@example.com',
			});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/buddies/alerts%2Bops%40example.com/message',
				{ text: 'Hello from agent choice' },
			);
		});

		it('should require an email or ZUID when user is selected', async () => {
			setupAgentChoiceMock({
				agentSelectedTarget: 'user',
				agentEmailOrZuid: '   ',
			});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Email ID / ZUID is required when Agent Selected Target is "user".',
			);
		});
	});

	describe('Recoverable Errors', () => {
		it('should return a mapped recoverable payload for invalid endpoint identifiers when continueOnFail is enabled', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			setupParameterMock({
				target: 'channel',
				messageType: 'text',
				channelId: 'test-channel',
				text: 'Hello',
				optionalFields: {},
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result).toEqual([
				expect.objectContaining({
					json: expect.objectContaining({
						success: false,
						resource: 'message',
						operation: 'post',
						target: 'channel',
						reason: 'NOT_FOUND',
						status_code: 404,
						status_class: '4xx',
						hint: 'Verify path/resource identifiers and confirm the target resource exists.',
						message: 'Request URL is invalid',
					}),
				}),
			]);
		});

		it('should omit target context when target resolution fails before it is set', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, defaultValue?: unknown) => {
					if (paramName === 'target') return undefined;
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'optionalFields') return {};
					if (paramName === 'postAsBot') return false;
					if (paramName === 'broadcast') return false;
					return defaultValue;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'post',
					message: 'Target is required',
				}),
			);
			expect(result[0].json).not.toHaveProperty('target');
			expect(result[0].json).not.toHaveProperty('reason');
		});

		it('should preserve agent choice context in recoverable output', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			setupParameterMock({
				target: 'agentChoice',
				messageType: 'text',
				text: 'Hello from agent choice',
				postAsBot: false,
				optionalFields: {},
				agentSelectedTarget: 'chat',
				agentChatId: 'CT_2230642524712404875_64396981',
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'post',
					target_selection: 'agentChoice',
					agent_selected_target: 'chat',
					target: 'chat',
					target_identifier: 'CT_2230642524712404875_64396981',
					reason: 'NOT_FOUND',
				}),
			);
		});
	});
});
