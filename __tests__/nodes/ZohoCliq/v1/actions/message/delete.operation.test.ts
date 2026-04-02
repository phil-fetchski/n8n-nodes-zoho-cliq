/**
 * Tests for Message Delete Operation
 * Verifies delete message functionality with OAuth scopes and input validation
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import * as deleteOperation from '../../../../../../nodes/ZohoCliq/v1/actions/message/delete.operation';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('Message - Delete Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const deleteWithPreflightScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

	function mockDeletePreflightSuccess(messageId: string, deleteResponse: IDataObject): void {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				message_id: messageId,
			})
			.mockResolvedValueOnce(deleteResponse);
	}

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

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('Success Cases', () => {
		it('should delete message with valid parameters', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = 'MSG_1234567890';
			const mockResponse = { success: true };

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId) // chatId
				.mockReturnValueOnce(messageId); // messageId

			mockDeletePreflightSuccess(messageId, mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({
				deleted: true,
				success: true,
				resource: 'message',
				operation: 'delete',
				chat_id: chatId,
				message_id: messageId,
			});
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'DELETE',
				'/api/v2/chats/CT_1234567890_1234567890/messages/MSG_1234567890',
			);
		});

		it('should handle multiple items', async () => {
			const chatIds = ['CT_111', 'CT_222'];
			const messageIds = ['MSG_111', 'MSG_222'];
			const mockResponse1 = { deleted: false, success: true, message_id: 'MSG_111' };
			const mockResponse2 = { deleted: false, success: true, message_id: 'MSG_222' };

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					if (paramName === 'chatId') return chatIds[itemIndex];
					if (paramName === 'messageId') return messageIds[itemIndex];
					if (paramName === 'outputEnhancedResponse') return false;
					return undefined;
				},
			);

			mockDeletePreflightSuccess(messageIds[0], mockResponse1);
			mockDeletePreflightSuccess(messageIds[1], mockResponse2);

			const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(2);
			expect(result[0].json).toEqual({ ...mockResponse1, deleted: true });
			expect(result[1].json).toEqual({ ...mockResponse2, deleted: true });
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(4);
		});

		it('should URL encode chat ID and message ID', async () => {
			const chatId = 'CT_special-chars_123';
			const messageId = 'MSG_special-chars_456';
			const mockResponse = { success: true };

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId)
				.mockReturnValueOnce(messageId);

			mockDeletePreflightSuccess(messageId, mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'DELETE',
				'/api/v2/chats/CT_special-chars_123/messages/MSG_special-chars_456',
			);
		});

		it('should keep pre-escaped message IDs intact', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = '1709038327612%20712605914940';
			const mockResponse = { success: true };

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId)
				.mockReturnValueOnce(messageId);

			mockDeletePreflightSuccess(messageId, mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'DELETE',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId}`,
			);
		});

		it('should trim whitespace from IDs', async () => {
			const chatId = '  CT_1234567890_1234567890  ';
			const messageId = '  MSG_1234567890  ';
			const mockResponse = { success: true };

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId)
				.mockReturnValueOnce(messageId);

			mockDeletePreflightSuccess('MSG_1234567890', mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'DELETE',
				'/api/v2/chats/CT_1234567890_1234567890/messages/MSG_1234567890',
			);
		});

		it('should return enhanced response when outputEnhancedResponse is enabled', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = 'MSG_1234567890';

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId)
				.mockReturnValueOnce(messageId)
				.mockReturnValueOnce(true);

			mockDeletePreflightSuccess(messageId, {});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual({
				deleted: true,
				success: true,
				resource: 'message',
				operation: 'delete',
				chat_id: chatId,
				message_id: messageId,
			});
		});

		it('should preflight message retrieval before deleting when read scopes are available', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = 'MSG_1234567890';

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex: number, fallback?: unknown) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'messageId') return messageId;
					if (paramName === 'outputEnhancedResponse') return fallback;
					return fallback;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: messageId,
				})
				.mockResolvedValueOnce({
					success: true,
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual({
				deleted: true,
				success: true,
				resource: 'message',
				operation: 'delete',
				chat_id: chatId,
				message_id: messageId,
			});
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId}`,
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'DELETE',
				`/api/v2/chats/${encodeURIComponent(chatId)}/messages/${messageId}`,
			);
		});

		it('should treat null outputEnhancedResponse as the enhanced-output default', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = 'MSG_1234567890';
			const mockResponse = { success: true };

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId)
				.mockReturnValueOnce(messageId)
				.mockReturnValueOnce(null);

			mockDeletePreflightSuccess(messageId, mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);
			expect(result[0].json).toEqual({
				deleted: true,
				success: true,
				resource: 'message',
				operation: 'delete',
				chat_id: chatId,
				message_id: messageId,
			});
		});
	});

	describe('Parameter Validation', () => {
		it('should throw when outputEnhancedResponse is not boolean', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					if (paramName === 'outputEnhancedResponse') return 'true';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			mockDeletePreflightSuccess('MSG_1234567890', {});

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid outputEnhancedResponse value: must be a boolean');
		});
	});

	describe('OAuth Scope Validation', () => {
		it('should throw error when ZohoCliq.Messages.DELETE scope is missing', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = 'MSG_1234567890';
			const expectedScope = SCOPES.MESSAGES_DELETE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'delete';
					if (paramName === 'chatId') return chatId;
					if (paramName === 'messageId') return messageId;
					if (paramName === 'outputEnhancedResponse') return false;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHANNELS_READ; // Wrong scope

			let thrownError: unknown;
			try {
				await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);
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
				operation: 'delete',
				requiredScopes: [expectedScope],
				missingScopes: [expectedScope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should accept ZohoCliq.Messages.DELETE scope when the delete preflight read scopes are also granted', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = 'MSG_1234567890';
			const mockResponse = { success: true };

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId)
				.mockReturnValueOnce(messageId);

			mockDeletePreflightSuccess(messageId, mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});

		it('should accept ZohoCliq.Messages.ALL scope when the delete preflight read scopes are also granted', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const messageId = 'MSG_1234567890';
			const mockResponse = { success: true };

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce(chatId)
				.mockReturnValueOnce(messageId);

			mockDeletePreflightSuccess(messageId, mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_ALL;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Chat ID Validation', () => {
		it('should throw error for empty chat ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '';
					if (paramName === 'messageId') return 'MSG_123';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is required');
		});

		it('should throw error for whitespace-only chat ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '   ';
					if (paramName === 'messageId') return 'MSG_123';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is required');
		});

		it('should throw error for invalid chat ID format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'invalid@chat#id';
					if (paramName === 'messageId') return 'MSG_123';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid Chat ID format');
		});

		it('should throw error for chat ID exceeding max length', async () => {
			const longChatId = 'C'.repeat(201);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return longChatId;
					if (paramName === 'messageId') return 'MSG_123';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is too long');
		});
	});

	describe('Message ID Validation', () => {
		it('should throw error for empty message ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123';
					if (paramName === 'messageId') return '';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Message ID is required');
		});

		it('should throw error for whitespace-only message ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123';
					if (paramName === 'messageId') return '   ';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Message ID is required');
		});

		it('should throw error for invalid message ID format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123';
					if (paramName === 'messageId') return 'invalid@msg#id';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid Message ID format');
		});

		it('should throw error for message ID exceeding max length', async () => {
			const longMessageId = 'M'.repeat(201);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123';
					if (paramName === 'messageId') return longMessageId;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Message ID is too long');
		});
	});

	describe('Property Descriptions', () => {
		it('should export description array', () => {
			expect(deleteOperation.description).toBeDefined();
			expect(Array.isArray(deleteOperation.description)).toBe(true);
		});

		it('should have correct displayOptions for all properties', () => {
			deleteOperation.description.forEach((prop) => {
				expect(prop.displayOptions).toBeDefined();
				expect(prop.displayOptions?.show).toEqual({
					resource: ['message'],
					operation: ['delete'],
				});
			});
		});

		it('should have chatId as required field', () => {
			const chatIdProp = deleteOperation.description.find((prop) => prop.name === 'chatId');
			expect(chatIdProp).toBeDefined();
			expect(chatIdProp?.required).toBe(true);
		});

		it('should have messageId as required field', () => {
			const messageIdProp = deleteOperation.description.find((prop) => prop.name === 'messageId');
			expect(messageIdProp).toBeDefined();
			expect(messageIdProp?.required).toBe(true);
		});

		it('should have outputEnhancedResponse as top-level boolean field', () => {
			const outputEnhancedResponseProp = deleteOperation.description.find(
				(prop) => prop.name === 'outputEnhancedResponse',
			);
			expect(outputEnhancedResponseProp).toBeDefined();
			expect(outputEnhancedResponseProp?.type).toBe('boolean');
		});

		it('should advertise both delete and message-read scopes in the docs notice', () => {
			const docsNotice = deleteOperation.description.find(
				(prop) => prop.name === 'deleteMessageDocsNotice',
			);

			expect(docsNotice?.displayName).toContain('ZohoCliq.Messages.DELETE');
			expect(docsNotice?.displayName).toContain('ZohoCliq.Messages.READ');
		});
	});

	describe('Recoverable Errors', () => {
		it('should fail before delete when message-read scope is missing', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_missing';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(
				'Delete Message requires message-read access so the node can verify the supplied Message ID before attempting deletion.',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return delete-window guidance when Zoho Cliq rejects deletion permissions in continueOnFail mode', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					return undefined;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: 'MSG_1234567890',
				})
				.mockRejectedValueOnce({
					message: 'organisation admin has disabled your permission to delete messages',
					response: { statusCode: 400 },
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					reason: 'DELETE_NOT_ALLOWED',
					hint: expect.stringContaining('account-configured delete window'),
				}),
			);
		});

		it('should return MESSAGE_LOOKUP_SCOPE_REQUIRED when continueOnFail is enabled and message-read scope is missing', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.MESSAGES_DELETE;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					reason: 'MESSAGE_LOOKUP_SCOPE_REQUIRED',
					chat_id: 'CT_1234567890_1234567890',
					message_id: 'MSG_1234567890',
				}),
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return shared MESSAGE_NOT_FOUND guidance when recoverable delete revalidation confirms the message is missing', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					return undefined;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: 'MSG_1234567890',
				})
				.mockRejectedValueOnce({
					message: 'Request URL is invalid',
					statusCode: 404,
				})
				.mockRejectedValueOnce({
					message: 'Request URL is invalid',
					statusCode: 404,
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					reason: 'MESSAGE_NOT_FOUND',
					hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
				}),
			);
		});

		it('should preserve the raw invalid-endpoint error outside recoverable mode when delete revalidation is inactive', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					return undefined;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: 'MSG_1234567890',
				})
				.mockRejectedValueOnce('Request URL is invalid')
				.mockRejectedValueOnce('Request URL is invalid');

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toEqual('Request URL is invalid');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		});

		it('should preserve the original response payload on raw delete-endpoint errors outside recoverable mode', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					return undefined;
				},
			);

			const apiError = {
				message: 'Request URL is invalid',
				response: {
					statusCode: 404,
					body: { code: 'invalid_endpoint' },
				},
			};

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: 'MSG_1234567890',
				})
				.mockRejectedValueOnce(apiError)
				.mockRejectedValueOnce(apiError);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toMatchObject({
				message: 'Request URL is invalid',
				response: apiError.response,
			});
		});

		it('should throw when the message preflight scope registry entry is missing', async () => {
			const originalListAcceptedScopesForConditionalRequirement =
				scopeRegistry.listAcceptedScopesForConditionalRequirement;
			jest
				.spyOn(scopeRegistry, 'listAcceptedScopesForConditionalRequirement')
				.mockImplementation((resource, operation, conditionId) => {
					if (
						resource === 'message' &&
						operation === 'delete' &&
						conditionId === 'messageLookupPreflight'
					) {
						return undefined;
					}

					return originalListAcceptedScopesForConditionalRequirement(
						resource,
						operation,
						conditionId,
					);
				});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = deleteWithPreflightScopes;

			await expect(
				deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(
				'Message.delete messageLookupPreflight scope registry entry is missing or empty.',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return MESSAGE_NOT_FOUND when Zoho Cliq reports no message found by ID', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_missing';
					return undefined;
				},
			);

			mockZohoCliqApiRequest.mockRejectedValueOnce({
				message: 'No message found for message id',
				response: { statusCode: 404 },
			});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					reason: 'MESSAGE_NOT_FOUND',
					chat_id: 'CT_1234567890_1234567890',
					message_id: 'MSG_missing',
				}),
			);
		});

		it('should return MESSAGE_NOT_FOUND when retrieve preflight cannot find the message for the supplied chat/message pair', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_missing';
					return undefined;
				},
			);

			mockZohoCliqApiRequest.mockRejectedValueOnce({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'delete',
					chat_id: 'CT_1234567890_1234567890',
					message_id: 'MSG_missing',
					reason: 'MESSAGE_NOT_FOUND',
					hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
					message: expect.stringContaining(
						'Unable to find Message ID "MSG_missing" in Chat ID "CT_1234567890_1234567890".',
					),
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		});

		it('should return MESSAGE_NOT_FOUND when a coded NodeOperationError reaches the recoverable matcher', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_missing';
					return undefined;
				},
			);

			const codedError = new NodeOperationError(
				mockExecuteFunctions.getNode(),
				'Original coded missing-message error',
			);
			(codedError as NodeOperationError & { code?: string }).code = 'MESSAGE_NOT_FOUND';

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: 'MSG_missing',
				})
				.mockRejectedValueOnce(codedError)
				.mockRejectedValueOnce({
					message: 'Request URL is invalid',
					response: { statusCode: 404 },
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'delete',
					chat_id: 'CT_1234567890_1234567890',
					message_id: 'MSG_missing',
					reason: 'MESSAGE_NOT_FOUND',
					hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
					message: 'Original coded missing-message error',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		});

		it('should fall back to a generic recoverable payload when a different NodeOperationError code carries not-found text without shared proof', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_missing';
					return undefined;
				},
			);

			const codedError = new NodeOperationError(
				mockExecuteFunctions.getNode(),
				'No message found for message id',
			);
			(codedError as NodeOperationError & { code?: string }).code = 'SOME_OTHER_ERROR';

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: 'MSG_missing',
				})
				.mockRejectedValueOnce(codedError)
				.mockResolvedValueOnce({
					message_id: 'MSG_missing',
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'delete',
					chat_id: 'CT_1234567890_1234567890',
					message_id: 'MSG_missing',
					reason: 'SOME_OTHER_ERROR',
					message: 'No message found for message id',
				}),
			);
			expect(result[0].json).not.toHaveProperty('reason', 'MESSAGE_NOT_FOUND');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(3);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				3,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages/MSG_missing',
			);
		});

		it('should fall back to a generic recoverable payload when a different NodeOperationError code has neutral text', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'messageId') return 'MSG_1234567890';
					return undefined;
				},
			);

			const codedError = new NodeOperationError(
				mockExecuteFunctions.getNode(),
				'Delete validation failed for an unrelated reason',
			);
			(codedError as NodeOperationError & { code?: string }).code = 'SOME_OTHER_ERROR';

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					message_id: 'MSG_1234567890',
				})
				.mockRejectedValueOnce(codedError);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_DELETE},${SCOPES.MESSAGES_READ}`;

			const result = await deleteOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'delete',
					chat_id: 'CT_1234567890_1234567890',
					message_id: 'MSG_1234567890',
					reason: 'SOME_OTHER_ERROR',
					message: 'Delete validation failed for an unrelated reason',
				}),
			);
			expect(result[0].json).not.toHaveProperty('reason', 'MESSAGE_NOT_FOUND');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		});
	});
});
