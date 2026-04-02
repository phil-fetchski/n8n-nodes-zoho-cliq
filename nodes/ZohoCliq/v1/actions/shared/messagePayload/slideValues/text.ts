import type { INodeProperties } from 'n8n-workflow';
import { textSlideMaxLength as defaultTextSlideMaxLength } from '../constants';

export function createTextSlideProperties(
	buttonCollectionValues: INodeProperties[],
	textSlideMaxLength: number,
): INodeProperties[] {
	const normalizedMaxLength =
		typeof textSlideMaxLength === 'number' && Number.isFinite(textSlideMaxLength)
			? textSlideMaxLength
			: defaultTextSlideMaxLength;
	const textContentTypeOptions = { rows: 4, maxLength: normalizedMaxLength };
	const textContentMaxLength = normalizedMaxLength;

	return [
		{
			displayName:
				'Text Component Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#attaching_content" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a>',
			name: 'textComponentDocsNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['text'] } },
		},
		{
			displayName: 'Text Title',
			name: 'title',
			type: 'string',
			default: '',
			description: 'Optional title shown above this text component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['text'] } },
		},
		{
			displayName: 'Include',
			name: 'enabled',
			type: 'boolean',
			default: true,
			description: 'Whether to include this component. Supports expressions for IF-like behavior.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['text'] } },
		},
		{
			displayName: 'Text Content',
			name: 'textData',
			type: 'string',
			typeOptions: textContentTypeOptions,
			default: '',
			description: `Text slide content (max ${textContentMaxLength} chars)`,
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['text'],
				},
			},
		},
		{
			displayName: 'Text Buttons',
			name: 'textButtons',
			type: 'fixedCollection',
			placeholder: 'Add Text Button',
			typeOptions: { multipleValues: true },
			default: {},
			description: 'Buttons to include with this component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['text'] } },
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
