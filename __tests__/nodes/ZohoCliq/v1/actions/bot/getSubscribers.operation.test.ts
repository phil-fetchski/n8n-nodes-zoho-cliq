import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as getSubscribers from '../../../../../../nodes/ZohoCliq/v1/actions/bot/getSubscribers.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Bot - Get Subscribers Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should retrieve bot subscribers successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ appkey: 'abc123', limit: 25, nextToken: 'n1' });
		mockZohoCliqApiRequest.mockResolvedValue({ users: [] });

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/bots/supportbot/subscribers',
			undefined,
			{ appkey: 'abc123', limit: 25, next_token: 'n1' },
		);
	});

	it('should wrap array subscriber payloads under subscribers', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _itemIndex: number, fallback?: unknown) => {
				if (paramName === 'botUniqueName') return 'supportbot';
				if (paramName === 'additionalFields') return {};
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue([
			{ user_id: '123', email: 'user@example.com' },
		] as unknown as IDataObject);

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			subscribers: [{ user_id: '123', email: 'user@example.com' }],
		});
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const requiredScope = getRequiredScopeForOperation('bot', 'getSubscribers');
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'bot';
			if (paramName === 'operation') return 'getSubscribers';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await getSubscribers.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bot',
				operation: 'getSubscribers',
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should throw for invalid bot unique name', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('invalid/name')
			.mockReturnValueOnce({});

		await expect(
			getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Invalid Bot Unique Name format');
	});

	it('should throw for numeric bot unique name', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('fakebot123')
			.mockReturnValueOnce({});

		await expect(
			getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Invalid Bot Unique Name format');
	});

	it('should throw when app key is too long', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ appkey: 'a'.repeat(301) });

		await expect(
			getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('App Key is too long');
	});

	it('should throw for invalid limit', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ limit: 0 });

		await expect(
			getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Limit must be a whole number between 1 and 100');
	});

	it('should omit whitespace-only next token from query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ nextToken: '   ' });
		mockZohoCliqApiRequest.mockResolvedValue({ users: [] });

		await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/bots/supportbot/subscribers',
			undefined,
			{},
		);
	});

	it('should throw when next token is too long', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ nextToken: 'a'.repeat(1025) });

		await expect(
			getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Next Token is too long');
	});

	it('should omit whitespace-only sync token from query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ syncToken: '   ' });
		mockZohoCliqApiRequest.mockResolvedValue({ users: [] });

		await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/bots/supportbot/subscribers',
			undefined,
			{},
		);
	});

	it('should throw when next token and sync token are both provided', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ nextToken: 'next-1', syncToken: 'sync-1' });

		await expect(
			getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Next Token and Sync Token cannot be used together');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw when sync token is too long', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ syncToken: 'a'.repeat(1025) });

		await expect(
			getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Sync Token is too long');
	});

	it('should ignore blank app key and omitted sync token in query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ appkey: '   ', limit: 10, nextToken: 'next-1' });
		mockZohoCliqApiRequest.mockResolvedValue({ users: [] });

		await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/bots/supportbot/subscribers',
			undefined,
			{ limit: 10, next_token: 'next-1' },
		);
	});

	it('should return paired item error when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('invalid/name')
			.mockReturnValueOnce({});

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: expect.stringContaining('Invalid Bot Unique Name format'),
			}),
		);
	});

	it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'bot';
			if (paramName === 'operation') return 'getSubscribers';
			return undefined;
		});

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bot',
				operation: 'getSubscribers',
			}),
		);
	});

	it('should return generic error when continueOnFail is enabled and non-object error is thrown', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockRejectedValue(null);

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'An unexpected issue occurred with the API request',
			}),
		);
	});

	it('should return paired error when both tokens are provided and continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('supportbot')
			.mockReturnValueOnce({ nextToken: 'next-1', syncToken: 'sync-1' });

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message:
					'Next Token and Sync Token cannot be used together. Provide only one token per request.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should map URL-pattern API errors to actionable bot unique name guidance', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('fakebot')
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				data: {
					message: 'The request URL is invalid. Please check the URL pattern.',
				},
			},
		});

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'INVALID_BOT_UNIQUE_NAME',
				bot_unique_name: 'fakebot',
			}),
		);
		expect(String(result[0].json.message)).not.toContain('URL');
	});

	it('should return recoverable bot guidance when only AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.BOTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: 'true' },
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _index: number, fallback?: unknown) => {
				if (paramName === 'enableAiErrorMode') return 'true';
				if (paramName === 'botUniqueName') return 'fakebot';
				if (paramName === 'additionalFields') return {};
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				data: {
					message: 'The request URL is invalid. Please check the URL pattern.',
				},
			},
		});

		const result = await getSubscribers.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'bot',
				operation: 'getSubscribers',
				reason: 'INVALID_BOT_UNIQUE_NAME',
				bot_unique_name: 'fakebot',
			}),
		);
	});
});
