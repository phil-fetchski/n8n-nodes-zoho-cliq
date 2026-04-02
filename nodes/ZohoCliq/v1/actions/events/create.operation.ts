/**
 * Create Event operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { EVENTS_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	buildEventPayloadFromStructured,
	EVENTS_IANA_TIMEZONE_NOTICE,
	normalizeRawAttachmentsForCreate,
	normalizeStructuredAttachmentsForCreate,
	parseDateTimeOrUnixMs,
	parseEventPayloadInput,
	pushEventsRecoverableError,
	validateCalendarId,
	validateEventPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'create');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');
const supportedInputModes = new Set(['structured', 'raw']);

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
			'Choose whether to build the event with guided node fields or provide the full request body as JSON',
	},
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Event title. Maximum length is 255 characters.',
	},
	{
		displayName: 'Start Date Time',
		name: 'startDateTime',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Event start date and time. Prefer an ISO 8601 datetime string with an explicit UTC offset, for example `2026-03-20T15:00:00-04:00`. If the offset is omitted, the node resolves the value using Timezone.',
	},
	{
		displayName: 'End Date Time',
		name: 'endDateTime',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Event end date and time. Prefer an ISO 8601 datetime string with an explicit UTC offset, for example `2026-03-20T16:00:00-04:00`. If the offset is omitted, the node resolves the value using Timezone. It must be later than Start Date Time.',
	},
	{
		displayName: 'Timezone',
		name: 'timezone',
		type: 'string',
		default: 'America/New_York',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		placeholder: 'e.g. America/New_York',
		description: 'IANA timezone for the event, for example `America/New_York` or `Asia/Kolkata`',
	},
	{
		displayName: EVENTS_IANA_TIMEZONE_NOTICE,
		name: 'timezoneNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Calendar ID',
		name: 'calendarId',
		type: 'string',
		default: '',
		required: true,
		description: 'Required exact calendar ID where the event should be created',
	},
	{
		displayName: 'Attachment IDs',
		name: 'attachmentIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		placeholder: 'e.g. 284148000000107002,284148000000107003',
		description:
			'Optional comma-separated uploaded event attachment IDs. Blank values are allowed and omitted.',
	},
	{
		displayName:
			'Attachment Guidance: Upload files first using the ZohoCliq <b>Upload Event Attachment</b> operation. Then provide the returned <code>attachments.fileId</code> value(s) here (comma-separated for multiple files).',
		name: 'attachmentGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Attendee Emails',
		name: 'attendeeEmails',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		placeholder: 'e.g. user1@example.com,user2@example.com',
		description:
			'Optional comma-separated attendee email addresses. Blank values are allowed and omitted.',
	},
	{
		displayName: 'Description',
		name: 'description',
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
			'Optional event description. Maximum length is 10000 characters. Blank values are allowed and omitted',
	},
	{
		displayName: 'Location',
		name: 'location',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Optional event location. Maximum length is 255 characters. Blank values are allowed and omitted',
	},
	{
		displayName: 'Reminders',
		name: 'reminderItems',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
			multipleValueButtonText: 'Add Reminder',
			fixedCollection: {
				itemTitle: 'Reminder',
			},
		},
		placeholder: 'Add Reminder',
		default: {},
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		options: [
			{
				displayName: 'Reminder',
				name: 'reminder',
				values: [
					{
						displayName: 'Type',
						name: 'type',
						type: 'options',
						options: [
							{ name: 'Email', value: 'email' },
							{ name: 'Notification', value: 'notification' },
							{ name: 'Popup', value: 'popup' },
						],
						default: 'email',
						description:
							'Reminder delivery type. Allowed values: `email`, `notification`, `popup`.',
					},
					{
						displayName: 'Minutes',
						name: 'minutes',
						type: 'number',
						default: 15,
						typeOptions: {
							minValue: 1,
						},
						description:
							'Positive whole number of minutes before the event when this reminder should trigger',
					},
				],
			},
		],
		description: 'Optional event reminders',
	},
	{
		displayName: 'Type',
		name: 'eventType',
		type: 'options',
		noDataExpression: true,
		default: 'normal_event',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		options: [
			{ name: 'Audio Conference', value: 'audio_conference' },
			{ name: 'Event Management', value: 'event_management' },
			{ name: 'Normal Event', value: 'normal_event' },
			{ name: 'Video Conference', value: 'video_conference' },
		],
		description:
			'Optional event type for the new event. The default structured-mode value is `normal_event`.',
	},
	{
		displayName: 'Event Definition (JSON)',
		name: 'eventDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Full raw JSON request body for event creation. This field accepts either a literal JSON object or stringified JSON text.',
	},
	{
		displayName: 'Require Future Dates',
		name: 'requireFutureDates',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			'Whether to block past start and end times before sending the request. Disable only if you have a good reason to allow past-dated events, because some calendar backends may reject them.',
	},
	...getSimplifyParameters('event', 'event', 'create'),
	{
		displayName: `Create Event Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-event" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'createEventDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Create Event as AI Tool Setup Guide: <a href="${EVENTS_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createEventAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['create'],
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
		let sanitizedCalendarId: string | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			sanitizedCalendarId = validateCalendarId(
				this,
				this.getNodeParameter('calendarId', i) as string,
				i,
				{ required: true },
			) as string;
			const inputMode = String(this.getNodeParameter('inputMode', i, 'structured')).trim() as
				| 'structured'
				| 'raw';
			if (!supportedInputModes.has(inputMode)) {
				throw new NodeOperationError(this.getNode(), 'Input Mode must be one of: structured, raw', {
					itemIndex: i,
				});
			}
			const requireFutureDates = Boolean(this.getNodeParameter('requireFutureDates', i, true));

			let body: IDataObject;

			if (inputMode === 'structured') {
				body = buildEventPayloadFromStructured(
					this,
					{
						title: this.getNodeParameter('title', i) as string,
						startTime: parseDateTimeOrUnixMs(
							this,
							this.getNodeParameter('startDateTime', i),
							i,
							'Start Time',
							{
								timeZone: this.getNodeParameter('timezone', i) as string,
							},
						),
						endTime: parseDateTimeOrUnixMs(
							this,
							this.getNodeParameter('endDateTime', i),
							i,
							'End Time',
							{
								timeZone: this.getNodeParameter('timezone', i) as string,
							},
						),
						timezone: this.getNodeParameter('timezone', i) as string,
						calendarId: sanitizedCalendarId,
						eventType: this.getNodeParameter('eventType', i, 'normal_event') as string,
						attendeeEmails: this.getNodeParameter('attendeeEmails', i, '') as string,
						location: this.getNodeParameter('location', i, '') as string,
						description: this.getNodeParameter('description', i, '') as string,
						attachmentIds: this.getNodeParameter('attachmentIds', i, '') as string,
						reminderItems: this.getNodeParameter('reminderItems', i, {}) as IDataObject,
					},
					i,
				);
			} else {
				const eventDefinition = this.getNodeParameter('eventDefinition', i, {}) as unknown;
				body = parseEventPayloadInput(this, eventDefinition, i, 'Event Definition');
				body.calendar_id = sanitizedCalendarId;
			}

			body = validateEventPayload(this, body, i, 'Event Definition', {
				requireTitle: true,
				requireSchedule: true,
				requireFutureSchedule: requireFutureDates,
			});

			const requestBody =
				inputMode === 'structured'
					? normalizeStructuredAttachmentsForCreate(body)
					: normalizeRawAttachmentsForCreate(this, body, i);

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/events', requestBody);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('event');
			const listItems = applySimplifyModeToList(
				coerceApiResponseToObject(response),
				'data',
				mode,
				config,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushEventsRecoverableError(this, returnData, i, 'create', error, {
					contextFields: {
						...(sanitizedCalendarId ? { calendar_id: sanitizedCalendarId } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.startsWith('input mode must be one of'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use either Using Fields Below or Using JSON.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('title') ||
								normalizedMessage.includes('start time') ||
								normalizedMessage.includes('end time') ||
								normalizedMessage.includes('start_time') ||
								normalizedMessage.includes('end_time') ||
								normalizedMessage.includes('timezone'),
							reason: 'INVALID_EVENT_SCHEDULE',
							hint: 'Provide a title, a valid timezone, future start and end times, and an end time that is later than the start time.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('calendar id'),
							reason: 'INVALID_CALENDAR_ID',
							hint: 'Use the exact Zoho Cliq calendar ID where the event should be created.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('attendee'),
							reason: 'INVALID_ATTENDEES',
							hint: 'Provide attendee email addresses only, separated by commas in structured mode.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('reminder'),
							reason: 'INVALID_REMINDERS',
							hint: 'Use reminder objects with type `email`, `notification`, or `popup` and a positive whole-number minutes value.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('attachment'),
							reason: 'INVALID_ATTACHMENTS',
							hint: 'Use uploaded Zoho Cliq event attachment IDs only.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('json object') ||
								normalizedMessage.includes('unsafe key'),
							reason: 'INVALID_EVENT_PAYLOAD',
							hint: 'Provide a safe JSON object with supported event fields only.',
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
