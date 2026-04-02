/**
 * Thread resource
 * Handles all thread-related operations
 */

import type { INodeProperties } from 'n8n-workflow';

import { THREAD_SCHEDULE_MESSAGE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import * as create from './create.operation';
import * as post from './post.operation';
import * as list from './list.operation';
import * as autoFollow from './autoFollow.operation';
import * as getFollowers from './getFollowers.operation';
import * as getNonFollowers from './getNonFollowers.operation';
import * as addFollowers from './addFollowers.operation';
import * as removeFollowers from './removeFollowers.operation';
import * as follow from './follow.operation';
import * as unfollow from './unfollow.operation';
import * as updateState from './updateState.operation';
import * as getMainMessage from './getMainMessage.operation';

// Import shared operations
import * as scheduleMessage from '../shared/scheduleMessage.operation';

// Export all thread operations
export {
	create,
	post,
	list,
	autoFollow,
	getFollowers,
	getNonFollowers,
	addFollowers,
	removeFollowers,
	follow,
	unfollow,
	updateState,
	getMainMessage,
	scheduleMessage,
};

const threadScheduleMessageRemovedFieldNames = new Set([
	'scheduleFieldVisibility',
	'scheduleMode',
	'agentScheduleTime',
	'agentScheduleTimezone',
	'scheduleStatus',
	'agentScheduleStatus',
	'scheduleStatusConversationNotice',
	'agentPostAsBot',
	'agentBotUniqueName',
]);

const threadScheduleMessageDescription: INodeProperties[] = scheduleMessage.description
	.filter((prop) => !threadScheduleMessageRemovedFieldNames.has(prop.name))
	.map((prop) => {
		const baseProperty =
			prop.name === 'chatId'
				? {
						...prop,
						displayName: 'Thread Chat ID',
						description: 'Thread chat ID where the scheduled message should be posted',
					}
				: prop.name === 'scheduleMessageAiToolGuideNotice'
					? {
							...prop,
							displayName: `Zoho Cliq Thread/Schedule Message as AI Tool Setup Guide: <a href="${THREAD_SCHEDULE_MESSAGE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
						}
					: prop;

		const show = {
			...(Object(baseProperty.displayOptions) as { show?: Record<string, string[]> }).show,
		};

		// Thread schedule-message always uses the guided time-based path, so the thread
		// UI should not depend on hidden shared selector fields.
		if (show.scheduleMode?.length === 1 && show.scheduleMode[0] === 'time') {
			delete show.scheduleMode;
		}
		if (
			show.scheduleFieldVisibility?.length === 1 &&
			show.scheduleFieldVisibility[0] === 'guided'
		) {
			delete show.scheduleFieldVisibility;
		}

		return {
			...baseProperty,
			displayOptions: {
				...baseProperty.displayOptions,
				show: {
					...show,
					resource: ['thread'],
					operation: ['scheduleMessage'],
				},
			},
		};
	});

// Export combined description for thread resource
export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['thread'],
			},
		},
		options: [
			{
				name: 'Add Followers',
				value: 'addFollowers',
				description: 'Add users as followers to a thread',
				action: 'Add thread followers',
			},
			{
				name: 'Auto Follow',
				value: 'autoFollow',
				description: 'Enable or disable automatic thread following in a channel',
				action: 'Update channel auto follow for threads',
			},
			{
				name: 'Create Thread',
				value: 'create',
				description: 'Create a new thread from a message',
				action: 'Create a thread',
			},
			{
				name: 'Follow Thread',
				value: 'follow',
				description: 'Follow a thread (current user)',
				action: 'Follow a thread',
			},
			{
				name: 'Get Followers',
				value: 'getFollowers',
				description: 'Get the list of users following a thread',
				action: 'Get thread followers',
			},
			{
				name: 'Get Main Message',
				value: 'getMainMessage',
				description: 'Get the main message that started a thread',
				action: 'Get thread main message',
			},
			{
				name: 'Get Non Followers',
				value: 'getNonFollowers',
				description: 'Get the list of channel members not following a thread',
				action: 'Get thread non followers',
			},
			{
				name: 'List Threads for Channel',
				value: 'list',
				description: 'Get a list of threads for a channel',
				action: 'List threads for channel',
			},
			{
				name: 'Post to Thread',
				value: 'post',
				description: 'Post a message to an existing thread',
				action: 'Post to a thread',
			},
			{
				name: 'Remove Followers',
				value: 'removeFollowers',
				description: 'Remove users from following a thread',
				action: 'Remove thread followers',
			},
			{
				name: 'Schedule Message',
				value: 'scheduleMessage',
				description: 'Schedule a message to be sent in a thread',
				action: 'Schedule a message in thread',
			},
			{
				name: 'Unfollow Thread',
				value: 'unfollow',
				description: 'Unfollow a thread (current user)',
				action: 'Unfollow a thread',
			},
			{
				name: 'Update State',
				value: 'updateState',
				description: 'Close or reopen a thread',
				action: 'Update thread state',
			},
		],
		default: 'list',
	},
	...create.description,
	...post.description,
	...list.description,
	...autoFollow.description,
	...getFollowers.description,
	...getNonFollowers.description,
	...addFollowers.description,
	...removeFollowers.description,
	...follow.description,
	...unfollow.description,
	...updateState.description,
	...getMainMessage.description,
	...threadScheduleMessageDescription,
];
