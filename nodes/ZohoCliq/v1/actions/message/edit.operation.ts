/**
 * Edit Message operation
 * Updates an existing message in a chat conversation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { MESSAGE_EDIT_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	encodePathSegmentPreservingEscapes,
	validateChatId,
	validateMessageId,
} from '../../helpers/utils';
import { isChatLookupNotFoundError } from '../chat/shared';
import { messagePayloadDescription, resolveMessagePayload } from '../shared/messagePayload';
import { applyDisplayOptions, messageChatIdDescription } from '../common.descriptions';
import {
	CHAT_NOT_FOUND_HINT,
	MESSAGE_NOT_FOUND_HINT,
	enrichMessageTargetLookupErrorIfPossible,
	isMessageLookupNotFoundError,
	preflightMessageTargetIfPossible,
} from '../shared/preflight';
import { pushMessageRecoverableError, resolveMessageEnhancedOutput } from './common';

const editMessagePayloadDescription: INodeProperties[] = messagePayloadDescription
	.filter(
		(property) =>
			!['postAsBot', 'botUniqueName', 'botDisplayName', 'botImage'].includes(property.name),
	)
	.map((property) => {
		if (property.name === 'text') {
			return {
				...property,
				required: false,
				description:
					'Used when Message Type resolves to Text (Cliq Markdown). Provide a non-empty string up to 5000 characters. Supports limited Zoho Cliq markdown such as `*bold*`, `_italics_`, `~strike~`, inline code, code blocks, and links. Leave blank when Message Type resolves to Advanced (JSON).',
				displayOptions: undefined,
			};
		}

		if (property.name === 'jsonBody') {
			return {
				...property,
				description:
					'Used when Message Type resolves to Advanced (JSON). Provide a raw JSON object with a non-empty top-level `text` string. Leave blank when Message Type resolves to Text (Cliq Markdown).',
				displayOptions: undefined,
			};
		}

		return property;
	});

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
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. MSG_1234567890_1234567890',
		description: 'The ID of the message to edit',
	},
	{
		displayName:
			"Permission Note: Zoho Cliq can reject edits when the message is older than the account-configured edit window, or when the authenticated identity is not allowed to edit that sender's message. Even organisation admins can receive a permissions restriction when the message is simply too old.",
		name: 'editMessagePermissionNotice',
		type: 'notice',
		default: '',
	},
	...editMessagePayloadDescription,
	{
		displayName: 'Notify Edit',
		name: 'notifyEdit',
		type: 'boolean',
		default: false,
		description:
			'Whether to post a separate edit notification message (notify_edit). Edited messages always show the "(Edited)" label even when this is disabled.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'outputEnhancedResponse',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata. Disable to return Cliq's standard success response, which may be minimal or empty.",
	},
	{
		displayName:
			'Edit Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Edit_Message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Messages.UPDATE</code>',
		name: 'editMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Message/Edit Message as AI Tool Setup Guide: <a href="${MESSAGE_EDIT_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'editMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['message'],
		operation: ['edit'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('message', 'edit');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let chatId: string | undefined;
		let messageId: string | undefined;
		let editedText: string | undefined;
		let messageType: 'text' | 'rich' | 'json' | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const rawChatId = this.getNodeParameter('chatId', i);
			if (typeof rawChatId !== 'string') {
				throw new NodeOperationError(this.getNode(), 'Invalid Chat ID: must be a string', {
					itemIndex: i,
				});
			}
			chatId = validateChatId(this, rawChatId, i, { mode: 'chatConversation' });

			const rawMessageId = this.getNodeParameter('messageId', i);
			if (typeof rawMessageId !== 'string') {
				throw new NodeOperationError(this.getNode(), 'Invalid Message ID: must be a string', {
					itemIndex: i,
				});
			}
			messageId = validateMessageId(this, rawMessageId, i);
			await preflightMessageTargetIfPossible(this, chatId, messageId, i, grantedScopes);
			messageType = this.getNodeParameter('messageType', i) as 'text' | 'rich' | 'json';

			const body = resolveMessagePayload(this, i, {
				textMaxLength: 5000,
				textTypeErrorMessage: 'Invalid text message: must be a string',
				requireMessageContent: true,
				includeBotIdentity: false,
			});

			if (typeof body.text === 'string') {
				editedText = body.text;
			}

			const notifyEditParam = this.getNodeParameter('notifyEdit', i, false) as unknown;
			const notifyEdit =
				notifyEditParam === undefined || notifyEditParam === null ? false : notifyEditParam;
			if (typeof notifyEdit !== 'boolean') {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid notifyEdit value: must be a boolean',
					{
						itemIndex: i,
					},
				);
			}

			body.notify_edit = notifyEdit;

			const endpoint = `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodePathSegmentPreservingEscapes(messageId)}`;
			const response = (await zohoCliqApiRequest.call(this, 'PUT', endpoint, body)) as IDataObject;
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveMessageEnhancedOutput(
				this,
				i,
				response,
				'outputEnhancedResponse',
				true,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									updated: true,
									success: true,
									resource: 'message',
									operation: 'edit',
									chat_id: chatId,
									message_id: messageId,
									message_type: messageType,
									...(editedText !== undefined ? { edited_text: editedText } : {}),
									notify_edit: notifyEdit,
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
			const errorForOutput = await enrichMessageTargetLookupErrorIfPossible(
				this,
				error,
				i,
				grantedScopes,
				chatId,
				messageId,
			);

			if (
				pushMessageRecoverableError(this, returnData, i, 'edit', errorForOutput, {
					contextFields: {
						...(chatId ? { chat_id: chatId } : {}),
						...(messageId ? { message_id: messageId } : {}),
						...(messageType ? { message_type: messageType } : {}),
						...(editedText !== undefined ? { text: editedText } : {}),
					},
					messageMappings: [
						{
							match: (_normalizedMessage, _message, error) => isChatLookupNotFoundError(error),
							reason: 'CHAT_NOT_FOUND',
							hint: CHAT_NOT_FOUND_HINT,
						},
						{
							match: (_normalizedMessage, _message, error) => isMessageLookupNotFoundError(error),
							reason: 'MESSAGE_NOT_FOUND',
							hint: MESSAGE_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('must start with a number or "ct_"'),
							reason: 'INVALID_CHAT_ID',
							hint: "Chat ID must start with a number or 'CT_'. It appears a Channel ID or other non-chat identifier was provided. Use Get a Channel to obtain the channel's Chat ID, or verify the correct Chat ID for this conversation.",
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_CHAT_ID',
							hint: 'Use the chat ID that contains the message you want to edit. Do not pass a channel ID or thread ID here.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('message id is required') ||
								normalizedMessage.includes('invalid message id format') ||
								normalizedMessage.includes('message id is too long'),
							reason: 'INVALID_MESSAGE_ID',
							hint: 'Use the exact Zoho Cliq message ID returned by Get Messages or Retrieve Message.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'advanced (json) must include a top-level "text" field',
								) ||
								normalizedMessage.includes('advanced (json) "text" must be a string') ||
								normalizedMessage.includes('json payload cannot be empty'),
							reason: 'INVALID_RAW_JSON_PAYLOAD',
							hint: 'Use Advanced (JSON) only with a JSON object that includes a non-empty top-level `text` string. Use Text (Cliq Markdown) for simple edits.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('text is required') ||
								normalizedMessage.includes('invalid text') ||
								normalizedMessage.includes('text is too long') ||
								normalizedMessage.includes('invalid message type') ||
								normalizedMessage.includes('card text exceeds') ||
								normalizedMessage.includes('text slide at index') ||
								normalizedMessage.includes('rich message payload exceeds'),
							reason: 'INVALID_MESSAGE_CONTENT',
							hint: 'Provide valid replacement message content. Plain text and top-level rich/json text must stay within the documented character limits.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('disabled your permission to edit messages') ||
								normalizedMessage.includes('permission to edit messages'),
							reason: 'EDIT_NOT_ALLOWED',
							hint: "Zoho Cliq can reject edits when the message is older than the account-configured edit window, when the authenticated identity is not allowed to edit that sender's message, or when account policy blocks editing for that message.",
							messageOverride:
								"Zoho Cliq rejected this edit-message request because editing this message is not allowed. The message may be older than the account-configured edit window, or the authenticated identity may not be allowed to edit that sender's message.",
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									"couldn't process your request due to a technical error",
								) ||
								normalizedMessage.includes('technical error') ||
								normalizedMessage.includes('file system error'),
							reason: 'EDIT_REJECTED',
							hint: 'Verify the chat ID and message ID are correct, and check whether the message is outside the account-configured edit window or belongs to a sender identity the authenticated account cannot edit.',
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
