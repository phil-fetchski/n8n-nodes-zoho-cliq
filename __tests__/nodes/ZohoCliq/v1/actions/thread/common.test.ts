import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import {
	extractThreadUserIdsForContext,
	hasThreadNotFoundCode,
	isThreadAiErrorModeEnabled,
	normalizeThreadResponseMessageIds,
	pushThreadRecoverableError,
	resolveThreadEnhancedOutput,
	THREAD_NOT_FOUND_MESSAGE,
	USER_IDS_NOT_FOUND_MESSAGE,
} from '../../../../../../nodes/ZohoCliq/v1/actions/thread/common';
import {
	lookupThreadExhaustively,
	runThreadLookupPreflightGate,
	runThreadUsersPreflightGate,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

async function preflightThreadLookupIfPossible(
	context: IExecuteFunctions,
	threadChatId: string,
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	if (!threadChatId) {
		return;
	}

	await runThreadLookupPreflightGate(context, itemIndex, grantedScopes, threadChatId);
}

describe('ZohoCliq - Thread - Common Helpers', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const buildContext = (
		continueOnFail = false,
		enableAiErrorMode: unknown = false,
	): IExecuteFunctions =>
		({
			continueOnFail: continueOnFail ? jest.fn(() => true) : undefined,
			getNodeParameter: jest.fn((name: string) => {
				if (name === 'enableAiErrorMode') {
					return enableAiErrorMode;
				}

				return undefined;
			}),
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		}) as unknown as IExecuteFunctions;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should treat string AI Error Mode values as enabled', () => {
		expect(isThreadAiErrorModeEnabled(buildContext(false, 'true'), 0)).toBe(true);
		expect(isThreadAiErrorModeEnabled(buildContext(false, 'TRUE'), 0)).toBe(true);
	});

	it('should fall back to node parameters when getNodeParameter throws', () => {
		const context = buildContext(false, false);
		(context.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('parameter hidden');
		});
		(context.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: 'true' },
		});

		expect(isThreadAiErrorModeEnabled(context, 0)).toBe(true);
	});

	it('should return false when AI Error Mode is disabled', () => {
		expect(isThreadAiErrorModeEnabled(buildContext(false, false), 0)).toBe(false);
	});

	it('should return false when getNode is not a function', () => {
		const context = buildContext(false, false) as unknown as {
			getNode?: unknown;
			getNodeParameter: jest.Mock;
		};
		context.getNodeParameter.mockReturnValue(undefined);
		delete context.getNode;

		expect(isThreadAiErrorModeEnabled(context as unknown as IExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode throws during fallback', () => {
		const context = buildContext(false, false);
		(context.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('parameter hidden');
		});
		(context.getNode as jest.Mock).mockImplementation(() => {
			throw new Error('node unavailable');
		});

		expect(isThreadAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when getNode fallback returns undefined', () => {
		const context = buildContext(false, false);
		(context.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('parameter hidden');
		});
		(context.getNode as jest.Mock).mockReturnValue(undefined);

		expect(isThreadAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when recoverable mode is disabled', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushThreadRecoverableError(
			buildContext(false, false),
			returnData,
			0,
			'create',
			new Error('No recovery'),
		);

		expect(result).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should preserve scope payloads in recoverable mode', () => {
		const returnData: INodeExecutionData[] = [];
		const context = buildContext(true, false);
		const result = pushThreadRecoverableError(context, returnData, 0, 'create', {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'thread',
				operation: 'create',
			},
		});

		expect(result).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'create',
				}),
			},
		]);
	});

	it('should build shared recoverable payloads with context fields', () => {
		const returnData: INodeExecutionData[] = [];
		const context = buildContext(false, 'true');
		const error = {
			response: {
				statusCode: 404,
				data: {
					message: 'Thread not found',
				},
			},
		};

		const result = pushThreadRecoverableError(context, returnData, 0, 'getMainMessage', error, {
			contextFields: {
				thread_chat_id: 'CT_123-T-456',
			},
			fallbackMessage: 'Unable to get the thread main message in Zoho Cliq.',
		});

		expect(result).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining<IDataObject>({
					success: false,
					resource: 'thread',
					operation: 'getMainMessage',
					thread_chat_id: 'CT_123-T-456',
					message: 'Thread not found',
					status_code: 404,
					status_class: '4xx',
					reason: 'NOT_FOUND',
					hint: 'Verify path/resource identifiers and confirm the target resource exists.',
				}),
			},
		]);
	});

	it('should extract user ids from comma-separated strings and arrays', () => {
		expect(extractThreadUserIdsForContext(' user_1 , user_2 ,, user_3 ')).toEqual([
			'user_1',
			'user_2',
			'user_3',
		]);
		expect(extractThreadUserIdsForContext([' user_1 ', 'user_2', '  '])).toEqual([
			'user_1',
			'user_2',
		]);
		expect(extractThreadUserIdsForContext(['   '])).toBeUndefined();
		expect(extractThreadUserIdsForContext({ user_ids: ['user_1'] })).toBeUndefined();
	});

	it('should detect THREAD_NOT_FOUND by error code without relying on message text', () => {
		expect(
			hasThreadNotFoundCode({
				code: 'THREAD_NOT_FOUND',
				message: 'Lookup failed before returning the canonical thread message.',
			}),
		).toBe(true);
		expect(
			hasThreadNotFoundCode({
				code: 'NOT_FOUND',
				message: THREAD_NOT_FOUND_MESSAGE,
			}),
		).toBe(false);
		expect(hasThreadNotFoundCode('THREAD_NOT_FOUND')).toBe(false);
	});

	it('should skip thread preflight when no compatible read scope is granted', async () => {
		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_123-T-456',
				0,
				SCOPES.CHATS_UPDATE,
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip thread preflight when thread chat ID is empty', async () => {
		await expect(
			preflightThreadLookupIfPossible(buildContext(true, false), '', 0, SCOPES.CHATS_READ),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should use shared chat-members lookup for thread preflight when chat-read scope is available', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_123-T-456',
				0,
				`${SCOPES.CHATS_UPDATE},${SCOPES.CHATS_READ}`,
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123-T-456/members',
			{},
			{},
		);
	});

	it('should use the same shared chat-members lookup even when additional thread read scopes are granted', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_123-T-456',
				0,
				`${SCOPES.CHATS_READ},${SCOPES.MESSAGES_READ}`,
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest.mock.calls).toEqual([
			['GET', '/api/v2/chats/CT_123-T-456/members', {}, {}],
		]);
	});

	it('should throw a normalized thread-not-found error when shared chat-members preflight proves the thread is missing', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				statusCode: 404,
				data: {
					message: 'Request URL is invalid',
				},
			},
		});

		await expect(async () => {
			try {
				await preflightThreadLookupIfPossible(
					buildContext(true, false),
					'CT_404-T-456',
					0,
					SCOPES.CHATS_READ,
				);
			} catch (error) {
				expect(error).toMatchObject({
					code: 'THREAD_NOT_FOUND',
					message: expect.stringContaining(THREAD_NOT_FOUND_MESSAGE),
				});
				expect(
					(
						error as NodeOperationError & {
							zohoCliqPreflight?: { evidence?: string };
						}
					).zohoCliqPreflight?.evidence,
				).toBe(
					'Zoho Cliq did not confirm the supplied thread chat ID as an existing thread in the authenticated account during the available verification checks.',
				);
				expect(
					(
						error as NodeOperationError & {
							zohoCliqPreflight?: { evidence?: string };
						}
					).zohoCliqPreflight?.evidence,
				).not.toContain('/api/v2/chats/');
				throw error;
			}
		}).rejects.toBeInstanceOf(NodeOperationError);

		expect(mockZohoCliqApiRequest.mock.calls).toEqual([
			['GET', '/api/v2/chats/CT_404-T-456/members', {}, {}],
		]);
	});

	it('should wrap inconclusive shared chat lookup failures in the thread-specific lookup error', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('temporary chat-members issue'));

		await expect(
			lookupThreadExhaustively(buildContext(true, false), 0, SCOPES.CHATS_READ, {
				identifier: 'CT_123-T-456',
			}),
		).rejects.toThrow(
			'The thread preflight failed before Zoho Cliq could verify the supplied thread chat ID.',
		);
	});

	it('should normalize thread-not-found preflight errors that expose only a top-level statusCode', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Request URL is invalid',
		});

		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_404-T-457',
				0,
				SCOPES.CHATS_READ,
			),
		).rejects.toMatchObject({
			code: 'THREAD_NOT_FOUND',
			message: expect.stringContaining(THREAD_NOT_FOUND_MESSAGE),
		});
	});

	it('should normalize thread-not-found preflight errors that expose only a top-level httpCode', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			httpCode: 404,
			message: 'Request URL is invalid',
		});

		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_404-T-459',
				0,
				SCOPES.CHATS_READ,
			),
		).rejects.toMatchObject({
			code: 'THREAD_NOT_FOUND',
			message: expect.stringContaining(THREAD_NOT_FOUND_MESSAGE),
		});
	});

	it('should normalize thread-not-found preflight errors that expose response.status only', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				status: 404,
				data: {
					message: 'Chat not found',
				},
			},
		});

		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_404-T-458',
				0,
				SCOPES.CHATS_READ,
			),
		).rejects.toMatchObject({
			code: 'THREAD_NOT_FOUND',
			message: expect.stringContaining(THREAD_NOT_FOUND_MESSAGE),
		});
	});

	it('should normalize thread-not-found preflight errors that provide only a not-found message', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Chat not found'));

		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_404-T-460',
				0,
				SCOPES.CHATS_READ,
			),
		).rejects.toMatchObject({
			code: 'THREAD_NOT_FOUND',
			message: expect.stringContaining(THREAD_NOT_FOUND_MESSAGE),
		});
	});

	it('should normalize thread-not-found preflight errors when the lookup rejects with a plain string', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce('invalid chat id');

		await expect(
			preflightThreadLookupIfPossible(
				buildContext(true, false),
				'CT_404-T-461',
				0,
				SCOPES.CHATS_READ,
			),
		).rejects.toMatchObject({
			code: 'THREAD_NOT_FOUND',
			message: expect.stringContaining(THREAD_NOT_FOUND_MESSAGE),
		});
	});

	it('should skip user validation preflight when no user-read scope is granted', async () => {
		await expect(
			runThreadUsersPreflightGate(buildContext(false, false), ['15067889'], 0, SCOPES.CHATS_UPDATE),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should no-op when thread user identifiers normalize to an empty list', async () => {
		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['', ''], 0, SCOPES.USERS_READ),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should no-op when thread user identifiers are provided as a non-array value', async () => {
		await expect(
			runThreadUsersPreflightGate(
				buildContext(false, true),
				'not-an-array' as unknown as string[],
				0,
				SCOPES.USERS_READ,
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should resolve thread user validation when the users list contains all requested IDs', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [
				{ id: '15067889', email_id: 'alpha@example.com' },
				{ user_id: '15068981', email_id: 'beta@example.com' },
			],
			has_more: false,
		});

		await expect(
			runThreadUsersPreflightGate(
				buildContext(false, true),
				['15067889', '15068981'],
				0,
				SCOPES.USERS_READ,
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			{
				limit: 100,
				fields: 'display_name',
			},
		);
	});

	it('should resolve thread user validation when the users payload is nested under data.users', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				users: [{ id: '15067889', email_id: 'alpha@example.com' }],
				has_more: false,
			},
		});

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).resolves.toBeUndefined();
	});

	it('should exhaust nested data.users pagination metadata and throw missing user IDs when nested has_more is false', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				users: [{ id: '15060000', email_id: 'alpha@example.com' }],
				has_more: false,
			},
		});

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).rejects.toMatchObject({
			message: `${USER_IDS_NOT_FOUND_MESSAGE} Missing user IDs: ["15067889"].`,
		});
	});

	it('should resolve thread user validation when the users payload is exposed as response.users', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [{ id: '15067889', email_id: 'alpha@example.com' }],
			has_more: false,
		});

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).resolves.toBeUndefined();
	});

	it('should throw missing user IDs after exhausting the users list preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ id: '15067889', email_id: 'alpha@example.com' }],
			has_more: false,
		});

		let thrownError: unknown;
		try {
			await runThreadUsersPreflightGate(
				buildContext(false, true),
				['15067889', '15068981'],
				0,
				SCOPES.USERS_READ,
			);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toBe(
			`${USER_IDS_NOT_FOUND_MESSAGE} Missing user IDs: ["15068981"].`,
		);
	});

	it('should throw when the active user preflight request fails', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce(
			new Error('users endpoint temporarily unavailable'),
		);

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).rejects.toThrow(
			'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
		);
	});

	it('should throw when the users endpoint returns a non-object payload during an active preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce('' as unknown as IDataObject);

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).rejects.toThrow(
			'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
		);
	});

	it('should throw when the users endpoint omits recognizable user arrays during an active preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				members: [{ id: '15067889' }],
			},
		});

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).rejects.toThrow(
			'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
		);
	});

	it('should throw when the users endpoint repeats the same next token during an active preflight', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: [{ id: '15060000' }],
				next_token: 123,
			})
			.mockResolvedValueOnce({
				data: [{ id: '15060001' }],
				next_token: 123,
			});

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).rejects.toThrow('repeated next_token "123"');
	});

	it('should throw when the users endpoint reports has_more without a reusable token during an active preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ id: '15060000' }],
			has_more: true,
		});

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).rejects.toThrow('reported more results without returning a next_token');
	});

	it('should throw when a full page has no next token or has_more hint during an active preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: Array.from({ length: 100 }, (_, index) => ({ id: `1506${index}` })),
		});

		await expect(
			runThreadUsersPreflightGate(buildContext(false, true), ['15067889'], 0, SCOPES.USERS_READ),
		).rejects.toThrow(
			'could not confirm exhaustive pagination because Zoho Cliq returned a full page without next_token or has_more=false',
		);
	});

	it('should fall back to empty accepted-scope lists when the scope registry does not define thread helpers', async () => {
		jest.resetModules();
		const isolatedTransportCall = jest.fn();

		jest.doMock('../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry', () => ({
			listAcceptedScopesForOperation: jest.fn(() => undefined),
		}));
		jest.doMock('../../../../../../nodes/ZohoCliq/v1/transport', () => ({
			zohoCliqApiRequest: { call: isolatedTransportCall },
		}));

		let isolatedThreadPreflight: typeof import('../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/thread');
		await jest.isolateModulesAsync(async () => {
			isolatedThreadPreflight =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/thread');
		});

		await expect(
			isolatedThreadPreflight!.runThreadLookupPreflightGate(
				buildContext(true, false),
				0,
				SCOPES.CHATS_READ,
				'CT_123-T-456',
			),
		).resolves.toEqual({
			reason: 'scope_unavailable',
			status: 'skipped',
		});
		await expect(
			isolatedThreadPreflight!.runThreadUsersPreflightGate(
				buildContext(true, false),
				['15067889'],
				0,
				SCOPES.USERS_READ,
			),
		).resolves.toBeUndefined();

		expect(isolatedTransportCall).not.toHaveBeenCalled();
		jest.dontMock('../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry');
		jest.dontMock('../../../../../../nodes/ZohoCliq/v1/transport');
		jest.resetModules();
	});

	it('should resolve thread enhanced output from minimal API responses', () => {
		const context = buildContext(false, false);
		(context.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'includeEnhancedOutput') {
				return true;
			}
			if (name === 'enableAiErrorMode') {
				return false;
			}
			return undefined;
		});

		expect(resolveThreadEnhancedOutput(context, 0, '', true)).toEqual({
			includeEnhancedOutput: true,
			rawResponse: { data: '' },
			responseJson: { data: '' },
		});
	});

	it('should ignore non-object scope payloads in recoverable mode', () => {
		const returnData: INodeExecutionData[] = [];
		const context = buildContext(true, false);

		const result = pushThreadRecoverableError(context, returnData, 0, 'create', {
			zohoCliqScopeErrorPayload: ['invalid'],
			message: 'Fallback error',
		});

		expect(result).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'create',
					message: 'Fallback error',
				}),
			},
		]);
	});

	it('should ignore truthy string scope payloads in recoverable mode', () => {
		const returnData: INodeExecutionData[] = [];
		const context = buildContext(true, false);

		const result = pushThreadRecoverableError(context, returnData, 0, 'create', {
			zohoCliqScopeErrorPayload: 'invalid-scope-payload',
			message: 'String fallback error',
		});

		expect(result).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'create',
					message: 'String fallback error',
				}),
			},
		]);
	});

	it('should use the default includeEnhancedOutput fallback when the parameter is not set', () => {
		const context = buildContext(false, false);

		expect(resolveThreadEnhancedOutput(context, 0, 'plain text')).toEqual({
			includeEnhancedOutput: false,
			rawResponse: { data: 'plain text' },
			responseJson: { data: 'plain text' },
		});
	});

	it('should normalize encoded thread response message ids recursively', () => {
		expect(
			normalizeThreadResponseMessageIds([
				{
					id: '1773676805202%20412172172370',
					thread_message: {
						id: '1774046958557%208815399901',
						msguid: '1774046958557%208815399901',
						lmsguid: '1774046948326%204520422374',
					},
					thread_information: {
						thread_message_id: '1773676805202%20412172172370',
					},
					sender: {
						id: '839367970',
					},
				},
			]),
		).toEqual([
			{
				id: '1773676805202_412172172370',
				thread_message: {
					id: '1774046958557_8815399901',
					msguid: '1774046958557_8815399901',
					lmsguid: '1774046948326_4520422374',
				},
				thread_information: {
					thread_message_id: '1773676805202_412172172370',
				},
				sender: {
					id: '839367970',
				},
			},
		]);
	});

	it('should normalize encoded thread message ids in enhanced output responses', () => {
		const context = buildContext(false, false);
		(context.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'includeEnhancedOutput') {
				return true;
			}
			if (name === 'enableAiErrorMode') {
				return false;
			}
			return undefined;
		});

		expect(
			resolveThreadEnhancedOutput(context, 0, {
				message_id: '1772612422798%20209244327054',
				thread_information: {
					thread_message_id: '1773676805202%20412172172370',
				},
			}),
		).toEqual({
			includeEnhancedOutput: true,
			rawResponse: {
				message_id: '1772612422798_209244327054',
				thread_information: {
					thread_message_id: '1773676805202_412172172370',
				},
			},
			responseJson: {
				message_id: '1772612422798_209244327054',
				thread_information: {
					thread_message_id: '1773676805202_412172172370',
				},
			},
		});
	});

	it('should preserve blank trimmed message ids and non-string primitive fields', () => {
		expect(
			normalizeThreadResponseMessageIds({
				message_id: '   ',
				is_read: false,
				revision: 2,
				thread_information: {
					message_count: 3,
				},
			}),
		).toEqual({
			message_id: '',
			is_read: false,
			revision: 2,
			thread_information: {
				message_count: 3,
			},
		});
	});

	it('should normalize encoded ids for msg-shaped thread message objects', () => {
		expect(
			normalizeThreadResponseMessageIds({
				msg: 'Latest reply in thread',
				id: '1774046958557%208815399901',
			}),
		).toEqual({
			msg: 'Latest reply in thread',
			id: '1774046958557_8815399901',
		});
	});

	it('should normalize encoded ids for content-shaped thread message objects', () => {
		expect(
			normalizeThreadResponseMessageIds({
				content: {
					text: 'Original parent message',
				},
				id: '1773676805202%20412172172370',
			}),
		).toEqual({
			content: {
				text: 'Original parent message',
			},
			id: '1773676805202_412172172370',
		});
	});

	it('should normalize encoded ids for thread-information-only message containers', () => {
		expect(
			normalizeThreadResponseMessageIds({
				id: '1773676805202%20412172172370',
				thread_information: {
					thread_message_id: '1773676805202%20412172172370',
				},
			}),
		).toEqual({
			id: '1773676805202_412172172370',
			thread_information: {
				thread_message_id: '1773676805202_412172172370',
			},
		});
	});

	it('should normalize plus-encoded ids for message-like containers', () => {
		expect(
			normalizeThreadResponseMessageIds({
				content: {
					text: 'Original parent message',
				},
				id: '1773676805202+412172172370',
			}),
		).toEqual({
			content: {
				text: 'Original parent message',
			},
			id: '1773676805202_412172172370',
		});
	});

	it('should fall back to trimmed output when percent-decoding a thread message id fails', () => {
		expect(
			normalizeThreadResponseMessageIds({
				thread_message: {
					msguid: '1774046958557%ZZ8815399901',
				},
			}),
		).toEqual({
			thread_message: {
				msguid: '1774046958557%ZZ8815399901',
			},
		});
	});

	it('should build a fallback recoverable payload when the error is undefined', () => {
		const returnData: INodeExecutionData[] = [];
		const context = buildContext(true, false);

		const result = pushThreadRecoverableError(context, returnData, 0, 'create', undefined, {
			fallbackMessage: 'Undefined fallback error',
		});

		expect(result).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'create',
					message: 'Undefined fallback error',
				}),
			},
		]);
	});
});
