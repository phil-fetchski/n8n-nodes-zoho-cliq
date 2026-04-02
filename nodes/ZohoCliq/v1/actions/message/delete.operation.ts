/**
 * Delete Message operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { hasRequiredScope } from '../../../../../credentials/ZohoCliqOAuth2Api.credentials';
import { zohoCliqApiRequest } from '../../transport';
import { MESSAGE_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import {
	getRequiredScopeForOperation,
	listAcceptedScopesForConditionalRequirement,
} from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	encodePathSegmentPreservingEscapes,
	validateChatId,
	validateMessageId,
} from '../../helpers/utils';
import { isChatLookupNotFoundError } from '../chat/shared';
import { applyDisplayOptions, messageChatIdDescription } from '../common.descriptions';
import {
	CHAT_NOT_FOUND_HINT,
	MESSAGE_NOT_FOUND_HINT,
	enrichMessageTargetLookupErrorIfPossible,
	isMessageLookupNotFoundError,
	validateMessageExistsOrThrow,
} from '../shared/preflight';
import { pushMessageRecoverableError, resolveMessageEnhancedOutput } from './common';

const MESSAGE_LOOKUP_SCOPE_REQUIRED_ERROR_CODE = 'MESSAGE_LOOKUP_SCOPE_REQUIRED';

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
		placeholder: 'e.g. MSG_1234567890',
		description: 'The ID of the message to delete',
	},
	{
		displayName:
			"Permission Note: This permanently deletes the message and cannot be undone. Zoho Cliq can reject deletion when the message is older than the account-configured delete window, or when the authenticated identity is not allowed to delete that sender's message. Even organisation admins can receive a permissions restriction when the message is simply too old.",
		name: 'deleteMessagePermissionNotice',
		type: 'notice',
		default: '',
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
			'Delete Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Delete_Message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Messages.DELETE</code>. PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Messages.READ</code>',
		name: 'deleteMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Message/Delete Message as AI Tool Setup Guide: <a href="${MESSAGE_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['message'],
		operation: ['delete'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function assertDeleteMessagePreflightScopes(
	context: IExecuteFunctions,
	grantedScopes: string,
	itemIndex: number,
): void {
	const messageLookupScopes = listAcceptedScopesForConditionalRequirement(
		'message',
		'delete',
		'messageLookupPreflight',
	);
	if (!messageLookupScopes?.length) {
		throw new Error(
			'Message.delete messageLookupPreflight scope registry entry is missing or empty.',
		);
	}

	if (!messageLookupScopes.some((scope) => hasRequiredScope(grantedScopes, scope))) {
		const scopeError = new NodeOperationError(
			context.getNode(),
			'Delete Message requires message-read access so the node can verify the supplied Message ID before attempting deletion.',
			{
				itemIndex,
				description:
					'Reconnect the Zoho Cliq credentials with Messages.READ access, then retry so the node can preflight the message before calling the Delete Message endpoint.',
			},
		);
		(scopeError as NodeOperationError & { code?: string }).code =
			MESSAGE_LOOKUP_SCOPE_REQUIRED_ERROR_CODE;
		throw scopeError;
	}
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('message', 'delete');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let chatId: string | undefined;
		let messageId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			chatId = validateChatId(this, this.getNodeParameter('chatId', i) as string, i);
			messageId = validateMessageId(this, this.getNodeParameter('messageId', i) as string, i);
			assertDeleteMessagePreflightScopes(this, grantedScopes, i);
			await validateMessageExistsOrThrow(this, chatId, messageId, i);

			const endpoint = `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodePathSegmentPreservingEscapes(messageId)}`;

			const response = (await zohoCliqApiRequest.call(this, 'DELETE', endpoint)) as IDataObject;
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
									deleted: true,
									success: true,
									resource: 'message',
									operation: 'delete',
									chat_id: chatId,
									message_id: messageId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
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
				pushMessageRecoverableError(this, returnData, i, 'delete', errorForOutput, {
					contextFields: {
						...(chatId ? { chat_id: chatId } : {}),
						...(messageId ? { message_id: messageId } : {}),
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
							hint: 'Use the chat ID that contains the target message. Do not pass a channel ID or thread ID here.',
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
							match: (_normalizedMessage, _message, error) =>
								error instanceof NodeOperationError &&
								(error as NodeOperationError & { code?: string }).code ===
									MESSAGE_LOOKUP_SCOPE_REQUIRED_ERROR_CODE,
							reason: 'MESSAGE_LOOKUP_SCOPE_REQUIRED',
							hint: 'Reconnect the Zoho Cliq credentials with Messages.READ access so the node can verify the message before deleting it.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('disabled your permission to delete messages') ||
								normalizedMessage.includes('permission to delete messages'),
							reason: 'DELETE_NOT_ALLOWED',
							hint: "Zoho Cliq can reject deletion when the message is older than the account-configured delete window, when the authenticated identity is not allowed to delete that sender's message, or when account policy blocks deletion for that message.",
							messageOverride:
								"Zoho Cliq rejected this delete-message request because deleting this message is not allowed. The message may be older than the account-configured delete window, or the authenticated identity may not be allowed to delete that sender's message.",
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									"couldn't process your request due to a technical error",
								) || normalizedMessage.includes('technical error'),
							reason: 'DELETE_REJECTED',
							hint: 'Verify the chat ID and message ID are correct, and check whether the message is outside the account-configured delete window or belongs to a sender identity the authenticated account cannot delete.',
						},
						{
							match: (_normalizedMessage, _message, error) => isMessageLookupNotFoundError(error),
							reason: 'MESSAGE_NOT_FOUND',
							hint: MESSAGE_NOT_FOUND_HINT,
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
