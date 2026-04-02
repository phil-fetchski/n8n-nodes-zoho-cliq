/**
 * Create Department operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { DEPARTMENT_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import {
	runDepartmentLookupPreflightGate,
	runDepartmentUsersPreflightGate,
} from '../shared/preflight';
import {
	parseDelimitedIds,
	parseDepartmentPayloadInput,
	pushDepartmentRecoverableError,
	validateDepartmentInputMode,
	validateDepartmentPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'create');
const allowedCreateFields = ['name', 'lead_zuid', 'parent_department_id', 'user_ids'];

const properties: INodeProperties[] = [
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Choose whether to build the payload with individual fields or provide JSON directly',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Department name',
	},
	{
		displayName: 'Lead ZUID',
		name: 'leadZuid',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Required department lead user ID. Use the exact Zoho Cliq user ID/ZUID for the lead who will own this department.',
	},
	{
		displayName: 'Parent Department ID',
		name: 'parentDepartmentId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Required parent department ID under which this department will be created. Use the exact Zoho Cliq department ID.',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		placeholder: 'e.g. 123456789,987654321,112233445',
		description: 'Optional comma-separated user IDs to assign to the department',
	},
	{
		displayName: 'Department Definition (JSON)',
		name: 'departmentDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload to create a department. Supports object input or stringified JSON. Allowed fields: name, lead_zuid, parent_department_id, user_ids.',
	},
	...getSimplifyParameters('department', 'department', 'create'),
	{
		displayName: `Create Department Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-department" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createDepartmentDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/Create Department as AI Tool Setup Guide: <a href="${DEPARTMENT_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createDepartmentAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
		operation: ['create'],
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
		let requestedName: string | undefined;
		let requestedLeadZuid: string | undefined;
		let requestedParentDepartmentId: string | undefined;
		let requestedUserIds: string[] | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const inputMode = validateDepartmentInputMode(this, this.getNodeParameter('inputMode', i), i);
			let body: IDataObject;

			if (inputMode === 'structured') {
				requestedName = (this.getNodeParameter('name', i) as string).trim();
				requestedLeadZuid = (this.getNodeParameter('leadZuid', i) as string).trim();
				requestedParentDepartmentId = (
					this.getNodeParameter('parentDepartmentId', i) as string
				).trim();
				const userIds = (this.getNodeParameter('userIds', i) as string).trim();

				body = {
					name: requestedName,
				};
				if (requestedLeadZuid) {
					body.lead_zuid = requestedLeadZuid;
				}
				if (requestedParentDepartmentId) {
					body.parent_department_id = requestedParentDepartmentId;
				}
				if (userIds) {
					body.user_ids = parseDelimitedIds(this, userIds, i, 'User IDs');
				}
			} else {
				const departmentDefinition = this.getNodeParameter(
					'departmentDefinition',
					i,
					{},
				) as unknown;
				body = parseDepartmentPayloadInput(this, departmentDefinition, i, 'Department Definition');
				requestedName = typeof body.name === 'string' ? body.name.trim() : undefined;
				requestedLeadZuid = typeof body.lead_zuid === 'string' ? body.lead_zuid.trim() : undefined;
				requestedParentDepartmentId =
					typeof body.parent_department_id === 'string'
						? body.parent_department_id.trim()
						: undefined;
			}

			body = validateDepartmentPayload(this, body, i, 'Department Definition', {
				requireName: true,
				requireLeadZuid: true,
				requireParentDepartmentId: true,
				allowedFields: allowedCreateFields,
			});
			requestedName = body.name as string;
			requestedLeadZuid = body.lead_zuid as string;
			requestedParentDepartmentId = body.parent_department_id as string;
			requestedUserIds = Array.isArray(body.user_ids) ? (body.user_ids as string[]) : undefined;

			await runDepartmentUsersPreflightGate(this, [requestedLeadZuid], i, grantedScopes, {
				identifierLabel: 'lead user IDs',
				actionDescription: 'creating this department',
			});

			await runDepartmentLookupPreflightGate(this, i, grantedScopes, requestedParentDepartmentId, {
				fieldLabel: 'Parent Department ID',
				missing: {
					code: 'PARENT_DEPARTMENT_NOT_FOUND',
					message: `No department found for Parent Department ID "${requestedParentDepartmentId}".`,
					hint: 'The provided parent_department_id could not be matched to an existing department. Use List Departments to discover a valid parent department ID.',
				},
			});

			if (requestedUserIds?.length) {
				await runDepartmentUsersPreflightGate(this, requestedUserIds, i, grantedScopes, {
					actionDescription: 'creating this department',
				});
			}

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/departments', body);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('department');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
				'data',
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDepartmentRecoverableError(this, returnData, i, 'create', error, {
					contextFields: {
						...(requestedName ? { department_name: requestedName } : {}),
						...(requestedLeadZuid ? { lead_zuid: requestedLeadZuid } : {}),
						...(requestedParentDepartmentId
							? { parent_department_id: requestedParentDepartmentId }
							: {}),
						...(requestedUserIds ? { user_ids: requestedUserIds } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be either'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use "Using Fields Below" or "Using JSON" for the create request.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('department name is required') ||
								normalizedMessage.includes('department name is too long'),
							reason: 'INVALID_DEPARTMENT_NAME',
							hint: 'Provide a non-empty department name up to 120 characters.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('lead zuid is required') ||
								normalizedMessage.includes('lead zuid must be a non-empty string') ||
								normalizedMessage.includes('lead zuid has an invalid format'),
							reason: 'INVALID_LEAD_ZUID',
							hint: 'Provide the exact Zoho Cliq lead user ID/ZUID for this department.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('the following lead user ids could not be found'),
							reason: 'LEAD_USER_NOT_FOUND',
							hint: 'The provided lead_zuid could not be matched to an organization user. Retrieve users first and retry with a canonical Zoho Cliq user ID/ZUID.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('parent department id is required') ||
								normalizedMessage.includes('parent department id must be a non-empty string') ||
								normalizedMessage.includes('parent department id has an invalid format'),
							reason: 'INVALID_PARENT_DEPARTMENT_ID',
							hint: 'Provide the exact parent department ID from Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user ids must contain at least one id') ||
								normalizedMessage.includes('user ids[') ||
								normalizedMessage.includes('user_ids must be an array of strings') ||
								normalizedMessage.includes('user_ids cannot be empty'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide comma-separated Zoho Cliq user IDs only when you want to add initial members.',
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
