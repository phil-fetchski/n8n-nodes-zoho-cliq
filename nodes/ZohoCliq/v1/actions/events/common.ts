import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const eventIdPattern = /^[a-zA-Z0-9@_.:-]+$/;
const nonWhitespacePattern = /^\S+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const allowedEventTypes = new Set([
	'normal_event',
	'event_management',
	'audio_conference',
	'video_conference',
]);

const allowedEventStatuses = new Set(['accepted', 'tentative', 'declined', 'yet_to_respond']);
const allowedReminderTypes = new Set(['email', 'popup', 'notification']);
const isoDateTimeWithoutOffsetPattern =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const isoDateTimeWithOffsetPattern =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/;

export const EVENTS_IANA_TIMEZONE_NOTICE =
	'Timezone Help: Use a valid IANA timezone name (for example: America/New_York). Reference: <a href="https://timeapi.io/documentation/iana-timezones" target="_blank" rel="noopener noreferrer">Open IANA timezone list</a>';

export interface IEventsRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function toPositiveInteger(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
): number {
	if (typeof value === 'number') {
		if (!isPositiveInteger(value)) {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must be a positive whole number`,
				{
					itemIndex,
				},
			);
		}
		return value;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, {
				itemIndex,
			});
		}

		const parsed = Number(trimmed);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must be a positive whole number`,
				{
					itemIndex,
				},
			);
		}
		return parsed;
	}

	throw new NodeOperationError(
		context.getNode(),
		`${fieldName} must be a positive whole number or numeric string`,
		{ itemIndex },
	);
}

function validateTimezone(context: IExecuteFunctions, timezone: string, itemIndex: number): string {
	const sanitized = timezone.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Timezone is required', { itemIndex });
	}

	if (sanitized.length > 100) {
		throw new NodeOperationError(context.getNode(), 'Timezone is too long', { itemIndex });
	}

	try {
		Intl.DateTimeFormat(undefined, { timeZone: sanitized });
	} catch {
		throw new NodeOperationError(context.getNode(), 'Timezone must be a valid IANA timezone', {
			itemIndex,
		});
	}

	return sanitized;
}

