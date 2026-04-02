/**
 * Delete Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId } from '../../helpers/utils';
import { runChannelIdLookupPreflightGate } from '../shared/preflight';
import { pushChannelRecoverableError, resolveChannelEnhancedOutput } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

// Custom RLC for delete operation - API only accepts channel_id, not unique_name
const properties: INodeProperties[] = [
	{
		displayName: 'Channel',
		name: 'channelId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description:
			'The channel to delete. Note: This operation requires the channel ID, not the unique name.',
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
				validation: [
					{
						type: 'regex',
						properties: {
							regex: '^[a-zA-Z0-9_-]+$',
							errorMessage: 'Channel ID can only contain letters, numbers, hyphens and underscores',
						},
					},
				],
			},
		],
	},
	{
		displayName: 'Enable Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		description:
			"Whether to return workflow-friendly success metadata. Disable to return Cliq's standard response (typically empty for success).",
	},
	{
		displayName:
			'Delete Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Delete_a_channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.DELETE</code>',
		name: 'deleteChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Delete Channel as AI Tool Setup Guide: <a href="${CHANNEL_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['delete'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'delete');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelId = this.getNodeParameter('channelId', i, '', {
				extractValue: true,
			}) as string;
			requestedChannelId = channelId.trim();

			const sanitizedId = validateChannelId(this, channelId, i);
			await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedId);

			const response = (await zohoCliqApiRequest.call(
				this,
				'DELETE',
				`/api/v2/channels/${encodeURIComponent(sanitizedId)}`,
			)) as IDataObject;

			const { includeEnhancedOutput, responseJson, rawResponse } = resolveChannelEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									deleted: true,
									success: true,
									operation: 'delete_channel',
									channel_id: sanitizedId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'delete', error, {
					contextFields:
						requestedChannelId && requestedChannelId.length > 0
							? { channel_id: requestedChannelId }
							: undefined,
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
