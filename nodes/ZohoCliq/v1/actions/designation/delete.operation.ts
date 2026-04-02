/**
 * Delete Designation operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { DESIGNATION_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDesignationLookupPreflightGate } from '../shared/preflight';
import {
	designationIdLocator,
	pushDesignationRecoverableError,
	resolveDesignationEnhancedOutput,
	rethrowDesignationApiError,
	validateDesignationId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('designation', 'delete');

const properties: INodeProperties[] = [
	{
		...designationIdLocator,
		description: 'The unique designation ID to delete.',
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
		displayName: `Delete Designation Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-designation" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteDesignationDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Designation/Delete Designation as AI Tool Setup Guide: <a href="${DESIGNATION_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteDesignationAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['designation'],
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
		let requestedDesignationId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const designationId = this.getNodeParameter('designationId', i, '', {
				extractValue: true,
			}) as string;
			requestedDesignationId = designationId.trim();
			const sanitizedDesignationId = validateDesignationId(this, designationId, i);
			await runDesignationLookupPreflightGate(this, i, grantedScopes, sanitizedDesignationId);

			const endpoint = `/api/v2/designations/${encodeURIComponent(sanitizedDesignationId)}`;
			const response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint);
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
									operation: 'delete',
									designation_id: sanitizedDesignationId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDesignationRecoverableError(this, returnData, i, 'delete', error, {
					contextFields: requestedDesignationId
						? { designation_id: requestedDesignationId }
						: undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation id is required') ||
								normalizedMessage.includes('designation id is too long') ||
								normalizedMessage.includes('designation id has an invalid format'),
							reason: 'INVALID_DESIGNATION_ID',
							hint: 'Use the exact Zoho Cliq designation ID for the designation you want to delete.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation_not_exist') ||
								normalizedMessage.includes('department_not_exist'),
							reason: 'DESIGNATION_NOT_FOUND',
							hint: 'Verify the designation ID and confirm the designation still exists in Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('operation_not_allowed') ||
								normalizedMessage.includes('not_an_organization_admin') ||
								normalizedMessage.includes('department_base_dept_delete_not_allowed'),
							reason: 'DESIGNATION_DELETE_NOT_ALLOWED',
							hint: 'Use an organization admin account and confirm designations are not managed through Zoho People.',
						},
					],
				})
			) {
				continue;
			}

			rethrowDesignationApiError(this, error, i, 'Delete designation', {
				designationId: requestedDesignationId,
			});
		}
	}

	return returnData;
}
