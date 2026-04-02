/**
 * Change Channel Member Role operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_CHANGE_ROLE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	validateChannelId,
	validateChannelName,
	validateMemberId,
} from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
import {
	extractChannelIdFromLookupEntity,
	pushChannelRecoverableError,
	resolveChannelLocatorInput,
} from './shared';

const validRoles = ['super_admin', 'admin', 'moderator', 'member'] as const;
type ChannelRole = (typeof validRoles)[number];

function validateRole(context: IExecuteFunctions, role: string, itemIndex: number): ChannelRole {
	if (!validRoles.includes(role as ChannelRole)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid role "${role}". Valid values: ${validRoles.join(', ')}`,
			{ itemIndex },
		);
	}

	return role as ChannelRole;
}

const properties: INodeProperties[] = [
	{
		...channelRLC,
		description:
			'Channel where the member role will be changed. Workflow mode supports list, channel ID, or unique name. AI Tool mode must pass channel_id as the channel ID string only (for example, P5452022000000451001). Do not use channel unique name or display name in AI Tool mode.',
	},
	{
		displayName: 'Member ID',
		name: 'memberId',
		type: 'string',
		default: '',
		required: true,
		description:
			'User ID of the channel member whose role should be updated. This must be the member user ID, not an email address.',
		placeholder: 'e.g. 123456789',
	},
	{
		displayName: 'Role',
		name: 'role',
		type: 'options',
		options: [
			{
				name: 'Super Admin',
				value: 'super_admin',
			},
			{
				name: 'Admin',
				value: 'admin',
			},
			{
				name: 'Moderator',
				value: 'moderator',
			},
			{
				name: 'Member',
				value: 'member',
			},
		],
		default: 'member',
		required: true,
		description:
			'Target role to assign to the selected channel member. ENUM: ["super_admin", "admin", "moderator", "member"]. Assigning super_admin may be rejected unless the caller already has sufficient channel authority.',
	},
	{
		displayName:
			'Change Channel Member Role Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Change_Role" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'changeChannelMemberRoleDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Change Channel Member Role as AI Tool Setup Guide: <a href="${CHANNEL_CHANGE_ROLE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'changeChannelMemberRoleAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['changeRole'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'changeRole');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		let requestedMemberId: string | undefined;
		let channelLocatorMode: 'id' | 'name' = 'id';
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelLocator = resolveChannelLocatorInput(this, i);
			channelLocatorMode = channelLocator.mode;
			const channelIdValue = channelLocator.value;
			const memberId = this.getNodeParameter('memberId', i) as string;
			const role = this.getNodeParameter('role', i) as string;
			requestedChannelId = channelIdValue.trim();
			requestedMemberId = memberId.trim();

			let sanitizedChannelId =
				channelLocatorMode === 'name'
					? validateChannelName(this, channelIdValue, i)
					: validateChannelId(this, channelIdValue, i);
			if (channelLocatorMode === 'name') {
				const preflightResult = await runChannelUniqueNameLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedChannelId,
				);
				sanitizedChannelId =
					extractChannelIdFromLookupEntity(
						preflightResult.status === 'validated' ? preflightResult.entity : undefined,
					) ?? sanitizedChannelId;
			} else {
				await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedChannelId);
			}
			const sanitizedMemberId = validateMemberId(this, memberId, i);
			const sanitizedRole = validateRole(this, role, i);

			const body: IDataObject = {
				role: sanitizedRole,
			};

			const response = await zohoCliqApiRequest.call(
				this,
				'PUT',
				`/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/members/${encodeURIComponent(sanitizedMemberId)}`,
				body,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: {
							success: true,
							channel_id: sanitizedChannelId,
							member_id: sanitizedMemberId,
							role: sanitizedRole,
							...response,
						},
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'changeRole', error, {
					contextFields: {
						...(requestedChannelId && requestedChannelId.length > 0
							? channelLocatorMode === 'name'
								? { channel_unique_name: requestedChannelId }
								: { channel_id: requestedChannelId }
							: {}),
						...(requestedMemberId && requestedMemberId.length > 0
							? { member_id: requestedMemberId }
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
