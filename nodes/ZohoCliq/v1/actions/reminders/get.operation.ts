/**
 * Get Reminder operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { REMINDERS_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runReminderLookupPreflightGate } from '../shared/preflight';
import { pushRemindersRecoverableError, reminderIdLocator, validateReminderId } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'get');

const properties: INodeProperties[] = [
	reminderIdLocator,
	{
		displayName: `Get Reminder Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get_reminder" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Get Reminder as AI Tool Setup Guide: <a href="${REMINDERS_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['get'],
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
			const preflight = await runReminderLookupPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedReminderId,
			);

			const response =
				preflight.status === 'validated' && preflight.entity
					? preflight.entity
					: await zohoCliqApiRequest.call(
							this,
							'GET',
							`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}`,
						);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'get', error, {
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
