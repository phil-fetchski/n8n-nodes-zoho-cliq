import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import * as post from '../../../../../../nodes/ZohoCliq/v1/actions/thread/post.operation';
import { createRichMessageParameterMock } from '../shared/testUtils';

describe('ZohoCliq - Thread - Post Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	let mockExecuteFunctions: IExecuteFunctions;
	const setupParameterMock = (params: Record<string, unknown>) => {
		createRichMessageParameterMock(mockExecuteFunctions.getNodeParameter as jest.Mock, params);
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	describe('execute', () => {
		it('should post to thread successfully', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Hello thread!',
				optionalFields: {},
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_123',
				text: 'Hello thread!',
			});

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('message_id', 'MSG_123');
			expect(mockZohoCliqApiRequest.mock.calls).toEqual([
				[
					'POST',
					'/api/v2/chats/TH_123/message',
					expect.objectContaining({
						text: 'Hello thread!',
					}),
				],
			]);
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';

			setupParameterMock({
				resource: 'thread',
				operation: 'post',
				threadChatId: 'TH_123',
			});

			let thrownError: unknown;
			try {
				await post.execute.call(mockExecuteFunctions, items, grantedScopes);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toContain('Missing OAuth scope for');
			expect(
				(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
			).toEqual({
				success: false,
				resource: 'thread',
				operation: 'post',
				requiredScopes: [SCOPES.THREAD_MESSAGES_CREATE],
				missingScopes: [SCOPES.THREAD_MESSAGES_CREATE],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should throw error for empty thread ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: '',
			});

			await expect(post.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for empty text', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: '   ',
				optionalFields: {},
			});

			await expect(post.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Text is required',
			);
		});

		it('should throw error for text exceeding 5000 characters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;
			const longText = 'a'.repeat(5001);

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: longText,
				optionalFields: {},
			});

			await expect(post.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Text message is too long',
			);
		});

		it('should handle replyTo parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Reply text',
				optionalFields: { replyTo: 'MSG_456' },
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_789',
			});

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({ reply_to: 'MSG_456' }),
			);
		});

		it('should ignore empty replyTo', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { replyTo: '   ' },
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_789',
			});

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			const callArgs = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).not.toHaveProperty('reply_to');
		});

		it('should throw when replyTo is not a string', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { replyTo: 12345 },
			});

			await expect(post.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Reply To Message ID must be a string',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should handle syncMessage parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { syncMessage: true },
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_789',
			});

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({ sync_message: true }),
			);
		});

		it('should decode sync_message response message ids before returning them', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { syncMessage: true },
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: '1774046958557%208815399901',
			});

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual({
				message_id: '1774046958557_8815399901',
			});
		});

		it('should handle postInParent parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { postInParent: true },
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_789',
			});

			await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({ post_in_parent: true }),
			);
		});

		it('should throw when syncMessage is not a boolean', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { syncMessage: 'true' },
			});

			await expect(post.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'syncMessage must be a boolean',
			);
		});

		it('should throw when postInParent is not a boolean', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { postInParent: 'yes' },
			});

			await expect(post.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'postInParent must be a boolean',
			);
		});

		it('should parse optional fields from fixedCollection field wrapper', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { field: { replyTo: 'MSG_456', syncMessage: true } },
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_789',
			});

			await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({ reply_to: 'MSG_456', sync_message: true }),
			);
		});

		it('should treat null optionalFields as empty object', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: null,
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ message_id: 'MSG_100' });

			await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/TH_123/message',
				expect.objectContaining({ text: 'Text' }),
			);
		});

		it('should send bot_unique_name as query when posting as bot', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: {},
				postAsBot: true,
				botUniqueName: 'DeployBot',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_200',
			});

			await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			const [, , requestBody] = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(requestBody).not.toHaveProperty('bot');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/TH_123/message',
				expect.objectContaining({ text: 'Text' }),
				{ bot_unique_name: 'DeployBot' },
			);
		});

		it('should post rich message payload', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'rich',
				richMessage: {
					text: 'Rich body',
					cardTitle: 'Card title',
					buttons: {
						button: [
							{
								label: 'Open',
								type: '+',
								actionType: 'open.url',
								actionDataInputMode: 'raw',
								actionData: { url: 'https://example.com' },
							},
						],
					},
				},
				optionalFields: {},
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				message_id: 'MSG_999',
			});

			await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			const [, , requestBody] = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(requestBody).toMatchObject({
				text: 'Rich body',
				card: JSON.stringify({ title: 'Card title' }),
			});
			expect(requestBody).toHaveProperty('buttons', expect.any(String));
		});

		it('should return per-item error when continueOnFail is enabled and request fails', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Hello thread!',
				optionalFields: {},
			});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(undefined);

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'post',
						thread_chat_id: 'TH_123',
						message: 'Unable to post the message to the thread in Zoho Cliq.',
					}),
				},
			]);
		});

		it('should include reply_to in recoverable payload when replyTo was valid', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Hello thread!',
				optionalFields: { replyTo: 'MSG_456' },
			});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('Thread post failed'));

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'post',
						thread_chat_id: 'TH_123',
						reply_to: 'MSG_456',
						message: 'Thread post failed',
					}),
				},
			]);
		});

		it('should return THREAD_NOT_FOUND when thread preflight confirms the thread is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.THREAD_MESSAGES_CREATE},${SCOPES.CHATS_READ}`;

			(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			});
			setupParameterMock({
				threadChatId: 'TH_404',
				messageType: 'text',
				text: 'Hello thread!',
				optionalFields: {},
			});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				response: {
					statusCode: 404,
					data: {
						message: 'Request URL is invalid',
					},
				},
			});

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'post',
						thread_chat_id: 'TH_404',
						reason: 'THREAD_NOT_FOUND',
						message: 'The supplied thread chat ID could not be found in Zoho Cliq.',
						hint: 'Use List Threads for Channel or Get Main Message to discover a valid thread chat ID in the authenticated account before retrying.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/TH_404/members',
				{},
				{},
			);
		});

		it('should return a recoverable validation payload in AI Error Mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.THREAD_MESSAGES_CREATE;

			(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			});
			setupParameterMock({
				threadChatId: 'TH_123',
				messageType: 'text',
				text: 'Text',
				optionalFields: { postInParent: 'yes' },
			});

			const result = await post.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'post',
						thread_chat_id: 'TH_123',
						message: 'postInParent must be a boolean',
					}),
				},
			]);
		});

		it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			setupParameterMock({
				resource: 'thread',
				operation: 'post',
				threadChatId: 'TH_123',
			});

			const result = await post.execute.call(mockExecuteFunctions, items, '');

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'post',
					}),
				},
			]);
		});
	});

	describe('description', () => {
		it('should have required properties', () => {
			expect(post.description).toBeDefined();
			expect(Array.isArray(post.description)).toBe(true);
		});

		it('should expose expression-friendly message payload fields for AI tool setup', () => {
			const textField = post.description.find((property) => property.name === 'text');
			const jsonField = post.description.find((property) => property.name === 'jsonBody');
			const botUniqueNameField = post.description.find(
				(property) => property.name === 'botUniqueName',
			);
			const botDisplayNameField = post.description.find(
				(property) => property.name === 'botDisplayName',
			);
			const botImageField = post.description.find((property) => property.name === 'botImage');
			const markdownNotice = post.description.find(
				(property) => property.name === 'plainTextMarkdownNotice',
			);

			expect(textField?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['post'],
			});
			expect(textField).not.toHaveProperty('displayOptions.show.messageType');

			expect(jsonField?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['post'],
			});
			expect(jsonField).not.toHaveProperty('displayOptions.show.messageType');

			expect(botUniqueNameField?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['post'],
			});
			expect(botUniqueNameField).not.toHaveProperty('displayOptions.show.postAsBot');
			expect(botDisplayNameField).toBeUndefined();
			expect(botImageField).toBeUndefined();

			expect(markdownNotice?.displayOptions?.show).toMatchObject({
				resource: ['thread'],
				operation: ['post'],
				messageType: ['text'],
			});
		});

		it('should expose docs and AI guide notices at the bottom', () => {
			const names = post.description.map((property) => property.name);
			expect(names.slice(-2)).toEqual(['postThreadDocsNotice', 'postThreadAiToolGuideNotice']);
		});
	});
});
