/**
 * Leave Group Chat operation
 */

import { NodeOperationError } from 'n8n-workflow';
import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CHAT_LEAVE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChatId } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
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
			'Required Zoho Cliq group chat ID to leave as the current user. This operation is for group chats, not direct one-to-one chats. This is not a channel ID. Chat IDs may be all-numeric for some group chats or use a `CT_...` style in other chat contexts. Do not pass a `channel_id`, channel unique name, or display name.',
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
			'Leave Group Chat Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#leave-group-chat" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Chats.UPDATE</code>. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>',
		name: 'leaveGroupChatDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Chat/Leave Group Chat as AI Tool Setup Guide: <a href="${CHAT_LEAVE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'leaveGroupChatAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['chat'],
		operation: ['leave'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('chat', 'leave');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChatId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const chatId = this.getNodeParameter('chatId', i) as string;
			requestedChatId = chatId.trim();
			const sanitizedChatId = validateChatId(this, requestedChatId, i);

			if (looksLikeChannelIdForChatOnlyOperation(sanitizedChatId)) {
				throw new NodeOperationError(this.getNode(), CHAT_ONLY_OPERATION_CHANNEL_ID_MESSAGE, {
					itemIndex: i,
					description: CHAT_ONLY_OPERATION_CHANNEL_ID_HINT,
				});
			}

			assertChatLookupPreflightScopesOrThrow(this, grantedScopes, i, {
				resource: 'chat',
				operation: 'leave',
				missingScopeMessage:
					'Leave Group Chat also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before leaving this conversation.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, sanitizedChatId, i, grantedScopes);

			const response = (await zohoCliqApiRequest.call(
				this,
				'POST',
				`/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/leave`,
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
									...responseJson,
									success: true,
									operation: 'leave',
									chat_id: sanitizedChatId,
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
				pushChatRecoverableError(this, returnData, i, 'leave', error, {
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
							match: (normalizedMessage) => normalizedMessage.includes('looks like a channel id'),
							reason: 'CHANNEL_ID_DETECTED',
							hint: CHAT_ONLY_OPERATION_CHANNEL_ID_HINT,
							messageOverride:
								'This operation requires a chat ID. The supplied identifier looks like a channel ID, so the leave request was not sent.',
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
