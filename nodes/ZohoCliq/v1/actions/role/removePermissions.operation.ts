/**
 * Remove Role Permissions operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runRoleLookupPreflightGate } from '../shared/preflight';
import {
	pushRoleRecoverableError,
	ROLE_NOT_FOUND_HINT,
	ROLE_NOT_FOUND_MESSAGE,
	ROLE_HELPER_OPERATION_NOT_RECOMMENDED_AS_AI_TOOL_NOTICE,
	roleIdLocator,
	validateRoleId,
	validateRolePermissionUpdatePayload,
} from './common';
import {
	collectSelectedPermissions,
	getPermissionGroupsBySection,
	summarizePermissionList,
	toPermissionGroupProperty,
} from './permissionsUi';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('role', 'removePermissions');

const properties: INodeProperties[] = [
	{
		...roleIdLocator,
		description: 'The unique role ID to remove permissions from',
	},
	{
		displayName: 'Output Update Payload Only',
		name: 'outputUpdatePayloadOnly',
		type: 'boolean',
		default: false,
		description:
			'Whether to skip the API update call and only output the payload that would be sent',
	},
	{
		displayName:
			'Tip: when Output Update Payload Only is enabled, map {{$json.payload}} into Update Role Permissions (Advanced) > Permissions Updates (JSON), or disable the toggle to apply changes directly here.',
		name: 'outputUpdatePayloadOnlyNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				outputUpdatePayloadOnly: [true],
			},
		},
	},
	{
		displayName: 'Enable Enhanced Output',
		name: 'enableEnhancedOutput',
		type: 'boolean',
		default: true,
		displayOptions: {
			show: {
				outputUpdatePayloadOnly: [false],
			},
		},
		description:
			'Whether to return workflow-friendly output metadata including selected permission updates',
	},
	{
		displayName: 'Admin Panel Permission Groups',
		name: 'adminPanelPermissionGroupsNotice',
		type: 'notice',
		default: '',
	},
	...getPermissionGroupsBySection('admin').map(toPermissionGroupProperty),
	{
		displayName: 'Configuration Permission Groups',
		name: 'configurationPermissionGroupsNotice',
		type: 'notice',
		default: '',
	},
	...getPermissionGroupsBySection('configuration').map(toPermissionGroupProperty),
	{
		displayName: 'Mobile Specific Configuration Groups',
		name: 'mobilePermissionGroupsNotice',
		type: 'notice',
		default: '',
	},
	...getPermissionGroupsBySection('mobile').map(toPermissionGroupProperty),
	{
		displayName: `Remove Role Permissions Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-role" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'removeRolePermissionsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: ROLE_HELPER_OPERATION_NOT_RECOMMENDED_AS_AI_TOOL_NOTICE,
		name: 'removeRolePermissionsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['removePermissions'],
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
			const outputUpdatePayloadOnly = this.getNodeParameter(
				'outputUpdatePayloadOnly',
				i,
				false,
			) as boolean;
			const enableEnhancedOutput = this.getNodeParameter(
				'enableEnhancedOutput',
				i,
				true,
			) as boolean;
			const effectiveEnhancedOutput = outputUpdatePayloadOnly ? false : enableEnhancedOutput;
			requestedRoleId = roleId.trim();
			const sanitizedRoleId = validateRoleId(this, roleId, i);

			const list = collectSelectedPermissions(this, i, 'disabled');

			if (list.length === 0) {
				throw new NodeOperationError(this.getNode(), 'Select at least one permission to remove.', {
					itemIndex: i,
				});
			}

			const payload = validateRolePermissionUpdatePayload(
				this,
				{ list } as IDataObject,
				i,
				'Permissions Updates',
			) as IDataObject;
			const endpoint = `/api/v2/profiles/${encodeURIComponent(sanitizedRoleId)}/permissions`;
			const permissionSummary = summarizePermissionList(list);

			if (outputUpdatePayloadOnly) {
				const outputJson = {
					success: true,
					resource: 'role',
					operation: 'removePermissions',
					outputOnly: true,
					method: 'PUT',
					endpoint,
					payload,
				};
				const executionData = this.helpers.constructExecutionMetaData([{ json: outputJson }], {
					itemData: { item: i },
				});
				returnData.push(...executionData);
				continue;
			}

			await runRoleLookupPreflightGate(this, i, grantedScopes, sanitizedRoleId);

			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, payload);
			const outputJson = effectiveEnhancedOutput
				? {
						deleted: true,
						success: true,
						resource: 'role',
						operation: 'removePermissions',
						operationIntent: 'removePermissions',
						roleId: sanitizedRoleId,
						permissionCount: permissionSummary.length,
						permissions: permissionSummary,
						apiResponse: response,
					}
				: { ...(response as IDataObject), deleted: true };
			const executionData = this.helpers.constructExecutionMetaData([{ json: outputJson }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRoleRecoverableError(this, returnData, i, 'removePermissions', error, {
					contextFields: requestedRoleId ? { role_id: requestedRoleId } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('select at least one permission to remove'),
							reason: 'NO_PERMISSIONS_SELECTED',
							hint: 'Select one or more supported structured permission entries to disable for the role.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid structured permission selection'),
							reason: 'INVALID_PERMISSION_SELECTION',
							hint: 'Use the provided permission group options only. Do not pass custom multi-select values.',
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
