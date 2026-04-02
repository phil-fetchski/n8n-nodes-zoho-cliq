/**
 * Remove Team Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { TEAM_REMOVE_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import type { ICliqErrorMessageMapping } from '../shared/errorResponse';
import {
	runTeamLookupPreflightGate,
	runTeamMembershipPreflightGate,
	runTeamUsersPreflightGate,
} from '../shared/preflight';
import {
	parseDelimitedIds,
	pushTeamRecoverableError,
	resolveTeamEnhancedOutput,
	teamIdLocator,
	TEAM_NOT_FOUND_HINT,
	TEAM_NOT_FOUND_MESSAGE,
	USER_IDS_NOT_FOUND_HINT,
	USER_IDS_NOT_FOUND_MESSAGE,
	USER_IDS_NOT_TEAM_MEMBERS_HINT,
	USER_IDS_NOT_TEAM_MEMBERS_MESSAGE,
	validateTeamId,
	validateZohoEntityId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('team', 'removeMembers');

export const REMOVE_MEMBERS_MESSAGE_MAPPINGS: ICliqErrorMessageMapping[] = [
	{
		match: (normalizedMessage) =>
			normalizedMessage.includes('team id is required') ||
			normalizedMessage.includes('team id is too long') ||
			normalizedMessage.includes('invalid team id format'),
		reason: 'INVALID_TEAM_ID',
		hint: 'Use the exact Zoho Cliq team ID for the team you want to remove members from.',
	},
	{
		match: (normalizedMessage) =>
			normalizedMessage.includes('user ids are required') ||
			normalizedMessage.includes('user ids must contain at least one id') ||
			normalizedMessage.includes('user ids[') ||
			normalizedMessage.includes('cannot remove more than 100 members at once'),
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
			normalizedMessage.includes(USER_IDS_NOT_TEAM_MEMBERS_MESSAGE.toLowerCase()) ||
			normalizedMessage.includes('non-member user ids:'),
		reason: 'USER_IDS_NOT_TEAM_MEMBERS',
		messageOverride: USER_IDS_NOT_TEAM_MEMBERS_MESSAGE,
		hint: USER_IDS_NOT_TEAM_MEMBERS_HINT,
	},
	{
		match: (normalizedMessage) => normalizedMessage.includes(TEAM_NOT_FOUND_MESSAGE.toLowerCase()),
		reason: 'TEAM_NOT_FOUND',
		messageOverride: TEAM_NOT_FOUND_MESSAGE,
		hint: TEAM_NOT_FOUND_HINT,
	},
	{
		match: (normalizedMessage) =>
			normalizedMessage.includes('failed to remove') && normalizedMessage.includes('team member'),
		reason: 'REMOVE_TEAM_MEMBERS_FAILED',
		hint: 'Review failed_user_ids and retry only the members that still need to be removed. This node sends one delete request per user ID.',
	},
];

const properties: INodeProperties[] = [
	teamIdLocator,
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of Zoho Cliq user IDs to remove',
		placeholder: 'e.g. 44344926,54667722',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this batched remove-members response. Disable to return Cliq's standard response from the final successful delete call.",
	},
	{
		displayName: `Delete Team Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_Delete_Members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteTeamMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/Delete Team Members as AI Tool Setup Guide: <a href="${TEAM_REMOVE_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteTeamMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
		operation: ['removeMembers'],
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
			const parsedUserIds = parseDelimitedIds(this, trimmedUserIds, i, 'User IDs');
			const dedupedUserIds = Array.from(new Set(parsedUserIds));
			const userIdArray = dedupedUserIds.map((userId, idx) =>
				validateZohoEntityId(this, userId, i, `User IDs[${idx}]`),
			);
			requestedUserIds = userIdArray;

			if (userIdArray.length > 100) {
				throw new NodeOperationError(
					this.getNode(),
					'Cannot remove more than 100 members at once',
					{
						itemIndex: i,
					},
				);
			}

			await runTeamLookupPreflightGate(this, i, grantedScopes, sanitizedTeamId);
			await runTeamUsersPreflightGate(this, userIdArray, i, grantedScopes, {
				includeInactiveUsers: true,
			});
			await runTeamMembershipPreflightGate(this, i, grantedScopes, sanitizedTeamId, userIdArray);

			const apiResponses: IDataObject[] = [];
			const removedUserIds: string[] = [];
			const failures: Array<{ error: string; originalError: unknown; user_id: string }> = [];
			let lastResponse: IDataObject = {};

			for (const userId of userIdArray) {
				const endpoint = `/api/v2/teams/${encodeURIComponent(sanitizedTeamId)}/members/${encodeURIComponent(userId)}`;
				try {
					const response = (await zohoCliqApiRequest.call(this, 'DELETE', endpoint)) as
						| IDataObject
						| undefined
						| null;
					lastResponse = (response ?? {}) as IDataObject;
					removedUserIds.push(userId);
					if (response && Object.keys(response).length > 0) {
						apiResponses.push(response);
					}
				} catch (error) {
					failures.push({
						error: error instanceof Error ? error.message : 'An unexpected issue occurred',
						originalError: error,
						user_id: userId,
					});
				}
			}

			if (failures.length > 0) {
				const partialResult: IDataObject = {
					partial_success: removedUserIds.length > 0,
					team_id: sanitizedTeamId,
					user_ids: userIdArray,
					removed_user_ids: removedUserIds,
					failed_user_ids: failures.map((entry) => entry.user_id),
					count: removedUserIds.length,
					failure_count: failures.length,
					api_call_count: userIdArray.length,
					single_user_endpoint_used: true,
					api_responses: apiResponses,
					failures: failures.map((entry) => ({
						team_id: sanitizedTeamId,
						user_id: entry.user_id,
						error: entry.error,
					})),
				};

				const summaryError = new NodeOperationError(
					this.getNode(),
					`Failed to remove ${failures.length} team member(s)`,
					{ itemIndex: i },
				) as NodeOperationError & IDataObject;
				summaryError.zohoCliqPartialResult = partialResult;

				if (
					pushTeamRecoverableError(this, returnData, i, 'removeMembers', summaryError, {
						contextFields: partialResult,
						messageMappings: REMOVE_MEMBERS_MESSAGE_MAPPINGS,
					})
				) {
					continue;
				}

				throw summaryError;
			}

			const { includeEnhancedOutput, rawResponse, responseJson } = resolveTeamEnhancedOutput(
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
									resource: 'team',
									operation: 'removeMembers',
									team_id: sanitizedTeamId,
									removed_user_ids: removedUserIds,
									count: removedUserIds.length,
									api_call_count: userIdArray.length,
									single_user_endpoint_used: true,
									api_responses: apiResponses,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
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
			const nonMemberUserIds =
				error &&
				typeof error === 'object' &&
				!Array.isArray(error) &&
				Array.isArray((error as IDataObject).zohoCliqNonMemberUserIds)
					? ((error as IDataObject).zohoCliqNonMemberUserIds as string[])
					: undefined;
			if (
				pushTeamRecoverableError(this, returnData, i, 'removeMembers', error, {
					contextFields: {
						...(requestedTeamId ? { team_id: requestedTeamId } : {}),
						...(requestedUserIds ? { user_ids: requestedUserIds } : {}),
						...(missingUserIds?.length ? { invalid_user_ids: missingUserIds } : {}),
						...(nonMemberUserIds?.length ? { non_member_user_ids: nonMemberUserIds } : {}),
					},
					messageMappings: REMOVE_MEMBERS_MESSAGE_MAPPINGS,
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
