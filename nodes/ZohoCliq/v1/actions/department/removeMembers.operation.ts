/**
 * Remove Department Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DEPARTMENT_REMOVE_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	runDepartmentLookupPreflightGate,
	runDepartmentUsersPreflightGate,
} from '../shared/preflight';
import {
	departmentIdLocator,
	parseFlexibleUserIdsInput,
	pushDepartmentRecoverableError,
	resolveDepartmentEnhancedOutput,
	validateDepartmentId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'removeMembers');

const properties: INodeProperties[] = [
	{
		...departmentIdLocator,
		description: 'The unique department ID to remove members from.',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description:
			'User IDs to remove from this department. Accepts either a JSON array of canonical Zoho Cliq user ID strings or a comma-separated list for manual entry. AI Tool setups should use the JSON array form. Maximum 100 user IDs per request.',
		placeholder: 'e.g. ["123456789","987654321"]',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal remove-members response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Remove Department Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-department-members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'removeDepartmentMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/Remove Department Members as AI Tool Setup Guide: <a href="${DEPARTMENT_REMOVE_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'removeDepartmentMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
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
		let requestedDepartmentId: string | undefined;
		let requestedUserIds: string[] | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const departmentId = this.getNodeParameter('departmentId', i, '', {
				extractValue: true,
			}) as string;
			const originalTrimmedDepartmentId = departmentId.trim();
			requestedDepartmentId = originalTrimmedDepartmentId;
			const rawUserIds = this.getNodeParameter('userIds', i) as unknown;
			const userIdArray = parseFlexibleUserIdsInput(this, rawUserIds, i, 'User IDs');
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

			const sanitizedDepartmentId = validateDepartmentId(this, departmentId, i);
			await runDepartmentLookupPreflightGate(this, i, grantedScopes, sanitizedDepartmentId);
			await runDepartmentUsersPreflightGate(this, userIdArray, i, grantedScopes, {
				actionDescription: 'removing department members',
			});

			const endpoint = `/api/v2/departments/${encodeURIComponent(sanitizedDepartmentId)}/members`;
			const response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint, {
				user_ids: userIdArray,
			});
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveDepartmentEnhancedOutput(
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
									resource: 'department',
									operation: 'removeMembers',
									department_id: sanitizedDepartmentId,
									removed_user_ids: userIdArray,
									removed_count: userIdArray.length,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDepartmentRecoverableError(this, returnData, i, 'removeMembers', error, {
					contextFields: requestedUserIds
						? {
								...(requestedDepartmentId ? { department_id: requestedDepartmentId } : {}),
								user_ids: requestedUserIds,
							}
						: undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('department id is required') ||
								normalizedMessage.includes('invalid department id format') ||
								normalizedMessage.includes('department id is too long'),
							reason: 'INVALID_DEPARTMENT_ID',
							hint: 'Use the exact Zoho Cliq department ID for the department you want to remove members from.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'user ids must be either a json array of user ids or a comma-separated string of user ids',
								) ||
								normalizedMessage.includes(
									'user ids must be a valid json array when provided in array form',
								) ||
								normalizedMessage.includes(
									'user ids must be a json array of user ids when provided in array form',
								) ||
								normalizedMessage.includes('user ids are required') ||
								normalizedMessage.includes('user ids must contain at least one id') ||
								normalizedMessage.includes('user ids[') ||
								normalizedMessage.includes('cannot remove more than 100 members at once'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide one or more canonical Zoho Cliq user IDs as a JSON array of strings. If needed for a manual workflow, a comma-separated list is also accepted.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('the following user ids could not be found'),
							reason: 'USERS_NOT_FOUND',
							hint: 'One or more user_ids could not be matched to organization users. Retrieve users first and retry with canonical Zoho Cliq user IDs only.',
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
