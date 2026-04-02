/**
 * Remove Single Channel Member operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_REMOVE_MEMBER_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	validateChannelId,
	validateEmail,
	validateMemberId,
} from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { applyDisplayOptions, channelIdOnlyRLC } from '../common.descriptions';
import { runChannelIdLookupPreflightGate } from '../shared/preflight';
import { pushChannelRecoverableError, resolveChannelEnhancedOutput } from './shared';

const emailHintPattern = /@/;

const properties: INodeProperties[] = [
	channelIdOnlyRLC,
	{
		displayName: 'Member Identifier',
		name: 'memberIdentifier',
		type: 'string',
		default: '',
		required: true,
		description:
			'Single member identifier to remove. Provide either a user ID or an email ID. The operation auto-detects identifier type from this value.',
		placeholder: 'e.g. user@example.com OR 898765432',
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
			'Delete Single Channel Member Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Delete_Member" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'deleteSingleChannelMemberDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Remove Single Channel Member as AI Tool Setup Guide: <a href="${CHANNEL_REMOVE_MEMBER_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'removeChannelMemberAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['removeMember'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'removeMember');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		let requestedIdentifier: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelId = this.getNodeParameter('channelId', i, '', {
				extractValue: true,
			}) as string;
			requestedChannelId = channelId.trim();
			const memberIdentifier = this.getNodeParameter('memberIdentifier', i) as string;
			requestedIdentifier = memberIdentifier.trim();

			const sanitizedChannelId = validateChannelId(this, channelId, i);

			if (!requestedIdentifier) {
				throw new NodeOperationError(this.getNode(), 'Member identifier is required', {
					itemIndex: i,
				});
			}

			const identifierType: 'email_ids' | 'user_ids' = emailHintPattern.test(requestedIdentifier)
				? 'email_ids'
				: 'user_ids';
			const sanitizedIdentifier =
				identifierType === 'email_ids'
					? validateEmail(this, requestedIdentifier, i)
					: validateMemberId(this, requestedIdentifier, i);
			await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedChannelId);

			const response = await zohoCliqApiRequest.call(
				this,
				'DELETE',
				`/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/members/${encodeURIComponent(sanitizedIdentifier)}`,
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
									operation: 'remove_single_channel_member',
									channel_id: sanitizedChannelId,
									identifier_type: identifierType,
									removed_member: sanitizedIdentifier,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'removeMember', error, {
					contextFields: {
						...(requestedChannelId && requestedChannelId.length > 0
							? { channel_id: requestedChannelId }
							: {}),
						...(requestedIdentifier && requestedIdentifier.length > 0
							? { member_identifier: requestedIdentifier }
							: {}),
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
