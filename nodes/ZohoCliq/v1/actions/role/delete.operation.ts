/**
 * Delete Role operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ROLE_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runRoleLookupPreflightGate } from '../shared/preflight';
import {
	pushRoleRecoverableError,
	resolveRoleEnhancedOutput,
	ROLE_NOT_FOUND_HINT,
	ROLE_NOT_FOUND_MESSAGE,
	roleIdLocator,
	validateRoleId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('role', 'delete');
const requiredScopeLabel = requiredScopes.map((scope) => `<code>${scope}</code>`).join(' or ');

function extractRoleIsDefault(response: unknown): boolean {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return false;
	}

	const root = response as IDataObject;
	if (typeof root.is_default === 'boolean') {
		return root.is_default;
	}

	const nestedCandidates = [root.data, root.profile, root.result, root.details];
	for (const candidate of nestedCandidates) {
		if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
			const isDefault = (candidate as IDataObject).is_default;
			if (typeof isDefault === 'boolean') {
				return isDefault;
			}
		}
	}

	return false;
}

const properties: INodeProperties[] = [
	{
		...roleIdLocator,
		description: 'The unique role ID to delete',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal delete response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Delete a Role Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-role" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> ACCEPTED SCOPES: ${requiredScopeLabel}`,
		name: 'deleteRoleDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Role/Delete Role as AI Tool Setup Guide: <a href="${ROLE_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteRoleAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['delete'],
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
			checkRequiredScope(this, grantedScopes, requiredScopes, i);

			const roleId = this.getNodeParameter('roleId', i, '', {
				extractValue: true,
			}) as string;
			requestedRoleId = roleId.trim();
			const sanitizedRoleId = validateRoleId(this, roleId, i);

			const endpoint = `/api/v2/profiles/${encodeURIComponent(sanitizedRoleId)}`;
			await runRoleLookupPreflightGate(this, i, grantedScopes, sanitizedRoleId);
			const preflightResponse = await zohoCliqApiRequest.call(this, 'GET', endpoint);

			if (extractRoleIsDefault(preflightResponse)) {
				throw new NodeOperationError(
					this.getNode(),
					'Default Zoho Cliq roles cannot be deleted. Only custom roles can be deleted.',
					{ itemIndex: i },
				);
			}

			const response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint);
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
									...responseJson,
									deleted: true,
									success: true,
									resource: 'role',
									operation: 'delete',
									role_id: sanitizedRoleId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRoleRecoverableError(this, returnData, i, 'delete', error, {
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
								normalizedMessage.includes('default zoho cliq roles cannot be deleted'),
							reason: 'DEFAULT_ROLE_DELETE_NOT_ALLOWED',
							hint: 'Only custom Zoho Cliq roles can be deleted. Pick a non-default role ID from List Roles and try again.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('operation_not_allowed') ||
								normalizedMessage.includes('not_an_organization_admin'),
							reason: 'ROLE_DELETE_NOT_ALLOWED',
							hint: 'Use an Organization Admin OAuth user with the required organization update or delete scope.',
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
