import type { INodeProperties } from 'n8n-workflow';

export function createLabelSlideProperties(
	buttonCollectionValues: INodeProperties[],
): INodeProperties[] {
	return [
		{
			displayName:
				'Label Component Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#attaching_content_label" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a>',
			name: 'labelComponentDocsNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['label'] } },
		},
		{
			displayName: 'Label Title',
			name: 'title',
			type: 'string',
			default: '',
			description: 'Optional title shown above this label component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['label'] } },
		},
		{
			displayName: 'Include',
			name: 'enabled',
			type: 'boolean',
			default: true,
			description: 'Whether to include this component. Supports expressions for IF-like behavior.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['label'] } },
		},
		{
			displayName: 'Label Key:Value Pairs',
			name: 'labelDataPairs',
			type: 'fixedCollection',
			placeholder: 'Add Label Field',
			typeOptions: { multipleValues: true, sortable: true },
			default: {},
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['label'],
				},
			},
			options: [
				{
					name: 'pair',
					displayName: 'Field',
					values: [
						{
							displayName: 'Key',
							name: 'key',
							type: 'string',
							default: '',
							required: true,
						},
						{
							displayName: 'Value',
							name: 'value',
							type: 'string',
							default: '',
						},
					],
				},
			],
		},
		{
			displayName: 'Label Buttons',
			name: 'labelButtons',
			type: 'fixedCollection',
			placeholder: 'Add Label Button',
			typeOptions: { multipleValues: true, sortable: true },
			default: {},
			description: 'Currently no buttons added for this component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['label'] } },
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
