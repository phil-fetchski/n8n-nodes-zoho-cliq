import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/thread/list.operation';

describe('ZohoCliq - Thread - List Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	let mockExecuteFunctions: IExecuteFunctions;

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
		it('should list threads successfully with all parameters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: 50, returnAll: false });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				threads: [{ thread_id: 'TH_1' }, { thread_id: 'TH_2' }],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('threads');
			expect((result[0].json as IDataObject).threads).toHaveLength(2);
		});

		it('should preflight the channel ID when recoverable mode is enabled and channel-read scope is granted', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.CHATS_READ},${SCOPES.CHANNELS_READ}`;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({});

			(mockZohoCliqApiRequest as jest.Mock)
				.mockResolvedValueOnce({ id: 'CH_123_456' })
				.mockResolvedValueOnce({ threads: [{ thread_id: 'TH_1' }] });

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest.mock.calls).toEqual([
				['GET', '/api/v2/channels/CH_123_456'],
				['GET', '/api/v2/channels/CH_123_456/threads', {}, {}],
			]);
		});

		it('should skip channel preflight gracefully when recoverable mode is enabled but channel-read scope is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValueOnce({ threads: [] });

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest.mock.calls).toEqual([
				['GET', '/api/v2/channels/CH_123_456/threads', {}, {}],
			]);
		});

		it('should return CHANNEL_NOT_FOUND when shared channel preflight proves the target is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.CHATS_READ},${SCOPES.CHANNELS_READ}`;

			(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			});
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_404')
				.mockReturnValueOnce({});

			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				response: {
					statusCode: 404,
					data: { message: 'Request URL is invalid' },
				},
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'list',
						channel_id: 'CH_404',
						reason: 'CHANNEL_NOT_FOUND',
						hint: 'Use Get Channel or List Channels to confirm the exact channel ID or channel unique name before retrying.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/channels/CH_404');
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'thread';
					if (paramName === 'operation') return 'list';
					if (paramName === 'channelId') return 'CH_123_456';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

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
			).toEqual({
				success: false,
				resource: 'thread',
				operation: 'list',
				requiredScopes: [SCOPES.CHATS_READ],
				missingScopes: [SCOPES.CHATS_READ],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should throw error for empty channel ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('');

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should handle state filter parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456') // channelId
				.mockReturnValueOnce({ state: 'followed' }); // additionalFields

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				threads: [],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				expect.any(Object),
				expect.objectContaining({ state: 'followed' }),
			);
		});

		it('should handle type filter parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456') // channelId
				.mockReturnValueOnce({ type: 'open' }); // additionalFields

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				threads: [],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				expect.any(Object),
				expect.objectContaining({ type: 'open' }),
			);
		});

		it('should split pagination fields into body and filters into query string', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({
					state: 'not_followed',
					type: 'closed',
					limit: 25,
					nextToken: 'token_abc',
				});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ threads: [] });

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				{ limit: 25, next_token: 'token_abc' },
				{
					state: 'not_followed',
					type: 'closed',
					limit: 25,
					next_token: 'token_abc',
				},
			);
		});

		it('should handle nextToken parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456') // channelId
				.mockReturnValueOnce({ nextToken: 'token123' }); // additionalFields

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				threads: [],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				expect.objectContaining({ next_token: 'token123' }),
				expect.any(Object),
			);
		});

		it('should handle syncToken parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ syncToken: 'sync123' });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				threads: [],
			});

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				expect.objectContaining({ sync_token: 'sync123' }),
				expect.objectContaining({ sync_token: 'sync123' }),
			);
		});

		it('should ignore empty nextToken', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456') // channelId
				.mockReturnValueOnce({ nextToken: '   ' }); // additionalFields with whitespace only

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				threads: [],
			});

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			// Should not include next_token in body when empty
			const callArgs = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).not.toHaveProperty('next_token');
		});

		it('should ignore empty syncToken', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ syncToken: '   ' });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				threads: [],
			});

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callArgs = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).not.toHaveProperty('sync_token');
			expect(callArgs[3]).not.toHaveProperty('sync_token');
		});

		it('should throw when nextToken and syncToken are both provided', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ nextToken: 'next123', syncToken: 'sync123' });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Next Token and Sync Token cannot be used together. Provide only one token per request.',
			);
		});

		it('should ignore empty string limit values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: '   ' });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ threads: [] });

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			const callArgs = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[2]).not.toHaveProperty('limit');
			expect(callArgs[3]).not.toHaveProperty('limit');
		});

		it('should include limit when set to lower boundary (1)', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: 1 });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ threads: [] });

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				expect.objectContaining({ limit: 1 }),
				expect.any(Object),
			);
		});

		it('should include limit when set to upper boundary (100)', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: 100 });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ threads: [] });

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				expect.objectContaining({ limit: 100 }),
				expect.any(Object),
			);
		});

		it('should throw for non-whole-number limit values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: 10.5 });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Limit must be a whole number between 1 and 100',
			);
		});

		it('should throw for out-of-range limit values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: 101 });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Limit must be a whole number between 1 and 100',
			);
		});

		it('should throw for lower out-of-range limit values', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: 0 });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Limit must be a whole number between 1 and 100',
			);
		});

		it('should throw for invalid state filter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ state: 'archived' });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				'Invalid Thread State. Must be one of: followed, not_followed, all',
			);
		});

		it('should throw for invalid type filter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ type: 'mine' });

			await expect(list.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				/Invalid Thread Type|open, closed/,
			);
		});

		it('should return per-item error when continueOnFail is enabled and request fails', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(undefined);

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'list',
						channel_id: 'CH_123_456',
						message: 'Unable to list threads for the channel in Zoho Cliq.',
					}),
				},
			]);
		});

		it('should return a recoverable validation payload in AI Error Mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			});
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: 101 });

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'list',
						channel_id: 'CH_123_456',
						message: 'Limit must be a whole number between 1 and 100',
					}),
				},
			]);
		});

		it('should return a recoverable token-conflict payload in AI Error Mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			});
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ nextToken: 'next123', syncToken: 'sync123' });

			const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'list',
						channel_id: 'CH_123_456',
						next_token: 'next123',
						sync_token: 'sync123',
						message:
							'Next Token and Sync Token cannot be used together. Provide only one token per request.',
					}),
				},
			]);
		});

		it('should accept string limit values when valid', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_READ;

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('CH_123_456')
				.mockReturnValueOnce({ limit: ' 25 ' });

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ threads: [] });

			await list.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				expect.any(String),
				expect.objectContaining({ limit: 25 }),
				expect.objectContaining({ limit: 25 }),
			);
		});

		it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'thread';
					if (paramName === 'operation') return 'list';
					if (paramName === 'channelId') return 'CH_123_456';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			const result = await list.execute.call(mockExecuteFunctions, items, '');

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'list',
					}),
				},
			]);
		});
	});

	describe('description', () => {
		it('should have required properties', () => {
			expect(list.description).toBeDefined();
			expect(Array.isArray(list.description)).toBe(true);
		});

		it('should expose docs and AI guide notices at the bottom', () => {
			const names = list.description.map((property) => property.name);
			expect(names.slice(-2)).toEqual(['listThreadsDocsNotice', 'listThreadsAiToolGuideNotice']);
		});
	});
});
