import type { INodeProperties } from 'n8n-workflow';

import * as getRecordingDetails from './getRecordingDetails.operation';
import * as listCallRecordings from './listCallRecordings.operation';

export { listCallRecordings, getRecordingDetails };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['callsMeeting'],
			},
		},
		options: [
			{
				name: 'Get Recording Participants & Details',
				value: 'getRecordingDetails',
				description: 'Get participant details for a media session recording',
				action: 'Get recording participants and details',
			},
			{
				name: 'List Call Recordings',
				value: 'listCallRecordings',
				description: 'List media session history and recordings',
				action: 'List call recordings',
			},
		],
		default: 'listCallRecordings',
	},
	...listCallRecordings.description,
	...getRecordingDetails.description,
];
