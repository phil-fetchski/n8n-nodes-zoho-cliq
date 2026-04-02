import type { INodeProperties } from 'n8n-workflow';

import * as exportChannels from './exportChannels.operation';
import * as exportConversationMembers from './exportConversationMembers.operation';
import * as exportConversations from './exportConversations.operation';
import * as exportMessages from './exportMessages.operation';

export { exportChannels, exportConversationMembers, exportConversations, exportMessages };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['bulkAction'],
			},
		},
		options: [
			{
				name: 'Export Conversations',
				value: 'exportConversations',
				description: 'Export organization conversations (chats and groups) as CSV',
				action: 'Export conversations',
			},
			{
				name: 'Export Channels',
				value: 'exportChannels',
				description: 'Export organization channels as CSV',
				action: 'Export channels',
			},
			{
				name: 'Export Members in a Conversation',
				value: 'exportConversationMembers',
				description: 'Export members from a specific conversation as CSV',
				action: 'Export conversation members',
			},
			{
				name: 'Export Messages',
				value: 'exportMessages',
				description: 'Export transcript/messages for a specific conversation',
				action: 'Export messages',
			},
		],
		default: 'exportConversations',
	},
	{
		displayName:
			'Important: Maintenance/Bulk Export APIs are available only for the Zoho Cliq Organization Admin (Super Admin) and require the "Org Admin (Organization APIs)" scope pack. Calls from non-admin OAuth users will fail.',
		name: 'bulkActionAdminOnlyNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['bulkAction'],
			},
		},
	},
	...exportConversations.description,
	...exportChannels.description,
	...exportConversationMembers.description,
	...exportMessages.description,
];
