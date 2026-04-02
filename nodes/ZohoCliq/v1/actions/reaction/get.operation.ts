/**
 * Get Reactions operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { REACTION_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	encodePathSegmentPreservingEscapes,
	validateChatId,
	validateMessageId,
} from '../../helpers/utils';
import {
	CHAT_NOT_FOUND_HINT,
	MESSAGE_NOT_FOUND_HINT,
	enrichMessageTargetLookupErrorIfPossible,
	isMessageLookupNotFoundError,
	preflightMessageTargetIfPossible,
} from '../shared/preflight';
import { isChatLookupNotFoundError } from '../chat/shared';
import { applyDisplayOptions, messageChatIdDescription } from '../common.descriptions';
import {
	normalizeReactionErrorForOutput,
	pushReactionRecoverableError,
	resolveReactionEnhancedOutput,
} from './common';

const requiredScope = getRequiredScopeForOperation('reaction', 'get');

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
		displayOptions: {
			show: {
				resource: ['reaction'],
			},
		},
		description:
			'Required Zoho Cliq message ID whose reactions you want to inspect. Use the exact message `ID` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutputGet',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to include workflow-friendly success metadata such as `chat_id` and `message_id` alongside the reaction data. Disable to return Cliq's standard response only.",
	},
	{
		displayName: `Get Reactions Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Get_Reactions" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getReactionsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reaction/Get Reactions as AI Tool Setup Guide: <a href="${REACTION_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getReactionsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reaction'],
		operation: ['get'],
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
		let chatId: string | undefined;
		let messageId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i, {
				scopeContext: {
					resource: 'reaction',
					operation: 'get',
				},
			});

			chatId = validateChatId(this, this.getNodeParameter('chatId', i) as string, i, {
				mode: 'chatConversation',
			});
			messageId = validateMessageId(this, this.getNodeParameter('messageId', i) as string, i);

			await preflightMessageTargetIfPossible(this, chatId, messageId, i, grantedScopes);

			const endpoint = `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodePathSegmentPreservingEscapes(messageId)}/reactions`;

			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveReactionEnhancedOutput(
				this,
				i,
				response,
				'includeEnhancedOutputGet',
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									success: true,
									resource: 'reaction',
									operation: 'get',
									chat_id: chatId,
									message_id: messageId,
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
			const errorForOutput = await enrichMessageTargetLookupErrorIfPossible(
				this,
				error,
				i,
				grantedScopes,
				chatId,
				messageId,
			);
			const errorOptions = {
				contextFields: {
					...(chatId ? { chat_id: chatId } : {}),
					...(messageId ? { message_id: messageId } : {}),
				},
				messageMappings: [
					{
						match: (normalizedMessage: string) =>
							normalizedMessage.includes('chat id is required') ||
							normalizedMessage.includes('invalid chat id format') ||
							normalizedMessage.includes('chat id is too long'),
						reason: 'INVALID_CHAT_ID',
						hint: 'Verify chat_id format and make sure it is the chat that contains the target message.',
					},
					{
						match: (_normalizedMessage: string, _message: string, error: unknown) =>
							isChatLookupNotFoundError(error),
						reason: 'CHAT_NOT_FOUND',
						hint: CHAT_NOT_FOUND_HINT,
					},
					{
						match: (_normalizedMessage: string, _message: string, error: unknown) =>
							isMessageLookupNotFoundError(error),
						reason: 'MESSAGE_NOT_FOUND',
						hint: MESSAGE_NOT_FOUND_HINT,
					},
					{
						match: (normalizedMessage: string) =>
							normalizedMessage.includes('message id is required') ||
							normalizedMessage.includes('invalid message id format') ||
							normalizedMessage.includes('message id is too long'),
						reason: 'INVALID_MESSAGE_ID',
						hint: 'Verify message_id format and make sure it belongs to the supplied chat_id.',
					},
				],
			};
			const normalizedErrorForOutput = normalizeReactionErrorForOutput(
				this,
				i,
				'get',
				errorForOutput,
				errorOptions,
			);
			if (
				pushReactionRecoverableError(
					this,
					returnData,
					i,
					'get',
					normalizedErrorForOutput,
					errorOptions,
				)
			) {
				continue;
			}

			throw normalizedErrorForOutput;
		}
	}

	return returnData;
}
