/**
 * Update Cliq Database row operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	ResourceMapperValue,
} from 'n8n-workflow';

import { DATABASE_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDatabaseRecordLookupPreflightGate } from '../shared/preflight';
import {
	parseRecordValuesFromResourceMapper,
	parseJsonObjectInput,
	pushDatabaseRecoverableError,
	validateDatabaseInputMode,
	validateRecordId,
	validateTableName,
} from './common';
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
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		default: 'structured',
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		description:
			'Choose whether to map record values with individual fields or provide JSON values directly',
	},
	{
		displayName: 'Record Values',
		name: 'updateRecordValuesMapper',
		type: 'resourceMapper',
		default: {
			mappingMode: 'defineBelow',
			value: null,
		},
		typeOptions: {
			resourceMapper: {
				resourceMapperMethod: 'getDatabaseRecordMapperFields',
				mode: 'update',
				addAllFields: true,
				supportAutoMap: true,
				fieldWords: {
					singular: 'Field',
					plural: 'Fields',
				},
			},
		},
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Map database record values using inferred fields and types from existing records',
	},
	{
		displayName: 'Record Values (JSON)',
		name: 'updateDataRaw',
		type: 'json',
		default: '{}',
		required: true,
		description:
			'Using JSON object for record values to update. Supports object input or stringified JSON object.',
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
	},
	{
		displayName:
			'Update Record Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update_record" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.StorageData.UPDATE</code>',
		name: 'updateDatabaseRecordDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Database/Update Record as AI Tool Setup Guide: <a href="${DATABASE_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateDatabaseRecordAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['database'],
		operation: ['update'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('database', 'update');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let tableName: string | undefined;
		let recordId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			tableName = validateTableName(this, this.getNodeParameter('tableName', i) as string, i);
			recordId = validateRecordId(this, this.getNodeParameter('recordId', i) as string, i);
			const inputMode = validateDatabaseInputMode(this, this.getNodeParameter('inputMode', i), i);
			let values: IDataObject;

			if (inputMode === 'structured') {
				const mapperValue = this.getNodeParameter(
					'updateRecordValuesMapper',
					i,
				) as ResourceMapperValue;
				values = parseRecordValuesFromResourceMapper(
					this,
					mapperValue,
					i,
					'Record Values',
					items[i].json,
				);
			} else {
				const rawValues = this.getNodeParameter('updateDataRaw', i, {}) as IDataObject | string;
				values = parseJsonObjectInput(this, rawValues, i, 'Record Values');
			}

			await runDatabaseRecordLookupPreflightGate(this, i, grantedScopes, tableName, recordId);

			const body = { values };

			const endpoint = `/api/v2/storages/${encodeURIComponent(tableName)}/records/${encodeURIComponent(recordId)}`;
			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: { ...(response as IDataObject), updated: true } }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDatabaseRecoverableError(this, returnData, i, 'update', error, {
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
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('record values') ||
								normalizedMessage.includes('auto mapping'),
							reason: 'INVALID_RECORD_VALUES',
							hint: 'Provide at least one safe JSON field value, either from the mapper or as a JSON object.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be either'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use Using Fields Below for mapped values or Using JSON for a JSON object payload.',
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
