/**
 * Assign Reminder operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { REMINDERS_ASSIGN_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateUserIdArray } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	REMINDER_TYPE_NOT_ASSIGNABLE_ERROR_CODE,
	runReminderAssignableTypePreflightGate,
	runReminderLookupPreflightGate,
} from '../shared/preflight';
import {
	pushRemindersRecoverableError,
	reminderIdLocator,
	validateReminderId,
	validateReminderUserIds,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'assign');

const properties: INodeProperties[] = [
	reminderIdLocator,
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description:
			'Comma-separated list of exact assignee user IDs to add to this reminder (maximum 4). Example: 723419201,249871345.',
		placeholder: 'e.g. 723419201,249871345',
	},
	{
		displayName: `Assign Users Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#assign_users_reminder" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'assignReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Assign Users as AI Tool Setup Guide: <a href="${REMINDERS_ASSIGN_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'assignReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['assign'],
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
			const userIds = this.getNodeParameter('userIds', i) as string | string[];

			const sanitizedReminderId = validateReminderId(this, reminderId, i);
			const parsedUserIds = validateUserIdArray(this, userIds, i);
			const sanitizedUserIds = validateReminderUserIds(this, parsedUserIds, i, 'user_ids', {
				max: 4,
			});
			const reminderLookupPreflight = await runReminderLookupPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedReminderId,
			);
			await runReminderAssignableTypePreflightGate(this, i, grantedScopes, sanitizedReminderId, {
				reminder:
					reminderLookupPreflight.status === 'validated'
						? reminderLookupPreflight.entity
						: undefined,
			});

			const endpoint = `/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}/users`;
			const body: IDataObject = {
				user_ids: sanitizedUserIds,
			};

			const response = await zohoCliqApiRequest.call(this, 'POST', endpoint, body);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const reminderId = this.getNodeParameter('reminderId', i, '', {
				extractValue: true,
			}) as string;
			const userIds = this.getNodeParameter('userIds', i) as string | string[];
			const sanitizedReminderId =
				typeof reminderId === 'string' && reminderId.trim() ? reminderId.trim() : undefined;
			const parsedUserIds =
				typeof userIds === 'string' || Array.isArray(userIds)
					? userIds
							.toString()
							.split(',')
							.map((value) => value.trim())
							.filter((value) => value.length > 0)
					: undefined;

			if (
				pushRemindersRecoverableError(this, returnData, i, 'assign', error, {
					contextFields: {
						...(sanitizedReminderId ? { reminder_id: sanitizedReminderId } : {}),
						...(parsedUserIds?.length
							? { user_ids: parsedUserIds, user_count: parsedUserIds.length }
							: {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('reminder id') && normalizedMessage.includes('invalid'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('at least one user id'),
							reason: 'EMPTY_USER_ID_LIST',
							hint: 'Provide at least one exact assignee user ID.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user_ids can contain at most 4 user id'),
							reason: 'USER_BATCH_LIMIT_EXCEEDED',
							hint: 'Assign no more than 4 assignee user IDs in one request.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid user id format') ||
								(normalizedMessage.includes('user id') &&
									normalizedMessage.includes('invalid') &&
									!normalizedMessage.includes('reminder')),
							reason: 'INVALID_USER_ID',
							hint: 'Use exact Zoho Cliq user IDs for assignees.',
						},
						{
							match: (_normalizedMessage, _message, error) =>
								error instanceof NodeOperationError &&
								(error as NodeOperationError & { code?: string }).code ===
									REMINDER_TYPE_NOT_ASSIGNABLE_ERROR_CODE,
							reason: 'REMINDER_TYPE_NOT_ASSIGNABLE',
							hint: 'User assignment is supported only for users-type reminders in the Others category. Chat-targeted reminders do not support assignee updates.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('not authorized to do this operation') ||
								(normalizedMessage.includes('others') &&
									normalizedMessage.includes('category') &&
									normalizedMessage.includes('assign')),
							reason: 'OTHERS_CATEGORY_REQUIRED',
							hint: 'Assign users only for reminders in the Others category.',
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
