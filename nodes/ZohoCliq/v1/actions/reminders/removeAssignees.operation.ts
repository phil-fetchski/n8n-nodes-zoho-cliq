/**
 * Remove Reminder Assignees operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { REMINDERS_REMOVE_ASSIGNEES_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, extractErrorText, validateUserIdArray } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED_ERROR_CODE,
	runReminderLookupPreflightGate,
	runReminderLastAssigneeRemovalPreflightGate,
} from '../shared/preflight';
import {
	pushRemindersRecoverableError,
	reminderIdLocator,
	resolveRemindersEnhancedOutput,
	validateReminderId,
	validateReminderUserIds,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'removeAssignees');

const properties: INodeProperties[] = [
	reminderIdLocator,
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		description:
			'Comma-separated list of exact assignee user IDs to remove from the reminder (maximum 4). The node sends one unassign request per user ID.',
		placeholder: 'e.g. 7234192,2498713',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this batched unassign flow. Disable to return Cliq's standard response from the final successful unassign call.",
	},
	{
		displayName: `Unassign User Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#unassign_user_reminder" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'removeAssigneesReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Remove Reminder Assignees as AI Tool Setup Guide: <a href="${REMINDERS_REMOVE_ASSIGNEES_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'removeAssigneesReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['removeAssignees'],
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
		let sanitizedUserIds: string[] | undefined;
		let failedUserId: string | undefined;
		let lastResponse: IDataObject | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const reminderId = this.getNodeParameter('reminderId', i, '', {
				extractValue: true,
			}) as string;
			const userIds = this.getNodeParameter('userIds', i) as string | string[];

			sanitizedReminderId = validateReminderId(this, reminderId, i);
			const parsedUserIds = validateUserIdArray(this, userIds, i);
			sanitizedUserIds = validateReminderUserIds(this, parsedUserIds, i, 'user_ids', { max: 4 });
			const reminderLookupPreflight = await runReminderLookupPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedReminderId,
			);
			await runReminderLastAssigneeRemovalPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedReminderId,
				sanitizedUserIds,
				{
					reminder:
						reminderLookupPreflight.status === 'validated'
							? reminderLookupPreflight.entity
							: undefined,
				},
			);

			for (const userId of sanitizedUserIds) {
				try {
					lastResponse = (await zohoCliqApiRequest.call(
						this,
						'DELETE',
						`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}/users/${encodeURIComponent(userId)}`,
					)) as IDataObject;
				} catch (error) {
					failedUserId = userId;
					throw error;
				}
			}

			const { includeEnhancedOutput, rawResponse, responseJson } = resolveRemindersEnhancedOutput(
				this,
				i,
				lastResponse ?? {},
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
									operation: 'removeAssignees',
									reminder_id: sanitizedReminderId,
									removed_user_ids: sanitizedUserIds,
									user_count: sanitizedUserIds.length,
									api_call_count: sanitizedUserIds.length,
									single_user_endpoint_used: true,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (!sanitizedUserIds) {
				try {
					const rawUserIds = this.getNodeParameter('userIds', i) as string | string[];
					const parsedUserIds = validateUserIdArray(this, rawUserIds, i);
					sanitizedUserIds = validateReminderUserIds(this, parsedUserIds, i, 'user_ids', {
						max: 4,
					});
				} catch {
					try {
						const rawUserIds = this.getNodeParameter('userIds', i) as string | string[];
						if (typeof rawUserIds === 'string') {
							sanitizedUserIds = rawUserIds
								.split(',')
								.map((value) => value.trim())
								.filter((value) => value.length > 0);
						} else if (Array.isArray(rawUserIds)) {
							sanitizedUserIds = rawUserIds
								.map((value) => String(value).trim())
								.filter((value) => value.length > 0);
						} else {
							sanitizedUserIds = undefined;
						}
					} catch {
						sanitizedUserIds = undefined;
					}
				}
			}

			if (
				pushRemindersRecoverableError(this, returnData, i, 'removeAssignees', error, {
					contextFields: {
						...(sanitizedReminderId ? { reminder_id: sanitizedReminderId } : {}),
						...(sanitizedUserIds?.length
							? { user_ids: sanitizedUserIds, user_count: sanitizedUserIds.length }
							: {}),
						...(failedUserId ? { user_id: failedUserId } : {}),
					},
					messageMappings: [
						{
							match: (_normalizedMessage, _message, error) =>
								error instanceof NodeOperationError &&
								(error as NodeOperationError & { code?: string }).code ===
									LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED_ERROR_CODE,
							reason: 'LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED',
							hint: 'A users-type reminder must keep at least one assignee. Remove fewer users, or use Delete Reminder if the reminder should be removed entirely.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('last remaining assignee') ||
								normalizedMessage.includes('last assignee') ||
								normalizedMessage.includes('last user') ||
								normalizedMessage.includes('zero assignees') ||
								normalizedMessage.includes('at least one assignee') ||
								normalizedMessage.includes('delete the reminder instead'),
							reason: 'LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED',
							hint: 'A users-type reminder must keep at least one assignee. Remove fewer users, or use Delete Reminder if the reminder should be removed entirely.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('reminder id') && normalizedMessage.includes('invalid'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('at least one user id'),
							reason: 'EMPTY_USER_ID_LIST',
							hint: 'Provide at least one exact assignee user ID to remove.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user_ids can contain at most 4 user id'),
							reason: 'USER_BATCH_LIMIT_EXCEEDED',
							hint: 'Remove no more than 4 assignee user IDs in one run.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid user id format') ||
								(normalizedMessage.includes('user id') &&
									normalizedMessage.includes('invalid') &&
									!normalizedMessage.includes('reminder')),
							reason: 'INVALID_USER_ID',
							hint: 'Use exact Zoho Cliq user IDs for reminder assignees.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('others') &&
								normalizedMessage.includes('category') &&
								normalizedMessage.includes('remove'),
							reason: 'OTHERS_CATEGORY_REQUIRED',
							hint: 'Remove assignees only for reminders in the Others category.',
						},
					],
				})
			) {
				continue;
			}

			if (failedUserId && sanitizedReminderId) {
				throw new NodeOperationError(
					this.getNode(),
					`Failed to remove assignee "${failedUserId}" from reminder "${sanitizedReminderId}": ${extractErrorText(error)}`,
					{
						itemIndex: i,
					},
				);
			}

			throw error;
		}
	}

	return returnData;
}
