/**
 * Get Event Details operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { EVENTS_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import { runEventLookupPreflightGate } from '../shared/preflight';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	pushEventsRecoverableError,
	validateCalendarId,
	validateEventId,
	validateRecurrenceId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'get');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		default: '',
		required: true,
		description: 'The exact Zoho Cliq event ID to retrieve',
	},
	{
		displayName: 'Calendar ID',
		name: 'calendarId',
		type: 'string',
		default: '',
		required: true,
		description: 'The exact calendar ID that contains this event',
	},
	{
		displayName: 'Recurrence ID',
		name: 'recurrenceId',
		type: 'string',
		default: '',
		description:
			'Optional recurrence instance identifier for recurring events. Blank values are allowed and omitted.',
	},
	...getSimplifyParameters('event', 'event', 'get'),
	{
		displayName: `Get Event Details Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#event-details" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'getEventDetailsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Get Event Details as AI Tool Setup Guide: <a href="${EVENTS_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getEventDetailsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['get'],
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
		let sanitizedEventId: string | undefined;
		let sanitizedCalendarId: string | undefined;
		let sanitizedRecurrenceId: string | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			sanitizedEventId = validateEventId(this, this.getNodeParameter('eventId', i) as string, i);
			sanitizedCalendarId = validateCalendarId(
				this,
				this.getNodeParameter('calendarId', i) as string,
				i,
				{ required: true },
			) as string;
			const recurrenceId = (this.getNodeParameter('recurrenceId', i, '') as string).trim();
			if (recurrenceId) {
				sanitizedRecurrenceId = validateRecurrenceId(this, recurrenceId, i);
			}

			const preflightResult = await runEventLookupPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedEventId,
				sanitizedCalendarId,
				{
					recurrenceId: sanitizedRecurrenceId,
				},
			);

			const endpoint = `/api/v2/events/${encodeURIComponent(sanitizedEventId)}`;
			const qs: Record<string, string> = {
				calendar_id: sanitizedCalendarId,
			};
			if (sanitizedRecurrenceId) {
				qs.recurrence_id = sanitizedRecurrenceId;
			}

			const response =
				preflightResult.status === 'validated' && preflightResult.entity
					? preflightResult.entity
					: await zohoCliqApiRequest.call(this, 'GET', endpoint, undefined, qs);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('event');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
				'data',
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushEventsRecoverableError(this, returnData, i, 'get', error, {
					contextFields: {
						...(sanitizedEventId ? { event_id: sanitizedEventId } : {}),
						...(sanitizedCalendarId ? { calendar_id: sanitizedCalendarId } : {}),
						...(sanitizedRecurrenceId ? { recurrence_id: sanitizedRecurrenceId } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.startsWith('invalid event id') ||
								normalizedMessage.startsWith('event id is required') ||
								normalizedMessage.startsWith('event id is too long'),
							reason: 'INVALID_EVENT_ID',
							hint: 'Use the exact event ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.startsWith('calendar id is required') ||
								normalizedMessage.startsWith('calendar id is too long') ||
								normalizedMessage.startsWith('calendar id cannot contain whitespace'),
							reason: 'INVALID_CALENDAR_ID',
							hint: 'Use the exact calendar ID that owns the event.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('recurrence id'),
							reason: 'INVALID_RECURRENCE_ID',
							hint: 'Use the exact recurrence_id for the recurring event instance, or leave it blank.',
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
