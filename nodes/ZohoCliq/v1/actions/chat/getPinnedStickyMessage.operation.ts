/**
 * Get Pinned Message operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CHAT_GET_PINNED_STICKY_MESSAGE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChatId } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { CHAT_NOT_FOUND_HINT, validateChatExistsIfPossible } from '../shared/preflight';
import { buildExecutionItemsFromApiResponse } from '../shared/responseOutput';
import {
	isChatAiErrorModeEnabled,
	isChatLookupNotFoundError,
	normalizeStickyMessageResponseOutput,
	pushChatRecoverableError,
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

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Required Zoho Cliq chat ID for the conversation whose pinned message you want to retrieve. This is not a channel ID. Chat IDs may be all-numeric for some direct/private chats or use a `CT_...` style in other chat contexts. Do not pass a `channel_id`, channel unique name, or display name.',
		placeholder: 'e.g. CT1234567890',
	},
	{
		displayName:
			'Get Pinned Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-pinned-message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Chats.READ</code>',
		name: 'getPinnedStickyMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Chat/Get Pinned Message as AI Tool Setup Guide: <a href="${CHAT_GET_PINNED_STICKY_MESSAGE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getPinnedStickyMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['chat'],
		operation: ['getPinnedStickyMessage'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('chat', 'getPinnedStickyMessage');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChatId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const chatId = this.getNodeParameter('chatId', i) as string;
			requestedChatId = chatId.trim();
			const sanitizedChatId = validateChatId(this, chatId, i);
			await validateChatExistsIfPossible(this, sanitizedChatId, i, grantedScopes);

			const rawResponse = (await zohoCliqApiRequest.call(
				this,
				'GET',
				`/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/stickymessage`,
			)) as IDataObject;
			const response = normalizeStickyMessageResponseOutput(rawResponse) as IDataObject;

			if (isChatAiErrorModeEnabled(this, i) && isEmptyStickyMessageResponse(response)) {
				const executionData = this.helpers.constructExecutionMetaData(
					[
						{
							json: {
								success: false,
								resource: 'chat',
								operation: 'getPinnedStickyMessage',
								chat_id: sanitizedChatId,
								reason: 'NO_PINNED_MESSAGE',
								message: 'No pinned message is currently set in this chat.',
								hint: 'Pin a message in this chat before trying to retrieve it.',
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

			const executionData = this.helpers.constructExecutionMetaData(
				buildExecutionItemsFromApiResponse(response),
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChatRecoverableError(this, returnData, i, 'getPinnedStickyMessage', error, {
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
							hint: 'Verify chat ID format and confirm the chat exists before retrieving its pinned message.',
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
