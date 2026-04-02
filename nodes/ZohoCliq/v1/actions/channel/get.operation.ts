/**
 * Get Channel operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId, validateChannelName } from '../../helpers/utils';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
import { pushChannelRecoverableError, resolveChannelLocatorInput } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Channel',
		name: 'channelId',
		type: 'resourceLocator',
		default: { mode: 'list', value: '' },
		required: true,
		description:
			'Channel to retrieve. Workflow mode supports list, channel ID, or unique name. AI Tool mode must pass channel_id as the channel ID string only (for example, P5452022000000451001).',
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
				placeholder: 'e.g. P5452022000000451001',
			},
			{
				displayName: 'By Unique Name',
				name: 'name',
				type: 'string',
				placeholder: 'e.g. my-channel',
			},
		],
	},
	...getSimplifyParameters('channel', 'channel', 'get'),
	{
		displayName:
			'Get Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Retrieve_a_channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.READ</code>',
		name: 'getChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Get Channel as AI Tool Setup Guide: <a href="${CHANNEL_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['get'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'get');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		let channelLocatorMode: 'id' | 'name' = 'id';
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelLocator = resolveChannelLocatorInput(this, i);
			channelLocatorMode = channelLocator.mode;
			const channelIdValue = channelLocator.value;
			requestedChannelId = channelIdValue.trim();

			let response: unknown;
			if (channelLocatorMode === 'name') {
				const sanitizedChannelUniqueName = validateChannelName(this, channelIdValue, i);
				const preflightResult = await runChannelUniqueNameLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedChannelUniqueName,
				);

				response =
					preflightResult.status === 'validated'
						? preflightResult.entity
						: await zohoCliqApiRequest.call(
								this,
								'GET',
								`/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelUniqueName)}`,
							);
			} else {
				const sanitizedId = validateChannelId(this, channelIdValue, i);
				const preflightResult = await runChannelIdLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedId,
				);

				response =
					preflightResult.status === 'validated'
						? preflightResult.entity
						: await zohoCliqApiRequest.call(
								this,
								'GET',
								`/api/v2/channels/${encodeURIComponent(sanitizedId)}`,
							);
			}

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('channel');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'get', error, {
					contextFields:
						requestedChannelId && requestedChannelId.length > 0
							? channelLocatorMode === 'name'
								? { channel_unique_name: requestedChannelId }
								: { channel_id: requestedChannelId }
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
