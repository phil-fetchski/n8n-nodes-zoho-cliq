/**
 * Delete Department operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { DEPARTMENT_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDepartmentLookupPreflightGate } from '../shared/preflight';
import {
	departmentIdLocator,
	pushDepartmentRecoverableError,
	resolveDepartmentEnhancedOutput,
	validateDepartmentId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'delete');

const properties: INodeProperties[] = [
	{
		...departmentIdLocator,
		description: 'The unique department ID to delete.',
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
		displayName: `Delete Department Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-department" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteDepartmentDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/Delete Department as AI Tool Setup Guide: <a href="${DEPARTMENT_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteDepartmentAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
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
		let requestedDepartmentId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const departmentId = this.getNodeParameter('departmentId', i, '', {
				extractValue: true,
			}) as string;
			requestedDepartmentId = departmentId.trim();
			const sanitizedDepartmentId = validateDepartmentId(this, requestedDepartmentId, i);
			await runDepartmentLookupPreflightGate(this, i, grantedScopes, sanitizedDepartmentId);

			const endpoint = `/api/v2/departments/${encodeURIComponent(sanitizedDepartmentId)}`;
			const response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint);
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
									deleted: true,
									success: true,
									resource: 'department',
									operation: 'delete',
									department_id: sanitizedDepartmentId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDepartmentRecoverableError(this, returnData, i, 'delete', error, {
					contextFields: requestedDepartmentId
						? { department_id: requestedDepartmentId }
						: undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('department id is required') ||
								normalizedMessage.includes('invalid department id format') ||
								normalizedMessage.includes('department id is too long'),
							reason: 'INVALID_DEPARTMENT_ID',
							hint: 'Use the exact Zoho Cliq department ID for the department you want to delete.',
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
