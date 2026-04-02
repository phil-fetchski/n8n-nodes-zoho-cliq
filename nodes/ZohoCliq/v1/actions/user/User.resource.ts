/**
 * User resource
 * Handles user-related operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as get from './get.operation';
import * as listLayouts from './listLayouts.operation';
import * as getTeams from './getTeams.operation';
import * as list from './list.operation';
import * as update from './update.operation';

export { create, get, getTeams, list, listLayouts, update };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['user'],
			},
		},
		options: [
			{
				name: 'Create User',
				value: 'create',
				description: 'Create a user in the organization',
				action: 'Create a user',
			},
			{
				name: 'Get User',
				value: 'get',
				description: 'Get detailed information for a user',
				action: 'Get a user',
			},
			{
				name: 'Get User Teams',
				value: 'getTeams',
				description: 'Get teams for a specific user',
				action: 'Get teams of a user',
			},
			{
				name: 'List User Layouts',
				value: 'listLayouts',
				description: 'Get available user profile layouts',
				action: 'List user layouts',
			},
			{
				name: 'List Users',
				value: 'list',
				description: 'Get users in the organization',
				action: 'List users',
			},
			{
				name: 'Update User',
				value: 'update',
				description: 'Update profile details for a user',
				action: 'Update a user',
			},
		],
		default: 'list',
	},
	...create.description,
	...get.description,
	...getTeams.description,
	...list.description,
	...listLayouts.description,
	...update.description,
];
