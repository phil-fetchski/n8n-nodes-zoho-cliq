/**
 * Add Channel Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_ADD_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import { checkRequiredScope, validateChannelId, validateChannelName } from '../../helpers/utils';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
import type { IChannelMembersBody } from '../types';
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
			'Comma-separated member identifiers to add to the channel. Provide either all email IDs or all user IDs in one request (mixed types are rejected). Maximum 100 identifiers per request.',
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
			'Add Channel Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Add_Members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'addChannelMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Add Channel Members as AI Tool Setup Guide: <a href="${CHANNEL_ADD_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addChannelMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['addMembers'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'addMembers');
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
			const memberIdentifiers = this.getNodeParameter('memberIdentifiers', i) as string;
			const identifiersRaw = memberIdentifiers.trim();
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
			let identifiers: string[] = [];
			const body: IChannelMembersBody = {};
			const parsedIdentifiers = parseChannelMemberIdentifiers(this, identifiersRaw, i);
			identifiers = parsedIdentifiers.identifiers;
			if (parsedIdentifiers.identifierType === 'email_ids') {
				body.email_ids = identifiers;
			} else {
				body.user_ids = identifiers;
			}

			if (identifiers.length > 100) {
				throw new NodeOperationError(this.getNode(), 'Cannot add more than 100 members at once', {
					itemIndex: i,
				});
			}

			const response = await zohoCliqApiRequest.call(
				this,
				'POST',
				`/api/v2/channels/${encodeURIComponent(sanitizedId)}/members`,
				body,
			);

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
									operation: 'add_channel_members',
									...outputChannelFields,
									identifier_type: parsedIdentifiers.identifierType,
									member_identifiers: identifiers,
									added_count: identifiers.length,
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
				pushChannelRecoverableError(this, returnData, i, 'addMembers', error, {
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
