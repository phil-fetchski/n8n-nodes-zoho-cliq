import type { INodeProperties } from 'n8n-workflow';

import { createChartSlideProperties } from './slideValues/chart';
import { createGraphSlideProperties } from './slideValues/graph';
import { createImagesSlideProperties } from './slideValues/images';
import { createLabelSlideProperties } from './slideValues/label';
import { createListSlideProperties } from './slideValues/list';
import { createTableSlideProperties } from './slideValues/table';
import { createTextSlideProperties } from './slideValues/text';

export function createSlideCollectionValues(
	buttonCollectionValues: INodeProperties[],
	textSlideMaxLength: number,
): INodeProperties[] {
	return [
		{
			displayName: 'Input Mode',
			name: 'slideInputMode',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Using Fields Below', value: 'structured' },
				{ name: 'Using JSON', value: 'raw' },
			],
			default: 'structured',
		},
		{
			displayName: 'Component JSON',
			name: 'rawSlide',
			type: 'json',
			default: '{}',
			description: 'Raw component object (for example type/title/data/buttons)',
			displayOptions: { show: { slideInputMode: ['raw'] } },
		},
		{
			displayName: 'Component Type',
			name: 'type',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Chart', value: 'percentage_chart' },
				{ name: 'Graph', value: 'graph' },
				{ name: 'Images', value: 'images' },
				{ name: 'Label', value: 'label' },
				{ name: 'List', value: 'list' },
				{ name: 'Table', value: 'table' },
				{ name: 'Text', value: 'text' },
			],
			default: 'text',
			displayOptions: { show: { slideInputMode: ['structured'] } },
		},
		...createChartSlideProperties(buttonCollectionValues),
		...createGraphSlideProperties(buttonCollectionValues),
		...createImagesSlideProperties(buttonCollectionValues),
		...createLabelSlideProperties(buttonCollectionValues),
		...createListSlideProperties(buttonCollectionValues),
		...createTableSlideProperties(buttonCollectionValues),
		...createTextSlideProperties(buttonCollectionValues, textSlideMaxLength),
	];
}
