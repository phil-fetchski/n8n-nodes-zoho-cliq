/**
 * Leave Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_LEAVE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, extractErrorText, validateChannelId } from '../../helpers/utils';
import { runChannelIdLookupPreflightGate } from '../shared/preflight';
import { pushChannelRecoverableError, resolveChannelEnhancedOutput } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

function isSuperAdminLeaveRestriction(error: unknown): boolean {
	const parts: string[] = [extractErrorText(error).toLowerCase()];
	if (error && typeof error === 'object') {
		const response = (error as { response?: { body?: unknown; data?: unknown } }).response;
		for (const candidate of [response?.body, response?.data]) {
			if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
				const data = candidate as IDataObject;
				for (const key of ['message', 'error', 'description', 'details']) {
					const value = data[key];
					if (typeof value === 'string') {
						parts.push(value.toLowerCase());
					}
				}
			}
		}
	}

	const combined = parts.join(' ');
	return (
		combined.includes('please assign a super admin') ||
		(combined.includes('super admin') && combined.includes('leave this channel'))
	);
}

const properties: INodeProperties[] = [
	{
		displayName: 'Channel ID',
		name: 'channelId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Unique channel ID to leave as the current user. Use canonical channel ID (for example, CT_...).',
		placeholder: 'e.g. CT_2230642524712404875_64396981',
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
			'Leave Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Leave_a_Channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'leaveChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Leave Channel as AI Tool Setup Guide: <a href="${CHANNEL_LEAVE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'leaveChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['leave'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'leave');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelId = this.getNodeParameter('channelId', i) as string;
			requestedChannelId = channelId.trim();

			const sanitizedId = validateChannelId(this, channelId, i);
			await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedId);

			let response: IDataObject;
			try {
				response = (await zohoCliqApiRequest.call(
					this,
					'POST',
					`/api/v2/channels/${encodeURIComponent(sanitizedId)}/leave`,
				)) as IDataObject;
			} catch (error) {
				if (!isSuperAdminLeaveRestriction(error)) {
					throw error;
				}

				response = {
					success: true,
					status: 'skipped_super_admin',
					is_super_admin: true,
					message:
						'Current user is the channel super admin and cannot leave until another super admin is assigned.',
					api_error: extractErrorText(error),
				};
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
									operation: 'leave_channel',
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
				pushChannelRecoverableError(this, returnData, i, 'leave', error, {
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
