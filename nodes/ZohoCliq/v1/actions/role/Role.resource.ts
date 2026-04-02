/**
 * Role resource
 * Handles role management operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as addUsers from './addUsers.operation';
import * as addPermissions from './addPermissions.operation';
import * as buildPermissionsJsonPayload from './buildPermissionsJsonPayload.operation';
import * as create from './create.operation';
import * as del from './delete.operation';
import * as get from './get.operation';
import * as getPermissions from './getPermissions.operation';
import * as getUsers from './getUsers.operation';
import * as list from './list.operation';
import * as removePermissions from './removePermissions.operation';
import * as removeUsers from './removeUsers.operation';
import * as update from './update.operation';
import * as updatePermissions from './updatePermissions.operation';

export {
	addPermissions,
	addUsers,
	buildPermissionsJsonPayload,
	create,
	del as delete,
	get,
	getPermissions,
	getUsers,
	list,
	removePermissions,
	removeUsers,
	update,
	updatePermissions,
};

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['role'],
			},
		},
		options: [
			{
				name: 'Add Role Permissions',
				value: 'addPermissions',
				description: 'Enable selected permissions for a role',
				action: 'Add role permissions',
			},
			{
				name: 'Add Users To Role',
				value: 'addUsers',
				description: 'Add users to a role',
				action: 'Add users to a role',
			},
			{
				name: 'Build Permissions JSON Payload',
				value: 'buildPermissionsJsonPayload',
				description: 'Build permissions update JSON without making an API call',
				action: 'Build permissions JSON payload',
			},
			{
				name: 'Create Role',
				value: 'create',
				description: 'Create a role in the organization',
				action: 'Create a role',
			},
			{
				name: 'Delete Role',
				value: 'delete',
				description: 'Delete a role',
				action: 'Delete a role',
			},
			{
				name: 'Get Role',
				value: 'get',
				description: 'Get detailed information for a role',
				action: 'Get a role',
			},
			{
				name: 'Get Role Permissions',
				value: 'getPermissions',
				description: 'Get permission settings for a role',
				action: 'Get role permissions',
			},
			{
				name: 'Get Users In Role',
				value: 'getUsers',
				description: 'Get list of users assigned to a role',
				action: 'Get users in a role',
			},
			{
				name: 'List Roles',
				value: 'list',
				description: 'Get roles in the organization',
				action: 'List roles',
			},
			{
				name: 'Remove Role Permissions',
				value: 'removePermissions',
				description: 'Disable selected permissions for a role',
				action: 'Remove role permissions',
			},
			{
				name: 'Remove Users From Role',
				value: 'removeUsers',
				description: 'Remove users from a role',
				action: 'Remove users from a role',
			},
			{
				name: 'Update Role',
				value: 'update',
				description: 'Update a role',
				action: 'Update a role',
			},
			{
				name: 'Update Role Permissions',
				value: 'updatePermissions',
				description: 'Update permission settings for a role',
				action: 'Update role permissions',
			},
		],
		default: 'list',
		hint: 'Role APIs are Organization Admin operations. Use an Organization Admin OAuth user and include the "Org Admin (Organization APIs)" scope pack.',
	},
	...addUsers.description,
	...addPermissions.description,
	...buildPermissionsJsonPayload.description,
	...create.description,
	...del.description,
	...get.description,
	...getPermissions.description,
	...getUsers.description,
	...list.description,
	...removePermissions.description,
	...removeUsers.description,
	...update.description,
	...updatePermissions.description,
];
