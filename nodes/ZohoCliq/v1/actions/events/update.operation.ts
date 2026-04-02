/**
 * Update Event operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { EVENTS_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	extractEventDetailsFromLookupResponse,
	runEventLookupPreflightGate,
} from '../shared/preflight';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	buildEventPayloadFromStructured,
	EVENTS_IANA_TIMEZONE_NOTICE,
	normalizeRawAttachmentsForUpdate,
	normalizeStructuredAttachmentsForUpdate,
	parseDateTimeOrUnixMs,
	parseEventPayloadInput,
	pushEventsRecoverableError,
	validateCalendarId,
	validateEventId,
	validateEventPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'update');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');
const supportedInputModes = new Set(['structured', 'raw']);

const properties: INodeProperties[] = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		default: '',
		required: true,
		description: 'The exact Zoho Cliq event ID to update',
	},
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
			'Choose whether to update the event with guided node fields or provide the full request body as JSON',
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
		description: 'Updated event title. Maximum length is 255 characters.',
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
			'Updated event start date and time. Prefer an ISO 8601 datetime string with an explicit UTC offset, for example `2026-03-20T15:00:00-04:00`. If the offset is omitted, the node resolves the value using Timezone.',
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
			'Updated event end date and time. Prefer an ISO 8601 datetime string with an explicit UTC offset, for example `2026-03-20T16:00:00-04:00`. If the offset is omitted, the node resolves the value using Timezone. It must be later than Start Date Time.',
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
		description: 'Updated IANA timezone for the event, for example `America/New_York`',
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
		description: 'Required exact calendar ID that owns this event',
	},
	{
		displayName: 'Type',
		name: 'eventType',
		type: 'options',
		noDataExpression: true,
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		options: [
			{ name: 'Audio Conference', value: 'audio_conference' },
			{ name: 'Event Management', value: 'event_management' },
			{ name: 'Leave Unchanged', value: '' },
			{ name: 'Normal Event', value: 'normal_event' },
			{ name: 'Video Conference', value: 'video_conference' },
		],
		description: 'Leave blank to preserve the current event type',
	},
	{
		displayName: 'Attendees',
		name: 'attendeeUpdates',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {},
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		options: [
			{
				displayName: 'Attendee',
				name: 'attendee',
				values: [
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. name@email.com',
						description: 'Attendee email address',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						default: '',
						options: [
							{ name: 'Accepted', value: 'accepted' },
							{ name: 'Declined', value: 'declined' },
							{ name: 'Leave Unchanged', value: '' },
							{ name: 'Tentative', value: 'tentative' },
							{ name: 'Yet To Respond', value: 'yet_to_respond' },
						],
						description:
							'Optional attendee RSVP status. Leave blank to keep the current attendee status. Allowed values: `accepted`, `declined`, `tentative`, `yet_to_respond`.',
					},
				],
			},
		],
		description:
			'Optional attendee list with RSVP updates. Supplying this field replaces the attendee payload sent to Zoho Cliq.',
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
			'Optional updated event description. Maximum length is 10000 characters. Blank values are allowed and omitted',
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
		description: 'Optional updated event reminders',
	},
	{
		displayName:
			'Reminder Behavior: Updating reminders replaces all existing reminders configured for this event.',
		name: 'reminderReplacementNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName:
			'Calendar Compatibility Note: For some integrated calendars (for example Google Calendar), reminder updates may be accepted but not persist on the event when fetched later.',
		name: 'reminderCalendarCompatibilityNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Event Updates (JSON)',
		name: 'eventUpdates',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Full raw JSON request body for the event update. This field accepts either a literal JSON object or stringified JSON text.',
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
	...getSimplifyParameters('event', 'event', 'update'),
	{
		displayName: `Edit Event Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#edit-event" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'updateEventDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Update Event as AI Tool Setup Guide: <a href="${EVENTS_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateEventAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['update'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function extractCurrentEventType(
	context: IExecuteFunctions,
	response: IDataObject,
	itemIndex: number,
): string {
	const details = extractPrefetchedEventDetails(context, response, itemIndex);
	const candidate = details.type;

	if (typeof candidate !== 'string' || !candidate.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Unable to determine the current event type from Get Event Details',
			{ itemIndex },
		);
	}

	const validatedType = validateEventPayload(
		context,
		{ type: candidate.trim() },
		itemIndex,
		'Current Event Type',
		{ requireType: true },
	);

	return validatedType.type as string;
}

function extractPrefetchedEventDetails(
	context: IExecuteFunctions,
	response: IDataObject,
	itemIndex: number,
): IDataObject {
	const details = extractEventDetailsFromLookupResponse(response);

	if (!details) {
		throw new NodeOperationError(
			context.getNode(),
			'Unable to determine the current event details from Get Event Details',
			{ itemIndex },
		);
	}

	return details;
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let sanitizedEventId: string | undefined;
		let sanitizedCalendarId: string | undefined;
		let requestBody: IDataObject | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			sanitizedEventId = validateEventId(this, this.getNodeParameter('eventId', i) as string, i);
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

			const endpoint = `/api/v2/events/${encodeURIComponent(sanitizedEventId)}`;

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
						eventType: this.getNodeParameter('eventType', i, '') as string,
						attendeeUpdates: this.getNodeParameter('attendeeUpdates', i, {}) as IDataObject,
						location: this.getNodeParameter('location', i, '') as string,
						description: this.getNodeParameter('description', i, '') as string,
						attachmentIds: this.getNodeParameter('attachmentIds', i, '') as string,
						reminderItems: this.getNodeParameter('reminderItems', i, {}) as IDataObject,
					},
					i,
				);
			} else {
				body = parseEventPayloadInput(
					this,
					this.getNodeParameter('eventUpdates', i, {}) as unknown,
					i,
					'Event Updates',
				);
				body.calendar_id = sanitizedCalendarId;
			}

			body = validateEventPayload(this, body, i, 'Event Updates', {
				requireTitle: true,
				requireSchedule: true,
				requireFutureSchedule: requireFutureDates,
			});

			requestBody =
				inputMode === 'structured'
					? normalizeStructuredAttachmentsForUpdate(body)
					: normalizeRawAttachmentsForUpdate(this, body, i);
			requestBody.calendar_id = sanitizedCalendarId;

			const preflightResult = await runEventLookupPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedEventId,
				sanitizedCalendarId,
			);

			if (requestBody.type === undefined) {
				const currentEventResponse =
					preflightResult.status === 'validated' && preflightResult.entity
						? preflightResult.entity
						: await zohoCliqApiRequest.call(this, 'GET', endpoint, undefined, {
								calendar_id: sanitizedCalendarId,
							});
				requestBody.type = extractCurrentEventType(this, currentEventResponse, i);
			}

			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, requestBody);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('event');
			const listItems = applySimplifyModeToList(
				coerceApiResponseToObject(response),
				'data',
				mode,
				config,
				selectedFields,
			);

			const metadata = {
				updated: true,
				success: true,
				operation: 'update_event',
				event_id: sanitizedEventId,
				calendar_id: sanitizedCalendarId,
			};

			const outputItems =
				listItems.length > 0
					? listItems.map((item) => ({ json: { ...item, ...metadata } }))
					: [{ json: { ...metadata } }];

			const executionData = this.helpers.constructExecutionMetaData(outputItems, {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushEventsRecoverableError(this, returnData, i, 'update', error, {
					contextFields: {
						...(sanitizedEventId ? { event_id: sanitizedEventId } : {}),
						...(sanitizedCalendarId ? { calendar_id: sanitizedCalendarId } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.startsWith('invalid event id') ||
								normalizedMessage.startsWith('event id is required') ||
								normalizedMessage.startsWith('event id is too long'),
							reason: 'INVALID_EVENT_ID',
							hint: 'Use the exact event ID returned by Zoho Cliq.',
						},
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
							match: (normalizedMessage) =>
								normalizedMessage.startsWith('calendar id is required') ||
								normalizedMessage.startsWith('calendar id is too long') ||
								normalizedMessage.startsWith('calendar id cannot contain whitespace'),
							reason: 'INVALID_CALENDAR_ID',
							hint: 'Use the exact Zoho Cliq calendar ID that owns this event.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('type must be one of'),
							reason: 'INVALID_EVENT_TYPE',
							hint: 'Use `normal_event`, `event_management`, `audio_conference`, or `video_conference`.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('unable to determine the current event type'),
							reason: 'MISSING_EVENT_TYPE',
							hint: 'Resend the current event type explicitly, or verify that Get Event Details returns a type for this event.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('unable to determine the current event details'),
							reason: 'MISSING_EVENT_DETAILS',
							hint: 'Verify that Get Event Details returns the current event for the supplied calendar_id.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('attendee'),
							reason: 'INVALID_ATTENDEES',
							hint: 'Provide attendee email addresses and optional RSVP statuses only.',
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
