/**
 * Channel resource
 * Handles all channel-related operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as addMembers from './addMembers.operation';
import * as addBot from './addBot.operation';
import * as approve from './approve.operation';
import * as archive from './archive.operation';
import * as changePermission from './changePermission.operation';
import * as changeRole from './changeRole.operation';
import * as create from './create.operation';
import * as del from './delete.operation';
import * as get from './get.operation';
import * as getMembers from './getMembers.operation';
import * as join from './join.operation';
import * as leave from './leave.operation';
import * as list from './list.operation';
import * as reject from './reject.operation';
import * as removeBot from './removeBot.operation';
import * as removeMember from './removeMember.operation';
import * as removeMembers from './removeMembers.operation';
import * as unarchive from './unarchive.operation';
import * as update from './update.operation';

// Export all channel operations
export {
	addMembers,
	addBot,
	approve,
	archive,
	changePermission,
	changeRole,
	create,
	del as delete,
	get,
	getMembers,
	join,
	leave,
	list,
	reject,
	removeBot,
	removeMember,
	removeMembers,
	unarchive,
	update,
};

// Export combined description for channel resource
export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['channel'],
			},
		},
		options: [
			{
				name: 'Add Bot to Channel',
				value: 'addBot',
				description: 'Associate a bot with a channel by unique names',
				action: 'Add a bot to a channel',
			},
			{
				name: 'Add Channel Members',
				value: 'addMembers',
				description: 'Add members to a channel',
				action: 'Add channel members',
			},
			{
				name: 'Approve Channel',
				value: 'approve',
				description: 'Approve a pending organization-level channel (admin only)',
				action: 'Approve a channel',
			},
			{
				name: 'Archive Channel',
				value: 'archive',
				description: 'Archive a channel (can be unarchived later)',
				action: 'Archive a channel',
			},
			{
				name: 'Change Channel Member Role',
				value: 'changeRole',
				description: 'Change role of a specific member in a channel',
				action: 'Change channel member role',
			},
			{
				name: 'Change Channel Permission',
				value: 'changePermission',
				description: 'Update channel permission objects for admin/moderator/member roles',
				action: 'Change channel permission',
			},
			{
				name: 'Create Channel',
				value: 'create',
				description: 'Create a new channel',
				action: 'Create a channel',
			},
			{
				name: 'Delete Channel',
				value: 'delete',
				description: 'Delete a channel permanently',
				action: 'Delete a channel',
			},
			{
				name: 'Get Channel',
				value: 'get',
				description: 'Get detailed information about a specific channel',
				action: 'Get a channel',
			},
			{
				name: 'Get Channel Members',
				value: 'getMembers',
				description: 'Get list of all members in a channel',
				action: 'Get channel members',
			},
			{
				name: 'Join Channel',
				value: 'join',
				description: 'Join a channel (current user)',
				action: 'Join a channel',
			},
			{
				name: 'Leave Channel',
				value: 'leave',
				description: 'Leave a channel (current user)',
				action: 'Leave a channel',
			},
			{
				name: 'List Channels',
				value: 'list',
				description: 'Get a list of all channels with optional filters',
				action: 'List all channels',
			},
			{
				name: 'Reject Channel',
				value: 'reject',
				description: 'Reject a pending organization-level channel (admin only)',
				action: 'Reject a channel',
			},
			{
				name: 'Remove Bot From Channel',
				value: 'removeBot',
				description: 'Remove a bot from a channel using Bot ID',
				action: 'Remove a bot from a channel',
			},
			{
				name: 'Remove Channel Members',
				value: 'removeMembers',
				description: 'Remove a member from a channel',
				action: 'Remove channel members',
			},
			{
				name: 'Remove Single Channel Member',
				value: 'removeMember',
				description: 'Remove one channel member by ID or email',
				action: 'Remove a channel member',
			},
			{
				name: 'Unarchive Channel',
				value: 'unarchive',
				description: 'Restore an archived channel',
				action: 'Unarchive a channel',
			},
			{
				name: 'Update Channel',
				value: 'update',
				description: 'Update an existing channel',
				action: 'Update a channel',
			},
		],
		default: 'list',
	},
	...addMembers.description,
	...addBot.description,
	...approve.description,
	...archive.description,
	...changePermission.description,
	...changeRole.description,
	...create.description,
	...del.description,
	...get.description,
	...getMembers.description,
	...join.description,
	...leave.description,
	...list.description,
	...reject.description,
	...removeBot.description,
	...removeMember.description,
	...removeMembers.description,
	...unarchive.description,
	...update.description,
];
