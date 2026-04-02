/**
 * Approve Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_APPROVE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, extractErrorText, validateChannelId } from '../../helpers/utils';
import { applyDisplayOptions, channelIdOnlyRLC } from '../common.descriptions';
import { runChannelIdLookupPreflightGate } from '../shared/preflight';
import { pushChannelRecoverableError, resolveChannelEnhancedOutput } from './shared';

const channelStateTokenPattern = /(^|[^a-z0-9])(pending|created)([^a-z0-9]|$)/i;

const properties: INodeProperties[] = [
	channelIdOnlyRLC,
	{
		displayName:
			'Approve only works for pending organization-level channels. Newly created channels with status "created" do not require approval.',
		name: 'approvePendingOnlyNotice',
		type: 'notice',
		default: '',
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
			'Approve Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Approve_a_Channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'approveChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Approve Channel as AI Tool Setup Guide: <a href="${CHANNEL_APPROVE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'approveChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['approve'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'approve');
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

			let response: IDataObject;
			try {
				response = (await zohoCliqApiRequest.call(
					this,
					'POST',
					`/api/v2/channels/${encodeURIComponent(sanitizedId)}/approve`,
				)) as IDataObject;
			} catch (error) {
				const errorText = extractErrorText(error);
				if (channelStateTokenPattern.test(errorText)) {
					throw new NodeOperationError(
						this.getNode(),
						`Channel "${sanitizedId}" cannot be approved because it is not in pending state. Approve applies only to pending organization-level channels.`,
						{ itemIndex: i },
					);
				}

				throw error;
			}

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
									success: true,
									operation: 'approve_channel',
									channel_id: sanitizedId,
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
				pushChannelRecoverableError(this, returnData, i, 'approve', error, {
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
