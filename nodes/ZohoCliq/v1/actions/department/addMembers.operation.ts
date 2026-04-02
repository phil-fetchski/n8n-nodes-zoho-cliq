/**
 * Add Department Members operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DEPARTMENT_ADD_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	runDepartmentLookupPreflightGate,
	runDepartmentMemberIdentifiersPreflightGate,
} from '../shared/preflight';
import {
	departmentIdLocator,
	parseDepartmentMemberIdentifiers,
	pushDepartmentRecoverableError,
	resolveDepartmentEnhancedOutput,
	validateDepartmentId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'addMembers');

const properties: INodeProperties[] = [
	{
		...departmentIdLocator,
		description: 'The unique department ID to add members to.',
	},
	{
		displayName: 'Member Identifiers',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description:
			'Comma-separated member identifiers to add. You can also provide a JSON array or literal array. Provide either all email IDs or all user IDs in one request. Mixed identifier types are rejected. Maximum 100 identifiers per request.',
		placeholder: 'e.g. amy@example.com,ben@example.com OR ["123456789","987654321"]',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal add-members response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Add Department Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#add-department-members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'addDepartmentMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/Add Department Members as AI Tool Setup Guide: <a href="${DEPARTMENT_ADD_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addDepartmentMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
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
		let requestedDepartmentId: string | undefined;
		let requestedMemberIdentifiers: string[] | undefined;
		let requestedIdentifierType: 'email_ids' | 'user_ids' | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const departmentId = this.getNodeParameter('departmentId', i, '', {
				extractValue: true,
			}) as string;
			requestedDepartmentId = departmentId.trim();
			const memberIdentifiers = this.getNodeParameter('userIds', i) as unknown;

			const parsedIdentifiers = parseDepartmentMemberIdentifiers(this, memberIdentifiers, i);
			requestedMemberIdentifiers = parsedIdentifiers.identifiers;
			requestedIdentifierType = parsedIdentifiers.identifierType;

			if (parsedIdentifiers.identifiers.length > 100) {
				throw new NodeOperationError(this.getNode(), 'Cannot add more than 100 members at once', {
					itemIndex: i,
				});
			}

			const sanitizedDepartmentId = validateDepartmentId(this, departmentId, i);
			await runDepartmentLookupPreflightGate(this, i, grantedScopes, sanitizedDepartmentId);
			await runDepartmentMemberIdentifiersPreflightGate(this, parsedIdentifiers, i, grantedScopes, {
				actionDescription: 'adding department members',
			});

			const endpoint = `/api/v2/departments/${encodeURIComponent(sanitizedDepartmentId)}/members`;
			const body =
				parsedIdentifiers.identifierType === 'email_ids'
					? { email_ids: parsedIdentifiers.identifiers }
					: { user_ids: parsedIdentifiers.identifiers };
			const response = await zohoCliqApiRequest.call(this, 'POST', endpoint, body);
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
									success: true,
									resource: 'department',
									operation: 'addMembers',
									department_id: sanitizedDepartmentId,
									identifier_type: parsedIdentifiers.identifierType,
									member_identifiers: parsedIdentifiers.identifiers,
									added_count: parsedIdentifiers.identifiers.length,
								}
							: rawResponse,
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDepartmentRecoverableError(this, returnData, i, 'addMembers', error, {
					contextFields: {
						...(requestedDepartmentId ? { department_id: requestedDepartmentId } : {}),
						...(requestedIdentifierType ? { identifier_type: requestedIdentifierType } : {}),
						...(requestedMemberIdentifiers
							? { member_identifiers: requestedMemberIdentifiers }
							: {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('department id is required') ||
								normalizedMessage.includes('invalid department id format') ||
								normalizedMessage.includes('department id is too long'),
							reason: 'INVALID_DEPARTMENT_ID',
							hint: 'Use the exact Zoho Cliq department ID for the department you want to add members to.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'member identifiers must be either a json array of user ids or email ids, or a comma-separated string of identifiers',
								) ||
								normalizedMessage.includes(
									'member identifiers must be a valid json array when provided in array form',
								) ||
								normalizedMessage.includes(
									'member identifiers must be a json array of user ids or email ids when provided in array form',
								) ||
								normalizedMessage.includes('member identifiers are required') ||
								normalizedMessage.includes('at least one member identifier is required') ||
								normalizedMessage.includes('mixed identifier types are not supported') ||
								normalizedMessage.includes('invalid email format') ||
								normalizedMessage.includes('user ids[') ||
								normalizedMessage.includes('cannot add more than 100 members at once'),
							reason: 'INVALID_MEMBER_IDENTIFIERS',
							hint: 'Provide either all Zoho Cliq user IDs or all email IDs in one array, with no mixed types. For manual workflows, a comma-separated list is also accepted.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('the following user ids could not be found'),
							reason: 'USERS_NOT_FOUND',
							hint: 'One or more user_ids could not be matched to organization users. Retrieve users first and retry with canonical Zoho Cliq user IDs only.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('the following email ids could not be found'),
							reason: 'EMAILS_NOT_FOUND',
							hint: 'One or more email_ids could not be matched to organization users. Retrieve users first and retry with exact organization email IDs only.',
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
