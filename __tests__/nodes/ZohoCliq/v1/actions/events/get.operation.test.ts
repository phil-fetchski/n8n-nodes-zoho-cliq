import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/events/get.operation';
import { getRequiredScopesForOperationOrThrow } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Get Event Details Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			eventId?: string;
			calendarId?: string;
			recurrenceId?: string;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { eventId = 'evt_123@zoho.com', calendarId = 'cal_123', recurrenceId = '' } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'eventId') return eventId;
				if (name === 'calendarId') return calendarId;
				if (name === 'recurrenceId') return recurrenceId;
				if (name === 'simplify') return false;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
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

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should get event details with calendar ID', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{}] });

		await get.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123' },
		);
	});

	it('should include recurrence ID when provided', async () => {
		const context = createContext({ recurrenceId: '20250210T050000Z' });
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{}] });

		await get.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123', recurrence_id: '20250210T050000Z' },
		);
	});

	it('should reuse the validated shared preflight payload instead of issuing a second get request', async () => {
		const context = createContext({}, { continueOnFail: true });
		const lookupResponse = {
			data: { id: 'evt_123@zoho.com', title: 'Town Hall' },
		};
		mockZohoCliqApiRequest.mockResolvedValueOnce(lookupResponse);

		const result = await get.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123' },
		);
		expect(result[0].json).toEqual(lookupResponse);
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const firstMissingScope = getRequiredScopesForOperationOrThrow('events', 'get').find(
			(scope) => !SCOPES.EVENTS_GET_CALENDARS.split(',').includes(scope),
		);

		let thrownError: unknown;
		try {
			await get.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);
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

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ recurrenceId: 'bad recurrence id' }, { continueOnFail: true });

		const result = await get.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'get',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'INVALID_RECURRENCE_ID',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 500,
			message: 'Internal server error',
		});

		const result = await get.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'get',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
	});

	it('should map deleted-or-unavailable lookup responses to the shared event preflight miss contract', async () => {
		const context = createContext({}, { continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'This event is not available or has been deleted.',
		});

		const result = await get.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'get',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'EVENT_NOT_FOUND',
				message: 'No event found for Event ID "evt_123@zoho.com" in Calendar ID "cal_123".',
			}),
		);
	});

	it('should include recurrence context in recoverable API errors when provided', async () => {
		const context = createContext({ recurrenceId: '20250210T050000Z' }, { continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 500,
			message: 'Internal server error',
		});

		const result = await get.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'get',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				recurrence_id: '20250210T050000Z',
				status_code: 500,
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(get.description[get.description.length - 2]?.name).toBe('getEventDetailsDocsNotice');
		expect(get.description[get.description.length - 1]?.name).toBe(
			'getEventDetailsAiToolGuideNotice',
		);
	});
});
