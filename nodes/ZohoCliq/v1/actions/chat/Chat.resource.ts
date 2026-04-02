/**
 * Chat resource
 * Handles all chat-related operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as list from './list.operation';
import * as getMembers from './getMembers.operation';
import * as mute from './mute.operation';
import * as unmute from './unmute.operation';
import * as pinStickyMessage from './pinStickyMessage.operation';
import * as unpinStickyMessage from './unpinStickyMessage.operation';
import * as getPinnedStickyMessage from './getPinnedStickyMessage.operation';
import * as leave from './leave.operation';

// Export all chat operations
export {
	list,
	getMembers,
	mute,
	unmute,
	pinStickyMessage,
	unpinStickyMessage,
	getPinnedStickyMessage,
	leave,
};

// Export combined description for chat resource
export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['chat'],
			},
		},
		options: [
			{
				name: 'Get Chat Members',
				value: 'getMembers',
				description: 'Get list of all members in a chat',
				action: 'Get chat members',
			},
			{
				name: 'Get Pinned Message',
				value: 'getPinnedStickyMessage',
				description: 'Get the currently pinned message in a chat',
				action: 'Get pinned message in chat',
			},
			{
				name: 'Leave Group Chat',
				value: 'leave',
				description: 'Leave a group chat',
				action: 'Leave a group chat',
			},
			{
				name: 'List Chats',
				value: 'list',
				description:
					'Get a list of chats across multiple chat types (dm, bot, chat, entity_chat) with optional filters',
				action: 'List all chats',
			},
			{
				name: 'Mute Chat',
				value: 'mute',
				description: 'Mute notifications for a chat',
				action: 'Mute a chat',
			},
			{
				name: 'Pin Message',
				value: 'pinStickyMessage',
				description: 'Pin an existing message as the chat pinned message',
				action: 'Pin message in chat',
			},
			{
				name: 'Unmute Chat',
				value: 'unmute',
				description: 'Unmute notifications for a chat',
				action: 'Unmute a chat',
			},
			{
				name: 'Unpin Message',
				value: 'unpinStickyMessage',
				description: 'Remove the current pinned message from a chat',
				action: 'Unpin message in chat',
			},
		],
		default: 'list',
	},
	...list.description,
	...getMembers.description,
	...mute.description,
	...unmute.description,
	...pinStickyMessage.description,
	...unpinStickyMessage.description,
	...getPinnedStickyMessage.description,
	...leave.description,
];
