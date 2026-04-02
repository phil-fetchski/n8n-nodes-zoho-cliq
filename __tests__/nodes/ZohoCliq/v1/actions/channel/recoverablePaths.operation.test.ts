import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';

import * as addMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addMembers.operation';
import * as addBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addBot.operation';
import * as archive from '../../../../../../nodes/ZohoCliq/v1/actions/channel/archive.operation';
import * as changePermission from '../../../../../../nodes/ZohoCliq/v1/actions/channel/changePermission.operation';
import * as changeRole from '../../../../../../nodes/ZohoCliq/v1/actions/channel/changeRole.operation';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/channel/create.operation';
import * as channelDelete from '../../../../../../nodes/ZohoCliq/v1/actions/channel/delete.operation';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/channel/get.operation';
import * as getMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/getMembers.operation';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/channel/list.operation';
import * as removeBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeBot.operation';
import * as removeMember from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeMember.operation';
import * as removeMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeMembers.operation';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/channel/update.operation';
import * as approve from '../../../../../../nodes/ZohoCliq/v1/actions/channel/approve.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Channel - Recoverable paths', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const channelIdValue = 'CT_1';

	const buildContext = (
		getter: (name: string, options?: { extractValue?: boolean }) => unknown,
		contextOptions: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions =>
		({
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex?: number,
					_fallback?: unknown,
					queryOptions?: { extractValue?: boolean },
				) => {
					if (name === 'enableAiErrorMode') {
						return contextOptions.enableAiErrorMode ?? _fallback;
					}
					return getter(name, queryOptions);
				},
			),
			continueOnFail: jest.fn(() => contextOptions.continueOnFail ?? true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		}) as unknown as IExecuteFunctions;

	const withChannelIdContext = (overrides: Record<string, unknown> = {}): IExecuteFunctions =>
		buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return channelIdValue;
			if (name === 'channelId') return channelIdValue;
			return overrides[name];
		});

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
		mockZohoCliqApiRequest.mockResolvedValue({});
	});

	it('should return recoverable error for list validation failure', async () => {
		const context = buildContext((name) => {
			if (name === 'level') return '';
			if (name === 'status') return '';
			if (name === 'joined') return false;
			if (name === 'pinned') return false;
			if (name === 'additionalFields') return { limit: 0 };
			return undefined;
		});

		const result = await list.execute.call(context, items, SCOPES.CHANNELS_READ);
		expect(result[0].json).toEqual(expect.objectContaining({ success: false, operation: 'list' }));
	});

	it('should return recoverable scope payload for get/getMembers', async () => {
		const context = buildContext((name, options) => {
			if (name === 'resource') return 'channel';
			if (name === 'operation') return 'get';
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			return undefined;
		});
		const getResult = await get.execute.call(context, items, '');
		expect(getResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'get' }),
		);

		(context.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'resource') return 'channel';
				if (name === 'operation') return 'getMembers';
				if (name === 'channelId' && options?.extractValue) return 'CT_1';
				if (name === 'channelId') return 'CT_1';
				return undefined;
			},
		);
		const membersResult = await getMembers.execute.call(context, items, '');
		expect(membersResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'getMembers' }),
		);
	});

	it('should return recoverable validation errors for create and update', async () => {
		const createContext = buildContext((name) => {
			if (name === 'channelName') return '';
			if (name === 'channelLevel') return 'private';
			if (name === 'configInputMode') return 'none';
			if (name === 'additionalFields') return {};
			return undefined;
		});
		const createResult = await create.execute.call(createContext, items, SCOPES.CHANNELS_CREATE);
		expect(createResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'create' }),
		);

		const updateContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'updateFields') return {};
			return undefined;
		});
		const updateResult = await update.execute.call(updateContext, items, SCOPES.CHANNELS_UPDATE);
		expect(updateResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'update' }),
		);
	});

	it('should keep create request-url failures on the generic BAD_REQUEST recoverable path', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'The request URL is invalid. Please check the URL pattern.',
		});

		const createContext = buildContext(
			(name) => {
				if (name === 'channelName') return 'Engineering Updates';
				if (name === 'channelLevel') return 'private';
				if (name === 'configInputMode') return 'none';
				if (name === 'additionalFields') return {};
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);

		const createResult = await create.execute.call(createContext, items, SCOPES.CHANNELS_CREATE);

		expect(createResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'create',
				channel_name: 'Engineering Updates',
				reason: 'BAD_REQUEST',
				status_code: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
				hint: 'Verify the create-channel inputs and retry. Start with the required fields only, then add optional fields incrementally to isolate the invalid value.',
			}),
		);
	});

	it('should keep list request-url failures on the generic BAD_REQUEST recoverable path', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'The request URL is invalid. Please check the URL pattern.',
		});

		const listContext = buildContext(
			(name) => {
				if (name === 'level') return '';
				if (name === 'status') return '';
				if (name === 'joined') return '';
				if (name === 'pinned') return false;
				if (name === 'additionalFields') return { limit: 50 };
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);

		const listResult = await list.execute.call(listContext, items, SCOPES.CHANNELS_READ);

		expect(listResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				reason: 'BAD_REQUEST',
				status_code: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
				hint: 'Retry with minimal filters first (for example only limit), then add filters incrementally to isolate the invalid input.',
			}),
		);
	});

	it('should preserve next-token guidance for technical list failures', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const listContext = buildContext(
			(name) => {
				if (name === 'level') return '';
				if (name === 'status') return '';
				if (name === 'joined') return '';
				if (name === 'pinned') return false;
				if (name === 'additionalFields')
					return {
						limit: 50,
						next_token: 'next_token_123',
					};
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);

		const listResult = await list.execute.call(listContext, items, SCOPES.CHANNELS_READ);

		expect(listResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				reason: 'BAD_REQUEST',
				status_code: 400,
				hint: 'Next Token appears invalid or expired. Re-run the first page without Next Token and reuse the new next_token exactly as returned.',
			}),
		);
	});

	it('should return recoverable validation errors for member mutation operations', async () => {
		const addMembersContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'memberIdentifiers') return '   ';
			return undefined;
		});
		const addResult = await addMembers.execute.call(
			addMembersContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(addResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'addMembers' }),
		);

		const removeMembersContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'memberIdentifiers') return '   ';
			if (name === 'silent') return false;
			return undefined;
		});
		const removeResult = await removeMembers.execute.call(
			removeMembersContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(removeResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'removeMembers' }),
		);

		const removeMemberContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'memberIdentifier') return '   ';
			return undefined;
		});
		const removeSingleResult = await removeMember.execute.call(
			removeMemberContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(removeSingleResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'removeMember' }),
		);

		const addMembersNoContextContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return '   ';
			if (name === 'channelId') return '   ';
			if (name === 'memberIdentifiers') return 'user@example.com';
			return undefined;
		});
		const addNoContextResult = await addMembers.execute.call(
			addMembersNoContextContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(addNoContextResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'addMembers' }),
		);

		const removeMembersNoContextContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return '   ';
			if (name === 'channelId') return '   ';
			if (name === 'memberIdentifiers') return 'user@example.com';
			if (name === 'silent') return false;
			return undefined;
		});
		const removeNoContextResult = await removeMembers.execute.call(
			removeMembersNoContextContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(removeNoContextResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'removeMembers' }),
		);
	});

	it('should return recoverable validation errors for five channel mutation operations when only AI Error Mode is enabled', async () => {
		const addBotContext = buildContext(
			(name, queryOptions) => {
				if (name === 'botUniqueName') return 'statusbot1';
				if (name === 'channelId' && queryOptions?.extractValue) return 'CT_1';
				if (name === 'channelId') return { mode: 'id', value: 'CT_1' };
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);
		const addBotResult = await addBot.execute.call(addBotContext, items, SCOPES.CHANNELS_UPDATE);
		expect(addBotResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'addBot' }),
		);

		const addMembersContext = buildContext(
			(name, queryOptions) => {
				if (name === 'channelId' && queryOptions?.extractValue) return 'CT_1';
				if (name === 'channelId') return 'CT_1';
				if (name === 'memberIdentifiers') return '   ';
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);
		const addMembersResult = await addMembers.execute.call(
			addMembersContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(addMembersResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'addMembers' }),
		);

		const removeBotContext = buildContext(
			(name, queryOptions) => {
				if (name === 'channelId' && queryOptions?.extractValue) return 'CT_1';
				if (name === 'channelId') return 'CT_1';
				if (name === 'botId') return '   ';
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);
		const removeBotResult = await removeBot.execute.call(
			removeBotContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(removeBotResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'removeBot' }),
		);

		const removeMemberContext = buildContext(
			(name, queryOptions) => {
				if (name === 'channelId' && queryOptions?.extractValue) return 'CT_1';
				if (name === 'channelId') return 'CT_1';
				if (name === 'memberIdentifier') return '   ';
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);
		const removeMemberResult = await removeMember.execute.call(
			removeMemberContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(removeMemberResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'removeMember' }),
		);

		const removeMembersContext = buildContext(
			(name, queryOptions) => {
				if (name === 'channelId' && queryOptions?.extractValue) return 'CT_1';
				if (name === 'channelId') return 'CT_1';
				if (name === 'memberIdentifiers') return '   ';
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);
		const removeMembersResult = await removeMembers.execute.call(
			removeMembersContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(removeMembersResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'removeMembers' }),
		);
	});

	it('should return recoverable validation errors for role/permission/bot operations', async () => {
		const removeBotContext = buildContext((name) => {
			if (name === 'channelId') return 'CT_1';
			if (name === 'botId') return '   ';
			return undefined;
		});
		const removeBotResult = await removeBot.execute.call(
			removeBotContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(removeBotResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'removeBot' }),
		);

		const roleContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'memberId') return 'user-1';
			if (name === 'role') return 'not-valid';
			return undefined;
		});
		const roleResult = await changeRole.execute.call(roleContext, items, SCOPES.CHANNELS_UPDATE);
		expect(roleResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'changeRole' }),
		);

		const permissionContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'adminInputMode' || name === 'moderatorInputMode' || name === 'memberInputMode')
				return 'structured';
			if (
				name === 'adminPermission' ||
				name === 'moderatorPermission' ||
				name === 'memberPermission'
			)
				return {};
			return undefined;
		});
		const permissionResult = await changePermission.execute.call(
			permissionContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(permissionResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'changePermission' }),
		);

		const addBotContext = buildContext((name, options) => {
			if (name === 'botUniqueName') return 'bad bot';
			if (name === 'channelId' && options?.extractValue) return '';
			if (name === 'channelId') return { mode: 'name', value: '' };
			return undefined;
		});
		const addBotResult = await addBot.execute.call(addBotContext, items, SCOPES.CHANNELS_UPDATE);
		expect(addBotResult[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'addBot' }),
		);
	});

	it('should return actionable recoverable mapping for generic addBot 400 errors', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		const addBotContext = buildContext((name, options) => {
			if (name === 'botUniqueName') return 'statusbot';
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return { mode: 'id', value: 'CT_1' };
			return undefined;
		});
		const addBotResult = await addBot.execute.call(addBotContext, items, SCOPES.CHANNELS_UPDATE);

		expect(addBotResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'addBot',
				reason: 'BOT_ASSOCIATION_BAD_REQUEST',
				message:
					'Zoho Cliq rejected this add-bot request with a 400 error. Check bot/channel identifiers and whether the bot is already a channel member.',
			}),
		);
	});

	it('should return actionable recoverable mapping for malformed permission JSON', async () => {
		const malformedPermissionContext = withChannelIdContext({
			adminInputMode: 'raw',
			moderatorInputMode: 'structured',
			memberInputMode: 'structured',
			adminPermissionJson: '{"send_message":',
			moderatorPermission: {},
			memberPermission: {},
		});

		const result = await changePermission.execute.call(
			malformedPermissionContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'changePermission',
				reason: 'INVALID_PERMISSION_JSON',
				hint: 'Ensure the permission value is a valid JSON object, for example {"send_message": true}.',
			}),
		);
	});

	it('should return the shared CHANNEL_NOT_FOUND contract when delete preflight confirms a missing channel', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				statusCode: 404,
				data: { message: 'Request URL is invalid' },
			},
		});

		const deleteContext = withChannelIdContext();
		const deleteResult = await channelDelete.execute.call(
			deleteContext,
			items,
			`${SCOPES.CHANNELS_DELETE},${SCOPES.CHANNELS_READ}`,
		);

		expect(deleteResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'delete',
				reason: 'CHANNEL_NOT_FOUND',
				channel_id: channelIdValue,
				message: 'No channel found for Channel ID "CT_1".',
			}),
		);
	});

	it('should return the shared CHANNEL_NOT_FOUND contract in AI Error Mode when approve preflight confirms a missing channel', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				statusCode: 404,
				data: { message: 'Request URL is invalid' },
			},
		});

		const approveContext = buildContext(
			(name, options) => {
				if (name === 'channelId' && options?.extractValue) return 'CT_1';
				if (name === 'channelId') return 'CT_1';
				return undefined;
			},
			{ continueOnFail: false, enableAiErrorMode: 'true' },
		);
		const approveResult = await approve.execute.call(
			approveContext,
			items,
			`${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`,
		);

		expect(approveResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'approve',
				reason: 'CHANNEL_NOT_FOUND',
				channel_id: channelIdValue,
			}),
		);
	});

	it('should skip channel preflight when the lookup scope is unavailable and keep the generic recoverable path', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		const archiveContext = withChannelIdContext();
		const archiveResult = await archive.execute.call(archiveContext, items, SCOPES.CHANNELS_UPDATE);

		expect(archiveResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'archive',
				reason: 'CHANNEL_RESOURCE_UNIDENTIFIED',
				channel_id: channelIdValue,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels/CT_1/archive');
	});

	it('should keep the generic CHANNEL_RESOURCE_UNIDENTIFIED mapping for delete without lookup scope', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		const deleteContext = withChannelIdContext();
		const deleteResult = await channelDelete.execute.call(
			deleteContext,
			items,
			SCOPES.CHANNELS_DELETE,
		);

		expect(deleteResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'delete',
				reason: 'CHANNEL_RESOURCE_UNIDENTIFIED',
				channel_id: channelIdValue,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/channels/CT_1');
	});

	it('should surface generic API failures after a validated channel preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ channel_id: 'CT_1' }).mockRejectedValueOnce({
			statusCode: 500,
			message: 'Server exploded',
		});

		const addMembersContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'memberIdentifiers') return 'user1@example.com,user2@example.com';
			return undefined;
		});
		const addMembersResult = await addMembers.execute.call(
			addMembersContext,
			items,
			`${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`,
		);

		expect(addMembersResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'addMembers',
				reason: 'SERVER_ERROR',
				status_code: 500,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/channels/CT_1');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/channels/CT_1/members',
			{ email_ids: ['user1@example.com', 'user2@example.com'] },
		);
	});

	it('should use shared channel preflight for get-by-unique-name success paths', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			channel_id: 'CH_123',
			unique_name: 'engineering-updates',
			name: 'Engineering Updates',
		});

		const getContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
			if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
			return undefined;
		});
		const getResult = await get.execute.call(getContext, items, SCOPES.CHANNELS_READ);

		expect(getResult[0].json).toEqual(
			expect.objectContaining({
				channel_id: 'CH_123',
				unique_name: 'engineering-updates',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
	});

	it('should throw upstream errors for get/getMembers when continueOnFail is disabled', async () => {
		const context = {
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex?: number,
					_fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'channelId' && options?.extractValue) return 'CT_1';
					if (name === 'channelId') return 'CT_1';
					return undefined;
				},
			),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
		mockZohoCliqApiRequest.mockRejectedValue(new Error('forced failure'));

		await expect(get.execute.call(context, items, SCOPES.CHANNELS_READ)).rejects.toBeDefined();
		await expect(
			getMembers.execute.call(context, items, SCOPES.CHANNELS_READ),
		).rejects.toBeDefined();
	});

	it('should treat whitespace update strings as omitted and return recoverable error', async () => {
		const updateContext = buildContext((name, options) => {
			if (name === 'channelId' && options?.extractValue) return 'CT_1';
			if (name === 'channelId') return 'CT_1';
			if (name === 'additionalFields')
				return { name: '   ', description: '   ', image_data: '   ', configInputMode: 'none' };
			return undefined;
		});
		const result = await update.execute.call(updateContext, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toEqual(
			expect.objectContaining({ success: false, operation: 'update' }),
		);
	});
});
