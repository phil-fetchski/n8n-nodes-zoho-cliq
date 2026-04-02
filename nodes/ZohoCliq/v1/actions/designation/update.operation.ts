/**
 * Update Designation operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { DESIGNATION_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDesignationLookupPreflightGate } from '../shared/preflight';
import {
	designationIdLocator,
	pushDesignationRecoverableError,
	rethrowDesignationApiError,
	validateDesignationId,
	validateDesignationPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('designation', 'update');

const properties: INodeProperties[] = [
	{
		...designationIdLocator,
		description: 'The unique designation ID to update.',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description: 'Required updated designation name. Maximum length: 30 characters.',
	},
	{
		displayName: `Update Designation Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-designation" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateDesignationDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Designation/Update Designation as AI Tool Setup Guide: <a href="${DESIGNATION_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateDesignationAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['designation'],
		operation: ['update'],
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
		let requestedName: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const designationId = this.getNodeParameter('designationId', i, '', {
				extractValue: true,
			}) as string;
			const sanitizedDesignationId = validateDesignationId(this, designationId, i);
			requestedDesignationId = sanitizedDesignationId;
			requestedName = (this.getNodeParameter('name', i) as string).trim();
			await runDesignationLookupPreflightGate(this, i, grantedScopes, sanitizedDesignationId);
			const endpoint = `/api/v2/designations/${encodeURIComponent(sanitizedDesignationId)}`;
			const body = validateDesignationPayload(
				this,
				{ name: requestedName } as IDataObject,
				i,
				'Designation Updates',
				{
					requireName: true,
					allowedFields: ['name'],
				},
			);

			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);
			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: { ...(response as IDataObject), updated: true } }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDesignationRecoverableError(this, returnData, i, 'update', error, {
					contextFields: {
						...(requestedDesignationId ? { designation_id: requestedDesignationId } : {}),
						...(requestedName ? { designation_name: requestedName } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation id is required') ||
								normalizedMessage.includes('designation id is too long') ||
								normalizedMessage.includes('designation id has an invalid format'),
							reason: 'INVALID_DESIGNATION_ID',
							hint: 'Use the exact Zoho Cliq designation ID for the designation you want to update.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation name is required') ||
								normalizedMessage.includes('designation name is too long'),
							reason: 'INVALID_DESIGNATION_NAME',
							hint: 'Provide a non-empty designation name up to 30 characters.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('designation_already_exist'),
							reason: 'DESIGNATION_ALREADY_EXISTS',
							hint: 'Use a different designation name or inspect existing designations first.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('operation_not_allowed'),
							reason: 'OPERATION_NOT_ALLOWED',
							hint: 'Ensure the API user has organization admin privileges or the operation is permitted for this account.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('not_an_organization_admin'),
							reason: 'PERMISSION_DENIED',
							hint: 'Ensure the API user has organization admin privileges or the operation is permitted for this account.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('designation_not_exist'),
							reason: 'DESIGNATION_NOT_FOUND',
							hint: 'Verify the designation ID and confirm the designation still exists in Zoho Cliq.',
						},
					],
				})
			) {
				continue;
			}

			rethrowDesignationApiError(this, error, i, 'Update designation', {
				designationId: requestedDesignationId,
			});
		}
	}

	return returnData;
}
