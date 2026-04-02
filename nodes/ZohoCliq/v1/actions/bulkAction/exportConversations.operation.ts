import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { BULK_ACTION_EXPORT_CONVERSATIONS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	getOptionalMaintenanceNextToken,
	getMaintenanceRequestHeaders,
	getMaintenanceResponseData,
	pushBulkActionRecoverableError,
	validateConversationExportFields,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('bulkAction', 'exportConversations');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Conversation Fields',
		name: 'conversationFields',
		type: 'multiOptions',
		default: ['title', 'chat_id'],
		required: true,
		description:
			'Choose one or more conversation fields to include as columns in the organization-wide export',
		options: [
			{ name: 'Chat ID', value: 'chat_id' },
			{ name: 'Creation Time', value: 'creation_time' },
			{ name: 'Creator ID', value: 'creator_id' },
			{ name: 'Last Modified Time', value: 'last_modified_time' },
			{ name: 'Participant Count', value: 'participant_count' },
			{ name: 'Title', value: 'title' },
			{ name: 'Total Message Count', value: 'total_message_count' },
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
		displayName: `Export Conversations Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#export-chats" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'exportConversationsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq BulkAction/Export Conversations as AI Tool Setup Guide: <a href="${BULK_ACTION_EXPORT_CONVERSATIONS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'exportConversationsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['bulkAction'],
		operation: ['exportConversations'],
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
		let fields: string | undefined;
		let nextTokenRaw: string | undefined;
		let nextToken: string | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			const conversationFields = this.getNodeParameter('conversationFields', i, []) as string[];
			fields = validateConversationExportFields(this, conversationFields, i);
			nextTokenRaw = String(this.getNodeParameter('nextToken', i, '') ?? '').trim();
			nextToken = getOptionalMaintenanceNextToken(this, nextTokenRaw, i);
			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				'/maintenanceapi/v2/chats',
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
				pushBulkActionRecoverableError(this, returnData, i, 'exportConversations', error, {
					contextFields: {
						...(fields ? ({ fields } as IDataObject) : {}),
						...(nextTokenRaw ? { next_token: '[REDACTED]' } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('conversation fields'),
							reason: 'INVALID_CONVERSATION_FIELDS',
							hint: 'Choose one or more unique conversation fields from ["title", "chat_id", "creation_time", "last_modified_time", "participant_count", "total_message_count", "creator_id"].',
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
