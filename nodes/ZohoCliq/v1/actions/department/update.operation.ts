/**
 * Update Department operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DEPARTMENT_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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
	departmentIdLocator,
	parseDelimitedIds,
	parseDepartmentPayloadInput,
	pushDepartmentRecoverableError,
	validateDepartmentId,
	validateDepartmentInputMode,
	validateDepartmentPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'update');
const allowedUpdateFields = ['name', 'lead_zuid', 'user_ids', 'parent_department_id'];

const properties: INodeProperties[] = [
	{
		...departmentIdLocator,
		description: 'The unique department ID to update.',
	},
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
		displayName: 'Prefill Department Name',
		name: 'prefillDepartmentName',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Whether to auto-fill the required department name using the selected Department or Department ID',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				prefillDepartmentName: [false],
			},
		},
		description:
			'Department name used when Prefill Department Name is disabled. Blank values are not allowed when prefill is off.',
	},
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		options: [
			{
				displayName: 'Lead ZUID',
				name: 'leadZuid',
				type: 'string',
				default: '',
				description: 'Optional department lead user ID/ZUID. Blank values are allowed and omitted.',
			},
			{
				displayName: 'Parent Department ID',
				name: 'parentDepartmentId',
				type: 'string',
				default: '',
				description: 'Optional parent department ID. Blank values are allowed and omitted.',
			},
			{
				displayName: 'User IDs',
				name: 'userIds',
				type: 'string',
				default: '',
				placeholder: 'e.g. 123456789,987654321,112233445',
				description:
					'Optional comma-separated user IDs to set on the department. Blank values are allowed and omitted.',
			},
		],
	},
	{
		displayName: 'Department Updates (JSON)',
		name: 'departmentUpdates',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload for department updates. Supports object input or stringified JSON. Allowed fields: name, lead_zuid, user_ids, parent_department_id. If name is omitted, the current department name is auto-filled before the update request.',
	},
	...getSimplifyParameters('department', 'department', 'update'),
	{
		displayName: `Update Department Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-department-info" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateDepartmentDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/Update Department as AI Tool Setup Guide: <a href="${DEPARTMENT_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateDepartmentAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
		operation: ['update'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function extractDepartmentName(response: unknown): string | undefined {
	if (!response || typeof response !== 'object') {
		return undefined;
	}

	const root = response as IDataObject;
	const directName = typeof root.name === 'string' ? root.name.trim() : '';
	if (directName) {
		return directName;
	}

	const nestedCandidates = [
		root.department,
		root.data,
		root.result,
		root.department_details,
		root.departmentInfo,
	];
	for (const candidate of nestedCandidates) {
		if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
			const candidateName = (candidate as IDataObject).name;
			if (typeof candidateName === 'string' && candidateName.trim()) {
				return candidateName.trim();
			}
		}

		if (Array.isArray(candidate)) {
			for (const item of candidate) {
				if (item && typeof item === 'object' && !Array.isArray(item)) {
					const itemName = (item as IDataObject).name;
					if (typeof itemName === 'string' && itemName.trim()) {
						return itemName.trim();
					}
				}
			}
		}
	}

	return undefined;
}

async function fetchRequiredDepartmentName(
	context: IExecuteFunctions,
	endpoint: string,
	itemIndex: number,
): Promise<string> {
	let existingDepartment: unknown;
	try {
		existingDepartment = await zohoCliqApiRequest.call(context, 'GET', endpoint);
	} catch {
		throw new NodeOperationError(
			context.getNode(),
			'Department name is required. Auto-prefetch failed, so provide Name explicitly.',
			{ itemIndex },
		);
	}

	const existingName = extractDepartmentName(existingDepartment);
	if (!existingName) {
		throw new NodeOperationError(
			context.getNode(),
			'Department name is required. Auto-prefetch could not determine the current department name.',
			{ itemIndex },
		);
	}

	return existingName;
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedDepartmentId: string | undefined;
		let requestedName: string | undefined;
		let requestedLeadZuid: string | undefined;
		let requestedParentDepartmentId: string | undefined;
		let requestedUserIds: string[] | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const departmentId = this.getNodeParameter('departmentId', i, '', {
				extractValue: true,
			}) as string;
			requestedDepartmentId = departmentId.trim();
			const sanitizedDepartmentId = validateDepartmentId(this, departmentId, i);
			await runDepartmentLookupPreflightGate(this, i, grantedScopes, sanitizedDepartmentId);
			const inputMode = validateDepartmentInputMode(this, this.getNodeParameter('inputMode', i), i);
			const endpoint = `/api/v2/departments/${encodeURIComponent(sanitizedDepartmentId)}`;

			let body: IDataObject;
			if (inputMode === 'structured') {
				const prefillDepartmentName = this.getNodeParameter(
					'prefillDepartmentName',
					i,
					true,
				) as boolean;
				const updateFields = this.getNodeParameter('updateFields', i, {}) as IDataObject;
				requestedName = (this.getNodeParameter('name', i, '') as string).trim();
				body = {};

				if (!prefillDepartmentName && requestedName) {
					body.name = requestedName;
				}

				if (Object.prototype.hasOwnProperty.call(updateFields, 'leadZuid')) {
					requestedLeadZuid = String(updateFields.leadZuid ?? '').trim();
					if (requestedLeadZuid) {
						body.lead_zuid = requestedLeadZuid;
					}
				}

				if (Object.prototype.hasOwnProperty.call(updateFields, 'parentDepartmentId')) {
					requestedParentDepartmentId = String(updateFields.parentDepartmentId ?? '').trim();
					if (requestedParentDepartmentId) {
						body.parent_department_id = requestedParentDepartmentId;
					}
				}

				if (Object.prototype.hasOwnProperty.call(updateFields, 'userIds')) {
					const userIds = String(updateFields.userIds ?? '').trim();
					if (userIds) {
						body.user_ids = parseDelimitedIds(this, userIds, i, 'User IDs');
					}
				}

				if (prefillDepartmentName && body.name === undefined) {
					const existingName = await fetchRequiredDepartmentName(this, endpoint, i);
					body.name = existingName;
					requestedName = existingName;
				}

				if (!prefillDepartmentName && body.name === undefined) {
					throw new NodeOperationError(
						this.getNode(),
						'Department name is required when "Prefill Department Name" is disabled.',
						{ itemIndex: i },
					);
				}
			} else {
				const departmentUpdates = this.getNodeParameter('departmentUpdates', i, {}) as unknown;
				body = parseDepartmentPayloadInput(this, departmentUpdates, i, 'Department Updates');
				requestedName = typeof body.name === 'string' ? body.name.trim() : undefined;
				requestedLeadZuid = typeof body.lead_zuid === 'string' ? body.lead_zuid.trim() : undefined;
				requestedParentDepartmentId =
					typeof body.parent_department_id === 'string'
						? body.parent_department_id.trim()
						: undefined;

				if (body.name === undefined) {
					const existingName = await fetchRequiredDepartmentName(this, endpoint, i);
					body.name = existingName;
					requestedName = existingName;
				}
			}

			body = validateDepartmentPayload(this, body, i, 'Department Updates', {
				requireName: true,
				allowedFields: allowedUpdateFields,
			});
			requestedName = body.name as string;
			requestedLeadZuid = typeof body.lead_zuid === 'string' ? body.lead_zuid : undefined;
			requestedParentDepartmentId =
				typeof body.parent_department_id === 'string' ? body.parent_department_id : undefined;
			requestedUserIds = Array.isArray(body.user_ids) ? (body.user_ids as string[]) : undefined;

			if (requestedLeadZuid) {
				await runDepartmentUsersPreflightGate(this, [requestedLeadZuid], i, grantedScopes, {
					identifierLabel: 'lead user IDs',
					actionDescription: 'updating this department',
				});
			}

			if (requestedParentDepartmentId) {
				await runDepartmentLookupPreflightGate(
					this,
					i,
					grantedScopes,
					requestedParentDepartmentId,
					{
						fieldLabel: 'Parent Department ID',
						missing: {
							code: 'PARENT_DEPARTMENT_NOT_FOUND',
							message: `No department found for Parent Department ID "${requestedParentDepartmentId}".`,
							hint: 'The provided parent_department_id could not be matched to an existing department. Use List Departments to discover a valid parent department ID.',
						},
					},
				);
			}

			if (requestedUserIds?.length) {
				await runDepartmentUsersPreflightGate(this, requestedUserIds, i, grantedScopes, {
					actionDescription: 'updating this department',
				});
			}

			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('department');
			const simplified = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
				'data',
			);
			const json = { updated: true, ...simplified };

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDepartmentRecoverableError(this, returnData, i, 'update', error, {
					contextFields: {
						...(requestedDepartmentId ? { department_id: requestedDepartmentId } : {}),
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
							hint: 'Use "Using Fields Below" or "Using JSON" for the update request.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('department id is required') ||
								normalizedMessage.includes('invalid department id format') ||
								normalizedMessage.includes('department id is too long'),
							reason: 'INVALID_DEPARTMENT_ID',
							hint: 'Use the exact Zoho Cliq department ID for the department you want to update.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('auto-prefetch failed') ||
								normalizedMessage.includes('could not determine the current department name'),
							reason: 'DEPARTMENT_NAME_PREFILL_FAILED',
							hint: 'Provide name explicitly, or verify the department ID can be retrieved successfully so the current department name can be auto-filled.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'department name is required when "prefill department name" is disabled',
								) ||
								normalizedMessage.includes('department name is required') ||
								normalizedMessage.includes('department name is too long'),
							reason: 'INVALID_DEPARTMENT_NAME',
							hint: 'Provide a non-empty department name, or omit name so the current department name can be auto-filled before the update.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('lead zuid must be a non-empty string') ||
								normalizedMessage.includes('lead zuid is too long') ||
								normalizedMessage.includes('lead zuid has an invalid format'),
							reason: 'INVALID_LEAD_ZUID',
							hint: 'Use the exact Zoho Cliq user ID/ZUID for the new department lead, or leave the field blank to omit it.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('the following lead user ids could not be found'),
							reason: 'LEAD_USER_NOT_FOUND',
							hint: 'The provided lead_zuid could not be matched to an organization user. Retrieve users first and retry with a canonical Zoho Cliq user ID/ZUID.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('parent department id must be a non-empty string') ||
								normalizedMessage.includes('parent department id is too long') ||
								normalizedMessage.includes('parent department id has an invalid format'),
							reason: 'INVALID_PARENT_DEPARTMENT_ID',
							hint: 'Use the exact parent department ID from Zoho Cliq, or leave the field blank to omit it.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user ids must contain at least one id') ||
								normalizedMessage.includes('user_ids cannot be empty') ||
								normalizedMessage.includes('user_ids['),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide one or more comma-separated Zoho Cliq user IDs, or leave the field blank to omit it.',
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
