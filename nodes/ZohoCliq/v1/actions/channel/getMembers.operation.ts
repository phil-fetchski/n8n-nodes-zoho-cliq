/**
 * Get Channel Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_GET_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId } from '../../helpers/utils';
import { applyDisplayOptions, channelIdOnlyRLC } from '../common.descriptions';
import { runChannelIdLookupPreflightGate } from '../shared/preflight';
import { buildExecutionItemsFromApiResponse } from '../shared/responseOutput';
import { pushChannelRecoverableError } from './shared';

const properties: INodeProperties[] = [
	channelIdOnlyRLC,
	{
		displayName:
			'Get Channel Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Get_Members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.READ</code>',
		name: 'getChannelMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Get Channel Members as AI Tool Setup Guide: <a href="${CHANNEL_GET_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getChannelMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['getMembers'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'getMembers');
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
				'GET',
				`/api/v2/channels/${encodeURIComponent(sanitizedId)}/members`,
			)) as IDataObject;

			const executionData = this.helpers.constructExecutionMetaData(
				buildExecutionItemsFromApiResponse(response, {
					arrayKey: 'members',
				}),
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'getMembers', error, {
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
