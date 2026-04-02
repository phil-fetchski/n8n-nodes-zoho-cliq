/**
 * Team resource
 * Handles team management operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as addMembers from './addMembers.operation';
import * as create from './create.operation';
import * as del from './delete.operation';
import * as get from './get.operation';
import * as getMembers from './getMembers.operation';
import * as list from './list.operation';
import * as removeMembers from './removeMembers.operation';
import * as update from './update.operation';

export { addMembers, create, del as delete, get, getMembers, list, removeMembers, update };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['team'],
			},
		},
		options: [
			{
				name: 'Add Team Members',
				value: 'addMembers',
				description: 'Add members to a team',
				action: 'Add team members',
			},
			{
				name: 'Create Team',
				value: 'create',
				description: 'Create a team in the organization',
				action: 'Create a team',
			},
			{
				name: 'Delete Team',
				value: 'delete',
				description: 'Delete a team',
				action: 'Delete a team',
			},
			{
				name: 'Delete Team Members',
				value: 'removeMembers',
				description: 'Delete members from a team',
				action: 'Delete team members',
			},
			{
				name: 'Get Team',
				value: 'get',
				description: 'Get detailed information for a team',
				action: 'Get a team',
			},
			{
				name: 'Get Team Members',
				value: 'getMembers',
				description: 'Get list of members in a team',
				action: 'Get team members',
			},
			{
				name: 'List Teams',
				value: 'list',
				description: 'Get teams in the organization',
				action: 'List teams',
			},
			{
				name: 'Update Team',
				value: 'update',
				description: 'Update a team',
				action: 'Update a team',
			},
		],
		default: 'list',
	},
	...addMembers.description,
	...create.description,
	...del.description,
	...get.description,
	...getMembers.description,
	...list.description,
	...removeMembers.description,
	...update.description,
];
