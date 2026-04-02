/**
 * Reminders resource
 * Handles reminder lifecycle and assignment operations
 */

import type { INodeProperties } from 'n8n-workflow';

import * as assign from './assign.operation';
import * as clearCompleted from './clearCompleted.operation';
import * as create from './create.operation';
import * as del from './delete.operation';
import * as deleteBatch from './deleteBatch.operation';
import * as dismissSnooze from './dismissSnooze.operation';
import * as get from './get.operation';
import * as list from './list.operation';
import * as markComplete from './markComplete.operation';
import * as markIncomplete from './markIncomplete.operation';
import * as remindAssignee from './remindAssignee.operation';
import * as remindAssignees from './remindAssignees.operation';
import * as removeAssignees from './removeAssignees.operation';
import * as snooze from './snooze.operation';
import * as update from './update.operation';

export {
	assign,
	clearCompleted,
	create,
	del as delete,
	deleteBatch,
	dismissSnooze,
	get,
	list,
	markComplete,
	markIncomplete,
	remindAssignee,
	remindAssignees,
	removeAssignees,
	snooze,
	update,
};

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['reminder'],
			},
		},
		options: [
			{
				name: 'Assign Users',
				value: 'assign',
				description: 'Assign users to a reminder',
				action: 'Assign users to a reminder',
			},
			{
				name: 'Clear Completed Reminders',
				value: 'clearCompleted',
				description: 'Delete completed reminders by category',
				action: 'Clear completed reminders',
			},
			{
				name: 'Create Reminder',
				value: 'create',
				description: 'Create a reminder',
				action: 'Create a reminder',
			},
			{
				name: 'Delete Reminder',
				value: 'delete',
				description: 'Delete a reminder',
				action: 'Delete a reminder',
			},
			{
				name: 'Delete Reminders (Batch)',
				value: 'deleteBatch',
				description: 'Delete multiple reminders',
				action: 'Delete reminders in batch',
			},
			{
				name: 'Dismiss Snoozed Reminder',
				value: 'dismissSnooze',
				description: 'Dismiss snooze for a reminder',
				action: 'Dismiss reminder snooze',
			},
			{
				name: 'Get Reminder',
				value: 'get',
				description: 'Get detailed information for a reminder',
				action: 'Get a reminder',
			},
			{
				name: 'List Reminders',
				value: 'list',
				description: 'Get reminders',
				action: 'List reminders',
			},
			{
				name: 'Mark Reminder Complete',
				value: 'markComplete',
				description: 'Mark a reminder as complete',
				action: 'Mark a reminder complete',
			},
			{
				name: 'Mark Reminder Incomplete',
				value: 'markIncomplete',
				description: 'Mark a reminder as incomplete',
				action: 'Mark a reminder incomplete',
			},
			{
				name: 'Remind Assignee',
				value: 'remindAssignee',
				description: 'Trigger a reminder nudge for one assignee',
				action: 'Remind one assignee',
			},
			{
				name: 'Remind Assignees',
				value: 'remindAssignees',
				description: 'Trigger reminder nudges for selected assignees',
				action: 'Remind assignees',
			},
			{
				name: 'Remove Reminder Assignees',
				value: 'removeAssignees',
				description: 'Remove assignees from a reminder',
				action: 'Remove reminder assignees',
			},
			{
				name: 'Snooze Reminder',
				value: 'snooze',
				description: 'Snooze a reminder',
				action: 'Snooze a reminder',
			},
			{
				name: 'Update Reminder',
				value: 'update',
				description: 'Update a reminder',
				action: 'Update a reminder',
			},
		],
		default: 'list',
		hint: "Reminders and reminder nudges are delivered by Cliq's built-in bot, Taz.",
	},
	...assign.description,
	...clearCompleted.description,
	...create.description,
	...del.description,
	...deleteBatch.description,
	...dismissSnooze.description,
	...get.description,
	...list.description,
	...markComplete.description,
	...markIncomplete.description,
	...remindAssignee.description,
	...remindAssignees.description,
	...removeAssignees.description,
	...snooze.description,
	...update.description,
];
