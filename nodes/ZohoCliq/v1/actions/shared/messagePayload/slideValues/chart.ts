import type { INodeProperties } from 'n8n-workflow';

export function createChartSlideProperties(
	buttonCollectionValues: INodeProperties[],
): INodeProperties[] {
	return [
		{
			displayName:
				'Chart Component Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#attaching_content_charts" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a>',
			name: 'chartComponentDocsNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['percentage_chart'] } },
		},
		{
			displayName: 'Chart Title',
			name: 'title',
			type: 'string',
			default: '',
			description: 'Optional title shown above this chart component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['percentage_chart'] } },
		},
		{
			displayName: 'Include',
			name: 'enabled',
			type: 'boolean',
			default: true,
			description: 'Whether to include this component. Supports expressions for IF-like behavior.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['percentage_chart'] } },
		},
		{
			displayName: 'Chart Style',
			name: 'chartPreview',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Doughnut', value: 'doughnut' },
				{ name: 'Pie', value: 'pie' },
				{ name: 'Semi Doughnut', value: 'semi_doughnut' },
			],
			default: 'doughnut',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['percentage_chart'] } },
		},
		{
			displayName: 'Chart Data Points',
			name: 'chartDataPoints',
			type: 'fixedCollection',
			placeholder: 'Add Chart Segment',
			typeOptions: { multipleValues: true, maxValues: 5 },
			default: {},
			description:
				'Up to 5 segments. Values must be numbers and must total 100 for reliable chart rendering.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['percentage_chart'] } },
			options: [
				{
					name: 'point',
					displayName: 'Segment',
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
		{
			displayName: 'Chart Buttons',
			name: 'chartButtons',
			type: 'fixedCollection',
			placeholder: 'Add Chart Button',
			typeOptions: { multipleValues: true },
			default: {},
			description: 'Currently no buttons added for this component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['percentage_chart'] } },
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
