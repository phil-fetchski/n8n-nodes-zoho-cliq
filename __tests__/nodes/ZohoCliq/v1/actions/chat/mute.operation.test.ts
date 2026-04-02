import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as mute from '../../../../../../nodes/ZohoCliq/v1/actions/chat/mute.operation';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Chat - Mute Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const muteGrantedScopes = `${SCOPES.CHATS_UPDATE},${SCOPES.CHATS_READ}`;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			chatId?: string;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			chatId = 'CT_123_456',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'chatId') return chatId;
				if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);
	});

	it('should return enhanced output by default', async () => {
		const context = createContext();

		const result = await mute.execute.call(context, items, muteGrantedScopes);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'mute',
			chat_id: 'CT_123_456',
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/chats/CT_123_456/mute');
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });

		const result = await mute.execute.call(context, items, muteGrantedScopes);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ chatId: '   ', continueOnFail: true });

		const result = await mute.execute.call(context, items, SCOPES.CHATS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'mute',
				reason: 'INVALID_CHAT_ID',
				hint: 'Verify chat ID format and confirm the chat exists before muting it.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a mapped recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'The request URL is invalid. Please check the URL pattern.',
		});

		const result = await mute.execute.call(context, items, muteGrantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'mute',
				chat_id: 'CT_123_456',
				reason: 'CHAT_NOT_FOUND',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
	});

	it('should reject channel-like IDs before calling the mute API', async () => {
		const context = createContext({ chatId: 'P1234567890' });

		await expect(mute.execute.call(context, items, SCOPES.CHATS_UPDATE)).rejects.toThrow(
			'This operation requires a chat ID, but the provided identifier looks like a channel ID.',
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable channel-id error in AI Error Mode for mute', async () => {
		const context = createContext({ chatId: 'O1234567890', enableAiErrorMode: 'true' });

		const result = await mute.execute.call(context, items, SCOPES.CHATS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'chat',
				operation: 'mute',
				chat_id: 'O1234567890',
				reason: 'CHANNEL_ID_DETECTED',
				message:
					'This operation requires a chat ID. The supplied identifier looks like a channel ID, so the mute request was not sent.',
				hint: expect.stringContaining('Every channel also has its own chat ID'),
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('chat', 'mute');

		let thrownError: unknown;
		try {
			await mute.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

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
	});

	it('should throw a chat-read permission error when mute preflight scopes are missing', async () => {
		const context = createContext();

		let thrownError: unknown;
		try {
			await mute.execute.call(context, items, SCOPES.CHATS_UPDATE);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toBe(
			'Mute Chat also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before muting this conversation.',
		);
		expect(thrownError).toMatchObject({
			code: 'CHAT_LOOKUP_SCOPE_REQUIRED',
			description:
				'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			zohoCliqScopeErrorPayload: expect.objectContaining({
				requiredScopes: expect.arrayContaining([SCOPES.CHATS_UPDATE, SCOPES.CHATS_READ]),
				missingScopes: expect.arrayContaining([SCOPES.CHATS_READ]),
			}),
		});
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should fail fast when the mute preflight scope registry entry is unavailable', async () => {
		jest
			.spyOn(scopeRegistry, 'listAcceptedScopesForConditionalRequirement')
			.mockImplementation((resource, operation, condition) => {
				if (resource === 'chat' && operation === 'mute' && condition === 'chatLookupPreflight') {
					return undefined;
				}

				return ['ZohoCliq.Chats.READ'];
			});

		await expect(mute.execute.call(createContext(), items, SCOPES.CHATS_UPDATE)).rejects.toThrow(
			'Chat.mute chatLookupPreflight scope registry entry is missing or empty.',
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(mute.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'muteChatDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'muteChatAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
