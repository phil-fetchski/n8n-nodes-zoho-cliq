/**
 * Mark Reminder Incomplete operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { REMINDERS_MARK_INCOMPLETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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

const requiredScope = getRequiredScopeForOperation('reminders', 'markIncomplete');

const properties: INodeProperties[] = [
	reminderIdLocator,
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal completion response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Mark Incomplete Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#mark_reminder_incomplete" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'markReminderIncompleteDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Mark Incomplete as AI Tool Setup Guide: <a href="${REMINDERS_MARK_INCOMPLETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'markReminderIncompleteAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['markIncomplete'],
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
				'PUT',
				`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}/incomplete`,
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
									success: true,
									resource: 'reminders',
									operation: 'markIncomplete',
									reminder_id: sanitizedReminderId,
									completed: false,
								}
							: rawResponse,
					},
				],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'markIncomplete', error, {
					contextFields: sanitizedReminderId ? { reminder_id: sanitizedReminderId } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid reminder id format'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('mine category') ||
								(normalizedMessage.includes('mine') &&
									normalizedMessage.includes('mark') &&
									normalizedMessage.includes('incomplete')),
							reason: 'MINE_CATEGORY_ONLY',
							hint: 'Use mark incomplete only for reminders in the Mine category.',
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
