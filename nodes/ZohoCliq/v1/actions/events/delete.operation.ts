/**
 * Delete Event operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { EVENTS_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { buildCliqRecoverableErrorPayload } from '../shared/errorResponse';
import {
	extractEventDetailsFromLookupResponse,
	runEventLookupPreflightGate,
} from '../shared/preflight';
import {
	pushEventsRecoverableError,
	resolveEventsEnhancedOutput,
	validateCalendarId,
	validateEditTag,
	validateEventId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'delete');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Event ID',
		name: 'eventId',
		type: 'string',
		default: '',
		required: true,
		description: 'The exact Zoho Cliq event ID to delete',
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
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal delete response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Delete Event Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-event" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'deleteEventDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Delete Event as AI Tool Setup Guide: <a href="${EVENTS_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteEventAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['delete'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function extractPrefetchedEditTag(
	context: IExecuteFunctions,
	response: IDataObject,
	itemIndex: number,
): number {
	const details = extractEventDetailsFromLookupResponse(response);

	if (!details) {
		throw new NodeOperationError(
			context.getNode(),
			'Unable to determine the current event details from Get Event Details',
			{ itemIndex },
		);
	}

	return validateEditTag(context, String(details.edit_tag ?? ''), itemIndex);
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let sanitizedEventId: string | undefined;
		let sanitizedCalendarId: string | undefined;
		let sanitizedEditTag: number | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			sanitizedEventId = validateEventId(this, this.getNodeParameter('eventId', i) as string, i);
			sanitizedCalendarId = validateCalendarId(
				this,
				this.getNodeParameter('calendarId', i) as string,
				i,
				{
					required: true,
				},
			) as string;

			const endpoint = `/api/v2/events/${encodeURIComponent(sanitizedEventId)}`;
			const preflightResult = await runEventLookupPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedEventId,
				sanitizedCalendarId,
			);
			const currentEventResponse =
				preflightResult.status === 'validated' && preflightResult.entity
					? preflightResult.entity
					: await zohoCliqApiRequest.call(this, 'GET', endpoint, undefined, {
							calendar_id: sanitizedCalendarId,
						});
			sanitizedEditTag = extractPrefetchedEditTag(this, currentEventResponse, i);
			const requestQuery = {
				calendar_id: sanitizedCalendarId,
				edit_tag: sanitizedEditTag,
			};

			let response: IDataObject;
			try {
				response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint, undefined, requestQuery);
			} catch (primaryError) {
				const requestBody = {
					calendar_id: sanitizedCalendarId,
					edit_tag: sanitizedEditTag,
				};
				try {
					response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint, requestBody);
				} catch {
					throw primaryError;
				}
			}
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveEventsEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									deleted: true,
									success: true,
									resource: 'events',
									operation: 'delete',
									event_id: sanitizedEventId,
									calendar_id: sanitizedCalendarId,
									edit_tag: sanitizedEditTag,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			const includeEnhancedOutput = Boolean(
				this.getNodeParameter('includeEnhancedOutput', i, true),
			);
			if (includeEnhancedOutput) {
				const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
				const basePayload =
					scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)
						? { ...(scopePayload as IDataObject) }
						: buildCliqRecoverableErrorPayload(
								error,
								{
									resource: 'events',
									operation: 'delete',
								},
								{
									contextFields: {
										...(sanitizedEventId ? { event_id: sanitizedEventId } : {}),
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
											hint: 'Use the exact calendar ID that owns the event.',
										},
										{
											match: (normalizedMessage) =>
												normalizedMessage.includes('unable to determine the current event details'),
											reason: 'MISSING_EVENT_DETAILS',
											hint: 'Verify that Get Event Details returns the current event for the supplied calendar_id.',
										},
										{
											match: (normalizedMessage) => normalizedMessage.includes('edit tag'),
											reason: 'MISSING_EDIT_TAG',
											hint: 'Verify that Get Event Details returns the latest edit_tag for this event.',
										},
									],
								},
							);

				const executionData = this.helpers.constructExecutionMetaData(
					[
						{
							json: {
								success: false,
								resource: 'events',
								operation: 'delete',
								...(basePayload as IDataObject),
								...(sanitizedEditTag !== undefined ? { edit_tag: sanitizedEditTag } : {}),
							},
						},
					],
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
				continue;
			}
			if (
				pushEventsRecoverableError(this, returnData, i, 'delete', error, {
					contextFields: {
						...(sanitizedEventId ? { event_id: sanitizedEventId } : {}),
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
							hint: 'Use the exact calendar ID that owns the event.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('unable to determine the current event details'),
							reason: 'MISSING_EVENT_DETAILS',
							hint: 'Verify that Get Event Details returns the current event for the supplied calendar_id.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('edit tag'),
							reason: 'MISSING_EDIT_TAG',
							hint: 'Verify that Get Event Details returns the latest edit_tag for this event.',
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
