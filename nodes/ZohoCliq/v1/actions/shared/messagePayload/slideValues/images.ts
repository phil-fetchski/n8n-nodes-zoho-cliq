import type { INodeProperties } from 'n8n-workflow';

export function createImagesSlideProperties(
	buttonCollectionValues: INodeProperties[],
): INodeProperties[] {
	return [
		{
			displayName:
				'Images Component Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#attaching_content_images" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a>',
			name: 'imagesComponentDocsNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['images'] } },
		},
		{
			displayName: 'Images Title',
			name: 'title',
			type: 'string',
			default: '',
			description: 'Optional title shown above this images component',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['images'] } },
		},
		{
			displayName: 'Include',
			name: 'enabled',
			type: 'boolean',
			default: true,
			description: 'Whether to include this component. Supports expressions for IF-like behavior.',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['images'] } },
		},
		{
			displayName: 'Image URLs',
			name: 'imageUrls',
			type: 'fixedCollection',
			placeholder: 'Add Image URL',
			typeOptions: { multipleValues: true, sortable: true },
			default: {},
			description:
				'Use publicly reachable secure image URLs only (HTTPS). Private or HTTP URLs may not render.',
			displayOptions: {
				show: {
					slideInputMode: ['structured'],
					type: ['images'],
				},
			},
			options: [
				{
					name: 'imageUrl',
					displayName: 'Image URL',
					values: [
						{
							displayName: 'URL',
							name: 'url',
							type: 'string',
							default: '',
						},
					],
				},
			],
		},
		{
			displayName: 'Images Buttons',
			name: 'imagesButtons',
			type: 'fixedCollection',
			placeholder: 'Add Images Button',
			typeOptions: { multipleValues: true, sortable: true },
			default: {},
			description: 'Optional buttons to display below the images slide',
			displayOptions: { show: { slideInputMode: ['structured'], type: ['images'] } },
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
