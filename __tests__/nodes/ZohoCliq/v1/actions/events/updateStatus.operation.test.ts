import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

import * as updateStatus from '../../../../../../nodes/ZohoCliq/v1/actions/events/updateStatus.operation';
import { getRequiredScopesForOperationOrThrow } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Update Status Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			eventId?: string;
			status?: string;
			calendarId?: string;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { eventId = 'evt_123@zoho.com', status = 'tentative', calendarId = '' } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'eventId') return eventId;
				if (name === 'status') return status;
				if (name === 'calendarId') return calendarId;
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

	it('should update event status', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ data: { message: 'Status Updated.' } });

		await updateStatus.execute.call(context, items, SCOPES.EVENTS_UPDATE_STATUS);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/events/evt_123%40zoho.com/statuses/tentative',
		);
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const firstMissingScope = getRequiredScopesForOperationOrThrow('events', 'updateStatus').find(
			(scope) => !SCOPES.EVENTS_GET_CALENDARS.split(',').includes(scope),
		);

		let thrownError: unknown;
		try {
			await updateStatus.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);
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
		const context = createContext({ status: 'invalid' }, { continueOnFail: true });

		const result = await updateStatus.execute.call(context, items, SCOPES.EVENTS_UPDATE_STATUS);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'updateStatus',
				event_id: 'evt_123@zoho.com',
				reason: 'INVALID_STATUS',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 403,
			message: 'Forbidden',
		});

		const result = await updateStatus.execute.call(context, items, SCOPES.EVENTS_UPDATE_STATUS);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'updateStatus',
				event_id: 'evt_123@zoho.com',
				status: 'tentative',
				status_code: 403,
				reason: 'FORBIDDEN',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return the shared event preflight miss contract when optional calendar ID proves the event is missing', async () => {
		const context = createContext({ calendarId: 'cal_123' }, { continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'This event is not available or has been deleted.',
		});

		const result = await updateStatus.execute.call(context, items, SCOPES.EVENTS_UPDATE_STATUS);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'updateStatus',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				reason: 'EVENT_NOT_FOUND',
				message: 'No event found for Event ID "evt_123@zoho.com" in Calendar ID "cal_123".',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should keep post-preflight update status failures generic after a successful event lookup', async () => {
		const context = createContext({ calendarId: 'cal_123' }, { continueOnFail: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'evt_123@zoho.com' } })
			.mockRejectedValueOnce({
				statusCode: 500,
				message: 'Internal server error',
			});

		const result = await updateStatus.execute.call(context, items, SCOPES.EVENTS_UPDATE_STATUS);

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
			'/api/v2/events/evt_123%40zoho.com/statuses/tentative',
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'updateStatus',
				event_id: 'evt_123@zoho.com',
				calendar_id: 'cal_123',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(updateStatus.description[updateStatus.description.length - 2]?.name).toBe(
			'updateEventStatusDocsNotice',
		);
		expect(updateStatus.description[updateStatus.description.length - 1]?.name).toBe(
			'updateEventStatusAiToolGuideNotice',
		);
	});
});
