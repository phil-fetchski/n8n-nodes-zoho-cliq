import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as getMembers from '../../../../../../nodes/ZohoCliq/v1/actions/chat/getMembers.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Chat - Get Members Operation', () => {
	const DEFAULT_CHAT_ID = 'CT_123456';
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	let mockExecuteFunctions: IExecuteFunctions;
	const setNodeParameters = (
		values: {
			chatId?: string;
			fields?: string[];
			enableAiErrorMode?: unknown;
		} = {},
	) => {
		const { chatId = DEFAULT_CHAT_ID, fields = ['name', 'email_id', 'user_id'] } = values;
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'chatId') return chatId;
			if (name === 'fields') return fields;
			if (name === 'enableAiErrorMode') return values.enableAiErrorMode ?? false;
			return undefined;
		});
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	describe('execute', () => {
		it('should get chat members successfully', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters();

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				members: [{ user_id: 'U1' }, { user_id: 'U2' }],
			});

			const result = await getMembers.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('members');
		});

		it('should include the requested fields query when a subset is selected', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ fields: ['name', 'email_id'] });
			mockZohoCliqApiRequest.mockResolvedValue({
				members: [{ name: 'User 1', email_id: 'user1@example.com' }],
			});

			await getMembers.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				`/api/v2/chats/${DEFAULT_CHAT_ID}/members`,
				{},
				{ fields: 'name,email_id' },
			);
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';

			setNodeParameters();

			const requiredScope = getRequiredScopeForOperation('chat', 'getMembers');
			let thrownError: unknown;
			try {
				await getMembers.execute.call(mockExecuteFunctions, items, grantedScopes);
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
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({ chatId: '' });

			await expect(
				getMembers.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw error for invalid field name', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({ fields: ['invalid_field'] });

			await expect(
				getMembers.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid field');
		});

		it('should throw error when fields list contains blank entries', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({ fields: ['name', '   '] });

			await expect(
				getMembers.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid field: ""');
		});

		it('should handle empty fields array', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({ fields: [] });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				members: [{ user_id: 'U1' }],
			});

			const result = await getMembers.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			// Should not include fields in query string when empty
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				{},
				{}, // Empty query string
			);
		});

		it('should return a recoverable mapped API error when continueOnFail is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setNodeParameters();
			mockZohoCliqApiRequest.mockRejectedValue({
				statusCode: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
			});

			const result = await getMembers.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'getMembers',
					resource: 'chat',
					reason: 'CHAT_NOT_FOUND',
					chat_id: DEFAULT_CHAT_ID,
				}),
			);
		});

		it('should return a recoverable validation error in AI Error Mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ fields: ['invalid_field'], enableAiErrorMode: 'true' });

			const result = await getMembers.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'getMembers',
					resource: 'chat',
					chat_id: DEFAULT_CHAT_ID,
				}),
			);
			expect(result[0].json.message).toContain('Invalid field');
		});
	});

	describe('description', () => {
		it('should keep chatId as a required string field', () => {
			const chatIdField = getMembers.description.find((property) => property.name === 'chatId');
			expect(chatIdField).toBeDefined();
			expect(chatIdField).toEqual(
				expect.objectContaining({
					name: 'chatId',
					type: 'string',
					required: true,
				}),
			);
			expect(chatIdField?.description).toContain('all-numeric');
			expect(chatIdField?.description).toContain('CT_');
		});

		it('should include docs and AI guide notices at the bottom', () => {
			const propertyNames = getMembers.description.map((property) => property.name);
			expect(propertyNames.slice(-2)).toEqual([
				'getChatMembersDocsNotice',
				'getChatMembersAiToolGuideNotice',
			]);
		});
	});
});
