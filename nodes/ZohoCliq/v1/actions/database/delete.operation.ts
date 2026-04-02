/**
 * Delete Cliq Database row operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { DATABASE_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDatabaseRecordLookupPreflightGate } from '../shared/preflight';
import {
	pushDatabaseRecoverableError,
	resolveDatabaseEnhancedOutput,
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
		description: 'The unique record ID to delete',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata. Disable to return Cliq's standard success response, which may be minimal.",
	},
	{
		displayName:
			'Delete Record Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete_record" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.StorageData.DELETE</code>',
		name: 'deleteDatabaseRecordDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Database/Delete Record as AI Tool Setup Guide: <a href="${DATABASE_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteDatabaseRecordAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['database'],
		operation: ['delete'],
	},
};

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rewriteDeleteErrorRecordIdInString(value: string, suppliedRecordId: string): string {
	const trimmedSupplied = suppliedRecordId.trim();
	if (!/^0\d+$/.test(trimmedSupplied)) {
		return value;
	}

	const normalizedRecordId = trimmedSupplied.replace(/^0+/, '') || '0';
	const escapedNormalizedRecordId = escapeRegExp(normalizedRecordId);
	return value.replace(
		new RegExp(
			`\\b(id\\s+|record[_ ]id\\s+|record[_ -]?id["':\\s]+)${escapedNormalizedRecordId}\\b`,
			'gi',
		),
		(_match, prefix: string) => `${prefix}${trimmedSupplied}`,
	);
}

function cloneErrorWithRewrittenRecordId(error: Error, suppliedRecordId: string): Error {
	const descriptors = Object.getOwnPropertyDescriptors(error);
	const messageDescriptor = descriptors.message;
	const stackDescriptor = descriptors.stack;

	if (messageDescriptor && 'value' in messageDescriptor) {
		messageDescriptor.value = rewriteDeleteErrorRecordIdInString(
			String(messageDescriptor.value ?? ''),
			suppliedRecordId,
		);
	}

	if (stackDescriptor && 'value' in stackDescriptor && typeof stackDescriptor.value === 'string') {
		stackDescriptor.value = rewriteDeleteErrorRecordIdInString(
			stackDescriptor.value,
			suppliedRecordId,
		);
	}

	for (const [key, descriptor] of Object.entries(descriptors)) {
		if (!('value' in descriptor) || key === 'message' || key === 'stack') {
			continue;
		}

		descriptor.value = rewriteDeleteErrorRecordId(descriptor.value, suppliedRecordId);
	}

	return Object.create(Object.getPrototypeOf(error), descriptors) as Error;
}

function rewriteDeleteErrorRecordId(value: unknown, suppliedRecordId: string): unknown {
	if (typeof value === 'string') {
		return rewriteDeleteErrorRecordIdInString(value, suppliedRecordId);
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	if (value instanceof Error) {
		return cloneErrorWithRewrittenRecordId(value, suppliedRecordId);
	}

	if (Array.isArray(value)) {
		return value.map((entry) => rewriteDeleteErrorRecordId(entry, suppliedRecordId));
	}

	return Object.fromEntries(
		Object.entries(value).map(([key, entry]) => [
			key,
			rewriteDeleteErrorRecordId(entry, suppliedRecordId),
		]),
	);
}

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('database', 'delete');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let tableName: string | undefined;
		let recordId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			tableName = validateTableName(this, this.getNodeParameter('tableName', i) as string, i);
			recordId = validateRecordId(this, this.getNodeParameter('recordId', i) as string, i);

			await runDatabaseRecordLookupPreflightGate(this, i, grantedScopes, tableName, recordId);

			const endpoint = `/api/v2/storages/${encodeURIComponent(tableName)}/records/${encodeURIComponent(recordId)}`;
			const response = (await zohoCliqApiRequest.call(this, 'DELETE', endpoint)) as IDataObject;
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveDatabaseEnhancedOutput(
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
									operation: 'delete',
									database_name: tableName,
									record_id: recordId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			const formattedError = recordId ? rewriteDeleteErrorRecordId(error, recordId) : error;
			if (
				pushDatabaseRecoverableError(this, returnData, i, 'delete', formattedError, {
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
			throw formattedError;
		}
	}

	return returnData;
}
