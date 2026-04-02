import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildEventPayloadFromStructured,
	ensureSafeObject,
	isEventsAiErrorModeEnabled,
	normalizeRawAttachmentsForCreate,
	normalizeRawAttachmentsForUpdate,
	normalizeStructuredAttachmentsForCreate,
	normalizeStructuredAttachmentsForUpdate,
	parseDateTimeOrUnixMs,
	parseEventPayloadInput,
	pushEventsRecoverableError,
	resolveEventsEnhancedOutput,
	validateCalendarId,
	validateEditTag,
	validateEventId,
	validateEventPayload,
	validateRecurrenceId,
	validateEventStatus,
} from '../../../../../../nodes/ZohoCliq/v1/actions/events/common';

describe('ZohoCliq - Events - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const oneHourMs = 60 * 60 * 1000;
	const oneDayMs = 24 * 60 * 60 * 1000;
	const testNowMs = Date.now();
	const futureStartTimeMs = testNowMs + 7 * oneDayMs;
	const futureEndTimeMs = futureStartTimeMs + oneHourMs;
	const futureStartTimeString = String(futureStartTimeMs);
	const futureEndTimeString = String(futureEndTimeMs);
	const futureDateTimeStartMs = testNowMs + 14 * oneDayMs;
	const futureDateTimeStartIso = new Date(futureDateTimeStartMs).toISOString();
	const newYorkNoOffsetStartIso = '2026-03-20T15:00:00';
	const newYorkNoOffsetEndIso = '2026-03-20T16:00:00';
	const newYorkOffsetStartMs = Date.parse('2026-03-20T15:00:00-04:00');
	const newYorkOffsetEndMs = Date.parse('2026-03-20T16:00:00-04:00');
	const frozenTestNow = new Date(testNowMs);

	beforeAll(() => {
		jest.useFakeTimers();
		jest.setSystemTime(frozenTestNow);
	});

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it('validateEventId should trim and validate ID', () => {
		expect(validateEventId(mockExecuteFunctions, ' evt_123@zoho.com ', 0)).toBe('evt_123@zoho.com');
		expect(() => validateEventId(mockExecuteFunctions, '', 0)).toThrow('Event ID is required');
		expect(() => validateEventId(mockExecuteFunctions, 'a'.repeat(256), 0)).toThrow(
			'Event ID is too long',
		);
		expect(() => validateEventId(mockExecuteFunctions, 'bad/id', 0)).toThrow(
			'Invalid Event ID format',
		);
	});

	it('validateCalendarId should enforce required ID', () => {
		expect(validateCalendarId(mockExecuteFunctions, ' cal_123 ', 0, { required: true })).toBe(
			'cal_123',
		);
		expect(validateCalendarId(mockExecuteFunctions, '', 0)).toBeUndefined();
		expect(() => validateCalendarId(mockExecuteFunctions, 'a'.repeat(256), 0)).toThrow(
			'Calendar ID is too long',
		);
		expect(() => validateCalendarId(mockExecuteFunctions, 'cal 123', 0)).toThrow(
			'Calendar ID cannot contain whitespace',
		);
		expect(() => validateCalendarId(mockExecuteFunctions, '   ', 0, { required: true })).toThrow(
			'Calendar ID is required',
		);
	});

	it('validateEventStatus should normalize status', () => {
		expect(validateEventStatus(mockExecuteFunctions, 'ACCEPTED', 0)).toBe('accepted');
		expect(() => validateEventStatus(mockExecuteFunctions, 'unknown', 0)).toThrow(
			'Status must be one of',
		);
	});

	it('validateEditTag should require positive whole number', () => {
		expect(validateEditTag(mockExecuteFunctions, '1738933200000', 0)).toBe(1738933200000);
		expect(validateEditTag(mockExecuteFunctions, '7', 0)).toBe(7);
		expect(() => validateEditTag(mockExecuteFunctions, '', 0)).toThrow('Edit Tag cannot be empty');
		expect(() => validateEditTag(mockExecuteFunctions, '0', 0)).toThrow(
			'Edit Tag must be a positive whole number',
		);
		expect(() => validateEditTag(mockExecuteFunctions, 'abc', 0)).toThrow(
			'Edit Tag must be a positive whole number',
		);
		expect(() => validateEditTag(mockExecuteFunctions, {} as unknown as string, 0)).toThrow(
			'Edit Tag must be a positive whole number or numeric string',
		);
	});

	it('validateRecurrenceId should enforce recurrence constraints', () => {
		expect(validateRecurrenceId(mockExecuteFunctions, '20250210T050000Z', 0)).toBe(
			'20250210T050000Z',
		);
		expect(() => validateRecurrenceId(mockExecuteFunctions, '   ', 0)).toThrow(
			'Recurrence ID cannot be empty',
		);
		expect(() => validateRecurrenceId(mockExecuteFunctions, 'a'.repeat(256), 0)).toThrow(
			'Recurrence ID is too long',
		);
		expect(() => validateRecurrenceId(mockExecuteFunctions, 'bad recurrence', 0)).toThrow(
			'Recurrence ID cannot contain whitespace',
		);
	});

	it('ensureSafeObject should block unsafe keys', () => {
		const unsafe = JSON.parse('{"__proto__":"bad"}') as IDataObject;
		expect(() => ensureSafeObject(mockExecuteFunctions, unsafe, 0, 'payload')).toThrow(
			'Unsafe key "__proto__" is not allowed',
		);
	});

	it('ensureSafeObject should handle arrays and nested objects', () => {
		expect(() => ensureSafeObject(mockExecuteFunctions, null, 0, 'payload')).not.toThrow();
		expect(() =>
			ensureSafeObject(mockExecuteFunctions, [] as unknown as IDataObject, 0, 'payload'),
		).toThrow('payload must be a JSON object');

		const payload = {
			attendees: [{ email: 'user@example.com' }, ['skip-array-recursion']],
			nested: { safe: true },
		} as unknown as IDataObject;
		expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).not.toThrow();
	});

	it('ensureSafeObject should block unsafe keys inside nested arrays', () => {
		const payload = {
			attendees: [[{ constructor: 'bad' }]],
		} as unknown as IDataObject;
		expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
			'Unsafe key "constructor" is not allowed in payload.attendees[0][0]',
		);
	});

	it('parseEventPayloadInput should parse raw string JSON', () => {
		const parsed = parseEventPayloadInput(
			mockExecuteFunctions,
			`{"title":"Town Hall","start_time":${futureStartTimeMs},"end_time":${futureEndTimeMs},"timezone":"Asia/Kolkata"}`,
			0,
			'Event Definition',
		);
		expect(parsed.title).toBe('Town Hall');
	});

	it('parseEventPayloadInput should validate empty and invalid JSON inputs', () => {
		expect(() => parseEventPayloadInput(mockExecuteFunctions, null, 0, 'Event Definition')).toThrow(
			'Event Definition cannot be empty',
		);
		expect(() =>
			parseEventPayloadInput(mockExecuteFunctions, '   ', 0, 'Event Definition'),
		).toThrow('Event Definition cannot be empty');
		expect(() =>
			parseEventPayloadInput(mockExecuteFunctions, '{bad}', 0, 'Event Definition'),
		).toThrow('Event Definition must be a valid JSON object when provided as text');
		expect(() =>
			parseEventPayloadInput(
				mockExecuteFunctions,
				{ title: 'Valid Object' },
				0,
				'Event Definition',
			),
		).not.toThrow();
	});

	it('buildEventPayloadFromStructured should map structured fields', () => {
		const result = buildEventPayloadFromStructured(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				startTime: futureStartTimeString,
				endTime: futureEndTimeString,
				timezone: 'Asia/Kolkata',
				attendeeEmails: 'user1@example.com,user2@example.com',
				attachmentIds: 'a1,a2',
			},
			0,
		);
		expect(result).toMatchObject({
			title: 'Town Hall',
			start_time: futureStartTimeString,
			end_time: futureEndTimeString,
			timezone: 'Asia/Kolkata',
			attendees: ['user1@example.com', 'user2@example.com'],
			attachment_ids: ['a1', 'a2'],
		});
	});

	it('buildEventPayloadFromStructured should support attendee updates and reminders', () => {
		const result = buildEventPayloadFromStructured(
			mockExecuteFunctions,
			{
				attendeeUpdates: {
					attendee: [
						{ email: 'accepted.user@example.com', status: 'accepted' },
						{ email: 'pending.user@example.com' },
					],
				},
				reminderItems: {
					reminder: [{ type: 'email', minutes: 30 }],
				},
			},
			0,
		);

		expect(result.attendees).toEqual([
			{ email: 'accepted.user@example.com', status: 'accepted' },
			{ email: 'pending.user@example.com' },
		]);
		expect(result.reminders).toEqual([{ type: 'email', minutes: 30 }]);
	});

	it('buildEventPayloadFromStructured should omit attendee status when left unchanged', () => {
		const result = buildEventPayloadFromStructured(
			mockExecuteFunctions,
			{
				attendeeUpdates: {
					attendee: [{ email: 'pending.user@example.com', status: '' }],
				},
			},
			0,
		);

		expect(result.attendees).toEqual([{ email: 'pending.user@example.com' }]);
	});

	it('buildEventPayloadFromStructured should reject invalid attendee and reminder payloads', () => {
		expect(() =>
			buildEventPayloadFromStructured(
				mockExecuteFunctions,
				{
					attendeeUpdates: {
						attendee: [{ email: 'bad-email', status: 'accepted' }],
					},
				},
				0,
			),
		).toThrow('Attendees[0].email must be a valid email address');

		expect(() =>
			buildEventPayloadFromStructured(
				mockExecuteFunctions,
				{
					reminderItems: {
						reminder: [{ type: 'sms', minutes: 10 }],
					},
				},
				0,
			),
		).toThrow('reminders[0].type must be one of: email, popup, notification');
	});

	it('validateEventPayload should enforce required schedule and title', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).not.toThrow();
	});

	it('validateEventPayload should normalize ISO 8601 schedule values into milliseconds', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: futureDateTimeStartIso,
				end_time: new Date(futureDateTimeStartMs + oneHourMs).toISOString(),
				timezone: 'Asia/Kolkata',
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);

		expect(validated.start_time).toBe(futureDateTimeStartMs);
		expect(validated.end_time).toBe(futureDateTimeStartMs + oneHourMs);
	});

	it('validateEventPayload should resolve ISO 8601 values without an offset using timezone', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: newYorkNoOffsetStartIso,
				end_time: newYorkNoOffsetEndIso,
				timezone: 'America/New_York',
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);

		expect(validated.start_time).toBe(newYorkOffsetStartMs);
		expect(validated.end_time).toBe(newYorkOffsetEndMs);
	});

	it('validateEventPayload should preserve ISO 8601 values with explicit offsets', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: '2026-03-20T15:00:00-04:00',
				end_time: '2026-03-20T16:00:00-04:00',
				timezone: 'America/New_York',
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);

		expect(validated.start_time).toBe(newYorkOffsetStartMs);
		expect(validated.end_time).toBe(newYorkOffsetEndMs);
	});

	it('validateEventPayload should enforce edit requirements', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					calendar_id: 'cal_123',
					type: 'video_conference',
				} as IDataObject,
				0,
				'Event Updates',
				{ requireTitle: true, requireSchedule: true, requireCalendarId: true, requireType: true },
			),
		).not.toThrow();
	});

	it('validateEventPayload should fail when end_time <= start_time', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureEndTimeMs,
					end_time: futureStartTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('end_time must be greater than start_time');
	});

	it('validateEventPayload should fail future-schedule validation when end_time <= start_time', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureStartTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true, requireFutureSchedule: true },
			),
		).toThrow('end_time must be greater than start_time');
	});

	it('validateEventPayload should fail on invalid attendee email', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attendees: ['not-an-email'],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow(NodeOperationError);
	});

	it('validateEventPayload should cover additional validation paths', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				null as unknown as IDataObject,
				0,
				'Event Definition',
			),
		).toThrow('Event Definition cannot be empty');

		expect(() =>
			validateEventPayload(mockExecuteFunctions, {} as IDataObject, 0, 'Event Definition'),
		).toThrow('Event Definition cannot be empty');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'x'.repeat(256),
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('Title is too long');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: -1,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('start_time must be a positive whole number');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Invalid/Timezone',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('Timezone must be a valid IANA timezone');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: 'invalid_type',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('type must be one of');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attendees: [{}],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('attendees[0].email must be a valid email address');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attendees: [1 as unknown as string],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('attendees[0] must be an email string or attendee object');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					reminders: {} as unknown as IDataObject[],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('reminders must be an array');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attachment_ids: {} as unknown as IDataObject[],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('attachment_ids must be an array of strings');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attachment_ids: [''],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('attachment_ids[0] must be a non-empty string');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attachment_ids: ['a'.repeat(256)],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('attachment_ids[0] is too long');
	});

	it('validateEventPayload should require title when configured', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('Title is required');
	});

	it('validateEventPayload should reject empty required title', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: '   ',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('Title cannot be empty');
	});

	it('validateEventPayload should reject overly long timezone and missing schedule timezone', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'a'.repeat(101),
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('Timezone is too long');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('Timezone is required');
	});

	it('validateEventPayload should reject non-array attendees and accept attendee status object', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attendees: {} as unknown as IDataObject[],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('attendees must be an array');

		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				attendees: [{ email: 'accepted.user@example.com', status: 'accepted' }],
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);

		expect(validated.attendees).toEqual([
			{ email: 'accepted.user@example.com', status: 'accepted' },
		]);
	});

	it('validateEventPayload should validate reminders and normalize attachment IDs', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				reminders: [{ type: 'email', minutes: 10 }],
				attachment_ids: ['att_123'],
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);
		expect(validated.reminders).toEqual([{ type: 'email', minutes: 10 }]);

		const normalized = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				attachment_ids: [123],
			} as unknown as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);
		expect(normalized.attachment_ids).toEqual(['123']);
	});

	it('validateEventPayload should reject unsupported reminder values', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					reminders: [{ type: 'sms', minutes: 10 }],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('reminders[0].type must be one of: email, popup, notification');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					reminders: [{ type: 'email', minutes: 0 }],
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('reminders[0].minutes must be a positive whole number');
	});

	it('parseDateTimeOrUnixMs should parse unix and datetime inputs', () => {
		expect(
			parseDateTimeOrUnixMs(mockExecuteFunctions, futureStartTimeString, 0, 'Start Time'),
		).toBe(futureStartTimeMs);
		expect(parseDateTimeOrUnixMs(mockExecuteFunctions, futureStartTimeMs, 0, 'Start Time')).toBe(
			futureStartTimeMs,
		);
		expect(
			parseDateTimeOrUnixMs(mockExecuteFunctions, futureDateTimeStartIso, 0, 'Start Time'),
		).toBe(futureDateTimeStartMs);
		expect(
			parseDateTimeOrUnixMs(mockExecuteFunctions, '2026-03-20T15:00:00-04:00', 0, 'Start Time'),
		).toBe(newYorkOffsetStartMs);
		expect(
			parseDateTimeOrUnixMs(mockExecuteFunctions, newYorkNoOffsetStartIso, 0, 'Start Time', {
				timeZone: 'America/New_York',
			}),
		).toBe(newYorkOffsetStartMs);
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, '', 0, 'Start Time')).toThrow(
			'Start Time cannot be empty',
		);
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, -1, 0, 'Start Time')).toThrow(
			'Start Time must be a positive whole number',
		);
		expect(() =>
			parseDateTimeOrUnixMs(mockExecuteFunctions, { bad: true }, 0, 'Start Time'),
		).toThrow('Start Time must be a datetime string or Unix timestamp in milliseconds');
		expect(() =>
			parseDateTimeOrUnixMs(mockExecuteFunctions, 'not-a-date', 0, 'Start Time'),
		).toThrow('Start Time must be a valid datetime or Unix timestamp in milliseconds');
	});

	it('parseDateTimeOrUnixMs should reject offset-less ISO values when no timezone is provided', () => {
		expect(() =>
			parseDateTimeOrUnixMs(mockExecuteFunctions, '2026-03-20T15:00', 0, 'Start Time'),
		).toThrow('Start Time must include a UTC offset when no timezone is provided');
	});

	it('parseDateTimeOrUnixMs should support offset-less ISO values without seconds and with milliseconds', () => {
		expect(
			parseDateTimeOrUnixMs(mockExecuteFunctions, '2026-03-20T15:00', 0, 'Start Time', {
				timeZone: 'America/New_York',
			}),
		).toBe(Date.parse('2026-03-20T15:00:00-04:00'));

		expect(
			parseDateTimeOrUnixMs(mockExecuteFunctions, '2026-03-20T15:00:00.123', 0, 'Start Time', {
				timeZone: 'America/New_York',
			}),
		).toBe(Date.parse('2026-03-20T15:00:00.123-04:00'));
	});

	it('parseDateTimeOrUnixMs should reject impossible local times without an offset', () => {
		expect(() =>
			parseDateTimeOrUnixMs(mockExecuteFunctions, '2026-03-08T02:30:00', 0, 'Start Time', {
				timeZone: 'America/New_York',
			}),
		).toThrow('Start Time must match the provided timezone when no UTC offset is supplied');
	});

	it('validateEventPayload should trim optional text fields to undefined when blank', () => {
		const payload = {
			title: 'Town Hall',
			start_time: futureStartTimeMs,
			end_time: futureEndTimeMs,
			timezone: 'Asia/Kolkata',
			location: '   ',
			description: '   ',
		} as IDataObject;
		const validated = validateEventPayload(mockExecuteFunctions, payload, 0, 'Event Definition', {
			requireTitle: true,
			requireSchedule: true,
		});

		expect(validated.location).toBeUndefined();
		expect(validated.description).toBeUndefined();
	});

	it('buildEventPayloadFromStructured should fail when attendeeEmails is not a string', () => {
		expect(() =>
			buildEventPayloadFromStructured(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					startTime: futureStartTimeMs,
					endTime: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attendeeEmails: 1 as unknown as string,
				},
				0,
			),
		).toThrow('Attendee Emails must be a string');
	});

	it('validateEventPayload should reject non-object reminders', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					reminders: [null],
				} as unknown as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('reminders[0] must be an object');
	});

	it('normalizeRawAttachmentsForUpdate should validate attachment object shape', () => {
		expect(() =>
			normalizeRawAttachmentsForUpdate(
				mockExecuteFunctions,
				{
					attachments: 'bad',
				} as unknown as IDataObject,
				0,
			),
		).toThrow('"attachments" must be an array of objects with an "id" string.');

		expect(() =>
			normalizeRawAttachmentsForUpdate(
				mockExecuteFunctions,
				{
					attachments: ['bad'],
				} as unknown as IDataObject,
				0,
			),
		).toThrow('attachments[0] must be an object with an "id" string.');

		expect(() =>
			normalizeRawAttachmentsForUpdate(
				mockExecuteFunctions,
				{
					attachments: [{}],
				},
				0,
			),
		).toThrow('attachments[0].id must be a non-empty string.');
	});

	it('normalizeStructuredAttachmentsForUpdate should normalize attachment_ids and remove legacy keys', () => {
		const emptyAttachments = normalizeStructuredAttachmentsForUpdate({
			attachment_ids: [],
		} as IDataObject);
		expect(emptyAttachments.attachments).toEqual([]);

		const mappedAttachments = normalizeStructuredAttachmentsForUpdate({
			attachment_ids: [' file_1 ', 'file_2'],
		} as IDataObject);
		expect(mappedAttachments.attachments).toEqual([{ id: 'file_1' }, { id: 'file_2' }]);

		const sanitized = normalizeStructuredAttachmentsForUpdate({
			attachment_ids: ['file_1'],
			attachmentIds: ['legacy_file_1'],
			attach: [{ id: 'legacy_file_2' }],
		} as unknown as IDataObject);
		expect(sanitized).not.toHaveProperty('attachment_ids');
		expect(sanitized).not.toHaveProperty('attachmentIds');
		expect(sanitized).not.toHaveProperty('attach');
	});

	it('normalizeRawAttachmentsForUpdate should reject legacy keys and invalid entries', () => {
		expect(() =>
			normalizeRawAttachmentsForUpdate(
				mockExecuteFunctions,
				{
					attachment_ids: ['file_1'],
				} as unknown as IDataObject,
				0,
			),
		).toThrow('Use only "attachments" as an array of objects with "id" for event attachments.');

		expect(() =>
			normalizeRawAttachmentsForUpdate(
				mockExecuteFunctions,
				{
					attachments: {} as unknown as IDataObject[],
				} as unknown as IDataObject,
				0,
			),
		).toThrow('"attachments" must be an array of objects with an "id" string.');

		expect(() =>
			normalizeRawAttachmentsForUpdate(
				mockExecuteFunctions,
				{
					attachments: [{ id: '   ' }],
				} as IDataObject,
				0,
			),
		).toThrow('attachments[0].id must be a non-empty string.');
	});

	it('normalizeRawAttachmentsForUpdate should enforce max length for attachment IDs', () => {
		expect(() =>
			normalizeRawAttachmentsForUpdate(
				mockExecuteFunctions,
				{
					attachments: [{ id: 'a'.repeat(256) }],
				} as IDataObject,
				0,
			),
		).toThrow('attachments[0].id must be at most 255 characters');
	});

	it('buildEventPayloadFromStructured should ignore invalid non-array attendee/reminder collections', () => {
		const result = buildEventPayloadFromStructured(
			mockExecuteFunctions,
			{
				attendeeUpdates: {
					attendee: 'not-array' as unknown as IDataObject[],
				},
				reminderItems: {
					reminder: 'not-array' as unknown as IDataObject[],
				},
			},
			0,
		);

		expect(result.attendees).toBeUndefined();
		expect(result.reminders).toBeUndefined();
	});

	it('normalizeRawAttachmentsForUpdate should keep payload unchanged when attachments are not provided', () => {
		const normalized = normalizeRawAttachmentsForUpdate(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
			} as IDataObject,
			0,
		);
		expect(normalized).toEqual({ title: 'Town Hall' });
	});

	it('normalizeRawAttachmentsForUpdate should normalize valid attachment ids', () => {
		const normalized = normalizeRawAttachmentsForUpdate(
			mockExecuteFunctions,
			{
				attachments: [{ id: ' file_1 ' }, { id: 'file_2' }],
			} as IDataObject,
			0,
		);
		expect(normalized.attachments).toEqual([{ id: 'file_1' }, { id: 'file_2' }]);
	});

	it('validateEventPayload should allow empty payload when allowEmpty is enabled', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{} as IDataObject,
			0,
			'Event Definition',
			{ allowEmpty: true },
		);
		expect(validated).toEqual({});
	});

	it('validateEventPayload should skip end-time ordering check when one boundary is missing', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				start_time: futureStartTimeMs,
			} as IDataObject,
			0,
			'Event Definition',
			{ allowEmpty: true },
		);
		expect(validated.start_time).toBe(futureStartTimeMs);
		expect(validated.end_time).toBeUndefined();
	});

	it('validateEventPayload should allow partial future schedules when future validation is enabled', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					start_time: futureStartTimeMs,
				} as IDataObject,
				0,
				'Event Definition',
				{ allowEmpty: true, requireFutureSchedule: true },
			),
		).not.toThrow();

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					end_time: futureEndTimeMs,
				} as IDataObject,
				0,
				'Event Definition',
				{ allowEmpty: true, requireFutureSchedule: true },
			),
		).not.toThrow();
	});

	it('validateEventPayload should require schedule fields only when requireSchedule is true', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					timezone: 'Asia/Kolkata',
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('end_time must be a datetime string or Unix timestamp in milliseconds');
	});

	it('validateEventPayload should require timezone only when schedule is required', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('Timezone is required');
	});

	it('validateEventPayload should reject missing reminder type', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					reminders: [{ minutes: 10 }],
				} as unknown as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('reminders[0].type must be one of: email, popup, notification');
	});

	it('validateEventPayload should allow popup reminders', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				reminders: [{ type: 'popup', minutes: 10 }],
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);
		expect(validated.reminders).toEqual([{ type: 'popup', minutes: 10 }]);
	});

	it('normalizeStructuredAttachmentsForCreate should preserve attachment_ids', () => {
		const normalized = normalizeStructuredAttachmentsForCreate({
			attachment_ids: ['file_1'],
			attachmentIds: ['legacy_file_1'],
			attach: [{ id: 'legacy_file_2' }],
		} as unknown as IDataObject);
		expect(normalized.attachment_ids).toEqual(['file_1']);
		expect(normalized).not.toHaveProperty('attachmentIds');
		expect(normalized).not.toHaveProperty('attach');
	});

	it('normalizeRawAttachmentsForCreate should reject attachments object key', () => {
		expect(() =>
			normalizeRawAttachmentsForCreate(
				mockExecuteFunctions,
				{
					attachments: [{ id: 'file_1' }],
				} as IDataObject,
				0,
			),
		).toThrow('Use only "attachment_ids" as an array of strings for event attachments.');

		const normalized = normalizeRawAttachmentsForCreate(
			mockExecuteFunctions,
			{
				attachment_ids: ['file_1'],
			} as IDataObject,
			0,
		);
		expect(normalized.attachment_ids).toEqual(['file_1']);
	});

	it('normalizeRawAttachmentsForCreate should reject legacy attachmentIds and attach keys', () => {
		expect(() =>
			normalizeRawAttachmentsForCreate(
				mockExecuteFunctions,
				{
					attachmentIds: ['file_1'],
				} as unknown as IDataObject,
				0,
			),
		).toThrow('Use only "attachment_ids" as an array of strings for event attachments.');

		expect(() =>
			normalizeRawAttachmentsForCreate(
				mockExecuteFunctions,
				{
					attach: [{ id: 'file_2' }],
				} as unknown as IDataObject,
				0,
			),
		).toThrow('Use only "attachment_ids" as an array of strings for event attachments.');
	});

	it('validateEventPayload should normalize type and attachment_ids from nullish values', () => {
		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: undefined,
				} as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true, requireType: true },
			),
		).toThrow('type must be one of');

		expect(() =>
			validateEventPayload(
				mockExecuteFunctions,
				{
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attachment_ids: [undefined],
				} as unknown as IDataObject,
				0,
				'Event Definition',
				{ requireTitle: true, requireSchedule: true },
			),
		).toThrow('attachment_ids[0] must be a non-empty string');
	});

	it('validate helpers should reject nullish identifiers and statuses', () => {
		expect(() => validateEventId(mockExecuteFunctions, undefined as unknown as string, 0)).toThrow(
			'Event ID is required',
		);
		expect(() =>
			validateCalendarId(mockExecuteFunctions, undefined as unknown as string, 0, {
				required: true,
			}),
		).toThrow('Calendar ID is required');
		expect(() =>
			validateEventStatus(mockExecuteFunctions, undefined as unknown as string, 0),
		).toThrow('Status must be one of');
		expect(() =>
			validateRecurrenceId(mockExecuteFunctions, undefined as unknown as string, 0),
		).toThrow('Recurrence ID cannot be empty');
	});

	it('buildEventPayloadFromStructured should dedupe attendee emails and skip empty delimited lists', () => {
		const deduped = buildEventPayloadFromStructured(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				startTime: futureStartTimeString,
				endTime: futureEndTimeString,
				timezone: 'Asia/Kolkata',
				attendeeEmails: 'user@example.com,user@example.com',
			},
			0,
		);
		expect(deduped.attendees).toEqual(['user@example.com']);

		const emptyLists = buildEventPayloadFromStructured(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				startTime: futureStartTimeString,
				endTime: futureEndTimeString,
				timezone: 'Asia/Kolkata',
				attendeeEmails: ', ,',
				attachmentIds: ', ,',
			},
			0,
		);
		expect(emptyLists.attendees).toBeUndefined();
		expect(emptyLists.attachment_ids).toBeUndefined();
	});

	it('buildEventPayloadFromStructured should throw when attachmentIds is trim-able non-string', () => {
		expect(() =>
			buildEventPayloadFromStructured(
				mockExecuteFunctions,
				{
					attachmentIds: { trim: () => 'value' } as unknown as string,
				},
				0,
			),
		).toThrow('Attachment IDs must be a string');
	});

	it('validateEventPayload should keep attendee object without status when omitted', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				attendees: [{ email: 'accepted.user@example.com' }],
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);
		expect(validated.attendees).toEqual([{ email: 'accepted.user@example.com' }]);
	});

	it('validateEventPayload should allow notification reminders', () => {
		const validated = validateEventPayload(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				reminders: [{ type: 'notification', minutes: 55 }],
			} as IDataObject,
			0,
			'Event Definition',
			{ requireTitle: true, requireSchedule: true },
		);
		expect(validated.reminders).toEqual([{ type: 'notification', minutes: 55 }]);
	});

	it('isEventsAiErrorModeEnabled should read direct parameter and node parameter fallback', () => {
		const directContext = {
			getNodeParameter: jest.fn(() => 'true'),
			getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
		} as unknown as IExecuteFunctions;
		expect(isEventsAiErrorModeEnabled(directContext, 0)).toBe(true);

		const fallbackContext = {
			getNodeParameter: jest.fn(() => {
				throw new Error('missing');
			}),
			getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: 'true' } })),
		} as unknown as IExecuteFunctions;
		expect(isEventsAiErrorModeEnabled(fallbackContext, 0)).toBe(true);

		const noNodeContext = {
			getNodeParameter: jest.fn(() => false),
		} as unknown as IExecuteFunctions;
		expect(isEventsAiErrorModeEnabled(noNodeContext, 0)).toBe(false);

		const invalidNodeContext = {
			getNodeParameter: jest.fn(() => false),
			getNode: jest.fn(() => ({ parameters: [] })),
		} as unknown as IExecuteFunctions;
		expect(isEventsAiErrorModeEnabled(invalidNodeContext, 0)).toBe(false);

		const missingParametersContext = {
			getNodeParameter: jest.fn(() => false),
			getNode: jest.fn(() => undefined),
		} as unknown as IExecuteFunctions;
		expect(isEventsAiErrorModeEnabled(missingParametersContext, 0)).toBe(false);

		const throwingNodeContext = {
			getNodeParameter: jest.fn(() => false),
			getNode: jest.fn(() => {
				throw new Error('boom');
			}),
		} as unknown as IExecuteFunctions;
		expect(isEventsAiErrorModeEnabled(throwingNodeContext, 0)).toBe(false);
	});

	it('pushEventsRecoverableError should prefer scope payloads and generic error payloads', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			getNodeParameter: jest.fn(() => false),
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ parameters: {} })),
		} as unknown as IExecuteFunctions;

		const scopeHandled = pushEventsRecoverableError(
			context,
			returnData,
			0,
			'delete',
			{
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'events',
					operation: 'delete',
				},
			},
			{},
		);
		expect(scopeHandled).toBe(true);
		expect(returnData[0].json).toEqual({
			success: false,
			resource: 'events',
			operation: 'delete',
		});

		const genericHandled = pushEventsRecoverableError(
			context,
			returnData,
			1,
			'create',
			{ statusCode: 500, message: 'Server blew up' },
			{
				contextFields: { event_id: 'evt_1' },
			},
		);
		expect(genericHandled).toBe(true);
		expect(returnData[1].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
				event_id: 'evt_1',
				reason: 'SERVER_ERROR',
			}),
		);

		const nonRecoverableContext = {
			getNodeParameter: jest.fn(() => false),
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ parameters: {} })),
		} as unknown as IExecuteFunctions;
		expect(
			pushEventsRecoverableError(nonRecoverableContext, [], 0, 'create', new Error('nope')),
		).toBe(false);

		const invalidScopePayloadContext = {
			getNodeParameter: jest.fn(() => 'true'),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: 'true' } })),
		} as unknown as IExecuteFunctions;
		const invalidScopeReturnData: INodeExecutionData[] = [];
		expect(
			pushEventsRecoverableError(invalidScopePayloadContext, invalidScopeReturnData, 0, 'create', {
				zohoCliqScopeErrorPayload: [],
			}),
		).toBe(true);
		expect(invalidScopeReturnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
			}),
		);

		const undefinedErrorReturnData: INodeExecutionData[] = [];
		expect(
			pushEventsRecoverableError(
				invalidScopePayloadContext,
				undefinedErrorReturnData,
				0,
				'create',
				undefined,
			),
		).toBe(true);
		expect(undefinedErrorReturnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
			}),
		);
	});

	it('resolveEventsEnhancedOutput should coerce primitive responses', () => {
		const context = {
			getNodeParameter: jest.fn(() => true),
		} as unknown as IExecuteFunctions;

		expect(resolveEventsEnhancedOutput(context, 0, '').responseJson).toEqual({ data: '' });
	});

	it('parseDateTimeOrUnixMs should reject zero unix timestamps', () => {
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, '0', 0, 'Start Time')).toThrow(
			'Start Time must be a positive Unix timestamp in milliseconds',
		);
	});

	it('buildEventPayloadFromStructured should trim calendar IDs before assigning them', () => {
		const result = buildEventPayloadFromStructured(
			mockExecuteFunctions,
			{
				title: 'Town Hall',
				startTime: futureStartTimeString,
				endTime: futureEndTimeString,
				timezone: 'Asia/Kolkata',
				calendarId: ' cal_123 ',
			},
			0,
		);

		expect(result.calendar_id).toBe('cal_123');
	});
});
