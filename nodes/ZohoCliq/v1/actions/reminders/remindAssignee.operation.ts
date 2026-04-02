/**
 * Remind Assignee operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { REMINDERS_REMIND_ASSIGNEE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateUserId } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	runReminderLookupPreflightGate,
	runUserIdentifiersPreflightGate,
	USER_LOOKUP_NOT_FOUND_HINT,
	userListLookupScopes,
} from '../shared/preflight';
import { pushRemindersRecoverableError, reminderIdLocator, validateReminderId } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'remindAssignee');

const properties: INodeProperties[] = [
	reminderIdLocator,
	{
		displayName: 'User ID',
		name: 'userId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The exact assignee user ID to remind. Use one user ID already assigned to this reminder.',
	},
	{
		displayName: `Remind Assignee Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#remind_assignee" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'remindAssigneeReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Remind Assignee as AI Tool Setup Guide: <a href="${REMINDERS_REMIND_ASSIGNEE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'remindAssigneeReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['remindAssignee'],
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
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const reminderId = this.getNodeParameter('reminderId', i, '', {
				extractValue: true,
			}) as string;
			const userId = this.getNodeParameter('userId', i) as string;

			const sanitizedReminderId = validateReminderId(this, reminderId, i);
			const sanitizedUserId = validateUserId(this, userId, i);
			await runReminderLookupPreflightGate(this, i, grantedScopes, sanitizedReminderId);
			await runUserIdentifiersPreflightGate(this, i, grantedScopes, {
				identifiers: [sanitizedUserId],
				subjectLabel: 'Reminder Assignee User ID',
				acceptedScopes: userListLookupScopes,
				missing: {
					code: 'USER_NOT_FOUND',
					message: `No Zoho Cliq user found for User ID "${sanitizedUserId}". Verify the assignee exists before retrying.`,
					hint: USER_LOOKUP_NOT_FOUND_HINT,
				},
			});

			const response: IDataObject = await zohoCliqApiRequest.call(
				this,
				'PUT',
				`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}/users/${encodeURIComponent(sanitizedUserId)}/remind`,
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const reminderId = this.getNodeParameter('reminderId', i, '', {
				extractValue: true,
			}) as string;
			const userId = this.getNodeParameter('userId', i) as string;
			const sanitizedReminderId =
				typeof reminderId === 'string' && reminderId.trim() ? reminderId.trim() : undefined;
			const sanitizedUserId =
				typeof userId === 'string' && userId.trim() ? userId.trim() : undefined;

			if (
				pushRemindersRecoverableError(this, returnData, i, 'remindAssignee', error, {
					contextFields: {
						...(sanitizedReminderId ? { reminder_id: sanitizedReminderId } : {}),
						...(sanitizedUserId ? { user_id: sanitizedUserId } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid reminder id format'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('invalid user id format'),
							reason: 'INVALID_USER_ID',
							hint: 'Use the exact assigned user ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('not authorized to do this operation') ||
								(normalizedMessage.includes('others') &&
									normalizedMessage.includes('category') &&
									normalizedMessage.includes('remind')),
							reason: 'OTHERS_CATEGORY_REQUIRED',
							hint: 'Remind assignee only for reminders in the Others category.',
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
