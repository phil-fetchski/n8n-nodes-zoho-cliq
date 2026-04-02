/**
 * Update Event Status operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { EVENTS_UPDATE_STATUS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runEventLookupPreflightGate } from '../shared/preflight';
import {
	pushEventsRecoverableError,
	validateCalendarId,
	validateEventId,
	validateEventStatus,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'updateStatus');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		default: '',
		required: true,
		description: 'The exact Zoho Cliq event ID to update',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		default: 'accepted',
		options: [
			{ name: 'Accepted', value: 'accepted' },
			{ name: 'Declined', value: 'declined' },
			{ name: 'Tentative', value: 'tentative' },
			{ name: 'Yet To Respond', value: 'yet_to_respond' },
		],
		description:
			'Your RSVP status for this event. Allowed values: accepted, declined, tentative, yet_to_respond.',
	},
	{
		displayName: 'Calendar ID',
		name: 'calendarId',
		type: 'string',
		default: '',
		description:
			'Optional calendar ID for recoverable preflight validation. When provided, the node can verify the event exists before calling Update Event Status.',
	},
	{
		displayName: `Update Event Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-event-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'updateEventStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Update Event Status as AI Tool Setup Guide: <a href="${EVENTS_UPDATE_STATUS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateEventStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['updateStatus'],
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
		let sanitizedStatus: string | undefined;
		let sanitizedCalendarId: string | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			sanitizedEventId = validateEventId(this, this.getNodeParameter('eventId', i) as string, i);
			sanitizedStatus = validateEventStatus(this, this.getNodeParameter('status', i) as string, i);
			sanitizedCalendarId = validateCalendarId(
				this,
				this.getNodeParameter('calendarId', i, '') as string,
				i,
			);

			if (sanitizedCalendarId) {
				await runEventLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedEventId,
					sanitizedCalendarId,
				);
			}

			const endpoint = `/api/v2/events/${encodeURIComponent(sanitizedEventId)}/statuses/${encodeURIComponent(sanitizedStatus)}`;
			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: { ...(response as IDataObject), updated: true } }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushEventsRecoverableError(this, returnData, i, 'updateStatus', error, {
					contextFields: {
						...(sanitizedEventId ? { event_id: sanitizedEventId } : {}),
						...(sanitizedStatus ? { status: sanitizedStatus } : {}),
						...(sanitizedCalendarId ? { calendar_id: sanitizedCalendarId } : {}),
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
							hint: 'Use the exact calendar ID that owns the event when supplying optional preflight validation.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('status must be one of'),
							reason: 'INVALID_STATUS',
							hint: 'Use one of: accepted, declined, tentative, yet_to_respond.',
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
