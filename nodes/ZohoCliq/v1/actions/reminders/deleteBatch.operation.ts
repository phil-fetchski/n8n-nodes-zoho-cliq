/**
 * Delete Reminders (Batch) operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { REMINDERS_DELETE_BATCH_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runReminderIdentifiersPreflightGate } from '../shared/preflight';
import {
	parseReminderPayloadInput,
	pushRemindersRecoverableError,
	resolveRemindersEnhancedOutput,
	validateReminderIdArray,
	validateReminderInputMode,
	validateReminderPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'deleteBatch');

const properties: INodeProperties[] = [
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Choose whether to build the payload with individual fields or provide JSON directly',
	},
	{
		displayName: 'Reminder IDs',
		name: 'reminderIds',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Comma-separated list of reminder IDs to delete (maximum 20)',
		placeholder: 'e.g. 11360000000205005,11360000000205009',
	},
	{
		displayName: 'Delete Batch Payload (JSON)',
		name: 'deleteBatchPayload',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload. Pass a JSON object or stringified JSON object. Required field: reminder_ids (array with 1 to 20 reminder IDs).',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal batch delete response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Delete Reminders Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#batch_delete_reminders" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteBatchRemindersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Delete Reminders as AI Tool Setup Guide: <a href="${REMINDERS_DELETE_BATCH_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteBatchRemindersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['deleteBatch'],
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
		let reminderIds: string[] | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const inputMode = validateReminderInputMode(this, this.getNodeParameter('inputMode', i), i);
			let body: IDataObject;

			if (inputMode === 'structured') {
				const rawReminderIds = this.getNodeParameter('reminderIds', i) as string;
				const parsedReminderIds = rawReminderIds
					.split(',')
					.map((id) => id.trim())
					.filter((id) => id.length > 0);

				reminderIds = validateReminderIdArray(this, parsedReminderIds, i);
				body = {
					reminder_ids: reminderIds,
				};
			} else {
				const raw = this.getNodeParameter('deleteBatchPayload', i, {}) as unknown;
				body = parseReminderPayloadInput(this, raw, i, 'Delete Batch Payload');
				body = validateReminderPayload(this, body, i, 'Delete Batch Payload', {
					allowedFields: ['reminder_ids'],
				});
				reminderIds = validateReminderIdArray(this, body.reminder_ids, i);
				body.reminder_ids = reminderIds;
			}
			await runReminderIdentifiersPreflightGate(this, i, grantedScopes, reminderIds);

			const response = await zohoCliqApiRequest.call(
				this,
				'DELETE',
				'/api/v2/reminders/batch',
				body,
			);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveRemindersEnhancedOutput(
				this,
				i,
				response,
				true,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									deleted: true,
									success: true,
									resource: 'reminders',
									operation: 'deleteBatch',
									reminder_ids: reminderIds,
									reminder_count: reminderIds.length,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'deleteBatch', error, {
					contextFields: reminderIds?.length
						? {
								reminder_ids: reminderIds,
								reminder_count: reminderIds.length,
							}
						: undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('reminder_ids') &&
								normalizedMessage.includes('at least one id'),
							reason: 'EMPTY_REMINDER_ID_LIST',
							hint: 'Provide at least one exact reminder ID to delete.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('reminder_ids') &&
								normalizedMessage.includes('at most 20 ids'),
							reason: 'BATCH_LIMIT_EXCEEDED',
							hint: 'Delete reminders in batches of 20 IDs or fewer.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid reminder id format'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use exact reminder IDs returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('unsupported field'),
							reason: 'UNSUPPORTED_PAYLOAD_FIELD',
							hint: 'Use only the reminder_ids field in the batch delete payload.',
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
