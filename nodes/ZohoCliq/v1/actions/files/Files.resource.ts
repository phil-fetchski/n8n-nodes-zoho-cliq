/**
 * Files resource
 */

import type { INodeProperties } from 'n8n-workflow';

import * as getFile from './getFile.operation';
import * as shareFile from './shareFile.operation';

export { getFile, shareFile };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['file'],
			},
		},
		options: [
			{
				name: 'Get File',
				value: 'getFile',
				description: 'Get a file using its file ID',
				action: 'Get a file',
			},
			{
				name: 'Share Files',
				value: 'shareFile',
				description: 'Share one or more files to channel/chat/bot/user targets',
				action: 'Share files',
			},
		],
		default: 'getFile',
	},
	...getFile.description,
	...shareFile.description,
];
