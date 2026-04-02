/**
 * Update Role Permissions operation (Using JSON)
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError, sleep } from 'n8n-workflow';

import { ROLE_UPDATE_PERMISSIONS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runRoleLookupPreflightGate } from '../shared/preflight';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	parseRolePayloadInput,
	pushRoleRecoverableError,
	ROLE_NOT_FOUND_HINT,
	ROLE_NOT_FOUND_MESSAGE,
	roleIdLocator,
	validateRoleId,
	validateRolePermissionUpdatePayload,
} from './common';
import {
	READ_ONLY_PERMISSION_ACTIONS,
	UNSUPPORTED_PERMISSION_MODULES,
} from './permissions.constants';
import { applyDisplayOptions } from '../common.descriptions';

const defaultAdvancedPermissionPayload =
	'{"list":[{"module":"team_channels","action":"use","status":"enabled"}]}';
const requiredScope = getRequiredScopeForOperation('role', 'updatePermissions');

type FilteredPermissionEntry = {
	module: string;
	action?: string;
	reason:
		| 'read_only_action'
		| 'module_not_updatable'
		| 'empty_custom_rule_config'
		| 'no_effective_update';
};

export function isEmptyOrganisationCustomRuleConfig(config: IDataObject): boolean {
	if (typeof config.name !== 'string') {
		return false;
	}

	const name = config.name.trim();
	if (name !== 'custom_rule') {
		return false;
	}

	const value = config.value;
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}

	const typedValue = value as IDataObject;
	const enabled = typedValue.enabled;
	if (!Array.isArray(enabled)) {
		return false;
	}

	const disabled = typedValue.disabled;
	if (!Array.isArray(disabled)) {
		return false;
	}

	if (enabled.length !== 0) {
		return false;
	}

	if (disabled.length !== 0) {
		return false;
	}

	return true;
}

export function sanitizePermissionsListForUpdate(list: IDataObject[]): {
	sanitizedList: IDataObject[];
	filteredEntries: FilteredPermissionEntry[];
} {
	const sanitizedList: IDataObject[] = [];
	const filteredEntries: FilteredPermissionEntry[] = [];

	for (const row of list) {
		const module = String(row.module ?? '').trim();
		const action = String(row.action ?? '').trim();

		if (UNSUPPORTED_PERMISSION_MODULES.has(module)) {
			filteredEntries.push({
				module,
				action: action || undefined,
				reason: 'module_not_updatable',
			});
			continue;
		}

		if (action && READ_ONLY_PERMISSION_ACTIONS.has(action)) {
			filteredEntries.push({
				module,
				action,
				reason: 'read_only_action',
			});
			continue;
		}

		const nextRow: IDataObject = { ...row };
		if (Array.isArray(nextRow.configs)) {
			const sanitizedConfigs: IDataObject[] = [];
			for (const config of nextRow.configs as IDataObject[]) {
				if (isEmptyOrganisationCustomRuleConfig(config)) {
					filteredEntries.push({
						module,
						action: action || undefined,
						reason: 'empty_custom_rule_config',
					});
					continue;
				}

				sanitizedConfigs.push(config);
			}

			if (sanitizedConfigs.length > 0) {
				nextRow.configs = sanitizedConfigs;
			} else {
				delete nextRow.configs;
			}
		}

		const hasStatus = nextRow.status !== undefined;
		const hasConfigs = Array.isArray(nextRow.configs) && nextRow.configs.length > 0;
		if (!hasStatus && !hasConfigs) {
			filteredEntries.push({
				module,
				action: action || undefined,
				reason: 'no_effective_update',
			});
			continue;
		}

		sanitizedList.push(nextRow);
	}

	return { sanitizedList, filteredEntries };
}

const properties: INodeProperties[] = [
	{
		displayName:
			'Advanced mode: this operation sends JSON directly to the update endpoint. For user-friendly workflows, use Add Role Permissions or Remove Role Permissions.',
		name: 'updateRolePermissionsAdvancedNotice',
		type: 'notice',
		default: '',
	},
	{
		...roleIdLocator,
		description: 'The unique role ID to update permissions for',
	},
	{
		displayName: 'Enable Batch Updates',
		name: 'enableBatchUpdates',
		type: 'boolean',
		default: false,
		description:
			'Whether to split a large permissions list into multiple update requests to avoid oversized payload limits',
	},
	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		typeOptions: {
			minValue: 1,
			maxValue: 200,
			numberPrecision: 0,
		},
		default: 50,
		description:
			'Number of permission entries to send per batch request when Enable Batch Updates is true',
	},
	{
		displayName: 'Wait Between Batches (Milliseconds)',
		name: 'batchWaitMs',
		type: 'number',
		typeOptions: {
			minValue: 0,
			maxValue: 120000,
			numberPrecision: 0,
		},
		default: 300,
		description: 'How long to wait between each batch request when Enable Batch Updates is true',
	},
	{
		displayName: 'Permissions Updates (JSON)',
		name: 'permissionUpdates',
		type: 'json',
		default: defaultAdvancedPermissionPayload,
		required: true,
		description:
			'Using JSON payload for role permission changes. Expected shape: {"list":[{"module":"...","action":"...","status":"...","configs":[...]}]}.',
	},
	{
		displayName: 'Enable Enhanced Output',
		name: 'enableEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			'Whether to return workflow-friendly output metadata including payload and endpoint details',
	},
	{
		displayName: `Update Role Permissions Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-role" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateRolePermissionsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Role/Update Role Permissions as AI Tool Setup Guide: <a href="${ROLE_UPDATE_PERMISSIONS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateRolePermissionsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['updatePermissions'],
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
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const roleId = this.getNodeParameter('roleId', i, '', { extractValue: true }) as string;
			const enableEnhancedOutput = Boolean(this.getNodeParameter('enableEnhancedOutput', i, true));
			const enableBatchUpdates = Boolean(this.getNodeParameter('enableBatchUpdates', i, false));
			const batchSizeRaw = this.getNodeParameter('batchSize', i, 50) as number;
			const batchWaitMsRaw = this.getNodeParameter('batchWaitMs', i, 300) as number;
			const permissionUpdates = this.getNodeParameter('permissionUpdates', i, {}) as unknown;

			requestedRoleId = roleId.trim();
			const sanitizedRoleId = validateRoleId(this, roleId, i);
			const body = validateRolePermissionUpdatePayload(
				this,
				parseRolePayloadInput(this, permissionUpdates, i, 'Permissions Updates'),
				i,
				'Permissions Updates',
				{ allowReadOnlyActions: true },
			) as IDataObject;
			if (
				enableBatchUpdates &&
				(!Number.isFinite(batchSizeRaw) || !Number.isInteger(batchSizeRaw) || batchSizeRaw < 1)
			) {
				throw new NodeOperationError(
					this.getNode(),
					'Batch Size must be a whole number greater than 0.',
					{
						itemIndex: i,
					},
				);
			}
			if (
				enableBatchUpdates &&
				(!Number.isFinite(batchWaitMsRaw) ||
					!Number.isInteger(batchWaitMsRaw) ||
					batchWaitMsRaw < 0)
			) {
				throw new NodeOperationError(
					this.getNode(),
					'Wait Between Batches (Milliseconds) must be a whole number greater than or equal to 0.',
					{ itemIndex: i },
				);
			}

			await runRoleLookupPreflightGate(this, i, grantedScopes, sanitizedRoleId);
			const list = Array.isArray(body.list) ? (body.list as IDataObject[]) : [];
			const permissionCount = list.length;
			const { sanitizedList, filteredEntries } = sanitizePermissionsListForUpdate(list);
			const sanitizedPermissionCount = sanitizedList.length;

			const batchSize = Math.trunc(batchSizeRaw);
			const batchWaitMs = Math.trunc(batchWaitMsRaw);

			const endpoint = `/api/v2/profiles/${encodeURIComponent(sanitizedRoleId)}/permissions`;
			let responsePayload: unknown;
			let enhancedApiResponse: IDataObject;
			let batchCount = 1;
			const shouldBatch = enableBatchUpdates && sanitizedPermissionCount > batchSize;
			const sanitizedBody: IDataObject = {
				...body,
				list: sanitizedList,
			};

			if (sanitizedPermissionCount === 0) {
				batchCount = 0;
				responsePayload = {
					success: true,
					apiCallSkipped: true,
					batched: false,
					batchCount,
					filteredOutCount: filteredEntries.length,
					filteredEntries,
					warning:
						'No valid permission updates remain after filtering unsupported/read-only entries.',
				};
				enhancedApiResponse = responsePayload as IDataObject;
			} else if (shouldBatch) {
				const batchResponses: unknown[] = [];
				batchCount = Math.ceil(sanitizedPermissionCount / batchSize);

				for (let start = 0; start < sanitizedPermissionCount; start += batchSize) {
					checkRequiredScope(this, grantedScopes, requiredScope, i);

					const batchList = sanitizedList.slice(start, start + batchSize);
					const batchBody: IDataObject = { list: batchList };
					const batchResponse = (await zohoCliqApiRequest.call(
						this,
						'PUT',
						endpoint,
						batchBody,
					)) as IDataObject;
					batchResponses.push(batchResponse);

					if (batchWaitMs > 0 && start + batchSize < sanitizedPermissionCount) {
						await sleep(batchWaitMs);
					}
				}

				responsePayload = {
					batched: true,
					batchCount,
					batchSize,
					responses: batchResponses,
					filteredOutCount: filteredEntries.length,
					filteredEntries,
				};
				enhancedApiResponse = {
					...(responsePayload as IDataObject),
					responses: batchResponses.map((response) => coerceApiResponseToObject(response)),
				};
			} else {
				responsePayload = await zohoCliqApiRequest.call(this, 'PUT', endpoint, sanitizedBody);
				enhancedApiResponse = coerceApiResponseToObject(responsePayload);
				if (filteredEntries.length > 0) {
					enhancedApiResponse = {
						...enhancedApiResponse,
						filteredOutCount: filteredEntries.length,
						filteredEntries,
					};
				}
			}

			const outputJson: IDataObject = enableEnhancedOutput
				? {
						updated: true,
						success: true,
						resource: 'role',
						operation: 'updatePermissions',
						operationIntent: 'updatePermissionsAdvanced',
						roleId: sanitizedRoleId,
						permissionCount,
						sanitizedPermissionCount,
						filteredOutCount: filteredEntries.length,
						filteredEntries,
						batched: shouldBatch,
						batchSize: enableBatchUpdates ? batchSize : undefined,
						batchCount,
						apiResponse: enhancedApiResponse,
					}
				: { ...coerceApiResponseToObject(responsePayload), updated: true };
			const executionData = this.helpers.constructExecutionMetaData([{ json: outputJson }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRoleRecoverableError(this, returnData, i, 'updatePermissions', error, {
					contextFields: requestedRoleId ? { role_id: requestedRoleId } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'permissions updates must include a non-empty "list" array',
								),
							reason: 'INVALID_PERMISSIONS_UPDATE_PAYLOAD',
							hint: 'Provide a top-level JSON object with a non-empty list array of permission update entries.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('batch size must be a whole number greater than 0'),
							reason: 'INVALID_BATCH_SIZE',
							hint: 'Use a whole-number Batch Size greater than 0.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'wait between batches (milliseconds) must be a whole number greater than or equal to 0',
								),
							reason: 'INVALID_BATCH_WAIT',
							hint: 'Use a whole-number Wait Between Batches value of 0 or greater.',
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
								normalizedMessage.includes('unsafe key') ||
								normalizedMessage.includes('json object'),
							reason: 'UNSAFE_PERMISSIONS_UPDATE_PAYLOAD',
							hint: 'Use a plain JSON object and remove unsafe keys such as __proto__, constructor, and prototype.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('operation_not_allowed') ||
								normalizedMessage.includes('not_an_organization_admin'),
							reason: 'ROLE_PERMISSIONS_UPDATE_NOT_ALLOWED',
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
