/**
 * Trigger Bot Calls operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { BOT_TRIGGER_BOT_CALL_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { cliqKnownIconOptions, isKnownCliqIconId } from '../shared/richUi';
import { zohoCliqApiRequest } from '../../transport';
import { coerceApiResponseToObjectWithOptions } from '../shared/responseOutput';
import {
	parseBotPayloadInput,
	parseDelimitedIds,
	pushBotRecoverableError,
	validateBotUniqueName,
	validateTriggerCallPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const callActionKnownIconOptions = [{ name: 'None', value: '' }, ...cliqKnownIconOptions];

function getOptionalString(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	const normalized = String(value).trim();
	return normalized ? normalized : undefined;
}

function buildStructuredCallPayload(context: IExecuteFunctions, itemIndex: number): IDataObject {
	const text = (context.getNodeParameter('text', itemIndex) as string).trim();
	const userIds = (context.getNodeParameter('userIds', itemIndex, '') as string).trim();
	const retry = context.getNodeParameter('retry', itemIndex, 0) as number;
	const loop = context.getNodeParameter('loop', itemIndex, 1) as number;
	const actionsCollection = context.getNodeParameter('actions', itemIndex, {}) as IDataObject;

	const body: IDataObject = { text, retry, loop };

	if (userIds) {
		body.user_ids = parseDelimitedIds(context, userIds, itemIndex, 'User IDs');
	}

	const actionEntries = Array.isArray(actionsCollection.action)
		? (actionsCollection.action as IDataObject[])
		: [];

	if (actionEntries.length > 0) {
		body.actions = actionEntries.map((actionEntry, actionIndex) => {
			const label = String(actionEntry.label ?? '').trim();
			const knownIconId = getOptionalString(actionEntry.knownIconId);
			let icon: string | undefined;
			if (knownIconId) {
				if (!isKnownCliqIconId(knownIconId)) {
					throw new NodeOperationError(
						context.getNode(),
						`Actions[${actionIndex}] Known Icon must be one of the supported Cliq icon keywords`,
						{ itemIndex },
					);
				}
				icon = knownIconId;
			}
			const hint = getOptionalString(actionEntry.hint);
			const key = getOptionalString(actionEntry.key);
			const actionType = String(actionEntry.actionType ?? '').trim();

			const actionData: IDataObject = {};
			if (actionType === 'open.url') {
				actionData.web = String(actionEntry.openUrl ?? '').trim();
			} else if (actionType === 'invoke.function') {
				actionData.name = String(actionEntry.functionName ?? '').trim();
			} else if (actionType === 'system.api') {
				actionData.api = String(actionEntry.systemApi ?? '').trim();
			} else if (actionType === 'open.dialog') {
				const dialogData = parseBotPayloadInput(
					context,
					actionEntry.dialogData ?? {},
					itemIndex,
					`Actions[${actionIndex}] Dialog Data`,
				);
				Object.assign(actionData, dialogData);
			}

			const actionPayload: IDataObject = {
				label,
				action: {
					type: actionType,
					data: actionData,
				},
			};

			if (icon) {
				actionPayload.icon = icon;
			}

			if (hint) {
				actionPayload.hint = hint;
			}

			if (key) {
				actionPayload.key = key;
			}

			return actionPayload;
		});
	}

	return body;
}

const properties: INodeProperties[] = [
	{
		displayName: 'Bot Unique Name',
		name: 'botUniqueName',
		type: 'string',
		default: '',
		required: true,
		description:
			'Unique bot identifier used in the API path. Use the bot unique name (lowercase letters only, a-z), not display name or bot ID.',
	},
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
			'Choose how to provide the request body. Using Fields Below guides payload creation; Using JSON accepts full call payload object.',
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Voice alert message text that will be spoken during the call. Required. Maximum 500 characters.',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		placeholder: 'e.g. 839367970,734278321',
		description:
			'Optional comma-separated list of target user IDs or emails (`user_ids`). Leave empty to call all subscribers. Maximum 10 entries.',
	},
	{
		displayName: 'Retry',
		name: 'retry',
		type: 'number',
		default: 2,
		typeOptions: { minValue: 1, maxValue: 3 },
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Number of retry attempts if users miss the first call. Integer from 1 to 3.',
	},
	{
		displayName: 'Loop',
		name: 'loop',
		type: 'number',
		default: 1,
		typeOptions: { minValue: 1, maxValue: 3 },
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Number of times the voice message is repeated per call. Integer from 1 to 3.',
	},
	{
		displayName: 'Actions',
		name: 'actions',
		type: 'fixedCollection',
		placeholder: 'Add Action',
		typeOptions: {
			multipleValues: true,
			sortable: true,
		},
		default: {},
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		options: [
			{
				name: 'action',
				displayName: 'Action',
				values: [
					{
						displayName: 'Action Type',
						name: 'actionType',
						type: 'options',
						options: [
							{ name: 'Open URL', value: 'open.url' },
							{ name: 'Invoke Function', value: 'invoke.function' },
							{ name: 'System API', value: 'system.api' },
							{ name: 'Open Dialog', value: 'open.dialog' },
						],
						default: 'open.url',
					},
					{
						displayName: 'Cliq Icon',
						name: 'knownIconId',
						type: 'options',
						noDataExpression: false,
						options: callActionKnownIconOptions,
						default: '',
						description:
							'Optional Cliq icon keyword. Trigger Bot Call supports only known Cliq icon identifiers for actions.',
					},
					{
						displayName: 'Dialog Data (JSON)',
						name: 'dialogData',
						type: 'json',
						default: '{}',
						displayOptions: {
							show: {
								actionType: ['open.dialog'],
							},
						},
						description: 'JSON payload for the dialog action',
					},
					{
						displayName: 'Function Name',
						name: 'functionName',
						type: 'string',
						default: '',
						displayOptions: {
							show: {
								actionType: ['invoke.function'],
							},
						},
						description:
							'Function name string used when Action Type is Invoke Function (`action.data.name`)',
					},
					{
						displayName: 'Hint',
						name: 'hint',
						type: 'string',
						default: '',
						description: 'Optional hint text shown for the action button',
					},
					{
						displayName: 'Key',
						name: 'key',
						type: 'string',
						default: '',
						description: 'Optional action key for downstream handling or UI context',
					},
					{
						displayName: 'Label',
						name: 'label',
						type: 'string',
						default: '',
						description: 'Action button label (maximum 20 characters)',
					},
					{
						displayName: 'Open URL',
						name: 'openUrl',
						type: 'string',
						default: '',
						placeholder: 'e.g. https://cliq.zoho.com',
						displayOptions: {
							show: {
								actionType: ['open.url'],
							},
						},
						description: 'HTTP/HTTPS URL opened when Action Type is Open URL (`action.data.web`)',
					},
					{
						displayName: 'System API',
						name: 'systemApi',
						type: 'string',
						default: '',
						placeholder: 'e.g. audiocall/1234',
						displayOptions: {
							show: {
								actionType: ['system.api'],
							},
						},
						description:
							'System API route/value used when Action Type is System API (`action.data.api`)',
					},
				],
			},
		],
		description: 'Optional action buttons shown during the call',
	},
	{
		displayName: 'App Key',
		name: 'appkey',
		type: 'string',
		default: '',
		description:
			'Extension app key string, required only when the selected bot belongs to an extension app',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		description:
			"Whether to wrap minimal API responses with workflow/AI context (`success`, `bot_unique_name`, and request summary) instead of Cliq's standard output",
	},
	{
		displayName: 'Call Payload (JSON)',
		name: 'callPayload',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Raw call payload object or JSON string. Expected shape: `{ "text": string, "user_ids"?: string[], "retry"?: 1-3, "loop"?: 1-3, "actions"?: Action[] }`.',
	},
	{
		displayName:
			'Trigger Bot Call Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Bot_Voice_Alerts" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'triggerBotCallDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Bot/Trigger Bot Calls as AI Tool Setup Guide: <a href="${BOT_TRIGGER_BOT_CALL_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'triggerBotCallAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['bot'],
		operation: ['triggerCalls'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('bot', 'triggerCalls');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedBotUniqueName: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const botUniqueName = this.getNodeParameter('botUniqueName', i) as string;
			requestedBotUniqueName = botUniqueName;
			const inputMode = this.getNodeParameter('inputMode', i) as 'structured' | 'raw';

			const sanitizedBotUniqueName = validateBotUniqueName(this, botUniqueName, i);
			const rawBody =
				inputMode === 'structured'
					? buildStructuredCallPayload(this, i)
					: parseBotPayloadInput(
							this,
							this.getNodeParameter('callPayload', i, {}) as unknown,
							i,
							'Call Payload',
						);
			const body = validateTriggerCallPayload(this, rawBody, i);
			const includeEnhancedOutputParam = this.getNodeParameter('includeEnhancedOutput', i, true) as
				| boolean
				| undefined;
			const includeEnhancedOutput = includeEnhancedOutputParam !== false;
			const appkeyParam = this.getNodeParameter('appkey', i, '') as string;

			const qs: Record<string, string> = {};
			if (appkeyParam !== undefined && appkeyParam !== null) {
				const appkey = String(appkeyParam).trim();
				if (appkey) {
					if (appkey.length > 300) {
						throw new NodeOperationError(this.getNode(), 'App Key is too long', {
							itemIndex: i,
						});
					}
					qs.appkey = appkey;
				}
			}

			const endpoint = `/api/v2/bots/${encodeURIComponent(sanitizedBotUniqueName)}/calls`;
			const response = (await zohoCliqApiRequest.call(this, 'POST', endpoint, body, qs)) as
				| IDataObject
				| undefined
				| null;
			const safeResponse = response ?? {};

			const output = includeEnhancedOutput
				? {
						...safeResponse,
						success: true,
						bot_unique_name: sanitizedBotUniqueName,
						input_mode: inputMode,
						request_summary: {
							has_user_ids: Array.isArray(body.user_ids) && body.user_ids.length > 0,
							action_count: Array.isArray(body.actions) ? body.actions.length : 0,
						},
					}
				: coerceApiResponseToObjectWithOptions(safeResponse);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: output as IDataObject }],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushBotRecoverableError(this, returnData, i, error, requestedBotUniqueName, 'triggerCalls')
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
