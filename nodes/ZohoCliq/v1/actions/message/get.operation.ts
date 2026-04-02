/**
 * Get Messages operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MESSAGE_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChatId } from '../../helpers/utils';
import { isChatLookupNotFoundError } from '../chat/shared';
import { applyDisplayOptions, messageChatIdDescription } from '../common.descriptions';
import {
	assertChatLookupPreflightScopesOrThrow,
	CHAT_NOT_FOUND_HINT,
	enrichMessageChatLookupErrorIfPossible,
	validateChatExistsIfPossible,
} from '../shared/preflight';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { pushMessageRecoverableError } from './common';

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. CT_1234567890_1234567890',
		description: messageChatIdDescription,
	},
	{
		displayName: 'Optional Filters',
		name: 'optionalFilters',
		type: 'fixedCollection',
		placeholder: 'Add Filters',
		description: 'Optional filters to apply when retrieving messages',
		typeOptions: {
			multipleValues: false,
			fixedCollection: {
				itemTitle: 'Optional Filter',
			},
		},
		default: {},
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				values: [
					{
						displayName: 'From Time',
						name: 'fromtime',
						type: 'dateTime',
						default: '',
						description:
							'Filter messages from this time. Use Unix milliseconds or an ISO 8601 date/time string such as `2025-01-01T00:00:00Z`. Sent to Zoho Cliq as `fromtime` in epoch milliseconds.',
					},
					{
						displayName: 'To Time',
						name: 'totime',
						type: 'dateTime',
						default: '',
						description:
							'Filter messages until this time. Use Unix milliseconds or an ISO 8601 date/time string such as `2025-01-01T23:59:59Z`. Sent to Zoho Cliq as `totime` in epoch milliseconds.',
					},
					{
						displayName: 'Limit',
						name: 'limit',
						type: 'number',
						// eslint-disable-next-line n8n-nodes-base/node-param-default-wrong-for-limit
						default: '',
						placeholder: 'e.g. 100',
						typeOptions: {
							minValue: 1,
							maxValue: 100,
						},
						description: 'Max number of results to return',
					},
				],
			},
		],
	},
	...getSimplifyParameters('messageListItem', 'message', 'get'),
	{
		displayName:
			'Get Messages Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Get_Messages" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Messages.READ</code>. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>',
		name: 'getMessagesDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Message/Get Messages as AI Tool Setup Guide: <a href="${MESSAGE_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getMessagesAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['message'],
		operation: ['get'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function hasGenericTechnicalErrorSignal(normalizedMessage: string): boolean {
	if (normalizedMessage.includes("couldn't process your request due to a technical error")) {
		return true;
	}

	return normalizedMessage.includes('technical error');
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('message', 'get');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let chatId: string | undefined;
		let fromtime: number | undefined;
		let totime: number | undefined;
		let limit: number | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			chatId = validateChatId(this, this.getNodeParameter('chatId', i) as string, i);
			assertChatLookupPreflightScopesOrThrow(this, grantedScopes, i, {
				resource: 'message',
				operation: 'get',
				missingScopeMessage:
					'Get Messages also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before reading messages from this conversation.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, chatId, i, grantedScopes);
			const optionalFiltersRaw = (this.getNodeParameter('optionalFilters', i, {}) ??
				{}) as IDataObject;
			const optionalFiltersValue = optionalFiltersRaw.filter;
			const optionalFilters =
				optionalFiltersValue && typeof optionalFiltersValue === 'object'
					? (optionalFiltersValue as Record<string, unknown>)
					: (optionalFiltersRaw as Record<string, unknown>);

			const parseTimestamp = (label: string, value: unknown): number | undefined => {
				if (value === undefined || value === null) {
					return undefined;
				}

				if (typeof value === 'number' && Number.isFinite(value)) {
					if (!Number.isInteger(value) || value < 0) {
						throw new NodeOperationError(
							this.getNode(),
							`${label} must be a non-negative timestamp in milliseconds or a valid date/time value`,
							{ itemIndex: i },
						);
					}
					return value;
				}

				if (value instanceof Date) {
					const timestamp = value.getTime();
					if (!Number.isFinite(timestamp) || timestamp < 0) {
						throw new NodeOperationError(
							this.getNode(),
							`${label} must be a non-negative timestamp in milliseconds or a valid date/time value`,
							{ itemIndex: i },
						);
					}
					return timestamp;
				}

				if (typeof value === 'object' && value !== null) {
					const candidate = value as { toMillis?: () => number; ts?: unknown };
					if (typeof candidate.toMillis === 'function') {
						return parseTimestamp(label, candidate.toMillis());
					}
					if (candidate.ts !== undefined) {
						return parseTimestamp(label, candidate.ts);
					}
				}

				const input = String(value).trim();
				if (!input) {
					return undefined;
				}

				const parsed = /^-?\d+$/.test(input) ? Number(input) : Date.parse(input);
				if (!Number.isInteger(parsed) || parsed < 0) {
					throw new NodeOperationError(
						this.getNode(),
						`${label} must be a non-negative timestamp in milliseconds or a valid date/time value`,
						{ itemIndex: i },
					);
				}

				return parsed;
			};

			fromtime = parseTimestamp('From Time', optionalFilters.fromtime);
			totime = parseTimestamp('To Time', optionalFilters.totime);

			const qs: Record<string, number> = {};
			if (fromtime !== undefined) {
				qs.fromtime = fromtime;
			}
			if (totime !== undefined) {
				qs.totime = totime;
			}

			if (optionalFilters.limit !== undefined && optionalFilters.limit !== null) {
				const limitInput =
					typeof optionalFilters.limit === 'string'
						? optionalFilters.limit.trim()
						: optionalFilters.limit;
				if (limitInput !== '') {
					const parsedLimit = Number(limitInput);
					if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
						throw new NodeOperationError(
							this.getNode(),
							'Limit must be a whole number between 1 and 100',
							{
								itemIndex: i,
							},
						);
					}
					limit = parsedLimit;
					qs.limit = parsedLimit;
				}
			}

			const endpoint = `/api/v2/chats/${encodeURIComponent(chatId)}/messages`;
			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				endpoint,
				undefined,
				Object.keys(qs).length > 0 ? qs : undefined,
			);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('messageListItem');
			const listItems = applySimplifyModeToList(response, 'data', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			const errorForOutput = await enrichMessageChatLookupErrorIfPossible(
				this,
				error,
				i,
				grantedScopes,
				chatId,
			);

			if (
				pushMessageRecoverableError(this, returnData, i, 'get', errorForOutput, {
					contextFields: {
						...(chatId ? { chat_id: chatId } : {}),
						...(fromtime !== undefined ? { fromtime } : {}),
						...(totime !== undefined ? { totime } : {}),
						...(limit !== undefined ? { limit } : {}),
					},
					messageMappings: [
						{
							match: (_normalizedMessage, _message, error) => isChatLookupNotFoundError(error),
							reason: 'CHAT_NOT_FOUND',
							hint: CHAT_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_CHAT_ID',
							hint: 'Use the Zoho Cliq chat ID for the conversation whose messages you want to read.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('from time must be') ||
								normalizedMessage.includes('to time must be'),
							reason: 'INVALID_TIME_FILTER',
							hint: 'Provide `From Time` and `To Time` as Unix milliseconds or ISO 8601 date/time strings such as `2025-01-01T00:00:00Z`.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('limit must be'),
							reason: 'INVALID_LIMIT',
							hint: 'Use a whole-number `Limit` from 1 to 100, or omit it.',
						},
						{
							match: (normalizedMessage) => hasGenericTechnicalErrorSignal(normalizedMessage),
							reason: 'GET_MESSAGES_REJECTED',
							hint: 'Zoho Cliq rejected the request before returning messages. Verify the request parameters and retry. If the issue continues, confirm the conversation is accessible to the authenticated account.',
						},
					],
				})
			) {
				continue;
			}

			throw errorForOutput;
		}
	}

	return returnData;
}
