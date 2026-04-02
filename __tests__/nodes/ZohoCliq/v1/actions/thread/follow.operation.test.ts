import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import * as follow from '../../../../../../nodes/ZohoCliq/v1/actions/thread/follow.operation';

describe('ZohoCliq - Thread - Follow Operation', () => {
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
		it('should follow thread successfully with enhanced output by default', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'includeEnhancedOutput') return true;
				return undefined;
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue('');

			const result = await follow.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						data: '',
						success: true,
						resource: 'thread',
						operation: 'follow',
						thread_chat_id: 'TH_123',
						following: true,
					},
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/threads/TH_123/follow');
		});

		it('should preflight the thread when recoverable mode is enabled and chat-read scope is also granted', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.CHATS_UPDATE},${SCOPES.CHATS_READ}`;
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'includeEnhancedOutput') return true;
				return undefined;
			});

			(mockZohoCliqApiRequest as jest.Mock)
				.mockResolvedValueOnce({ data: [] })
				.mockResolvedValueOnce('');

			await follow.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest.mock.calls).toEqual([
				['GET', '/api/v2/chats/TH_123/members', {}, {}],
				['POST', '/api/v2/threads/TH_123/follow'],
			]);
		});

		it('should return the raw response when enhanced output is disabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'includeEnhancedOutput') return false;
				return undefined;
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ data: '' });

			const result = await follow.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([{ json: { data: '' } }]);
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'thread';
					if (paramName === 'operation') return 'follow';
					if (paramName === 'threadChatId') return 'TH_123';
					return undefined;
				},
			);

			let thrownError: unknown;
			try {
				await follow.execute.call(mockExecuteFunctions, items, grantedScopes);
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
				operation: 'follow',
				requiredScopes: [SCOPES.CHATS_UPDATE],
				missingScopes: [SCOPES.CHATS_UPDATE],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should throw error for empty thread ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('');

			await expect(follow.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should return THREAD_NOT_FOUND when continueOnFail is enabled and thread preflight proves the ID does not exist', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.CHATS_UPDATE},${SCOPES.CHATS_READ}`;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'includeEnhancedOutput') return true;
				return undefined;
			});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue({
				response: {
					statusCode: 404,
					data: {
						message: 'Request URL is invalid',
					},
				},
			});

			const result = await follow.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'follow',
						thread_chat_id: 'TH_123',
						reason: 'THREAD_NOT_FOUND',
						message: 'The supplied thread chat ID could not be found in Zoho Cliq.',
						hint: 'Use List Threads for Channel or Get Main Message to discover a valid thread chat ID in the authenticated account before retrying.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/TH_123/members',
				{},
				{},
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
					if (paramName === 'operation') return 'follow';
					if (paramName === 'threadChatId') return 'TH_123';
					return undefined;
				},
			);

			const result = await follow.execute.call(mockExecuteFunctions, items, '');

			expect(result).toEqual([
				{
					json: {
						success: false,
						resource: 'thread',
						operation: 'follow',
						requiredScopes: [SCOPES.CHATS_UPDATE],
						missingScopes: [SCOPES.CHATS_UPDATE],
						hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
					},
				},
			]);
		});

		it('should return a fallback recoverable payload when AI Error Mode is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				return undefined;
			});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(undefined);

			const result = await follow.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'follow',
						thread_chat_id: 'TH_123',
						message: 'Unable to follow the thread in Zoho Cliq.',
					}),
				},
			]);
		});
	});

	describe('description', () => {
		it('should have required properties', () => {
			expect(follow.description).toBeDefined();
			expect(Array.isArray(follow.description)).toBe(true);
		});
	});
});
