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

import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/events/create.operation';
import { getRequiredScopesForOperationOrThrow } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Create Operation', () => {
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
	const pastStartTimeMs = testNowMs - oneDayMs;
	const pastEndTimeMs = testNowMs + oneHourMs;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: Record<string, unknown> = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
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

	it('should create an event from structured input using Unix timestamp expressions', async () => {
		const context = createContext({
			calendarId: 'cal_123',
			inputMode: 'structured',
			startDateTime: futureStartTimeString,
			endDateTime: futureEndTimeString,
			title: 'Town Hall',
			timezone: 'Asia/Kolkata',
			eventType: 'video_conference',
			attendeeEmails: 'user1@example.com,user2@example.com',
			location: 'Conference Room 21',
			description: 'Discussion',
			attachmentIds: 'att_1,att_2',
			reminderItems: {
				reminder: [{ type: 'notification', minutes: 45 }],
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'event_1' }] });

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/events', {
			title: 'Town Hall',
			start_time: futureStartTimeMs,
			end_time: futureEndTimeMs,
			timezone: 'Asia/Kolkata',
			calendar_id: 'cal_123',
			type: 'video_conference',
			attendees: ['user1@example.com', 'user2@example.com'],
			location: 'Conference Room 21',
			description: 'Discussion',
			attachment_ids: ['att_1', 'att_2'],
			reminders: [{ type: 'notification', minutes: 45 }],
		});
		expect(result[0].json).toEqual({ data: [{ id: 'event_1' }] });
	});

	it('should create an event from raw JSON input', async () => {
		const context = createContext({
			calendarId: 'cal_123',
			inputMode: 'raw',
			eventDefinition: {
				title: 'Town Hall',
				start_time: newYorkLocalStartIso,
				end_time: newYorkLocalEndIso,
				timezone: 'America/New_York',
				attachment_ids: ['att_1'],
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'event_1' }] });

		await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/events', {
			title: 'Town Hall',
			start_time: newYorkOffsetStartMs,
			end_time: newYorkOffsetEndMs,
			timezone: 'America/New_York',
			calendar_id: 'cal_123',
			attachment_ids: ['att_1'],
		});
	});

	it('should create an event from structured ISO input without offsets using timezone', async () => {
		const context = createContext({
			calendarId: 'cal_123',
			inputMode: 'structured',
			startDateTime: newYorkLocalStartIso,
			endDateTime: newYorkLocalEndIso,
			title: 'Town Hall',
			timezone: 'America/New_York',
			eventType: 'normal_event',
			attendeeEmails: '',
			location: '',
			description: '',
			attachmentIds: '',
			reminderItems: {},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/events', {
			title: 'Town Hall',
			start_time: newYorkOffsetStartMs,
			end_time: newYorkOffsetEndMs,
			timezone: 'America/New_York',
			calendar_id: 'cal_123',
			type: 'normal_event',
		});
	});

	it('should create an event from raw JSON input with explicit ISO offsets', async () => {
		const context = createContext({
			calendarId: 'cal_123',
			inputMode: 'raw',
			eventDefinition: {
				title: 'Town Hall',
				start_time: newYorkOffsetStartIso,
				end_time: newYorkOffsetEndIso,
				timezone: 'America/New_York',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'event_1' }] });

		await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/events', {
			title: 'Town Hall',
			start_time: newYorkOffsetStartMs,
			end_time: newYorkOffsetEndMs,
			timezone: 'America/New_York',
			calendar_id: 'cal_123',
		});
	});

	it('should create an event from structured date-time input', async () => {
		const context = createContext({
			calendarId: 'cal_123',
			inputMode: 'structured',
			startDateTime: futureDateTimeStartIso,
			endDateTime: futureDateTimeEndIso,
			title: 'Town Hall',
			timezone: 'Asia/Kolkata',
			eventType: 'normal_event',
			attendeeEmails: '',
			location: '',
			description: '',
			attachmentIds: '',
			reminderItems: {},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/events', {
			title: 'Town Hall',
			start_time: futureDateTimeStartMs,
			end_time: futureDateTimeEndMs,
			timezone: 'Asia/Kolkata',
			calendar_id: 'cal_123',
			type: 'normal_event',
		});
	});

	it('should place the IANA timezone notice directly after the structured timezone field', () => {
		const timezoneIndex = create.description.findIndex((property) => property.name === 'timezone');
		const timezoneNoticeIndex = create.description.findIndex(
			(property) => property.name === 'timezoneNotice',
		);

		expect(timezoneIndex).toBeGreaterThanOrEqual(0);
		expect(timezoneNoticeIndex).toBe(timezoneIndex + 1);
		expect(create.description[timezoneNoticeIndex]?.type).toBe('notice');
		expect(create.description[timezoneNoticeIndex]?.displayName).toContain(
			'Open IANA timezone list',
		);
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext({
			calendarId: 'cal_123',
			inputMode: 'raw',
			eventDefinition: {
				title: 'Town Hall',
				start_time: futureStartTimeMs,
				end_time: futureEndTimeMs,
				timezone: 'Asia/Kolkata',
			},
		});
		const requiredCreateScopes = getRequiredScopesForOperationOrThrow('events', 'create');
		const grantedScopes = SCOPES.EVENTS_GET_CALENDARS;
		const grantedScopeList = grantedScopes.split(',');
		const firstMissingScope = requiredCreateScopes.find(
			(scope) => !grantedScopeList.includes(scope),
		);

		let thrownError: unknown;
		try {
			await create.execute.call(context, items, grantedScopes);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'unknown',
			operation: 'unknown',
			requiredScopes: [firstMissingScope],
			missingScopes: [firstMissingScope],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should return a recoverable validation payload when continueOnFail is enabled', async () => {
		const context = createContext(
			{
				calendarId: 'cal_123',
				inputMode: 'raw',
				eventDefinition: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
					attachments: [{ id: 'att_1' }],
				},
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
				calendar_id: 'cal_123',
				reason: 'INVALID_ATTACHMENTS',
			}),
		);
	});

	it('should return a recoverable validation payload when start_time is in the past', async () => {
		const context = createContext(
			{
				calendarId: 'cal_123',
				inputMode: 'raw',
				eventDefinition: {
					title: 'Town Hall',
					start_time: pastStartTimeMs,
					end_time: pastEndTimeMs,
					timezone: 'Asia/Kolkata',
				},
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
				calendar_id: 'cal_123',
				reason: 'INVALID_EVENT_SCHEDULE',
				message: 'start_time must be in the future',
				hint: 'Provide a title, a valid timezone, future start and end times, and an end time that is later than the start time.',
			}),
		);
	});

	it('should allow past-dated create requests when future-date validation is disabled', async () => {
		const context = createContext({
			calendarId: 'cal_123',
			requireFutureDates: false,
			inputMode: 'raw',
			eventDefinition: {
				title: 'Past Event Import',
				start_time: pastStartTimeMs,
				end_time: pastEndTimeMs,
				timezone: 'Asia/Kolkata',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'event_1' }] });

		await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/events', {
			title: 'Past Event Import',
			start_time: pastStartTimeMs,
			end_time: pastEndTimeMs,
			timezone: 'Asia/Kolkata',
			calendar_id: 'cal_123',
		});
	});

	it('should return a recoverable validation payload for an invalid input mode', async () => {
		const context = createContext(
			{ calendarId: 'cal_123', inputMode: 'invalid-mode' },
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

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
				calendarId: 'cal_123',
				inputMode: 'structured',
				startDateTime: 'not-a-date',
				endDateTime: futureEndTimeString,
				title: 'Town Hall',
				timezone: 'Asia/Kolkata',
				eventType: 'normal_event',
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

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
				calendarId: 'cal_123',
				inputMode: 'raw',
				eventDefinition: {
					title: 'Town Hall',
					start_time: '2026-03-08T02:30:00',
					end_time: '2026-03-08T03:30:00',
					timezone: 'America/New_York',
				},
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
				calendar_id: 'cal_123',
				reason: 'INVALID_EVENT_SCHEDULE',
				message: 'start_time must match the provided timezone when no UTC offset is supplied',
			}),
		);
	});

	it('should return a recoverable API payload in AI Error Mode', async () => {
		const context = createContext(
			{
				calendarId: 'cal_123',
				inputMode: 'structured',
				startDateTime: futureStartTimeString,
				endDateTime: futureEndTimeString,
				title: 'Town Hall',
				timezone: 'Asia/Kolkata',
				eventType: 'normal_event',
				attendeeEmails: '',
				location: '',
				description: '',
				attachmentIds: '',
				reminderItems: {},
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'calendar unavailable',
		});

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
				calendar_id: 'cal_123',
				status_code: 400,
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should return a recoverable validation payload when required calendar ID is missing', async () => {
		const context = createContext(
			{
				calendarId: '',
				inputMode: 'raw',
				eventDefinition: {
					title: 'Town Hall',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				},
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'create',
				reason: 'INVALID_CALENDAR_ID',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the field list', () => {
		expect(create.description[create.description.length - 2]?.name).toBe('createEventDocsNotice');
		expect(create.description[create.description.length - 1]?.name).toBe(
			'createEventAiToolGuideNotice',
		);
	});
});
