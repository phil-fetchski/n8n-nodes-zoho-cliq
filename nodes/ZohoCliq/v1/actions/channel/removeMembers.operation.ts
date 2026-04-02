/**
 * Remove Channel Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_REMOVE_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import {
	checkRequiredScope,
	extractErrorText,
	validateChannelId,
	validateChannelName,
} from '../../helpers/utils';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
import {
	extractChannelIdFromLookupEntity,
	parseChannelMemberIdentifiers,
	pushChannelRecoverableError,
	resolveChannelLocatorInput,
	resolveChannelEnhancedOutput,
} from './shared';

const properties: INodeProperties[] = [
	channelRLC,
	{
		displayName: 'Member Identifiers',
		name: 'memberIdentifiers',
		type: 'string',
		default: '',
		required: true,
		description:
			'Comma-separated member identifiers to remove. Use only email IDs or only user IDs in one request (mixed types are rejected). Each identifier is removed with a separate API call.',
		placeholder: 'e.g. user1@example.com,user2@example.com OR 123456789,987654321',
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
			'Remove Channel Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Delete_Members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'removeChannelMembersDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				operation: ['removeMembers'],
			},
		},
	},
	{
		displayName: `Zoho Cliq Channel/Remove Channel Members as AI Tool Setup Guide: <a href="${CHANNEL_REMOVE_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'removeChannelMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['removeMembers'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'removeMembers');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		let failedMemberIdentifier: string | undefined;
		let channelLocatorMode: 'id' | 'name' = 'id';
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelLocator = resolveChannelLocatorInput(this, i);
			channelLocatorMode = channelLocator.mode;
			const channelIdValue = channelLocator.value;
			requestedChannelId = channelIdValue.trim();
			const memberIdentifiers = this.getNodeParameter('memberIdentifiers', i) as string;
			const identifiersRaw = memberIdentifiers.trim();

			let sanitizedId =
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
				let resolvedChannelId = extractChannelIdFromLookupEntity(
					preflightResult.status === 'validated' ? preflightResult.entity : undefined,
				);
				if (!resolvedChannelId) {
					const lookupResponse = await zohoCliqApiRequest.call(
						this,
						'GET',
						`/api/v2/channelsbyname/${encodeURIComponent(sanitizedId)}`,
					);
					resolvedChannelId = extractChannelIdFromLookupEntity(lookupResponse);
				}
				// The delete-members endpoint only accepts channel_id values, so the unique name
				// must resolve to a real channel_id before building the DELETE path.
				if (!resolvedChannelId) {
					throw new NodeOperationError(
						this.getNode(),
						'Channel lookup by unique name did not return a usable channel_id. Remove Members requires a valid channel ID for the delete endpoint.',
						{
							itemIndex: i,
						},
					);
				}
				sanitizedId = validateChannelId(this, resolvedChannelId, i);
			} else {
				await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedId);
			}
			let identifiers: string[] = [];
			const parsedIdentifiers = parseChannelMemberIdentifiers(this, identifiersRaw, i);
			const identifierType = parsedIdentifiers.identifierType;
			identifiers = parsedIdentifiers.identifiers;

			let lastResponse: unknown = {};
			for (const identifier of identifiers) {
				try {
					lastResponse = await zohoCliqApiRequest.call(
						this,
						'DELETE',
						`/api/v2/channels/${encodeURIComponent(sanitizedId)}/members/${encodeURIComponent(identifier)}`,
					);
				} catch (error) {
					failedMemberIdentifier = identifier;
					throw new NodeOperationError(
						this.getNode(),
						`Failed to remove member identifier "${identifier}" from channel "${sanitizedId}": ${extractErrorText(error)}`,
						{
							itemIndex: i,
						},
					);
				}
			}

			const { includeEnhancedOutput, responseJson, rawResponse } = resolveChannelEnhancedOutput(
				this,
				i,
				lastResponse,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									deleted: true,
									success: true,
									operation: 'remove_channel_members',
									channel_id: sanitizedId,
									removed_identifiers: identifiers,
									identifier_type: identifierType,
									count: identifiers.length,
									api_call_count: identifiers.length,
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
				pushChannelRecoverableError(this, returnData, i, 'removeMembers', error, {
					contextFields: {
						...(requestedChannelId && requestedChannelId.length > 0
							? channelLocatorMode === 'name'
								? { channel_unique_name: requestedChannelId }
								: { channel_id: requestedChannelId }
							: {}),
						...(failedMemberIdentifier && failedMemberIdentifier.length > 0
							? { member_identifier: failedMemberIdentifier }
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
