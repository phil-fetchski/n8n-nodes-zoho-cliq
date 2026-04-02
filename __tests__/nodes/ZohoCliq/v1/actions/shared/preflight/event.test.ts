import type { IExecuteFunctions } from 'n8n-workflow';

import {
	EVENT_LOOKUP_NOT_FOUND_ERROR_CODE,
	extractEventDetailsFromLookupResponse,
	lookupEventExhaustively,
	runEventLookupPreflightGate,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/event';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../../scopeTestScopes';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight event lookups', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions =>
		({
			getNodeParameter: jest.fn((name: string) => {
				if (name === 'enableAiErrorMode') {
					return values.enableAiErrorMode ?? false;
				}

				return undefined;
			}),
			continueOnFail: values.continueOnFail ? jest.fn(() => true) : undefined,
			getNode: jest.fn(() => ({
				name: 'Zoho Cliq',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: values.enableAiErrorMode ?? false },
			})),
		}) as unknown as IExecuteFunctions;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should skip event lookup preflight when recoverable mode is disabled', async () => {
		await expect(
			runEventLookupPreflightGate(createContext(), 0, SCOPES.EVENTS_CORE, 'evt_123', 'cal_123'),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should fall back to an empty accepted-scope list when the event lookup registry entry is unavailable', async () => {
		jest.resetModules();
		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry', () => ({
			listAcceptedScopesForOperation: jest.fn(() => undefined),
		}));

		let isolatedRunEventLookupPreflightGate!: typeof runEventLookupPreflightGate;
		await jest.isolateModulesAsync(async () => {
			({ runEventLookupPreflightGate: isolatedRunEventLookupPreflightGate } =
				await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/event'));
		});

		await expect(
			isolatedRunEventLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.EVENTS_CORE,
				'evt_123',
				'cal_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();

		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry');
		jest.resetModules();
	});

	it('should validate event lookup preflight when the event exists', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: { id: 'evt_123', edit_tag: '1738933200000' },
		});

		await expect(
			runEventLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.EVENTS_CORE,
				'evt_123',
				'cal_123',
				{ recurrenceId: '20260210T050000Z' },
			),
		).resolves.toEqual({
			status: 'validated',
			entity: {
				data: { id: 'evt_123', edit_tag: '1738933200000' },
			},
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/events/evt_123',
			undefined,
			{ calendar_id: 'cal_123', recurrence_id: '20260210T050000Z' },
		);
	});

	it('should return undefined when extracting event details from a non-object lookup response', () => {
		expect(extractEventDetailsFromLookupResponse(null)).toBeUndefined();
	});

	it('should extract the first event details object from an array-backed lookup response', () => {
		expect(
			extractEventDetailsFromLookupResponse({
				data: [{ id: 'evt_123', title: 'Town Hall' }],
			}),
		).toEqual({
			id: 'evt_123',
			title: 'Town Hall',
		});
	});

	it('should mark an event lookup as missing when the response identifies a different canonical event ID', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: { id: 'evt_actual' },
		});

		await expect(
			lookupEventExhaustively(createContext({ continueOnFail: true }), 0, {
				eventId: 'evt_requested',
				calendarId: 'cal_123',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Event Details returned a response, but it did not identify "evt_requested" as one of the canonical event identifiers for calendar "cal_123".',
		});
	});

	it('should mark an event lookup as missing when the API returns a non-object response body', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce([] as unknown as Record<string, never>);

		await expect(
			lookupEventExhaustively(createContext({ continueOnFail: true }), 0, {
				eventId: 'evt_missing',
				calendarId: 'cal_123',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Event Details returned a non-object response for "evt_missing" in calendar "cal_123".',
		});
	});

	it('should normalize authoritative event lookup misses into EVENT_NOT_FOUND', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'This event is not available or has been deleted.',
		});

		await expect(
			runEventLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.EVENTS_CORE,
				'evt_missing',
				'cal_123',
			),
		).rejects.toMatchObject({
			code: EVENT_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: 'No event found for Event ID "evt_missing" in Calendar ID "cal_123".',
		});
	});

	it('should honor custom field labels and missing contracts for shared event lookup errors', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'This event is not available or has been deleted.',
		});

		await expect(
			runEventLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.EVENTS_CORE,
				'evt_missing',
				'cal_123',
				{
					fieldLabel: 'Event Target',
					missing: {
						code: 'CUSTOM_EVENT_NOT_FOUND',
						message: 'Custom event lookup failed.',
						hint: 'Use a valid event target.',
					},
				},
			),
		).rejects.toMatchObject({
			code: 'CUSTOM_EVENT_NOT_FOUND',
			message: 'Custom event lookup failed.',
		});
	});

	it('should rethrow inconclusive event lookup failures from the shared preflight lookup', async () => {
		const error = new Error('temporary event lookup issue');
		mockZohoCliqApiRequest.mockRejectedValueOnce(error);

		await expect(
			lookupEventExhaustively(createContext({ continueOnFail: true }), 0, {
				eventId: 'evt_500',
				calendarId: 'cal_123',
			}),
		).rejects.toBe(error);
	});
});
