/**
 * OAuth Helper resource
 * Utility operations for credential/token diagnostics
 */

import type { INodeProperties } from 'n8n-workflow';

import * as getGrantedScopes from './getGrantedScopes.operation';
import * as listScopePacks from './listScopePacks.operation';
import * as checkScopePack from './checkScopePack.operation';

export { getGrantedScopes, listScopePacks, checkScopePack };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['oauthHelper'],
			},
		},
		options: [
			{
				name: 'Get Granted Scopes',
				value: 'getGrantedScopes',
				description:
					'Inspect OAuth scopes currently available to this credential and explain missing-scope failures',
				action: 'Get granted scopes',
			},
			{
				name: 'List Scope Packs',
				value: 'listScopePacks',
				description:
					'List available scope packs, included scopes, and which scopes are missing on the current token',
				action: 'List scope packs',
			},
			{
				name: 'Check Scope Pack',
				value: 'checkScopePack',
				description: 'Check whether the current token satisfies one selected scope pack',
				action: 'Check scope pack',
			},
		],
		default: 'getGrantedScopes',
	},
	...getGrantedScopes.description,
	...listScopePacks.description,
	...checkScopePack.description,
];
