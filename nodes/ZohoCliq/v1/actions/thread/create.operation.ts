/**
 * Create Thread operation
 * Creates a new thread by posting a first message to a channel or chat target.
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { THREAD_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import {
	checkRequiredScope,
	isBoolean,
	validateChannelId,
	validateChannelName,
	validateChatId,
	validateMessageId,
} from '../../helpers/utils';
import { applyDisplayOptions, channelIdOnlyRLC } from '../common.descriptions';
import {
	CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
	CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE,
	CHANNEL_NOT_FOUND_HINT,
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
	CHAT_NOT_FOUND_HINT,
	validateChatExistsIfPossible,
} from '../shared/preflight';
import {
	messagePayloadDescription,
	resolveBotUniqueNameQueryParam,
	resolveMessagePayload,
} from '../shared/messagePayload';
import { normalizeThreadResponseMessageIds, pushThreadRecoverableError } from './common';

const requiredScope = getRequiredScopeForOperation('thread', 'create');

type ThreadCreateTarget = 'channel' | 'channelUniqueName' | 'chat';
type AgentSelectableThreadCreateTarget = 'channel_id' | 'channel_unique_name' | 'chat_id';
type ThreadCreateTargetSelection = ThreadCreateTarget | 'agentChoice';

const validTargetSelections = new Set<ThreadCreateTargetSelection>([
	'agentChoice',
	'channel',
	'channelUniqueName',
	'chat',
]);
const validAgentSelectedTargets = new Set<AgentSelectableThreadCreateTarget>([
	'channel_id',
	'channel_unique_name',
	'chat_id',
]);

const threadCreatePayloadDescription: INodeProperties[] = messagePayloadDescription
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

const properties: INodeProperties[] = [
	{
		displayName: 'Target',
		name: 'target',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: "Agent's Choice",
				value: 'agentChoice',
				description: 'Let the AI choose one supported thread-creation target family per call',
			},
			{
				name: 'Channel',
				value: 'channel',
				description: 'Create a thread in a channel by channel list selection or channel ID',
			},
			{
				name: 'Channel (By Unique Name)',
				value: 'channelUniqueName',
				description: 'Create a thread in a channel by channel unique name',
			},
			{
				name: 'Chat',
				value: 'chat',
				description: 'Create a thread in a chat by chat ID',
			},
		],
		default: 'channel',
		description: 'Where to create the thread',
	},
	{
		displayName: `Agent Choice Guidance: To use <b>Agent's Choice</b> as an AI Tool, keep <b>Target</b> fixed to <b>Agent's Choice</b>, switch <b>Agent Selected Target</b> to expression mode, and configure every agent-choice identifier field with its optional AI expression so those inputs appear in the tool schema. This mode gives the AI broader routing access across channel IDs, channel unique names, and chat IDs, so enable it only when that level of access is intentional. See the <a href="${THREAD_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Tool Setup Guide</a> for the recommended setup pattern.`,
		name: 'agentChoiceGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: 'Agent Selected Target',
		name: 'agentSelectedTarget',
		type: 'options',
		required: true,
		default: 'channel_id',
		description:
			"Choose which target family should be used for this tool call. In the Agent's Choice AI setup path, switch this field to expression mode and use the provided AI expression.",
		options: [
			{ name: 'Channel (By ID)', value: 'channel_id' },
			{ name: 'Channel (By Unique Name)', value: 'channel_unique_name' },
			{ name: 'Chat', value: 'chat_id' },
		],
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: 'Channel ID',
		name: 'agentChannelId',
		type: 'string',
		default: '',
		placeholder: 'e.g. P1234567890123456789',
		description:
			'Only provide the exact Zoho Cliq channel ID when Agent Selected Target is set to Channel (By ID). Blank values are allowed and omitted.',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: 'Channel Unique Name',
		name: 'agentChannelUniqueName',
		type: 'string',
		default: '',
		placeholder: 'e.g. engineeringannouncements',
		description:
			'Only provide the exact channel unique name when Agent Selected Target is set to Channel (By Unique Name). Blank values are allowed and omitted.',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: 'Chat ID',
		name: 'agentChatId',
		type: 'string',
		default: '',
		placeholder: 'e.g. CT_1234567890_1234567890',
		description:
			'Only provide the exact chat ID when Agent Selected Target is set to Chat. Blank values are allowed and omitted.',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		...channelIdOnlyRLC,
		displayOptions: { show: { target: ['channel'] } },
		description:
			'Choose a channel from list, or provide the exact Zoho Cliq channel ID manually. To use channel unique name instead, switch Target to Channel (By Unique Name).',
	},
	{
		displayName: 'Channel Unique Name',
		name: 'channelUniqueName',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. engineeringannouncements',
		displayOptions: { show: { target: ['channelUniqueName'] } },
		description:
			'Exact permanent channel unique name for the channel where the thread should be created',
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. CT_1234567890_1234567890',
		displayOptions: { show: { target: ['chat'] } },
		description:
			'Exact Zoho Cliq chat ID for the parent conversation where the thread should be created. This is not a channel ID.',
	},
	{
		displayName: 'Thread Message ID',
		name: 'threadMessageId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 1773603764498_227899757498',
		description: 'The ID of the parent message to create a thread from',
	},
	...threadCreatePayloadDescription,
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Thread Title',
				name: 'threadTitle',
				type: 'string',
				default: '',
				description: 'Optional title for the thread',
			},
			{
				displayName: 'Post In Parent',
				name: 'postInParent',
				type: 'boolean',
				default: false,
				description: 'Whether to post the message in the parent conversation as well',
			},
			{
				displayName: 'Sync Message',
				name: 'syncMessage',
				type: 'boolean',
				default: false,
				description:
					'Whether to request synchronous behavior and return created message metadata such as message_id in the response',
			},
		],
	},
	{
		displayName:
			'Create Thread Docs (Channel): <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-thread" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'createThreadChannelDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['channel'] } },
	},
	{
		displayName:
			'Create Thread Docs (Channel by Unique Name): <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-thread" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'createThreadChannelUniqueNameDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['channelUniqueName'] } },
	},
	{
		displayName:
			'Create Thread Docs (Chat): <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-thread" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'createThreadChatDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['chat'] } },
	},
	{
		displayName:
			'Create Thread Docs (Agent Choice): <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-thread" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'createThreadAgentChoiceDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: `Zoho Cliq Thread/Create Thread as AI Tool Setup Guide: <a href="${THREAD_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createThreadAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function getOptionalTrimmedString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function validateTargetSelection(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): ThreadCreateTargetSelection {
	const sanitized = getOptionalTrimmedString(value);
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Target is required', { itemIndex });
	}

	if (!validTargetSelections.has(sanitized as ThreadCreateTargetSelection)) {
		throw new NodeOperationError(
			context.getNode(),
			'Target must be one of: "agentChoice", "channel", "channelUniqueName", "chat".',
			{ itemIndex },
		);
	}

	return sanitized as ThreadCreateTargetSelection;
}

function validateAgentSelectedTarget(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): AgentSelectableThreadCreateTarget {
	const sanitized = getOptionalTrimmedString(value);
	if (!sanitized) {
		throw new NodeOperationError(
			context.getNode(),
			'Agent Selected Target is required when Target is set to "Agent\'s Choice".',
			{ itemIndex },
		);
	}

	if (!validAgentSelectedTargets.has(sanitized as AgentSelectableThreadCreateTarget)) {
		throw new NodeOperationError(
			context.getNode(),
			'Agent Selected Target must be one of: "channel_id", "channel_unique_name", "chat_id".',
			{ itemIndex },
		);
	}

	return sanitized as AgentSelectableThreadCreateTarget;
}

function validateAgentChoiceFieldSet(
	context: IExecuteFunctions,
	itemIndex: number,
	selectedTarget: AgentSelectableThreadCreateTarget,
	providedFields: Array<{ fieldName: string; displayName: string }>,
	allowedFieldNames: string[],
): void {
	const unexpectedFields = providedFields.filter(
		(field) => !allowedFieldNames.includes(field.fieldName),
	);

	if (unexpectedFields.length === 0) {
		return;
	}

	const unexpectedNames = unexpectedFields.map((field) => `"${field.displayName}"`).join(', ');
	throw new NodeOperationError(
		context.getNode(),
		`When Agent Selected Target is "${selectedTarget}", only the matching target identifier field may be provided. Clear ${unexpectedNames}.`,
		{ itemIndex },
	);
}

function resolveChannelLocatorValue(
	context: IExecuteFunctions,
	itemIndex: number,
): {
	value: string;
	mode: string;
} {
	const channelLocatorRaw = context.getNodeParameter('channelId', itemIndex) as unknown;
	if (
		!channelLocatorRaw ||
		typeof channelLocatorRaw !== 'object' ||
		Array.isArray(channelLocatorRaw)
	) {
		return {
			value: String(channelLocatorRaw ?? ''),
			mode: '',
		};
	}

	const locator = channelLocatorRaw as IDataObject;

	return {
		value: String(locator.value ?? ''),
		mode: String(locator.mode ?? ''),
	};
}

async function resolveThreadCreateRoute(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	targetSelection: ThreadCreateTargetSelection,
	contextFields: IDataObject,
): Promise<{
	endpoint: string;
	contextFields: IDataObject;
}> {
	if (targetSelection === 'channel') {
		const channelLocator = resolveChannelLocatorValue(context, itemIndex);
		if (channelLocator.mode === 'name') {
			throw new NodeOperationError(
				context.getNode(),
				'Target "Channel" accepts channel list selection or Channel ID only. Use Target "Channel (By Unique Name)" when routing by channel unique name.',
				{ itemIndex },
			);
		}

		const sanitizedChannelId = validateChannelId(context, channelLocator.value, itemIndex);
		contextFields.channel_id = sanitizedChannelId;
		await runChannelIdLookupPreflightGate(context, itemIndex, grantedScopes, sanitizedChannelId);
		return {
			endpoint: `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/message`,
			contextFields: {
				target_selection: 'channel',
				channel_id: sanitizedChannelId,
			},
		};
	}

	if (targetSelection === 'channelUniqueName') {
		const sanitizedChannelUniqueName = validateChannelName(
			context,
			String(context.getNodeParameter('channelUniqueName', itemIndex, '')),
			itemIndex,
		);
		contextFields.channel_unique_name = sanitizedChannelUniqueName;
		await runChannelUniqueNameLookupPreflightGate(
			context,
			itemIndex,
			grantedScopes,
			sanitizedChannelUniqueName,
		);
		return {
			endpoint: `/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelUniqueName)}/message`,
			contextFields: {
				target_selection: 'channelUniqueName',
				channel_unique_name: sanitizedChannelUniqueName,
			},
		};
	}

	if (targetSelection === 'chat') {
		const sanitizedChatId = validateChatId(
			context,
			String(context.getNodeParameter('chatId', itemIndex, '')),
			itemIndex,
			{
				mode: 'chatConversation',
				fieldName: 'Chat ID',
			},
		);
		contextFields.chat_id = sanitizedChatId;
		await validateChatExistsIfPossible(context, sanitizedChatId, itemIndex, grantedScopes);
		return {
			endpoint: `/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/message`,
			contextFields: {
				target_selection: 'chat',
				chat_id: sanitizedChatId,
			},
		};
	}

	const selectedTarget = validateAgentSelectedTarget(
		context,
		context.getNodeParameter('agentSelectedTarget', itemIndex, ''),
		itemIndex,
	);
	const channelId = getOptionalTrimmedString(
		context.getNodeParameter('agentChannelId', itemIndex, ''),
	);
	const channelUniqueName = getOptionalTrimmedString(
		context.getNodeParameter('agentChannelUniqueName', itemIndex, ''),
	);
	const chatId = getOptionalTrimmedString(context.getNodeParameter('agentChatId', itemIndex, ''));
	const providedFields = [
		...(channelId ? [{ fieldName: 'agentChannelId', displayName: 'Channel ID' }] : []),
		...(channelUniqueName
			? [{ fieldName: 'agentChannelUniqueName', displayName: 'Channel Unique Name' }]
			: []),
		...(chatId ? [{ fieldName: 'agentChatId', displayName: 'Chat ID' }] : []),
	];

	if (selectedTarget === 'channel_id') {
		validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
			'agentChannelId',
		]);
		if (!channelId) {
			throw new NodeOperationError(
				context.getNode(),
				'Channel ID is required when Agent Selected Target is "channel_id".',
				{ itemIndex },
			);
		}

		const sanitizedChannelId = validateChannelId(context, channelId, itemIndex);
		contextFields.channel_id = sanitizedChannelId;
		await runChannelIdLookupPreflightGate(context, itemIndex, grantedScopes, sanitizedChannelId);
		return {
			endpoint: `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/message`,
			contextFields: {
				target_selection: 'agentChoice',
				agent_selected_target: selectedTarget,
				channel_id: sanitizedChannelId,
			},
		};
	}

	if (selectedTarget === 'channel_unique_name') {
		validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
			'agentChannelUniqueName',
		]);
		if (!channelUniqueName) {
			throw new NodeOperationError(
				context.getNode(),
				'Channel Unique Name is required when Agent Selected Target is "channel_unique_name".',
				{ itemIndex },
			);
		}

		const sanitizedChannelUniqueName = validateChannelName(context, channelUniqueName, itemIndex);
		contextFields.channel_unique_name = sanitizedChannelUniqueName;
		await runChannelUniqueNameLookupPreflightGate(
			context,
			itemIndex,
			grantedScopes,
			sanitizedChannelUniqueName,
		);
		return {
			endpoint: `/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelUniqueName)}/message`,
			contextFields: {
				target_selection: 'agentChoice',
				agent_selected_target: selectedTarget,
				channel_unique_name: sanitizedChannelUniqueName,
			},
		};
	}

	validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, ['agentChatId']);
	if (!chatId) {
		throw new NodeOperationError(
			context.getNode(),
			'Chat ID is required when Agent Selected Target is "chat_id".',
			{ itemIndex },
		);
	}

	const sanitizedChatId = validateChatId(context, chatId, itemIndex, {
		mode: 'chatConversation',
		fieldName: 'Chat ID',
	});
	contextFields.chat_id = sanitizedChatId;
	await validateChatExistsIfPossible(context, sanitizedChatId, itemIndex, grantedScopes);
	return {
		endpoint: `/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/message`,
		contextFields: {
			target_selection: 'agentChoice',
			agent_selected_target: selectedTarget,
			chat_id: sanitizedChatId,
		},
	};
}

function isChatLookupNotFoundError(error: unknown): boolean {
	return (
		error instanceof NodeOperationError &&
		(error as NodeOperationError & { code?: string }).code === CHAT_LOOKUP_NOT_FOUND_ERROR_CODE
	);
}

function isChannelLookupNotFoundError(error: unknown): boolean {
	return (
		error instanceof NodeOperationError &&
		(error as NodeOperationError & { code?: string }).code === CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE
	);
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let contextFields: IDataObject | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const targetSelection = validateTargetSelection(this, this.getNodeParameter('target', i), i);
			contextFields = {
				target_selection: targetSelection,
			};
			if (targetSelection === 'agentChoice') {
				const rawAgentSelectedTarget = getOptionalTrimmedString(
					this.getNodeParameter('agentSelectedTarget', i, ''),
				);
				if (rawAgentSelectedTarget) {
					contextFields.agent_selected_target = rawAgentSelectedTarget;
				}
			}
			const route = await resolveThreadCreateRoute(
				this,
				i,
				grantedScopes,
				targetSelection,
				contextFields,
			);
			contextFields = { ...route.contextFields };

			const sanitizedThreadMessageId = validateMessageId(
				this,
				String(this.getNodeParameter('threadMessageId', i, '')),
				i,
			);
			contextFields.thread_message_id = sanitizedThreadMessageId;

			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const body: IDataObject = resolveMessagePayload(this, i, {
				textMaxLength: 5000,
				requireMessageContent: true,
				includeBotIdentity: false,
			});
			body.thread_message_id = sanitizedThreadMessageId;

			if (additionalFields.threadTitle !== undefined && additionalFields.threadTitle !== null) {
				if (typeof additionalFields.threadTitle !== 'string') {
					throw new NodeOperationError(this.getNode(), 'Thread Title must be a string', {
						itemIndex: i,
					});
				}

				const threadTitle = additionalFields.threadTitle.trim();
				if (threadTitle) {
					body.thread_title = threadTitle;
				}
			}

			if (additionalFields.postInParent !== undefined) {
				if (!isBoolean(additionalFields.postInParent)) {
					throw new NodeOperationError(this.getNode(), 'Post In Parent must be a boolean', {
						itemIndex: i,
					});
				}
				body.post_in_parent = additionalFields.postInParent as boolean;
			}

			if (additionalFields.syncMessage !== undefined) {
				if (!isBoolean(additionalFields.syncMessage)) {
					throw new NodeOperationError(this.getNode(), 'Sync Message must be a boolean', {
						itemIndex: i,
					});
				}
				body.sync_message = additionalFields.syncMessage as boolean;
			}

			const botQuery = resolveBotUniqueNameQueryParam(this, i);
			const response = botQuery
				? await zohoCliqApiRequest.call(this, 'POST', route.endpoint, body, botQuery)
				: await zohoCliqApiRequest.call(this, 'POST', route.endpoint, body);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: normalizeThreadResponseMessageIds(response) }],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushThreadRecoverableError(this, returnData, i, 'create', error, {
					contextFields,
					fallbackMessage: 'Unable to create the thread in Zoho Cliq.',
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								isChannelLookupNotFoundError(mappedError),
							reason: 'CHANNEL_NOT_FOUND',
							hint: CHANNEL_NOT_FOUND_HINT,
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								isChatLookupNotFoundError(mappedError),
							reason: 'CHAT_NOT_FOUND',
							hint: CHAT_NOT_FOUND_HINT,
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
