/**
 * Reaction resource
 * Handles reaction-related operations
 */

import type { INodeProperties } from 'n8n-workflow';
import * as get from './get.operation';
import * as add from './add.operation';
import * as remove from './remove.operation';

// Export all reaction operations
export { get, add, remove };

// Export combined description for reaction resource
export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['reaction'],
			},
		},
		options: [
			{
				name: 'Add Reaction',
				value: 'add',
				description: 'Add a reaction to a message',
				action: 'Add a reaction',
			},
			{
				name: 'Get Reactions',
				value: 'get',
				description: 'Get all reactions for a message',
				action: 'Get reactions',
			},
			{
				name: 'Remove Reaction',
				value: 'remove',
				description: 'Remove a reaction from a message',
				action: 'Remove a reaction',
			},
		],
		default: 'get',
	},
	...get.description,
	...add.description,
	...remove.description,
];