function validateTextField(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
	maxLength: number,
	options: { required?: boolean } = {},
): string | undefined {
	if (value === undefined || value === null) {
		if (options.required) {
			throw new NodeOperationError(context.getNode(), `${fieldName} is required`, { itemIndex });
		}
		return undefined;
	}

	const sanitized = String(value).trim();
	if (!sanitized) {
		if (options.required) {
			throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, {
				itemIndex,
			});
		}
		return undefined;
	}

	if (sanitized.length > maxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is too long. Maximum length is ${maxLength} characters.`,
			{ itemIndex },
		);
	}

	return sanitized;
}

function parseDelimitedValues(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
): string[] {
	if (typeof value !== 'string') {
		throw new NodeOperationError(context.getNode(), `${fieldName} must be a string`, { itemIndex });
	}

	const values = value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	const uniqueValues: string[] = [];
	const seen = new Set<string>();
	for (const entry of values) {
		if (!seen.has(entry)) {
			seen.add(entry);
			uniqueValues.push(entry);
		}
	}

	return uniqueValues;
}

function validateEmail(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
): string {
	const email = String(value ?? '')
		.trim()
		.toLowerCase();
	if (!emailPattern.test(email) || email.length > 320) {
		throw new NodeOperationError(context.getNode(), `${fieldName} must be a valid email address`, {
			itemIndex,
		});
	}
	return email;
}

function validateReminder(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	index: number,
): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `reminders[${index}] must be an object`, {
			itemIndex,
		});
	}

	const reminder = value as IDataObject;
	const type = String(reminder.type ?? '')
		.trim()
		.toLowerCase();
	if (!allowedReminderTypes.has(type)) {
		throw new NodeOperationError(
			context.getNode(),
			`reminders[${index}].type must be one of: ${Array.from(allowedReminderTypes).join(', ')}`,
			{ itemIndex },
		);
	}

	const minutes = toPositiveInteger(
		context,
		reminder.minutes,
		itemIndex,
		`reminders[${index}].minutes`,
	);

	return {
		type,
		minutes,
	};
}

function validateFutureEventSchedule(
	context: IExecuteFunctions,
	startTime: number | undefined,
	endTime: number | undefined,
	itemIndex: number,
): void {
	const now = Date.now();

	if (typeof startTime === 'number' && startTime < now) {
		throw new NodeOperationError(context.getNode(), 'start_time must be in the future', {
			itemIndex,
		});
	}

	if (typeof endTime === 'number' && endTime < now) {
		throw new NodeOperationError(context.getNode(), 'end_time must be in the future', {
			itemIndex,
		});
	}

	if (typeof startTime === 'number' && typeof endTime === 'number' && endTime <= startTime) {
		throw new NodeOperationError(context.getNode(), 'end_time must be greater than start_time', {
			itemIndex,
		});
	}
}

function parseIsoWithoutOffset(value: string): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
	millisecond: number;
} | null {
	const match = isoDateTimeWithoutOffsetPattern.exec(value);
	if (!match) {
		return null;
	}

	const [, year, month, day, hour, minute, second = '0', millisecond = '0'] = match;
	return {
		year: Number(year),
		month: Number(month),
		day: Number(day),
		hour: Number(hour),
		minute: Number(minute),
		second: Number(second),
		millisecond: Number(millisecond.padEnd(3, '0')),
	};
}

function getFormatterPartsByType(parts: Intl.DateTimeFormatPart[]): Record<string, string> {
	const result: Record<string, string> = {};

	for (const part of parts) {
		if (part.type !== 'literal') {
			result[part.type] = part.value;
		}
	}

	return result;
}

function getTimeZoneOffsetMs(timestamp: number, timeZone: string): number {
	const formatter = new Intl.DateTimeFormat('en-CA-u-hc-h23', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
	const parts = getFormatterPartsByType(formatter.formatToParts(new Date(timestamp)));
	const localEpoch = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second),
		0,
	);
	const timestampWithoutMs = timestamp - (timestamp % 1000);

	return localEpoch - timestampWithoutMs;
}

function matchesTimeZoneLocalDateTime(
	timestamp: number,
	timeZone: string,
	expected: NonNullable<ReturnType<typeof parseIsoWithoutOffset>>,
): boolean {
	const formatter = new Intl.DateTimeFormat('en-CA-u-hc-h23', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});
	const parts = getFormatterPartsByType(formatter.formatToParts(new Date(timestamp)));

	return (
		Number(parts.year) === expected.year &&
		Number(parts.month) === expected.month &&
		Number(parts.day) === expected.day &&
		Number(parts.hour) === expected.hour &&
		Number(parts.minute) === expected.minute &&
		Number(parts.second) === expected.second &&
		new Date(timestamp).getUTCMilliseconds() === expected.millisecond
	);
}

function parseDateTimeInTimeZone(
	context: IExecuteFunctions,
	parsed: NonNullable<ReturnType<typeof parseIsoWithoutOffset>>,
	timeZone: string,
	itemIndex: number,
	fieldName: string,
): number {
	const baseUtcMs = Date.UTC(
		parsed.year,
		parsed.month - 1,
		parsed.day,
		parsed.hour,
		parsed.minute,
		parsed.second,
		parsed.millisecond,
	);

	let candidate = baseUtcMs - getTimeZoneOffsetMs(baseUtcMs, timeZone);

	for (let attempt = 0; attempt < 3; attempt++) {
		const nextCandidate = baseUtcMs - getTimeZoneOffsetMs(candidate, timeZone);
		if (nextCandidate === candidate) {
			break;
		}
		candidate = nextCandidate;
	}

	if (!matchesTimeZoneLocalDateTime(candidate, timeZone, parsed)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must match the provided timezone when no UTC offset is supplied`,
			{ itemIndex },
		);
	}

	return candidate;
}

export function isEventsAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
	let rawFromParameter: unknown;
	try {
		rawFromParameter = context.getNodeParameter('enableAiErrorMode', itemIndex, false);
	} catch {
		rawFromParameter = undefined;
	}

	if (parseBooleanLikeTrue(rawFromParameter)) {
		return true;
	}

	try {
		if (typeof context.getNode !== 'function') {
			return false;
		}

		const node = context.getNode() as { parameters?: IDataObject };
		const parameters = node?.parameters;
		if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
			return false;
		}

		return parseBooleanLikeTrue(parameters.enableAiErrorMode);
	} catch {
		return false;
	}
}

