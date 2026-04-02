import { NodeOperationError } from 'n8n-workflow';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	isMessageAiErrorModeEnabled,
	normalizeZohoMessageIdOutput,
	pushMessageRecoverableError,
	resolveMessageEnhancedOutput,
} from '../../../../../../nodes/ZohoCliq/v1/actions/message/common';
import * as sharedPreflight from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

const {
	enrichMessageChatLookupErrorIfPossible,
	enrichMessageTargetLookupErrorIfPossible,
	isMessageLookupNotFoundError,
	normalizeMessageLookupNotFoundError,
	preflightMessageTargetOrThrow,
	preflightMessageTargetOrThrowIfPossible,
	preflightMessageTargetIfPossible,
	validateMessageExistsOrThrow,
	validateMessageExistsIfPossible,
} = sharedPreflight;

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport', () => ({
	zohoCliqApiRequest: jest.fn(),
}));

describe('ZohoCliq - Message common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	let returnData: INodeExecutionData[];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		returnData = [];
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ parameters: {} })),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;
		mockZohoCliqApiRequest.mockReset();
	});

	it('should read AI Error Mode from node parameter', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(true);

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
	});

	it('should read AI Error Mode from stored node parameters when getNodeParameter is unavailable', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not available');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			parameters: { enableAiErrorMode: true },
		});

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
	});

	it('should return false when AI Error Mode is disabled', () => {
		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode is unavailable during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not available');
		});
		(mockExecuteFunctions as unknown as { getNode?: unknown }).getNode = undefined;

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode throws during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not available');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockImplementation(() => {
			throw new Error('boom');
		});

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when stored node parameters are missing or invalid during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not available');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			parameters: undefined,
		});

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when stored node parameters are an array during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not available');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			parameters: [],
		});

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode returns null during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not available');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue(null);

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode returns undefined during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not available');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue(undefined);

		expect(isMessageAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should push scope payload unchanged in recoverable mode', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushMessageRecoverableError(mockExecuteFunctions, returnData, 0, 'delete', {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'message',
				operation: 'delete',
			},
		});

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					resource: 'message',
					operation: 'delete',
				},
			},
		]);
	});

	it('should build generic recoverable payloads with context fields', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushMessageRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'get',
			{
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			},
			{
				contextFields: { chat_id: 'CT_123' },
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHAT_ID',
						hint: 'Verify chat_id.',
					},
				],
			},
		);

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'message',
				operation: 'get',
				chat_id: 'CT_123',
				status_code: 404,
				status_class: '4xx',
				reason: 'INVALID_CHAT_ID',
				hint: 'Verify chat_id.',
			}),
		);
	});

	it('should return false when recoverable mode is disabled', () => {
		const handled = pushMessageRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'retrieve',
			new Error('boom'),
		);

		expect(handled).toBe(false);
		expect(returnData).toHaveLength(0);
	});

	it('should ignore malformed scope payloads and build a generic recoverable payload', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushMessageRecoverableError(mockExecuteFunctions, returnData, 0, 'get', {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
			zohoCliqScopeErrorPayload: [],
		});

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Request URL is invalid',
				resource: 'message',
				operation: 'get',
				status_code: 404,
				details: {
					statusCode: 404,
				},
			}),
		);
	});

	it('should ignore non-object scope payloads and build a generic recoverable payload', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushMessageRecoverableError(mockExecuteFunctions, returnData, 0, 'get', {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
			zohoCliqScopeErrorPayload: 'invalid',
		});

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Request URL is invalid',
				resource: 'message',
				operation: 'get',
				status_code: 404,
				details: {
					statusCode: 404,
				},
			}),
		);
	});

	it('should build a generic recoverable payload when the error is undefined', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushMessageRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'get',
			undefined,
		);

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual({
			success: false,
			message: 'An unexpected issue occurred with the API request',
			resource: 'message',
			operation: 'get',
		});
	});

	it('should skip chat lookup enrichment when recoverable mode is disabled', async () => {
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageChatLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should map ambiguous message-target errors to chat not found when chat revalidation confirms the chat is missing', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const result = await enrichMessageChatLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toMatchObject({
			code: sharedPreflight.CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Chat ID "CT_missing_chat"'),
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_missing_chat/members',
			{},
			{},
		);
	});

	it('should leave ambiguous message-target errors unchanged when AI Error Mode is enabled and chat revalidation succeeds', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'enableAiErrorMode') {
					return true;
				}

				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			members: [{ user_id: '123' }],
		});
		const originalError = {
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			response: { statusCode: 400 },
		};

		const result = await enrichMessageChatLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_missing_chat/members',
			{},
			{},
		);
	});

	it('should leave non-ambiguous errors unchanged even when recoverable mode is enabled', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		const originalError = {
			message: 'Message ID is required',
			response: { statusCode: 400 },
		};

		const result = await enrichMessageChatLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip chat revalidation when chat lookup scope is unavailable', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageChatLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should keep the original error when chatId is unavailable for enrichment', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageChatLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			undefined,
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should keep the original error when chat revalidation fails for a non-not-found reason', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Service temporarily unavailable',
			response: { statusCode: 503 },
		});

		const result = await enrichMessageChatLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_missing_chat/members',
			{},
			{},
		);
	});

	it('should keep the original error when AI error mode lookup cannot read node parameters and getNode is unavailable', async () => {
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const contextWithoutNode = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
		} as unknown as IExecuteFunctions;

		const result = await enrichMessageChatLookupErrorIfPossible(
			contextWithoutNode,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should keep the original error when AI error mode fallback getNode lookup throws', async () => {
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const explodingNodeContext = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
			getNode: jest.fn(() => {
				throw new Error('node lookup failed');
			}),
		} as unknown as IExecuteFunctions;

		const result = await enrichMessageChatLookupErrorIfPossible(
			explodingNodeContext,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should keep the original error when shared AI error mode fallback getNode returns undefined', async () => {
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const undefinedNodeContext = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
			getNode: jest.fn(() => undefined),
		} as unknown as IExecuteFunctions;

		const result = await enrichMessageChatLookupErrorIfPossible(
			undefinedNodeContext,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should still map ambiguous message-target errors to MESSAGE_NOT_FOUND when chat lookup scope is unavailable', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(result).toMatchObject({
			code: sharedPreflight.MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('Unable to find Message ID "MSG_missing"'),
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_missing',
		);
	});

	it('should map ambiguous message-target errors to MESSAGE_NOT_FOUND when chat validation succeeds first', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				members: [{ user_id: '123' }],
			})
			.mockRejectedValueOnce({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(sharedPreflight.isMessageLookupNotFoundError(result)).toBe(true);
		expect((result as Error).message).toContain('Unable to find Message ID "MSG_missing"');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_missing',
		);
	});

	it('should map ambiguous message-target errors to CHAT_NOT_FOUND when chat validation confirms the chat is missing', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_missing_chat',
			'MSG_missing',
		);

		expect(result).toMatchObject({
			code: sharedPreflight.CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Chat ID "CT_missing_chat"'),
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_missing_chat/members',
			{},
			{},
		);
	});

	it('should keep the original error when chat revalidation fails for a non-not-found reason during message-target enrichment', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest
			.mockRejectedValueOnce({
				message: 'Service temporarily unavailable',
				response: { statusCode: 503 },
			})
			.mockResolvedValueOnce({
				message_id: 'MSG_missing',
			});
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_missing',
		);
	});

	it('should keep the original error when message revalidation fails for a non-not-found reason', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				members: [{ user_id: '123' }],
			})
			.mockRejectedValueOnce({
				message: 'Service temporarily unavailable',
				response: { statusCode: 503 },
			});
		const originalError = {
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		};

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			originalError,
			0,
			'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(result).toBe(originalError);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_missing',
		);
	});

	it('should treat minimal top-level 400 errors as recoverable message-target candidates', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			status: 400,
		});

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			{ status: 400 },
			0,
			'ZohoCliq.Messages.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(result).toMatchObject({
			code: sharedPreflight.MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('Unable to find Message ID "MSG_missing"'),
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_missing',
		);
	});

	it('should treat top-level statusCode 400 errors as recoverable message-target candidates', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
		});

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			{ statusCode: 400 },
			0,
			'ZohoCliq.Messages.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(result).toMatchObject({
			code: sharedPreflight.MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('Unable to find Message ID "MSG_missing"'),
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_missing',
		);
	});

	it('should treat response.statusCode 400 errors as recoverable message-target candidates', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: { statusCode: 400 },
		});

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			{ response: { statusCode: 400 } },
			0,
			'ZohoCliq.Messages.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(result).toMatchObject({
			code: sharedPreflight.MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('Unable to find Message ID "MSG_missing"'),
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_missing',
		);
	});

	it('should leave an undefined message-target error unchanged', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const result = await enrichMessageTargetLookupErrorIfPossible(
			mockExecuteFunctions,
			undefined,
			0,
			'ZohoCliq.Messages.READ',
			'CT_123_456',
			'MSG_missing',
		);

		expect(result).toBeUndefined();
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should normalize authoritative message lookup failures into the shared MESSAGE_NOT_FOUND contract', () => {
		const result = normalizeMessageLookupNotFoundError(
			mockExecuteFunctions,
			{
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			},
			0,
			{
				chatId: 'CT_123_456',
				messageId: 'MSG_missing',
			},
		);

		expect(result).toMatchObject({
			code: sharedPreflight.MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('Unable to find Message ID "MSG_missing"'),
			statusCode: 404,
		});
	});

	it('should leave non-authoritative message lookup errors unnormalized', () => {
		const result = normalizeMessageLookupNotFoundError(
			mockExecuteFunctions,
			{
				message: 'Service temporarily unavailable',
				response: { statusCode: 503 },
			},
			0,
			{
				chatId: 'CT_123_456',
				messageId: 'MSG_missing',
			},
		);

		expect(result).toBeUndefined();
	});

	it('should default missing message lookup labels to unknown when normalization options are omitted', () => {
		const result = normalizeMessageLookupNotFoundError(
			mockExecuteFunctions,
			{
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			},
			0,
		);

		expect(result).toMatchObject({
			code: sharedPreflight.MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('Unable to find Message ID "unknown" in Chat ID "unknown"'),
			description:
				'The selected message could not be found in this chat. Check the chat ID and message ID, then try again.',
		});
	});

	it('should resolve enhanced output for object responses', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(true);

		const result = resolveMessageEnhancedOutput(
			mockExecuteFunctions,
			0,
			{ data: '' },
			'outputEnhancedResponse',
			true,
		);

		expect(result).toEqual({
			includeEnhancedOutput: true,
			rawResponse: { data: '' },
			responseJson: { data: '' },
		});
	});

	it('should default enhanced output when the parameter is undefined', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(undefined);

		const result = resolveMessageEnhancedOutput(
			mockExecuteFunctions,
			0,
			{ ok: true },
			'outputEnhancedResponse',
			true,
		);

		expect(result).toEqual({
			includeEnhancedOutput: true,
			rawResponse: { ok: true },
			responseJson: { ok: true },
		});
	});

	it('should coerce primitive responses in enhanced output helper', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(false);

		const result = resolveMessageEnhancedOutput(
			mockExecuteFunctions,
			0,
			'deleted',
			'outputEnhancedResponse',
			true,
		);

		expect(result.rawResponse).toEqual({ data: 'deleted' });
		expect(result.includeEnhancedOutput).toBe(false);
	});

	it('should reject non-boolean enhanced output parameter values', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue('true');

		expect(() =>
			resolveMessageEnhancedOutput(mockExecuteFunctions, 0, {}, 'outputEnhancedResponse', true),
		).toThrow('Invalid outputEnhancedResponse value: must be a boolean');
	});

	it('should normalize Zoho message IDs for output reuse', () => {
		expect(normalizeZohoMessageIdOutput('1772612422798%20209244327054')).toBe(
			'1772612422798_209244327054',
		);
		expect(normalizeZohoMessageIdOutput('1772612422798 209244327054')).toBe(
			'1772612422798_209244327054',
		);
	});

	it('should skip message existence lookup when message read scope is unavailable', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_123',
				0,
				'ZohoCliq.Messages.DELETE',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should no-op when message existence validation is missing the chat ID or message ID', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ',
			),
		).resolves.toBeUndefined();
		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'',
				0,
				'ZohoCliq.Messages.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should no-op when recoverable message-target validation is missing the chat ID or message ID', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		await expect(
			preflightMessageTargetOrThrowIfPossible(
				mockExecuteFunctions,
				'',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			),
		).resolves.toBeUndefined();
		await expect(
			preflightMessageTargetOrThrowIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should no-op when message-target preflight is missing the chat ID or message ID', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		await expect(
			preflightMessageTargetIfPossible(
				mockExecuteFunctions,
				'',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			),
		).resolves.toBeUndefined();
		await expect(
			preflightMessageTargetIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip message existence lookup when the retrieve scope registry entry is unavailable', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		jest
			.spyOn(scopeRegistry, 'listAcceptedScopesForOperation')
			.mockImplementation((resource, operation) => {
				if (resource === 'message' && operation === 'retrieve') {
					return undefined;
				}

				return ['ZohoCliq.Messages.READ'];
			});

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate message existence through the retrieve endpoint when read scope is available', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123' });

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_123',
		);
	});

	it('should URL-encode chat and message IDs during shared message preflight retrieval', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG /123?' });

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT chat/123',
				'MSG /123?',
				0,
				'ZohoCliq.Messages.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			`/api/v2/chats/${encodeURIComponent('CT chat/123')}/messages/${encodeURIComponent('MSG /123?')}`,
		);
	});

	it('should throw a reusable message lookup error when retrieve preflight confirms the message is missing', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		let capturedError: unknown;
		try {
			await validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_missing',
				0,
				'ZohoCliq.Messages.READ',
			);
		} catch (error) {
			capturedError = error;
		}

		expect(capturedError).toBeInstanceOf(NodeOperationError);
		expect((capturedError as Error).message).toContain(
			'Unable to find Message ID "MSG_missing" in Chat ID "CT_123_456"',
		);
		expect(isMessageLookupNotFoundError(capturedError)).toBe(true);
	});

	it('should detect message lookup failures from error text even when the response object is missing', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Message not found',
		});

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_missing',
				0,
				'ZohoCliq.Messages.READ',
			),
		).rejects.toThrow('Unable to find Message ID "MSG_missing" in Chat ID "CT_123_456"');
	});

	it('should rethrow undefined lookup failures during an active message preflight', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue(undefined);

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ',
			),
		).rejects.toBeUndefined();
	});

	it('should detect message lookup failures from response.status 400 when statusCode is absent', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Lookup failed',
			response: { status: 400 },
		});

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_missing',
				0,
				'ZohoCliq.Messages.READ',
			),
		).rejects.toThrow('Unable to find Message ID "MSG_missing" in Chat ID "CT_123_456"');
	});

	it('should surface non-not-found errors during an active message preflight', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Service temporarily unavailable',
			response: { statusCode: 503 },
		});

		await expect(
			validateMessageExistsIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ',
			),
		).rejects.toMatchObject({
			message: 'Service temporarily unavailable',
			response: { statusCode: 503 },
		});
	});

	it('should fail strict message preflight with MESSAGE_NOT_FOUND when Retrieve Message returns a not-found response', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		await expect(
			validateMessageExistsOrThrow(mockExecuteFunctions, 'CT_123_456', 'MSG_123', 0),
		).rejects.toMatchObject({
			code: 'MESSAGE_NOT_FOUND',
			message: expect.stringContaining('Unable to find Message ID "MSG_123"'),
		});
	});

	it('should fail strict message preflight with MESSAGE_NOT_FOUND when Retrieve Message returns response.status 400', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Lookup failed',
			response: { status: 400 },
		});

		await expect(
			validateMessageExistsOrThrow(mockExecuteFunctions, 'CT_123_456', 'MSG_123', 0),
		).rejects.toMatchObject({
			code: 'MESSAGE_NOT_FOUND',
			message: expect.stringContaining('Unable to find Message ID "MSG_123"'),
		});
	});

	it('should fail strict message preflight with MESSAGE_NOT_FOUND when Retrieve Message returns not-found text without a response object', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Message not found',
		});

		await expect(
			validateMessageExistsOrThrow(mockExecuteFunctions, 'CT_123_456', 'MSG_123', 0),
		).rejects.toMatchObject({
			code: 'MESSAGE_NOT_FOUND',
			message: expect.stringContaining('Unable to find Message ID "MSG_123"'),
		});
	});

	it('should rethrow non-not-found strict message preflight errors', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Service temporarily unavailable',
			response: { statusCode: 503 },
		});

		await expect(
			validateMessageExistsOrThrow(mockExecuteFunctions, 'CT_123_456', 'MSG_123', 0),
		).rejects.toMatchObject({
			message: 'Service temporarily unavailable',
			response: { statusCode: 503 },
		});
	});

	it('should rethrow undefined strict message preflight errors when no not-found signal is available', async () => {
		mockZohoCliqApiRequest.mockRejectedValue(undefined);

		await expect(
			validateMessageExistsOrThrow(mockExecuteFunctions, 'CT_123_456', 'MSG_123', 0),
		).rejects.toBeUndefined();
	});

	it('should skip strict message preflight when chatId is empty', async () => {
		await expect(
			validateMessageExistsOrThrow(mockExecuteFunctions, '', 'MSG_123', 0),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip strict message preflight when messageId is empty', async () => {
		await expect(
			validateMessageExistsOrThrow(mockExecuteFunctions, 'CT_123_456', '', 0),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should still run shared message-target lookup when chat scope is unavailable but message scope is present', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			message_id: 'MSG_123',
		});

		await expect(
			preflightMessageTargetIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_123',
				0,
				'ZohoCliq.Messages.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_123',
		);
	});

	it('should preflight shared message targets by validating chat first when chat scope is available', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				members: [{ user_id: '123' }],
			})
			.mockResolvedValueOnce({
				message_id: 'MSG_123',
			});

		await expect(
			preflightMessageTargetIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'MSG_123',
				0,
				'ZohoCliq.Chats.READ,ZohoCliq.Messages.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_123',
		);
	});

	it('should preserve pre-escaped message IDs during shared message target preflight', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				members: [{ user_id: '123' }],
			})
			.mockResolvedValueOnce({
				message_id: '1709038327612%20712605914940',
			});

		await expect(
			preflightMessageTargetIfPossible(
				mockExecuteFunctions,
				'CT_123_456',
				'1709038327612%20712605914940',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/chats/CT_123_456/messages/1709038327612%20712605914940',
		);
	});

	it('should strictly preflight chat lookup before message lookup for shared message target validation', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				members: [{ user_id: '123' }],
			})
			.mockResolvedValueOnce({
				message_id: 'MSG_123',
			});

		await expect(
			preflightMessageTargetOrThrow(mockExecuteFunctions, 'CT_123_456', 'MSG_123', 0),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/chats/CT_123_456/messages/MSG_123',
		);
	});
});
