/**
 * Post to Thread operation
 * Posts a message to an existing thread
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { THREAD_POST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import {
	checkRequiredScope,
	isBoolean,
	validateThreadChatId,
	validateMessageId,
} from '../../helpers/utils';
import {
	messagePayloadDescription,
	resolveBotUniqueNameQueryParam,
	resolveMessagePayload,
} from '../shared/messagePayload';
import { runThreadLookupPreflightGate } from '../shared/preflight';
import {
	normalizeThreadResponseMessageIds,
	pushThreadRecoverableError,
	THREAD_NOT_FOUND_HINT,
	THREAD_NOT_FOUND_MESSAGE,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('thread', 'post');

const threadPostPayloadDescription: INodeProperties[] = messagePayloadDescription
	.filter((property) => !['botDisplayName', 'botImage'].includes(property.name))
	.map((property) => {
		if (property.name === 'botUniqueName') {
			return {
				...property,
				required: false,
				description:
					'Only used when Post as Bot is enabled. Provide the exact bot unique name. Leave blank when Post as Bot is disabled.',
				displayOptions: undefined,
			};
		}

		if (property.name === 'text') {
			return {
				...property,
				required: false,
				description:
					'Used when Message Type resolves to Text (Cliq Markdown). Provide a non-empty string up to 5000 characters. Leave blank when Message Type resolves to Advanced (JSON).',
				displayOptions: undefined,
			};
		}

		if (property.name === 'jsonBody') {
			return {
				...property,
				description:
					'Used when Message Type resolves to Advanced (JSON). Provide a raw JSON object with a non-empty top-level `text` string. Leave blank when Message Type resolves to Text (Cliq Markdown).',
				displayOptions: undefined,
			};
		}

		return property;
	});
const plainTextNoticeIndex = threadPostPayloadDescription.findIndex(
	(property) => property.name === 'plainTextMarkdownNotice',
);
const textIndex = threadPostPayloadDescription.findIndex((property) => property.name === 'text');
if (plainTextNoticeIndex >= 0 && textIndex >= 0 && plainTextNoticeIndex < textIndex) {
	const [notice] = threadPostPayloadDescription.splice(plainTextNoticeIndex, 1);
	const updatedTextIndex = threadPostPayloadDescription.findIndex(
		(property) => property.name === 'text',
	);
	threadPostPayloadDescription.splice(updatedTextIndex + 1, 0, notice);
}

const properties: INodeProperties[] = [
	{
		displayName: 'Chat ID',
		name: 'threadChatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. CT_1234567890_1234567890-T-1234567890',
		description: 'Thread chat ID (format: CT_...-T-...)',
	},
	...threadPostPayloadDescription,
	{
		displayName: 'Optional Fields',
		name: 'optionalFields',
		type: 'fixedCollection',
		placeholder: 'Add Fields',
		description: 'Optional fields to apply when posting a message',
		typeOptions: {
			multipleValues: false,
			fixedCollection: {
				itemTitle: 'Optional Field',
			},
		},
		default: {},
		options: [
			{
				displayName: 'Field',
				name: 'field',
				values: [
					{
						displayName: 'Post In Parent',
						name: 'postInParent',
						type: 'boolean',
						default: false,
						description: 'Whether to post the message in the parent chat as well (post_in_parent)',
					},
					{
						displayName: 'Reply To Message ID',
						name: 'replyTo',
						type: 'string',
						default: '',
						description: 'Optional message ID to reply to (reply_to)',
					},
					{
						displayName: 'Sync Message',
						name: 'syncMessage',
						type: 'boolean',
						default: false,
						description:
							'Whether to request synchronous behavior and return the created message_id in the response (sync_message)',
					},
				],
			},
		],
	},
	{
		displayName: `Post to Thread Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-thread" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'postThreadDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/Post to Thread as AI Tool Setup Guide: <a href="${THREAD_POST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'postThreadAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['post'],
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
		let sanitizedThreadChatId = '';
		let sanitizedReplyTo: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const threadChatId = this.getNodeParameter('threadChatId', i) as string;
			const optionalFieldsRaw = (this.getNodeParameter('optionalFields', i, {}) ??
				{}) as IDataObject;
			const optionalFieldsValue = optionalFieldsRaw.field;
			const optionalFields =
				optionalFieldsValue && typeof optionalFieldsValue === 'object'
					? (optionalFieldsValue as IDataObject)
					: optionalFieldsRaw;

			// Validate inputs
			sanitizedThreadChatId = validateThreadChatId(this, threadChatId, i);
			await runThreadLookupPreflightGate(this, i, grantedScopes, sanitizedThreadChatId);

			const body = resolveMessagePayload(this, i, {
				textMaxLength: 5000,
				requireMessageContent: true,
				includeBotIdentity: false,
			});

			if (optionalFields.replyTo !== undefined && optionalFields.replyTo !== null) {
				if (typeof optionalFields.replyTo !== 'string') {
					throw new NodeOperationError(this.getNode(), 'Reply To Message ID must be a string', {
						itemIndex: i,
					});
				}

				const replyTo = optionalFields.replyTo.trim();
				if (replyTo) {
					sanitizedReplyTo = validateMessageId(this, replyTo, i);
					body.reply_to = sanitizedReplyTo;
				}
			}

			const syncMessageRaw = optionalFields.syncMessage ?? false;
			if (!isBoolean(syncMessageRaw)) {
				throw new NodeOperationError(this.getNode(), 'syncMessage must be a boolean', {
					itemIndex: i,
				});
			}
			if (syncMessageRaw) {
				body.sync_message = true;
			}

			const postInParentRaw = optionalFields.postInParent ?? false;
			if (!isBoolean(postInParentRaw)) {
				throw new NodeOperationError(this.getNode(), 'postInParent must be a boolean', {
					itemIndex: i,
				});
			}
			if (postInParentRaw) {
				body.post_in_parent = true;
			}

			const endpoint = `/api/v2/chats/${encodeURIComponent(sanitizedThreadChatId)}/message`;
			const botQuery = resolveBotUniqueNameQueryParam(this, i);
			const response = botQuery
				? await zohoCliqApiRequest.call(this, 'POST', endpoint, body, botQuery)
				: await zohoCliqApiRequest.call(this, 'POST', endpoint, body);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: normalizeThreadResponseMessageIds(response) }],
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			const contextFields: IDataObject = {
				thread_chat_id: sanitizedThreadChatId,
			};
			if (sanitizedReplyTo !== undefined) {
				contextFields.reply_to = sanitizedReplyTo;
			}

			if (
				pushThreadRecoverableError(this, returnData, i, 'post', error, {
					contextFields,
					fallbackMessage: 'Unable to post the message to the thread in Zoho Cliq.',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(THREAD_NOT_FOUND_MESSAGE.toLowerCase()),
							reason: 'THREAD_NOT_FOUND',
							messageOverride: THREAD_NOT_FOUND_MESSAGE,
							hint: THREAD_NOT_FOUND_HINT,
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
