import type { INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/reaction/get.operation';
import { createReactionTestContext } from './testUtils';

describe('ZohoCliq - Reaction - Get Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	describe('execute', () => {
		it('should get reactions successfully with enhanced output by default', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					'👍': ['1710152648241:802515329:Diana'],
				},
			});

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						success: true,
						resource: 'reaction',
						operation: 'get',
						chat_id: 'CT_123_456',
						message_id: 'MSG_789',
						data: {
							'👍': ['1710152648241:802515329:Diana'],
						},
					},
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_123_456/messages/MSG_789/reactions',
			);
		});

		it('should keep pre-escaped message IDs intact in the reaction get endpoint path', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const messageId = '1709038327612%20712605914940';
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId,
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {},
			});

			await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/CT_123_456/messages/${messageId}/reactions`,
			);
		});

		it("should return Cliq's standard response when enhanced output is disabled", async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
				includeEnhancedOutputGet: false,
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					'👍': ['1710152648241:802515329:Diana'],
				},
			});

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						data: {
							'👍': ['1710152648241:802515329:Diana'],
						},
					},
				},
			]);
		});

		it('should preserve mixed Unicode and shortcode reaction keys exactly as returned', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_2242141513167369284_841692385',
				messageId: '1773680401588_536729820340',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {
					'😃': ['1773681853282:839367970:Philip Schools'],
					':thumbsup:': ['1773681552245:904715551:Jordan Schools'],
				},
			});

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						success: true,
						resource: 'reaction',
						operation: 'get',
						chat_id: 'CT_2242141513167369284_841692385',
						message_id: '1773680401588_536729820340',
						data: {
							'😃': ['1773681853282:839367970:Philip Schools'],
							':thumbsup:': ['1773681552245:904715551:Jordan Schools'],
						},
					},
				},
			]);
		});

		it('should preserve an empty reaction object when no reactions exist', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'MSG_789',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				data: {},
			});

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						success: true,
						resource: 'reaction',
						operation: 'get',
						chat_id: 'CT_123_456',
						message_id: 'MSG_789',
						data: {},
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

			const requiredScope = getRequiredScopeForOperation('reaction', 'get');
			let thrownError: unknown;
			try {
				await get.execute.call(mockExecuteFunctions, items, grantedScopes);
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
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: '',
			});

			await expect(get.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
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

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'get',
						requiredScopes: [SCOPES.REACTION_READ],
						missingScopes: [SCOPES.REACTION_READ],
					}),
				},
			]);
		});

		it('should return a generic recoverable payload for API failures when target attribution is unavailable', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'MSG_789',
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

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'get',
						reason: 'NOT_FOUND',
						hint: 'Verify path/resource identifiers and confirm the target resource exists.',
						message: expect.stringContaining('Request URL is invalid'),
						chat_id: 'CT_123_456',
						message_id: 'MSG_789',
						status_code: 404,
					}),
				},
			]);
		});

		it('should preserve generic endpoint errors outside recoverable mode when target attribution is unavailable', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_READ},${SCOPES.MESSAGES_READ}`;
			const mockExecuteFunctions = createReactionTestContext({
				chatId: 'CT_123_456',
				messageId: 'INVALID_MESSAGE_ID_99999',
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

			await expect(get.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toEqual(
				expect.objectContaining({
					message: 'Request URL is invalid',
					reason: 'NOT_FOUND',
					hint: 'Verify path/resource identifiers and confirm the target resource exists.',
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999/reactions',
			);
		});

		it('should preserve shared MESSAGE_NOT_FOUND when preflight proves the target message is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.REACTION_READ},${SCOPES.MESSAGES_READ},${SCOPES.CHATS_READ}`;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'INVALID_MESSAGE_ID_99999',
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

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'get',
						reason: 'MESSAGE_NOT_FOUND',
						hint: 'Check that the chat ID and message ID belong to the same conversation, then try again.',
						chat_id: 'CT_123_456',
						message_id: 'INVALID_MESSAGE_ID_99999',
					}),
				},
			]);
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
				'/api/v2/chats/CT_123_456/messages/INVALID_MESSAGE_ID_99999',
			);
		});

		it('should return a generic recoverable payload for technical errors in recoverable mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'INVALID_MESSAGE_ID_99999',
				},
				{
					continueOnFail: true,
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				response: {
					status: 400,
				},
			});

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'get',
						reason: 'BAD_REQUEST',
						hint: 'Check required parameters, field formats, and request constraints.',
						chat_id: 'CT_123_456',
						message_id: 'INVALID_MESSAGE_ID_99999',
						status_code: 400,
					}),
				},
			]);
		});

		it('should return the same generic recoverable payload for short technical errors', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.REACTION_READ;
			const mockExecuteFunctions = createReactionTestContext(
				{
					chatId: 'CT_123_456',
					messageId: 'INVALID_MESSAGE_ID_99999',
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

			const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'reaction',
						operation: 'get',
						reason: 'BAD_REQUEST',
						hint: 'Check required parameters, field formats, and request constraints.',
						chat_id: 'CT_123_456',
						message_id: 'INVALID_MESSAGE_ID_99999',
						status_code: 400,
					}),
				},
			]);
		});
	});

	describe('description', () => {
		it('should include docs and AI guide notices', () => {
			expect(get.description).toBeDefined();
			expect(Array.isArray(get.description)).toBe(true);
			expect(get.description.some((property) => property.name === 'getReactionsDocsNotice')).toBe(
				true,
			);
			expect(
				get.description.some((property) => property.name === 'getReactionsAiToolGuideNotice'),
			).toBe(true);
		});
	});
});
