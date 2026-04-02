/**
 * Get Role Permissions operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { ROLE_GET_PERMISSIONS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runRoleLookupPreflightGate } from '../shared/preflight';
import {
	pushRoleRecoverableError,
	ROLE_NOT_FOUND_HINT,
	ROLE_NOT_FOUND_MESSAGE,
	roleIdLocator,
	validateRoleId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('role', 'getPermissions');

const properties: INodeProperties[] = [
	{
		...roleIdLocator,
		description: 'The unique role ID to get permissions for',
	},
	{
		displayName: `Get Permissions of a Role Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#role-permission" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getRolePermissionsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Role/Get Role Permissions as AI Tool Setup Guide: <a href="${ROLE_GET_PERMISSIONS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getRolePermissionsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['getPermissions'],
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

			const roleId = this.getNodeParameter('roleId', i, '', {
				extractValue: true,
			}) as string;
			requestedRoleId = roleId.trim();
			const sanitizedRoleId = validateRoleId(this, roleId, i);
			await runRoleLookupPreflightGate(this, i, grantedScopes, sanitizedRoleId);

			const endpoint = `/api/v2/profiles/${encodeURIComponent(sanitizedRoleId)}/permissions`;
			const response = (await zohoCliqApiRequest.call(this, 'GET', endpoint)) as
				| IDataObject
				| undefined
				| null;
			const safeResponse = response ?? {};

			const executionData = this.helpers.constructExecutionMetaData([{ json: safeResponse }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRoleRecoverableError(this, returnData, i, 'getPermissions', error, {
					contextFields: requestedRoleId ? { role_id: requestedRoleId } : undefined,
					messageMappings: [
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
							reason: 'ROLE_PERMISSIONS_READ_NOT_ALLOWED',
							hint: 'Use an Organization Admin OAuth user with the required organization read scope.',
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
