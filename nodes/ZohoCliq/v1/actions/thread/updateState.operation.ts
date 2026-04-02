/**
 * Update Thread State operation
 * Closes or reopens a thread
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { THREAD_UPDATE_STATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import {
	checkRequiredScope,
	validateThreadChatId,
	validateThreadAction,
} from '../../helpers/utils';
import { runThreadLookupPreflightGate } from '../shared/preflight';
import {
	pushThreadRecoverableError,
	resolveThreadEnhancedOutput,
	THREAD_NOT_FOUND_HINT,
	THREAD_NOT_FOUND_MESSAGE,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('thread', 'updateState');

const properties: INodeProperties[] = [
	{
		displayName: 'Thread Chat ID',
		name: 'threadChatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. CT_1234567890_1234567890-T-1234567890',
		description: 'The chat ID of the thread (format: CT_...-T-...)',
	},
	{
		displayName: 'Action',
		name: 'action',
		type: 'options',
		options: [
			{ name: 'Close', value: 'close' },
			{ name: 'Reopen', value: 'reopen' },
		],
		default: 'close',
		required: true,
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal update-state response. Disable to return Cliq's standard response.",
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Bot Unique Name',
				name: 'botUniqueName',
				type: 'string',
				default: '',
				description:
					'Use this parameter to perform the action as a bot already participating in the channel. Use lowercase letters only (a-z).',
			},
			{
				displayName: 'App Key',
				name: 'appKey',
				type: 'string',
				default: '',
				description:
					'Required when the selected bot belongs to an extension. Only valid with Bot Unique Name.',
			},
		],
	},
	{
		displayName: `Thread State Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#thread-state" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateThreadStateDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/Update State as AI Tool Setup Guide: <a href="${THREAD_UPDATE_STATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateThreadStateAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['updateState'],
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
		let requestedThreadChatId = '';
		let requestedAction = '';
		let requestedBotUniqueName = '';
		let requestedAppKey = '';
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const threadChatId = String(this.getNodeParameter('threadChatId', i));
			const action = String(this.getNodeParameter('action', i));
			const additionalFields = (this.getNodeParameter('additionalFields', i, {}) ??
				{}) as IDataObject;
			requestedThreadChatId = threadChatId.trim();
			requestedAction = action.trim();

			const sanitizedThreadChatId = validateThreadChatId(this, requestedThreadChatId, i);
			const sanitizedAction = validateThreadAction(this, requestedAction, i);
			const qs: Record<string, string> = {};

			const botUniqueName = String(additionalFields.botUniqueName ?? '').trim();
			if (botUniqueName) {
				requestedBotUniqueName = botUniqueName;
				if (!/^[a-z]+$/.test(botUniqueName)) {
					throw new NodeOperationError(
						this.getNode(),
						'Bot Unique Name must use lowercase letters only (a-z), with no numbers, spaces, or special characters',
						{
							itemIndex: i,
						},
					);
				}
				if (botUniqueName.length > 30) {
					throw new NodeOperationError(
						this.getNode(),
						'Bot Unique Name is too long. Maximum length is 30 characters.',
						{
							itemIndex: i,
						},
					);
				}
				qs.bot_unique_name = botUniqueName;
			}

			const appKey = String(additionalFields.appKey ?? '').trim();
			if (appKey) {
				requestedAppKey = appKey;
				if (appKey.length > 300) {
					throw new NodeOperationError(this.getNode(), 'App Key is too long', {
						itemIndex: i,
					});
				}
				if (!qs.bot_unique_name) {
					throw new NodeOperationError(
						this.getNode(),
						'App Key can only be used when Bot Unique Name is provided',
						{
							itemIndex: i,
						},
					);
				}
				qs.appkey = appKey;
			}

			// Build request body
			const body: IDataObject = {
				action: sanitizedAction,
			};

			await runThreadLookupPreflightGate(this, i, grantedScopes, sanitizedThreadChatId);

			const endpoint = `/api/v2/threads/${encodeURIComponent(sanitizedThreadChatId)}`;
			const response =
				Object.keys(qs).length > 0
					? await zohoCliqApiRequest.call(this, 'PUT', endpoint, body, qs)
					: await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveThreadEnhancedOutput(
				this,
				i,
				response,
				true,
			);
			const threadState = sanitizedAction === 'close' ? 'closed' : 'open';

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									updated: true,
									success: true,
									resource: 'thread',
									operation: 'updateState',
									thread_chat_id: sanitizedThreadChatId,
									action: sanitizedAction,
									thread_state: threadState,
									...(qs.bot_unique_name ? { bot_unique_name: qs.bot_unique_name } : {}),
									...(qs.appkey ? { appkey: qs.appkey } : {}),
								}
							: { ...(rawResponse as IDataObject), updated: true },
					},
				],
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushThreadRecoverableError(this, returnData, i, 'updateState', error, {
					contextFields: {
						...(requestedThreadChatId ? { thread_chat_id: requestedThreadChatId } : {}),
						...(requestedAction ? { action: requestedAction } : {}),
						...(requestedBotUniqueName ? { bot_unique_name: requestedBotUniqueName } : {}),
						...(requestedAppKey ? { appkey: requestedAppKey } : {}),
					},
					fallbackMessage: 'Unable to update the thread state in Zoho Cliq.',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(THREAD_NOT_FOUND_MESSAGE.toLowerCase()),
							reason: 'THREAD_NOT_FOUND',
							messageOverride: THREAD_NOT_FOUND_MESSAGE,
							hint: THREAD_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_THREAD_CHAT_ID',
							hint: 'Use the exact thread chat ID returned by List Threads for Channel or Get Main Message before changing the thread state.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('invalid thread action'),
							reason: 'INVALID_THREAD_ACTION',
							hint: 'Use `close` to close a thread or `reopen` to reopen a previously closed thread.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('bot unique name must use lowercase letters only') ||
								normalizedMessage.includes('bot unique name is too long'),
							reason: 'INVALID_BOT_UNIQUE_NAME',
							hint: 'Use the exact bot unique name in lowercase letters only (a-z). If the request is not acting as a bot, leave Bot Unique Name blank.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'app key can only be used when bot unique name is provided',
								) || normalizedMessage.includes('app key is too long'),
							reason: 'INVALID_APPKEY_CONFIGURATION',
							hint: 'Only send `appkey` when `bot_unique_name` is also provided, and use the extension app key value exactly as issued.',
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
