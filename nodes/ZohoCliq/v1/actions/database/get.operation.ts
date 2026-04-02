/**
 * Get Cliq Database record operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { DATABASE_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDatabaseRecordLookupPreflightGate } from '../shared/preflight';
import { pushDatabaseRecoverableError, validateRecordId, validateTableName } from './common';
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
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		default: '',
		required: true,
		description: 'The unique record ID',
	},
	{
		displayName:
			'Get Record Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get_record" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.StorageData.READ</code>',
		name: 'getDatabaseRecordDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Database/Get Record as AI Tool Setup Guide: <a href="${DATABASE_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getDatabaseRecordAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['database'],
		operation: ['get'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('database', 'get');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let tableName: string | undefined;
		let recordId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			tableName = validateTableName(this, this.getNodeParameter('tableName', i) as string, i);
			recordId = validateRecordId(this, this.getNodeParameter('recordId', i) as string, i);

			const endpoint = `/api/v2/storages/${encodeURIComponent(tableName)}/records/${encodeURIComponent(recordId)}`;
			const preflightResult = await runDatabaseRecordLookupPreflightGate(
				this,
				i,
				grantedScopes,
				tableName,
				recordId,
			);
			const response =
				preflightResult.status === 'validated' && preflightResult.entity
					? preflightResult.entity
					: await zohoCliqApiRequest.call(this, 'GET', endpoint);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDatabaseRecoverableError(this, returnData, i, 'get', error, {
					contextFields: {
						...(tableName ? { database_name: tableName } : {}),
						...(recordId ? { record_id: recordId } : {}),
					},
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
								normalizedMessage.includes('record id is required') ||
								normalizedMessage.includes('invalid record id format'),
							reason: 'INVALID_RECORD_ID',
							hint: 'Use the exact Zoho Cliq record ID from the database response.',
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
