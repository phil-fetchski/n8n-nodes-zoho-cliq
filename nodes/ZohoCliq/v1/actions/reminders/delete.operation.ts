/**
 * Delete Reminder operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { REMINDERS_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runReminderLookupPreflightGate } from '../shared/preflight';
import {
	pushRemindersRecoverableError,
	reminderIdLocator,
	resolveRemindersEnhancedOutput,
	validateReminderId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'delete');

const properties: INodeProperties[] = [
	reminderIdLocator,
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal delete response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Delete Reminder Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete_reminder" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Delete Reminder as AI Tool Setup Guide: <a href="${REMINDERS_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['delete'],
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
		let sanitizedReminderId: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const reminderId = this.getNodeParameter('reminderId', i, '', {
				extractValue: true,
			}) as string;
			sanitizedReminderId = validateReminderId(this, reminderId, i);
			await runReminderLookupPreflightGate(this, i, grantedScopes, sanitizedReminderId);

			const response = await zohoCliqApiRequest.call(
				this,
				'DELETE',
				`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}`,
			);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveRemindersEnhancedOutput(
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
									resource: 'reminders',
									operation: 'delete',
									reminder_id: sanitizedReminderId,
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
				pushRemindersRecoverableError(this, returnData, i, 'delete', error, {
					contextFields: {
						...(sanitizedReminderId ? { reminder_id: sanitizedReminderId } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid reminder id format'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
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
