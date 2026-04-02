/**
 * Common reusable node property descriptions
 */

import type { INodeProperties } from 'n8n-workflow';

/**
 * Applies base displayOptions (resource + operation scoping) to a properties
 * array, deep-merging the `show` keys so that properties with their own
 * show conditions (e.g., `inputMode: ['structured']`) retain those conditions
 * alongside the base resource/operation scoping.
 */
export function applyDisplayOptions(
	properties: INodeProperties[],
	baseDisplayOptions: { show: Record<string, string[]> },
): INodeProperties[] {
	return properties.map((property) => ({
		...property,
		displayOptions: {
			...baseDisplayOptions,
			...property.displayOptions,
			show: {
				...baseDisplayOptions.show,
				...(Object(property.displayOptions) as { show?: Record<string, string[]> }).show,
			},
		},
	}));
}

export const messageChatIdDescription =
	'The Chat ID that contains the message. This is not a Channel ID or Thread ID; channels and threads each have their own Chat ID, and only that Chat ID is accepted here.';

/**
 * Resource Locator Component for Channel selection
 */
export const channelRLC: INodeProperties = {
	displayName: 'Channel',
	name: 'channelId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'Choose a channel from the list, or specify a Channel ID or unique name using an <a href="https://docs.n8n.io/code/expressions/" target="_blank">expression</a>',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchChannels',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. C1234567890',
		},
		{
			displayName: 'By Unique Name',
			name: 'name',
			type: 'string',
			placeholder: 'e.g. my-channel',
		},
	],
};

/**
 * Resource Locator Component for Channel ID-only selection.
 * Use this for endpoints that do not accept channel unique name.
 */
export const channelIdOnlyRLC: INodeProperties = {
	displayName: 'Channel',
	name: 'channelId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'Choose a channel from the list, or specify a Channel ID using an <a href="https://docs.n8n.io/code/expressions/" target="_blank">expression</a>',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchChannels',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. CT_2230642524712404875_64396981',
		},
	],
};
