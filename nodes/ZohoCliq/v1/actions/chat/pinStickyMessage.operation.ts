/**
 * Pin Message operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHAT_PIN_STICKY_MESSAGE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import {
	checkRequiredScope,
	extractErrorText,
	validateChatId,
	validateMessageId,
} from '../../helpers/utils';
import {
	assertChatLookupPreflightScopesOrThrow,
	CHAT_NOT_FOUND_HINT,
	validateChatExistsIfPossible,
} from '../shared/preflight';
import {
	isChatLookupNotFoundError,
	normalizeStickyMessageResponseOutput,
	normalizeZohoMessageIdOutput,
	pushChatRecoverableError,
	resolveChatEnhancedOutput,
} from './shared';
import { applyDisplayOptions } from '../common.descriptions';

const INVALID_EXPIRY_TIME_HINT =
	'Use a future date-time or a future epoch timestamp in milliseconds for Expire At, or leave it blank to create a pinned message with no expiry.';

function safeInteger(value: number): number {
	if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
		return Number.NaN;
	}

	return value;
}

function parseExpireAtValue(rawExpireAt: unknown): number | null {
	if (rawExpireAt === undefined || rawExpireAt === null) {
		return null;
	}

	if (typeof rawExpireAt === 'number') {
		return safeInteger(rawExpireAt);
	}

	if (rawExpireAt instanceof Date) {
		return safeInteger(rawExpireAt.getTime());
	}

	if (typeof rawExpireAt === 'string') {
		const trimmed = rawExpireAt.trim();
		if (!trimmed) {
			return null;
		}

		if (/^\d+$/.test(trimmed)) {
			return safeInteger(Number(trimmed));
		}

		return safeInteger(new Date(trimmed).getTime());
	}

	const maybeDateTime = Object(rawExpireAt) as {
		toMillis?: () => number;
		ts?: number;
		valueOf?: () => unknown;
	};

	const toMillis = maybeDateTime.toMillis;
	if (typeof toMillis === 'function') {
		return safeInteger(toMillis.call(maybeDateTime));
	}

	const ts = maybeDateTime.ts;
	if (typeof ts === 'number') {
		return safeInteger(ts);
	}

	const valueOfFn = maybeDateTime.valueOf;
	if (typeof valueOfFn === 'function') {
		const value = valueOfFn.call(maybeDateTime);
		if (typeof value === 'number') {
			return safeInteger(value);
		}
	}

	return Number.NaN;
}

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Required Zoho Cliq chat ID for the conversation where the message should be pinned. This is not a channel ID. Chat IDs may be all-numeric for some direct/private chats or use a `CT_...` style in other chat contexts.',
		placeholder: 'e.g. CT1234567890',
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Required Zoho Cliq message ID (`msguid`) of the existing message to pin as the pinned message. Use the exact message ID value returned by Zoho Cliq. Encoded message IDs such as `1573708648341%20375412769224` are allowed.',
		placeholder: 'e.g. 1573708648341_375412769224',
	},
	{
		displayName: 'Pin Options',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Notification or Expiry Option',
		options: [
			{
				displayName: 'Notify',
				name: 'notify',
				type: 'boolean',
				default: false,
				description: 'Whether Zoho Cliq should notify chat participants when the message is pinned',
			},
			{
				displayName: 'Expire At',
				name: 'expireAt',
				type: 'dateTime',
				default: '',
				description:
					'Optional future expiry for the pinned message. You may provide a date-time value or an epoch timestamp in milliseconds. If using an ISO 8601 date-time, prefer a timezone offset or `Z`/UTC to avoid ambiguity, but a plain date such as `2027-12-31` is also accepted and is interpreted as midnight UTC. Blank values are allowed and treated as no expiry.',
			},
		],
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata together with the API response. Disable to return Cliq's standard pin response only.",
	},
	{
		displayName:
			'Pin Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#pin-message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Chats.CREATE</code>. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>',
		name: 'pinStickyMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Chat/Pin Message as AI Tool Setup Guide: <a href="${CHAT_PIN_STICKY_MESSAGE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'pinStickyMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['chat'],
		operation: ['pinStickyMessage'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('chat', 'pinStickyMessage');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChatId: string | undefined;
		let requestedMessageId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const chatId = this.getNodeParameter('chatId', i) as string;
			const messageId = this.getNodeParameter('messageId', i) as string;
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

			requestedChatId = chatId.trim();
			requestedMessageId = messageId.trim();

			const sanitizedChatId = validateChatId(this, chatId, i);
			const sanitizedMessageId = validateMessageId(this, messageId, i);
			assertChatLookupPreflightScopesOrThrow(this, grantedScopes, i, {
				resource: 'chat',
				operation: 'pinStickyMessage',
				missingScopeMessage:
					'Pin Message also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before pinning a message.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, sanitizedChatId, i, grantedScopes);

			const notify = (additionalFields.notify as boolean | undefined) ?? false;
			const expireAt = additionalFields.expireAt;
			let expiryTime = -1;
			let absoluteExpiryTime: number | null = null;

			const parsedExpireAt = parseExpireAtValue(expireAt);
			if (parsedExpireAt !== null) {
				if (!Number.isFinite(parsedExpireAt) || parsedExpireAt < 0) {
					throw new NodeOperationError(
						this.getNode(),
						'Expire At must be a valid datetime or non-negative epoch timestamp in milliseconds',
						{ itemIndex: i },
					);
				}

				absoluteExpiryTime = Math.floor(parsedExpireAt);
				expiryTime = absoluteExpiryTime - Date.now();
				if (expiryTime <= 0) {
					throw new NodeOperationError(this.getNode(), 'Expire At must be a future datetime', {
						itemIndex: i,
					});
				}
			}

			let body: IDataObject = {
				id: sanitizedMessageId,
				notify,
				expiry_time: expiryTime,
			};

			let response: IDataObject;
			try {
				response = (await zohoCliqApiRequest.call(
					this,
					'POST',
					`/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/stickymessage`,
					body,
				)) as IDataObject;
			} catch (error) {
				const errorText = extractErrorText(error).toLowerCase();
				const hasExpiryFormatSignal =
					/(expiry_time|invalid timestamp|timestamp.*format|expiry.*invalid.*format)/.test(
						errorText,
					);

				if (!hasExpiryFormatSignal) {
					throw error;
				}

				if (absoluteExpiryTime === null) {
					throw error;
				}

				// Some environments expect absolute epoch milliseconds instead of relative duration.
				body = {
					...body,
					expiry_time: absoluteExpiryTime,
				};

				try {
					response = (await zohoCliqApiRequest.call(
						this,
						'POST',
						`/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/stickymessage`,
						body,
					)) as IDataObject;
				} catch (fallbackError) {
					const primaryMessage = error instanceof Error ? error.message : String(error);
					const fallbackMessage =
						fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
					throw new NodeOperationError(
						this.getNode(),
						`Pin Message failed with both expiry formats. Tried timespan expiry_time=${expiryTime} and epoch expiry_time=${absoluteExpiryTime}. Errors: primary="${primaryMessage}", fallback="${fallbackMessage}"`,
						{ itemIndex: i },
					);
				}
			}

			const { includeEnhancedOutput, responseJson, rawResponse } = resolveChatEnhancedOutput(
				this,
				i,
				response,
			);
			const normalizedResponseJson = normalizeStickyMessageResponseOutput(
				responseJson,
			) as IDataObject;

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									success: true,
									operation: 'pinStickyMessage',
									chat_id: sanitizedChatId,
									message_id: normalizeZohoMessageIdOutput(sanitizedMessageId),
									notify,
									expiry_time: absoluteExpiryTime ?? -1,
									...normalizedResponseJson,
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
			const contextFields: IDataObject = {};
			if (requestedChatId?.length) {
				contextFields.chat_id = requestedChatId;
			}
			if (requestedMessageId?.length) {
				contextFields.message_id = requestedMessageId;
			}

			if (
				pushChatRecoverableError(this, returnData, i, 'pinStickyMessage', error, {
					contextFields: Object.keys(contextFields).length > 0 ? contextFields : undefined,
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
							hint: 'Verify chat ID format and confirm the chat exists before pinning a message.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('message id is required') ||
								normalizedMessage.includes('invalid message id format') ||
								normalizedMessage.includes('message id is too long'),
							reason: 'INVALID_MESSAGE_ID',
							hint: 'Use the exact Zoho Cliq message ID (`msguid`) of an existing message in that chat.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('expire at must be a future datetime') ||
								normalizedMessage.includes('expire at must be a valid datetime'),
							reason: 'INVALID_EXPIRY_TIME',
							hint: INVALID_EXPIRY_TIME_HINT,
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
