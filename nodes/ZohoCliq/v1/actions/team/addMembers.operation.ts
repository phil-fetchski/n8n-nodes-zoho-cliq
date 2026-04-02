/**
 * Add Team Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { TEAM_ADD_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runTeamLookupPreflightGate, runTeamUsersPreflightGate } from '../shared/preflight';
import {
	parseDelimitedIds,
	pushTeamRecoverableError,
	resolveTeamEnhancedOutput,
	teamIdLocator,
	TEAM_NOT_FOUND_HINT,
	TEAM_NOT_FOUND_MESSAGE,
	USER_IDS_NOT_FOUND_HINT,
	USER_IDS_NOT_FOUND_MESSAGE,
	validateTeamId,
	validateZohoEntityId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('team', 'addMembers');

const properties: INodeProperties[] = [
	teamIdLocator,
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of Zoho Cliq user IDs to add',
		placeholder: 'e.g. 44344926,54667722',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this add-members response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Add Team Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_Add_Members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'addTeamMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/Add Team Members as AI Tool Setup Guide: <a href="${TEAM_ADD_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addTeamMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
		operation: ['addMembers'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedTeamId: string | undefined;
		let requestedUserIds: string[] | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const teamId = this.getNodeParameter('teamId', i, '', {
				extractValue: true,
			}) as string;
			requestedTeamId = typeof teamId === 'string' && teamId.trim() ? teamId.trim() : undefined;
			const userIds = this.getNodeParameter('userIds', i) as string;

			const sanitizedTeamId = validateTeamId(this, teamId, i);

			if (typeof userIds !== 'string' || !userIds.trim()) {
				throw new NodeOperationError(this.getNode(), 'User IDs are required', { itemIndex: i });
			}

			const trimmedUserIds = userIds.trim();
			const userIdArray = parseDelimitedIds(this, trimmedUserIds, i, 'User IDs').map(
				(userId, idx) => validateZohoEntityId(this, userId, i, `User IDs[${idx}]`),
			);
			requestedUserIds = userIdArray;

			if (userIdArray.length > 100) {
				throw new NodeOperationError(this.getNode(), 'Cannot add more than 100 members at once', {
					itemIndex: i,
				});
			}

			await runTeamLookupPreflightGate(this, i, grantedScopes, sanitizedTeamId);
			await runTeamUsersPreflightGate(this, userIdArray, i, grantedScopes);

			const endpoint = `/api/v2/teams/${encodeURIComponent(sanitizedTeamId)}/members`;
			const body: IDataObject = {
				user_ids: userIdArray,
			};
			const response = (await zohoCliqApiRequest.call(this, 'POST', endpoint, body)) as IDataObject;
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveTeamEnhancedOutput(
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
									success: true,
									resource: 'team',
									operation: 'addMembers',
									team_id: sanitizedTeamId,
									added_user_ids: userIdArray,
									count: userIdArray.length,
								}
							: rawResponse,
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			const missingUserIds =
				error &&
				typeof error === 'object' &&
				!Array.isArray(error) &&
				Array.isArray((error as IDataObject).zohoCliqMissingUserIds)
					? ((error as IDataObject).zohoCliqMissingUserIds as string[])
					: undefined;
			if (
				pushTeamRecoverableError(this, returnData, i, 'addMembers', error, {
					contextFields: {
						...(requestedTeamId ? { team_id: requestedTeamId } : {}),
						...(requestedUserIds ? { user_ids: requestedUserIds } : {}),
						...(missingUserIds?.length ? { invalid_user_ids: missingUserIds } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team id is required') ||
								normalizedMessage.includes('team id is too long') ||
								normalizedMessage.includes('invalid team id format'),
							reason: 'INVALID_TEAM_ID',
							hint: 'Use the exact Zoho Cliq team ID for the team you want to add members to.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user ids are required') ||
								normalizedMessage.includes('user ids must contain at least one id') ||
								normalizedMessage.includes('user ids[') ||
								normalizedMessage.includes('cannot add more than 100 members at once'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide one or more canonical Zoho Cliq user IDs as a comma-separated list. Maximum 100 user IDs per request.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(USER_IDS_NOT_FOUND_MESSAGE.toLowerCase()) ||
								normalizedMessage.includes('missing user ids:'),
							reason: 'USER_IDS_NOT_FOUND',
							messageOverride: USER_IDS_NOT_FOUND_MESSAGE,
							hint: USER_IDS_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(TEAM_NOT_FOUND_MESSAGE.toLowerCase()),
							reason: 'TEAM_NOT_FOUND',
							messageOverride: TEAM_NOT_FOUND_MESSAGE,
							hint: TEAM_NOT_FOUND_HINT,
						},
					],
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
