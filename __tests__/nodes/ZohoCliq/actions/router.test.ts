/**
 * Tests for Router
 * Verifies resource dispatch, error handling, and type-safe operation routing
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { router } from '../../../../nodes/ZohoCliq/v1/actions/router';
import * as message from '../../../../nodes/ZohoCliq/v1/actions/message/Message.resource';
import * as messageComponentBuilder from '../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/MessageComponentBuilder.resource';
import * as oauthHelper from '../../../../nodes/ZohoCliq/v1/actions/oauthHelper/OAuthHelper.resource';
import * as channel from '../../../../nodes/ZohoCliq/v1/actions/channel/Channel.resource';
import * as bot from '../../../../nodes/ZohoCliq/v1/actions/bot/Bot.resource';
import * as thread from '../../../../nodes/ZohoCliq/v1/actions/thread/Thread.resource';
import * as chat from '../../../../nodes/ZohoCliq/v1/actions/chat/Chat.resource';
import * as files from '../../../../nodes/ZohoCliq/v1/actions/files/Files.resource';
import * as reaction from '../../../../nodes/ZohoCliq/v1/actions/reaction/Reaction.resource';
import * as user from '../../../../nodes/ZohoCliq/v1/actions/user/User.resource';
import * as team from '../../../../nodes/ZohoCliq/v1/actions/team/Team.resource';
import * as department from '../../../../nodes/ZohoCliq/v1/actions/department/Department.resource';
import * as role from '../../../../nodes/ZohoCliq/v1/actions/role/Role.resource';
import * as designation from '../../../../nodes/ZohoCliq/v1/actions/designation/Designation.resource';
import * as userFields from '../../../../nodes/ZohoCliq/v1/actions/userFields/UserFields.resource';
import * as userStatus from '../../../../nodes/ZohoCliq/v1/actions/userStatus/UserStatus.resource';
import * as events from '../../../../nodes/ZohoCliq/v1/actions/events/Events.resource';
import * as reminders from '../../../../nodes/ZohoCliq/v1/actions/reminders/Reminders.resource';
import * as remoteWork from '../../../../nodes/ZohoCliq/v1/actions/remoteWork/RemoteWork.resource';
import * as callsMeeting from '../../../../nodes/ZohoCliq/v1/actions/callsMeeting/CallsMeeting.resource';
import * as widgetMapTicker from '../../../../nodes/ZohoCliq/v1/actions/widgetMapTicker/WidgetMapTicker.resource';
import * as customEmail from '../../../../nodes/ZohoCliq/v1/actions/customEmail/CustomEmail.resource';
import * as database from '../../../../nodes/ZohoCliq/v1/actions/database/Database.resource';
import * as customDomain from '../../../../nodes/ZohoCliq/v1/actions/customDomain/CustomDomain.resource';
import * as bulkAction from '../../../../nodes/ZohoCliq/v1/actions/bulkAction/BulkAction.resource';
import * as utils from '../../../../nodes/ZohoCliq/v1/helpers/utils';

// Mock dependencies
jest.mock('../../../../nodes/ZohoCliq/v1/actions/message/Message.resource');
jest.mock(
	'../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/MessageComponentBuilder.resource',
);
jest.mock('../../../../nodes/ZohoCliq/v1/actions/oauthHelper/OAuthHelper.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/channel/Channel.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/bot/Bot.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/thread/Thread.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/chat/Chat.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/files/Files.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/reaction/Reaction.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/user/User.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/team/Team.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/department/Department.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/role/Role.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/designation/Designation.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/userFields/UserFields.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/userStatus/UserStatus.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/events/Events.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/reminders/Reminders.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/remoteWork/RemoteWork.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/callsMeeting/CallsMeeting.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/widgetMapTicker/WidgetMapTicker.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/customEmail/CustomEmail.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/database/Database.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/customDomain/CustomDomain.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/actions/bulkAction/BulkAction.resource');
jest.mock('../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('Router', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];

	beforeEach(() => {
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue(mockItems),
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			continueOnFail: jest.fn().mockReturnValue(false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		// Mock validateCredentials to return granted scopes
		(utils.validateCredentials as jest.Mock).mockResolvedValue(
			'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Resource Dispatch', () => {
		it('should dispatch to message resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const mockResult: INodeExecutionData[] = [{ json: { message_id: '123' } }];
			(message.post.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(message.post.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to messageComponentBuilder resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('messageComponentBuilder')
				.mockReturnValueOnce('buildButtons');

			const mockResult: INodeExecutionData[] = [{ json: { buttonsPayload: '[]' } }];
			(messageComponentBuilder.buildButtons.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(messageComponentBuilder.buildButtons.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to channel resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('channel')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { channels: [] } }];
			(channel.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(channel.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to bot resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('bot')
				.mockReturnValueOnce('getSubscribers');

			const mockResult: INodeExecutionData[] = [{ json: { users: [] } }];
			(bot.getSubscribers.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(bot.getSubscribers.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to thread resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('thread')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { threads: [] } }];
			(thread.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(thread.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to chat resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('chat')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { chats: [] } }];
			(chat.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(chat.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to files resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('file')
				.mockReturnValueOnce('getFile');

			const mockResult: INodeExecutionData[] = [{ json: { file_id: 'FILE_123' } }];
			(files.getFile.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(files.getFile.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to files shareFile operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('file')
				.mockReturnValueOnce('shareFile');

			const mockResult: INodeExecutionData[] = [{ json: { status: 'ok' } }];
			(files.shareFile.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(files.shareFile.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to reaction resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('reaction')
				.mockReturnValueOnce('add');

			const mockResult: INodeExecutionData[] = [{ json: { success: true } }];
			(reaction.add.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(reaction.add.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to user resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('user')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { users: [] } }];
			(user.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(user.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to user get operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('user')
				.mockReturnValueOnce('get');

			const mockResult: INodeExecutionData[] = [{ json: { id: '123' } }];
			(user.get.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(user.get.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to user create operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('user')
				.mockReturnValueOnce('create');

			const mockResult: INodeExecutionData[] = [{ json: { user_id: '123' } }];
			(user.create.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(user.create.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to user getTeams operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('user')
				.mockReturnValueOnce('getTeams');

			const mockResult: INodeExecutionData[] = [{ json: { teams: [] } }];
			(user.getTeams.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(user.getTeams.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to oauthHelper getGrantedScopes operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('oauthHelper')
				.mockReturnValueOnce('getGrantedScopes');

			const mockResult: INodeExecutionData[] = [{ json: { effectiveScopes: [] } }];
			(oauthHelper.getGrantedScopes.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(oauthHelper.getGrantedScopes.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to userField get operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userField')
				.mockReturnValueOnce('get');

			const mockResult: INodeExecutionData[] = [{ json: { id: 'UF_123' } }];
			(userFields.get.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(userFields.get.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to department list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('department')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { departments: [] } }];
			(department.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(department.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to team list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('team')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { teams: [] } }];
			(team.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(team.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to department getMembers operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('department')
				.mockReturnValueOnce('getMembers');

			const mockResult: INodeExecutionData[] = [{ json: { members: [] } }];
			(department.getMembers.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(department.getMembers.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to role list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('role')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { roles: [] } }];
			(role.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(role.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to role getUsers operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('role')
				.mockReturnValueOnce('getUsers');

			const mockResult: INodeExecutionData[] = [{ json: { users: [] } }];
			(role.getUsers.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(role.getUsers.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to designation list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('designation')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { designations: [] } }];
			(designation.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(designation.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to designation getMembers operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('designation')
				.mockReturnValueOnce('getMembers');

			const mockResult: INodeExecutionData[] = [{ json: { members: [] } }];
			(designation.getMembers.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(designation.getMembers.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to remoteWork getStatus operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('remoteWork')
				.mockReturnValueOnce('getStatus');

			const mockResult: INodeExecutionData[] = [{ json: { status: 'checked_in' } }];
			(remoteWork.getStatus.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(remoteWork.getStatus.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to events list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('event')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { events: [] } }];
			(events.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(events.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to reminders list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('reminder')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { reminders: [] } }];
			(reminders.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(reminders.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to remoteWork checkIn operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('remoteWork')
				.mockReturnValueOnce('checkIn');

			const mockResult: INodeExecutionData[] = [{ json: { success: true, action: 'checkIn' } }];
			(remoteWork.checkIn.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(remoteWork.checkIn.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to remoteWork checkOut operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('remoteWork')
				.mockReturnValueOnce('checkOut');

			const mockResult: INodeExecutionData[] = [{ json: { success: true, action: 'checkOut' } }];
			(remoteWork.checkOut.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(remoteWork.checkOut.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to callsMeeting listCallRecordings operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('callsMeeting')
				.mockReturnValueOnce('listCallRecordings');

			const mockResult: INodeExecutionData[] = [{ json: { data: [] } }];
			(callsMeeting.listCallRecordings.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(callsMeeting.listCallRecordings.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to widgetMapTicker addOrUpdateTicker operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('widgetMapTicker')
				.mockReturnValueOnce('addOrUpdateTicker');

			const mockResult: INodeExecutionData[] = [{ json: { tickers: {} } }];
			(widgetMapTicker.addOrUpdateTicker.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(widgetMapTicker.addOrUpdateTicker.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to customEmail getOrganizationEmailConfiguration operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customEmail')
				.mockReturnValueOnce('getOrganizationEmailConfiguration');

			const mockResult: INodeExecutionData[] = [{ json: { cname_status: 'verified' } }];
			(customEmail.getOrganizationEmailConfiguration.execute as jest.Mock).mockResolvedValue(
				mockResult,
			);

			const result = await router.call(mockExecuteFunctions);

			expect(customEmail.getOrganizationEmailConfiguration.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch legacy customEmail verifyCustomEmail alias to getOrganizationEmailConfiguration handler', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customEmail')
				.mockReturnValueOnce('verifyCustomEmail');

			const mockResult: INodeExecutionData[] = [{ json: { cname_status: 'verified' } }];
			(customEmail.getOrganizationEmailConfiguration.execute as jest.Mock).mockResolvedValue(
				mockResult,
			);

			const result = await router.call(mockExecuteFunctions);

			expect(customEmail.getOrganizationEmailConfiguration.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to customEmail updateOrganizationEmailConfiguration operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customEmail')
				.mockReturnValueOnce('updateOrganizationEmailConfiguration');

			const mockResult: INodeExecutionData[] = [
				{ json: { data: { email_id: 'support@example.com' } } },
			];
			(customEmail.updateOrganizationEmailConfiguration.execute as jest.Mock).mockResolvedValue(
				mockResult,
			);

			const result = await router.call(mockExecuteFunctions);

			expect(customEmail.updateOrganizationEmailConfiguration.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch legacy customEmail addCustomEmail alias to updateOrganizationEmailConfiguration handler', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customEmail')
				.mockReturnValueOnce('addCustomEmail');

			const mockResult: INodeExecutionData[] = [
				{ json: { data: { email_id: 'support@example.com' } } },
			];
			(customEmail.updateOrganizationEmailConfiguration.execute as jest.Mock).mockResolvedValue(
				mockResult,
			);

			const result = await router.call(mockExecuteFunctions);

			expect(customEmail.updateOrganizationEmailConfiguration.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch legacy customEmail updateMailConfiguration alias to updateOrganizationEmailConfiguration handler', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customEmail')
				.mockReturnValueOnce('updateMailConfiguration');

			const mockResult: INodeExecutionData[] = [
				{ json: { data: { email_id: 'support@example.com' } } },
			];
			(customEmail.updateOrganizationEmailConfiguration.execute as jest.Mock).mockResolvedValue(
				mockResult,
			);

			const result = await router.call(mockExecuteFunctions);

			expect(customEmail.updateOrganizationEmailConfiguration.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to database list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('database')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { data: [] } }];
			(database.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(database.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to userField list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userField')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { userfields: [] } }];
			(userFields.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(userFields.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to userField create operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userField')
				.mockReturnValueOnce('create');

			const mockResult: INodeExecutionData[] = [{ json: { id: 'UF_123' } }];
			(userFields.create.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(userFields.create.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to userField update operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userField')
				.mockReturnValueOnce('update');

			const mockResult: INodeExecutionData[] = [{ json: { id: 'UF_123' } }];
			(userFields.update.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(userFields.update.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to userField delete operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userField')
				.mockReturnValueOnce('delete');

			const mockResult: INodeExecutionData[] = [{ json: { success: true } }];
			(userFields.delete.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(userFields.delete.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to userStatus list operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userStatus')
				.mockReturnValueOnce('list');

			const mockResult: INodeExecutionData[] = [{ json: { statuses: [] } }];
			(userStatus.list.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(userStatus.list.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to customDomain resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customDomain')
				.mockReturnValueOnce('get');

			const mockResult: INodeExecutionData[] = [
				{ json: { customdomain_domain: 'portal.example.com' } },
			];
			(customDomain.get.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(customDomain.get.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should dispatch to bulkAction resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('bulkAction')
				.mockReturnValueOnce('exportConversations');

			const mockResult: INodeExecutionData[] = [{ json: { exports: [] } }];
			(bulkAction.exportConversations.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(bulkAction.exportConversations.execute).toHaveBeenCalledWith(
				mockItems,
				'ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE',
			);
			expect(result).toEqual([mockResult]);
		});

		it('should validate credentials before dispatching', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			(message.post.execute as jest.Mock).mockResolvedValue([{ json: {} }]);

			await router.call(mockExecuteFunctions);

			expect(utils.validateCredentials).toHaveBeenCalledWith(mockExecuteFunctions);
		});

		it('should pass granted scopes to operations', async () => {
			const customScopes = 'ZohoCliq.Channels.CREATE,ZohoCliq.Channels.READ';
			(utils.validateCredentials as jest.Mock).mockResolvedValue(customScopes);

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('channel')
				.mockReturnValueOnce('create');

			(channel.create.execute as jest.Mock).mockResolvedValue([{ json: {} }]);

			await router.call(mockExecuteFunctions);

			expect(channel.create.execute).toHaveBeenCalledWith(mockItems, customScopes);
		});
	});

	describe('Channel Operations', () => {
		const channelOperations = [
			'list',
			'get',
			'create',
			'update',
			'delete',
			'archive',
			'unarchive',
			'approve',
			'reject',
			'addMembers',
			'addBot',
			'changeRole',
			'changePermission',
			'removeBot',
			'removeMember',
			'removeMembers',
			'getMembers',
			'join',
			'leave',
		];

		channelOperations.forEach((operation) => {
			it(`should dispatch to channel ${operation} operation`, async () => {
				(mockExecuteFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('channel')
					.mockReturnValueOnce(operation);

				const mockResult: INodeExecutionData[] = [{ json: { success: true } }];
				const channelModule = channel as unknown as Record<string, { execute: jest.Mock }>;
				(channelModule[operation].execute as jest.Mock).mockResolvedValue(mockResult);

				const result = await router.call(mockExecuteFunctions);

				expect(channelModule[operation].execute).toHaveBeenCalledTimes(1);
				expect(result).toEqual([mockResult]);
			});
		});
	});

	describe('Error Handling', () => {
		it('should throw for unsupported message operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "message"',
			);
		});

		it('should throw for unsupported messageComponentBuilder operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('messageComponentBuilder')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "messageComponentBuilder"',
			);
		});

		it('should throw for unsupported channel operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('channel')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "channel"',
			);
		});

		it('should throw for unsupported bot operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('bot')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "bot"',
			);
		});

		it('should throw for unsupported thread operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('thread')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "thread"',
			);
		});

		it('should throw for unsupported chat operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('chat')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "chat"',
			);
		});

		it('should throw for unsupported files operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('file')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "file"',
			);
		});

		it('should throw for unsupported reaction operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('reaction')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "reaction"',
			);
		});

		it('should throw for unsupported user operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('user')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "user"',
			);
		});

		it('should throw for unsupported oauthHelper operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('oauthHelper')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "oauthHelper"',
			);
		});

		it('should throw for unsupported team operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('team')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "team"',
			);
		});

		it('should throw for unsupported department operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('department')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "department"',
			);
		});

		it('should throw for unsupported role operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('role')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "role"',
			);
		});

		it('should throw for unsupported designation operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('designation')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "designation"',
			);
		});

		it('should throw for unsupported userField operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userField')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "userField"',
			);
		});

		it('should throw for unsupported userStatus operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('userStatus')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "userStatus"',
			);
		});

		it('should throw for unsupported remoteWork operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('remoteWork')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "remoteWork"',
			);
		});

		it('should throw for unsupported events operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('event')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "event"',
			);
		});

		it('should throw for unsupported reminders operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('reminder')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "reminder"',
			);
		});

		it('should throw for unsupported callsMeeting operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('callsMeeting')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "callsMeeting"',
			);
		});

		it('should throw for unsupported widgetMapTicker operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('widgetMapTicker')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "widgetMapTicker"',
			);
		});

		it('should throw for unsupported customEmail operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customEmail')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "customEmail"',
			);
		});

		it('should throw for unsupported customDomain operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('customDomain')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "customDomain"',
			);
		});

		it('should throw for unsupported bulkAction operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('bulkAction')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "bulkAction"',
			);
		});

		it('should throw for unsupported database operation', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('database')
				.mockReturnValueOnce('nope');

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported operation "nope" for resource "database"',
			);
		});

		it('should throw NodeOperationError for unsupported resource', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'unsupported';
					if (paramName === 'operation') return 'operation';
					return undefined;
				},
			);

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(NodeOperationError);
			await expect(router.call(mockExecuteFunctions)).rejects.toThrow(
				'Unsupported resource: unsupported',
			);
		});

		it('should propagate errors when continueOnFail is false', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const error = new Error('API error');
			(message.post.execute as jest.Mock).mockRejectedValue(error);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);

			await expect(router.call(mockExecuteFunctions)).rejects.toThrow('API error');
		});

		it('should return error data when continueOnFail is true', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const error = new Error('API error');
			(message.post.execute as jest.Mock).mockRejectedValue(error);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result).toHaveLength(1);
			expect(result[0]).toHaveLength(1);
			expect(result[0][0].json).toHaveProperty('error', 'API error');
		});

		it('should return standardized scope payload when scope validation fails', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const scopeError = new Error('Missing scope');
			Object.assign(scopeError, {
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'remoteWork',
					operation: 'checkIn',
					requiredScopes: ['ZohoCliq.Profile.UPDATE'],
					missingScopes: ['ZohoCliq.Profile.UPDATE'],
					hint: 'Reconnect credentials',
				},
			});
			(message.post.execute as jest.Mock).mockRejectedValue(scopeError);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0].json).toMatchObject({
				success: false,
				resource: 'remoteWork',
				operation: 'checkIn',
			});
			expect(result[0][0]).toHaveProperty('pairedItem', { item: 0 });
			expect(result[0][1]).toHaveProperty('pairedItem', { item: 1 });
		});

		it('should return standardized scope payload for plain object errors', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			(message.post.execute as jest.Mock).mockRejectedValue({
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'message',
					operation: 'post',
					requiredScopes: ['ZohoCliq.Webhooks.CREATE'],
					missingScopes: ['ZohoCliq.Webhooks.CREATE'],
					hint: 'Reconnect credentials',
				},
			});
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0][0].json).toMatchObject({
				success: false,
				resource: 'message',
				operation: 'post',
			});
		});

		it('should handle null thrown errors in continueOnFail mode', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			(message.post.execute as jest.Mock).mockRejectedValue(null);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);
			expect(result[0][0].json).toHaveProperty('error', 'An unexpected issue occurred');
		});

		it('should include sanitized message when response data is ZohoCliq-shaped', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const error = new Error('API failure');
			Object.assign(error, {
				response: {
					status: 400,
					data: {
						error: 'Bad Request',
						message: 'Invalid request payload',
					},
				},
			});
			(message.post.execute as jest.Mock).mockRejectedValue(error);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);
			expect(result[0][0].json.details).toMatchObject({
				statusCode: 400,
				message: 'Invalid request payload',
			});
		});

		it('should skip message field when ZohoCliq-shaped response omits message', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const error = new Error('API failure');
			Object.assign(error, {
				response: {
					status: 400,
					data: {
						error: 'Bad Request',
						code: 'BAD_REQUEST',
					},
				},
			});
			(message.post.execute as jest.Mock).mockRejectedValue(error);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);
			expect(result[0][0].json.details).toMatchObject({
				statusCode: 400,
				code: 'BAD_REQUEST',
			});
			expect(result[0][0].json.details).not.toHaveProperty('message');
		});

		it('should sanitize error responses with whitelist', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'channel';
					if (paramName === 'operation') return 'list';
					return undefined;
				},
			);

			// Create a proper Error instance with response property
			const apiError = new Error('API error');
			Object.assign(apiError, {
				response: {
					status: 401,
					data: {
						error: 'Unauthorized', // Type guard checks for 'error' field
						message: 'Unauthorized',
						code: 'AUTH_ERROR',
						error_code: '401',
						status: 'error',
						sensitive_data: 'should not be included',
					},
				},
			});

			(channel.list.execute as jest.Mock).mockRejectedValue(apiError);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('error', 'API error');
			expect(result[0][0].json.details).toHaveProperty('statusCode', 401);
			expect(result[0][0].json.details).toHaveProperty('message', 'Unauthorized');
			expect(result[0][0].json.details).not.toHaveProperty('sensitive_data');
		});

		it('should handle error response with non-Zoho Cliq error data', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'channel';
					if (paramName === 'operation') return 'list';
					return undefined;
				},
			);

			// Error with response but data doesn't match ZohoCliqErrorResponse format
			const apiError = new Error('Network error');
			Object.assign(apiError, {
				response: {
					status: 500,
					data: {
						// No 'error' field - won't match isZohoCliqErrorResponse type guard
						errorMessage: 'Internal server error',
						timestamp: Date.now(),
					},
				},
			});

			(channel.list.execute as jest.Mock).mockRejectedValue(apiError);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('error', 'Network error');
			expect(result[0][0].json.details).toHaveProperty('statusCode', 500);
			// Should not have other fields since data didn't match type guard
			expect(result[0][0].json.details).not.toHaveProperty('message');
			expect(result[0][0].json.details).not.toHaveProperty('code');
		});

		it('should not include statusCode when response status is 0', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'resource') return 'channel';
					if (paramName === 'operation') return 'list';
					return undefined;
				},
			);

			const apiError = new Error('Transport error');
			Object.assign(apiError, {
				response: {
					status: 0,
					data: {
						error: 'Unknown',
						message: 'Unknown',
					},
				},
			});

			(channel.list.execute as jest.Mock).mockRejectedValue(apiError);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('error', 'Transport error');
			expect(result[0][0].json.details).not.toHaveProperty('statusCode');
			expect(result[0][0].json.details).toHaveProperty('message', 'Unknown');
		});

		it('should include pairedItem in error responses', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const error = new Error('Test error');
			(message.post.execute as jest.Mock).mockRejectedValue(error);
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0]).toHaveLength(2);
			expect(result[0][0]).toHaveProperty('pairedItem', { item: 0 });
			expect(result[0][1]).toHaveProperty('pairedItem', { item: 1 });
		});

		it('should handle non-Error objects', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			(message.post.execute as jest.Mock).mockRejectedValue('string error');
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0][0].json).toHaveProperty('error', 'An unexpected issue occurred');
		});
	});

	describe('Type Safety', () => {
		it('should use type-safe operation maps', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			(message.post.execute as jest.Mock).mockResolvedValue([{ json: {} }]);

			await router.call(mockExecuteFunctions);

			// TypeScript should enforce that only valid operations can be called
			expect(message.post.execute).toHaveBeenCalled();
		});

		it('should get resource parameter at index 0', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('channel')
				.mockReturnValueOnce('list');

			(channel.list.execute as jest.Mock).mockResolvedValue([{ json: {} }]);

			await router.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.getNodeParameter).toHaveBeenCalledWith('resource', 0);
		});

		it('should get operation parameter at index 0', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			(message.post.execute as jest.Mock).mockResolvedValue([{ json: {} }]);

			await router.call(mockExecuteFunctions);

			expect(mockExecuteFunctions.getNodeParameter).toHaveBeenCalledWith('operation', 0);
		});
	});

	describe('Return Value Format', () => {
		it('should return results in nested array format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('message')
				.mockReturnValueOnce('post');

			const mockResult: INodeExecutionData[] = [{ json: { id: '123' } }];
			(message.post.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(1);
			expect(Array.isArray(result[0])).toBe(true);
			expect(result[0]).toEqual(mockResult);
		});

		it('should preserve execution data from operations', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('channel')
				.mockReturnValueOnce('get');

			const mockResult: INodeExecutionData[] = [
				{
					json: { channel_id: 'C123', name: 'Test Channel' },
					pairedItem: { item: 0 },
				},
			];
			(channel.get.execute as jest.Mock).mockResolvedValue(mockResult);

			const result = await router.call(mockExecuteFunctions);

			expect(result[0][0].json).toEqual({ channel_id: 'C123', name: 'Test Channel' });
			expect(result[0][0].pairedItem).toEqual({ item: 0 });
		});
	});
});
