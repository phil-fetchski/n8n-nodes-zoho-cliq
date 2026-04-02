/**
 * Unpin Message operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHAT_UNPIN_STICKY_MESSAGE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChatId } from '../../helpers/utils';
import {
	assertChatLookupPreflightScopesOrThrow,
	CHAT_NOT_FOUND_HINT,
	validateChatExistsIfPossible,
} from '../shared/preflight';
import {
	isChatAiErrorModeEnabled,
	isChatLookupNotFoundError,
	normalizeZohoMessageIdOutput,
	pushChatRecoverableError,
	resolveChatEnhancedOutput,
} from './shared';
import { applyDisplayOptions } from '../common.descriptions';

function isEmptyStickyMessageResponse(response: IDataObject): boolean {
	const data = response.data;
	return Boolean(
		data &&
		typeof data === 'object' &&
		!Array.isArray(data) &&
		Object.keys(data as Record<string, unknown>).length === 0,
	);
}

function extractPinnedMessageId(response: IDataObject): string | undefined {
	const data = response.data;
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return undefined;
	}

	const dataObject = data as IDataObject;
	const message = dataObject.message;
	if (message && typeof message === 'object' && !Array.isArray(message)) {
		const messageObject = message as IDataObject;
		const msguid = String(messageObject.msguid ?? '').trim();
		if (msguid) {
			return normalizeZohoMessageIdOutput(msguid);
		}

		const messageId = String(messageObject.id ?? '').trim();
		if (messageId) {
			return normalizeZohoMessageIdOutput(messageId);
		}
	}

	const directId = String(dataObject.id ?? '').trim();
	return directId ? normalizeZohoMessageIdOutput(directId) : undefined;
}

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Required Zoho Cliq chat ID for the conversation where the current pinned message should be unpinned. This is not a channel ID. Chat IDs may be all-numeric for some direct/private chats or use a `CT_...` style in other chat contexts.',
		placeholder: 'e.g. CT1234567890',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata. Disable to return Cliq's standard success response, which may be minimal or empty.",
	},
	{
		displayName:
			'Unpin Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#unpin-message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Chats.DELETE</code>. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>',
		name: 'unpinStickyMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Chat/Unpin Message as AI Tool Setup Guide: <a href="${CHAT_UNPIN_STICKY_MESSAGE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'unpinStickyMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['chat'],
		operation: ['unpinStickyMessage'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('chat', 'unpinStickyMessage');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChatId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const chatId = String(this.getNodeParameter('chatId', i));
			const trimmedChatId = chatId.trim();
			requestedChatId = trimmedChatId;
			const sanitizedChatId = validateChatId(this, trimmedChatId, i);
			assertChatLookupPreflightScopesOrThrow(this, grantedScopes, i, {
				resource: 'chat',
				operation: 'unpinStickyMessage',
				missingScopeMessage:
					'Unpin Message also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before unpinning the pinned message.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, sanitizedChatId, i, grantedScopes);

			const pinnedMessageResponse = (await zohoCliqApiRequest.call(
				this,
				'GET',
				`/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/stickymessage`,
			)) as IDataObject;

			if (isEmptyStickyMessageResponse(pinnedMessageResponse)) {
				const noStickyMessage = 'No pinned message is currently set in this chat.';
				const noStickyHint =
					'Verify the chat ID is correct and confirm a pinned message is currently set before trying to unpin it.';

				if (
					isChatAiErrorModeEnabled(this, i) ||
					(typeof this.continueOnFail === 'function' && this.continueOnFail())
				) {
					const executionData = this.helpers.constructExecutionMetaData(
						[
							{
								json: {
									success: false,
									resource: 'chat',
									operation: 'unpinStickyMessage',
									chat_id: sanitizedChatId,
									reason: 'NO_PINNED_MESSAGE',
									message: noStickyMessage,
									hint: noStickyHint,
								},
							},
						],
						{
							itemData: { item: i },
						},
					);

					returnData.push(...executionData);
					continue;
				}

				throw new NodeOperationError(this.getNode(), noStickyMessage, {
					itemIndex: i,
					description: noStickyHint,
				});
			}

			const unpinnedMessageId = extractPinnedMessageId(pinnedMessageResponse);

			const response = (await zohoCliqApiRequest.call(
				this,
				'DELETE',
				`/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/stickymessage`,
			)) as IDataObject;

			const { includeEnhancedOutput, responseJson, rawResponse } = resolveChatEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									success: true,
									operation: 'unpinStickyMessage',
									chat_id: sanitizedChatId,
									...(unpinnedMessageId ? { unpinned_message_id: unpinnedMessageId } : {}),
									...responseJson,
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
				pushChatRecoverableError(this, returnData, i, 'unpinStickyMessage', error, {
					contextFields:
						requestedChatId && requestedChatId.length > 0
							? { chat_id: requestedChatId }
							: undefined,
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
							hint: 'Verify chat ID format and confirm the chat exists before unpinning its pinned message.',
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
