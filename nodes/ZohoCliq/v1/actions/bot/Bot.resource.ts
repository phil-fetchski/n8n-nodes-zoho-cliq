/**
 * Bot resource
 * Handles bot subscriber retrieval and bot call trigger operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as getSubscribers from './getSubscribers.operation';
import * as triggerCalls from './triggerCalls.operation';

export { getSubscribers, triggerCalls };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['bot'],
			},
		},
		options: [
			{
				name: 'Retrieve Bot Subscribers',
				value: 'getSubscribers',
				description: 'Get list of users currently subscribed to a bot',
				action: 'Retrieve bot subscribers',
			},
			{
				name: 'Trigger Bot Calls',
				value: 'triggerCalls',
				description: 'Trigger voice calls to users via bot',
				action: 'Trigger bot calls',
			},
		],
		default: 'getSubscribers',
	},
	...getSubscribers.description,
	...triggerCalls.description,
];
