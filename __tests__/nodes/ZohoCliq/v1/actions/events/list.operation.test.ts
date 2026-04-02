import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import { SCOPES } from '../scopeTestScopes';

import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/events/list.operation';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import { getConditionalScopeRequirement } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Get Events Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
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
			getTimezone: jest.fn(() => 'America/New_York'),
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

	it('should get events with filters', async () => {
		const context = createContext({
			fromDateTime: '1738828560000',
			toDateTime: '1738832160000',
			includeDisabledCalendar: true,
			includeHiddenCalendar: true,
			ignoreDeclinedEvents: true,
			search: 'town hall',
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ id: 'event_1', title: 'Town Hall Planning' }],
		});

		await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/events', undefined, {
			from: 1738828560000,
			to: 1738832160000,
			include_disabled_calendar: true,
			include_hidden_calendar: true,
			ignore_declined_events: true,
			search: 'town hall',
		});
	});

	it('should locally filter fallback search results by title only when the first response is not an array payload', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'town',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { unsupported: true } })
			.mockResolvedValueOnce({
				data: [
					{
						id: 'event_title_match',
						title: 'Town Hall Planning',
						meta: {
							notes: [null, { done: true, estimateHours: 42, tags: ['ops', 'release'] }],
						},
					},
					{
						id: 'event_nested_only_match',
						title: 'Release Review',
						meta: { notes: [null, { done: false, summary: 'town follow-up' }] },
					},
				],
			});

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(result[0].json).toEqual({
			data: [
				{
					id: 'event_title_match',
					title: 'Town Hall Planning',
					meta: { notes: [null, { done: true, estimateHours: 42, tags: ['ops', 'release'] }] },
				},
			],
		});
	});

	it('should ignore fallback events without titles even when nested fields match the search', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'town',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { unsupported: true } })
			.mockResolvedValueOnce({
				data: [
					{
						id: 'event_missing_title',
						meta: { notes: [{ summary: 'town follow-up' }] },
					},
					{
						id: 'event_non_matching_title',
						title: 'Release Review',
						meta: { notes: [{ summary: 'town follow-up' }] },
					},
				],
			});

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(result[0].json).toEqual({ data: [] });
	});

	it('should return an empty filtered array when the fallback response has non-array data', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'town hall',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { unsupported: true } })
			.mockResolvedValueOnce({ data: { unsupported: true } });

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result[0].json).toEqual({ data: [] });
	});

	it('should fallback when the first search response is a primitive payload', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'town hall',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce('raw-response' as unknown as { data: [] })
			.mockResolvedValueOnce({ data: [{ id: 'event_1', title: 'Town Hall Planning' }] });

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(result[0].json).toEqual({ data: [{ id: 'event_1', title: 'Town Hall Planning' }] });
	});

	it('should ignore non-title nested values during local fallback filtering', async () => {
		const unsupportedToken = Symbol('skip-me');
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'supported',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { invalid: true } })
			.mockResolvedValueOnce({
				data: [
					{
						id: 'event_supported',
						title: 'Supported event',
						meta: {
							label: 'supported',
							unsupported: unsupportedToken,
						},
					},
				],
			});

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result[0].json).toEqual({
			data: [
				{
					id: 'event_supported',
					title: 'Supported event',
					meta: { label: 'supported', unsupported: unsupportedToken },
				},
			],
		});
	});

	it('should allow list without search when search scope is missing', async () => {
		const context = createContext({
			fromDateTime: '1738828560000',
			toDateTime: '1738832160000',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'event_1' }] });

		await expect(list.execute.call(context, items, SCOPES.EVENTS_CORE)).resolves.toBeDefined();
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/events', undefined, {
			from: 1738828560000,
			to: 1738832160000,
		});
	});

	it('should parse date-time picker inputs into milliseconds', async () => {
		const context = createContext({
			fromDateTime: '2026-02-24T10:00:00.000Z',
			toDateTime: '2026-02-24T11:00:00.000Z',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/events', undefined, {
			from: 1771927200000,
			to: 1771930800000,
		});
	});

	it('should parse offset-less date-time picker inputs using the workflow timezone', async () => {
		const context = createContext({
			fromDateTime: '2026-03-20T15:00:00',
			toDateTime: '2026-03-20T16:00:00',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/events', undefined, {
			from: Date.parse('2026-03-20T15:00:00-04:00'),
			to: Date.parse('2026-03-20T16:00:00-04:00'),
		});
	});

	it('should accept unix-millisecond expressions through the date-time fields', async () => {
		const context = createContext({
			fromDateTime: '1738828560000',
			toDateTime: '1738832160000',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/events', undefined, {
			from: 1738828560000,
			to: 1738832160000,
		});
	});

	it('should throw when search scope is missing and search is provided', async () => {
		const context = createContext({
			fromDateTime: '1738828560000',
			toDateTime: '1738832160000',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'town hall',
		});
		const searchScopes = getConditionalScopeRequirement(
			'events',
			'list',
			'searchParamPresent',
		)?.requiredScopes;

		let thrownError: unknown;
		try {
			await list.execute.call(context, items, SCOPES.EVENTS_CORE);
		} catch (error) {
			thrownError = error;
		}

		expect(searchScopes).toBeDefined();
		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'unknown',
			operation: 'unknown',
			requiredScopes: searchScopes,
			missingScopes: searchScopes,
			hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
		});
	});

	it('should throw when from/to range exceeds 31 days', async () => {
		const context = createContext({
			fromDateTime: '1735689600000',
			toDateTime: '1738454400001',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});

		await expect(list.execute.call(context, items, SCOPES.EVENTS_LIST)).rejects.toThrow(
			'The maximum difference between From and To is 31 days',
		);
	});

	it('should return a recoverable validation payload when continueOnFail is enabled', async () => {
		const context = createContext(
			{
				fromDateTime: '1738832160000',
				toDateTime: '1738832160000',
				includeDisabledCalendar: false,
				includeHiddenCalendar: false,
				ignoreDeclinedEvents: false,
				search: '',
			},
			{ continueOnFail: true },
		);

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'list',
				reason: 'INVALID_TIME_RANGE',
			}),
		);
	});

	it('should return a recoverable validation payload for an invalid date-time expression', async () => {
		const context = createContext(
			{
				fromDateTime: 'not-a-real-datetime',
				toDateTime: '',
				includeDisabledCalendar: false,
				includeHiddenCalendar: false,
				ignoreDeclinedEvents: false,
				search: '',
			},
			{ continueOnFail: true },
		);

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'list',
			}),
		);
		expect(result[0].json.message).toContain(
			'From must be a valid datetime or Unix timestamp in milliseconds',
		);
	});

	it('should return a recoverable validation payload when a date-time expression resolves to an invalid type', async () => {
		const context = createContext(
			{
				fromDateTime: { unexpected: true },
				toDateTime: '',
				includeDisabledCalendar: false,
				includeHiddenCalendar: false,
				ignoreDeclinedEvents: false,
				search: '',
			},
			{ continueOnFail: true },
		);

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'list',
			}),
		);
		expect(result[0].json.message).toContain(
			'From must be a datetime string or Unix timestamp in milliseconds',
		);
	});

	it('should allow search when conditional search scope configuration is unavailable', async () => {
		const conditionalSpy = jest
			.spyOn(scopeRegistry, 'getConditionalScopeRequirement')
			.mockReturnValue(undefined);
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'query',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/events', undefined, {
			search: 'query',
		});
		conditionalSpy.mockRestore();
	});

	it('should build docs notice without conditional search scope text when config is unavailable at module load', async () => {
		jest.resetModules();
		await jest.isolateModulesAsync(async () => {
			const isolatedScopeRegistry =
				await import('../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry');
			jest
				.spyOn(isolatedScopeRegistry, 'getConditionalScopeRequirement')
				.mockReturnValue(undefined);
			const isolatedList =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/events/list.operation');
			const docsNotice = isolatedList.description.find(
				(property: { name: string }) => property.name === 'listEventsDocsNotice',
			);
			expect(docsNotice).toBeDefined();
			expect(docsNotice?.displayName).not.toContain('also authorize');
		});
	});

	it('should apply the same resource and operation display options to every field', () => {
		for (const property of list.description) {
			expect(property.displayOptions?.show?.resource).toContain('event');
			expect(property.displayOptions?.show?.operation).toContain('list');
		}
	});

	it('should return a recoverable validation payload for an overly long search string', async () => {
		const context = createContext(
			{
				fromDateTime: '',
				toDateTime: '',
				includeDisabledCalendar: false,
				includeHiddenCalendar: false,
				ignoreDeclinedEvents: false,
				search: 'a'.repeat(256),
			},
			{ continueOnFail: true },
		);

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'INVALID_SEARCH',
			}),
		);
	});

	it('should flatten a grouped array response into a single data array', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue([
			{
				seen_events: [],
				url: '/api/v2/events',
				type: 'event',
				data: [
					{ id: 'event_1', title: 'Morning Standup' },
					{ id: 'event_2', title: 'Design Review' },
				],
			},
			{
				seen_events: [],
				url: '/api/v2/events',
				type: 'event',
				data: [{ id: 'event_3', title: 'Sprint Retro' }],
			},
			{
				seen_events: [],
				url: '/api/v2/events',
				type: 'event',
				data: [],
			},
		] as unknown as { data: [] });

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			data: [
				{ id: 'event_1', title: 'Morning Standup' },
				{ id: 'event_2', title: 'Design Review' },
				{ id: 'event_3', title: 'Sprint Retro' },
			],
		});
	});

	it('should flatten a grouped array response and trust server-side search results', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'standup',
		});
		mockZohoCliqApiRequest.mockResolvedValue([
			{
				seen_events: [],
				url: '/api/v2/events',
				type: 'event',
				data: [
					{ id: 'event_1', title: 'Morning Standup' },
					{ id: 'event_2', title: 'Design Review' },
				],
			},
			{
				seen_events: [],
				url: '/api/v2/events',
				type: 'event',
				data: [{ id: 'event_3', title: 'Afternoon Standup' }],
			},
		] as unknown as { data: [] });

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		// Server handled search — all flattened events returned as-is, no local filtering
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			data: [
				{ id: 'event_1', title: 'Morning Standup' },
				{ id: 'event_2', title: 'Design Review' },
				{ id: 'event_3', title: 'Afternoon Standup' },
			],
		});
	});

	it('should locally filter a flattened grouped response when server search returns non-array data', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: 'standup',
		});
		// First call: server search returns non-array data, triggering local filter fallback
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: { unsupported: true } });
		// Second call (fallback without search): grouped array response
		mockZohoCliqApiRequest.mockResolvedValueOnce([
			{
				seen_events: [],
				url: '/api/v2/events',
				type: 'event',
				data: [
					{ id: 'event_1', title: 'Morning Standup' },
					{ id: 'event_2', title: 'Design Review' },
				],
			},
			{
				seen_events: [],
				url: '/api/v2/events',
				type: 'event',
				data: [{ id: 'event_3', title: 'Afternoon Standup' }],
			},
		] as unknown as { data: [] });

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/events', undefined, {
			search: 'standup',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/events',
			undefined,
			{},
		);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			data: [
				{ id: 'event_1', title: 'Morning Standup' },
				{ id: 'event_3', title: 'Afternoon Standup' },
			],
		});
	});

	it('should handle grouped array with empty data arrays', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue([
			{ seen_events: [], url: '/api/v2/events', type: 'event', data: [] },
			{ seen_events: [], url: '/api/v2/events', type: 'event', data: [] },
		] as unknown as { data: [] });

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [] });
	});

	it('should skip non-object entries in grouped array response', async () => {
		const context = createContext({
			fromDateTime: '',
			toDateTime: '',
			includeDisabledCalendar: false,
			includeHiddenCalendar: false,
			ignoreDeclinedEvents: false,
			search: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue([
			null,
			{ seen_events: [], data: [{ id: 'event_1', title: 'Valid Event' }] },
			'unexpected-string',
			{ seen_events: [], data: 'not-an-array' },
			{ seen_events: [], data: [null, { id: 'event_2', title: 'Another Event' }, 42] },
		] as unknown as { data: [] });

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			data: [
				{ id: 'event_1', title: 'Valid Event' },
				{ id: 'event_2', title: 'Another Event' },
			],
		});
	});

	it('should return a recoverable API payload in AI Error Mode', async () => {
		const context = createContext(
			{
				fromDateTime: '',
				toDateTime: '',
				includeDisabledCalendar: false,
				includeHiddenCalendar: false,
				ignoreDeclinedEvents: false,
				search: '',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 429,
			message: 'Too many requests',
		});

		const result = await list.execute.call(context, items, SCOPES.EVENTS_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'list',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
	});
});
