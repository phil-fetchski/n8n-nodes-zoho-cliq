import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	CHAT_LOOKUP_FAILED_ERROR_CODE,
	CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
	looksLikeChannelIdForChatOnlyOperation,
	normalizeStickyMessageResponseOutput,
	normalizeZohoMessageIdOutput,
	pushChatRecoverableError,
	resolveChatEnhancedOutput,
} from '../../../../../../nodes/ZohoCliq/v1/actions/chat/shared';
import {
	assertChatLookupPreflightScopesOrThrow,
	CHAT_NOT_FOUND_HINT,
	normalizeChatLookupNotFoundError,
	validateChatExistsIfPossible,
	validateChatExistsOrThrow,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport', () => ({
	zohoCliqApiRequest: jest.fn(),
}));

describe('ZohoCliq - Chat shared helpers', () => {
	const CHAT_LOOKUP_NOT_FOUND_DESCRIPTION =
		'The provided chat ID does not exist in Zoho Cliq or is not accessible to the authenticated account.';
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const buildContext = (
		continueOnFail = false,
		enableAiErrorMode: unknown = false,
		nodeParameters: Record<string, unknown> = {},
	): IExecuteFunctions =>
		({
			continueOnFail: jest.fn(() => continueOnFail),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'enableAiErrorMode') {
					return enableAiErrorMode;
				}
				if (Object.prototype.hasOwnProperty.call(nodeParameters, name)) {
					return nodeParameters[name];
				}
				return fallback;
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', parameters: { enableAiErrorMode } })),
		}) as unknown as IExecuteFunctions;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should return false when recoverable mode is disabled', () => {
		const context = buildContext(false, false);
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'list', new Error('boom'));

		expect(handled).toBe(false);
		expect(returnData).toHaveLength(0);
	});

	it('should normalize Zoho message ids to underscore format for outputs', () => {
		expect(normalizeZohoMessageIdOutput('1772612422798%20209244327054')).toBe(
			'1772612422798_209244327054',
		);
		expect(normalizeZohoMessageIdOutput('1772612422798 209244327054')).toBe(
			'1772612422798_209244327054',
		);
	});

	it('should detect channel-like ids only for non-empty P/O/T/E prefixes', () => {
		expect(looksLikeChannelIdForChatOnlyOperation('P1234567890')).toBe(true);
		expect(looksLikeChannelIdForChatOnlyOperation(' e1234567890')).toBe(true);
		expect(looksLikeChannelIdForChatOnlyOperation('CT_123_456')).toBe(false);
		expect(looksLikeChannelIdForChatOnlyOperation('1234567890')).toBe(false);
		expect(looksLikeChannelIdForChatOnlyOperation('   ')).toBe(false);
	});

	it('should leave pinned message response objects unchanged when data is absent or primitive', () => {
		expect(
			normalizeStickyMessageResponseOutput({
				message_id: '1772612422798%20209244327054',
			}),
		).toEqual({
			message_id: '1772612422798_209244327054',
		});

		expect(
			normalizeStickyMessageResponseOutput({
				data: 'not-an-object',
			}),
		).toEqual({
			data: 'not-an-object',
		});
	});

	it('should normalize pinned message ids in object responses', () => {
		expect(
			normalizeStickyMessageResponseOutput({
				message_id: '1772612422798%20209244327054',
				unpinned_message_id: '1772612422798 209244327054',
				data: {
					id: '1772612422798%20209244327054',
					message: {
						msguid: '1772612422798%20209244327054',
						id: '1772612422798 209244327054',
					},
				},
			}),
		).toEqual({
			message_id: '1772612422798_209244327054',
			unpinned_message_id: '1772612422798_209244327054',
			data: {
				id: '1772612422798_209244327054',
				message: {
					msguid: '1772612422798_209244327054',
					id: '1772612422798_209244327054',
				},
			},
		});
	});

	it('should preserve normalized data when pinned message payload has no nested message object', () => {
		expect(
			normalizeStickyMessageResponseOutput({
				data: {
					id: '1772612422798%20209244327054',
					message: 'not-an-object',
				},
			}),
		).toEqual({
			data: {
				id: '1772612422798_209244327054',
				message: 'not-an-object',
			},
		});
	});

	it('should normalize pinned message ids in array responses and ignore primitives', () => {
		expect(
			normalizeStickyMessageResponseOutput([
				{
					data: {
						message: {
							msguid: '1772612422798%20209244327054',
						},
					},
				},
				'unchanged',
			]),
		).toEqual([
			{
				data: {
					message: {
						msguid: '1772612422798_209244327054',
					},
				},
			},
			'unchanged',
		]);
	});

	it('should return primitive pinned message responses unchanged', () => {
		expect(normalizeStickyMessageResponseOutput('unchanged')).toBe('unchanged');
	});

	it('should skip chat existence lookup when chat read scope is unavailable', async () => {
		await expect(
			validateChatExistsIfPossible(buildContext(true), 'CT_123_456', 0, 'ZohoCliq.Messages.READ'),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should no-op when chat existence validation receives an empty chat ID', async () => {
		await expect(
			validateChatExistsIfPossible(buildContext(true), '', 0, 'ZohoCliq.Chats.READ'),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip chat existence lookup when the chat-members scope registry entry is unavailable', async () => {
		jest
			.spyOn(scopeRegistry, 'listAcceptedScopesForOperation')
			.mockImplementation((resource, operation) => {
				if (resource === 'chat' && operation === 'getMembers') {
					return undefined;
				}

				return ['ZohoCliq.Chats.READ'];
			});

		await expect(
			validateChatExistsIfPossible(buildContext(true), 'CT_123_456', 0, 'ZohoCliq.Chats.READ'),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate chat existence through the Get Chat Members endpoint', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			members: [{ user_id: '123' }],
		});

		await expect(
			validateChatExistsIfPossible(
				buildContext(true),
				'CT_123_456',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
	});

	it('should accept chat IDs from response.data arrays', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ chat_id: 'CT_123_456' }],
		});

		await expect(
			validateChatExistsIfPossible(buildContext(true), 'CT_123_456', 0, 'ZohoCliq.Chats.READ'),
		).resolves.toBeUndefined();
	});

	it('should accept numeric chat IDs from the id field', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ id: 1234567890 });

		await expect(
			validateChatExistsOrThrow(buildContext(), '1234567890', 0),
		).resolves.toBeUndefined();
	});

	it('should accept chat IDs from the camelCase chatId field', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ chatId: 'CT_123_456' });

		await expect(
			validateChatExistsOrThrow(buildContext(), 'CT_123_456', 0),
		).resolves.toBeUndefined();
	});

	it('should accept chat IDs from nested direct lookup data objects', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			data: { id: 'CT_123_456' },
		});

		await expect(
			validateChatExistsOrThrow(buildContext(), 'CT_123_456', 0),
		).resolves.toBeUndefined();
	});

	it('should treat primitive Get Chat Members responses as successful chat validation', async () => {
		mockZohoCliqApiRequest.mockResolvedValue('not-an-object' as unknown as IDataObject);

		await expect(
			validateChatExistsOrThrow(buildContext(), 'CT_missing', 0),
		).resolves.toBeUndefined();
	});

	it('should treat object responses without member arrays as successful chat validation', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [],
		});

		await expect(
			validateChatExistsOrThrow(buildContext(), 'CT_missing', 0),
		).resolves.toBeUndefined();
	});

	it('should treat object Get Chat Members responses as successful chat validation', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				members: [{ user_id: '123' }],
			},
		});

		await expect(
			validateChatExistsIfPossible(buildContext(true), 'CT_123_456', 0, 'ZohoCliq.Chats.ALL'),
		).resolves.toBeUndefined();
	});

	it('should throw when Get Chat Members rejects the chat ID with an authoritative invalid-chat response', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 400 },
		});

		let capturedError: unknown;
		try {
			await validateChatExistsIfPossible(
				buildContext(true),
				'CT_123_456',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.READ',
			);
		} catch (error) {
			capturedError = error;
		}

		expect(capturedError).toBeInstanceOf(NodeOperationError);
		expect((capturedError as Error).message).toContain('No chat found for Chat ID "CT_123_456".');
		expect((capturedError as NodeOperationError).description).toBe(CHAT_NOT_FOUND_HINT);
		expect((capturedError as { code?: string }).code).toBe(CHAT_LOOKUP_NOT_FOUND_ERROR_CODE);
		expect(
			(
				capturedError as NodeOperationError & {
					zohoCliqPreflight?: { hint?: string };
				}
			).zohoCliqPreflight?.hint,
		).toBe(CHAT_NOT_FOUND_HINT);
	});

	it('should treat responses without member arrays as successful chat validation', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			data: {},
		});

		await expect(
			validateChatExistsIfPossible(buildContext(true), 'CT_missing', 0, 'ZohoCliq.Chats.READ', {
				fieldLabel: 'Conversation Chat ID',
			}),
		).resolves.toBeUndefined();
	});

	it('should treat large Get Chat Members responses as successful chat validation', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			members: Array.from({ length: 100 }, (_, index) => ({ user_id: `user_${index}` })),
		});

		await expect(
			validateChatExistsIfPossible(
				buildContext(true),
				'CT_missing',
				0,
				'ZohoCliq.Messages.READ,ZohoCliq.Chats.ALL',
			),
		).resolves.toBeUndefined();
	});

	it('should treat a successful Get Chat Members validation as successful chat validation', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			members: [{ user_id: '123' }],
		});

		await expect(
			validateChatExistsIfPossible(buildContext(true), 'CT_missing', 0, 'ZohoCliq.Chats.READ'),
		).resolves.toBeUndefined();
	});

	it('should fail fast when accepted chat preflight scopes exist but the conditional requirement payload is missing', () => {
		const conditionalRequirementSpy = jest
			.spyOn(scopeRegistry, 'getConditionalScopeRequirement')
			.mockReturnValue(undefined);

		expect(() =>
			assertChatLookupPreflightScopesOrThrow(buildContext(), 'ZohoCliq.Chats.UPDATE', 0, {
				resource: 'chat',
				operation: 'mute',
				missingScopeMessage: 'unused',
				description: 'unused',
			}),
		).toThrow('Chat.mute chatLookupPreflight scope registry entry is missing or empty.');

		conditionalRequirementSpy.mockRestore();
	});

	it('should map direct strict chat preflight 404 responses to chat not found', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		await expect(validateChatExistsOrThrow(buildContext(), 'CT_missing', 0)).rejects.toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Chat ID "CT_missing"'),
		});
	});

	it('should map direct strict chat preflight response.status 400 values to chat not found', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Lookup failed',
			response: { status: 400 },
		});

		await expect(validateChatExistsOrThrow(buildContext(), 'CT_missing', 0)).rejects.toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Chat ID "CT_missing"'),
		});
	});

	it('should skip strict chat preflight when chatId is empty', async () => {
		await expect(validateChatExistsOrThrow(buildContext(), '', 0)).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should call the direct strict chat preflight endpoint with an encoded chat ID', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ chat_id: 'CT_123_456/child' });

		await expect(
			validateChatExistsOrThrow(buildContext(), 'CT_123_456/child', 0),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456%2Fchild/members',
			{},
			{},
		);
	});

	it('should treat mismatched-looking Get Chat Members responses as successful chat validation', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ chat_id: 'CT_some_other_chat' });

		await expect(
			validateChatExistsOrThrow(buildContext(), 'CT_missing', 0),
		).resolves.toBeUndefined();
	});

	it('should fail strict chat preflight when the direct Get Chat request errors without a not-found signal', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Service temporarily unavailable',
			response: { statusCode: 503 },
		});

		await expect(validateChatExistsOrThrow(buildContext(), 'CT_missing', 0)).rejects.toMatchObject({
			code: CHAT_LOOKUP_FAILED_ERROR_CODE,
			message: expect.stringContaining('Unable to verify Chat ID "CT_missing" before continuing'),
		});
	});

	it('should fail strict chat preflight when the direct Get Chat lookup errors', async () => {
		mockZohoCliqApiRequest.mockRejectedValue(new Error('chat list unavailable'));

		await expect(validateChatExistsOrThrow(buildContext(), 'CT_missing', 0)).rejects.toMatchObject({
			code: CHAT_LOOKUP_FAILED_ERROR_CODE,
			message: expect.stringContaining('Unable to verify Chat ID "CT_missing" before continuing'),
		});
	});

	it('should fail strict chat preflight when the direct Get Chat lookup rejects without an error object', async () => {
		mockZohoCliqApiRequest.mockRejectedValue(undefined);

		await expect(validateChatExistsOrThrow(buildContext(), 'CT_missing', 0)).rejects.toMatchObject({
			code: CHAT_LOOKUP_FAILED_ERROR_CODE,
			message: expect.stringContaining('Unable to verify Chat ID "CT_missing" before continuing'),
		});
	});

	it('should use a custom field label in strict chat preflight errors', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		await expect(
			validateChatExistsOrThrow(buildContext(), 'CT_missing', 0, {
				fieldLabel: 'Conversation Chat ID',
			}),
		).rejects.toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Conversation Chat ID "CT_missing"'),
		});
	});

	it('should normalize authoritative string errors without copied lookup metadata', () => {
		const normalized = normalizeChatLookupNotFoundError(
			buildContext(),
			'Request URL is invalid',
			0,
			{
				chatId: 'CT_missing',
			},
		);

		expect(normalized).toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Chat ID "CT_missing"'),
			description: CHAT_LOOKUP_NOT_FOUND_DESCRIPTION,
		});
		expect(normalized).not.toHaveProperty('response');
		expect(normalized).not.toHaveProperty('statusCode');
	});

	it('should copy response metadata when normalizing authoritative chat lookup errors', () => {
		const response = { statusCode: 404, body: { message: 'Request URL is invalid' } };
		const normalized = normalizeChatLookupNotFoundError(
			buildContext(),
			{
				message: 'Request URL is invalid',
				response,
			},
			0,
			{
				chatId: 'CT_missing',
			},
		);

		expect(normalized).toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			statusCode: 404,
			response,
			description: CHAT_LOOKUP_NOT_FOUND_DESCRIPTION,
		});
	});

	it('should use default chat lookup normalization labels when options are omitted', () => {
		const normalized = normalizeChatLookupNotFoundError(
			buildContext(),
			{
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			},
			0,
		);

		expect(normalized).toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			statusCode: 404,
			message: expect.stringContaining('No chat found for Chat ID "unknown"'),
			description: CHAT_LOOKUP_NOT_FOUND_DESCRIPTION,
		});
	});

	it('should use the default field label when chat normalization options omit it', () => {
		const normalized = normalizeChatLookupNotFoundError(
			buildContext(),
			{
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			},
			0,
			{
				chatId: 'CT_missing',
			},
		);

		expect(normalized).toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Chat ID "CT_missing"'),
			description: CHAT_LOOKUP_NOT_FOUND_DESCRIPTION,
		});
	});

	it('should preserve a custom field label when normalizing authoritative chat lookup errors', () => {
		const normalized = normalizeChatLookupNotFoundError(
			buildContext(),
			{
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			},
			0,
			{
				chatId: 'CT_missing',
				fieldLabel: 'Conversation ID',
			},
		);

		expect(normalized).toMatchObject({
			code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: expect.stringContaining('No chat found for Conversation ID "CT_missing"'),
			description: CHAT_LOOKUP_NOT_FOUND_DESCRIPTION,
		});
	});

	it('should ignore blank msguid values while still normalizing message.id', () => {
		expect(
			normalizeStickyMessageResponseOutput({
				data: {
					message: {
						msguid: '   ',
						id: '1772612422798%20209244327054',
					},
				},
			}),
		).toEqual({
			data: {
				message: {
					msguid: '   ',
					id: '1772612422798_209244327054',
				},
			},
		});
	});

	it('should preserve scope payloads when continueOnFail is enabled', () => {
		const context = buildContext(true, false);
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'leave', {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'chat',
				operation: 'leave',
				missingScopes: ['ZohoCliq.Chats.UPDATE'],
			},
		});

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'leave',
			}),
		);
		expect(returnData[0].json).not.toHaveProperty('error');
	});

	it('should build mapped recoverable errors in AI Error Mode from node parameters', () => {
		const context = buildContext(false, 'true');
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(
			context,
			returnData,
			0,
			'getMembers',
			{
				statusCode: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
			},
			{
				contextFields: {
					chat_id: 'CT_123_456',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHAT_ID',
						hint: 'Verify the chat ID.',
					},
				],
			},
		);

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'getMembers',
				chat_id: 'CT_123_456',
				reason: 'INVALID_CHAT_ID',
				hint: 'Verify the chat ID.',
			}),
		);
		expect(returnData[0].json).not.toHaveProperty('error');
	});

	it('should read AI Error Mode from getNode().parameters when getNodeParameter is falsy', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				parameters: {
					enableAiErrorMode: 'true',
				},
			})),
		} as unknown as IExecuteFunctions;
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(
			context,
			returnData,
			0,
			'getMembers',
			{
				statusCode: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
			},
			{
				contextFields: {
					chat_id: 'CT_123_456',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHAT_ID',
						hint: 'Verify the chat ID.',
					},
				],
			},
		);

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'getMembers',
				chat_id: 'CT_123_456',
				reason: 'INVALID_CHAT_ID',
				hint: 'Verify the chat ID.',
			}),
		);
		expect(returnData[0].json).not.toHaveProperty('error');
	});

	it('should tolerate getNodeParameter failures while checking AI Error Mode', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', parameters: {} })),
		} as unknown as IExecuteFunctions;
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'list', new Error('boom'));

		expect(handled).toBe(false);
	});

	it('should tolerate missing getNode while checking AI Error Mode', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'list', new Error('boom'));

		expect(handled).toBe(false);
	});

	it('should tolerate getNode throwing while checking AI Error Mode', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => {
				throw new Error('node unavailable');
			}),
		} as unknown as IExecuteFunctions;
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'list', new Error('boom'));

		expect(handled).toBe(false);
	});

	it('should treat array-shaped node parameters as unavailable for AI Error Mode fallback', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', parameters: [] })),
		} as unknown as IExecuteFunctions;
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'list', new Error('boom'));

		expect(handled).toBe(false);
	});

	it('should tolerate getNode returning undefined while checking AI Error Mode', () => {
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => undefined),
		} as unknown as IExecuteFunctions;
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'list', new Error('boom'));

		expect(handled).toBe(false);
	});

	it('should ignore non-object scope payloads and fall back to generic recoverable output', () => {
		const context = buildContext(true, false);
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'leave', {
			zohoCliqScopeErrorPayload: [],
			message: 'Fallback error',
		});

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'leave',
				message: 'Fallback error',
			}),
		);
		expect(returnData[0].json).not.toHaveProperty('error');
	});

	it('should handle undefined errors in recoverable mode', () => {
		const context = buildContext(true, false);
		const returnData: INodeExecutionData[] = [];

		const handled = pushChatRecoverableError(context, returnData, 0, 'list', undefined);

		expect(handled).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'list',
				message: 'An unexpected issue occurred with the API request',
			}),
		);
		expect(returnData[0].json).not.toHaveProperty('error');
	});

	it('should resolve enhanced output defaults and raw passthrough', () => {
		const defaultContext = buildContext(false, false);
		expect(resolveChatEnhancedOutput(defaultContext, 0, { ok: true })).toEqual({
			includeEnhancedOutput: true,
			rawResponse: { ok: true },
			responseJson: { ok: true },
		});

		const rawContext = buildContext(false, false, {
			includeEnhancedOutput: false,
		});
		expect(resolveChatEnhancedOutput(rawContext, 0, undefined)).toEqual({
			includeEnhancedOutput: false,
			rawResponse: {},
			responseJson: {},
		});
	});
});
