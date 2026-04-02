import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import {
	newYorkLocalEndIso,
	newYorkLocalStartIso,
	newYorkOffsetEndIso,
	newYorkOffsetEndMs,
	newYorkOffsetStartIso,
	newYorkOffsetStartMs,
} from './testDateTimeConstants';

import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/events/update.operation';
import { getRequiredScopesForOperationOrThrow } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Update Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const oneHourMs = 60 * 60 * 1000;
	const oneDayMs = 24 * 60 * 60 * 1000;
	const testNowMs = Date.now();
	const futureStartTimeMs = testNowMs + 7 * oneDayMs;
	const futureEndTimeMs = futureStartTimeMs + oneHourMs;
	const futureStartTimeString = String(futureStartTimeMs);
	const futureEndTimeString = String(futureEndTimeMs);
	const futureDateTimeStartMs = testNowMs + 14 * oneDayMs;
	const futureDateTimeEndMs = futureDateTimeStartMs + oneHourMs;
	const futureDateTimeStartIso = new Date(futureDateTimeStartMs).toISOString();
	const futureDateTimeEndIso = new Date(futureDateTimeEndMs).toISOString();
	const frozenTestNow = new Date(testNowMs);
	const defaultStartTimeMs = futureStartTimeMs;
	const pastEndTimeMs = testNowMs - oneDayMs;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: Record<string, unknown> = {},
		options: {
			continueOnFail?: boolean;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const { continueOnFail = false, enableAiErrorMode = false } = options;
		const merged: Record<string, unknown> = { simplify: false, ...values };

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) =>
				name in merged ? merged[name] : fallback,
			),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeAll(() => {
		jest.useFakeTimers();
		jest.setSystemTime(frozenTestNow);
	});

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	it('should prefill the current type for structured updates when omitted', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'structured',
			startDateTime: futureStartTimeString,
			endDateTime: futureEndTimeString,
			title: 'Town Hall',
			timezone: 'Asia/Kolkata',
			eventType: '',
			attendeeUpdates: {
				attendee: [{ email: 'accepted.user@example.com', status: 'accepted' }],
			},
			location: 'Conference Room 21',
			description: 'Updated',
			attachmentIds: 'att_1,att_2',
			reminderItems: {
				reminder: [{ type: 'notification', minutes: 15 }],
			},
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { type: 'video_conference' } })
			.mockResolvedValueOnce({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123' },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				calendar_id: 'cal_123',
				type: 'video_conference',
				attendees: [{ email: 'accepted.user@example.com', status: 'accepted' }],
				location: 'Conference Room 21',
				description: 'Updated',
				attachments: [{ id: 'att_1' }, { id: 'att_2' }],
				reminders: [{ type: 'notification', minutes: 15 }],
			},
		);
	});

	it('should preserve an explicit type without prefetching', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'raw',
			eventUpdates: {
				title: 'Town Hall',
				start_time: newYorkLocalStartIso,
				end_time: newYorkLocalEndIso,
				timezone: 'America/New_York',
				type: 'event_management',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			{
				title: 'Town Hall',
				start_time: newYorkOffsetStartMs,
				end_time: newYorkOffsetEndMs,
				timezone: 'America/New_York',
				calendar_id: 'cal_123',
				type: 'event_management',
			},
		);
	});

	it('should preserve an explicit structured type with ISO input without offsets using timezone', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'structured',
			startDateTime: newYorkLocalStartIso,
			endDateTime: newYorkLocalEndIso,
			title: 'Town Hall',
			timezone: 'America/New_York',
			eventType: 'event_management',
			attendeeUpdates: {},
			location: '',
			description: '',
			attachmentIds: '',
			reminderItems: {},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			{
				title: 'Town Hall',
				start_time: newYorkOffsetStartMs,
				end_time: newYorkOffsetEndMs,
				timezone: 'America/New_York',
				calendar_id: 'cal_123',
				type: 'event_management',
			},
		);
	});

	it('should preserve an explicit raw type with ISO offsets without prefetching', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'raw',
			eventUpdates: {
				title: 'Town Hall',
				start_time: newYorkOffsetStartIso,
				end_time: newYorkOffsetEndIso,
				timezone: 'America/New_York',
				type: 'event_management',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			{
				title: 'Town Hall',
				start_time: newYorkOffsetStartMs,
				end_time: newYorkOffsetEndMs,
				timezone: 'America/New_York',
				calendar_id: 'cal_123',
				type: 'event_management',
			},
		);
	});

	it('should preserve an explicit structured type without prefetching', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'structured',
			startDateTime: futureStartTimeString,
			endDateTime: futureEndTimeString,
			title: 'Town Hall',
			timezone: 'Asia/Kolkata',
			eventType: 'event_management',
			attendeeUpdates: {},
			location: '',
			description: '',
			attachmentIds: '',
			reminderItems: {},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			{
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				calendar_id: 'cal_123',
				type: 'event_management',
			},
		);
	});

	it('should place the IANA timezone notice directly after the structured timezone field', () => {
		const timezoneIndex = update.description.findIndex((property) => property.name === 'timezone');
		const timezoneNoticeIndex = update.description.findIndex(
			(property) => property.name === 'timezoneNotice',
		);

		expect(timezoneIndex).toBeGreaterThanOrEqual(0);
		expect(timezoneNoticeIndex).toBe(timezoneIndex + 1);
		expect(update.description[timezoneNoticeIndex]?.type).toBe('notice');
		expect(update.description[timezoneNoticeIndex]?.displayName).toContain(
			'Open IANA timezone list',
		);
	});

	it('should prefill the current type from an array prefetch response', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'raw',
			eventUpdates: {
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
			},
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ type: 'audio_conference' }] })
			.mockResolvedValueOnce({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			expect.objectContaining({
				calendar_id: 'cal_123',
				type: 'audio_conference',
			}),
		);
	});

	it('should always include fold-in metadata on success', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'raw',
			simplify: false,
			eventUpdates: {
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				type: 'event_management',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'evt_123@zoho.com' }] });

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				updated: true,
				success: true,
				operation: 'update_event',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				data: [{ id: 'evt_123@zoho.com' }],
			}),
		);
	});

	it('should reject raw legacy attachment keys', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'raw',
			simplify: false,
			eventUpdates: {
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				attachment_ids: ['att_1'],
			},
		});

		await expect(update.execute.call(context, items, SCOPES.EVENTS_UPDATE)).rejects.toThrow(
			'Use only "attachments" as an array of objects with "id" for event attachments.',
		);
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'raw',
			simplify: false,
			eventUpdates: {
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
			},
		});
		const firstMissingScope = getRequiredScopesForOperationOrThrow('events', 'update').find(
			(scope) => !SCOPES.EVENTS_GET_CALENDARS.split(',').includes(scope),
		);

		let thrownError: unknown;
		try {
			await update.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [firstMissingScope],
				missingScopes: [firstMissingScope],
			}),
		);
	});

	it('should return a recoverable validation payload when continueOnFail is enabled', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: { title: 'Only title' },
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_EVENT_SCHEDULE',
			}),
		);
	});

	it('should return a recoverable validation payload when end_time is in the past', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: defaultStartTimeMs,
					end_time: pastEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: 'event_management',
				},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_EVENT_SCHEDULE',
				message: 'end_time must be in the future',
				hint: 'Provide a title, a valid timezone, future start and end times, and an end time that is later than the start time.',
			}),
		);
	});

	it('should allow past-dated update requests when future-date validation is disabled', async () => {
		const pastStartTimeMs = testNowMs - oneDayMs;
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			requireFutureDates: false,
			inputMode: 'raw',
			eventUpdates: {
				title: 'Past Event Import',
				start_time: pastStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				type: 'event_management',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			{
				title: 'Past Event Import',
				start_time: pastStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
				calendar_id: 'cal_123',
				type: 'event_management',
			},
		);
	});

	it('should not re-run future-date validation after prefilling the current type', async () => {
		const nearFutureStartTimeMs = testNowMs + 2 * 60 * 1000;
		const nearFutureEndTimeMs = nearFutureStartTimeMs + oneHourMs;
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'raw',
			eventUpdates: {
				title: 'Town Hall',
				start_time: nearFutureStartTimeMs,
				end_time: nearFutureEndTimeMs,
				timezone: 'Asia/Kolkata',
			},
		});

		mockZohoCliqApiRequest.mockImplementationOnce(async () => {
			jest.setSystemTime(new Date(nearFutureStartTimeMs + 60 * 60 * 1000));
			return { data: { type: 'event_management' } };
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123' },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			{
				title: 'Town Hall',
				start_time: nearFutureStartTimeMs,
				end_time: nearFutureEndTimeMs,
				timezone: 'Asia/Kolkata',
				calendar_id: 'cal_123',
				type: 'event_management',
			},
		);
	});

	it('should return recoverable error output when continueOnFail is enabled', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: 'event_management',
				},
			},
			{ continueOnFail: true },
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'Bad request - please check your parameters',
		});

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
			}),
		);
	});

	it('should omit unsanitized IDs from error output when validation fails early', async () => {
		const context = createContext(
			{
				eventId: '',
				calendarId: '',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
			}),
		);
		expect(result[0].json).not.toHaveProperty('event_id');
		expect(result[0].json).not.toHaveProperty('calendar_id');
	});

	it('should return a recoverable payload when the preflight response omits type', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				},
			},
			{ continueOnFail: true },
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [{}] });

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'MISSING_EVENT_TYPE',
			}),
		);
	});

	it('should reuse the validated preflight payload when type recovery is needed in recoverable mode', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				},
			},
			{ continueOnFail: true },
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'evt_123@zoho.com', type: 'video_conference' } })
			.mockResolvedValueOnce({ data: [{ id: 'evt_123@zoho.com' }] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123' },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			expect.objectContaining({
				calendar_id: 'cal_123',
				type: 'video_conference',
			}),
		);
	});

	it('should return a recoverable payload when the preflight response omits event details', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				},
			},
			{ continueOnFail: true },
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'MISSING_EVENT_DETAILS',
			}),
		);
	});

	it('should return a recoverable validation payload for an invalid input mode', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'invalid-mode',
				simplify: false,
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'INVALID_INPUT_MODE',
			}),
		);
	});

	it('should return a recoverable validation payload for an invalid structured date input', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'structured',
				simplify: false,
				startDateTime: 'not-a-date',
				endDateTime: futureEndTimeString,
				title: 'Town Hall',
				timezone: 'Asia/Kolkata',
				eventType: '',
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'INVALID_EVENT_SCHEDULE',
			}),
		);
	});

	it('should return a recoverable validation payload for a nonexistent local raw ISO time', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: '2026-03-08T02:30:00',
					end_time: '2026-03-08T03:30:00',
					timezone: 'America/New_York',
					type: 'event_management',
				},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_EVENT_SCHEDULE',
				message: 'start_time must match the provided timezone when no UTC offset is supplied',
			}),
		);
	});

	it('should return a recoverable API payload in AI Error Mode', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'structured',
				startDateTime: futureStartTimeString,
				endDateTime: futureEndTimeString,
				title: 'Town Hall',
				timezone: 'Asia/Kolkata',
				eventType: '',
				attendeeUpdates: {},
				location: '',
				description: '',
				attachmentIds: '',
				reminderItems: {},
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { type: 'video_conference' } })
			.mockRejectedValueOnce({
				statusCode: 500,
				message: 'Service unavailable',
			});

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
	});

	it('should parse datetime picker inputs into milliseconds', async () => {
		const context = createContext({
			eventId: 'evt_123@zoho.com',
			calendarId: 'cal_123',
			inputMode: 'structured',
			startDateTime: futureDateTimeStartIso,
			endDateTime: futureDateTimeEndIso,
			title: 'Town Hall',
			timezone: 'Asia/Kolkata',
			eventType: '',
			attendeeUpdates: {},
			location: '',
			description: '',
			attachmentIds: '',
			reminderItems: {},
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { type: 'normal_event' } })
			.mockResolvedValueOnce({ data: [] });

		await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/events/evt_123%40zoho.com',
			expect.objectContaining({
				calendar_id: 'cal_123',
				type: 'normal_event',
				start_time: futureDateTimeStartMs,
				end_time: futureDateTimeEndMs,
			}),
		);
	});

	it('should return a recoverable validation payload when required calendar ID is missing', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: '',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				reason: 'INVALID_CALENDAR_ID',
			}),
		);
	});

	it('should return a recoverable error with INVALID_ATTENDEES when attendee validation fails', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: 'event_management',
					attendees: [{ email: 'not-an-email' }],
				},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_ATTENDEES',
				hint: 'Provide attendee email addresses and optional RSVP statuses only.',
			}),
		);
	});

	it('should return a non-enhanced recoverable error with INVALID_REMINDERS when reminder validation fails', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: 'event_management',
					reminders: [{ type: 'email', minutes: -5 }],
				},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_REMINDERS',
				hint: 'Use reminder objects with type `email`, `notification`, or `popup` and a positive whole-number minutes value.',
			}),
		);
	});

	it('should return a non-enhanced recoverable error with INVALID_ATTACHMENTS when attachment validation fails', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: 'event_management',
					attachments: ['not-an-object'],
				},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_ATTACHMENTS',
				hint: 'Use uploaded Zoho Cliq event attachment IDs only.',
			}),
		);
	});

	it('should return a non-enhanced recoverable error with INVALID_EVENT_PAYLOAD when eventUpdates is not a JSON object', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: 'not valid json {{{',
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_EVENT_PAYLOAD',
				hint: 'Provide a safe JSON object with supported event fields only.',
			}),
		);
	});

	it('should return a non-enhanced recoverable error with INVALID_EVENT_PAYLOAD when payload contains an unsafe key', async () => {
		const context = createContext(
			{
				eventId: 'evt_123@zoho.com',
				calendarId: 'cal_123',
				inputMode: 'raw',
				simplify: false,
				eventUpdates: JSON.stringify({
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					type: 'event_management',
					constructor: { prototype: 'hack' },
				}),
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.EVENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'update',
				reason: 'INVALID_EVENT_PAYLOAD',
				hint: 'Provide a safe JSON object with supported event fields only.',
			}),
		);
	});
});
