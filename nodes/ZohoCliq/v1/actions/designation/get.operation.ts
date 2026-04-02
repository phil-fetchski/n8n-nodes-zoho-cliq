/**
 * Get Designation operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { DESIGNATION_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDesignationLookupPreflightGate } from '../shared/preflight';
import {
	designationIdLocator,
	pushDesignationRecoverableError,
	rethrowDesignationApiError,
	validateDesignationId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('designation', 'get');

const properties: INodeProperties[] = [
	{
		...designationIdLocator,
		description: 'The unique designation ID to retrieve.',
	},
	{
		displayName: `Get Designation Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-designation-details" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getDesignationDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Designation/Get Designation as AI Tool Setup Guide: <a href="${DESIGNATION_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getDesignationAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['designation'],
		operation: ['get'],
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
			const sanitizedDesignationId = validateDesignationId(this, designationId, i);
			requestedDesignationId = sanitizedDesignationId;
			await runDesignationLookupPreflightGate(this, i, grantedScopes, sanitizedDesignationId);

			const endpoint = `/api/v2/designations/${encodeURIComponent(sanitizedDesignationId)}`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);
			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDesignationRecoverableError(this, returnData, i, 'get', error, {
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
							hint: 'Use the exact Zoho Cliq designation ID for the designation you want to retrieve.',
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

			rethrowDesignationApiError(this, error, i, 'Get designation', {
				designationId: requestedDesignationId,
			});
		}
	}

	return returnData;
}
