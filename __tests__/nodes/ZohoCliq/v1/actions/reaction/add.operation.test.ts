import type { INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as add from '../../../../../../nodes/ZohoCliq/v1/actions/reaction/add.operation';
import { createReactionTestContext } from './testUtils';

describe('ZohoCliq - Reaction - Add Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	describe('execute', () => {
		it('should add reaction successfully with enhanced output by default', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'custom',
				emojiCode: '👍',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: '',
			});

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						success: true,
						resource: 'reaction',
						operation: 'add',
						chat_id: 'CT_123_456',
						message_id: 'MSG_789',
						emoji_code: '👍',
						data: '',
					},
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123_456/messages/MSG_789/reactions',
				{ emoji_code: '👍' },
			);
		});

		it('should keep pre-escaped message IDs intact in the reaction add endpoint path', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const messageId = '1709038327612%20712605914940';
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId,
				emojiInputMode: 'custom',
				emojiCode: '👍',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: '',
			});

			await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				`/api/v2/chats/CT_123_456/messages/${messageId}/reactions`,
				{ emoji_code: '👍' },
			);
		});

		it("should return Cliq's standard response when enhanced output is disabled", async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'picker',
				emojiShortcode: ':smile:',
				includeEnhancedOutputAdd: false,
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				ok: true,
			});

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						ok: true,
					},
				},
			]);
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
			});

			const requiredScope = getRequiredScopeForOperation('reaction', 'add');
			let thrownError: unknown;
			try {
				await add.execute.call(mockExecuteFunctions, items, grantedScopes);
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
					hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
				}),
			);
		});

		it('should throw error for empty chat ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: '',
			});

			await expect(add.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should return a recoverable scope payload when continueOnFail is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
				},
				{
					continueOnFail: true,
				},
			);

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'add',
						requiredScopes: [SCOPES.REACTION_CREATE],
						missingScopes: [SCOPES.REACTION_CREATE],
					}),
				},
			]);
		});

		it('should return a generic recoverable AI Error Mode payload for API failures when target attribution is unavailable', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'MSG_789',
					emojiInputMode: 'custom',
					emojiCode: '👍',
				},
				{
					nodeParameters: {
						enableAiErrorMode: true,
					},
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue({
				message: 'Request URL is invalid',
				response: {
					status: 404,
					data: {
						message: 'Request URL is invalid',
					},
				},
			});

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'add',
						reason: 'NOT_FOUND',
						hint: 'Verify path/resource identifiers and confirm the target resource exists.',
						message: expect.stringContaining('Request URL is invalid'),
						chat_id: 'CT_123_456',
						message_id: 'MSG_789',
						emoji_code: '👍',
						status_code: 404,
					}),
				},
			]);
		});

		it('should return a generic recoverable payload for short technical errors', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'INVALID_MESSAGE_ID_99999',
					emojiInputMode: 'custom',
					emojiCode: '👍',
				},
				{
					continueOnFail: true,
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Technical error',
				response: {
					status: 400,
				},
			});

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'add',
						reason: 'BAD_REQUEST',
						hint: 'Check required parameters, field formats, and request constraints.',
						chat_id: 'CT_123_456',
						message_id: 'INVALID_MESSAGE_ID_99999',
						emoji_code: '👍',
						status_code: 400,
					}),
				},
			]);
		});

		it('should preserve generic technical target errors from the main add call outside recoverable mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.MESSAGES_READ}`;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'INVALID_MESSAGE_ID_99999',
				emojiInputMode: 'custom',
				emojiCode: '👍',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Technical error',
				response: {
					status: 400,
				},
			});

			await expect(add.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toEqual(
				expect.objectContaining({
					message: 'Technical error',
					reason: 'BAD_REQUEST',
					hint: 'Check required parameters, field formats, and request constraints.',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999/reactions',
				{ emoji_code: '👍' },
			);
		});

		it('should add reaction successfully with curated unicode picker', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'unicodePicker',
				unicodeEmoji: '🤬',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ success: true });

			await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123_456/messages/MSG_789/reactions',
				{ emoji_code: '🤬' },
			);
		});

		it('should reject unknown shortcode in custom mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_CREATE;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'custom',
				emojiCode: ':not-a-known-cliq-shortcode:',
			});

			await expect(add.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should preserve generic missing-target errors from the main add call outside recoverable mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.MESSAGES_READ}`;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'INVALID_MESSAGE_ID_99999',
				emojiInputMode: 'custom',
				emojiCode: '👍',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Request URL is invalid',
				response: {
					status: 404,
					data: {
						message: 'Request URL is invalid',
					},
				},
			});

			await expect(add.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toEqual(
				expect.objectContaining({
					message: 'Request URL is invalid',
					reason: 'NOT_FOUND',
					hint: 'Verify path/resource identifiers and confirm the target resource exists.',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999/reactions',
				{ emoji_code: '👍' },
			);
		});

		it('should preserve shared MESSAGE_NOT_FOUND when preflight proves the target message is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.MESSAGES_READ},${SCOPES.CHATS_READ}`;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'INVALID_MESSAGE_ID_99999',
					emojiInputMode: 'custom',
					emojiCode: '👍',
				},
				{
					continueOnFail: true,
				},
			);

			(mockZohoCliqApiRequest as jest.Mock)
				.mockResolvedValueOnce({
					members: [{ user_id: '123' }],
				})
				.mockRejectedValueOnce({
					message: 'Request URL is invalid',
					response: {
						status: 404,
						data: {
							message: 'Request URL is invalid',
						},
					},
				});

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'add',
						reason: 'MESSAGE_NOT_FOUND',
						hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
						chat_id: 'CT_123_456',
						message_id: 'INVALID_MESSAGE_ID_99999',
						emoji_code: '👍',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		});

		it('should enrich thrown main-call errors with generic reason and hint details outside recoverable mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.MESSAGES_READ}`;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'INVALID_MESSAGE_ID_99999',
				emojiInputMode: 'custom',
				emojiCode: '👍',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Request URL is invalid',
				response: {
					status: 404,
					data: {
						message: 'Request URL is invalid',
					},
				},
			});

			let thrownError: unknown;
			try {
				await add.execute.call(mockExecuteFunctions, items, grantedScopes);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toEqual(
				expect.objectContaining({
					message: 'Request URL is invalid',
					reason: 'NOT_FOUND',
					hint: 'Verify path/resource identifiers and confirm the target resource exists.',
				}),
			);
		});

		it('should return shared MESSAGE_NOT_FOUND guidance when minimal 400 target errors are treated as invalid message targets', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.MESSAGES_READ}`;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'INVALID_MESSAGE_ID_99999',
					emojiInputMode: 'custom',
					emojiCode: '👍',
				},
				{
					continueOnFail: true,
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Technical error',
				response: {
					status: 400,
				},
			});

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'add',
						reason: 'MESSAGE_NOT_FOUND',
						hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
						chat_id: 'CT_123_456',
						message_id: 'INVALID_MESSAGE_ID_99999',
						emoji_code: '👍',
						message: expect.stringContaining(
							'Unable to find Message ID "INVALID_MESSAGE_ID_99999" in Chat ID "CT_123_456"',
						),
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999',
			);
		});

		it('should return shared MESSAGE_NOT_FOUND guidance when message preflight proves the target message is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.MESSAGES_READ}`;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'INVALID_MESSAGE_ID_99999',
					emojiInputMode: 'custom',
					emojiCode: '👍',
				},
				{
					continueOnFail: true,
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'No such message found in this chat.',
				response: {
					status: 400,
					data: {
						message: 'No such message found in this chat.',
					},
				},
			});

			const result = await add.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'add',
						message: expect.stringContaining(
							'Unable to find Message ID "INVALID_MESSAGE_ID_99999" in Chat ID "CT_123_456"',
						),
						reason: 'MESSAGE_NOT_FOUND',
						hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
						chat_id: 'CT_123_456',
						message_id: 'INVALID_MESSAGE_ID_99999',
						emoji_code: '👍',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999',
			);
		});
	});

	describe('description', () => {
		it('should include docs and AI guide notices', () => {
			expect(add.description).toBeDefined();
			expect(Array.isArray(add.description)).toBe(true);
			expect(add.description.some((property) => property.name === 'addReactionDocsNotice')).toBe(
				true,
			);
			expect(
				add.description.some((property) => property.name === 'addReactionAiToolGuideNotice'),
			).toBe(true);
		});
	});
});
