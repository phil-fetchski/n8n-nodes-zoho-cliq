/**
 * List Cliq Database records operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DATABASE_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushDatabaseRecoverableError, validateQueryParameters, validateTableName } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Database Name',
		name: 'tableName',
		type: 'string',
		default: '',
		required: true,
		description:
			'Cliq database unique name (for example, neightntestdatabase). Use the exact unique name, not display label.',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		options: [
			{
				displayName: 'Additional Query Parameters (JSON)',
				name: 'queryParameters',
				type: 'json',
				default: '{}',
				description:
					'Advanced mode: optional raw query params using only `criteria`, `from_index`, `limit`, `order_by`, and `start_token`. Explicit fields below override duplicate keys.',
			},
			{
				displayName: 'Criteria',
				name: 'criteria',
				type: 'string',
				default: '',
				description: 'Criteria expression used to filter records (for example, status==open)',
			},
			{
				displayName: 'From Index',
				name: 'fromIndex',
				type: 'number',
				default: 0,
				description: 'Fetch records starting from this index (0-based)',
				typeOptions: {
					minValue: 0,
				},
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
				displayName: 'Order By',
				name: 'orderBy',
				type: 'string',
				default: '',
				description: 'Sort expression (+column_name or -column_name)',
			},
			{
				displayName: 'Start Token',
				name: 'startToken',
				type: 'string',
				default: '',
				description: 'Continuation token returned by previous list response',
				typeOptions: { password: true },
			},
		],
	},
	{
		displayName:
			'List Records Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get_all_records" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.StorageData.READ</code>',
		name: 'listDatabaseRecordsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Database/List Records as AI Tool Setup Guide: <a href="${DATABASE_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listDatabaseRecordsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['database'],
		operation: ['list'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('database', 'list');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let tableName: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			tableName = validateTableName(this, this.getNodeParameter('tableName', i) as string, i);
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const rawQueryParameters = (additionalFields.queryParameters ?? {}) as IDataObject;
			const qs = validateQueryParameters(this, rawQueryParameters, i);

			if (additionalFields.fromIndex !== undefined && additionalFields.fromIndex !== null) {
				const fromIndex = Number(additionalFields.fromIndex);
				if (!Number.isInteger(fromIndex) || fromIndex < 0) {
					throw new NodeOperationError(
						this.getNode(),
						'From Index must be a whole number greater than or equal to 0',
						{
							itemIndex: i,
						},
					);
				}
				qs.from_index = fromIndex;
			}

			if (additionalFields.criteria !== undefined && additionalFields.criteria !== null) {
				const criteria = String(additionalFields.criteria).trim();
				if (criteria.length > 0) {
					qs.criteria = criteria;
				}
			}

			if (additionalFields.orderBy !== undefined && additionalFields.orderBy !== null) {
				const orderBy = String(additionalFields.orderBy).trim();
				if (orderBy.length > 0) {
					if (!/^(\+|-)[a-zA-Z][a-zA-Z0-9_]*$/.test(orderBy)) {
						throw new NodeOperationError(
							this.getNode(),
							'Order By must be in the format +column_name or -column_name',
							{
								itemIndex: i,
							},
						);
					}
					qs.order_by = orderBy;
				}
			}

			if (additionalFields.startToken !== undefined && additionalFields.startToken !== null) {
				const startToken = String(additionalFields.startToken).trim();
				if (startToken.length > 0) {
					if (startToken.length > 1024) {
						throw new NodeOperationError(this.getNode(), 'Start Token is too long', {
							itemIndex: i,
						});
					}
					qs.start_token = startToken;
				}
			}

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

			const endpoint = `/api/v2/storages/${encodeURIComponent(tableName)}/records`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint, {}, qs);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDatabaseRecoverableError(this, returnData, i, 'list', error, {
					contextFields: tableName ? { database_name: tableName } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('database name is required') ||
								normalizedMessage.includes('database name is too long') ||
								normalizedMessage.includes('database name cannot include'),
							reason: 'INVALID_DATABASE_NAME',
							hint: 'Use the exact Zoho Cliq database unique name and do not include "/" characters.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('from index must be a whole number') ||
								normalizedMessage.includes('limit must be a whole number') ||
								normalizedMessage.includes('order by must be in the format') ||
								normalizedMessage.includes('start token is too long') ||
								normalizedMessage.includes('unsupported query parameter'),
							reason: 'INVALID_QUERY_PARAMETERS',
							hint: 'Use only supported filters: criteria, from index, limit 1-100, order by, and start token.',
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
