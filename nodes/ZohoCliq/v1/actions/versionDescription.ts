/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import { NodeConnectionTypes, type INodeTypeDescription } from 'n8n-workflow';

import { NODE_DESCRIPTION, SUBTITLE_EXPRESSION } from '../../constants';
import * as channel from './channel/Channel.resource';
import * as bot from './bot/Bot.resource';
import * as message from './message/Message.resource';
import * as messageComponentBuilder from './messageComponentBuilder/MessageComponentBuilder.resource';
import * as oauthHelper from './oauthHelper/OAuthHelper.resource';
import * as thread from './thread/Thread.resource';
import * as chat from './chat/Chat.resource';
import * as files from './files/Files.resource';
import * as reaction from './reaction/Reaction.resource';
import * as user from './user/User.resource';
import * as team from './team/Team.resource';
import * as department from './department/Department.resource';
import * as role from './role/Role.resource';
import * as designation from './designation/Designation.resource';
import * as userFields from './userFields/UserFields.resource';
import * as userStatus from './userStatus/UserStatus.resource';
import * as events from './events/Events.resource';
import * as reminders from './reminders/Reminders.resource';
import * as remoteWork from './remoteWork/RemoteWork.resource';
import * as callsMeeting from './callsMeeting/CallsMeeting.resource';
import * as widgetMapTicker from './widgetMapTicker/WidgetMapTicker.resource';
import * as customEmail from './customEmail/CustomEmail.resource';
import * as database from './database/Database.resource';
import * as customDomain from './customDomain/CustomDomain.resource';
import * as bulkAction from './bulkAction/BulkAction.resource';

export const versionDescription: INodeTypeDescription = {
	displayName: 'Zoho Cliq',
	name: 'zohoCliq',
	group: ['output'],
	version: 1,
	subtitle: SUBTITLE_EXPRESSION,
	description: NODE_DESCRIPTION,
	defaults: { name: 'Zoho Cliq' },
	inputs: [NodeConnectionTypes.Main],
	outputs: [NodeConnectionTypes.Main],
	credentials: [{ name: 'zohoCliqOAuth2Api', required: true }],
	properties: [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Bot', value: 'bot' },
				{ name: 'Call & Meeting', value: 'callsMeeting' },
				{ name: 'Channel', value: 'channel' },
				{ name: 'Chat', value: 'chat' },
				{ name: 'Cliq Database', value: 'database' },
				{ name: 'Custom Domain', value: 'customDomain' },
				{ name: 'Custom Email', value: 'customEmail' },
				{ name: 'Department', value: 'department' },
				{ name: 'Designation', value: 'designation' },
				{ name: 'Event', value: 'event' },
				{ name: 'File', value: 'file' },
				{ name: 'Maintenance (Bulk Export)', value: 'bulkAction' },
				{ name: 'Message', value: 'message' },
				{ name: 'Message Component Builder', value: 'messageComponentBuilder' },
				{ name: 'OAuth Helper', value: 'oauthHelper' },
				{ name: 'Reaction', value: 'reaction' },
				{ name: 'Reminder', value: 'reminder' },
				{ name: 'Remote Work', value: 'remoteWork' },
				{ name: 'Role', value: 'role' },
				{ name: 'Team', value: 'team' },
				{ name: 'Thread', value: 'thread' },
				{ name: 'User', value: 'user' },
				{ name: 'User Field', value: 'userField' },
				{ name: 'User Status', value: 'userStatus' },
				{ name: 'Widget Map Ticker', value: 'widgetMapTicker' },
			],
			default: 'message',
		},
		{
			displayName: 'Enable AI Error Mode',
			name: 'enableAiErrorMode',
			type: 'boolean',
			default: false,
			noDataExpression: true,
			displayOptions: {
				hide: {
					resource: ['messageComponentBuilder'],
				},
			},
			description:
				'Whether to return errors as output items (continue-on-fail style) instead of stopping execution. Recommended for AI Tool runs that should recover from API errors.',
		},
		{
			displayName: 'Enable AI Error Mode',
			name: 'enableAiErrorMode',
			type: 'boolean',
			default: false,
			noDataExpression: true,
			displayOptions: {
				show: {
					resource: ['messageComponentBuilder'],
					operation: ['buildAgentCardPayload'],
				},
			},
			description:
				'Whether to return errors as output items (continue-on-fail style) instead of stopping execution. Recommended for AI Tool runs that should recover from API errors.',
		},
		...message.description,
		...messageComponentBuilder.description,
		...oauthHelper.description,
		...bot.description,
		...channel.description,
		...thread.description,
		...chat.description,
		...files.description,
		...reaction.description,
		...user.description,
		...team.description,
		...department.description,
		...role.description,
		...designation.description,
		...userFields.description,
		...userStatus.description,
		...events.description,
		...reminders.description,
		...remoteWork.description,
		...callsMeeting.description,
		...widgetMapTicker.description,
		...customEmail.description,
		...database.description,
		...customDomain.description,
		...bulkAction.description,
	],
};
