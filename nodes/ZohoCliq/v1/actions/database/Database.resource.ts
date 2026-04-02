/**
 * Cliq Database resource
 * Handles record operations for Cliq Database tables
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
				resource: ['database'],
			},
		},
		options: [
			{
				name: 'Create Record',
				value: 'create',
				description: 'Create a record in a Cliq Database storage',
				action: 'Create a database record',
			},
			{
				name: 'Delete Record',
				value: 'delete',
				description: 'Delete a record from a Cliq Database storage',
				action: 'Delete a database record',
			},
			{
				name: 'Get Record',
				value: 'get',
				description: 'Get a record by ID from a Cliq Database storage',
				action: 'Get a database record',
			},
			{
				name: 'List Records',
				value: 'list',
				description: 'List records in a Cliq Database storage',
				action: 'List database records',
			},
			{
				name: 'Update Record',
				value: 'update',
				description: 'Update a record in a Cliq Database storage',
				action: 'Update a database record',
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
