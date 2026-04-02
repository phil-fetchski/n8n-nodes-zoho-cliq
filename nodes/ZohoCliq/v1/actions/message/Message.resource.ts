/**
 * Message resource
 * Handles message-related operations
 */

import type { INodeProperties } from 'n8n-workflow';
import * as deleteOp from './delete.operation';
import * as edit from './edit.operation';
import * as get from './get.operation';
import * as post from './post.operation';
import * as retrieve from './retrieve.operation';
import * as scheduleMessage from '../shared/scheduleMessage.operation';

// Export all message operations
// Note: 'delete' is renamed to avoid JavaScript reserved keyword conflict
export { deleteOp as delete, edit, get, post, retrieve, scheduleMessage };

// Export combined description for message resource
export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['message'],
			},
		},
		options: [
			{
				name: 'Delete Message',
				value: 'delete',
				description: 'Delete a message',
				action: 'Delete a message',
			},
			{
				name: 'Edit Message',
				value: 'edit',
				description: 'Edit an existing message',
				action: 'Edit a message',
			},
			{
				name: 'Get Messages',
				value: 'get',
				description: 'Get messages from a chat, channel, or thread',
				action: 'Get messages',
			},
			{
				name: 'Post Message',
				value: 'post',
				description: 'Post a message to a channel, bot, chat, or user',
				action: 'Post a message',
			},
			{
				name: 'Retrieve Message',
				value: 'retrieve',
				description: 'Retrieve a specific message by ID',
				action: 'Retrieve a message',
			},
			{
				name: 'Schedule Message',
				value: 'scheduleMessage',
				description: 'Schedule a message to be sent later',
				action: 'Schedule a message',
			},
		],
		default: 'post',
	},
	...deleteOp.description,
	...edit.description,
	...get.description,
	...post.description,
	...retrieve.description,
	...scheduleMessage.description,
];
