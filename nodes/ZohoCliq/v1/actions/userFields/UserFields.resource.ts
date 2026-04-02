/**
 * User Fields resource
 * Handles user field management operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as del from './delete.operation';
import * as get from './get.operation';
import * as list from './list.operation';
import * as update from './update.operation';

export { create, del as delete, get, list, update };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['userField'],
			},
		},
		hint: 'User Fields operations manage profile field schema definitions in Cliq (field metadata/configuration), not user profile data rows.',
		options: [
			{
				name: 'Add a User Field',
				value: 'create',
				description:
					'Create a user-field schema definition (profile field configuration), not a user record',
				action: 'Add a user field schema definition',
			},
			{
				name: 'Delete a User Field',
				value: 'delete',
				description: 'Delete a user-field schema definition by field ID, not a user profile value',
				action: 'Delete a user field schema definition',
			},
			{
				name: 'Retrieve a Particular User Field',
				value: 'get',
				description:
					'Retrieve one user-field schema definition by field ID (field metadata/configuration)',
				action: 'Retrieve a user field schema definition',
			},
			{
				name: 'Retrieve All User Fields',
				value: 'list',
				description: 'List all user-field schema definitions configured in Cliq for user profiles',
				action: 'Retrieve all user field schema definitions',
			},
			{
				name: 'Update User Field Details',
				value: 'update',
				description:
					'Update a user-field schema definition (name/options/rules), not user profile data',
				action: 'Update a user field schema definition',
			},
		],
		default: 'list',
	},
	...create.description,
	...del.description,
	...get.description,
	...list.description,
	...update.description,
];
