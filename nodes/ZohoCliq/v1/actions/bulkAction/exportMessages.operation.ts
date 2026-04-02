import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { BULK_ACTION_EXPORT_MESSAGES_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChatId } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { isChatLookupNotFoundError } from '../chat/shared';
import {
	assertChatLookupPreflightScopesOrThrow,
	CHAT_NOT_FOUND_HINT,
	validateChatExistsIfPossible,
} from '../shared/preflight';
import {
	getOptionalMaintenanceNextToken,
	getMaintenanceRequestHeaders,
	getMaintenanceResponseData,
	pushBulkActionRecoverableError,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('bulkAction', 'exportMessages');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The exact Zoho Cliq chat ID for the conversation whose message transcript should be exported. Do not use a channel ID.',
	},
	{
		displayName: 'Next Token',
		name: 'nextToken',
		type: 'string',
		default: '',
		typeOptions: { password: true },
		description:
			'Optional. Opaque pagination cursor returned by a previous bulk export response as next_token. Reuse exactly as returned to fetch the next page. Blank values are allowed and omitted.',
	},
	{
		displayName:
			'Important: This API accepts only a Chat ID. Do not use a Channel ID for this operation.',
		name: 'exportMessagesChatIdNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Export Messages Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#export-transcript" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>`,
		name: 'exportMessagesDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq BulkAction/Export Messages as AI Tool Setup Guide: <a href="${BULK_ACTION_EXPORT_MESSAGES_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'exportMessagesAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['bulkAction'],
		operation: ['exportMessages'],
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
		let nextTokenRaw: string | undefined;
		let nextToken: string | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			const rawChatId = String(this.getNodeParameter('chatId', i, '') ?? '').trim();
			if (rawChatId) {
				chatId = rawChatId;
			}
			chatId = validateChatId(this, rawChatId, i);
			assertChatLookupPreflightScopesOrThrow(this, grantedScopes, i, {
				resource: 'bulkAction',
				operation: 'exportMessages',
				missingScopeMessage:
					'Export Messages also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before starting the transcript export.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, chatId, i, grantedScopes);
			nextTokenRaw = String(this.getNodeParameter('nextToken', i, '') ?? '').trim();
			nextToken = getOptionalMaintenanceNextToken(this, nextTokenRaw, i);
			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				`/maintenanceapi/v2/chats/${encodeURIComponent(chatId)}/messages`,
				undefined,
				nextToken ? { next_token: nextToken } : undefined,
				{
					headers: getMaintenanceRequestHeaders(),
					json: false,
				},
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: getMaintenanceResponseData(this, response, i) }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushBulkActionRecoverableError(this, returnData, i, 'exportMessages', error, {
					contextFields: {
						...(chatId ? { chat_id: chatId } : {}),
						...(nextTokenRaw ? { next_token: '[REDACTED]' } : {}),
					},
					messageMappings: [
						{
							match: (_normalizedMessage, _message, error) => isChatLookupNotFoundError(error),
							reason: 'CHAT_NOT_FOUND',
							hint: CHAT_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('chat id'),
							reason: 'INVALID_CHAT_ID',
							hint: 'Use the exact Zoho Cliq chat ID for the conversation transcript. Do not pass a channel ID.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('next token'),
							reason: 'INVALID_NEXT_TOKEN',
							hint: 'Use the exact next_token value returned by the previous bulk export response.',
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
