/**
 * Get Events operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { EVENTS_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import {
	getConditionalScopeRequirement,
	getRequiredScopesForOperationOrThrow,
} from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { parseDateTimeOrUnixMs, pushEventsRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'list');
const searchConditionalRequiredScopes = new Set(
	getConditionalScopeRequirement('events', 'list', 'searchParamPresent')?.requiredScopes ?? [],
);
const baseRequiredScopes = requiredScopes.filter(
	(scope) => !searchConditionalRequiredScopes.has(scope),
);
const baseRequiredScopesText = baseRequiredScopes
	.map((scope) => `<code>${scope}</code>`)
	.join(', ');
const searchRequiredScopesText = Array.from(searchConditionalRequiredScopes)
	.map((scope) => `<code>${scope}</code>`)
	.join(', ');

/**
 * The Zoho Cliq Events/List endpoint returns an array of date-group objects,
 * each containing a `data` array of individual events:
 *
 *   [ { data: [event1, event2], seen_events: [], ... }, { data: [event3], ... } ]
 *
 * This function flattens all groups into a single normalized object that the
 * simplify system can process:
 *
 *   { data: [event1, event2, event3] }
 */
function flattenGroupedEventResponse(response: unknown): IDataObject {
	if (Array.isArray(response)) {
		const allEvents: IDataObject[] = [];
		for (const group of response) {
			if (group && typeof group === 'object' && !Array.isArray(group)) {
				const data = (group as IDataObject).data;
				if (Array.isArray(data)) {
					for (const event of data) {
						if (event && typeof event === 'object') {
							allEvents.push(event as IDataObject);
						}
					}
				}
			}
		}
		return { data: allEvents } as IDataObject;
	}

	// If the API returns a single object (unexpected but safe), pass through
	return coerceApiResponseToObject(response);
}

