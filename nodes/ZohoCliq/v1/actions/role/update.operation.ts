/**
 * Update Role operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ROLE_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runRoleLookupPreflightGate } from '../shared/preflight';
import {
	parseRolePayloadInput,
	pushRoleRecoverableError,
	ROLE_NOT_FOUND_HINT,
	ROLE_NOT_FOUND_MESSAGE,
	roleIdLocator,
	validateRoleId,
	validateRoleInputMode,
	validateRolePayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('role', 'update');

const properties: INodeProperties[] = [
	{
		...roleIdLocator,
		description: 'The unique role ID to update',
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
		displayName: 'Prefill Existing Role Name',
		name: 'prefillRoleName',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Whether to auto-fetch and reuse the current role name from locator cache or API when Name is left empty',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Updated role name',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Updated role description',
	},
	{
		displayName: 'Role Updates (JSON)',
		name: 'roleUpdates',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload containing fields to update on the role. Supports a literal JSON object or stringified JSON object. Allowed keys: name, description.',
	},
	{
		displayName: `Edit a Role Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#edit-role" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateRoleDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Role/Update Role as AI Tool Setup Guide: <a href="${ROLE_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateRoleAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['update'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function extractCachedLocatorName(locatorValue: unknown): string | undefined {
	if (!locatorValue || typeof locatorValue !== 'object' || Array.isArray(locatorValue)) {
		return undefined;
	}

	const cachedResultName = (locatorValue as IDataObject).cachedResultName;
	if (typeof cachedResultName === 'string' && cachedResultName.trim()) {
		return cachedResultName.trim();
	}

	return undefined;
}

function extractRoleName(response: unknown): string | undefined {
	if (!response || typeof response !== 'object') {
		return undefined;
	}

	const root = response as IDataObject;
	const directName = typeof root.name === 'string' ? root.name.trim() : '';
	if (directName) {
		return directName;
	}

	const candidates = [root.profile, root.data, root.result, root.details];
	for (const candidate of candidates) {
		if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
			const candidateName = (candidate as IDataObject).name;
			if (typeof candidateName === 'string' && candidateName.trim()) {
				return candidateName.trim();
			}
		}
	}

	return undefined;
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedRoleId: string | undefined;
		let preflightRoleResponse: unknown;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const roleId = this.getNodeParameter('roleId', i, '', {
				extractValue: true,
			}) as string;
			const roleLocator = this.getNodeParameter('roleId', i) as unknown;
			requestedRoleId = roleId.trim();
			const sanitizedRoleId = validateRoleId(this, roleId, i);
			const inputMode = validateRoleInputMode(this, this.getNodeParameter('inputMode', i), i);
			const endpoint = `/api/v2/profiles/${encodeURIComponent(sanitizedRoleId)}`;

			let body: IDataObject;
			if (inputMode === 'structured') {
				const name = (this.getNodeParameter('name', i, '') as string).trim();
				const description = (this.getNodeParameter('description', i, '') as string).trim();
				const prefillRoleName = this.getNodeParameter('prefillRoleName', i, true) as boolean;

				body = {};
				if (name) {
					body.name = name;
				}
				if (description) {
					body.description = description;
				}

				if (!body.name && !body.description) {
					throw new NodeOperationError(
						this.getNode(),
						'Provide at least one field to update (Name or Description).',
						{ itemIndex: i },
					);
				}

				if (!body.name && prefillRoleName && body.description) {
					const preflightResult = await runRoleLookupPreflightGate(
						this,
						i,
						grantedScopes,
						sanitizedRoleId,
					);
					let existingRole =
						preflightResult.status === 'validated' ? preflightResult.entity : undefined;
					preflightRoleResponse = existingRole;
					let fetchError: unknown;
					if (!existingRole || !extractRoleName(existingRole)) {
						try {
							existingRole = await zohoCliqApiRequest.call(this, 'GET', endpoint);
							preflightRoleResponse = existingRole;
						} catch (error) {
							existingRole = undefined;
							fetchError = error;
						}
					}

					const existingName = extractRoleName(existingRole);
					const cachedName = extractCachedLocatorName(roleLocator);
					const resolvedName = existingName ?? cachedName;
					if (!resolvedName) {
						const fetchErrorMessage =
							fetchError instanceof Error ? ` Fetch error: ${fetchError.message}` : '';
						throw new NodeOperationError(
							this.getNode(),
							`Could not determine current role name for prefill. Provide Name explicitly.${fetchErrorMessage}`,
							{ itemIndex: i },
						);
					}
					body.name = resolvedName;
				}
			} else {
				const roleUpdates = this.getNodeParameter('roleUpdates', i, {}) as unknown;
				body = parseRolePayloadInput(this, roleUpdates, i, 'Role Updates');
			}

			body = validateRolePayload(this, body, i, 'Role Updates', {
				allowedFields: ['name', 'description'],
			});
			if (preflightRoleResponse === undefined) {
				const preflightResult = await runRoleLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedRoleId,
				);
				preflightRoleResponse =
					preflightResult.status === 'validated' ? preflightResult.entity : undefined;
			}

			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: { ...(response as IDataObject), updated: true } }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRoleRecoverableError(this, returnData, i, 'update', error, {
					contextFields: requestedRoleId ? { role_id: requestedRoleId } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be either'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use either Using Fields Below or Using JSON for the role update request.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('provide at least one field to update'),
							reason: 'NO_ROLE_UPDATES',
							hint: 'Provide at least one update field such as Name or Description.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('could not determine current role name for prefill'),
							reason: 'ROLE_NAME_PREFILL_FAILED',
							hint: 'Provide Name explicitly or disable Prefill Existing Role Name when only Description should change.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(ROLE_NOT_FOUND_MESSAGE.toLowerCase()),
							reason: 'ROLE_NOT_FOUND',
							messageOverride: ROLE_NOT_FOUND_MESSAGE,
							hint: ROLE_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('role updates must be') ||
								normalizedMessage.includes('role updates cannot be empty') ||
								normalizedMessage.includes('unsafe key "') ||
								normalizedMessage.includes('unsupported field'),
							reason: 'INVALID_ROLE_UPDATES',
							hint: 'Provide a valid JSON object using only the supported update keys: name and description.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('role id'),
							reason: 'INVALID_ROLE_ID',
							hint: 'Use the exact canonical Zoho Cliq role ID returned by List Roles.',
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
