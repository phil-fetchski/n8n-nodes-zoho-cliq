/**
 * Tests for Message Get Operation
 * Verifies get messages functionality with OAuth scopes and input validation
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { CHAT_NOT_FOUND_HINT } from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as getOperation from '../../../../../../nodes/ZohoCliq/v1/actions/message/get.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('Message - Get Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const messageGetScopes = SCOPES.MESSAGES_READ_WITH_CHAT_LOOKUP;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const setChatAndFilters = (chatId: string, optionalFilters: unknown): void => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _itemIndex?: number, fallback?: unknown) => {
				if (paramName === 'chatId') return chatId;
				if (paramName === 'optionalFilters') return optionalFilters;
				if (paramName === 'simplify') return false;
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
		it('should get messages with minimal parameters', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = {
				messages: [
					{
						message_id: 'M1',
						text: 'Hello',
						timestamp: 1699000000000,
					},
					{
						message_id: 'M2',
						text: 'World',
						timestamp: 1699000001000,
					},
				],
			};

			setChatAndFilters(chatId, {});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				undefined,
			);
		});

		it('should get messages with all parameters', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				fromtime: 1699000000000,
				totime: 1699999999999,
				limit: 50,
			};
			const mockResponse = {
				messages: [
					{
						message_id: 'M1',
						text: 'Test message',
						timestamp: 1699500000000,
					},
				],
			};

			setChatAndFilters(chatId, optionalFilters);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(mockResponse);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: 1699000000000,
					totime: 1699999999999,
					limit: 50,
				},
			);
		});

		it('should get messages with only fromtime', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				fromtime: 1699000000000,
			};
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, optionalFilters);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: 1699000000000,
				},
			);
		});

		it('should get messages with only totime', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				totime: 1699999999999,
			};
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, optionalFilters);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					totime: 1699999999999,
				},
			);
		});

		it('should get messages with only limit', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				limit: 25,
			};
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, optionalFilters);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					limit: 25,
				},
			);
		});

		it('should handle multiple items', async () => {
			const chatIds = ['CT_111', 'CT_222'];
			const mockResponse1 = { messages: [{ message_id: 'M1' }] };
			const mockResponse2 = { messages: [{ message_id: 'M2' }] };

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					if (paramName === 'chatId') return chatIds[itemIndex];
					if (paramName === 'optionalFilters') return {};
					return '';
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce(mockResponse1)
				.mockResolvedValueOnce(mockResponse2);

			const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(2);
			expect(result[0].json).toEqual(mockResponse1);
			expect(result[1].json).toEqual(mockResponse2);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		});

		it('should URL encode chat ID', async () => {
			const chatId = 'CT_special-chars_123';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_special-chars_123/messages',
				undefined,
				undefined,
			);
		});

		it('should read optional filters from nested filter object', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				filter: {
					fromtime: 1699000000000,
					limit: '25',
				},
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: 1699000000000,
					limit: 25,
				},
			);
		});

		it('should parse ISO date-time strings for fromtime and totime', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const fromIso = '2025-01-01T00:00:00Z';
			const toIso = '2025-01-01T01:00:00Z';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				fromtime: fromIso,
				totime: toIso,
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: Date.parse(fromIso),
					totime: Date.parse(toIso),
				},
			);
		});

		it('should parse Date and toMillis timestamp values from optional filters', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const fromDate = new Date('2025-01-01T00:00:00Z');
			const toMillis = Date.parse('2025-01-01T01:00:00Z');
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				fromtime: fromDate,
				totime: { toMillis: () => toMillis },
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: fromDate.getTime(),
					totime: toMillis,
				},
			);
		});

		it('should omit limit when the optional filters object leaves it blank', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				filter: {
					limit: '',
				},
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				undefined,
			);
		});

		it('should parse ts wrapper values from optional filters', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const fromTs = 1735689600000;
			const toTs = '2025-01-01T02:00:00Z';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				fromtime: { ts: fromTs },
				totime: { ts: toTs },
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: fromTs,
					totime: Date.parse(toTs),
				},
			);
		});

		it('should parse timestamp objects that fall back to string coercion', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				fromtime: {
					toString: () => '2025-01-01T00:00:00Z',
				},
				totime: '1735693200000',
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: Date.parse('2025-01-01T00:00:00Z'),
					totime: 1735693200000,
				},
			);
		});

		it('should omit blank string timestamp filters', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				fromtime: '   ',
				totime: '',
				limit: '25',
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					limit: 25,
				},
			);
		});

		it('should omit blank string limits', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {
				limit: '   ',
			});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				undefined,
			);
		});

		it('should treat null optionalFilters as empty filters', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, null);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				undefined,
			);
		});
	});

	describe('OAuth Scope Validation', () => {
		it('should throw error when ZohoCliq.Messages.READ scope is missing', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const expectedScope = SCOPES.MESSAGES_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'message';
					if (paramName === 'operation') return 'get';
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHANNELS_READ; // Wrong scope

			let thrownError: unknown;
			try {
				await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);
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
				operation: 'get',
				requiredScopes: [expectedScope],
				missingScopes: [expectedScope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should accept ZohoCliq.Messages.READ scope', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});

		it('should accept ZohoCliq.Messages.ALL scope', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_ALL},${SCOPES.CHATS_READ}`;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Chat ID Validation', () => {
		it('should throw error for empty chat ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '';
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is required');
		});

		it('should throw error for whitespace-only chat ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '   ';
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is required');
		});

		it('should throw error for invalid chat ID format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'invalid@chat#id';
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid Chat ID format');
		});

		it('should throw error for chat ID exceeding max length', async () => {
			const longChatId = 'C'.repeat(201);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return longChatId;
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Chat ID is too long');
		});

		it('should accept valid chat ID with hyphens and underscores', async () => {
			const chatId = 'CT_1234-5678_90';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});

		it('should trim whitespace from chat ID', async () => {
			const chatId = '  CT_1234567890_1234567890  ';
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, {});

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				undefined,
			);
		});
	});

	describe('Timestamp Validation', () => {
		it('should throw error for negative fromtime', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				fromtime: -1,
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('From Time must be a non-negative timestamp in milliseconds');
		});

		it('should throw error for negative totime', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				totime: -1000,
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('To Time must be a non-negative timestamp in milliseconds');
		});

		it('should throw error for NaN fromtime', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				fromtime: NaN,
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('From Time must be a non-negative timestamp in milliseconds');
		});

		it('should throw error for Infinity totime', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				totime: Infinity,
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('To Time must be a non-negative timestamp in milliseconds');
		});

		it('should throw error for invalid Date objects', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				fromtime: new Date('invalid'),
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('From Time must be a non-negative timestamp in milliseconds');
		});

		it('should accept zero as valid timestamp', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				fromtime: 0,
				totime: 0,
			};
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, optionalFilters);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Limit Validation', () => {
		it('should throw error for limit less than 1', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				limit: 0,
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Limit must be a whole number between 1 and 100');
		});

		it('should throw error for limit greater than 100', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				limit: 101,
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Limit must be a whole number between 1 and 100');
		});

		it('should throw error for non-whole-number limit', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				limit: 50.5,
			};

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return chatId;
					if (paramName === 'optionalFilters') return optionalFilters;
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Limit must be a whole number between 1 and 100');
		});

		it('should accept limit of 1', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				limit: 1,
			};
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, optionalFilters);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});

		it('should accept limit of 100', async () => {
			const chatId = 'CT_1234567890_1234567890';
			const optionalFilters = {
				limit: 100,
			};
			const mockResponse = { messages: [] };

			setChatAndFilters(chatId, optionalFilters);

			mockZohoCliqApiRequest.mockResolvedValue(mockResponse);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			await expect(
				getOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
			).resolves.toBeDefined();
		});
	});

	describe('Property Descriptions', () => {
		it('should export description array', () => {
			expect(getOperation.description).toBeDefined();
			expect(Array.isArray(getOperation.description)).toBe(true);
		});

		it('should have correct displayOptions for all properties', () => {
			getOperation.description.forEach((prop) => {
				expect(prop.displayOptions).toBeDefined();
				expect(prop.displayOptions?.show).toEqual(
					expect.objectContaining({
						resource: ['message'],
						operation: ['get'],
					}),
				);
			});
		});

		it('should have chatId as required field', () => {
			const chatIdProp = getOperation.description.find((prop) => prop.name === 'chatId');
			expect(chatIdProp).toBeDefined();
			expect(chatIdProp?.required).toBe(true);
		});

		it('should include flattened optional params', () => {
			const optionalFilters = getOperation.description.find(
				(prop) => prop.name === 'optionalFilters',
			);
			expect(optionalFilters?.type).toBe('fixedCollection');
			const options = (optionalFilters?.options ?? []) as Array<{
				name?: string;
				values?: unknown[];
			}>;
			const filterGroup = options.find((prop) => prop.name === 'filter');
			const values = (filterGroup?.values ?? []) as Array<{
				name?: string;
				type?: string;
				default?: unknown;
			}>;
			const fromtimeProp = values.find((prop) => prop.name === 'fromtime');
			const totimeProp = values.find((prop) => prop.name === 'totime');
			const limitProp = values.find((prop) => prop.name === 'limit');
			expect(fromtimeProp?.type).toBe('dateTime');
			expect(totimeProp?.type).toBe('dateTime');
			expect(limitProp?.type).toBe('number');
			expect(limitProp?.default).toBe('');
		});
	});

	describe('Recoverable Errors', () => {
		it('should avoid NaN values in recoverable payload context', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'optionalFilters') {
						return {
							limit: 'not-a-number',
						};
					}
					return undefined;
				},
			);

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'get',
					chat_id: 'CT_1234567890_1234567890',
					reason: 'INVALID_LIMIT',
				}),
			);
			expect(result[0].json).not.toHaveProperty('limit');
		});

		it('should return a mapped recoverable payload for invalid endpoint identifiers when continueOnFail is enabled', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'optionalFilters') {
						return {
							fromtime: 1735689600000,
							totime: 1735693200000,
							limit: 10,
						};
					}
					return undefined;
				},
			);

			mockZohoCliqApiRequest.mockRejectedValue({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'message',
						operation: 'get',
						chat_id: 'CT_1234567890_1234567890',
						reason: 'CHAT_NOT_FOUND',
						hint: CHAT_NOT_FOUND_HINT,
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/members',
				{},
				{},
			);
		});

		it('should return CHAT_NOT_FOUND guidance when the chat identifier is rejected for this endpoint', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_missing_chat';
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			mockZohoCliqApiRequest.mockRejectedValueOnce({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.MESSAGES_READ},${SCOPES.CHATS_READ}`;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/chats/CT_missing_chat/members',
				{},
				{},
			);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'get',
					chat_id: 'CT_missing_chat',
					reason: 'CHAT_NOT_FOUND',
					hint: CHAT_NOT_FOUND_HINT,
				}),
			);
		});

		it('should return contextual guidance for generic technical errors in continueOnFail mode', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			mockZohoCliqApiRequest.mockRejectedValue({
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				response: { statusCode: 400 },
			});

			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = messageGetScopes;

			const result = await getOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					reason: 'CHAT_NOT_FOUND',
					hint: CHAT_NOT_FOUND_HINT,
				}),
			);
		});

		it('should return GET_MESSAGES_REJECTED when chat preflight succeeds and the messages endpoint returns a technical error', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({ members: [{ user_id: '123' }] })
				.mockRejectedValueOnce({
					message:
						"Sorry, we couldn't process your request due to a technical error. Please try again later.",
					response: { statusCode: 400 },
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const result = await getOperation.execute.call(mockExecuteFunctions, items, messageGetScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'get',
					chat_id: 'CT_1234567890_1234567890',
					reason: 'GET_MESSAGES_REJECTED',
					hint: expect.stringContaining('Zoho Cliq rejected the request before returning messages'),
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/members',
				{},
				{},
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				undefined,
			);
		});

		it('should return GET_MESSAGES_REJECTED for short technical-error responses after successful chat preflight', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'optionalFilters') return {};
					return undefined;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({ members: [{ user_id: '123' }] })
				.mockRejectedValueOnce({
					message: 'Technical error',
					response: { statusCode: 400 },
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const result = await getOperation.execute.call(mockExecuteFunctions, items, messageGetScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'get',
					chat_id: 'CT_1234567890_1234567890',
					reason: 'GET_MESSAGES_REJECTED',
					hint: expect.stringContaining('Zoho Cliq rejected the request before returning messages'),
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/members',
				{},
				{},
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				undefined,
			);
		});

		it('should preserve parsed time and limit filters in recoverable output when the messages request fails', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_1234567890_1234567890';
					if (paramName === 'optionalFilters') {
						return {
							fromtime: '2025-01-01T00:00:00Z',
							totime: '2025-01-01T01:00:00Z',
							limit: '25',
						};
					}
					return undefined;
				},
			);

			mockZohoCliqApiRequest
				.mockResolvedValueOnce({ members: [{ user_id: '123' }] })
				.mockRejectedValueOnce({
					message: 'Technical error',
					response: { statusCode: 400 },
				});

			const items: INodeExecutionData[] = [{ json: {} }];
			const result = await getOperation.execute.call(mockExecuteFunctions, items, messageGetScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'message',
					operation: 'get',
					chat_id: 'CT_1234567890_1234567890',
					fromtime: Date.parse('2025-01-01T00:00:00Z'),
					totime: Date.parse('2025-01-01T01:00:00Z'),
					limit: 25,
					reason: 'GET_MESSAGES_REJECTED',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/members',
				{},
				{},
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/chats/CT_1234567890_1234567890/messages',
				undefined,
				{
					fromtime: Date.parse('2025-01-01T00:00:00Z'),
					totime: Date.parse('2025-01-01T01:00:00Z'),
					limit: 25,
				},
			);
		});
	});
});
