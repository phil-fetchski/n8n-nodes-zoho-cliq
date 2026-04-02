import type { INodeProperties } from 'n8n-workflow';

export function createListSlideProperties(
	buttonCollectionValues: INodeProperties[],
): INodeProperties[] {
	return [
		{
			displayName:
				'List Component Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#attaching_content_list" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a>',
			name: 'listComponentDocsNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['list'] } },
		},
		{
			displayName: 'List Title',
			name: 'title',
			type: 'string',
			default: '',
			description: 'Optional title shown above this list component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['list'] } },
		},
		{
			displayName: 'Include',
			name: 'enabled',
			type: 'boolean',
			default: true,
			description: 'Whether to include this component. Supports expressions for IF-like behavior.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['list'] } },
		},
		{
			displayName: 'List Items',
			name: 'listItems',
			type: 'fixedCollection',
			placeholder: 'Add List Item',
			typeOptions: { multipleValues: true },
			default: {},
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['list'],
				},
			},
			options: [
				{
					name: 'item',
					displayName: 'Item',
					values: [
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
							required: true,
						},
					],
				},
			],
		},
		{
			displayName: 'List Buttons',
			name: 'listButtons',
			type: 'fixedCollection',
			placeholder: 'Add List Button',
			typeOptions: { multipleValues: true },
			default: {},
			description: 'Currently no buttons added for this component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['list'] } },
			options: [
				{
					name: 'button',
					displayName: 'Button',
					values: buttonCollectionValues,
				},
			],
		},
		{
			displayName: 'Change List Item Style',
			name: 'listChangeItemStyle',
			type: 'boolean',
			default: false,
			description: 'Whether to enable explicit list marker style settings',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['list'] } },
		},
		{
			displayName:
				'List style markers are accepted by the Cliq API but may render inconsistently across Cliq clients. Keeping this disabled is recommended.',
			name: 'listStyleRenderNotice',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['list'],
					listChangeItemStyle: [true],
				},
			},
		},
		{
			displayName: 'List Style',
			name: 'listStyleType',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Circle', value: 'circle' },
				{ name: 'Decimal', value: 'decimal' },
				{ name: 'Disc', value: 'disc' },
				{ name: 'Lower Alpha', value: 'lower-alpha' },
				{ name: 'Lower Roman', value: 'lower-roman' },
				{ name: 'Square', value: 'square' },
				{ name: 'Upper Alpha', value: 'upper-alpha' },
				{ name: 'Upper Roman', value: 'upper-roman' },
			],
			default: 'disc',
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['list'],
					listChangeItemStyle: [true],
				},
			},
		},
	];
}
