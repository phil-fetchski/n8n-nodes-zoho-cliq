/**
 * Remote Work resource
 * Handles remote work status and attendance operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as checkIn from './checkIn.operation';
import * as checkOut from './checkOut.operation';
import * as getStatus from './getStatus.operation';

export { checkIn, checkOut, getStatus };

export const description: INodeProperties[] = [
	{
		displayName:
			'Remote Work + Zoho People: If your org uses Zoho People integration, enable the Zoho People scope pack in credentials and reconnect to authorize enhanced remote work data.',
		name: 'remoteWorkZohoPeopleNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['remoteWork'],
			},
		},
	},
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['remoteWork'],
			},
		},
		options: [
			{
				name: 'Check In',
				value: 'checkIn',
				description: 'Check in for remote work',
				action: 'Check in for remote work',
			},
			{
				name: 'Check Out',
				value: 'checkOut',
				description: 'Check out from remote work',
				action: 'Check out from remote work',
			},
			{
				name: 'Get Remote Work Status',
				value: 'getStatus',
				description: 'Get your remote work status and availability details',
				action: 'Get remote work status',
			},
		],
		default: 'getStatus',
	},
	...checkIn.description,
	...checkOut.description,
	...getStatus.description,
];
