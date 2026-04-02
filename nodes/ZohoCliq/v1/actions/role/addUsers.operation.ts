/**
 * Add Users to Role operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { ROLE_ADD_USERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runRoleLookupPreflightGate, runRoleUsersPreflightGate } from '../shared/preflight';
import {
	parseDelimitedUserIds,
	pushRoleRecoverableError,
	resolveRoleEnhancedOutput,
	USER_IDS_NOT_FOUND_HINT,
	USER_IDS_NOT_FOUND_MESSAGE,
	ROLE_NOT_FOUND_HINT,
	ROLE_NOT_FOUND_MESSAGE,
	roleIdLocator,
	validateRoleId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('role', 'addUsers');

const properties: INodeProperties[] = [
	{
		...roleIdLocator,
		description: 'The unique role ID to add users to',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description: 'Comma-separated list of user IDs to add',
		placeholder: 'e.g. 62913657,63569660,67580202',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal add-users response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Add Users to a Role Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#add-role-users" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'addRoleUsersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Role/Add Users To Role as AI Tool Setup Guide: <a href="${ROLE_ADD_USERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addRoleUsersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['addUsers'],
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
		let requestedRoleId: string | undefined;
		let requestedUserIds: string | undefined;
		let parsedUserIds: string[] | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const roleId = this.getNodeParameter('roleId', i, '', {
				extractValue: true,
			}) as string;
			const userIds = this.getNodeParameter('userIds', i) as string;
			requestedRoleId = roleId.trim();
			requestedUserIds = userIds.trim();

			const sanitizedRoleId = validateRoleId(this, roleId, i);
			const userIdArray = parseDelimitedUserIds(this, userIds, i, 'User IDs');
			parsedUserIds = userIdArray;
			await runRoleLookupPreflightGate(this, i, grantedScopes, sanitizedRoleId);
			await runRoleUsersPreflightGate(this, userIdArray, i, grantedScopes);

			const endpoint = `/api/v2/profiles/${encodeURIComponent(sanitizedRoleId)}/users`;
			const body: IDataObject = {
				user_ids: userIdArray,
			};

			const response = await zohoCliqApiRequest.call(this, 'POST', endpoint, body);
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveRoleEnhancedOutput(
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
									resource: 'role',
									operation: 'addUsers',
									role_id: sanitizedRoleId,
									added_user_ids: userIdArray,
									count: userIdArray.length,
									...responseJson,
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
				pushRoleRecoverableError(this, returnData, i, 'addUsers', error, {
					contextFields: {
						...(requestedRoleId ? { role_id: requestedRoleId } : {}),
						...(parsedUserIds
							? { user_ids: parsedUserIds }
							: requestedUserIds
								? { user_ids: requestedUserIds }
								: {}),
						...(missingUserIds?.length ? { invalid_user_ids: missingUserIds } : {}),
					},
					messageMappings: [
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
								normalizedMessage.includes(ROLE_NOT_FOUND_MESSAGE.toLowerCase()),
							reason: 'ROLE_NOT_FOUND',
							messageOverride: ROLE_NOT_FOUND_MESSAGE,
							hint: ROLE_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('role id'),
							reason: 'INVALID_ROLE_ID',
							hint: 'Use the exact canonical Zoho Cliq role ID returned by List Roles.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user ids') || normalizedMessage.includes('user id'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide one to 100 canonical Zoho Cliq user IDs separated by commas. Duplicates are removed automatically.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('operation_not_allowed') ||
								normalizedMessage.includes('not_an_organization_admin'),
							reason: 'ROLE_USERS_UPDATE_NOT_ALLOWED',
							hint: 'Use an Organization Admin OAuth user with the required organization update scope.',
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
