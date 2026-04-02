/**
 * Events resource
 * Handles calendar event operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as create from './create.operation';
import * as del from './delete.operation';
import * as get from './get.operation';
import * as getCalendars from './getCalendars.operation';
import * as list from './list.operation';
import * as update from './update.operation';
import * as updateStatus from './updateStatus.operation';
import * as uploadAttachment from './uploadAttachment.operation';

export { create, del as delete, get, getCalendars, list, update, updateStatus, uploadAttachment };

const baseEventOperationOptions = [
	{
		name: 'Create Event',
		value: 'create',
		description: 'Create an event',
		action: 'Create event',
	},
	{
		name: 'Delete Event',
		value: 'delete',
		description: 'Delete an event',
		action: 'Delete event',
	},
	{
		name: 'Get Event Calendars',
		value: 'getCalendars',
		description: 'Get calendars available for events',
		action: 'Get event calendars',
	},
	{
		name: 'Get Event Details',
		value: 'get',
		description: 'Get details for a specific event',
		action: 'Get event details',
	},
	{
		name: 'Update Event',
		value: 'update',
		description: 'Edit an event',
		action: 'Update event',
	},
	{
		name: 'Update Event Status',
		value: 'updateStatus',
		description: 'Update your RSVP status for an event',
		action: 'Update event status',
	},
	{
		name: 'Upload Event Attachment',
		value: 'uploadAttachment',
		description: 'Upload an attachment for an event',
		action: 'Upload event attachment',
	},
] as const;

const getEventsOption = {
	name: 'Get Events',
	value: 'list',
	description: 'Get events from calendars',
	action: 'Get events',
} as const;

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['event'],
			},
		},
		options: [...baseEventOperationOptions, getEventsOption],
		default: 'get',
	},
	...create.description,
	...del.description,
	...get.description,
	...getCalendars.description,
	...list.description,
	...update.description,
	...updateStatus.description,
	...uploadAttachment.description,
];
