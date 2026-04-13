import type { INodeProperties } from 'n8n-workflow';

export function createTableSlideProperties(
	buttonCollectionValues: INodeProperties[],
): INodeProperties[] {
	return [
		{
			displayName:
				'Table Component Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#attaching_content_table" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a>',
			name: 'tableComponentDocsNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['table'] } },
		},
		{
			displayName: 'Table Title',
			name: 'title',
			type: 'string',
			default: '',
			description: 'Optional title shown above this table component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['table'] } },
		},
		{
			displayName: 'Include',
			name: 'enabled',
			type: 'boolean',
			default: true,
			description: 'Whether to include this component. Supports expressions for IF-like behavior.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['table'] } },
		},
		{
			displayName: 'Table Columns',
			name: 'tableHeaders',
			type: 'fixedCollection',
			placeholder: 'Add Column',
			typeOptions: { multipleValues: true, sortable: true },
			default: {},
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['table'],
				},
			},
			options: [
				{
					name: 'header',
					displayName: 'Column',
					values: [
						{
							displayName: 'Header Name',
							name: 'name',
							type: 'string',
							default: '',
							required: true,
						},
					],
				},
			],
		},
		{
			displayName: 'Table Rows',
			name: 'tableRows',
			type: 'fixedCollection',
			placeholder: 'Add Row',
			typeOptions: { multipleValues: true, sortable: true },
			default: {},
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['table'],
				},
			},
			options: [
				{
					name: 'row',
					displayName: 'Row',
					values: [
						{
							displayName: 'Values',
							name: 'values',
							type: 'fixedCollection',
							placeholder: 'Add Cell',
							typeOptions: { multipleValues: true, sortable: true },
							default: {},
							options: [
								{
									name: 'entry',
									displayName: 'Cell',
									values: [
										{
											displayName: 'Column Name',
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
					],
				},
			],
		},
		{
			displayName: 'Table Buttons',
			name: 'tableButtons',
			type: 'fixedCollection',
			placeholder: 'Add Table Button',
			typeOptions: { multipleValues: true, sortable: true },
			default: {},
			description: 'Configure buttons to display for this table component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['table'] } },
			options: [
				{
					name: 'button',
					displayName: 'Button',
					values: buttonCollectionValues,
				},
			],
		},
		{
			displayName: 'Adjust Table Style Params',
			name: 'tableAdjustStyles',
			type: 'boolean',
			default: false,
			description: 'Whether to enable advanced styles for width and sticky row/column behavior',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['table'] } },
		},
		{
			displayName:
				'Table style parameters are accepted by the Cliq API but may render inconsistently across Cliq clients.',
			name: 'tableStyleRenderNotice',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['table'],
					tableAdjustStyles: [true],
				},
			},
		},
		{
			displayName: 'Column Widths (CSV)',
			name: 'tableStyleWidths',
			type: 'string',
			default: '',
			placeholder: 'e.g. 10, 90',
			description:
				'Comma-separated width percentage values (one per column; total must equal 100). Example: 10, 90.',
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['table'],
					tableAdjustStyles: [true],
				},
			},
		},
		{
			displayName: 'Freeze Rows',
			name: 'tableStickyRows',
			type: 'number',
			default: 0,
			description: 'Number of top rows to freeze (0-2)',
			typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 0 },
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['table'],
					tableAdjustStyles: [true],
				},
			},
		},
		{
			displayName: 'Freeze Columns',
			name: 'tableStickyColumns',
			type: 'number',
			default: 0,
			description: 'Number of left columns to freeze (0-2)',
			typeOptions: { minValue: 0, maxValue: 2, numberPrecision: 0 },
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['table'],
					tableAdjustStyles: [true],
				},
			},
		},
	];
}
