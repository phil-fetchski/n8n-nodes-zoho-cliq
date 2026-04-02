/**
 * Get Chat Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHAT_GET_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChatId } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { CHAT_NOT_FOUND_HINT, normalizeChatLookupNotFoundError } from '../shared/preflight';
import { buildExecutionItemsFromApiResponse } from '../shared/responseOutput';
import { isChatLookupNotFoundError, pushChatRecoverableError } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

/**
 * Validate fields parameter
 */
function validateFieldsSelection(
	context: IExecuteFunctions,
	fields: string[],
	itemIndex: number,
): string | undefined {
	const validFields = ['name', 'email_id', 'user_id'];
	if (fields.length === 0) {
		return undefined;
	}

	const fieldArray = fields.map((field) => String(field).trim());

	for (const field of fieldArray) {
		if (!validFields.includes(field)) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid field: "${field}". Must be one of: ${validFields.join(', ')}`,
				{ itemIndex },
			);
		}
	}

	return fieldArray.join(',');
}

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Required Zoho Cliq chat ID for the conversation whose members you want to retrieve. This is not a channel ID. Chat IDs may be all-numeric for direct or private conversations or use a `CT_...` style in some other chat contexts. Do not pass a `channel_id`, channel unique name, or display name.',
		placeholder: 'e.g. CT1234567890',
	},
	{
		displayName: 'Fields in Response',
		name: 'fields',
		type: 'multiOptions',
		options: [
			{ name: 'Name', value: 'name' },
			{ name: 'Email ID', value: 'email_id' },
			{ name: 'User ID', value: 'user_id' },
		],
		default: ['name', 'email_id', 'user_id'],
		description:
			"Optional member fields to include. Allowed values: `name`, `email_id`, `user_id`. When configuring this with AI input, use comma-separated values with no spaces, such as `name,email_id`. Bot members may not include `email_id` even when requested, and response entries for bots may also include fields such as `bot_unique_name` and `store_app_id`. A `store_app_id` of `-1` means the bot is not a marketplace custom bot and app_key-based access is not needed. A real `store_app_id` value may mean some bot or message operations require that bot's `app_key`. This is AI-friendly and useful for limiting the response to only what the workflow needs, which helps preserve model context. Leave the defaults to return all supported fields.",
	},
	{
		displayName:
			'Get Chat Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Chats.READ</code>',
		name: 'getChatMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Chat/Get Chat Members as AI Tool Setup Guide: <a href="${CHAT_GET_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getChatMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['chat'],
		operation: ['getMembers'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('chat', 'getMembers');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChatId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const chatId = this.getNodeParameter('chatId', i) as string;
			requestedChatId = chatId.trim();
			const sanitizedId = validateChatId(this, chatId, i);

			const qs: Record<string, string | number | boolean> = {};
			const fields = this.getNodeParameter('fields', i, []) as string[];
			const validatedFields = validateFieldsSelection(this, fields, i);
			if (validatedFields) {
				qs.fields = validatedFields;
			}

			const response = (await zohoCliqApiRequest.call(
				this,
				'GET',
				`/api/v2/chats/${encodeURIComponent(sanitizedId)}/members`,
				{},
				qs,
			)) as IDataObject;

			const executionData = this.helpers.constructExecutionMetaData(
				buildExecutionItemsFromApiResponse(response, {
					arrayKey: 'members',
				}),
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			const normalizedLookupError = normalizeChatLookupNotFoundError(this, error, i, {
				chatId: requestedChatId,
			});
			const effectiveError = normalizedLookupError ?? error;
			if (
				pushChatRecoverableError(this, returnData, i, 'getMembers', effectiveError, {
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
							hint: 'Verify chat ID format and confirm the chat exists before requesting members.',
						},
					],
				})
			) {
				continue;
			}
			throw effectiveError;
		}
	}

	return returnData;
}
