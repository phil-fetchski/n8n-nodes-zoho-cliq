/**
 * Get Department Members operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { DEPARTMENT_GET_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDepartmentLookupPreflightGate } from '../shared/preflight';
import {
	departmentIdLocator,
	pushDepartmentRecoverableError,
	validateDepartmentId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'getMembers');

const properties: INodeProperties[] = [
	{
		...departmentIdLocator,
		description: 'The unique department ID to get members for.',
	},
	{
		displayName: `Get Department Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-department-members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getDepartmentMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/Get Department Members as AI Tool Setup Guide: <a href="${DEPARTMENT_GET_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getDepartmentMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
		operation: ['getMembers'],
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
			const sanitizedDepartmentId = validateDepartmentId(this, departmentId, i);
			await runDepartmentLookupPreflightGate(this, i, grantedScopes, sanitizedDepartmentId);

			const endpoint = `/api/v2/departments/${encodeURIComponent(sanitizedDepartmentId)}/members`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDepartmentRecoverableError(this, returnData, i, 'getMembers', error, {
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
							hint: 'Use the exact Zoho Cliq department ID for the department whose members you want to retrieve.',
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