function extractEventList(response: IDataObject): Record<string, unknown>[] | undefined {
	const data = response.data;
	if (!Array.isArray(data)) {
		return undefined;
	}

	return data.filter(
		(entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object',
	);
}

function filterEventsLocally(
	events: Record<string, unknown>[],
	search: string,
): Record<string, unknown>[] {
	const needle = search.toLowerCase();
	return events.filter((event) =>
		String(event.title ?? '')
			.toLowerCase()
			.includes(needle),
	);
}

const properties: INodeProperties[] = [
	{
		displayName: 'From Date Time',
		name: 'fromDateTime',
		type: 'dateTime',
		default: '',
		description:
			'Optional lower-bound event start date and time. This field accepts the normal picker value or an expression that resolves to an ISO datetime string or Unix timestamp in milliseconds. Blank values are allowed and omitted.',
	},
	{
		displayName: 'To Date Time',
		name: 'toDateTime',
		type: 'dateTime',
		default: '',
		description:
			'Optional upper-bound event end date and time. This field accepts the normal picker value or an expression that resolves to an ISO datetime string or Unix timestamp in milliseconds. Blank values are allowed and omitted.',
	},
	{
		displayName: 'Include Disabled Calendar',
		name: 'includeDisabledCalendar',
		type: 'boolean',
		default: false,
		description: 'Whether to include events from disabled calendars',
	},
	{
		displayName: 'Include Hidden Calendar',
		name: 'includeHiddenCalendar',
		type: 'boolean',
		default: false,
		description: 'Whether to include events from hidden calendars',
	},
	{
		displayName: 'Ignore Declined Events',
		name: 'ignoreDeclinedEvents',
		type: 'boolean',
		default: false,
		description: 'Whether to omit events that you have declined',
	},
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description:
			'Optional event-title search string. Blank values are allowed and omitted. Supplying Search also requires the additional OAuth scope `ZohoCalendar.search.READ`',
	},
	...getSimplifyParameters('event', 'event', 'list'),
	{
		displayName: `Get Events Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get-events" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${baseRequiredScopesText}${searchRequiredScopesText ? `. If <b>Search</b> is provided, also authorize ${searchRequiredScopesText}` : ''}`,
		name: 'listEventsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Get Events as AI Tool Setup Guide: <a href="${EVENTS_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listEventsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['list'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let search: string | undefined;
		let fromValue: number | undefined;
		let toValue: number | undefined;

		try {
			const workflowTimeZone = this.getTimezone();
			const fromRaw = this.getNodeParameter('fromDateTime', i, '');
			const toRaw = this.getNodeParameter('toDateTime', i, '');
			const includeDisabledCalendar = this.getNodeParameter(
				'includeDisabledCalendar',
				i,
				false,
			) as boolean;
			const includeHiddenCalendar = this.getNodeParameter(
				'includeHiddenCalendar',
				i,
				false,
			) as boolean;
			const ignoreDeclinedEvents = this.getNodeParameter(
				'ignoreDeclinedEvents',
				i,
				false,
			) as boolean;
			search = String(this.getNodeParameter('search', i, '')).trim();

			for (const requiredScope of requiredScopes) {
				if (!search && searchConditionalRequiredScopes.has(requiredScope)) {
					continue;
				}
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			const qs: Record<string, string | number | boolean> = {};

			if (
				fromRaw !== undefined &&
				fromRaw !== null &&
				!(typeof fromRaw === 'string' && fromRaw.trim() === '')
			) {
				fromValue = parseDateTimeOrUnixMs(this, fromRaw, i, 'From', {
					timeZone: workflowTimeZone,
				});
				qs.from = fromValue;
			}

			if (
				toRaw !== undefined &&
				toRaw !== null &&
				!(typeof toRaw === 'string' && toRaw.trim() === '')
			) {
				toValue = parseDateTimeOrUnixMs(this, toRaw, i, 'To', {
					timeZone: workflowTimeZone,
				});
				qs.to = toValue;
			}

			if (fromValue !== undefined && toValue !== undefined) {
				if (toValue <= fromValue) {
					throw new NodeOperationError(this.getNode(), 'To must be greater than From', {
						itemIndex: i,
					});
				}

				const thirtyOneDaysInMs = 31 * 24 * 60 * 60 * 1000;
				if (toValue - fromValue > thirtyOneDaysInMs) {
					throw new NodeOperationError(
						this.getNode(),
						'The maximum difference between From and To is 31 days',
						{ itemIndex: i },
					);
				}
			}

			if (includeDisabledCalendar) {
				qs.include_disabled_calendar = true;
			}
			if (includeHiddenCalendar) {
				qs.include_hidden_calendar = true;
			}
			if (ignoreDeclinedEvents) {
				qs.ignore_declined_events = true;
			}
			if (search) {
				if (search.length > 255) {
					throw new NodeOperationError(
						this.getNode(),
						'Search is too long. Maximum length is 255 characters.',
						{ itemIndex: i },
					);
				}
				qs.search = search;
			}

			const rawResponse = await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/events',
				undefined,
				qs,
			);
			let response = flattenGroupedEventResponse(rawResponse);

			if (search) {
				const serverData = extractEventList(response);
				if (!Array.isArray(serverData)) {
					const fallbackQs = { ...qs };
					delete fallbackQs.search;

					const unfilteredRaw = await zohoCliqApiRequest.call(
						this,
						'GET',
						'/api/v2/events',
						undefined,
						fallbackQs,
					);

					const unfilteredResponse = flattenGroupedEventResponse(unfilteredRaw);
					const unfilteredEvents = extractEventList(unfilteredResponse) ?? [];
					const filteredEvents = filterEventsLocally(unfilteredEvents, search);
					response = {
						...unfilteredResponse,
						data: filteredEvents,
					};
				}
			}

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('event');
			const listItems = applySimplifyModeToList(response, 'data', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushEventsRecoverableError(this, returnData, i, 'list', error, {
					contextFields: {
						...(typeof fromValue === 'number' ? { from: fromValue } : {}),
						...(typeof toValue === 'number' ? { to: toValue } : {}),
						...(search ? { search } : {}),
					},
					fallbackMessage: 'An unexpected issue occurred with the API request',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('to must be greater than from'),
							reason: 'INVALID_TIME_RANGE',
							hint: 'Choose a To value that is later than From.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('maximum difference between from and to is 31 days'),
							reason: 'INVALID_TIME_RANGE',
							hint: 'Reduce the time window so From and To are no more than 31 days apart.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('search is too long'),
							reason: 'INVALID_SEARCH',
							hint: 'Use a search string of 255 characters or fewer.',
						},
					],
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
