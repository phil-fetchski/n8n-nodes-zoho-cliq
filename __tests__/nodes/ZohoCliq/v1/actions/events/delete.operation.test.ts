import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/events/delete.operation';
import { getRequiredScopesForOperationOrThrow } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			eventId?: string;
			calendarId?: string;
			includeEnhancedOutput?: boolean;
		} = {},
		options: {
			continueOnFail?: boolean;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const { eventId = 'evt_123@zoho.com', calendarId = 'cal_123' } = values;
		const hasIncludeEnhancedOutput = 'includeEnhancedOutput' in values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'eventId') return eventId;
				if (name === 'calendarId') return calendarId;
				if (name === 'includeEnhancedOutput' && hasIncludeEnhancedOutput) {
					return values.includeEnhancedOutput;
				}
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

	it('should return enhanced output by default for delete', async () => {
		const context = createContext({});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { edit_tag: '1738933200000' } })
			.mockResolvedValueOnce('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'events',
			operation: 'delete',
			event_id: 'evt_123@zoho.com',
			calendar_id: 'cal_123',
			edit_tag: 1738933200000,
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123' },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123', edit_tag: 1738933200000 },
		);
	});

	it('should return enhanced output when enabled', async () => {
		const context = createContext({ includeEnhancedOutput: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { edit_tag: '1738933200000' } })
			.mockResolvedValueOnce('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'events',
			operation: 'delete',
			event_id: 'evt_123@zoho.com',
			calendar_id: 'cal_123',
			edit_tag: 1738933200000,
			data: '',
		});
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled and enhanced output is off', async () => {
		const context = createContext({ includeEnhancedOutput: false });
		const firstMissingScope = getRequiredScopesForOperationOrThrow('events', 'delete').find(
			(scope) => !SCOPES.EVENTS_GET_CALENDARS.split(',').includes(scope),
		);

		let thrownError: unknown;
		try {
			await del.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);
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

	it('should return a recoverable validation error when continueOnFail is enabled and event details are missing', async () => {
		const context = createContext({}, { continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'MISSING_EVENT_DETAILS',
			}),
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled and edit_tag is missing', async () => {
		const context = createContext({}, { continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [{}] });

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'MISSING_EDIT_TAG',
			}),
		);
	});

	it('should reuse the validated preflight payload for edit_tag extraction in recoverable mode', async () => {
		const context = createContext({}, { continueOnFail: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'evt_123@zoho.com', edit_tag: '1738933200000' } })
			.mockResolvedValueOnce('' as unknown as Record<string, never>);

		await del.execute.call(context, items, SCOPES.EVENTS_CORE);

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
			'DELETE',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123', edit_tag: 1738933200000 },
		);
	});

	it('should keep post-preflight delete failures generic after a successful event lookup', async () => {
		const context = createContext({}, { continueOnFail: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'evt_123@zoho.com', edit_tag: '1738933200000' } })
			.mockRejectedValueOnce({
				statusCode: 500,
				message: 'Internal server error',
			})
			.mockRejectedValueOnce({
				statusCode: 500,
				message: 'Internal server error',
			});

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
	});

	it('should return enhanced recoverable output on API errors when enabled', async () => {
		const context = createContext({ includeEnhancedOutput: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { edit_tag: '1738933200000' } })
			.mockRejectedValueOnce({
				statusCode: 400,
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			})
			.mockRejectedValueOnce({
				statusCode: 400,
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			});

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				edit_tag: 1738933200000,
				status_code: 400,
			}),
		);
	});

	it('should retry delete with body payload when the query form fails', async () => {
		const context = createContext({ includeEnhancedOutput: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { edit_tag: '1738933200000' } })
			.mockRejectedValueOnce({
				statusCode: 400,
				message: 'Bad request - please check your parameters',
			})
			.mockResolvedValueOnce('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/events/evt_123%40zoho.com',
			undefined,
			{ calendar_id: 'cal_123', edit_tag: 1738933200000 },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			3,
			'DELETE',
			'/api/v2/events/evt_123%40zoho.com',
			{ calendar_id: 'cal_123', edit_tag: 1738933200000 },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				deleted: true,
				success: true,
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				edit_tag: 1738933200000,
				data: '',
			}),
		);
	});

	it('should return enhanced scope payload details when required OAuth scopes are missing', async () => {
		const context = createContext({ includeEnhancedOutput: true });
		const firstMissingScope = getRequiredScopesForOperationOrThrow('events', 'delete').find(
			(scope) => !SCOPES.EVENTS_GET_CALENDARS.split(',').includes(scope),
		);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'unknown',
				operation: 'unknown',
				requiredScopes: [firstMissingScope],
				missingScopes: [firstMissingScope],
			}),
		);
	});

	it('should return enhanced validation output without context IDs when event validation fails first', async () => {
		const context = createContext({
			eventId: '   ',
			includeEnhancedOutput: true,
		});

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				reason: 'INVALID_EVENT_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('event_id');
		expect(result[0].json).not.toHaveProperty('calendar_id');
		expect(result[0].json).not.toHaveProperty('edit_tag');
	});

	it('should return enhanced output when the transport rejects with no error object', async () => {
		const context = createContext({ includeEnhancedOutput: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { edit_tag: '1738933200000' } })
			.mockRejectedValueOnce(undefined)
			.mockRejectedValueOnce(undefined);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				edit_tag: 1738933200000,
				message: 'An unexpected issue occurred with the API request',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { edit_tag: '1738933200000' } })
			.mockRejectedValueOnce({
				statusCode: 500,
				message: 'Internal server error',
			})
			.mockRejectedValueOnce({
				statusCode: 500,
				message: 'Internal server error',
			});

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
	});

	it('should keep property display options merged with resource and operation filters', () => {
		const eventIdField = del.description.find((property) => property.name === 'eventId');
		expect(eventIdField?.displayOptions?.show?.resource).toEqual(['event']);
		expect(eventIdField?.displayOptions?.show?.operation).toEqual(['delete']);
	});

	it('should return a non-enhanced recoverable error with INVALID_EVENT_ID when event validation fails', async () => {
		const context = createContext(
			{ eventId: '   ', includeEnhancedOutput: false },
			{ continueOnFail: true },
		);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				reason: 'INVALID_EVENT_ID',
				hint: 'Use the exact event ID returned by Zoho Cliq.',
			}),
		);
	});

	it('should return a non-enhanced recoverable error with INVALID_CALENDAR_ID when calendar validation fails', async () => {
		const context = createContext(
			{ eventId: 'evt_123@zoho.com', calendarId: '', includeEnhancedOutput: false },
			{ continueOnFail: true },
		);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				reason: 'INVALID_CALENDAR_ID',
				hint: 'Use the exact calendar ID that owns the event.',
			}),
		);
	});

	it('should return a non-enhanced recoverable error with MISSING_EVENT_DETAILS when event details are empty', async () => {
		const context = createContext({ includeEnhancedOutput: false }, { continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'MISSING_EVENT_DETAILS',
				hint: 'Verify that Get Event Details returns the current event for the supplied calendar_id.',
			}),
		);
	});

	it('should return a non-enhanced recoverable error with MISSING_EDIT_TAG when edit_tag is absent', async () => {
		const context = createContext({ includeEnhancedOutput: false }, { continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [{}] });

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'delete',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'MISSING_EDIT_TAG',
				hint: 'Verify that Get Event Details returns the latest edit_tag for this event.',
			}),
		);
	});

	it('should return raw response when includeEnhancedOutput is false', async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { edit_tag: '1738933200000' } })
			.mockResolvedValueOnce('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, SCOPES.EVENTS_CORE);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});
});
