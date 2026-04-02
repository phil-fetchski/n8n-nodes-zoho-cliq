/**
 * Simplify Output tests for Events operations:
 *   getCalendars, list, get, create, update
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import * as getCalendars from '../../../../../../nodes/ZohoCliq/v1/actions/events/getCalendars.operation';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/events/list.operation';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/events/get.operation';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/events/create.operation';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/events/update.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CALENDAR_RESPONSE = {
	id: '310935000000002003',
	name: 'User',
	timezone: 'Asia/Calcutta',
	isdefault: true,
	category: 'default_calendar',
	caltype: 'calendar',
	status: 'enabled',
	visibility: 'public',
	color: '#8cbf40',
	textcolor: '#ffffff',
	description: '',
	privilege: 'owner',
	type: 'personal',
	uid: '310935000000002003',
	canSendMail: true,
	owner: 'user@example.com',
};

const SIMPLIFIED_CALENDAR = {
	id: '310935000000002003',
	name: 'User',
	timezone: 'Asia/Calcutta',
	isdefault: true,
	category: 'default_calendar',
	caltype: 'calendar',
	status: 'enabled',
	visibility: 'public',
	color: '#8cbf40',
	owner: 'user@example.com',
};

const MOCK_EVENT_RESPONSE = {
	id: '427812df9891223aca537f0e8e7ad2a7c@zoho.com',
	calendar_id: 'NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ==',
	title: 'Zylker Marketing Forum',
	type: 'video_conference',
	start_time: 1738938600000,
	end_time: 1738942200000,
	timezone: 'Asia/Kolkata',
	isallday: false,
	role: 'organizer',
	location: 'Conference Room A',
	description: 'Quarterly marketing strategy review',
	organizer: {
		name: 'Example User',
		email: 'user@example.com',
	},
	creator: { name: 'Example User', email: 'user@example.com' },
	attendees: [],
	edit_tag: '1738835150914',
	entity_type: 'event',
	meeting_link: 'https://cliq.zoho.com/meeting/1CI1MFX2BATW',
	meeting_details: {},
};

const SIMPLIFIED_EVENT = {
	id: '427812df9891223aca537f0e8e7ad2a7c@zoho.com',
	title: 'Zylker Marketing Forum',
	type: 'video_conference',
	start_time: 1738938600000,
	end_time: 1738942200000,
	timezone: 'Asia/Kolkata',
	isallday: false,
	role: 'organizer',
	organizer_name: 'Example User',
	organizer_email: 'user@example.com',
};

const oneHourMs = 60 * 60 * 1000;
const oneDayMs = 24 * 60 * 60 * 1000;
const testNowMs = Date.now();
const futureStartTimeMs = testNowMs + 7 * oneDayMs;
const futureEndTimeMs = futureStartTimeMs + oneHourMs;
const frozenTestNow = new Date(testNowMs);

const items: INodeExecutionData[] = [{ json: {} }];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGetCalendarsContext(
	values: {
		includeHiddenCalendars?: boolean;
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const {
		includeHiddenCalendars = false,
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
	} = values;
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'includeHiddenCalendars') return includeHiddenCalendars;
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return false;
			return fallback;
		}),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createListContext(
	values: {
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const { simplify = false, simplifyMode = 'simplified', simplifyFields = [] } = values;
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'fromDateTime') return '';
			if (name === 'toDateTime') return '';
			if (name === 'includeDisabledCalendar') return false;
			if (name === 'includeHiddenCalendar') return false;
			if (name === 'ignoreDeclinedEvents') return false;
			if (name === 'search') return '';
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return false;
			return fallback;
		}),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
		getTimezone: jest.fn(() => 'America/New_York'),
	} as unknown as IExecuteFunctions;
}

function createGetContext(
	values: {
		eventId?: string;
		calendarId?: string;
		recurrenceId?: string;
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const {
		eventId = 'evt_123@zoho.com',
		calendarId = 'cal_123',
		recurrenceId = '',
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
	} = values;
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'eventId') return eventId;
			if (name === 'calendarId') return calendarId;
			if (name === 'recurrenceId') return recurrenceId;
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return false;
			return fallback;
		}),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createCreateContext(
	values: {
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const { simplify = false, simplifyMode = 'simplified', simplifyFields = [] } = values;
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'calendarId') return 'cal_123';
			if (name === 'inputMode') return 'raw';
			if (name === 'requireFutureDates') return false;
			if (name === 'eventDefinition')
				return JSON.stringify({
					title: 'Test Event',
					start_time: futureStartTimeMs,
					end_time: futureEndTimeMs,
					timezone: 'Asia/Kolkata',
				});
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return false;
			return fallback;
		}),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createUpdateContext(values: Record<string, unknown> = {}): IExecuteFunctions {
	const defaults: Record<string, unknown> = {
		eventId: 'evt_123@zoho.com',
		calendarId: 'cal_123',
		inputMode: 'raw',
		requireFutureDates: false,
		eventUpdates: JSON.stringify({
			title: 'Updated Event',
			start_time: futureStartTimeMs,
			end_time: futureEndTimeMs,
			timezone: 'Asia/Kolkata',
			type: 'normal_event',
		}),
		simplify: false,
		simplifyMode: 'simplified',
		simplifyFields: [],
	};
	const merged = { ...defaults, ...values };
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) =>
			name in merged ? merged[name] : fallback,
		),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

// ---------------------------------------------------------------------------
// Description tests
// ---------------------------------------------------------------------------

describe('Events Simplify — description parameters', () => {
	const simplifyParamNames = ['simplify', 'simplifyMode', 'simplifyFields'];

	it.each([
		['getCalendars', getCalendars.description],
		['list', list.description],
		['get', get.description],
		['create', create.description],
		['update', update.description],
	])('%s should expose simplify, simplifyMode, simplifyFields', (_op, desc) => {
		const names = desc.map((d) => d.name);
		for (const param of simplifyParamNames) {
			expect(names).toContain(param);
		}
	});

	it('update should NOT have includeEnhancedOutput in its description', () => {
		const names = update.description.map((d) => d.name);
		expect(names).not.toContain('includeEnhancedOutput');
	});
});

// ---------------------------------------------------------------------------
// getCalendars.operation — Simplify (list mode, data array key)
// ---------------------------------------------------------------------------

describe('Events getCalendars — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: [MOCK_CALENDAR_RESPONSE],
		});
	});

	it('should return full response wrapper in raw mode (simplify=false)', async () => {
		const ctx = createGetCalendarsContext({ simplify: false });
		const result = await getCalendars.execute.call(ctx, items, SCOPES.EVENTS_GET_CALENDARS);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [MOCK_CALENDAR_RESPONSE] });
	});

	it('should return full response wrapper in raw mode (simplify=true, mode=raw)', async () => {
		const ctx = createGetCalendarsContext({ simplify: true, simplifyMode: 'raw' });
		const result = await getCalendars.execute.call(ctx, items, SCOPES.EVENTS_GET_CALENDARS);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [MOCK_CALENDAR_RESPONSE] });
	});

	it('should return individual simplified calendar items', async () => {
		const ctx = createGetCalendarsContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await getCalendars.execute.call(ctx, items, SCOPES.EVENTS_GET_CALENDARS);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(SIMPLIFIED_CALENDAR);
	});

	it('should return id + selected fields in selectedFields mode', async () => {
		const ctx = createGetCalendarsContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['name', 'timezone'],
		});
		const result = await getCalendars.execute.call(ctx, items, SCOPES.EVENTS_GET_CALENDARS);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			id: '310935000000002003',
			name: 'User',
			timezone: 'Asia/Calcutta',
		});
	});
});

// ---------------------------------------------------------------------------
// list.operation — Simplify (list mode, data array key)
// ---------------------------------------------------------------------------

describe('Events list — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: [MOCK_EVENT_RESPONSE],
		});
	});

	it('should return full response wrapper in raw mode (simplify=false)', async () => {
		const ctx = createListContext({ simplify: false });
		const result = await list.execute.call(ctx, items, SCOPES.EVENTS_LIST);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [MOCK_EVENT_RESPONSE] });
	});

	it('should return full response wrapper in raw mode (simplify=true, mode=raw)', async () => {
		const ctx = createListContext({ simplify: true, simplifyMode: 'raw' });
		const result = await list.execute.call(ctx, items, SCOPES.EVENTS_LIST);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [MOCK_EVENT_RESPONSE] });
	});

	it('should return individual simplified event items', async () => {
		const ctx = createListContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await list.execute.call(ctx, items, SCOPES.EVENTS_LIST);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(SIMPLIFIED_EVENT);
	});

	it('should return id + selected fields in selectedFields mode', async () => {
		const ctx = createListContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['title', 'type'],
		});
		const result = await list.execute.call(ctx, items, SCOPES.EVENTS_LIST);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			id: '427812df9891223aca537f0e8e7ad2a7c@zoho.com',
			title: 'Zylker Marketing Forum',
			type: 'video_conference',
		});
	});
});

// ---------------------------------------------------------------------------
// get.operation — Simplify (single mode, data unwrap key)
// ---------------------------------------------------------------------------

describe('Events get — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: MOCK_EVENT_RESPONSE,
		});
	});

	it('should return full response wrapper in raw mode (simplify=false)', async () => {
		const ctx = createGetContext({ simplify: false });
		const result = await get.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: MOCK_EVENT_RESPONSE });
	});

	it('should return full response wrapper in raw mode (simplify=true, mode=raw)', async () => {
		const ctx = createGetContext({ simplify: true, simplifyMode: 'raw' });
		const result = await get.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: MOCK_EVENT_RESPONSE });
	});

	it('should return only simplified keys when simplified mode is active', async () => {
		const ctx = createGetContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await get.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(SIMPLIFIED_EVENT);
	});

	it('should return id + selected fields in selectedFields mode', async () => {
		const ctx = createGetContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['title', 'calendar_id'],
		});
		const result = await get.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			id: '427812df9891223aca537f0e8e7ad2a7c@zoho.com',
			title: 'Zylker Marketing Forum',
			calendar_id: 'NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ==',
		});
	});
});

// ---------------------------------------------------------------------------
// create.operation — Simplify (list mode, data array key)
// ---------------------------------------------------------------------------

describe('Events create — Simplify', () => {
	beforeAll(() => {
		jest.useFakeTimers();
		jest.setSystemTime(frozenTestNow);
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: [MOCK_EVENT_RESPONSE],
		});
	});

	it('should return full response wrapper in raw mode (simplify=false)', async () => {
		const ctx = createCreateContext({ simplify: false });
		const result = await create.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [MOCK_EVENT_RESPONSE] });
	});

	it('should return full response wrapper in raw mode (simplify=true, mode=raw)', async () => {
		const ctx = createCreateContext({ simplify: true, simplifyMode: 'raw' });
		const result = await create.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [MOCK_EVENT_RESPONSE] });
	});

	it('should return individual simplified event items', async () => {
		const ctx = createCreateContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await create.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(SIMPLIFIED_EVENT);
	});

	it('should return id + selected fields in selectedFields mode', async () => {
		const ctx = createCreateContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['title', 'calendar_id'],
		});
		const result = await create.execute.call(ctx, items, SCOPES.EVENTS_CORE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			id: '427812df9891223aca537f0e8e7ad2a7c@zoho.com',
			title: 'Zylker Marketing Forum',
			calendar_id: 'NDg4MTc3NTAwMDAwMDAwOTAwM3wzMzMyY2NjMQ==',
		});
	});
});

// ---------------------------------------------------------------------------
// update.operation — Simplify (fold-in: always includes metadata)
// ---------------------------------------------------------------------------

describe('Events update — Simplify', () => {
	beforeAll(() => {
		jest.useFakeTimers();
		jest.setSystemTime(frozenTestNow);
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: [MOCK_EVENT_RESPONSE],
		});
	});

	it('should return { metadata, ...fullResponse } in raw mode (simplify=false)', async () => {
		const ctx = createUpdateContext({ simplify: false });
		const result = await update.execute.call(ctx, items, SCOPES.EVENTS_UPDATE);
		expect(result).toHaveLength(1);
		const json = result[0].json;
		expect(json.updated).toBe(true);
		expect(json.success).toBe(true);
		expect(json.operation).toBe('update_event');
		expect(json.event_id).toBe('evt_123@zoho.com');
		expect(json.calendar_id).toBe('cal_123');
		// Full response wrapper is present
		expect(json.data).toEqual([MOCK_EVENT_RESPONSE]);
	});

	it('should return { metadata, ...fullResponse } in raw mode (simplify=true, mode=raw)', async () => {
		const ctx = createUpdateContext({ simplify: true, simplifyMode: 'raw' });
		const result = await update.execute.call(ctx, items, SCOPES.EVENTS_UPDATE);
		expect(result).toHaveLength(1);
		const json = result[0].json;
		expect(json.updated).toBe(true);
		expect(json.success).toBe(true);
		expect(json.operation).toBe('update_event');
		expect(json.event_id).toBe('evt_123@zoho.com');
		expect(json.calendar_id).toBe('cal_123');
		expect(json.data).toEqual([MOCK_EVENT_RESPONSE]);
	});

	it('should return metadata + simplified fields in simplified mode', async () => {
		const ctx = createUpdateContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await update.execute.call(ctx, items, SCOPES.EVENTS_UPDATE);
		expect(result).toHaveLength(1);
		const json = result[0].json;
		expect(json.updated).toBe(true);
		expect(json.success).toBe(true);
		expect(json.operation).toBe('update_event');
		expect(json.event_id).toBe('evt_123@zoho.com');
		expect(json.calendar_id).toBe('cal_123');
		expect(json.id).toBe(SIMPLIFIED_EVENT.id);
		expect(json.title).toBe(SIMPLIFIED_EVENT.title);
		expect(json.organizer_name).toBe(SIMPLIFIED_EVENT.organizer_name);
		// Non-simplified keys should be absent
		expect(json).not.toHaveProperty('location');
		expect(json).not.toHaveProperty('description');
		expect(json).not.toHaveProperty('edit_tag');
	});

	it('should return metadata + selected fields in selectedFields mode', async () => {
		const ctx = createUpdateContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['title', 'type'],
		});
		const result = await update.execute.call(ctx, items, SCOPES.EVENTS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			updated: true,
			success: true,
			operation: 'update_event',
			event_id: 'evt_123@zoho.com',
			calendar_id: 'cal_123',
			id: '427812df9891223aca537f0e8e7ad2a7c@zoho.com',
			title: 'Zylker Marketing Forum',
			type: 'video_conference',
		});
	});

	it('should return metadata only when API returns empty response', async () => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue('');
		const ctx = createUpdateContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await update.execute.call(ctx, items, SCOPES.EVENTS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			updated: true,
			success: true,
			operation: 'update_event',
			event_id: 'evt_123@zoho.com',
			calendar_id: 'cal_123',
		});
	});

	it('should return metadata only when API returns empty data array in simplified mode', async () => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ data: [] });
		const ctx = createUpdateContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await update.execute.call(ctx, items, SCOPES.EVENTS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			updated: true,
			success: true,
			operation: 'update_event',
			event_id: 'evt_123@zoho.com',
			calendar_id: 'cal_123',
		});
	});
});
