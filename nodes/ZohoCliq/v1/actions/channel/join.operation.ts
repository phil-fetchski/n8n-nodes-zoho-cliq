/**
 * Join Channel operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_JOIN_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId } from '../../helpers/utils';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { runChannelIdLookupPreflightGate } from '../shared/preflight';
import { pushChannelRecoverableError } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Channel ID',
		name: 'channelId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Unique channel ID to join as the current user. Use canonical channel ID (for example, CT_...).',
		placeholder: 'e.g. CT_2230642524712404875_64396981',
	},
	...getSimplifyParameters('channel', 'channel', 'join'),
	{
		displayName:
			'Join Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Join_a_Channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'joinChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Join Channel as AI Tool Setup Guide: <a href="${CHANNEL_JOIN_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'joinChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['join'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'join');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelId = this.getNodeParameter('channelId', i) as string;
			requestedChannelId = channelId.trim();

			const sanitizedId = validateChannelId(this, channelId, i);
			await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedId);

			const response = await zohoCliqApiRequest.call(
				this,
				'POST',
				`/api/v2/channels/${encodeURIComponent(sanitizedId)}/join`,
			);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('channel');
			const simplified = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
			);

			const json = {
				success: true,
				operation: 'join_channel',
				channel_id: sanitizedId,
				...simplified,
			};

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'join', error, {
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
