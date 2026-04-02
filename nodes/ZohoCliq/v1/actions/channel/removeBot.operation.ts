/**
 * Remove Bot from Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_REMOVE_BOT_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runChannelIdLookupPreflightGate } from '../shared/preflight';
import { pushChannelRecoverableError, resolveChannelEnhancedOutput } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

const botIdPattern = /^[a-zA-Z0-9_-]+$/;

function validateBotId(context: IExecuteFunctions, botId: string, itemIndex: number): string {
	if (!botId || !botId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Bot ID is required', { itemIndex });
	}

	const sanitized = botId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(context.getNode(), 'Bot ID is too long', { itemIndex });
	}

	if (!botIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Bot ID format', { itemIndex });
	}

	return sanitized;
}

const properties: INodeProperties[] = [
	{
		displayName:
			'Tip: Find Bot IDs using "Get Channel Members". Bot IDs typically look like <code>b-5452022000001911029</code>.',
		name: 'removeBotFromChannelTipNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Channel ID',
		name: 'channelId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Unique channel ID containing the bot member to remove. Use canonical channel ID (for example, CT_...).',
		placeholder: 'e.g. CT_2230642524712404875_64396981',
	},
	{
		displayName: 'Bot ID',
		name: 'botId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Bot user_id to remove from the channel. Use the bot member user_id from Get Channel Members (user_role = "bot"), not bot unique name. Typical format starts with "b-" and contains letters, numbers, underscores, or hyphens.',
		placeholder: 'e.g. b-5452022000001911029',
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
			'Remove Bot from Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Delete_Member" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'removeBotFromChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Remove Bot From Channel as AI Tool Setup Guide: <a href="${CHANNEL_REMOVE_BOT_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'removeBotFromChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['removeBot'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'removeBot');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		let requestedBotId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelId = this.getNodeParameter('channelId', i) as string;
			const botId = this.getNodeParameter('botId', i) as string;
			requestedChannelId = channelId.trim();
			requestedBotId = botId.trim();

			const sanitizedChannelId = validateChannelId(this, channelId, i);
			const sanitizedBotId = validateBotId(this, botId, i);
			await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedChannelId);

			const response = await zohoCliqApiRequest.call(
				this,
				'DELETE',
				`/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/members/${encodeURIComponent(sanitizedBotId)}`,
			);

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
									operation: 'remove_bot_from_channel',
									channel_id: sanitizedChannelId,
									removed_bot_id: sanitizedBotId,
									delete_member_endpoint_used: true,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'removeBot', error, {
					contextFields: {
						...(requestedChannelId && requestedChannelId.length > 0
							? { channel_id: requestedChannelId }
							: {}),
						...(requestedBotId && requestedBotId.length > 0 ? { bot_id: requestedBotId } : {}),
					},
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