export function pushEventsRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IEventsRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isEventsAiErrorModeEnabled(context, itemIndex);
	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		const executionData = context.helpers.constructExecutionMetaData(
			[{ json: { ...(scopePayload as IDataObject) } }],
			{ itemData: { item: itemIndex } },
		);
		returnData.push(...executionData);
		return true;
	}

	const errorPayload = buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'events',
			operation,
		},
		{
			contextFields: options.contextFields,
			fallbackMessage: options.fallbackMessage,
			messageMappings: options.messageMappings,
		},
	);

	const executionData = context.helpers.constructExecutionMetaData([{ json: errorPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export function resolveEventsEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = Boolean(
		context.getNodeParameter('includeEnhancedOutput', itemIndex, true),
	);
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}

export function parseDateTimeOrUnixMs(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
	options: { timeZone?: string } = {},
): number {
	if (typeof value === 'number') {
		if (!Number.isInteger(value) || value <= 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must be a positive whole number`,
				{
					itemIndex,
				},
			);
		}
		return value;
	}

	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a datetime string or Unix timestamp in milliseconds`,
			{ itemIndex },
		);
	}

	const trimmed = value.trim();
	if (!trimmed) {
		throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, {
			itemIndex,
		});
	}

	if (/^\d+$/.test(trimmed)) {
		const parsedInt = Number(trimmed);
		if (!Number.isInteger(parsedInt) || parsedInt <= 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must be a positive Unix timestamp in milliseconds`,
				{ itemIndex },
			);
		}
		return parsedInt;
	}

	if (!isoDateTimeWithOffsetPattern.test(trimmed)) {
		const parsedWithoutOffset = parseIsoWithoutOffset(trimmed);
		if (parsedWithoutOffset) {
			if (options.timeZone) {
				const sanitizedTimeZone = validateTimezone(context, options.timeZone, itemIndex);

				return parseDateTimeInTimeZone(
					context,
					parsedWithoutOffset,
					sanitizedTimeZone,
					itemIndex,
					fieldName,
				);
			}

			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must include a UTC offset when no timezone is provided`,
				{ itemIndex },
			);
		}
	}

	const parsedDate = Date.parse(trimmed);
	if (!Number.isFinite(parsedDate) || parsedDate <= 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a valid datetime or Unix timestamp in milliseconds`,
			{ itemIndex },
		);
	}

	return parsedDate;
}

export function validateEventId(
	context: IExecuteFunctions,
	eventId: string,
	itemIndex: number,
): string {
	const sanitized = String(eventId ?? '').trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Event ID is required', { itemIndex });
	}

	if (sanitized.length > 255) {
		throw new NodeOperationError(context.getNode(), 'Event ID is too long', { itemIndex });
	}

	if (!eventIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Event ID format', { itemIndex });
	}

	return sanitized;
}

export function validateCalendarId(
	context: IExecuteFunctions,
	calendarId: string,
	itemIndex: number,
	options: { required?: boolean } = {},
): string | undefined {
	const sanitized = String(calendarId ?? '').trim();
	if (!sanitized) {
		if (options.required) {
			throw new NodeOperationError(context.getNode(), 'Calendar ID is required', { itemIndex });
		}
		return undefined;
	}

	if (sanitized.length > 255) {
		throw new NodeOperationError(context.getNode(), 'Calendar ID is too long', { itemIndex });
	}

	if (!nonWhitespacePattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Calendar ID cannot contain whitespace', {
			itemIndex,
		});
	}

	return sanitized;
}

export function ensureSafeObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (value === null || value === undefined) {
		return;
	}

	if (typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	const inspectArrayValues = (arrayEntries: unknown[], parentPath: string): void => {
		for (let idx = 0; idx < arrayEntries.length; idx++) {
			const arrayValue = arrayEntries[idx];
			if (!arrayValue || typeof arrayValue !== 'object') {
				continue;
			}
			if (Array.isArray(arrayValue)) {
				inspectArrayValues(arrayValue, `${parentPath}[${idx}]`);
				continue;
			}
			ensureSafeObject(context, arrayValue, itemIndex, `${parentPath}[${idx}]`);
		}
	};

	for (const key of Object.keys(value as IDataObject)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{ itemIndex },
			);
		}

		const child = (value as IDataObject)[key];
		if (!child || typeof child !== 'object') {
			continue;
		}

		if (Array.isArray(child)) {
			inspectArrayValues(child, `${path}.${key}`);
			continue;
		}

		ensureSafeObject(context, child, itemIndex, `${path}.${key}`);
	}
}

export function normalizeStructuredAttachmentsForUpdate(body: IDataObject): IDataObject {
	const requestBody: IDataObject = { ...body };
	if (Array.isArray(requestBody.attachment_ids)) {
		requestBody.attachments = (requestBody.attachment_ids as unknown[]).map((id) => ({
			id: String(id).trim(),
		}));
	}

	delete requestBody.attachment_ids;
	delete requestBody.attachmentIds;
	delete requestBody.attach;

	return requestBody;
}

export function normalizeStructuredAttachmentsForCreate(body: IDataObject): IDataObject {
	const requestBody: IDataObject = { ...body };
	delete requestBody.attachmentIds;
	delete requestBody.attach;
	return requestBody;
}

export function normalizeRawAttachmentsForUpdate(
	context: IExecuteFunctions,
	body: IDataObject,
	itemIndex: number,
): IDataObject {
	const requestBody: IDataObject = { ...body };

	if (
		requestBody.attachment_ids !== undefined ||
		requestBody.attachmentIds !== undefined ||
		requestBody.attach !== undefined
	) {
		throw new NodeOperationError(
			context.getNode(),
			'Use only "attachments" as an array of objects with "id" for event attachments.',
			{ itemIndex },
		);
	}

	if (requestBody.attachments !== undefined) {
		if (!Array.isArray(requestBody.attachments)) {
			throw new NodeOperationError(
				context.getNode(),
				'"attachments" must be an array of objects with an "id" string.',
				{ itemIndex },
			);
		}

		requestBody.attachments = (requestBody.attachments as unknown[]).map((entry, idx) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				throw new NodeOperationError(
					context.getNode(),
					`attachments[${idx}] must be an object with an "id" string.`,
					{ itemIndex },
				);
			}

			const id = String((entry as IDataObject).id ?? '').trim();
			if (!id) {
				throw new NodeOperationError(
					context.getNode(),
					`attachments[${idx}].id must be a non-empty string.`,
					{ itemIndex },
				);
			}
			if (id.length > 255) {
				throw new NodeOperationError(
					context.getNode(),
					`attachments[${idx}].id must be at most 255 characters`,
					{ itemIndex },
				);
			}

			return { id };
		});
	}

	return requestBody;
}

export function normalizeRawAttachmentsForCreate(
	context: IExecuteFunctions,
	body: IDataObject,
	itemIndex: number,
): IDataObject {
	const requestBody: IDataObject = { ...body };

	if (requestBody.attachmentIds !== undefined || requestBody.attach !== undefined) {
		throw new NodeOperationError(
			context.getNode(),
			'Use only "attachment_ids" as an array of strings for event attachments.',
			{ itemIndex },
		);
	}

	if (requestBody.attachments !== undefined) {
		throw new NodeOperationError(
			context.getNode(),
			'Use only "attachment_ids" as an array of strings for event attachments.',
			{ itemIndex },
		);
	}

	return requestBody;
}

export function parseEventPayloadInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (value === null || value === undefined) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, { itemIndex });
	}

	if (typeof value === 'string') {
		const rawValue = value.trim();
		if (!rawValue) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, { itemIndex });
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawValue);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a valid JSON object when provided as text`,
				{ itemIndex },
			);
		}

		ensureSafeObject(context, parsed, itemIndex, path);
		return parsed as IDataObject;
	}

	ensureSafeObject(context, value, itemIndex, path);
	return value as IDataObject;
}

