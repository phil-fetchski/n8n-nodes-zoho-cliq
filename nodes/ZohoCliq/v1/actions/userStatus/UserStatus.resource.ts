/**
 * User Status resource
 * Handles user status management operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as clearMyStatus from './clearMyStatus.operation';
import * as create from './create.operation';
import * as createTransient from './createTransient.operation';
import * as del from './delete.operation';
import * as getCurrent from './getCurrent.operation';
import * as getUserStatus from './getUserStatus.operation';
import * as list from './list.operation';
import * as setCurrent from './setCurrent.operation';

export {
	clearMyStatus,
	create,
	createTransient,
	del as delete,
	getCurrent,
	getUserStatus,
	list,
	setCurrent,
};

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['userStatus'],
			},
		},
		options: [
			{
				name: 'Add a New Status',
				value: 'create',
				description: 'Create a reusable custom status',
				action: 'Add a new status',
			},
			{
				name: 'Add a Transient Status',
				value: 'createTransient',
				description: 'Set a temporary status using code, message, and expiry timestamp',
				action: 'Add a transient status',
			},
			{
				name: 'Delete Status',
				value: 'delete',
				description: 'Delete a reusable status by status ID',
				action: 'Delete a status',
			},
			{
				name: 'Delete Transient Status',
				value: 'clearMyStatus',
				description: 'Delete your currently active transient (ephemeral) status',
				action: 'Delete transient status',
			},
			{
				name: "Retrieve a User's Status",
				value: 'getUserStatus',
				description: 'Get current chat status for another user by user ID',
				action: 'Retrieve user status',
			},
			{
				name: 'Retrieve All Statuses',
				value: 'list',
				description: 'List all reusable custom statuses for the authenticated user',
				action: 'Retrieve all statuses',
			},
			{
				name: 'Retrieve Current Status',
				value: 'getCurrent',
				description: 'Get your current status',
				action: 'Retrieve current status',
			},
			{
				name: 'Update Current Status',
				value: 'setCurrent',
				description: 'Set an existing reusable status as your current status',
				action: 'Update current status',
			},
		],
		default: 'list',
	},
	...clearMyStatus.description,
	...create.description,
	...createTransient.description,
	...del.description,
	...getCurrent.description,
	...getUserStatus.description,
	...list.description,
	...setCurrent.description,
];
