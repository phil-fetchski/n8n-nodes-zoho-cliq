/**
 * Unmute Chat operation
 */

import { NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CHAT_UNMUTE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChatId } from '../../helpers/utils';
import {
	assertChatLookupPreflightScopesOrThrow,
	CHAT_NOT_FOUND_HINT,
	validateChatExistsIfPossible,
} from '../shared/preflight';
import {
	CHAT_ONLY_OPERATION_CHANNEL_ID_HINT,
	CHAT_ONLY_OPERATION_CHANNEL_ID_MESSAGE,
	isChatLookupNotFoundError,
	looksLikeChannelIdForChatOnlyOperation,
	pushChatRecoverableError,
	resolveChatEnhancedOutput,
} from './shared';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Required Zoho Cliq chat ID for the conversation you want to unmute. This is not a channel ID. Chat IDs may be all-numeric for some direct/private chats or use a `CT_...` style in other chat contexts.',
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
			'Unmute Chat Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#unmute-chat" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Chats.UPDATE</code>. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>',
		name: 'unmuteChatDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Chat/Unmute Chat as AI Tool Setup Guide: <a href="${CHAT_UNMUTE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'unmuteChatAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['chat'],
		operation: ['unmute'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('chat', 'unmute');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChatId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const chatId = this.getNodeParameter('chatId', i) as string;
			requestedChatId = chatId.trim();
			const sanitizedId = validateChatId(this, requestedChatId, i);

			if (looksLikeChannelIdForChatOnlyOperation(sanitizedId)) {
				throw new NodeOperationError(this.getNode(), CHAT_ONLY_OPERATION_CHANNEL_ID_MESSAGE, {
					itemIndex: i,
					description: CHAT_ONLY_OPERATION_CHANNEL_ID_HINT,
				});
			}

			assertChatLookupPreflightScopesOrThrow(this, grantedScopes, i, {
				resource: 'chat',
				operation: 'unmute',
				missingScopeMessage:
					'Unmute Chat also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before unmuting this conversation.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, sanitizedId, i, grantedScopes);

			const response = (await zohoCliqApiRequest.call(
				this,
				'POST',
				`/api/v2/chats/${encodeURIComponent(sanitizedId)}/unmute`,
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
									operation: 'unmute',
									chat_id: sanitizedId,
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
				pushChatRecoverableError(this, returnData, i, 'unmute', error, {
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
							hint: 'Verify chat ID format and confirm the chat exists before unmuting it.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('looks like a channel id'),
							reason: 'CHANNEL_ID_DETECTED',
							hint: CHAT_ONLY_OPERATION_CHANNEL_ID_HINT,
							messageOverride:
								'This operation requires a chat ID. The supplied identifier looks like a channel ID, so the unmute request was not sent.',
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
