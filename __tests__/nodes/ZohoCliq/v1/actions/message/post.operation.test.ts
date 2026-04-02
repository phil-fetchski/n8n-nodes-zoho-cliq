import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport', () => ({
	zohoCliqApiRequest: jest.fn(),
}));

jest.mock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
	messagePayloadDescription: [],
	resolveBotUniqueNameQueryParam: jest.fn(() => undefined),
	resolveMessagePayload: jest.fn(() => ({ text: 'Hello from test' })),
}));

import * as postOperation from '../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import * as messagePayload from '../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';

describe('Message - Post Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const mockResolveBotUniqueNameQueryParam =
		messagePayload.resolveBotUniqueNameQueryParam as jest.MockedFunction<
			typeof messagePayload.resolveBotUniqueNameQueryParam
		>;
	const mockResolveMessagePayload = messagePayload.resolveMessagePayload as jest.MockedFunction<
		typeof messagePayload.resolveMessagePayload
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		jest.clearAllMocks();
		mockResolveMessagePayload.mockReturnValue({ text: 'Hello from test' });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('__testHelpers.runPostMessageTargetPreflightIfPossible', () => {
		it('should no-op for channel targets when channel lookup context is absent', async () => {
			await expect(
				postOperation.__testHelpers.runPostMessageTargetPreflightIfPossible(
					mockExecuteFunctions,
					0,
					SCOPES.WEBHOOKS_CREATE,
					{ target: 'channel' },
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return undefined for channel unique-name targets when recoverable preflight is active but channel read scope is unavailable', async () => {
			(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
				() => true,
			);

			await expect(
				postOperation.__testHelpers.runPostMessageTargetPreflightIfPossible(
					mockExecuteFunctions,
					0,
					SCOPES.WEBHOOKS_CREATE,
					{
						target: 'channel',
						channelLookup: {
							mode: 'name',
							value: 'engineering-updates',
						},
					},
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should no-op for chat and thread targets when chat lookup id is absent', async () => {
			await expect(
				postOperation.__testHelpers.runPostMessageTargetPreflightIfPossible(
					mockExecuteFunctions,
					0,
					SCOPES.WEBHOOKS_CREATE,
					{ target: 'chat' },
				),
			).resolves.toBeUndefined();
			await expect(
				postOperation.__testHelpers.runPostMessageTargetPreflightIfPossible(
					mockExecuteFunctions,
					0,
					SCOPES.WEBHOOKS_CREATE,
					{ target: 'thread' },
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should no-op for user targets when the target identifier is absent', async () => {
			await expect(
				postOperation.__testHelpers.runPostMessageTargetPreflightIfPossible(
					mockExecuteFunctions,
					0,
					SCOPES.WEBHOOKS_CREATE,
					{ target: 'user' },
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});
	});

	it('should accept plus-address email aliases for user targets', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/buddies/alerts%2Bops%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should preflight fixed user targets in recoverable mode when user-read scope is available', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: '123',
				email_id: 'alerts+ops@example.com',
				display_name: 'Alerts Ops',
			})
			.mockResolvedValueOnce({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/users/alerts%2Bops%40example.com',
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/buddies/alerts%2Bops%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should normalize direct-message email targets to lowercase for case-insensitive preflight matching', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'Alerts+Ops@Example.com';
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: '123',
				email_id: 'alerts+ops@example.com',
				display_name: 'Alerts Ops',
			})
			.mockResolvedValueOnce({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/users/alerts%2Bops%40example.com',
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/buddies/alerts%2Bops%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should support agent-selected user ZUID targets and preflight them in recoverable mode when user-read scope is available', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'user';
			if (paramName === 'agentEmailOrZuid') return '839367970';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ zuid: '839367970', display_name: 'Jane User' })
			.mockResolvedValueOnce({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/users/839367970', {});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/buddies/839367970/message',
			{ text: 'Hello from test' },
		);
	});

	it('should return CHANNEL_NOT_FOUND in recoverable mode when channel preflight confirms the channel is missing', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				paramName: string,
				_itemIndex?: number,
				defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (paramName === 'target') return 'channel';
				if (paramName === 'postAsBot') return false;
				if (paramName === 'messageType') return 'text';
				if (paramName === 'attachComponentPayloads') return false;
				if (paramName === 'optionalFields') return {};
				if (paramName === 'userIds') return '';
				if (paramName === 'broadcast') return false;
				if (paramName === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (paramName === 'channelId') {
					return { mode: 'id', value: 'P1234567890123456789' };
				}
				return defaultValue;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'CHANNEL_NOT_FOUND',
			resource: 'message',
			operation: 'post',
			target: 'channel',
			target_identifier: 'P1234567890123456789',
		});
		expect(String(result[0].json.message)).toContain('No channel found');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/channels/P1234567890123456789',
		);
	});

	it('should return CHAT_NOT_FOUND in recoverable mode when agent-selected chat preflight confirms the chat is missing', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'chat';
			if (paramName === 'agentChatId') return 'CT_2230642524712404875_64396981';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHATS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'CHAT_NOT_FOUND',
			resource: 'message',
			operation: 'post',
			target_selection: 'agentChoice',
			agent_selected_target: 'chat',
			target: 'chat',
			target_identifier: 'CT_2230642524712404875_64396981',
		});
		expect(String(result[0].json.message)).toContain('No chat found');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_2230642524712404875_64396981/members',
			{},
			{},
		);
	});

	it('should require Email ID / ZUID when fixed user target is selected', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return '   ';
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Email ID / ZUID is required');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should fail before posting when the direct-message user preflight scope registry entry is unavailable', async () => {
		jest
			.spyOn(scopeRegistry, 'listAcceptedScopesForConditionalRequirement')
			.mockImplementation((resource, operation, conditionId) => {
				if (
					resource === 'message' &&
					operation === 'post' &&
					conditionId === 'directMessageUserPreflight'
				) {
					return undefined;
				}

				return ['ZohoCliq.Users.READ'];
			});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(
			'Message.post directMessageUserPreflight scope registry entry is missing or empty.',
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should preflight direct-message users in recoverable mode when an accepted alternative user-read scope is granted', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		jest
			.spyOn(scopeRegistry, 'listAcceptedScopesForConditionalRequirement')
			.mockImplementation((resource, operation, conditionId) => {
				if (
					resource === 'message' &&
					operation === 'post' &&
					conditionId === 'directMessageUserPreflight'
				) {
					return [SCOPES.USERS_READ, SCOPES.CHANNELS_READ];
				}

				return ['ZohoCliq.Users.READ'];
			});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: '123',
				email_id: 'alerts+ops@example.com',
				display_name: 'Alerts Ops',
			})
			.mockResolvedValueOnce({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/users/alerts%2Bops%40example.com',
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/buddies/alerts%2Bops%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should preflight direct-message users in recoverable mode when the user-read scope policy has no alternatives', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		jest
			.spyOn(scopeRegistry, 'listAcceptedScopesForConditionalRequirement')
			.mockImplementation((resource, operation, conditionId) => {
				if (
					resource === 'message' &&
					operation === 'post' &&
					conditionId === 'directMessageUserPreflight'
				) {
					return [SCOPES.USERS_READ];
				}

				return ['ZohoCliq.Users.READ'];
			});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: '123',
				email_id: 'alerts+ops@example.com',
				display_name: 'Alerts Ops',
			})
			.mockResolvedValueOnce({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/users/alerts%2Bops%40example.com',
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/buddies/alerts%2Bops%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should return USER_NOT_FOUND in recoverable mode when the direct-message preflight response does not identify the requested user', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: '123', display_name: 'Someone Else' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'USER_NOT_FOUND',
			resource: 'message',
			operation: 'post',
			target: 'user',
			target_identifier: 'alerts+ops@example.com',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return a recoverable generic error when the direct-message preflight rejects with no error object', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValueOnce(undefined);

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'message',
			operation: 'post',
			target: 'user',
			target_identifier: 'alerts+ops@example.com',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should treat message-based direct-message preflight misses as USER_NOT_FOUND even when statusCode is a string', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'User not found',
			statusCode: ' 404 ',
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'USER_NOT_FOUND',
			target_identifier: 'alerts+ops@example.com',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return USER_NOT_FOUND in recoverable mode when direct-message recipient preflight confirms no user', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'missing.user@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'USER_NOT_FOUND',
			resource: 'message',
			operation: 'post',
			target: 'user',
			target_identifier: 'missing.user@example.com',
		});
		expect(String(result[0].json.message)).toContain('No Zoho Cliq user found');
		expect(String(result[0].json.hint)).toContain('Get User or List Users');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return USER_NOT_FOUND when direct-message recipient preflight receives a 400 status', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'missing.user@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Lookup failed',
			response: { status: 400 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'USER_NOT_FOUND',
			resource: 'message',
			operation: 'post',
			target: 'user',
			target_identifier: 'missing.user@example.com',
		});
		expect(String(result[0].json.message)).toContain('No Zoho Cliq user found');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should skip direct-message preflight in recoverable mode when user-read scope is missing', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'missing.user@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/buddies/missing.user%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should proceed to posting to a user when user-read scope is missing and recoverable mode is disabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'missing.user@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/buddies/missing.user%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should return a generic BAD_REQUEST payload when direct-message preflight is skipped and the downstream endpoint rejects the user target', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'missing.user@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'No user found',
			response: { statusCode: 400 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'BAD_REQUEST',
			resource: 'message',
			operation: 'post',
			target: 'user',
			target_identifier: 'missing.user@example.com',
		});
		expect(String(result[0].json.message)).toContain('No user found');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/buddies/missing.user%40example.com/message',
			{ text: 'Hello from test' },
		);
	});

	it('should split composite reply thread_information chat IDs into thread_chat_id and thread_id', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') {
				return {
					field: {
						replyTo: '1773603764498_227899757498',
						syncMessage: true,
					},
				};
			}
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498%20227899757498',
				chat_id: 'CT_2242141513167369284_841692385-T-1424728043674064115',
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: 'CT_2242141513167369284_841692385-T-1424728043674064115',
				thread_chat_id: 'CT_2242141513167369284_841692385',
				thread_id: 'T-1424728043674064115',
			},
		});
	});

	it('should normalize nested bot message_details message_id values', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'bot';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return { field: { syncMessage: true } };
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '55743307,55622727';
			if (paramName === 'botUniqueName') return 'helpdeskbot';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			user_ids: ['55743307', '55622727'],
			message_details: {
				'55622727': {
					chat_id: 'CT_1203304812000146098_55622663-B2',
					message_id: '1773603730994%205063548679730',
				},
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			user_ids: ['55743307', '55622727'],
			message_details: {
				'55622727': {
					chat_id: 'CT_1203304812000146098_55622663-B2',
					message_id: '1773603730994_5063548679730',
				},
			},
		});
	});

	it('should preserve non-object bot message_details entries while normalizing object entries', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'bot';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return { field: { syncMessage: true } };
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '55743307,55622727';
			if (paramName === 'botUniqueName') return 'helpdeskbot';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			user_ids: ['55743307', '55622727'],
			message_details: {
				'55622727': {
					chat_id: 'CT_1203304812000146098_55622663-B2',
					message_id: '1773603730994%205063548679730',
				},
				'55743307': 'delivery pending',
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			user_ids: ['55743307', '55622727'],
			message_details: {
				'55622727': {
					chat_id: 'CT_1203304812000146098_55622663-B2',
					message_id: '1773603730994_5063548679730',
				},
				'55743307': 'delivery pending',
			},
		});
	});

	it('should preserve object bot message_details entries when message_id is present but not a string', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'bot';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return { field: { syncMessage: true } };
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '55743307';
			if (paramName === 'botUniqueName') return 'helpdeskbot';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			user_ids: ['55743307'],
			message_details: {
				'55743307': {
					chat_id: 'CT_1203304812000146098_55622663-B2',
					message_id: 4242,
				},
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			user_ids: ['55743307'],
			message_details: {
				'55743307': {
					chat_id: 'CT_1203304812000146098_55622663-B2',
					message_id: 4242,
				},
			},
		});
	});

	it('should preserve thread_information when the reply chat ID is not composite', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') {
				return {
					field: {
						replyTo: '1773603764498_227899757498',
					},
				};
			}
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: 'CT_2242141513167369284_841692385',
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: 'CT_2242141513167369284_841692385',
			},
		});
	});

	it('should preserve thread_information when parent_message_id is present but not a string', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') {
				return {
					field: {
						replyTo: '1773603764498_227899757498',
						syncMessage: true,
					},
				};
			}
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: 4242,
				chat_id: 'CT_2242141513167369284_841692385-T-1424728043674064115',
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: 4242,
				chat_id: 'CT_2242141513167369284_841692385-T-1424728043674064115',
				thread_chat_id: 'CT_2242141513167369284_841692385',
				thread_id: 'T-1424728043674064115',
			},
		});
	});

	it('should preserve composite-looking thread_information when the suffix is not a valid thread ID', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') {
				return {
					field: {
						replyTo: '1773603764498_227899757498',
					},
				};
			}
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: 'CT_2242141513167369284_841692385-T_invalid_suffix',
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: 'CT_2242141513167369284_841692385-T_invalid_suffix',
			},
		});
	});

	it('should preserve composite-looking thread_information when the thread chat portion is blank after trimming', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') {
				return {
					field: {
						replyTo: '1773603764498_227899757498',
					},
				};
			}
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: '   -T-1424728043674064115',
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: '   -T-1424728043674064115',
			},
		});
	});

	it('should preserve thread_information when chat_id is present but not a string', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') {
				return {
					field: {
						replyTo: '1773603764498_227899757498',
					},
				};
			}
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: 4242,
			},
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			message_id: '1773603764498_227899757499',
			thread_information: {
				parent_message_id: '1773603764498_227899757498',
				chat_id: 4242,
			},
		});
	});

	it('should describe user targets as direct messages from the authenticated user', () => {
		const targetProperty = postOperation.description.find((property) => property.name === 'target');
		const userTargetOption = (
			targetProperty?.options as Array<{ value: string; description?: string }>
		).find((option) => option.value === 'user');

		expect(userTargetOption?.description).toContain('direct message');
		expect(userTargetOption?.description).toContain('authenticated Zoho Cliq user');
	});

	it('should include email and ZUID examples in the agent-selected user identifier description', () => {
		const agentEmailField = postOperation.description.find(
			(property) => property.name === 'agentEmailOrZuid',
		);

		expect(agentEmailField?.description).toContain('Example email: jane@example.com');
		expect(agentEmailField?.description).toContain('Example ZUID: 839367970');
	});

	it('should advertise Users.READ in the user-target docs notice', () => {
		const userDocsNotice = postOperation.description.find(
			(property) => property.name === 'postMessageUserDocsNotice',
		);

		expect(userDocsNotice?.displayName).toContain('ZohoCliq.Webhooks.CREATE');
		expect(userDocsNotice?.displayName).toContain('ZohoCliq.Users.READ');
	});

	it('should advertise Users.READ in the agent-choice docs notice when the target resolves to user', () => {
		const agentChoiceDocsNotice = postOperation.description.find(
			(property) => property.name === 'postMessageAgentChoiceDocsNotice',
		);

		expect(agentChoiceDocsNotice?.displayName).toContain('ZohoCliq.Webhooks.CREATE');
		expect(agentChoiceDocsNotice?.displayName).toContain('ZohoCliq.Users.READ');
	});

	it('should return Advanced (JSON) guidance in recoverable mode when the JSON payload is missing text', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'json';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});
		mockResolveMessagePayload.mockImplementation(() => {
			throw new Error(
				'Advanced (JSON) must include a top-level "text" field. Use a non-empty string for "text".',
			);
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_RAW_JSON_PAYLOAD',
			resource: 'message',
			operation: 'post',
			message_type: 'json',
		});
		expect(String(result[0].json.hint)).toContain('top-level `text` string');
	});

	it('should return thread-specific recoverable guidance when agent-selected thread routing omits Thread ID', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'thread';
			if (paramName === 'agentThreadChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'agentThreadId') return '';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_THREAD_IDENTIFIER',
			resource: 'message',
			operation: 'post',
			target_selection: 'agentChoice',
		});
		expect(String(result[0].json.hint)).toContain('Thread Chat ID plus Thread ID');
	});

	it('should throw THREAD_POST_FAILED when a thread-routed post returns an empty response body', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'thread';
			if (paramName === 'threadChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'threadTargetId') return 'T-1424728043674064115';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toMatchObject({
			code: 'THREAD_POST_FAILED',
			message: expect.stringContaining('empty response for this thread post'),
		});
	});

	it('should return THREAD_POST_FAILED guidance in recoverable mode when a thread-routed post returns an empty response body', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'thread';
			if (paramName === 'threadChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'threadTargetId') return 'T-1424728043674064115';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'THREAD_POST_FAILED',
			resource: 'message',
			operation: 'post',
			target: 'thread',
			target_identifier: 'CT_1234567890_1234567890-T-1424728043674064115',
		});
		expect(String(result[0].json.hint)).toContain('Thread Chat ID and Thread ID');
	});

	it('should throw THREAD_POST_FAILED when an agent-selected thread post returns an empty response body', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'thread';
			if (paramName === 'agentThreadChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'agentThreadId') return 'T-1424728043674064115';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toMatchObject({
			code: 'THREAD_POST_FAILED',
			hint: expect.stringContaining(
				'Verify that the Thread Chat ID and Thread ID are both correct',
			),
		});
	});

	it('should return THREAD_POST_FAILED guidance in recoverable mode when an agent-selected thread post returns an empty response body', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'thread';
			if (paramName === 'agentThreadChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'agentThreadId') return 'T-1424728043674064115';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'THREAD_POST_FAILED',
			resource: 'message',
			operation: 'post',
			target_selection: 'agentChoice',
			agent_selected_target: 'thread',
			target: 'thread',
			target_identifier: 'CT_1234567890_1234567890-T-1424728043674064115',
		});
		expect(String(result[0].json.hint)).toContain('Thread Chat ID and Thread ID');
	});

	it('should throw THREAD_POST_FAILED when chat post-to-thread routing returns an empty response body', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'chat';
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'postToThread') return true;
			if (paramName === 'threadId') return 'T-1424728043674064115';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toMatchObject({
			code: 'THREAD_POST_FAILED',
			description: expect.stringContaining(
				'The thread-routed post to "CT_1234567890_1234567890-T-1424728043674064115" returned an empty response body',
			),
		});
	});

	it('should throw THREAD_POST_FAILED when a thread-routed post gets a generic technical error', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'thread';
			if (paramName === 'threadChatId') return 'CT_2243232129214974797_841692385';
			if (paramName === 'threadTargetId') return 'FAKE_THREAD_ID';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			response: { statusCode: 400 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toMatchObject({
			code: 'THREAD_POST_FAILED',
			message: expect.stringContaining('empty response for this thread post'),
			hint: expect.stringContaining(
				'Verify that the Thread Chat ID and Thread ID are both correct',
			),
			response: { statusCode: 400 },
		});
	});

	it('should preserve a top-level statusCode on THREAD_POST_FAILED when the thread technical error includes one', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'thread';
			if (paramName === 'threadChatId') return 'CT_2243232129214974797_841692385';
			if (paramName === 'threadTargetId') return 'FAKE_THREAD_ID';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			statusCode: 503,
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toMatchObject({
			code: 'THREAD_POST_FAILED',
			statusCode: 503,
		});
	});

	it('should return THREAD_POST_FAILED guidance when a thread-routed post gets a generic technical error in recoverable mode', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'thread';
			if (paramName === 'threadChatId') return 'CT_2243232129214974797_841692385';
			if (paramName === 'threadTargetId') return 'FAKE_THREAD_ID';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			response: { statusCode: 500 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'THREAD_POST_FAILED',
			resource: 'message',
			operation: 'post',
			target: 'thread',
			target_identifier: 'CT_2243232129214974797_841692385-FAKE_THREAD_ID',
		});
		expect(String(result[0].json.hint)).toContain('Thread Chat ID and Thread ID');
	});

	it('should leave preflight technical failures on thread-routed targets as generic recoverable errors', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'thread';
			if (paramName === 'threadChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'threadTargetId') return 'T-1424728043674064115';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockRejectedValue({
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			response: { statusCode: 500 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHATS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'SERVER_ERROR',
			resource: 'message',
			operation: 'post',
			target: 'thread',
			target_identifier: 'CT_1234567890_1234567890-T-1424728043674064115',
		});
		expect(result[0].json).not.toHaveProperty('reason', 'THREAD_POST_FAILED');
		expect(String(result[0].json.message)).toContain('technical error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_1234567890_1234567890/members',
			{},
			{},
		);
	});

	it('should surface the generic API error when a reply_to request gets a generic technical error', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return { field: { replyTo: 'MSG_456789' } };
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: '123',
				email_id: 'alerts+ops@example.com',
				display_name: 'Alerts Ops',
			})
			.mockRejectedValueOnce({
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				response: { statusCode: 400 },
			});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'BAD_REQUEST',
			resource: 'message',
			operation: 'post',
			reply_to: 'MSG_456789',
		});
		expect(String(result[0].json.message)).toContain('technical error');
	});

	it('should surface the generic API error when a reply_to request gets a short technical error', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return { field: { replyTo: 'MSG_456789' } };
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				id: '123',
				email_id: 'alerts+ops@example.com',
				display_name: 'Alerts Ops',
			})
			.mockRejectedValueOnce({
				message: 'Technical error',
				response: { statusCode: 400 },
			});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'BAD_REQUEST',
			resource: 'message',
			operation: 'post',
			reply_to: 'MSG_456789',
		});
		expect(String(result[0].json.message)).toContain('Technical error');
	});

	it('should not map generic technical errors to reply-target guidance when reply_to is absent', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: '123', display_name: 'Alerts Ops' })
			.mockRejectedValueOnce({
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				response: { statusCode: 400 },
			});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'message',
			operation: 'post',
			target: 'user',
			target_identifier: 'alerts+ops@example.com',
		});
		expect(result[0].json).not.toHaveProperty('reason', 'REPLY_TARGET_INVALID');
		expect(result[0].json).not.toHaveProperty('reply_to');
	});

	it('should not map reply-target guidance when reply_to is present but the API error is request-url invalid', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'user';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return { field: { replyTo: 'MSG_456789' } };
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'emailOrZuid') return 'alerts+ops@example.com';
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: '123', display_name: 'Alerts Ops' })
			.mockRejectedValueOnce({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.USERS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'USER_NOT_FOUND',
			resource: 'message',
			operation: 'post',
			reply_to: 'MSG_456789',
		});
		expect(result[0].json).not.toHaveProperty('reason', 'REPLY_TARGET_INVALID');
	});

	it('should reject chat targets whose chat ID does not start with a number or CT_', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'chat';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			if (paramName === 'chatId') return 'P1234567890123456789';
			if (paramName === 'postToThread') return false;
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_CHAT_IDENTIFIER',
			resource: 'message',
			operation: 'post',
			target_selection: 'chat',
			target: 'chat',
			message_type: 'text',
		});
		expect(String(result[0].json.hint)).toContain('must start with a number or `CT_`');
	});

	it('should keep thread-chat validation errors mapped to INVALID_THREAD_IDENTIFIER', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'thread';
			if (paramName === 'agentThreadChatId') return '';
			if (paramName === 'agentThreadId') return 'TH_1234567890';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_THREAD_IDENTIFIER',
			resource: 'message',
			operation: 'post',
			target_selection: 'agentChoice',
		});
		expect(String(result[0].json.hint)).toContain('Thread Chat ID plus Thread ID');
	});

	it('should return a conflicting-target-fields reason when agent-selected routing receives extra identifiers', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'channelId';
			if (paramName === 'agentChannelId') return 'P1234567890123456789';
			if (paramName === 'agentChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'userIds') return '';
			if (paramName === 'broadcast') return false;
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'CONFLICTING_TARGET_FIELDS',
			resource: 'message',
			operation: 'post',
			target_selection: 'agentChoice',
		});
		expect(String(result[0].json.message)).toContain('only the matching target identifier field');
		expect(String(result[0].json.hint)).toContain('selected target family');
	});

	it('should use botUniqueName for fixed bot targets', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'bot';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'botUniqueName') return 'helpdeskbot';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/helpdeskbot/message',
			{ text: 'Hello from test' },
		);
	});

	it('should use agentBotUniqueName for agent-selected bot targets', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'bot';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'agentBotUniqueName') return 'helpdeskbot';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/helpdeskbot/message',
			{ text: 'Hello from test' },
		);
	});

	it('should validate agent-choice Post as Bot using agentBotUniqueName', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'chat';
			if (paramName === 'agentChatId') return 'CT_1234567890_1234567890';
			if (paramName === 'postAsBot') return true;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'agentBotUniqueName') return 'helpdeskbot';
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockResolveBotUniqueNameQueryParam).toHaveBeenCalledWith(mockExecuteFunctions, 0, {
			botUniqueNameFieldName: 'agentBotUniqueName',
			validationContext:
				'Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
		});
	});

	it('should throw a helpful error when agent-selected bot routing omits agentBotUniqueName', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'bot';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'agentBotUniqueName') return '';
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Bot Unique Name is required when Agent Selected Target is "bot".');
	});

	it('should expose Include Enhanced Output as a top-level boolean field', () => {
		const includeEnhancedOutputProperty = postOperation.description.find(
			(property) => property.name === 'includeEnhancedOutput',
		);

		expect(includeEnhancedOutputProperty).toBeDefined();
		expect(includeEnhancedOutputProperty?.type).toBe('boolean');
		expect(includeEnhancedOutputProperty?.default).toBe(true);
	});

	it('should reject non-boolean Include Enhanced Output values', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				paramName: string,
				_itemIndex?: number,
				defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (paramName === 'target') return 'channel';
				if (paramName === 'postAsBot') return false;
				if (paramName === 'includeEnhancedOutput') return 'true';
				if (paramName === 'messageType') return 'text';
				if (paramName === 'attachComponentPayloads') return false;
				if (paramName === 'optionalFields') return {};
				if (paramName === 'broadcast') return false;
				if (paramName === 'userIds') return '';
				if (paramName === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (paramName === 'channelId') {
					return { mode: 'id', value: 'P1234567890123456789' };
				}
				return defaultValue;
			},
		);

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		await expect(
			postOperation.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Invalid includeEnhancedOutput value: must be a boolean');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should append posted_to_channel metadata for fixed channel ID targets when enhanced output is enabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				paramName: string,
				_itemIndex?: number,
				defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (paramName === 'target') return 'channel';
				if (paramName === 'postAsBot') return false;
				if (paramName === 'messageType') return 'text';
				if (paramName === 'attachComponentPayloads') return false;
				if (paramName === 'optionalFields') return {};
				if (paramName === 'broadcast') return false;
				if (paramName === 'userIds') return '';
				if (paramName === 'includeEnhancedOutput') return true;
				if (paramName === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (paramName === 'channelId') {
					return { mode: 'id', value: 'P1234567890123456789' };
				}
				return defaultValue;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ message_id: 'MSG_123456' })
			.mockResolvedValueOnce({
				channel_id: 'P1234567890123456789',
				chat_id: 'CT_1234567890_1234567890',
				unique_name: 'engineering-updates',
				level: 'organization',
			});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'POST',
			'/api/v2/channels/P1234567890123456789/message',
			{ text: 'Hello from test' },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/channels/P1234567890123456789',
		);
		expect(result[0].json).toEqual({
			message_id: 'MSG_123456',
			posted_to_channel: {
				channel_id: 'P1234567890123456789',
				chat_id: 'CT_1234567890_1234567890',
				unique_name: 'engineering-updates',
				level: 'organization',
			},
		});
	});

	it('should reuse the validated channel preflight payload for enhanced output in recoverable mode', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				paramName: string,
				_itemIndex?: number,
				defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (paramName === 'target') return 'channel';
				if (paramName === 'postAsBot') return false;
				if (paramName === 'messageType') return 'text';
				if (paramName === 'attachComponentPayloads') return false;
				if (paramName === 'optionalFields') return {};
				if (paramName === 'broadcast') return false;
				if (paramName === 'userIds') return '';
				if (paramName === 'includeEnhancedOutput') return true;
				if (paramName === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (paramName === 'channelId') {
					return { mode: 'id', value: 'P1234567890123456789' };
				}
				return defaultValue;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				channel_id: 'P1234567890123456789',
				chat_id: 'CT_1234567890_1234567890',
				unique_name: 'engineering-updates',
				level: 'organization',
			})
			.mockResolvedValueOnce({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channels/P1234567890123456789',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/channels/P1234567890123456789/message',
			{ text: 'Hello from test' },
		);
		expect(result[0].json).toEqual({
			message_id: 'MSG_123456',
			posted_to_channel: {
				channel_id: 'P1234567890123456789',
				chat_id: 'CT_1234567890_1234567890',
				unique_name: 'engineering-updates',
				level: 'organization',
			},
		});
	});

	it('should append posted_to_channel metadata for agent-selected channel unique name targets when enhanced output is enabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'channelUniqueName';
			if (paramName === 'agentChannelUniqueName') return 'engineering-updates';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'includeEnhancedOutput') return true;
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ message_id: 'MSG_123456' })
			.mockResolvedValueOnce({
				channel: {
					channel_id: 'P1234567890123456789',
					chat_id: 'CT_1234567890_1234567890',
					unique_name: 'engineering-updates',
					level: 'organization',
				},
			});

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'POST',
			'/api/v2/channelsbyname/engineering-updates/message',
			{ text: 'Hello from test' },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(result[0].json).toEqual({
			message_id: 'MSG_123456',
			posted_to_channel: {
				channel_id: 'P1234567890123456789',
				chat_id: 'CT_1234567890_1234567890',
				unique_name: 'engineering-updates',
				level: 'organization',
			},
		});
	});

	it('should reuse the validated unique-name preflight payload for enhanced output in recoverable mode', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'channelUniqueName';
			if (paramName === 'agentChannelUniqueName') return 'engineering-updates';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'includeEnhancedOutput') return true;
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				channel: {
					channel_id: 'P1234567890123456789',
					chat_id: 'CT_1234567890_1234567890',
					unique_name: 'engineering-updates',
					level: 'organization',
				},
			})
			.mockResolvedValueOnce({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/channelsbyname/engineering-updates/message',
			{ text: 'Hello from test' },
		);
		expect(result[0].json).toEqual({
			message_id: 'MSG_123456',
			posted_to_channel: {
				channel_id: 'P1234567890123456789',
				chat_id: 'CT_1234567890_1234567890',
				unique_name: 'engineering-updates',
				level: 'organization',
			},
		});
	});

	it('should skip the channel lookup when enhanced output is disabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				paramName: string,
				_itemIndex?: number,
				defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (paramName === 'target') return 'channel';
				if (paramName === 'postAsBot') return false;
				if (paramName === 'messageType') return 'text';
				if (paramName === 'attachComponentPayloads') return false;
				if (paramName === 'optionalFields') return {};
				if (paramName === 'broadcast') return false;
				if (paramName === 'userIds') return '';
				if (paramName === 'includeEnhancedOutput') return false;
				if (paramName === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (paramName === 'channelId') {
					return { mode: 'id', value: 'P1234567890123456789' };
				}
				return defaultValue;
			},
		);

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(result[0].json).toEqual({ message_id: 'MSG_123456' });
	});

	it('should fall back to known channel identifiers when channel read scope is unavailable', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'channelUniqueName';
			if (paramName === 'agentChannelUniqueName') return 'engineering-updates';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'includeEnhancedOutput') return true;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ message_id: 'MSG_123456' });

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.WEBHOOKS_CREATE;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(result[0].json).toEqual({
			message_id: 'MSG_123456',
			posted_to_channel: {
				unique_name: 'engineering-updates',
			},
		});
	});

	it('should fall back to known channel identifiers when the channel lookup returns a non-object response', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				paramName: string,
				_itemIndex?: number,
				defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (paramName === 'target') return 'channel';
				if (paramName === 'postAsBot') return false;
				if (paramName === 'messageType') return 'text';
				if (paramName === 'attachComponentPayloads') return false;
				if (paramName === 'optionalFields') return {};
				if (paramName === 'broadcast') return false;
				if (paramName === 'userIds') return '';
				if (paramName === 'includeEnhancedOutput') return true;
				if (paramName === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (paramName === 'channelId') {
					return { mode: 'id', value: 'P1234567890123456789' };
				}
				return defaultValue;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ message_id: 'MSG_123456' })
			.mockResolvedValueOnce('' as unknown as IDataObject);

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/channels/P1234567890123456789',
		);
		expect(result[0].json).toEqual({
			message_id: 'MSG_123456',
			posted_to_channel: {
				channel_id: 'P1234567890123456789',
			},
		});
	});

	it('should fall back to known channel identifiers when the channel lookup request fails', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'target') return 'agentChoice';
			if (paramName === 'agentSelectedTarget') return 'channelUniqueName';
			if (paramName === 'agentChannelUniqueName') return 'engineering-updates';
			if (paramName === 'postAsBot') return false;
			if (paramName === 'messageType') return 'text';
			if (paramName === 'attachComponentPayloads') return false;
			if (paramName === 'optionalFields') return {};
			if (paramName === 'broadcast') return false;
			if (paramName === 'userIds') return '';
			if (paramName === 'includeEnhancedOutput') return true;
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ message_id: 'MSG_123456' })
			.mockRejectedValueOnce(new Error('Lookup failed'));

		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.WEBHOOKS_CREATE},${SCOPES.CHANNELS_READ}`;

		const result = await postOperation.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(result[0].json).toEqual({
			message_id: 'MSG_123456',
			posted_to_channel: {
				unique_name: 'engineering-updates',
			},
		});
	});
});
