/**
 * Snooze Reminder operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { REMINDERS_SNOOZE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runReminderLookupPreflightGate } from '../shared/preflight';
import {
	parseReminderPayloadInput,
	pushRemindersRecoverableError,
	reminderIdLocator,
	resolveRemindersEnhancedOutput,
	validateReminderId,
	validateReminderInputMode,
	validateReminderPayload,
	validateReminderTime,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'snooze');
const reminderSnoozeInputModes = ['preset', 'custom'] as const;

function validateReminderSnoozeInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): (typeof reminderSnoozeInputModes)[number] {
	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			'Snooze Time Mode must be one of: preset, custom',
			{
				itemIndex,
			},
		);
	}

	const sanitized = value.trim() as (typeof reminderSnoozeInputModes)[number];
	if (!reminderSnoozeInputModes.includes(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			'Snooze Time Mode must be one of: preset, custom',
			{
				itemIndex,
			},
		);
	}

	return sanitized;
}

const properties: INodeProperties[] = [
	reminderIdLocator,
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Choose whether to build the payload with individual fields or provide JSON directly',
	},
	{
		displayName: 'Snooze Time Mode',
		name: 'snoozeInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Preset Duration', value: 'preset' },
			{ name: 'Custom Milliseconds', value: 'custom' },
		],
		default: 'preset',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'How to provide the snooze duration',
	},
	{
		displayName: 'Snooze Duration',
		name: 'snoozePreset',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: '5 Minutes', value: 300000 },
			{ name: '10 Minutes', value: 600000 },
			{ name: '15 Minutes', value: 900000 },
			{ name: '30 Minutes', value: 1800000 },
			{ name: '45 Minutes', value: 2700000 },
			{ name: '60 Minutes', value: 3600000 },
			{ name: '1 Day', value: 86400000 },
			{ name: '1 Week', value: 604800000 },
			{ name: '1 Month (30 Days)', value: 2592000000 },
		],
		default: 900000,
		displayOptions: {
			show: {
				inputMode: ['structured'],
				snoozeInputMode: ['preset'],
			},
		},
		description: 'Preset snooze duration',
	},
	{
		displayName: 'Time (MS)',
		name: 'time',
		type: 'number',
		default: 900000,
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
				snoozeInputMode: ['custom'],
			},
		},
		description:
			'Snooze duration in milliseconds (applied from current time). Supports direct values or expressions.',
	},
	{
		displayName: 'Snooze Payload (JSON)',
		name: 'snoozePayload',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload for snooze settings. Pass a JSON object or stringified JSON object. Allowed fields: time.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal snooze response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Snooze Reminder Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#snooze_reminder" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'snoozeReminderDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Snooze Reminder as AI Tool Setup Guide: <a href="${REMINDERS_SNOOZE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'snoozeReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['snooze'],
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
		let sanitizedReminderId: string | undefined;
		let resolvedTime: number | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const reminderId = this.getNodeParameter('reminderId', i, '', {
				extractValue: true,
			}) as string;
			const inputMode = validateReminderInputMode(this, this.getNodeParameter('inputMode', i), i);

			let body: IDataObject;
			if (inputMode === 'structured') {
				const snoozeInputMode = validateReminderSnoozeInputMode(
					this,
					this.getNodeParameter('snoozeInputMode', i, 'preset'),
					i,
				);
				const structuredTime =
					snoozeInputMode === 'preset'
						? this.getNodeParameter('snoozePreset', i)
						: this.getNodeParameter('time', i);
				resolvedTime = validateReminderTime(this, structuredTime, i);
				body = {
					time: resolvedTime,
				};
			} else {
				const snoozePayload = this.getNodeParameter('snoozePayload', i, {}) as unknown;
				body = parseReminderPayloadInput(this, snoozePayload, i, 'Snooze Payload');
			}

			sanitizedReminderId = validateReminderId(this, reminderId, i);
			body = validateReminderPayload(this, body, i, 'Snooze Payload', {
				requireTime: true,
				allowedFields: ['time'],
			});
			resolvedTime = Number(body.time);
			await runReminderLookupPreflightGate(this, i, grantedScopes, sanitizedReminderId);

			const response = await zohoCliqApiRequest.call(
				this,
				'PUT',
				`/api/v2/reminders/${encodeURIComponent(sanitizedReminderId)}/snooze`,
				body,
			);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveRemindersEnhancedOutput(
				this,
				i,
				response,
				true,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									success: true,
									resource: 'reminders',
									operation: 'snooze',
									reminder_id: sanitizedReminderId,
									snooze_time_ms: resolvedTime,
								}
							: rawResponse,
					},
				],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'snooze', error, {
					contextFields: {
						...(sanitizedReminderId ? { reminder_id: sanitizedReminderId } : {}),
						...(resolvedTime ? { snooze_time_ms: resolvedTime } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid reminder id format'),
							reason: 'INVALID_REMINDER_ID',
							hint: 'Use the exact reminder ID returned by Zoho Cliq.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('time must be a positive whole-number timestamp'),
							reason: 'INVALID_TIME',
							hint: 'Provide a positive whole-number snooze duration in milliseconds.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('unsupported field'),
							reason: 'UNSUPPORTED_PAYLOAD_FIELD',
							hint: 'Use only the time field in the snooze payload.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('mine category') ||
								(normalizedMessage.includes('mine') && normalizedMessage.includes('snooze')),
							reason: 'MINE_CATEGORY_ONLY',
							hint: 'Use snooze only for reminders in the Mine category.',
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
