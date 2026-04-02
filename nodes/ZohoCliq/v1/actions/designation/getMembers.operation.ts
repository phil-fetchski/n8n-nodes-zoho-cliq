/**
 * Get Designation Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DESIGNATION_GET_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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

const requiredScope = getRequiredScopeForOperation('designation', 'getMembers');

const properties: INodeProperties[] = [
	{
		...designationIdLocator,
		description: 'The unique designation ID to get members for.',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		default: 50,
		description: 'Max number of results to return',
		typeOptions: {
			minValue: 1,
			maxValue: 100,
		},
	},
	{
		displayName: 'Next Token',
		name: 'nextToken',
		type: 'string',
		default: '',
		typeOptions: { password: true },
		description:
			'Optional next_token from a previous designation members response. Blank values are allowed and omitted.',
	},
	{
		displayName: `Get Designation Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-designation-members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getDesignationMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Designation/Get Designation Members as AI Tool Setup Guide: <a href="${DESIGNATION_GET_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getDesignationMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['designation'],
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
		let requestedDesignationId: string | undefined;
		let nextToken: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const designationId = this.getNodeParameter('designationId', i, '', {
				extractValue: true,
			}) as string;
			requestedDesignationId = designationId.trim();
			const sanitizedDesignationId = validateDesignationId(this, designationId, i);

			const qs: Record<string, string | number> = {};
			const limit = Number(this.getNodeParameter('limit', i, 50));
			nextToken = (this.getNodeParameter('nextToken', i, '') as string).trim();

			if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
				throw new NodeOperationError(
					this.getNode(),
					'Limit must be a whole number between 1 and 100',
					{
						itemIndex: i,
					},
				);
			}
			qs.limit = limit;

			if (nextToken) {
				if (nextToken.length > 1024) {
					throw new NodeOperationError(this.getNode(), 'Next Token is too long', {
						itemIndex: i,
					});
				}
				qs.next_token = nextToken;
			}

			await runDesignationLookupPreflightGate(this, i, grantedScopes, sanitizedDesignationId);

			const endpoint = `/api/v2/designations/${encodeURIComponent(sanitizedDesignationId)}/members`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint, {}, qs);
			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: response as IDataObject }],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDesignationRecoverableError(this, returnData, i, 'getMembers', error, {
					contextFields: {
						...(requestedDesignationId ? { designation_id: requestedDesignationId } : {}),
						...(nextToken ? { next_token: '[REDACTED]' } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation id is required') ||
								normalizedMessage.includes('designation id is too long') ||
								normalizedMessage.includes('designation id has an invalid format'),
							reason: 'INVALID_DESIGNATION_ID',
							hint: 'Use the exact Zoho Cliq designation ID for the designation you want to inspect.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('limit must be a whole number between 1 and 100'),
							reason: 'INVALID_LIMIT',
							hint: 'Use a whole-number page size between 1 and 100.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('next token is too long'),
							reason: 'INVALID_NEXT_TOKEN',
							hint: 'Use the exact next_token value returned by the previous designation-members response.',
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

			rethrowDesignationApiError(this, error, i, 'Get designation members', {
				designationId: requestedDesignationId,
			});
		}
	}

	return returnData;
}
