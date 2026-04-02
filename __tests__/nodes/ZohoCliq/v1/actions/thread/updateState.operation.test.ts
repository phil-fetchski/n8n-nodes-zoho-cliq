import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import * as updateState from '../../../../../../nodes/ZohoCliq/v1/actions/thread/updateState.operation';

describe('ZohoCliq - Thread - Update State Operation', () => {
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
		it('should update thread state successfully with enhanced output by default', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return {};
				return undefined;
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue('');

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						data: '',
						updated: true,
						success: true,
						resource: 'thread',
						operation: 'updateState',
						thread_chat_id: 'TH_123',
						action: 'close',
						thread_state: 'closed',
					},
				},
			]);
			expect(mockZohoCliqApiRequest.mock.calls).toEqual([
				['PUT', '/api/v2/threads/TH_123', { action: 'close' }],
			]);
		});

		it('should default additionalFields to an empty object when the parameter is null', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return false;
				if (name === 'additionalFields') return null;
				return undefined;
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ data: '' });

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/threads/TH_123', {
				action: 'close',
			});
			expect(result).toEqual([{ json: { updated: true, data: '' } }]);
		});

		it('should pass bot_unique_name and appkey query params when provided', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return false;
				if (name === 'additionalFields') {
					return { botUniqueName: 'deploybot', appKey: 'ext_123' };
				}
				return undefined;
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ data: '' });

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'PUT',
				'/api/v2/threads/TH_123',
				{ action: 'close' },
				{ bot_unique_name: 'deploybot', appkey: 'ext_123' },
			);
			expect(result).toEqual([{ json: { updated: true, data: '' } }]);
		});

		it('should include bot context in enhanced output for a reopen action', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'reopen';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') {
					return { botUniqueName: 'deploybot', appKey: 'ext_123' };
				}
				return undefined;
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue('');

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						data: '',
						updated: true,
						success: true,
						resource: 'thread',
						operation: 'updateState',
						thread_chat_id: 'TH_123',
						action: 'reopen',
						thread_state: 'open',
						bot_unique_name: 'deploybot',
						appkey: 'ext_123',
					},
				},
			]);
		});

		it('should throw when appKey is provided without botUniqueName', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return { appKey: 'ext_123' };
				return undefined;
			});

			await expect(
				updateState.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('App Key can only be used when Bot Unique Name is provided');
		});

		it('should omit a whitespace-only appKey', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') {
					return { botUniqueName: 'deploybot', appKey: '   ' };
				}
				return undefined;
			});
			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue('');

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'PUT',
				'/api/v2/threads/TH_123',
				{ action: 'close' },
				{ bot_unique_name: 'deploybot' },
			);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					thread_chat_id: 'TH_123',
					action: 'close',
					thread_state: 'closed',
					bot_unique_name: 'deploybot',
				}),
			);
		});

		it('should throw for invalid bot unique name format when uppercase letters are used', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return { botUniqueName: 'DeployBot' };
				return undefined;
			});

			await expect(
				updateState.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(
				'Bot Unique Name must use lowercase letters only (a-z), with no numbers, spaces, or special characters',
			);
		});

		it('should throw for invalid bot unique name format when punctuation is used', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return { botUniqueName: 'deploy-bot' };
				return undefined;
			});

			await expect(
				updateState.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(
				'Bot Unique Name must use lowercase letters only (a-z), with no numbers, spaces, or special characters',
			);
		});

		it('should throw for bot unique name longer than 30 characters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return { botUniqueName: 'a'.repeat(31) };
				return undefined;
			});

			await expect(
				updateState.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Bot Unique Name is too long. Maximum length is 30 characters.');
		});

		it('should throw for app key longer than 300 characters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') {
					return { botUniqueName: 'deploybot', appKey: 'a'.repeat(301) };
				}
				return undefined;
			});

			await expect(
				updateState.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('App Key is too long');
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'thread';
					if (paramName === 'operation') return 'updateState';
					if (paramName === 'threadChatId') return 'TH_123';
					if (paramName === 'action') return 'close';
					if (paramName === 'includeEnhancedOutput') return true;
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			let thrownError: unknown;
			try {
				await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);
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
				operation: 'updateState',
				requiredScopes: [SCOPES.CHATS_UPDATE],
				missingScopes: [SCOPES.CHATS_UPDATE],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		});

		it('should throw error for empty thread ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return '';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return {};
				return undefined;
			});

			await expect(
				updateState.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);
		});

		it('should return a mapped recoverable payload when continueOnFail is enabled for invalid bot configuration', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return { botUniqueName: 'DeployBot' };
				return undefined;
			});

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'updateState',
						thread_chat_id: 'TH_123',
						action: 'close',
						bot_unique_name: 'DeployBot',
						reason: 'INVALID_BOT_UNIQUE_NAME',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return THREAD_NOT_FOUND when read preflight confirms the thread is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = `${SCOPES.CHATS_UPDATE},${SCOPES.CHATS_READ}`;

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_404';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return {};
				return undefined;
			});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				response: {
					statusCode: 404,
					data: {
						message: 'Request URL is invalid',
					},
				},
			});

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'updateState',
						thread_chat_id: 'TH_404',
						action: 'close',
						reason: 'THREAD_NOT_FOUND',
						message: 'The supplied thread chat ID could not be found in Zoho Cliq.',
						hint: 'Use List Threads for Channel or Get Main Message to discover a valid thread chat ID in the authenticated account before retrying.',
					}),
				},
			]);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		});

		it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];

			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'thread';
					if (paramName === 'operation') return 'updateState';
					if (paramName === 'threadChatId') return 'TH_123';
					if (paramName === 'action') return 'close';
					if (paramName === 'includeEnhancedOutput') return true;
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			const result = await updateState.execute.call(mockExecuteFunctions, items, '');

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'updateState',
					}),
				},
			]);
		});

		it('should return a fallback recoverable payload when AI Error Mode is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.CHATS_UPDATE;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'threadChatId') return 'TH_123';
				if (name === 'action') return 'close';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'additionalFields') return {};
				if (name === 'enableAiErrorMode') return true;
				return undefined;
			});
			(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(undefined);

			const result = await updateState.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'thread',
						operation: 'updateState',
						thread_chat_id: 'TH_123',
						action: 'close',
						message: 'Unable to update the thread state in Zoho Cliq.',
					}),
				},
			]);
		});
	});

	describe('description', () => {
		it('should have required properties', () => {
			expect(updateState.description).toBeDefined();
			expect(Array.isArray(updateState.description)).toBe(true);
		});
	});
});
