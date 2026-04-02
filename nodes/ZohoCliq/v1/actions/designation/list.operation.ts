/**
 * List Designations operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DESIGNATION_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushDesignationRecoverableError, rethrowDesignationApiError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('designation', 'list');

const properties: INodeProperties[] = [
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Additional Fields',
		options: [
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				description: 'Max number of results to return',
				typeOptions: { minValue: 1, maxValue: 100 },
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description:
					'Optional designation-name search string. Blank values are allowed and omitted.',
			},
		],
	},
	{
		displayName: `List Designations Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-designation-list" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'listDesignationsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Designation/List Designations as AI Tool Setup Guide: <a href="${DESIGNATION_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listDesignationsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['designation'],
		operation: ['list'],
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
		let search: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const qs: Record<string, string | number> = {};
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			search = String(additionalFields.search ?? '').trim();

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				const limit = Number(additionalFields.limit);
				if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
					throw new NodeOperationError(
						this.getNode(),
						'Limit must be a whole number between 1 and 100',
						{ itemIndex: i },
					);
				}
				qs.limit = limit;
			}

			if (search) {
				if (search.length > 120) {
					throw new NodeOperationError(
						this.getNode(),
						'Search is too long. Maximum length is 120 characters.',
						{ itemIndex: i },
					);
				}
				qs.search = search;
			}

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/designations', {}, qs);
			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: response as IDataObject }],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDesignationRecoverableError(this, returnData, i, 'list', error, {
					contextFields: search ? { search } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('limit must be a whole number between 1 and 100'),
							reason: 'INVALID_LIMIT',
							hint: 'Use a whole-number page size between 1 and 100.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('search is too long'),
							reason: 'INVALID_SEARCH',
							hint: 'Use a shorter designation-name search string up to 120 characters.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('operation_not_allowed'),
							reason: 'DESIGNATION_LIST_NOT_ALLOWED',
							hint: 'Confirm this account can read designations and that designations are available for the organization.',
						},
					],
				})
			) {
				continue;
			}

			rethrowDesignationApiError(this, error, i, 'List designations');
		}
	}

	return returnData;
}
