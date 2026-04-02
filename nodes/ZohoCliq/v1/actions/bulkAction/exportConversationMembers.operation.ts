import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { BULK_ACTION_EXPORT_CONVERSATION_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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
	validateConversationMemberExportFields,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow(
	'bulkAction',
	'exportConversationMembers',
);
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The exact Zoho Cliq chat ID for the conversation whose members should be exported. Do not use a channel ID.',
	},
	{
		displayName: 'Member Fields',
		name: 'memberFields',
		type: 'multiOptions',
		default: ['name', 'email_id'],
		required: true,
		description:
			'Choose one or more member fields to include as columns in the conversation member export',
		options: [
			{ name: 'Name', value: 'name' },
			{ name: 'Email ID', value: 'email_id' },
			{ name: 'User ID', value: 'user_id' },
		],
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
		name: 'exportConversationMembersChatIdNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Export Members in a Conversation Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#export-chat-members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>`,
		name: 'exportConversationMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq BulkAction/Export Members in a Conversation as AI Tool Setup Guide: <a href="${BULK_ACTION_EXPORT_CONVERSATION_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'exportConversationMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['bulkAction'],
		operation: ['exportConversationMembers'],
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
		let fields: string | undefined;
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
				operation: 'exportConversationMembers',
				missingScopeMessage:
					'Export Members in a Conversation also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before starting the member export.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, chatId, i, grantedScopes);

			const memberFields = this.getNodeParameter('memberFields', i, []) as string[];
			fields = validateConversationMemberExportFields(this, memberFields, i);
			nextTokenRaw = String(this.getNodeParameter('nextToken', i, '') ?? '').trim();
			nextToken = getOptionalMaintenanceNextToken(this, nextTokenRaw, i);

			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				`/maintenanceapi/v2/chats/${encodeURIComponent(chatId)}/members`,
				undefined,
				{
					fields,
					...(nextToken ? { next_token: nextToken } : {}),
				},
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
				pushBulkActionRecoverableError(this, returnData, i, 'exportConversationMembers', error, {
					contextFields: {
						...(chatId ? { chat_id: chatId } : {}),
						...(fields ? ({ fields } as IDataObject) : {}),
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
							hint: 'Use the exact Zoho Cliq chat ID for the conversation. Do not pass a channel ID.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('member fields'),
							reason: 'INVALID_MEMBER_FIELDS',
							hint: 'Choose one or more unique member fields from ["name", "email_id", "user_id"]. Use "email_id" instead of "email" in this node.',
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