export function validateEventStatus(
	context: IExecuteFunctions,
	status: string,
	itemIndex: number,
): string {
	const sanitized = String(status ?? '')
		.trim()
		.toLowerCase();
	if (!allowedEventStatuses.has(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`Status must be one of: ${Array.from(allowedEventStatuses).join(', ')}`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateEventPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
	options: {
		requireTitle?: boolean;
		requireCalendarId?: boolean;
		requireType?: boolean;
		requireSchedule?: boolean;
		requireFutureSchedule?: boolean;
		allowEmpty?: boolean;
	} = {},
): IDataObject {
	if (payload == null) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, { itemIndex });
	}

	ensureSafeObject(context, payload, itemIndex, path);

	if (!options.allowEmpty && Object.keys(payload).length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, { itemIndex });
	}

	const title = validateTextField(context, payload.title, itemIndex, 'Title', 255, {
		required: options.requireTitle,
	});
	if (title !== undefined) {
		payload.title = title;
	}

	const location = validateTextField(context, payload.location, itemIndex, 'Location', 255);
	if (location !== undefined) {
		payload.location = location;
	} else {
		delete payload.location;
	}

	const description = validateTextField(
		context,
		payload.description,
		itemIndex,
		'Description',
		10000,
	);
	if (description !== undefined) {
		payload.description = description;
	} else {
		delete payload.description;
	}

	if (payload.timezone !== undefined || options.requireSchedule) {
		payload.timezone = validateTimezone(context, String(payload.timezone ?? ''), itemIndex);
	}

	const payloadTimeZone = typeof payload.timezone === 'string' ? payload.timezone : undefined;

	if (payload.start_time !== undefined || options.requireSchedule) {
		payload.start_time = parseDateTimeOrUnixMs(
			context,
			payload.start_time,
			itemIndex,
			'start_time',
			{
				timeZone: payloadTimeZone,
			},
		);
	}

	if (payload.end_time !== undefined || options.requireSchedule) {
		payload.end_time = parseDateTimeOrUnixMs(context, payload.end_time, itemIndex, 'end_time', {
			timeZone: payloadTimeZone,
		});
	}

	if (options.requireFutureSchedule) {
		validateFutureEventSchedule(
			context,
			typeof payload.start_time === 'number' ? payload.start_time : undefined,
			typeof payload.end_time === 'number' ? payload.end_time : undefined,
			itemIndex,
		);
	} else if (typeof payload.start_time === 'number' && typeof payload.end_time === 'number') {
		if (payload.end_time <= payload.start_time) {
			throw new NodeOperationError(context.getNode(), 'end_time must be greater than start_time', {
				itemIndex,
			});
		}
	}

	const calendarId = validateCalendarId(context, String(payload.calendar_id ?? ''), itemIndex, {
		required: options.requireCalendarId,
	});
	if (calendarId !== undefined) {
		payload.calendar_id = calendarId;
	}

	if (payload.type !== undefined || options.requireType) {
		const type = String(payload.type ?? '').trim();
		if (!allowedEventTypes.has(type)) {
			throw new NodeOperationError(
				context.getNode(),
				`type must be one of: ${Array.from(allowedEventTypes).join(', ')}`,
				{ itemIndex },
			);
		}
		payload.type = type;
	}

	if (payload.attendees !== undefined) {
		if (!Array.isArray(payload.attendees)) {
			throw new NodeOperationError(context.getNode(), 'attendees must be an array', { itemIndex });
		}

		payload.attendees = payload.attendees.map((attendee, idx) => {
			if (typeof attendee === 'string') {
				return validateEmail(context, attendee, itemIndex, `attendees[${idx}]`);
			}

			if (!attendee || typeof attendee !== 'object' || Array.isArray(attendee)) {
				throw new NodeOperationError(
					context.getNode(),
					`attendees[${idx}] must be an email string or attendee object`,
					{ itemIndex },
				);
			}

			const attendeeObject = attendee as IDataObject;
			const email = validateEmail(
				context,
				attendeeObject.email,
				itemIndex,
				`attendees[${idx}].email`,
			);
			const normalizedAttendee: IDataObject = { email };

			if (attendeeObject.status !== undefined) {
				normalizedAttendee.status = validateEventStatus(
					context,
					String(attendeeObject.status),
					itemIndex,
				);
			}

			return normalizedAttendee;
		});
	}

	if (payload.reminders !== undefined) {
		if (!Array.isArray(payload.reminders)) {
			throw new NodeOperationError(context.getNode(), 'reminders must be an array', { itemIndex });
		}

		payload.reminders = payload.reminders.map((reminder, idx) =>
			validateReminder(context, reminder, itemIndex, idx),
		);
	}

	if (payload.attachment_ids !== undefined) {
		if (!Array.isArray(payload.attachment_ids)) {
			throw new NodeOperationError(
				context.getNode(),
				'attachment_ids must be an array of strings',
				{
					itemIndex,
				},
			);
		}

		payload.attachment_ids = payload.attachment_ids.map((id, idx) => {
			const attachmentId = String(id ?? '').trim();
			if (!attachmentId) {
				throw new NodeOperationError(
					context.getNode(),
					`attachment_ids[${idx}] must be a non-empty string`,
					{ itemIndex },
				);
			}
			if (attachmentId.length > 255) {
				throw new NodeOperationError(context.getNode(), `attachment_ids[${idx}] is too long`, {
					itemIndex,
				});
			}
			return attachmentId;
		});
	}

	return payload;
}

