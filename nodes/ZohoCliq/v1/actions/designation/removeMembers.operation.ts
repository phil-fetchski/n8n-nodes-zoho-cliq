/**
 * Remove Designation Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DESIGNATION_REMOVE_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	runDesignationLookupPreflightGate,
	runDesignationUsersPreflightGate,
} from '../shared/preflight';
import {
	designationIdLocator,
	parseFlexibleUserIdsInput,
	pushDesignationRecoverableError,
	resolveDesignationEnhancedOutput,
	rethrowDesignationApiError,
	validateDesignationId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('designation', 'removeMembers');

const properties: INodeProperties[] = [
	{
		...designationIdLocator,
		description: 'The unique designation ID to remove members from.',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description:
			'User IDs to remove from this designation. Accepts either a JSON array of canonical Zoho Cliq user ID strings or a comma-separated list for manual entry. AI Tool setups should use the JSON array form. Maximum 100 user IDs per request.',
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
		displayName: `Remove Designation Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-designation-members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'removeDesignationMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Designation/Remove Designation Members as AI Tool Setup Guide: <a href="${DESIGNATION_REMOVE_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'removeDesignationMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['designation'],
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
		let requestedDesignationId: string | undefined;
		let requestedUserIds: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const designationId = this.getNodeParameter('designationId', i, '', {
				extractValue: true,
			}) as string;
			const userIds = this.getNodeParameter('userIds', i) as unknown;

			const sanitizedDesignationId = validateDesignationId(this, designationId, i);
			requestedDesignationId = sanitizedDesignationId;
			const userIdArray = parseFlexibleUserIdsInput(this, userIds, i, 'User IDs');
			requestedUserIds = userIdArray.join(',');

			if (userIdArray.length > 100) {
				throw new NodeOperationError(
					this.getNode(),
					'Cannot remove more than 100 members at once',
					{
						itemIndex: i,
					},
				);
			}

			await runDesignationLookupPreflightGate(this, i, grantedScopes, sanitizedDesignationId);
			await runDesignationUsersPreflightGate(this, userIdArray, i, grantedScopes);

			const endpoint = `/api/v2/designations/${encodeURIComponent(sanitizedDesignationId)}/members`;
			const response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint, {
				user_ids: userIdArray,
			});
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveDesignationEnhancedOutput(
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
									resource: 'designation',
									operation: 'removeMembers',
									designation_id: sanitizedDesignationId,
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
				pushDesignationRecoverableError(this, returnData, i, 'removeMembers', error, {
					contextFields: {
						...(requestedDesignationId ? { designation_id: requestedDesignationId } : {}),
						...(requestedUserIds ? { user_ids: requestedUserIds } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation id is required') ||
								normalizedMessage.includes('designation id is too long') ||
								normalizedMessage.includes('designation id has an invalid format'),
							reason: 'INVALID_DESIGNATION_ID',
							hint: 'Use the exact Zoho Cliq designation ID for the designation you want to remove members from.',
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
								normalizedMessage.includes('the following user id(s) could not be found') ||
								normalizedMessage.includes('user ids must contain at least one id') ||
								normalizedMessage.includes('user ids[') ||
								normalizedMessage.includes('cannot remove more than 100 members at once'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide one or more canonical Zoho Cliq user IDs as a JSON array of strings. If an ID cannot be resolved, retrieve valid users before retrying.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('designation_not_exist'),
							reason: 'DESIGNATION_NOT_FOUND',
							hint: 'Verify the designation ID and confirm the designation still exists in Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('operation_not_allowed') ||
								normalizedMessage.includes('not_an_organization_admin'),
							reason: 'DESIGNATION_REMOVE_NOT_ALLOWED',
							hint: 'Use an organization admin account and confirm designations are not managed through Zoho People.',
						},
					],
				})
			) {
				continue;
			}

			rethrowDesignationApiError(this, error, i, 'Remove designation members', {
				designationId: requestedDesignationId,
			});
		}
	}

	return returnData;
}
