/**
 * Unarchive Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_UNARCHIVE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId, validateChannelName } from '../../helpers/utils';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
import {
	extractChannelIdFromLookupEntity,
	pushChannelRecoverableError,
	resolveChannelEnhancedOutput,
	resolveChannelLocatorInput,
} from './shared';

const properties: INodeProperties[] = [
	channelRLC,
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
			'Unarchive Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Unarchive_a_Channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'unarchiveChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Unarchive Channel as AI Tool Setup Guide: <a href="${CHANNEL_UNARCHIVE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'unarchiveChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['unarchive'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'unarchive');
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
			let resolvedChannelId: string | undefined;

			const sanitizedId =
				channelLocatorMode === 'name'
					? validateChannelName(this, channelIdValue, i)
					: validateChannelId(this, channelIdValue, i);
			if (channelLocatorMode === 'name') {
				const preflightResult = await runChannelUniqueNameLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedId,
				);
				resolvedChannelId = extractChannelIdFromLookupEntity(
					preflightResult.status === 'validated' ? preflightResult.entity : undefined,
				);
			} else {
				await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedId);
			}

			const response = (await zohoCliqApiRequest.call(
				this,
				'POST',
				`/api/v2/channels/${encodeURIComponent(sanitizedId)}/unarchive`,
			)) as IDataObject;

			const { includeEnhancedOutput, responseJson, rawResponse } = resolveChannelEnhancedOutput(
				this,
				i,
				response,
			);
			const outputChannelFields: IDataObject =
				channelLocatorMode === 'name'
					? { channel_unique_name: sanitizedId }
					: { channel_id: sanitizedId };
			if (channelLocatorMode === 'name' && resolvedChannelId) {
				outputChannelFields.channel_id = resolvedChannelId;
			}

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									success: true,
									operation: 'unarchive_channel',
									...outputChannelFields,
									...responseJson,
								}
							: (rawResponse as IDataObject),
					},
				],
				{ itemData: { item: i } },
			);

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'unarchive', error, {
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
