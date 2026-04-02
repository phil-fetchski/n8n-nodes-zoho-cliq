/**
 * Add Reaction operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { REACTION_ADD_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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
	preflightMessageTargetOrThrowIfPossible,
} from '../shared/preflight';
import { isChatLookupNotFoundError } from '../chat/shared';
import { applyDisplayOptions, messageChatIdDescription } from '../common.descriptions';
import {
	buildReactionEmojiInputProperties,
	resolveAndValidateReactionInputs,
	resolveEmojiCodeFromInputMode,
} from '../shared/richUi';
import {
	normalizeReactionErrorForOutput,
	pushReactionRecoverableError,
	resolveReactionEnhancedOutput,
} from './common';

const requiredScope = getRequiredScopeForOperation('reaction', 'add');

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
		description:
			'Required Zoho Cliq message ID to react to inside the selected chat. Use the exact message `ID` returned by Get Messages or Retrieve Message, or the exact `message_id` returned by Post Message.',
	},
	...buildReactionEmojiInputProperties({
		customEmojiFieldDescription:
			'Required emoji to add as the reaction. Use either a known Cliq shortcode like `:smile:` or a real Unicode emoji such as `👍`.',
	}),
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutputAdd',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata. Disable to return Cliq's standard success response, which may be minimal or empty.",
	},
	{
		displayName: `Add Reaction Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Add_a_reaction" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'addReactionDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reaction/Add Reaction as AI Tool Setup Guide: <a href="${REACTION_ADD_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addReactionAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reaction'],
		operation: ['add'],
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
		let emojiCode: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i, {
				scopeContext: {
					resource: 'reaction',
					operation: 'add',
				},
			});

			chatId = validateChatId(this, this.getNodeParameter('chatId', i) as string, i, {
				mode: 'chatConversation',
			});
			messageId = validateMessageId(this, this.getNodeParameter('messageId', i) as string, i);
			const emojiInputMode = this.getNodeParameter('emojiInputMode', i, 'unicodePicker') as
				| 'unicodePicker'
				| 'custom'
				| 'picker';
			emojiCode = resolveEmojiCodeFromInputMode(this, i, emojiInputMode);
			const { sanitizedEmojiCode } = resolveAndValidateReactionInputs(
				this,
				i,
				{
					chatId,
					messageId,
					emojiInputMode,
					emojiCode,
				},
				{
					skipChatValidation: true,
					skipMessageValidation: true,
				},
			);

			await preflightMessageTargetOrThrowIfPossible(this, chatId, messageId, i, grantedScopes);

			const endpoint = `/api/v2/chats/${encodeURIComponent(chatId)}/messages/${encodePathSegmentPreservingEscapes(messageId)}/reactions`;

			const body: IDataObject = {
				emoji_code: sanitizedEmojiCode,
			};

			const response = await zohoCliqApiRequest.call(this, 'POST', endpoint, body);
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveReactionEnhancedOutput(
				this,
				i,
				response,
				'includeEnhancedOutputAdd',
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									success: true,
									resource: 'reaction',
									operation: 'add',
									chat_id: chatId,
									message_id: messageId,
									emoji_code: sanitizedEmojiCode,
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
					...(emojiCode?.trim() ? { emoji_code: emojiCode.trim() } : {}),
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
					{
						match: (normalizedMessage: string) =>
							normalizedMessage.includes('emoji code is required') ||
							normalizedMessage.includes('invalid emoji code') ||
							normalizedMessage.includes('unknown cliq shortcode'),
						reason: 'INVALID_EMOJI_CODE',
						hint: 'Use either a valid Unicode emoji or a known Zoho Cliq shortcode such as :smile:.',
					},
				],
			};
			const normalizedErrorForOutput = normalizeReactionErrorForOutput(
				this,
				i,
				'add',
				errorForOutput,
				errorOptions,
			);
			if (
				pushReactionRecoverableError(
					this,
					returnData,
					i,
					'add',
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
