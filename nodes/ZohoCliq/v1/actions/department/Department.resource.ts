/**
 * Department resource
 * Handles department management operations
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
				resource: ['department'],
			},
		},
		options: [
			{
				name: 'Add Department Members',
				value: 'addMembers',
				description: 'Add members to a department',
				action: 'Add department members',
			},
			{
				name: 'Create Department',
				value: 'create',
				description: 'Create a department in the organization',
				action: 'Create a department',
			},
			{
				name: 'Delete Department',
				value: 'delete',
				description: 'Delete a department',
				action: 'Delete a department',
			},
			{
				name: 'Get Department',
				value: 'get',
				description: 'Get detailed information for a department',
				action: 'Get a department',
			},
			{
				name: 'Get Department Members',
				value: 'getMembers',
				description: 'Get list of members in a department',
				action: 'Get department members',
			},
			{
				name: 'List Departments',
				value: 'list',
				description: 'Get departments in the organization',
				action: 'List departments',
			},
			{
				name: 'Remove Department Members',
				value: 'removeMembers',
				description: 'Remove members from a department',
				action: 'Remove department members',
			},
			{
				name: 'Update Department',
				value: 'update',
				description: 'Update a department',
				action: 'Update a department',
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
