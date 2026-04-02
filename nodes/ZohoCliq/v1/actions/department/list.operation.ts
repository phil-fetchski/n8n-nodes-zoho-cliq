/**
 * List Departments operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DEPARTMENT_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import { pushDepartmentRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'list');

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
				displayName: 'Next Token',
				name: 'nextToken',
				type: 'string',
				default: '',
				description:
					'Optional. Opaque pagination cursor returned by a previous Zoho Cliq department list response as next_token. Reuse exactly as returned to fetch the next page of standard pagination results. Blank values are allowed and omitted.',
				typeOptions: { password: true },
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description:
					'Optional department-name search string. Blank values are allowed and omitted.',
			},
		],
	},
	...getSimplifyParameters('departmentListItem', 'department', 'list'),
	{
		displayName: `List Departments Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-department-list" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'listDepartmentsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/List Departments as AI Tool Setup Guide: <a href="${DEPARTMENT_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listDepartmentsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
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
		let nextToken: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const qs: Record<string, string | number> = {};
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			search = String(additionalFields.search ?? '').trim();
			nextToken = String(additionalFields.nextToken ?? '').trim();

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				const limit = Number(additionalFields.limit);
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
			}

			if (search) {
				qs.search = search;
			}

			if (nextToken) {
				if (nextToken.length > 1024) {
					throw new NodeOperationError(this.getNode(), 'Next Token is too long', {
						itemIndex: i,
					});
				}

				qs.next_token = nextToken;
			}

			const response = (await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/departments',
				{},
				qs,
			)) as IDataObject;

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('departmentListItem');
			const listItems = applySimplifyModeToList(response, 'data', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDepartmentRecoverableError(this, returnData, i, 'list', error, {
					contextFields: {
						...(search ? { search } : {}),
						...(nextToken ? { next_token: '[REDACTED]' } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('limit must be a whole number between 1 and 100'),
							reason: 'INVALID_LIMIT',
							hint: 'Use a whole-number page size between 1 and 100.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('next token is too long'),
							reason: 'INVALID_NEXT_TOKEN',
							hint: 'Use the exact next_token value returned by the previous department list response.',
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
