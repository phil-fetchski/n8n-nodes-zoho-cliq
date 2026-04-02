import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

import * as getCalendars from '../../../../../../nodes/ZohoCliq/v1/actions/events/getCalendars.operation';
import { getRequiredScopesForOperationOrThrow } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Get Calendars Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			includeHiddenCalendars?: boolean;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { includeHiddenCalendars = false } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'includeHiddenCalendars') return includeHiddenCalendars;
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

	it('should get calendars without hidden calendars by default', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await getCalendars.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/calendars',
			undefined,
			undefined,
		);
	});

	it('should include hidden calendars when enabled', async () => {
		const context = createContext({ includeHiddenCalendars: true });
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await getCalendars.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/calendars', undefined, {
			include_hidden_calendars: true,
		});
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopesForOperationOrThrow('events', 'getCalendars')[0];

		let thrownError: unknown;
		try {
			await getCalendars.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const context = createContext({ includeHiddenCalendars: true }, { continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 500,
			message: 'Calendar service unavailable',
		});

		const result = await getCalendars.execute.call(context, items, SCOPES.EVENTS_GET_CALENDARS);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'getCalendars',
				include_hidden_calendars: true,
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(getCalendars.description[getCalendars.description.length - 2]?.name).toBe(
			'getEventCalendarsDocsNotice',
		);
		expect(getCalendars.description[getCalendars.description.length - 1]?.name).toBe(
			'getEventCalendarsAiToolGuideNotice',
		);
	});
});
