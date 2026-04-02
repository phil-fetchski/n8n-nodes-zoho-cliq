/**
 * Designation resource
 * Handles designation management operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as del from './delete.operation';
import * as addMembers from './addMembers.operation';
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
				resource: ['designation'],
			},
		},
		options: [
			{
				name: 'Add Designation Members',
				value: 'addMembers',
				description: 'Add one or more users to a designation',
				action: 'Add members to a designation',
			},
			{
				name: 'Create Designation',
				value: 'create',
				description: 'Create a designation in the organization',
				action: 'Create a designation',
			},
			{
				name: 'Delete Designation',
				value: 'delete',
				description: 'Delete a designation',
				action: 'Delete a designation',
			},
			{
				name: 'Get Designation',
				value: 'get',
				description: 'Get detailed information for a designation',
				action: 'Get a designation',
			},
			{
				name: 'Get Designation Members',
				value: 'getMembers',
				description: 'Get list of members in a designation',
				action: 'Get designation members',
			},
			{
				name: 'List Designations',
				value: 'list',
				description: 'Get designations in the organization',
				action: 'List designations',
			},
			{
				name: 'Remove Designation Members',
				value: 'removeMembers',
				description: 'Remove one or more users from a designation',
				action: 'Remove members from a designation',
			},
			{
				name: 'Update Designation',
				value: 'update',
				description: 'Update a designation',
				action: 'Update a designation',
			},
		],
		default: 'list',
	},
	{
		displayName:
			'Note: Each user can hold only one designation at a time. Assigning a new designation automatically removes their previous designation.',
		name: 'designationSingleAssignmentNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['designation'],
			},
		},
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
