/**
 * Retrieve Message operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { MESSAGE_RETRIEVE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
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
} from '../shared/preflight';
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
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 1234567890_abcdef123456',
		description:
			'The exact Zoho Cliq message ID to retrieve from the selected chat. This must be a message ID, not a thread ID.',
	},
	{
		displayName:
			'Retrieve Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Retrieve_Message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Messages.READ</code>',
		name: 'retrieveMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Message/Retrieve Message as AI Tool Setup Guide: <a href="${MESSAGE_RETRIEVE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'retrieveMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['message'],
		operation: ['retrieve'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('message', 'retrieve');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let chatId: string | undefined;
		let messageId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			chatId = validateChatId(this, this.getNodeParameter('chatId', i) as string, i);
			messageId = validateMessageId(this, this.getNodeParameter('messageId', i) as string, i);

			const endpoint = `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodePathSegmentPreservingEscapes(messageId)}`;

			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});

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
				pushMessageRecoverableError(this, returnData, i, 'retrieve', errorForOutput, {
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
							match: (_normalizedMessage, _message, error) => isMessageLookupNotFoundError(error),
							reason: 'MESSAGE_NOT_FOUND',
							hint: MESSAGE_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_CHAT_ID',
							hint: 'Use the chat ID that contains the message you want to retrieve.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('message id is required') ||
								normalizedMessage.includes('invalid message id format') ||
								normalizedMessage.includes('message id is too long'),
							reason: 'INVALID_MESSAGE_ID',
							hint: 'Use the exact Zoho Cliq message ID returned by Get Messages.',
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
