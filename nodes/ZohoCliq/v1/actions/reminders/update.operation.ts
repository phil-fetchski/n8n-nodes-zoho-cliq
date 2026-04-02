/**
 * Update Reminder operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { REMINDERS_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runReminderLookupPreflightGate } from '../shared/preflight';
import {
	omitBlankReminderTime,
	parseReminderDateTimeOrUnixMs,
	parseReminderPayloadInput,
	pushRemindersRecoverableError,
	reminderIdLocator,
	stringifyReminderTimeForApi,
	validateReminderContent,
	validateReminderInputMode,
	validateReminderId,
	validateReminderPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'update');

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
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Updated reminder content. Leave blank to omit it from the update request. Use content, time, or both. Maximum length: 512 characters.',
	},
	{
		displayName: 'Time',
		name: 'time',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Updated reminder trigger time. Leave blank to omit it from the update request. Use an ISO 8601 datetime text, for example, `2023-10-01T12:00:00Z` OR Unix timestamp in milliseconds, for example, `1696166400000`, for the time value if using expression input.',
	},
	{
		displayName: 'Reminder Updates (JSON)',
		name: 'reminderUpdates',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload to update a reminder. Pass a JSON object or stringified JSON object. Include at least one of the following keys: `content`, `time` OR both. The `time` key will accept either an ISO 8601 datetime text, for example, `2023-10-01T12:00:00Z` OR Unix timestamp in milliseconds, for example, `1696166400000`, for the time value.',
	},
	{
		displayName: `Update Reminder Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update_reminder" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Update Reminder as an AI Tool Setup Guide: <a href="${REMINDERS_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['update'],
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
			const inputMode = validateReminderInputMode(this, this.getNodeParameter('inputMode', i), i);

			let body: IDataObject;
			if (inputMode === 'structured') {
				body = {};
				const rawContent = this.getNodeParameter('content', i, '') as unknown;
				if (String(rawContent ?? '').trim().length > 0) {
					body.content = validateReminderContent(this, rawContent, i);
				}

				const rawTime = this.getNodeParameter('time', i, '') as unknown;
				if (rawTime != null && !(typeof rawTime === 'string' && rawTime.trim() === '')) {
					body.time = parseReminderDateTimeOrUnixMs(this, rawTime, i, 'Time');
				}
			} else {
				const reminderUpdates = this.getNodeParameter('reminderUpdates', i, {}) as unknown;
				body = parseReminderPayloadInput(this, reminderUpdates, i, 'Reminder Updates');
			}

			omitBlankReminderTime(body);
			body = validateReminderPayload(this, body, i, 'Reminder Updates', {
				allowEmpty: true,
				allowedFields: ['content', 'time'],
			});
			if (body.content === undefined && body.time === undefined) {
				throw new NodeOperationError(this.getNode(), 'Provide content, time, or both.', {
					itemIndex: i,
				});
			}
			stringifyReminderTimeForApi(body);
			await runReminderLookupPreflightGate(this, i, grantedScopes, sanitizedReminderId);

			const response = await zohoCliqApiRequest.call(
				this,
				'PUT',
				`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}`,
				body,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: { ...(response as IDataObject), updated: true } }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'update', error, {
					contextFields: {
						...(sanitizedReminderId ? { reminder_id: sanitizedReminderId } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use either "Using Fields Below" or "Using JSON" as the input mode.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid reminder id format'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('provide content, time, or both'),
							reason: 'EMPTY_UPDATE',
							hint: 'Provide content, time, or both.',
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