export function buildEventPayloadFromStructured(
	context: IExecuteFunctions,
	input: {
		title?: string;
		startTime?: number | string;
		endTime?: number | string;
		timezone?: string;
		calendarId?: string;
		location?: string;
		description?: string;
		eventType?: string;
		attendeeEmails?: string;
		attendeeUpdates?: IDataObject;
		reminderItems?: IDataObject;
		attachmentIds?: string;
	},
	itemIndex: number,
): IDataObject {
	const body: IDataObject = {};

	if (input.title !== undefined) {
		body.title = input.title;
	}
	if (input.startTime !== undefined) {
		body.start_time = input.startTime;
	}
	if (input.endTime !== undefined) {
		body.end_time = input.endTime;
	}
	if (input.timezone !== undefined) {
		body.timezone = input.timezone;
	}
	if (input.calendarId !== undefined && input.calendarId.trim()) {
		body.calendar_id = input.calendarId.trim();
	}
	if (input.location !== undefined && input.location.trim()) {
		body.location = input.location;
	}
	if (input.description !== undefined && input.description.trim()) {
		body.description = input.description;
	}
	if (input.eventType !== undefined && input.eventType.trim()) {
		body.type = input.eventType.trim();
	}

	if (input.attendeeEmails !== undefined && typeof input.attendeeEmails !== 'string') {
		throw new NodeOperationError(context.getNode(), 'Attendee Emails must be a string', {
			itemIndex,
		});
	}

	if (input.attendeeEmails && input.attendeeEmails.trim()) {
		const attendees = parseDelimitedValues(
			context,
			input.attendeeEmails,
			itemIndex,
			'Attendee Emails',
		).map((email, idx) => validateEmail(context, email, itemIndex, `Attendee Emails[${idx}]`));
		if (attendees.length > 0) {
			body.attendees = attendees;
		}
	}

	if (input.attendeeUpdates) {
		const attendeeCollection = input.attendeeUpdates.attendee;
		if (Array.isArray(attendeeCollection) && attendeeCollection.length > 0) {
			body.attendees = attendeeCollection.map((attendee, idx) => {
				const attendeeObject = attendee as IDataObject;
				const normalized: IDataObject = {
					email: validateEmail(context, attendeeObject.email, itemIndex, `Attendees[${idx}].email`),
				};
				if (attendeeObject.status) {
					normalized.status = validateEventStatus(
						context,
						String(attendeeObject.status),
						itemIndex,
					);
				}
				return normalized;
			});
		}
	}

	if (input.reminderItems) {
		const reminders = input.reminderItems.reminder;
		if (Array.isArray(reminders) && reminders.length > 0) {
			body.reminders = reminders.map((reminder, idx) =>
				validateReminder(context, reminder, itemIndex, idx),
			);
		}
	}

	if (input.attachmentIds && input.attachmentIds.trim()) {
		const ids = parseDelimitedValues(context, input.attachmentIds, itemIndex, 'Attachment IDs');
		if (ids.length > 0) {
			body.attachment_ids = ids;
		}
	}

	return body;
}

export function validateRecurrenceId(
	context: IExecuteFunctions,
	recurrenceId: string,
	itemIndex: number,
): string {
	const sanitized = String(recurrenceId ?? '').trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Recurrence ID cannot be empty', {
			itemIndex,
		});
	}

	if (sanitized.length > 255) {
		throw new NodeOperationError(context.getNode(), 'Recurrence ID is too long', { itemIndex });
	}

	if (!nonWhitespacePattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Recurrence ID cannot contain whitespace', {
			itemIndex,
		});
	}

	return sanitized;
}

export function validateEditTag(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
): number {
	return toPositiveInteger(context, value, itemIndex, 'Edit Tag');
}
