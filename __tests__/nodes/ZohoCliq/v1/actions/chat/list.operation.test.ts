import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/chat/list.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Chat - List Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const setNodeParameters = (
		values: {
			additionalFields?: Record<string, unknown>;
			simplify?: unknown;
			simplifyMode?: unknown;
			simplifyFields?: unknown;
			enableAiErrorMode?: unknown;
		} = {},
	) => {
		const {
			additionalFields = {},
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
			enableAiErrorMode = false,
		} = values;
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'additionalFields') return additionalFields;
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return enableAiErrorMode;
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
		it('should list chats successfully in raw mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({
				additionalFields: {
					limit: 50,
				},
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				chats: [{ chat_id: 'CT_1' }, { chat_id: 'CT_2' }],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('chats');
			expect(result[0].json.chats).toHaveLength(2);
		});

		it('should return simplified individual items when simplify is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({
				simplify: true,
				simplifyMode: 'simplified',
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				chats: [
					{
						chat_id: 'CT_1',
						name: 'Test Chat',
						chat_type: 'dm',
						participant_count: 2,
						creation_time: '2024-01-01',
						last_modified_time: '2024-01-02',
						creator_id: 'user_1',
						pinned: false,
						removed: false,
						last_message_info: { text: 'Hello', time: 1234 },
						recipients_summary: [{ id: 'user_2' }],
					},
				],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({
				chat_id: 'CT_1',
				name: 'Test Chat',
				chat_type: 'dm',
				participant_count: 2,
				creation_time: '2024-01-01',
				last_modified_time: '2024-01-02',
				creator_id: 'user_1',
				pinned: false,
				removed: false,
				last_message_text: 'Hello',
			});
			expect(result[0].json).not.toHaveProperty('recipients_summary');
		});

		it('should return selected fields when simplifyMode is selectedFields', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({
				simplify: true,
				simplifyMode: 'selectedFields',
				simplifyFields: ['chat_id', 'name', 'chat_type'],
			});

			mockZohoCliqApiRequest.mockResolvedValue({
				chats: [
					{
						chat_id: 'CT_1',
						name: 'Test Chat',
						chat_type: 'dm',
						participant_count: 2,
						pinned: false,
					},
				],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({
				chat_id: 'CT_1',
				name: 'Test Chat',
				chat_type: 'dm',
			});
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';

			const requiredScope = getRequiredScopeForOperation('chat', 'list');
			let thrownError: unknown;
			try {
				await list.execute.call(mockExecuteFunctions, items, grantedScopes);
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

		it('should handle modifiedAfter timestamp', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;
			const timestamp = Date.parse('2024-01-01T00:00:00Z');

			setNodeParameters({ additionalFields: { modifiedAfter: timestamp } });

			mockZohoCliqApiRequest.mockResolvedValue({
				chats: [],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				expect.objectContaining({ modified_after: timestamp }),
			);
		});

		it('should throw error for invalid modifiedAfter timestamp', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({ additionalFields: { modifiedAfter: 'invalid-date' } });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Invalid Modified After timestamp',
			);
		});

		it('should handle modifiedBefore timestamp', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;
			const timestamp = Date.parse('2024-12-31T23:59:59Z');

			setNodeParameters({ additionalFields: { modifiedBefore: timestamp } });

			mockZohoCliqApiRequest.mockResolvedValue({
				chats: [],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				expect.objectContaining({ modified_before: timestamp }),
			);
		});

		it('should throw error for invalid modifiedBefore timestamp', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({ additionalFields: { modifiedBefore: 'invalid-date' } });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Invalid Modified Before timestamp',
			);
		});

		it('should handle drafts parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			setNodeParameters({ additionalFields: { drafts: true } });

			mockZohoCliqApiRequest.mockResolvedValue({
				chats: [],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				expect.objectContaining({ drafts: true }),
			);
		});

		it('should omit blank modifiedAfter values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedAfter: '   ' } });
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/chats', {}, {});
		});

		it('should normalize Date instances for modifiedAfter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const date = new Date('2024-01-01T00:00:00.000Z');
			setNodeParameters({ additionalFields: { modifiedAfter: date } });
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				{ modified_after: date.getTime() },
			);
		});

		it('should keep numeric modifiedBefore values as numeric timestamps', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const timestamp = Date.parse('2024-12-31T23:59:59.000Z');
			setNodeParameters({ additionalFields: { modifiedBefore: timestamp } });
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				{ modified_before: timestamp },
			);
		});

		it('should normalize ISO text values to numeric timestamps', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const timestamp = Date.parse('2025-01-02T03:04:05.000Z');
			setNodeParameters({
				additionalFields: {
					modifiedAfter: '2025-01-02T03:04:05.000Z',
				},
			});
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				{ modified_after: timestamp },
			);
		});

		it('should omit blank toISO values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({
				additionalFields: {
					modifiedAfter: {
						toISO: () => '   ',
					},
				},
			});
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/chats', {}, {});
		});

		it('should omit zero timestamps as an optional sentinel value', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedAfter: 0, modifiedBefore: 0 } });
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/chats', {}, {});
		});

		it('should normalize toMillis date-like objects', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const timestamp = Date.parse('2025-02-03T04:05:06.000Z');
			setNodeParameters({
				additionalFields: {
					modifiedBefore: {
						toMillis: () => timestamp,
					},
				},
			});
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				{ modified_before: timestamp },
			);
		});

		it('should accept numeric-string timestamps and send them as numbers', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const timestamp = Date.parse('2025-02-03T04:05:06.000Z');
			setNodeParameters({ additionalFields: { modifiedBefore: String(timestamp) } });
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				{ modified_before: timestamp },
			);
		});

		it('should accept plus-prefixed numeric-string timestamps and send them as numbers', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const timestamp = Date.parse('2025-02-03T04:05:06.000Z');
			setNodeParameters({ additionalFields: { modifiedBefore: `+${timestamp}` } });
			mockZohoCliqApiRequest.mockResolvedValue({ chats: [] });

			await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats',
				{},
				{ modified_before: timestamp },
			);
		});

		it('should reject negative numeric-string timestamps before Date.parse fallback', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedBefore: '-1' } });

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified Before timestamp');
		});

		it('should reject decimal numeric-string timestamps before Date.parse fallback', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedAfter: '1.5' } });

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified After timestamp');
		});

		it('should reject Modified After later than Modified Before', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({
				additionalFields: {
					modifiedAfter: '2026-01-02T00:00:00Z',
					modifiedBefore: '2026-01-01T00:00:00Z',
				},
			});

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Modified After cannot be later than Modified Before');
		});

		it('should reject invalid Date instances', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedAfter: new Date('bad-date') } });

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified After timestamp');
		});

		it('should reject negative numeric timestamps', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedBefore: -1 } });

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified Before timestamp');
		});

		it('should reject invalid toISO values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({
				additionalFields: {
					modifiedAfter: {
						toISO: () => 'not-a-date',
					},
				},
			});

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified After timestamp');
		});

		it('should reject invalid toMillis values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({
				additionalFields: {
					modifiedBefore: {
						toMillis: () => -1,
					},
				},
			});

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified Before timestamp');
		});

		it('should reject unsupported object datetime values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedAfter: { unsupported: true } } });

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified After timestamp');
		});

		it('should reject array-shaped datetime values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedAfter: [] } });

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified After timestamp');
		});

		it('should trim chats output back to the requested limit if Zoho returns one extra record', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { limit: 5 } });
			mockZohoCliqApiRequest.mockResolvedValue({
				chats: [
					{ chat_id: '1' },
					{ chat_id: '2' },
					{ chat_id: '3' },
					{ chat_id: '4' },
					{ chat_id: '5' },
					{ chat_id: '6' },
				],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/chats', {}, { limit: 5 });
			// In raw mode (simplify=false), returns wrapper as single item
			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('chats');
			expect(
				(result[0].json.chats as Array<{ chat_id: string }>).map((chat) => chat.chat_id),
			).toEqual(['1', '2', '3', '4', '5']);
		});

		it('should leave non-array chats responses unchanged when limit is set', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { limit: 5 } });
			mockZohoCliqApiRequest.mockResolvedValue({
				chats: { chat_id: 'single' },
			});

			const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(result[0].json).toEqual({
				chats: { chat_id: 'single' },
			});
		});

		it('should reject non-object non-string datetime values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({ additionalFields: { modifiedAfter: true } });

			await expect(
				list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ),
			).rejects.toThrow('Invalid Modified After timestamp');
		});

		it('should return a recoverable validation error when continueOnFail is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setNodeParameters({ additionalFields: { limit: 0 } });

			const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					resource: 'chat',
				}),
			);
		});

		it('should return a recoverable validation error in AI Error Mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			setNodeParameters({
				additionalFields: { modifiedAfter: 'invalid-date' },
				enableAiErrorMode: 'true',
			});

			const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_READ);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					resource: 'chat',
				}),
			);
			expect(result[0].json.message).toContain('Invalid Modified After timestamp');
		});
	});

	describe('description', () => {
		it('should include docs and AI guide notices at the bottom', () => {
			const propertyNames = list.description.map((property) => property.name);
			expect(propertyNames.slice(-2)).toEqual([
				'listChatsDocsNotice',
				'listChatsAiToolGuideNotice',
			]);
		});

		it('should use numeric epoch-millisecond fields for modified timestamp filters', () => {
			const additionalFields = list.description.find(
				(property) => property.name === 'additionalFields',
			) as { options?: Array<{ name?: string; type?: string; default?: unknown }> } | undefined;

			const modifiedAfterField = additionalFields?.options?.find(
				(option) => option.name === 'modifiedAfter',
			);
			const modifiedBeforeField = additionalFields?.options?.find(
				(option) => option.name === 'modifiedBefore',
			);

			expect(modifiedAfterField).toEqual(
				expect.objectContaining({
					type: 'number',
					default: 0,
				}),
			);
			expect(modifiedBeforeField).toEqual(
				expect.objectContaining({
					type: 'number',
					default: 0,
				}),
			);
		});

		it('should expose simplify parameters in the description', () => {
			const paramNames = list.description.map((p) => p.name);
			expect(paramNames).toContain('simplify');
			expect(paramNames).toContain('simplifyMode');
			expect(paramNames).toContain('simplifyFields');
		});
	});
});
