/**
 * Remind Assignees operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { REMINDERS_REMIND_ASSIGNEES_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateUserIdArray } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	runReminderLookupPreflightGate,
	runUserIdentifiersPreflightGate,
	USER_LOOKUP_NOT_FOUND_HINT,
	userListLookupScopes,
} from '../shared/preflight';
import {
	parseReminderPayloadInput,
	pushRemindersRecoverableError,
	reminderIdLocator,
	validateReminderId,
	validateReminderInputMode,
	validateReminderPayload,
	validateReminderUserIds,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'remindAssignees');

function extractFallbackUserIdsFromRemindAssigneesPayload(
	rawPayload: unknown,
): string[] | undefined {
	let candidatePayload = rawPayload;

	if (typeof rawPayload === 'string') {
		try {
			candidatePayload = JSON.parse(rawPayload);
		} catch {
			return undefined;
		}
	}

	if (
		!candidatePayload ||
		typeof candidatePayload !== 'object' ||
		Array.isArray(candidatePayload)
	) {
		return undefined;
	}

	const payloadUserIds = (candidatePayload as IDataObject).user_ids;
	if (!Array.isArray(payloadUserIds)) {
		return undefined;
	}

	return payloadUserIds.map((value) => String(value).trim()).filter((value) => value.length > 0);
}

const properties: INodeProperties[] = [
	reminderIdLocator,
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
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Comma-separated list of assignee user IDs to remind (maximum 4)',
		placeholder: 'e.g. 7234192,2498713',
	},
	{
		displayName: 'Remind Assignees Payload (JSON)',
		name: 'remindAssigneesPayload',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload. Pass a JSON object or stringified JSON object. Required field: user_ids (array with 1 to 4 assignee user IDs).',
	},
	{
		displayName: `Remind Assignees Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#remind_assignees" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'remindAssigneesReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Remind Assignees as AI Tool Setup Guide: <a href="${REMINDERS_REMIND_ASSIGNEES_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'remindAssigneesReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['remindAssignees'],
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
			const inputMode = validateReminderInputMode(this, this.getNodeParameter('inputMode', i), i);

			const sanitizedReminderId = validateReminderId(this, reminderId, i);
			let userIds: string[];

			if (inputMode === 'structured') {
				const rawUserIds = this.getNodeParameter('userIds', i) as string | string[];
				const parsedUserIds = validateUserIdArray(this, rawUserIds, i);
				userIds = validateReminderUserIds(this, parsedUserIds, i, 'user_ids', { max: 4 });
			} else {
				const rawPayload = this.getNodeParameter('remindAssigneesPayload', i, {}) as unknown;
				let payload = parseReminderPayloadInput(this, rawPayload, i, 'Remind Assignees Payload');
				payload = validateReminderPayload(this, payload, i, 'Remind Assignees Payload', {
					allowedFields: ['user_ids'],
				});
				userIds = validateReminderUserIds(this, payload.user_ids, i, 'user_ids', { max: 4 });
			}

			await runReminderLookupPreflightGate(this, i, grantedScopes, sanitizedReminderId);
			await runUserIdentifiersPreflightGate(this, i, grantedScopes, {
				identifiers: userIds,
				subjectLabel: 'Reminder Assignee User IDs',
				acceptedScopes: userListLookupScopes,
				missing: {
					code: 'USER_IDS_NOT_FOUND',
					message: ({ missingIdentifiers }) =>
						`One or more reminder assignee user IDs were not found. Missing user IDs: ${JSON.stringify(
							missingIdentifiers,
						)}.`,
					hint: USER_LOOKUP_NOT_FOUND_HINT,
				},
			});

			const response: IDataObject = await zohoCliqApiRequest.call(
				this,
				'PUT',
				`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}/remind`,
				{ user_ids: userIds },
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const reminderId = this.getNodeParameter('reminderId', i, '', {
				extractValue: true,
			}) as string;
			const inputMode =
				typeof this.getNodeParameter('inputMode', i, 'structured') === 'string'
					? String(this.getNodeParameter('inputMode', i, 'structured')).trim()
					: undefined;
			const rawStructuredUserIds =
				inputMode === 'structured'
					? (this.getNodeParameter('userIds', i, '') as unknown)
					: undefined;
			let fallbackStructuredUserIds: string[] = [];
			if (typeof rawStructuredUserIds === 'string') {
				fallbackStructuredUserIds = rawStructuredUserIds
					.split(',')
					.map((value) => value.trim())
					.filter((value) => value.length > 0);
			} else if (Array.isArray(rawStructuredUserIds)) {
				fallbackStructuredUserIds = rawStructuredUserIds
					.map((value) => String(value).trim())
					.filter((value) => value.length > 0);
			}
			const rawPayload =
				inputMode === 'raw'
					? (this.getNodeParameter('remindAssigneesPayload', i, {}) as unknown)
					: undefined;
			const sanitizedReminderId =
				typeof reminderId === 'string' && reminderId.trim() ? reminderId.trim() : undefined;
			const fallbackPayloadUserIds = extractFallbackUserIdsFromRemindAssigneesPayload(rawPayload);

			if (
				pushRemindersRecoverableError(this, returnData, i, 'remindAssignees', error, {
					contextFields: {
						...(sanitizedReminderId ? { reminder_id: sanitizedReminderId } : {}),
						...((inputMode === 'structured' ? fallbackStructuredUserIds : fallbackPayloadUserIds)
							?.length
							? {
									user_ids:
										inputMode === 'structured'
											? fallbackStructuredUserIds
											: (fallbackPayloadUserIds as string[]),
									user_count:
										inputMode === 'structured'
											? fallbackStructuredUserIds.length
											: (fallbackPayloadUserIds as string[]).length,
								}
							: {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be one of'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use Using Fields Below or Using JSON for remind assignees.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid reminder id format'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('at least one user id'),
							reason: 'EMPTY_USER_ID_LIST',
							hint: 'Provide at least one exact assignee user ID to remind.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user_ids can contain at most 4 user id'),
							reason: 'USER_BATCH_LIMIT_EXCEEDED',
							hint: 'Remind no more than 4 assignee user IDs in one request.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('invalid user id format'),
							reason: 'INVALID_USER_ID',
							hint: 'Use exact Zoho Cliq user IDs for reminder assignees.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('unsupported field'),
							reason: 'UNSUPPORTED_PAYLOAD_FIELD',
							hint: 'Use only the user_ids field in Remind Assignees Payload.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('not authorized to do this operation') ||
								(normalizedMessage.includes('others') &&
									normalizedMessage.includes('category') &&
									normalizedMessage.includes('remind')),
							reason: 'OTHERS_CATEGORY_REQUIRED',
							hint: 'Remind assignees only for reminders in the Others category.',
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
