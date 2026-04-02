import type { INodeProperties } from 'n8n-workflow';

import * as addOrUpdateTicker from './addOrUpdateTicker.operation';
import * as deleteTicker from './deleteTicker.operation';

export { addOrUpdateTicker, deleteTicker };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['widgetMapTicker'],
			},
		},
		options: [
			{
				name: 'Add or Update Ticker',
				value: 'addOrUpdateTicker',
				description: 'Add a new ticker or update an existing ticker in a widget map',
				action: 'Add or update a map ticker',
			},
			{
				name: 'Delete Ticker',
				value: 'deleteTicker',
				description: 'Delete one or more existing tickers from a widget map',
				action: 'Delete map tickers',
			},
		],
		default: 'addOrUpdateTicker',
	},
	...addOrUpdateTicker.description,
	...deleteTicker.description,
];
