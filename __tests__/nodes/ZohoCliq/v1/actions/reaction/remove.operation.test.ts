import type { INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import * as remove from '../../../../../../nodes/ZohoCliq/v1/actions/reaction/remove.operation';
import { createReactionTestContext } from './testUtils';

describe('ZohoCliq - Reaction - Remove Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const removeGrantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.REACTION_DELETE}`;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	describe('execute', () => {
		it('should remove reaction successfully with enhanced output by default', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'custom',
				emojiCode: '👍',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: '',
			});

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						deleted: true,
						success: true,
						resource: 'reaction',
						operation: 'remove',
						chat_id: 'CT_123_456',
						message_id: 'MSG_789',
						emoji_code: '👍',
						data: '',
					},
				},
			]);
		});

		it('should keep pre-escaped message IDs intact in the reaction remove endpoint path', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
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

			await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'DELETE',
				`/api/v2/chats/CT_123_456/messages/${messageId}/reactions`,
				{ emoji_code: '👍' },
			);
		});

		it("should return Cliq's standard response when enhanced output is disabled", async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'picker',
				emojiShortcode: ':smile:',
				includeEnhancedOutputRemove: false,
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				ok: true,
			});

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						deleted: true,
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

			let thrownError: unknown;
			try {
				await remove.execute.call(mockExecuteFunctions, items, grantedScopes);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toContain('Missing OAuth scope for');
			expect(
				(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
			).toEqual(
				expect.objectContaining({
					requiredScopes: [SCOPES.REACTION_CREATE, SCOPES.REACTION_DELETE],
					missingScopes: [SCOPES.REACTION_CREATE, SCOPES.REACTION_DELETE],
					hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
				}),
			);
		});

		it('should throw error for empty chat ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: '',
			});

			await expect(remove.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should remove reaction successfully with picker shortcode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'picker',
				emojiShortcode: ':smile:',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ success: true });

			await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'DELETE',
				'/api/v2/chats/CT_123_456/messages/MSG_789/reactions',
				{ emoji_code: ':smile:' },
			);
		});

		it('should remove reaction successfully with curated unicode picker', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'unicodePicker',
				unicodeEmoji: '🤬',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ success: true });

			await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'DELETE',
				'/api/v2/chats/CT_123_456/messages/MSG_789/reactions',
				{ emoji_code: '🤬' },
			);
		});

		it('should reject unknown shortcode in custom mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				emojiInputMode: 'custom',
				emojiCode: ':not-a-known-cliq-shortcode:',
			});

			await expect(remove.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should return a generic recoverable payload for API failures when target attribution is unavailable', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = removeGrantedScopes;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'MSG_789',
					emojiInputMode: 'custom',
					emojiCode: '👍',
				},
				{
					continueOnFail: true,
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

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'remove',
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
			const grantedScopes = removeGrantedScopes;
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

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'remove',
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

		it('should preserve generic technical target errors from the main remove call outside recoverable mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.REACTION_DELETE},${SCOPES.MESSAGES_READ}`;
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

			await expect(remove.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toEqual(
				expect.objectContaining({
					message: 'Technical error',
					reason: 'BAD_REQUEST',
					hint: 'Check required parameters, field formats, and request constraints.',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'DELETE',
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999/reactions',
				{ emoji_code: '👍' },
			);
		});

		it('should return a recoverable scope payload when one of the two required scopes is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_DELETE;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
				},
				{
					continueOnFail: true,
				},
			);

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'remove',
						requiredScopes: [SCOPES.REACTION_CREATE, SCOPES.REACTION_DELETE],
						missingScopes: [SCOPES.REACTION_CREATE],
					}),
				},
			]);
		});

		it('should preserve generic missing-target errors from the main remove call outside recoverable mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.REACTION_DELETE},${SCOPES.MESSAGES_READ}`;
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

			await expect(remove.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toEqual(
				expect.objectContaining({
					message: 'Request URL is invalid',
					reason: 'NOT_FOUND',
					hint: 'Verify path/resource identifiers and confirm the target resource exists.',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'DELETE',
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999/reactions',
				{ emoji_code: '👍' },
			);
		});

		it('should preserve shared MESSAGE_NOT_FOUND when preflight proves the target message is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.REACTION_DELETE},${SCOPES.MESSAGES_READ},${SCOPES.CHATS_READ}`;
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

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'remove',
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

		it('should return shared MESSAGE_NOT_FOUND guidance when minimal 400 target errors are treated as invalid message targets', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.REACTION_DELETE},${SCOPES.MESSAGES_READ}`;
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

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'remove',
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
			const grantedScopes = `${SCOPES.REACTION_CREATE},${SCOPES.REACTION_DELETE},${SCOPES.MESSAGES_READ}`;
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

			const result = await remove.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'remove',
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
			expect(remove.description).toBeDefined();
			expect(Array.isArray(remove.description)).toBe(true);
			expect(
				remove.description.some((property) => property.name === 'removeReactionDocsNotice'),
			).toBe(true);
			expect(
				remove.description.some((property) => property.name === 'removeReactionAiToolGuideNotice'),
			).toBe(true);
		});
	});
});
