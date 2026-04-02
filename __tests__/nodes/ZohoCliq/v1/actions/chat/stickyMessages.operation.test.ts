import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import { CHAT_NOT_FOUND_HINT } from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';

import * as getPinnedStickyMessage from '../../../../../../nodes/ZohoCliq/v1/actions/chat/getPinnedStickyMessage.operation';
import * as pinStickyMessage from '../../../../../../nodes/ZohoCliq/v1/actions/chat/pinStickyMessage.operation';
import * as unpinStickyMessage from '../../../../../../nodes/ZohoCliq/v1/actions/chat/unpinStickyMessage.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Chat - Pin/Unpin Message Operations', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	let dateNowSpy: jest.SpyInstance<number, []>;
	const pinGrantedScopes = SCOPES.CHATS_CREATE_WITH_READ;
	const unpinGrantedScopes = SCOPES.CHATS_STICKY_DELETE_WITH_READ;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const items: INodeExecutionData[] = [{ json: {} }];
	const setNodeParameters = (
		values: {
			chatId?: string;
			messageId?: string;
			additionalFields?: Record<string, unknown>;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
		} = {},
	) => {
		const {
			chatId = 'CT_123_456',
			messageId = '1700123456789_abc',
			additionalFields = { notify: true, expireAt: '2024-10-27T03:33:20.000Z' },
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
		} = values;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'chatId') return chatId;
			if (name === 'messageId') return messageId;
			if (name === 'additionalFields') return additionalFields;
			if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
			if (name === 'enableAiErrorMode') return enableAiErrorMode;
			return undefined;
		});
	};

	const assertMissingScopeError = (thrownError: unknown, requiredScope: string): void => {
		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	};

	beforeEach(() => {
		dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(1729999995000);

		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		setNodeParameters();
		mockZohoCliqApiRequest.mockClear();
		mockZohoCliqApiRequest.mockResolvedValue({ ok: true });
	});

	afterEach(() => {
		dateNowSpy.mockRestore();
	});

	it('should pin a message with the expected payload', async () => {
		const result = await pinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			pinGrantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				operation: 'pinStickyMessage',
				chat_id: 'CT_123_456',
				message_id: '1700123456789_abc',
				notify: true,
				expiry_time: 1730000000000,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: true,
				expiry_time: 5000,
			},
		);
	});

	it('should default notify to false when not provided', async () => {
		setNodeParameters({ additionalFields: {} });

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: false,
				expiry_time: -1,
			},
		);
	});

	it('should reject invalid expiry time when pinning a message', async () => {
		setNodeParameters({ additionalFields: { notify: false, expireAt: 'not-a-date' } });

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow(NodeOperationError);
	});

	it('should support numeric expression value for expireAt', async () => {
		setNodeParameters({ additionalFields: { notify: false, expireAt: 1730000005000 } });

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: false,
				expiry_time: 10000,
			},
		);
	});

	it('should support DateTime-like object for expireAt', async () => {
		setNodeParameters({
			additionalFields: {
				notify: true,
				expireAt: {
					toMillis: () => 1730000010000,
				},
			},
		});

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: true,
				expiry_time: 15000,
			},
		);
	});

	it('should support Date instance for expireAt', async () => {
		setNodeParameters({
			additionalFields: {
				notify: true,
				expireAt: new Date('2024-10-27T03:33:21.000Z'),
			},
		});

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: true,
				expiry_time: 6000,
			},
		);
	});

	it('should support numeric string timestamp for expireAt', async () => {
		setNodeParameters({
			additionalFields: {
				notify: false,
				expireAt: '1730000007000',
			},
		});

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: false,
				expiry_time: 12000,
			},
		);
	});

	it('should allow empty expireAt string and send no-expiry payload', async () => {
		setNodeParameters({
			additionalFields: {
				notify: false,
				expireAt: '   ',
			},
		});

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: false,
				expiry_time: -1,
			},
		);
	});

	it('should support DateTime-like ts property for expireAt', async () => {
		setNodeParameters({
			additionalFields: {
				notify: true,
				expireAt: {
					ts: 1730000009000,
				},
			},
		});

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: true,
				expiry_time: 14000,
			},
		);
	});

	it('should support DateTime-like valueOf numeric for expireAt', async () => {
		setNodeParameters({
			additionalFields: {
				notify: true,
				expireAt: {
					valueOf: () => 1730000011000,
				},
			},
		});

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: true,
				expiry_time: 16000,
			},
		);
	});

	it('should retry with absolute epoch expiry if timespan expiry is rejected', async () => {
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('Invalid expiry_time'))
			.mockResolvedValueOnce({ ok: true });

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: true,
				expiry_time: 5000,
			},
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/chats/CT_123_456/stickymessage',
			{
				id: '1700123456789_abc',
				notify: true,
				expiry_time: 1730000000000,
			},
		);
	});

	it('should trigger fallback when api reports invalid timestamp format', async () => {
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('invalid timestamp format'))
			.mockResolvedValueOnce({ ok: true });

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should rethrow non-expiry api errors without fallback retry', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Unauthorized'));

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow('Unauthorized');

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should rethrow expiry-format errors when absolute expiry is unavailable', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'chatId') return 'CT_123_456';
			if (name === 'messageId') return '1700123456789_abc';
			if (name === 'additionalFields') {
				return {
					notify: true,
					expireAt: null,
				};
			}
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('invalid expiry_time format'));

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow('invalid expiry_time format');
	});

	it('should throw combined error when both expiry formats fail', async () => {
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('invalid expiry_time format'))
			.mockRejectedValueOnce(new Error('epoch rejected'));

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow('failed with both expiry formats');
	});

	it('should stringify non-Error primary and fallback failures in combined error', async () => {
		mockZohoCliqApiRequest
			.mockRejectedValueOnce('invalid expiry_time format')
			.mockRejectedValueOnce({ reason: 'epoch rejected' });

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow('primary="invalid expiry_time format"');
	});

	it('should reject unsupported expireAt object values', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'chatId') return 'CT_123_456';
			if (name === 'messageId') return '1700123456789_abc';
			if (name === 'additionalFields') {
				return {
					notify: false,
					expireAt: {
						valueOf: () => 'not-a-number',
					},
				};
			}
			return undefined;
		});

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow(
			'Expire At must be a valid datetime or non-negative epoch timestamp in milliseconds',
		);
	});

	it('should reject expireAt objects without time accessors', async () => {
		const accessorless = Object.create(null) as Record<string, unknown>;
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'chatId') return 'CT_123_456';
			if (name === 'messageId') return '1700123456789_abc';
			if (name === 'additionalFields') {
				return {
					notify: false,
					expireAt: accessorless,
				};
			}
			return undefined;
		});

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow(
			'Expire At must be a valid datetime or non-negative epoch timestamp in milliseconds',
		);
	});

	it('should reject expireAt when it is not in the future', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'chatId') return 'CT_123_456';
			if (name === 'messageId') return '1700123456789_abc';
			if (name === 'additionalFields')
				return { notify: true, expireAt: '2024-10-27T03:33:14.000Z' };
			return undefined;
		});

		await expect(
			pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes),
		).rejects.toThrow('Expire At must be a future datetime');
	});

	it('should trigger fallback when api reports timestamp format wording', async () => {
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('timestamp has invalid format'))
			.mockResolvedValueOnce({ ok: true });

		await pinStickyMessage.execute.call(mockExecuteFunctions, items, pinGrantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it("should return Cliq's standard pin response when enhanced output is disabled", async () => {
		setNodeParameters({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				chat_id: 'CT_123_456',
				message: {
					msguid: '1700123456789%20abc',
				},
			},
		});

		const result = await pinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			pinGrantedScopes,
		);

		expect(result[0].json).toEqual({
			data: {
				chat_id: 'CT_123_456',
				message: {
					msguid: '1700123456789%20abc',
				},
			},
		});
	});

	it('should normalize encoded message ids in pin message output', async () => {
		setNodeParameters({ messageId: '1700123456789%20abc' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				chat_id: 'CT_123_456',
				message: {
					msguid: '1700123456789%20abc',
				},
			},
		});

		const result = await pinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			pinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				message_id: '1700123456789_abc',
				data: {
					chat_id: 'CT_123_456',
					message: {
						msguid: '1700123456789_abc',
					},
				},
			}),
		);
	});

	it('should return a recoverable validation error in AI Error Mode for pin message', async () => {
		setNodeParameters({ messageId: '', enableAiErrorMode: 'true' });

		const result = await pinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			pinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'pinStickyMessage',
				chat_id: 'CT_123_456',
				reason: 'INVALID_MESSAGE_ID',
			}),
		);
	});

	it('should return an updated expiry hint in recoverable AI Error Mode', async () => {
		setNodeParameters({
			additionalFields: { notify: false, expireAt: 'not-a-date' },
			enableAiErrorMode: 'true',
		});

		const result = await pinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			pinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'pinStickyMessage',
				reason: 'INVALID_EXPIRY_TIME',
				hint: 'Use a future date-time or a future epoch timestamp in milliseconds for Expire At, or leave it blank to create a pinned message with no expiry.',
			}),
		);
	});

	it('should return a mapped recoverable API error for pin message', async () => {
		setNodeParameters({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'The request URL is invalid. Please check the URL pattern.',
		});

		const result = await pinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			pinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'pinStickyMessage',
				chat_id: 'CT_123_456',
				message_id: '1700123456789_abc',
				reason: 'CHAT_NOT_FOUND',
				hint: CHAT_NOT_FOUND_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
	});

	it('should unpin a message with enhanced output by default', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				type: 'stickymessage',
				data: {
					message: {
						msguid: '1700123456789%20abc',
					},
				},
			})
			.mockResolvedValueOnce({ ok: true });

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: true,
			operation: 'unpinStickyMessage',
			chat_id: 'CT_123_456',
			unpinned_message_id: '1700123456789_abc',
			ok: true,
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_123_456/stickymessage',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/chats/CT_123_456/stickymessage',
		);
	});

	it("should return Cliq's standard unpin response when enhanced output is disabled", async () => {
		setNodeParameters({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				type: 'stickymessage',
				data: {
					message: {
						msguid: '1700123456789_abc',
					},
				},
			})
			.mockResolvedValueOnce('' as unknown as Record<string, never>);

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should use pinned message id when msguid is unavailable before unpinning', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				type: 'stickymessage',
				data: {
					message: {
						id: '1700123456789_fallback',
					},
				},
			})
			.mockResolvedValueOnce({ ok: true });

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				unpinned_message_id: '1700123456789_fallback',
			}),
		);
	});

	it('should use direct pinned-message data id when nested message ids are unavailable', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				type: 'stickymessage',
				data: {
					id: '1700123456789%20direct',
				},
			})
			.mockResolvedValueOnce({ ok: true });

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				unpinned_message_id: '1700123456789_direct',
			}),
		);
	});

	it('should omit unpinned_message_id when the pinned message prefetch has no object data', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ type: 'stickymessage', data: null })
			.mockResolvedValueOnce({
				ok: true,
			});

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'unpinStickyMessage',
			chat_id: 'CT_123_456',
			ok: true,
		});
	});

	it('should omit unpinned_message_id when pinned-message data has no usable ids', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				type: 'stickymessage',
				data: {
					message: {},
				},
			})
			.mockResolvedValueOnce({ ok: true });

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'unpinStickyMessage',
			chat_id: 'CT_123_456',
			ok: true,
		});
	});

	it('should return a no-pinned recoverable payload for unpin when no pinned message is set in AI Error Mode', async () => {
		setNodeParameters({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({
			type: 'stickymessage',
			data: {},
		});

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual({
			success: false,
			resource: 'chat',
			operation: 'unpinStickyMessage',
			chat_id: 'CT_123_456',
			reason: 'NO_PINNED_MESSAGE',
			message: 'No pinned message is currently set in this chat.',
			hint: 'Verify the chat ID is correct and confirm a pinned message is currently set before trying to unpin it.',
		});
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
			'/api/v2/chats/CT_123_456/stickymessage',
		);
	});

	it('should return a no-pinned recoverable payload for unpin when continue on fail is enabled', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({
			type: 'stickymessage',
			data: {},
		});

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual({
			success: false,
			resource: 'chat',
			operation: 'unpinStickyMessage',
			chat_id: 'CT_123_456',
			reason: 'NO_PINNED_MESSAGE',
			message: 'No pinned message is currently set in this chat.',
			hint: 'Verify the chat ID is correct and confirm a pinned message is currently set before trying to unpin it.',
		});
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
			'/api/v2/chats/CT_123_456/stickymessage',
		);
	});

	it('should throw a clear no-pinned error for unpin when no pinned message is set outside AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			type: 'stickymessage',
			data: {},
		});

		await expect(
			unpinStickyMessage.execute.call(mockExecuteFunctions, items, unpinGrantedScopes),
		).rejects.toThrow('No pinned message is currently set in this chat.');

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return a mapped recoverable API error for unpin message', async () => {
		setNodeParameters({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'The request URL is invalid. Please check the URL pattern.',
		});

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'unpinStickyMessage',
				chat_id: 'CT_123_456',
				reason: 'CHAT_NOT_FOUND',
				hint: CHAT_NOT_FOUND_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
	});

	it('should return INVALID_CHAT_ID guidance for unpin message validation errors', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		setNodeParameters({ chatId: 'bad id with spaces' });

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'unpinStickyMessage',
				chat_id: 'bad id with spaces',
				reason: 'INVALID_CHAT_ID',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return INVALID_CHAT_ID guidance for overly long unpin message chat IDs', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		setNodeParameters({ chatId: `CT_${'1'.repeat(210)}` });

		const result = await unpinStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			unpinGrantedScopes,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'unpinStickyMessage',
				reason: 'INVALID_CHAT_ID',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should get the pinned message', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			type: 'stickymessage',
			data: {
				chat_id: 'CT_123_456',
				message: {
					msguid: '1700123456789%20abc',
				},
			},
		});

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			type: 'stickymessage',
			data: {
				chat_id: 'CT_123_456',
				message: {
					msguid: '1700123456789_abc',
				},
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/stickymessage',
		);
	});

	it('should return an agent-facing no-pinned payload in AI Error Mode for empty pinned message data', async () => {
		setNodeParameters({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ members: [{ user_id: 'U1' }] })
			.mockResolvedValueOnce({
				type: 'stickymessage',
				data: {},
			});

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result[0].json).toEqual({
			success: false,
			resource: 'chat',
			operation: 'getPinnedStickyMessage',
			chat_id: 'CT_123_456',
			reason: 'NO_PINNED_MESSAGE',
			message: 'No pinned message is currently set in this chat.',
			hint: 'Pin a message in this chat before trying to retrieve it.',
		});
	});

	it('should pass through empty pinned message data when AI Error Mode is disabled', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			type: 'stickymessage',
			data: {},
		});

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result[0].json).toEqual({
			type: 'stickymessage',
			data: {},
		});
	});

	it('should preserve a one-item array response for get pinned message', async () => {
		mockZohoCliqApiRequest.mockResolvedValue([
			{
				type: 'stickymessage',
				data: {
					chat_id: 'CT_123_456',
					message: {
						msguid: '1700123456789%20abc',
					},
				},
			},
		] as unknown as Awaited<ReturnType<typeof transport.zohoCliqApiRequest>>);

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result[0].json).toEqual({
			data: [
				{
					type: 'stickymessage',
					data: {
						chat_id: 'CT_123_456',
						message: {
							msguid: '1700123456789_abc',
						},
					},
				},
			],
		});
	});

	it('should return a recoverable mapped API error for get pinned message', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'The request URL is invalid. Please check the URL pattern.',
		});

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'getPinnedStickyMessage',
				reason: 'CHAT_NOT_FOUND',
				chat_id: 'CT_123_456',
				hint: CHAT_NOT_FOUND_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
	});

	it('should return INVALID_CHAT_ID guidance for get pinned message validation errors', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		setNodeParameters({ chatId: 'bad id with spaces' });

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'getPinnedStickyMessage',
				chat_id: 'bad id with spaces',
				reason: 'INVALID_CHAT_ID',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return INVALID_CHAT_ID guidance for overly long get pinned message chat IDs', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		setNodeParameters({ chatId: `CT_${'1'.repeat(210)}` });

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'getPinnedStickyMessage',
				reason: 'INVALID_CHAT_ID',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable validation error in AI Error Mode for get pinned message', async () => {
		setNodeParameters({ chatId: '', enableAiErrorMode: 'true' });

		const result = await getPinnedStickyMessage.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHATS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'getPinnedStickyMessage',
				reason: 'INVALID_CHAT_ID',
			}),
		);
		expect(result[0].json.message).toContain('Chat ID is required');
	});

	it('should throw for missing scope on pin message', async () => {
		const requiredScope = getRequiredScopeForOperation('chat', 'pinStickyMessage');
		let thrownError: unknown;
		try {
			await pinStickyMessage.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		assertMissingScopeError(thrownError, requiredScope);
	});

	it('should throw for missing scope on unpin message', async () => {
		const requiredScope = getRequiredScopeForOperation('chat', 'unpinStickyMessage');
		let thrownError: unknown;
		try {
			await unpinStickyMessage.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		assertMissingScopeError(thrownError, requiredScope);
	});

	it('should throw for missing scope on get pinned message', async () => {
		const requiredScope = getRequiredScopeForOperation('chat', 'getPinnedStickyMessage');
		let thrownError: unknown;
		try {
			await getPinnedStickyMessage.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		assertMissingScopeError(thrownError, requiredScope);
	});
});
