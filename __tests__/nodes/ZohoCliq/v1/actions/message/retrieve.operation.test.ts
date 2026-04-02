/**
 * Tests for Retrieve Message operation
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import * as retrieve from '../../../../../../nodes/ZohoCliq/v1/actions/message/retrieve.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('Message - Retrieve Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const setMessageTargetParameters = (chatId: string, messageId: string): void => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _itemIndex?: number, fallback?: unknown) => {
				if (paramName === 'chatId') return chatId;
				if (paramName === 'messageId') return messageId;
				if (paramName === 'enableAiErrorMode') return false;
				return fallback;
			},
		);
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		jest.clearAllMocks();
	});

	describe('Success Cases', () => {
		it('should retrieve a message successfully', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = '1234567890_abcdef123456';
			const mockResponse = {
				message_id: messageId,
				text: 'Test message',
				from: { user_id: 'U123', name: 'Test User' },
				timestamp: 1234567890,
			};

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			const result = await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId}`,
			);
		});

		it('should handle URL encoding for special characters in chatId', async () => {
			const chatId = 'CT_123-456_789';
			const messageId = '1234567890_abc';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId}`,
			);
		});

		it('should handle URL encoding for special characters in messageId', async () => {
			const chatId = 'CT_123456';
			const messageId = '1234567890_abc-def_123';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId}`,
			);
		});

		it('should trim whitespace from chatId', async () => {
			const chatId = '  CT_1234567890  ';
			const messageId = '1234567890_abc';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/${encodeURIComponent(chatId.trim())}/messages/${messageId}`,
			);
		});

		it('should trim whitespace from messageId', async () => {
			const chatId = 'CT_1234567890';
			const messageId = '  1234567890_abc  ';
			const mockResponse = { message_id: messageId.trim() };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId.trim()}`,
			);
		});

		it('should keep pre-escaped message IDs intact', async () => {
			const chatId = 'CT_1234567890';
			const messageId = '1709038327612%20712605914940';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId}`,
			);
		});

		it('should process multiple items', async () => {
			const chatId1 = 'CT_111';
			const messageId1 = '111_abc';
			const chatId2 = 'CT_222';
			const messageId2 = '222_def';

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex?: number, fallback?: unknown) => {
					if (paramName === 'chatId') return itemIndex === 0 ? chatId1 : chatId2;
					if (paramName === 'messageId') return itemIndex === 0 ? messageId1 : messageId2;
					if (paramName === 'enableAiErrorMode') return false;
					return fallback;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({ message_id: messageId1 })
				.mockResolvedValueOnce({ message_id: messageId2 });

			const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			const result = await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(2);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		});

		it('should use constructExecutionMetaData with correct itemIndex', async () => {
			const chatId = 'CT_1234567890';
			const messageId = '1234567890_abc';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const mockConstructExecutionMetaData = jest.fn((data) => data);
			mockExecuteFunctions.helpers.constructExecutionMetaData = mockConstructExecutionMetaData;

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockConstructExecutionMetaData).toHaveBeenCalledWith([{ json: mockResponse }], {
				itemData: { item: 0 },
			});
		});
	});

	describe('OAuth Scope Validation', () => {
		it('should throw NodeOperationError for missing OAuth scope', async () => {
			const chatId = 'CT_1234567890';
			const messageId = '1234567890_abc';
			const expectedScope = SCOPES.MESSAGES_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'retrieve';
					if (paramName === 'chatId') return chatId;
					if (paramName === 'messageId') return messageId;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = ''; // No scopes

			let thrownError: unknown;
			try {
				await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toContain('Missing OAuth scope for');
			expect(
				(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
			).toEqual({
				success: false,
				resource: 'message',
				operation: 'retrieve',
				requiredScopes: [expectedScope],
				missingScopes: [expectedScope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should accept ZohoCliq.Messages.READ scope', async () => {
			const chatId = 'CT_1234567890';
			const messageId = '1234567890_abc';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});

		it('should accept ZohoCliq.Messages.ALL scope', async () => {
			const chatId = 'CT_1234567890';
			const messageId = '1234567890_abc';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_ALL;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Chat ID Validation', () => {
		it('should throw NodeOperationError for empty chatId', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '';
					if (paramName === 'messageId') return '1234567890_abc';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is required');
		});

		it('should throw NodeOperationError for whitespace-only chatId', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '   ';
					if (paramName === 'messageId') return '1234567890_abc';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is required');
		});

		it('should throw NodeOperationError for invalid chatId format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'invalid@chat#id';
					if (paramName === 'messageId') return '1234567890_abc';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid Chat ID format');
		});

		it('should throw NodeOperationError for chatId exceeding max length', async () => {
			const longChatId = 'a'.repeat(201);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return longChatId;
					if (paramName === 'messageId') return '1234567890_abc';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is too long');
		});

		it('should accept valid chatId with hyphens and underscores', async () => {
			const chatId = 'CT_1234-5678_90';
			const messageId = '1234567890_abc';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Message ID Validation', () => {
		it('should throw NodeOperationError for empty messageId', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890';
					if (paramName === 'messageId') return '';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Message ID is required');
		});

		it('should throw NodeOperationError for whitespace-only messageId', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890';
					if (paramName === 'messageId') return '   ';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Message ID is required');
		});

		it('should throw NodeOperationError for messageId exceeding max length', async () => {
			const longMessageId = 'a'.repeat(201);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890';
					if (paramName === 'messageId') return longMessageId;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Message ID is too long');
		});

		it('should accept valid messageId with various characters', async () => {
			const chatId = 'CT_1234567890';
			const messageId = '1234567890_abc-def_123';
			const mockResponse = { message_id: messageId };

			setMessageTargetParameters(chatId, messageId);

			mockZohoCliqApiRequest.mockResolvedValueOnce(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			await expect(
				retrieve.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Property Descriptions', () => {
		it('should export description array', () => {
			expect(retrieve.description).toBeDefined();
			expect(Array.isArray(retrieve.description)).toBe(true);
		});

		it('should have correct displayOptions for all properties', () => {
			retrieve.description.forEach((prop) => {
				expect(prop.displayOptions).toBeDefined();
				expect(prop.displayOptions?.show).toEqual({
					resource: ['message'],
					operation: ['retrieve'],
				});
			});
		});

		it('should have chatId parameter', () => {
			const chatIdParam = retrieve.description.find((p) => p.name === 'chatId');
			expect(chatIdParam).toBeDefined();
			expect(chatIdParam?.type).toBe('string');
			expect(chatIdParam?.required).toBe(true);
		});

		it('should define chatId only once in description', () => {
			const chatIdFields = retrieve.description.filter((p) => p.name === 'chatId');
			expect(chatIdFields).toHaveLength(1);
		});

		it('should have messageId parameter', () => {
			const messageIdParam = retrieve.description.find((p) => p.name === 'messageId');
			expect(messageIdParam).toBeDefined();
			expect(messageIdParam?.type).toBe('string');
			expect(messageIdParam?.required).toBe(true);
		});
	});

	describe('Recoverable Errors', () => {
		it('should return MESSAGE_NOT_FOUND guidance when recoverable retrieve revalidation confirms the message is missing', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890';
					if (paramName === 'messageId') return '1234567890_abc';
					return undefined;
				},
			);

			mockZohoCliqApiRequest.mockRejectedValue({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			const result = await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'message',
						operation: 'retrieve',
						chat_id: 'CT_1234567890',
						message_id: '1234567890_abc',
						reason: 'MESSAGE_NOT_FOUND',
						hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
						message: expect.stringContaining(
							'Unable to find Message ID "1234567890_abc" in Chat ID "CT_1234567890"',
						),
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/chats/CT_1234567890/messages/1234567890_abc',
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/chats/CT_1234567890/messages/1234567890_abc',
			);
		});

		it('should return CHAT_NOT_FOUND guidance when the chat identifier is rejected for this endpoint', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_missing_chat';
					if (paramName === 'messageId') return '1234567890_abc';
					return undefined;
				},
			);

			mockZohoCliqApiRequest
				.mockRejectedValueOnce({
					message: 'Request URL is invalid',
					response: { statusCode: 404 },
				})
				.mockRejectedValueOnce({
					message: 'Request URL is invalid',
					response: { statusCode: 404 },
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_READ},${SCOPES.CHATS_READ}`;

			const result = await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/chats/CT_missing_chat/messages/1234567890_abc',
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/chats/CT_missing_chat/members',
				{},
				{},
			);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'retrieve',
					chat_id: 'CT_missing_chat',
					message_id: '1234567890_abc',
					reason: 'CHAT_NOT_FOUND',
				}),
			);
		});

		it('should return INVALID_CHAT_ID guidance in continueOnFail mode when chat validation fails locally', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'invalid@chat#id';
					if (paramName === 'messageId') return '1234567890_abc';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			const result = await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'message',
						operation: 'retrieve',
						reason: 'INVALID_CHAT_ID',
						hint: 'Use the chat ID that contains the message you want to retrieve.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return INVALID_MESSAGE_ID guidance in continueOnFail mode when message validation fails locally', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890';
					if (paramName === 'messageId') return '';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			const result = await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'message',
						operation: 'retrieve',
						reason: 'INVALID_MESSAGE_ID',
						hint: 'Use the exact Zoho Cliq message ID returned by Get Messages.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return INVALID_MESSAGE_ID guidance in continueOnFail mode when message ID is too long', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890';
					if (paramName === 'messageId') return 'M'.repeat(201);
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_READ;

			const result = await retrieve.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'message',
						operation: 'retrieve',
						reason: 'INVALID_MESSAGE_ID',
						hint: 'Use the exact Zoho Cliq message ID returned by Get Messages.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});
	});
});
