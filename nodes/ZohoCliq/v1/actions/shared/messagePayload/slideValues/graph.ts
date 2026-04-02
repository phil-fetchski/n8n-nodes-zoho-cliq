import type { INodeProperties } from 'n8n-workflow';

export function createGraphSlideProperties(
	buttonCollectionValues: INodeProperties[],
): INodeProperties[] {
	return [
		{
			displayName:
				'Graph Component Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#attaching_content_charts" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a>',
			name: 'graphComponentDocsNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
		},
		{
			displayName: 'Graph Title',
			name: 'title',
			type: 'string',
			default: '',
			description: 'Optional title shown above this graph component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
		},
		{
			displayName: 'Include',
			name: 'enabled',
			type: 'boolean',
			default: true,
			description: 'Whether to include this component. Supports expressions for IF-like behavior.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
		},
		{
			displayName: 'Graph Style',
			name: 'graphPreview',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Trend', value: 'trend' },
				{ name: 'Vertical Bar', value: 'vertical_bar' },
				{ name: 'Vertical Stacked Bar', value: 'vertical_stacked_bar' },
			],
			default: 'trend',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
		},
		{
			displayName: 'X-Axis Title',
			name: 'graphXAxisTitle',
			type: 'string',
			default: '',
			description: 'Optional horizontal axis title (max 20 chars)',
			typeOptions: { maxLength: 20 },
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
		},
		{
			displayName: 'Y-Axis Title',
			name: 'graphYAxisTitle',
			type: 'string',
			default: '',
			description: 'Optional vertical axis title (max 20 chars)',
			typeOptions: { maxLength: 20 },
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
		},
		{
			displayName: 'Graph Categories',
			name: 'graphCategories',
			type: 'fixedCollection',
			placeholder: 'Add Category',
			typeOptions: { multipleValues: true },
			default: {},
			description:
				'Up to 5 categories. Each category supports up to 20 value points (label + numeric value).',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
			options: [
				{
					name: 'category',
					displayName: 'Category',
					values: [
						{
							displayName: 'Category Name',
							name: 'category',
							type: 'string',
							default: '',
							required: true,
							typeOptions: { maxLength: 20 },
						},
						{
							displayName: 'Values',
							name: 'values',
							type: 'fixedCollection',
							placeholder: 'Add Value Point',
							typeOptions: { multipleValues: true },
							default: {},
							options: [
								{
									name: 'value',
									displayName: 'Value Point',
									values: [
										{
											displayName: 'Label',
											name: 'label',
											type: 'string',
											default: '',
											required: true,
											typeOptions: { maxLength: 20 },
										},
										{
											displayName: 'Value',
											name: 'value',
											type: 'number',
											default: 0,
											required: true,
										},
									],
								},
							],
						},
					],
				},
			],
		},
		{
			displayName: 'Graph Buttons',
			name: 'graphButtons',
			type: 'fixedCollection',
			placeholder: 'Add Graph Button',
			typeOptions: { multipleValues: true },
			default: {},
			description: 'Currently no buttons added for this component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['graph'] } },
			options: [
				{
					name: 'button',
					displayName: 'Button',
					values: buttonCollectionValues,
				},
			],
		},
	];
}
