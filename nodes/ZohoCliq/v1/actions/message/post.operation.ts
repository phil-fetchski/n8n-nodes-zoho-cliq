/**
 * Post Message operation
 * Sends messages to channels, bots, chats, or users
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { hasRequiredScope } from '../../../../../credentials/ZohoCliqOAuth2Api.credentials';

import { MESSAGE_POST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import {
	checkRequiredScope,
	isBoolean,
	sanitizeJsonBody,
	validateChannelId,
	validateChannelName,
	validateEmail,
	validateMessageId,
	validateThreadId,
	validateUserId,
} from '../../helpers/utils';
import {
	messagePayloadDescription,
	resolveBotUniqueNameQueryParam,
	resolveMessagePayload,
} from '../shared/messagePayload';
import {
	CHAT_NOT_FOUND_HINT,
	CHANNEL_NOT_FOUND_HINT,
	DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE,
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
	runChatLookupPreflightGate,
	runDirectMessageRecipientPreflightGate,
} from '../shared/preflight';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import { normalizeZohoMessageIdOutput, pushMessageRecoverableError } from './common';
import { extractCliqErrorSearchText } from '../shared/errorResponse';

import type { IMessageBody } from '../types';

type MessageTarget = 'channel' | 'bot' | 'chat' | 'thread' | 'user';
type AgentSelectableMessageTarget =
	| 'channelId'
	| 'channelUniqueName'
	| 'bot'
	| 'chat'
	| 'thread'
	| 'user';
type MessageTargetSelection = MessageTarget | 'agentChoice';
type ChannelLookupMode = 'id' | 'name';

interface IChannelLookupContext {
	mode: ChannelLookupMode;
	value: string;
}

const THREAD_POST_FAILED_ERROR_CODE = 'THREAD_POST_FAILED';
const THREAD_POST_FAILED_HINT =
	'Verify that the Thread Chat ID and Thread ID are both correct and that the thread still exists in the specified chat before retrying.';

const botCapablePayloadParams = new Set([
	'postAsBot',
	'botDisplayName',
	'botUniqueName',
	'botImage',
]);
const postMessagePayloadDescription: INodeProperties[] = messagePayloadDescription.map(
	(property) => {
		if (property.name === 'botUniqueName') {
			return {
				...property,
				required: false,
				description:
					'Provide the exact bot unique name when Target is Bot, or when Post as Bot is enabled for a Channel or Chat target. Leave blank otherwise.',
				displayOptions: {
					show: {
						target: ['channel', 'bot', 'chat'],
					},
				},
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

		if (!botCapablePayloadParams.has(property.name)) {
			return property;
		}

		return {
			...property,
			displayOptions: {
				...property.displayOptions,
				show: {
					...property.displayOptions?.show,
					target: ['channel', 'chat', 'agentChoice'],
				},
			},
		};
	},
);

const plainTextNoticeIndex = postMessagePayloadDescription.findIndex(
	(property) => property.name === 'plainTextMarkdownNotice',
);
const textIndex = postMessagePayloadDescription.findIndex((property) => property.name === 'text');
if (plainTextNoticeIndex >= 0 && textIndex >= 0 && plainTextNoticeIndex < textIndex) {
	const [notice] = postMessagePayloadDescription.splice(plainTextNoticeIndex, 1);
	const updatedTextIndex = postMessagePayloadDescription.findIndex(
		(property) => property.name === 'text',
	);
	postMessagePayloadDescription.splice(updatedTextIndex + 1, 0, notice);
}

const attachComponentPayloadFields: INodeProperties[] = [
	{
		displayName: 'Attach Component Payloads',
		name: 'attachComponentPayloads',
		type: 'boolean',
		default: false,
		noDataExpression: true,
		description:
			'Whether to attach slides/buttons component payloads from builder operations when message type is Text (Cliq Markdown)',
		displayOptions: {
			show: {
				messageType: ['text'],
			},
		},
	},
	{
		displayName: 'Slides',
		name: 'attachedSlides',
		type: 'json',
		default: '[]',
		description:
			'Slide component object or array of component objects to include as payload.slides',
		displayOptions: {
			show: {
				messageType: ['text'],
				attachComponentPayloads: [true],
			},
		},
	},
	{
		displayName: 'Buttons',
		name: 'attachedButtons',
		type: 'json',
		default: '[]',
		description: 'Button object or array of button objects to include as payload.buttons',
		displayOptions: {
			show: {
				messageType: ['text'],
				attachComponentPayloads: [true],
			},
		},
	},
];

const addMentionIndex = postMessagePayloadDescription.findIndex(
	(property) => property.name === 'addMention',
);
if (addMentionIndex >= 0) {
	postMessagePayloadDescription.splice(addMentionIndex + 1, 0, ...attachComponentPayloadFields);
} else {
	postMessagePayloadDescription.push(...attachComponentPayloadFields);
}

// Define properties for post message operation
const properties: INodeProperties[] = [
	{
		displayName:
			'Thread Posting Tip: If you need to post to a <b>channel thread</b>, switch Target to <b>Thread</b> (or <b>Chat</b> + Post to Thread) and use the channel <b>Chat ID</b> plus <b>Thread ID</b>. Channel ID / Unique Name endpoints do not accept Thread ID.',
		name: 'postMessageChannelThreadGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['channel'] } },
	},
	{
		displayName: 'Target',
		name: 'target',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: "Agent's Choice",
				value: 'agentChoice',
				description: 'Let the AI choose one target family per tool call',
			},
			{ name: 'Bot', value: 'bot', description: 'Send message via a bot' },
			{ name: 'Channel', value: 'channel', description: 'Send message to a channel' },
			{ name: 'Chat', value: 'chat', description: 'Send message to a chat by ID' },
			{
				name: 'Thread',
				value: 'thread',
				description: 'Send message to a thread by combining Chat ID + Thread ID',
			},
			{
				name: 'User',
				value: 'user',
				description:
					'Send a direct message from the authenticated Zoho Cliq user to one user by email or ZUID',
			},
		],
		default: 'channel',
		description: 'Where to send the message',
	},
	{
		displayName: `Agent Choice Guidance: To use <b>Agent's Choice</b> as an AI Tool, keep <b>Target</b> fixed to <b>Agent's Choice</b>, switch <b>Agent Selected Target</b> to expression mode, and configure every agent-choice identifier field with its optional AI expression so those inputs appear in the tool schema. This mode gives the AI broader routing access across channels, chats, threads, bots, and users, so enable it only when that level of access is intentional. See the <a href="${MESSAGE_POST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Tool Setup Guide</a> for the recommended setup pattern.`,
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
		default: 'chat',
		description:
			"Choose which target family should be used for this tool call. In the Agent's Choice AI setup path, switch this field to expression mode and use the provided AI expression.",
		options: [
			{ name: 'Bot', value: 'bot' },
			{ name: 'Channel (By ID)', value: 'channelId' },
			{ name: 'Channel (By Unique Name)', value: 'channelUniqueName' },
			{ name: 'Chat', value: 'chat' },
			{ name: 'Thread', value: 'thread' },
			{ name: 'User', value: 'user' },
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
		displayName: 'Bot Unique Name',
		name: 'agentBotUniqueName',
		type: 'string',
		default: '',
		placeholder: 'e.g. helpdeskbot',
		description:
			'Provide the exact bot unique name when Agent Selected Target is Bot, or when Post as Bot is enabled for an agent-selected Channel or Chat target. Blank values are allowed and omitted.',
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
		displayName: 'Thread Chat ID',
		name: 'agentThreadChatId',
		type: 'string',
		default: '',
		placeholder: 'e.g. CT_1234567890_1234567890',
		description:
			'Only provide the exact chat ID that contains the target thread when Agent Selected Target is set to Thread. Blank values are allowed and omitted.',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: 'Thread ID',
		name: 'agentThreadId',
		type: 'string',
		default: '',
		placeholder: 'e.g. TH_1234567890',
		description:
			'Only provide the exact thread ID when Agent Selected Target is set to Thread. Blank values are allowed and omitted.',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: 'Email ID / ZUID',
		name: 'agentEmailOrZuid',
		type: 'string',
		default: '',
		placeholder: 'e.g. user@example.com',
		description:
			'Only provide the exact user email address or ZUID when Agent Selected Target is set to User. This posts a direct message from the authenticated Zoho Cliq user to that recipient. Blank values are allowed and omitted. Example email: jane@example.com. Example ZUID: 839367970.',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		...channelRLC,
		displayOptions: { show: { target: ['channel'] } },
		description: 'Choose a channel from list, or provide Channel ID / Channel Unique Name manually',
	},
	{
		displayName: 'Broadcast',
		name: 'broadcast',
		type: 'boolean',
		default: false,
		description: 'Whether to send this bot message to all subscribers of the selected bot',
		displayOptions: { show: { target: ['bot'] } },
	},
	{
		displayName:
			'Bot Subscriber User IDs is a comma-separated list of user IDs. Each user must already be subscribed to the bot. Use ZohoCliq.Bots.GetBotSubscribers to verify subscriptions.',
		name: 'botSubscriberUserIdsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				target: ['bot'],
				broadcast: [false],
			},
		},
	},
	{
		displayName: 'Bot Subscriber User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. 55743307,55622727',
		description: 'Comma-separated user IDs to receive this bot message (userids)',
		displayOptions: {
			show: {
				target: ['bot'],
				broadcast: [false],
			},
		},
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { target: ['chat'] } },
		description: 'Chat ID to post into',
	},
	{
		displayName: 'Post to Thread',
		name: 'postToThread',
		type: 'boolean',
		default: false,
		displayOptions: { show: { target: ['chat'] } },
		description: 'Whether to post into a specific thread under this chat',
	},
	{
		displayName:
			'Thread Posting Guidance: This uses the Chats endpoint with <b>{chatId}-{threadId}</b>. For channel threads, provide the channel Chat ID (not channel unique name).',
		name: 'threadPostingGuidance',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['chat', 'thread'] } },
	},
	{
		displayName: 'Thread ID',
		name: 'threadId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				target: ['chat'],
				postToThread: [true],
			},
		},
		description:
			'Optional Thread ID. If empty, message is posted to Chat ID even when Post to Thread is enabled.',
	},
	{
		displayName: 'Chat ID',
		name: 'threadChatId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { target: ['thread'] } },
		description: 'Chat ID that contains the target thread (includes channel chat IDs)',
	},
	{
		displayName: 'Thread ID',
		name: 'threadTargetId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { target: ['thread'] } },
		description: 'Thread ID to combine with Thread Chat ID',
	},
	{
		displayName: 'Email ID / ZUID',
		name: 'emailOrZuid',
		type: 'string',
		default: '',
		required: true,
		displayOptions: { show: { target: ['user'] } },
		description:
			'Recipient user email address or ZUID for a direct message sent from the authenticated Zoho Cliq user via /buddies/{EMAIL_ID}/message. Example email: jane@example.com. Example ZUID: 839367970.',
	},
	...postMessagePayloadDescription,
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
						displayName: 'Mark as Read',
						name: 'markAsRead',
						type: 'boolean',
						default: false,
						description: 'Whether the posted message should be marked as read (mark_as_read)',
						displayOptions: {
							show: { '/target': ['channel', 'chat', 'thread', 'user', 'agentChoice'] },
						},
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
							'Whether to request synchronous behavior and return created message metadata such as message_id in the response (sync_message). Works for all target families and is recommended whenever the workflow needs message_id or other message metadata. Without it, most targets return sparse or empty responses by default.',
					},
				],
			},
		],
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			'Whether to append workflow-friendly metadata for channel-target posts. When enabled and the resolved target is Channel, the node attempts a follow-up Get Channel request and adds `posted_to_channel.channel_id`, `posted_to_channel.chat_id`, `posted_to_channel.unique_name`, and `posted_to_channel.level` when available.',
	},
	{
		displayName:
			'Post Message Docs (Channel): <a href="https://www.zoho.com/cliq/help/restapi/v2/#Post_Message_Channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'postMessageChannelDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['channel'] } },
	},
	{
		displayName:
			'Post Message Docs (Bot): <a href="https://www.zoho.com/cliq/help/restapi/v2/#Post_Message_Bot" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'postMessageBotDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['bot'] } },
	},
	{
		displayName:
			'Post Message Docs (Chat): <a href="https://www.zoho.com/cliq/help/restapi/v2/#Post_Message_Chat" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'postMessageChatDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['chat'] } },
	},
	{
		displayName:
			'Post Message Docs (Thread): <a href="https://www.zoho.com/cliq/help/restapi/v2/#Post_Message_Chat" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>',
		name: 'postMessageThreadDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['thread'] } },
	},
	{
		displayName:
			'Post Message Docs (User): <a href="https://www.zoho.com/cliq/help/restapi/v2/#Post_Message_User" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>. DIRECT-MESSAGE PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Users.READ</code>',
		name: 'postMessageUserDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['user'] } },
	},
	{
		displayName:
			'Post Message Docs (Agent Choice): <a href="https://www.zoho.com/cliq/help/restapi/v2/#Post_Message_Chat" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Webhooks.CREATE</code>. IF TARGET RESOLVES TO USER, PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Users.READ</code>',
		name: 'postMessageAgentChoiceDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { target: ['agentChoice'] } },
	},
	{
		displayName: `Zoho Cliq Message/Post Message as AI Tool Setup Guide: <a href="${MESSAGE_POST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'postMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

// Display options for this operation
const displayOptions = {
	show: {
		resource: ['message'],
		operation: ['post'],
	},
};

// Export description with display options
export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

const validMessageTargetSelections = new Set<MessageTargetSelection>([
	'agentChoice',
	'channel',
	'bot',
	'chat',
	'thread',
	'user',
]);
const validAgentSelectedTargets = new Set<AgentSelectableMessageTarget>([
	'channelId',
	'channelUniqueName',
	'bot',
	'chat',
	'thread',
	'user',
]);

function getOptionalTrimmedString(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function sanitizeBotUniqueName(
	context: IExecuteFunctions,
	botUniqueName: string,
	itemIndex: number,
	fieldName = 'Bot Unique Name',
): string {
	if (!botUniqueName || !botUniqueName.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is required and cannot be empty`,
			{
				itemIndex,
			},
		);
	}

	const sanitizedBotName = botUniqueName.trim();
	if (!/^[a-zA-Z0-9]+$/.test(sanitizedBotName)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid ${fieldName} format. Only letters and numbers are allowed.`,
			{ itemIndex },
		);
	}

	if (sanitizedBotName.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is too long. Maximum length is 100 characters.`,
			{ itemIndex },
		);
	}

	return sanitizedBotName;
}

function validatePostChatId(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
	fieldName = 'Chat ID',
): string {
	if (!value || !value.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is required and cannot be empty`,
			{
				itemIndex,
			},
		);
	}

	const sanitizedChatId = value.trim();
	if (!/^[a-zA-Z0-9@._-]+$/.test(sanitizedChatId)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid ${fieldName} format. Only alphanumeric characters, @, dots, hyphens, and underscores are allowed.`,
			{ itemIndex },
		);
	}

	if (sanitizedChatId.length > 255) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is too long. Maximum length is 255 characters.`,
			{ itemIndex },
		);
	}

	if (!/^(?:CT_[A-Za-z0-9_-]{1,252}|[0-9][A-Za-z0-9_-]{0,254})$/.test(sanitizedChatId)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must start with a number or "CT_". It appears a Channel ID or other non-chat identifier was provided.`,
			{ itemIndex },
		);
	}

	return sanitizedChatId;
}

function validateMessageTargetSelection(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): MessageTargetSelection {
	const sanitized = getOptionalTrimmedString(value);
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Target is required', { itemIndex });
	}

	if (!validMessageTargetSelections.has(sanitized as MessageTargetSelection)) {
		throw new NodeOperationError(
			context.getNode(),
			'Target must be one of: "agentChoice", "channel", "bot", "chat", "thread", "user".',
			{ itemIndex },
		);
	}

	return sanitized as MessageTargetSelection;
}

function validateAgentSelectedTarget(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): AgentSelectableMessageTarget {
	const sanitized = getOptionalTrimmedString(value);
	if (!sanitized) {
		throw new NodeOperationError(
			context.getNode(),
			'Agent Selected Target is required when Target is set to "Agent\'s Choice".',
			{ itemIndex },
		);
	}

	if (!validAgentSelectedTargets.has(sanitized as AgentSelectableMessageTarget)) {
		throw new NodeOperationError(
			context.getNode(),
			'Agent Selected Target must be one of: "channelId", "channelUniqueName", "bot", "chat", "thread", "user".',
			{ itemIndex },
		);
	}

	return sanitized as AgentSelectableMessageTarget;
}

function validateAgentChoiceFieldSet(
	context: IExecuteFunctions,
	itemIndex: number,
	selectedTarget: AgentSelectableMessageTarget,
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
		`When Agent Selected Target is "${selectedTarget}", only the matching target identifier field(s) may be provided. Clear ${unexpectedNames}.`,
		{ itemIndex },
	);
}

function resolveAgentChoiceTarget(
	context: IExecuteFunctions,
	itemIndex: number,
	postAsBot: boolean,
): {
	selectedTarget: AgentSelectableMessageTarget;
	target: MessageTarget;
	endpoint: string;
	targetIdentifier: string;
	channelLookup?: IChannelLookupContext;
	chatLookupId?: string;
} {
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
	const botUniqueName = getOptionalTrimmedString(
		context.getNodeParameter('agentBotUniqueName', itemIndex, ''),
	);
	const chatId = getOptionalTrimmedString(context.getNodeParameter('agentChatId', itemIndex, ''));
	const threadChatId = getOptionalTrimmedString(
		context.getNodeParameter('agentThreadChatId', itemIndex, ''),
	);
	const threadId = getOptionalTrimmedString(
		context.getNodeParameter('agentThreadId', itemIndex, ''),
	);
	const emailOrZuid = getOptionalTrimmedString(
		context.getNodeParameter('agentEmailOrZuid', itemIndex, ''),
	);
	const botDisplayName = getOptionalTrimmedString(
		context.getNodeParameter('botDisplayName', itemIndex, ''),
	);
	const botImage = getOptionalTrimmedString(context.getNodeParameter('botImage', itemIndex, ''));

	const providedFields = [
		...(channelId ? [{ fieldName: 'agentChannelId', displayName: 'Channel ID' }] : []),
		...(channelUniqueName
			? [{ fieldName: 'agentChannelUniqueName', displayName: 'Channel Unique Name' }]
			: []),
		...(botUniqueName ? [{ fieldName: 'agentBotUniqueName', displayName: 'Bot Unique Name' }] : []),
		...(chatId ? [{ fieldName: 'agentChatId', displayName: 'Chat ID' }] : []),
		...(threadChatId ? [{ fieldName: 'agentThreadChatId', displayName: 'Thread Chat ID' }] : []),
		...(threadId ? [{ fieldName: 'agentThreadId', displayName: 'Thread ID' }] : []),
		...(emailOrZuid ? [{ fieldName: 'agentEmailOrZuid', displayName: 'Email ID / ZUID' }] : []),
		...(botDisplayName ? [{ fieldName: 'botDisplayName', displayName: 'Bot Display Name' }] : []),
		...(botImage ? [{ fieldName: 'botImage', displayName: 'Bot Image URL' }] : []),
	];

	if (selectedTarget === 'channelId') {
		validateAgentChoiceFieldSet(
			context,
			itemIndex,
			selectedTarget,
			providedFields,
			postAsBot
				? ['agentChannelId', 'agentBotUniqueName', 'botDisplayName', 'botImage']
				: ['agentChannelId'],
		);
		if (!channelId) {
			throw new NodeOperationError(
				context.getNode(),
				'Channel ID is required when Agent Selected Target is "channelId".',
				{ itemIndex },
			);
		}

		const sanitizedChannelId = validateChannelId(context, channelId, itemIndex);
		return {
			selectedTarget,
			target: 'channel',
			endpoint: `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/message`,
			targetIdentifier: sanitizedChannelId,
			channelLookup: {
				mode: 'id',
				value: sanitizedChannelId,
			},
		};
	}

	if (selectedTarget === 'channelUniqueName') {
		validateAgentChoiceFieldSet(
			context,
			itemIndex,
			selectedTarget,
			providedFields,
			postAsBot
				? ['agentChannelUniqueName', 'agentBotUniqueName', 'botDisplayName', 'botImage']
				: ['agentChannelUniqueName'],
		);
		if (!channelUniqueName) {
			throw new NodeOperationError(
				context.getNode(),
				'Channel Unique Name is required when Agent Selected Target is "channelUniqueName".',
				{ itemIndex },
			);
		}

		const sanitizedChannelUniqueName = validateChannelName(context, channelUniqueName, itemIndex);
		return {
			selectedTarget,
			target: 'channel',
			endpoint: `/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelUniqueName)}/message`,
			targetIdentifier: sanitizedChannelUniqueName,
			channelLookup: {
				mode: 'name',
				value: sanitizedChannelUniqueName,
			},
		};
	}

	if (selectedTarget === 'chat') {
		validateAgentChoiceFieldSet(
			context,
			itemIndex,
			selectedTarget,
			providedFields,
			postAsBot
				? ['agentChatId', 'agentBotUniqueName', 'botDisplayName', 'botImage']
				: ['agentChatId'],
		);
		if (!chatId) {
			throw new NodeOperationError(
				context.getNode(),
				'Chat ID is required when Agent Selected Target is "chat".',
				{ itemIndex },
			);
		}

		const sanitizedChatId = validatePostChatId(context, chatId, itemIndex);
		return {
			selectedTarget,
			target: 'chat',
			endpoint: `/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/message`,
			targetIdentifier: sanitizedChatId,
			chatLookupId: sanitizedChatId,
		};
	}

	if (postAsBot) {
		throw new NodeOperationError(
			context.getNode(),
			'Post as Bot is only supported when targeting Channel, Channel (By Unique Name), or Chat.',
			{ itemIndex },
		);
	}

	if (selectedTarget === 'bot') {
		validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
			'agentBotUniqueName',
		]);
		if (!botUniqueName) {
			throw new NodeOperationError(
				context.getNode(),
				'Bot Unique Name is required when Agent Selected Target is "bot".',
				{ itemIndex },
			);
		}
		const sanitizedBotName = sanitizeBotUniqueName(
			context,
			botUniqueName,
			itemIndex,
			'Bot Unique Name',
		);
		return {
			selectedTarget,
			target: 'bot',
			endpoint: `/api/v2/bots/${encodeURIComponent(sanitizedBotName)}/message`,
			targetIdentifier: sanitizedBotName,
		};
	}

	if (selectedTarget === 'thread') {
		validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
			'agentThreadChatId',
			'agentThreadId',
		]);
		if (!threadChatId) {
			throw new NodeOperationError(
				context.getNode(),
				'Thread Chat ID is required when Agent Selected Target is "thread".',
				{ itemIndex },
			);
		}
		if (!threadId) {
			throw new NodeOperationError(
				context.getNode(),
				'Thread ID is required when Agent Selected Target is "thread".',
				{ itemIndex },
			);
		}

		const sanitizedThreadChatId = validatePostChatId(
			context,
			threadChatId,
			itemIndex,
			'Thread Chat ID',
		);
		const sanitizedThreadId = validateThreadId(context, threadId, itemIndex);
		return {
			selectedTarget,
			target: 'thread',
			endpoint: `/api/v2/chats/${encodeURIComponent(`${sanitizedThreadChatId}-${sanitizedThreadId}`)}/message`,
			targetIdentifier: `${sanitizedThreadChatId}-${sanitizedThreadId}`,
			chatLookupId: sanitizedThreadChatId,
		};
	}

	validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
		'agentEmailOrZuid',
	]);
	if (!emailOrZuid) {
		throw new NodeOperationError(
			context.getNode(),
			'Email ID / ZUID is required when Agent Selected Target is "user".',
			{ itemIndex },
		);
	}

	const sanitizedEmailOrZuid = sanitizeDirectMessageUserIdentifier(context, emailOrZuid, itemIndex);
	return {
		selectedTarget,
		target: 'user',
		endpoint: `/api/v2/buddies/${encodeURIComponent(sanitizedEmailOrZuid)}/message`,
		targetIdentifier: sanitizedEmailOrZuid,
	};
}

function normalizeObjectCandidate(candidate: unknown): IDataObject | undefined {
	if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
		return undefined;
	}

	return candidate as IDataObject;
}

function readPostedChannelInfo(candidate: unknown): IDataObject {
	const normalizedCandidate = normalizeObjectCandidate(candidate);
	if (!normalizedCandidate) {
		return {};
	}

	const output: IDataObject = {};
	const channelId = normalizedCandidate.channel_id;
	if (typeof channelId === 'string' && channelId.trim()) {
		output.channel_id = channelId.trim();
	}

	const chatId = normalizedCandidate.chat_id;
	if (typeof chatId === 'string' && chatId.trim()) {
		output.chat_id = chatId.trim();
	}

	const uniqueName = normalizedCandidate.unique_name;
	if (typeof uniqueName === 'string' && uniqueName.trim()) {
		output.unique_name = uniqueName.trim();
	}

	const level = normalizedCandidate.level;
	if (typeof level === 'string' && level.trim()) {
		output.level = level.trim();
	}

	return output;
}

function extractPostedChannelInfo(response: unknown): IDataObject {
	const root = normalizeObjectCandidate(response);
	if (!root) {
		return {};
	}

	const merged: IDataObject = {};
	for (const candidate of [root, root.channel, root.data, root.result]) {
		Object.assign(merged, readPostedChannelInfo(candidate));
	}

	return merged;
}

function resolveIncludeEnhancedOutput(context: IExecuteFunctions, itemIndex: number): boolean {
	const rawValue = context.getNodeParameter('includeEnhancedOutput', itemIndex, true);
	if (rawValue === undefined || rawValue === null) {
		return true;
	}

	if (typeof rawValue !== 'boolean') {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid includeEnhancedOutput value: must be a boolean',
			{ itemIndex },
		);
	}

	return rawValue;
}

async function tryResolvePostedChannelOutput(
	context: IExecuteFunctions,
	grantedScopes: string,
	channelLookup: IChannelLookupContext,
	prevalidatedChannel?: IDataObject,
): Promise<IDataObject | undefined> {
	const fallback: IDataObject =
		channelLookup.mode === 'id'
			? { channel_id: channelLookup.value }
			: { unique_name: channelLookup.value };

	if (prevalidatedChannel) {
		return {
			...fallback,
			...extractPostedChannelInfo(prevalidatedChannel),
		};
	}

	const channelReadScope = getRequiredScopeForOperation('channel', 'get');

	if (!hasRequiredScope(grantedScopes, channelReadScope)) {
		return fallback;
	}

	try {
		const endpoint =
			channelLookup.mode === 'id'
				? `/api/v2/channels/${encodeURIComponent(channelLookup.value)}`
				: `/api/v2/channelsbyname/${encodeURIComponent(channelLookup.value)}`;
		const response = await zohoCliqApiRequest.call(context, 'GET', endpoint);
		const merged = {
			...fallback,
			...extractPostedChannelInfo(response),
		};

		return merged;
	} catch {
		return fallback;
	}
}

async function runPostMessageTargetPreflightIfPossible(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	config: {
		target?: MessageTarget;
		targetIdentifier?: string;
		channelLookup?: IChannelLookupContext;
		chatLookupId?: string;
	},
): Promise<IDataObject | undefined> {
	switch (config.target) {
		case 'channel': {
			if (!config.channelLookup) {
				return;
			}

			if (config.channelLookup.mode === 'name') {
				const preflightResult = await runChannelUniqueNameLookupPreflightGate(
					context,
					itemIndex,
					grantedScopes,
					config.channelLookup.value,
				);
				return preflightResult.status === 'validated' ? preflightResult.entity : undefined;
			}

			const preflightResult = await runChannelIdLookupPreflightGate(
				context,
				itemIndex,
				grantedScopes,
				config.channelLookup.value,
			);
			return preflightResult.status === 'validated' ? preflightResult.entity : undefined;
		}
		case 'chat': {
			if (!config.chatLookupId) {
				return;
			}

			await runChatLookupPreflightGate(context, itemIndex, grantedScopes, config.chatLookupId);
			return;
		}
		case 'thread': {
			if (!config.chatLookupId) {
				return;
			}

			await runChatLookupPreflightGate(context, itemIndex, grantedScopes, config.chatLookupId, {
				fieldLabel: 'Thread Chat ID',
			});
			return;
		}
		case 'user': {
			if (!config.targetIdentifier) {
				return;
			}

			await runDirectMessageRecipientPreflightGate(
				context,
				itemIndex,
				grantedScopes,
				config.targetIdentifier,
			);
			return;
		}
		default:
			return;
	}
}

function normalizePostMessageId(rawMessageId: string): string {
	let normalized = rawMessageId;
	if (normalized.includes('%') || normalized.includes('+')) {
		try {
			normalized = decodeURIComponent(normalized.replace(/\+/g, '%20'));
		} catch {
			normalized = rawMessageId;
		}
	}

	return normalizeZohoMessageIdOutput(normalized);
}

function normalizeOptionalPostMessageId(
	value: IDataObject[string] | undefined,
): IDataObject[string] | undefined {
	if (typeof value !== 'string') {
		return value;
	}

	return normalizePostMessageId(value);
}

function splitCompositeThreadChatId(
	compositeChatId: string,
): { threadChatId: string; threadId: string } | undefined {
	const marker = '-T-';
	const markerIndex = compositeChatId.indexOf(marker);
	if (markerIndex <= 0) {
		return undefined;
	}

	const threadChatId = compositeChatId.slice(0, markerIndex).trim();
	const threadId = compositeChatId.slice(markerIndex + 1).trim();
	if (!threadChatId || !threadId.startsWith('T-')) {
		return undefined;
	}

	return {
		threadChatId,
		threadId,
	};
}

function normalizePostResponse(responseData: IDataObject): IDataObject {
	const normalizedResponse: IDataObject = { ...responseData };
	normalizedResponse.message_id = normalizeOptionalPostMessageId(normalizedResponse.message_id);

	const threadInformation = normalizedResponse.thread_information;
	if (
		threadInformation &&
		typeof threadInformation === 'object' &&
		!Array.isArray(threadInformation)
	) {
		const normalizedThreadInformation = { ...(threadInformation as IDataObject) };
		normalizedThreadInformation.parent_message_id = normalizeOptionalPostMessageId(
			normalizedThreadInformation.parent_message_id,
		);

		const compositeThreadChatId = normalizedThreadInformation.chat_id;
		if (typeof compositeThreadChatId === 'string') {
			const splitThreadIdentifiers = splitCompositeThreadChatId(compositeThreadChatId);
			if (splitThreadIdentifiers) {
				normalizedThreadInformation.thread_chat_id = splitThreadIdentifiers.threadChatId;
				normalizedThreadInformation.thread_id = splitThreadIdentifiers.threadId;
			}
		}

		normalizedResponse.thread_information = normalizedThreadInformation;
	}

	const messageDetails = normalizedResponse.message_details;
	if (messageDetails && typeof messageDetails === 'object' && !Array.isArray(messageDetails)) {
		const normalizedMessageDetails: IDataObject = {};
		for (const [userId, details] of Object.entries(messageDetails as IDataObject)) {
			if (details && typeof details === 'object' && !Array.isArray(details)) {
				const normalizedDetail = { ...(details as IDataObject) };
				normalizedDetail.message_id = normalizeOptionalPostMessageId(normalizedDetail.message_id);
				normalizedMessageDetails[userId] = normalizedDetail;
			} else {
				normalizedMessageDetails[userId] = details;
			}
		}
		normalizedResponse.message_details = normalizedMessageDetails;
	}

	return normalizedResponse;
}

function buildThreadPostFailedError(
	context: IExecuteFunctions,
	itemIndex: number,
	targetIdentifier: string,
): NodeOperationError {
	const threadPostError = new NodeOperationError(
		context.getNode(),
		'Zoho Cliq returned an empty response for this thread post, so the node could not confirm that the message was created. Verify the Thread Chat ID and Thread ID before retrying.',
		{
			itemIndex,
			description: `The thread-routed post to "${targetIdentifier}" returned an empty response body, which often indicates the Thread ID is wrong, stale, or does not belong to the supplied Thread Chat ID.`,
		},
	);
	(threadPostError as NodeOperationError & { code?: string }).code = THREAD_POST_FAILED_ERROR_CODE;
	(threadPostError as NodeOperationError & { hint?: string }).hint = THREAD_POST_FAILED_HINT;
	return threadPostError;
}

function isEffectivelyEmptyPostResponse(response: IDataObject): boolean {
	return !Object.values(response).some((value) => value !== undefined);
}

function mapThreadPostFailedErrorIfPossible(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	threadRoutedTarget: boolean,
	targetIdentifier?: string,
	replyToMessageId?: string,
): unknown {
	if (!threadRoutedTarget || replyToMessageId !== undefined || !targetIdentifier) {
		return error;
	}

	const normalizedMessage = extractCliqErrorSearchText(error).toLowerCase();
	const isGenericTechnicalError =
		normalizedMessage.includes("couldn't process your request due to a technical error") ||
		normalizedMessage.includes('technical error');

	if (!isGenericTechnicalError) {
		return error;
	}

	const threadPostError = buildThreadPostFailedError(context, itemIndex, targetIdentifier);
	const originalResponse =
		typeof error === 'object' && error !== null && 'response' in error
			? (error as { response?: unknown }).response
			: undefined;
	if (originalResponse !== undefined) {
		(threadPostError as NodeOperationError & { response?: unknown }).response = originalResponse;
	}
	const originalStatusCode =
		typeof error === 'object' && error !== null && 'statusCode' in error
			? (error as { statusCode?: unknown }).statusCode
			: undefined;
	if (typeof originalStatusCode === 'number') {
		(threadPostError as NodeOperationError & { statusCode?: number }).statusCode =
			originalStatusCode;
	}

	return threadPostError;
}

function sanitizeDirectMessageUserIdentifier(
	context: IExecuteFunctions,
	rawValue: string,
	itemIndex: number,
	fieldLabel = 'Email ID / ZUID',
): string {
	const sanitized = rawValue.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), `${fieldLabel} is required`, {
			itemIndex,
		});
	}

	return sanitized.includes('@')
		? validateEmail(context, sanitized.toLowerCase(), itemIndex)
		: validateUserId(context, sanitized, itemIndex);
}

// Execute function
export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('message', 'post');
	const returnData: INodeExecutionData[] = [];

	const parseAttachedPayloadObjects = (
		rawValue: unknown,
		fieldName: string,
		itemIndex: number,
	): IDataObject[] => {
		if (rawValue === undefined || rawValue === null) {
			return [];
		}

		let parsedValue: unknown = rawValue;
		if (typeof rawValue === 'string') {
			const trimmed = rawValue.trim();
			if (!trimmed) {
				return [];
			}

			try {
				parsedValue = JSON.parse(trimmed);
			} catch {
				throw new NodeOperationError(
					this.getNode(),
					`${fieldName} must be valid JSON object/array when provided as a string`,
					{ itemIndex },
				);
			}
		}

		if (Array.isArray(parsedValue)) {
			return parsedValue.map((entry, entryIndex) => {
				if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
					throw new NodeOperationError(
						this.getNode(),
						`${fieldName}[${entryIndex}] must be a JSON object`,
						{ itemIndex },
					);
				}
				return sanitizeJsonBody(this, entry as IDataObject, itemIndex);
			});
		}

		if (!parsedValue || typeof parsedValue !== 'object') {
			throw new NodeOperationError(this.getNode(), `${fieldName} must be a JSON object or array`, {
				itemIndex,
			});
		}

		return [sanitizeJsonBody(this, parsedValue as IDataObject, itemIndex)];
	};

	for (let i = 0; i < items.length; i++) {
		let targetSelection: MessageTargetSelection | undefined;
		let agentSelectedTarget: AgentSelectableMessageTarget | undefined;
		let target: MessageTarget | undefined;
		let targetIdentifier: string | undefined;
		let messageType: 'text' | 'rich' | 'json' | undefined;
		let replyToMessageId: string | undefined;
		let threadRoutedTarget = false;
		let endpoint = '';
		let channelLookup: IChannelLookupContext | undefined;
		let chatLookupId: string | undefined;
		let includeEnhancedOutput = false;
		let postAttempted = false;
		let prevalidatedChannel: IDataObject | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			targetSelection = validateMessageTargetSelection(this, this.getNodeParameter('target', i), i);
			const postAsBotRaw = this.getNodeParameter('postAsBot', i, false);
			const postAsBotValue = postAsBotRaw ?? false;
			if (!isBoolean(postAsBotValue)) {
				throw new NodeOperationError(this.getNode(), 'postAsBot must be a boolean', {
					itemIndex: i,
				});
			}

			if (targetSelection === 'agentChoice') {
				const resolvedAgentChoice = resolveAgentChoiceTarget(this, i, postAsBotValue);
				agentSelectedTarget = resolvedAgentChoice.selectedTarget;
				target = resolvedAgentChoice.target;
				endpoint = resolvedAgentChoice.endpoint;
				targetIdentifier = resolvedAgentChoice.targetIdentifier;
				channelLookup = resolvedAgentChoice.channelLookup;
				chatLookupId = resolvedAgentChoice.chatLookupId;
				threadRoutedTarget = resolvedAgentChoice.target === 'thread';
			} else {
				target = targetSelection;
			}

			if (target !== 'channel' && target !== 'chat' && postAsBotValue) {
				throw new NodeOperationError(
					this.getNode(),
					'Post as Bot is only supported when Target is Channel or Chat.',
					{ itemIndex: i },
				);
			}

			includeEnhancedOutput = resolveIncludeEnhancedOutput(this, i);

			messageType = this.getNodeParameter('messageType', i) as 'text' | 'rich' | 'json';
			const body = resolveMessagePayload(this, i, {
				textMaxLength: 5000,
				textTypeErrorMessage: 'Invalid text message: must be a string',
				requireMessageContent: true,
			}) as IMessageBody;
			const attachComponentPayloadsRaw = this.getNodeParameter('attachComponentPayloads', i, false);
			const attachComponentPayloads = attachComponentPayloadsRaw ?? false;
			if (!isBoolean(attachComponentPayloads)) {
				throw new NodeOperationError(this.getNode(), 'attachComponentPayloads must be a boolean', {
					itemIndex: i,
				});
			}
			if (messageType === 'text' && attachComponentPayloads) {
				const attachedSlidesRaw = this.getNodeParameter('attachedSlides', i, '[]');
				const attachedButtonsRaw = this.getNodeParameter('attachedButtons', i, '[]');
				const attachedSlides = parseAttachedPayloadObjects(attachedSlidesRaw, 'slides', i);
				const attachedButtons = parseAttachedPayloadObjects(attachedButtonsRaw, 'buttons', i);

				if (attachedSlides.length === 0 && attachedButtons.length === 0) {
					throw new NodeOperationError(
						this.getNode(),
						'Provide at least one slides or buttons payload when Attach Component Payloads is enabled',
						{ itemIndex: i },
					);
				}
				if (attachedSlides.length > 0) {
					body.slides = attachedSlides;
				}
				if (attachedButtons.length > 0) {
					body.buttons = attachedButtons as unknown as IMessageBody['buttons'];
				}
			}

			const optionalFieldsRaw = (this.getNodeParameter('optionalFields', i, {}) ??
				{}) as IDataObject;
			const optionalFieldsValue = optionalFieldsRaw.field;
			const optionalFields =
				optionalFieldsValue && typeof optionalFieldsValue === 'object'
					? (optionalFieldsValue as IDataObject)
					: optionalFieldsRaw;
			const replyTo = (optionalFields.replyTo as string | undefined) ?? '';
			if (typeof replyTo === 'string' && replyTo.trim() !== '') {
				replyToMessageId = validateMessageId(this, replyTo, i);
				body.reply_to = replyToMessageId;
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

			const markAsReadRaw = optionalFields.markAsRead ?? false;
			if (!isBoolean(markAsReadRaw)) {
				throw new NodeOperationError(this.getNode(), 'markAsRead must be a boolean', {
					itemIndex: i,
				});
			}
			const markAsRead = markAsReadRaw;
			const userIdsInput = this.getNodeParameter('userIds', i, '') as string | undefined;
			const broadcastRaw = this.getNodeParameter('broadcast', i, false);
			const broadcastValue = broadcastRaw ?? false;
			if (!isBoolean(broadcastValue)) {
				throw new NodeOperationError(this.getNode(), 'broadcast must be a boolean', {
					itemIndex: i,
				});
			}
			const legacyBotQuery = resolveBotUniqueNameQueryParam(
				this,
				i,
				targetSelection === 'agentChoice'
					? {
							botUniqueNameFieldName: 'agentBotUniqueName',
							validationContext:
								'Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
						}
					: undefined,
			);

			let qs: Record<string, string | number | boolean> | undefined;

			switch (target) {
				case 'channel': {
					if (targetSelection === 'agentChoice') {
						qs = { ...(legacyBotQuery ?? {}) };
						if (markAsRead) {
							qs.mark_as_read = true;
						}
						if (Object.keys(qs).length === 0) {
							qs = undefined;
						}
						break;
					}
					const channelLocatorValue = this.getNodeParameter('channelId', i, '', {
						extractValue: true,
					}) as string;
					const channelLocator = this.getNodeParameter('channelId', i) as unknown;
					const locatorMode =
						channelLocator && typeof channelLocator === 'object' && !Array.isArray(channelLocator)
							? String((channelLocator as IDataObject).mode ?? '')
							: '';

					if (locatorMode === 'name') {
						const sanitizedChannelName = validateChannelName(this, channelLocatorValue, i);
						endpoint = `/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelName)}/message`;
						targetIdentifier = sanitizedChannelName;
						channelLookup = {
							mode: 'name',
							value: sanitizedChannelName,
						};
					} else {
						const sanitizedChannelId = validateChannelId(this, channelLocatorValue, i);
						endpoint = `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/message`;
						targetIdentifier = sanitizedChannelId;
						channelLookup = {
							mode: 'id',
							value: sanitizedChannelId,
						};
					}

					qs = { ...(legacyBotQuery ?? {}) };
					if (markAsRead) {
						qs.mark_as_read = true;
					}
					if (Object.keys(qs).length === 0) {
						qs = undefined;
					}
					break;
				}
				case 'bot': {
					if (targetSelection === 'agentChoice') {
						break;
					}
					const botUniqueName = this.getNodeParameter('botUniqueName', i) as string;
					const sanitizedBotName = sanitizeBotUniqueName(this, botUniqueName, i);
					endpoint = `/api/v2/bots/${encodeURIComponent(sanitizedBotName)}/message`;
					targetIdentifier = sanitizedBotName;
					if (broadcastValue) {
						body.broadcast = true;
					} else if (typeof userIdsInput === 'string' && userIdsInput.trim() !== '') {
						const userIds = userIdsInput
							.split(',')
							.map((value) => value.trim())
							.filter((value) => value.length > 0);
						if (userIds.length === 0) {
							throw new NodeOperationError(
								this.getNode(),
								'User IDs must include at least one valid ID when provided',
								{ itemIndex: i },
							);
						}
						for (const userId of userIds) {
							if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
								throw new NodeOperationError(
									this.getNode(),
									`Invalid user ID in User IDs list: "${userId}"`,
									{ itemIndex: i },
								);
							}
						}
						body.userids = userIds.join(',');
					}
					break;
				}
				case 'chat': {
					if (targetSelection === 'agentChoice') {
						qs = legacyBotQuery ? { ...legacyBotQuery } : undefined;
						if (markAsRead) {
							body.mark_as_read = true;
						}
						break;
					}
					const chatId = this.getNodeParameter('chatId', i) as string;
					const sanitizedChatId = validatePostChatId(this, chatId, i);

					const postToThreadRaw = this.getNodeParameter('postToThread', i, false);
					const postToThreadValue = postToThreadRaw ?? false;
					if (!isBoolean(postToThreadValue)) {
						throw new NodeOperationError(this.getNode(), 'postToThread must be a boolean', {
							itemIndex: i,
						});
					}

					let resolvedChatTargetId = sanitizedChatId;
					if (postToThreadValue) {
						const threadIdInput = this.getNodeParameter('threadId', i, '') as string;
						if (typeof threadIdInput === 'string' && threadIdInput.trim() !== '') {
							const sanitizedThreadId = validateThreadId(this, threadIdInput, i);
							resolvedChatTargetId = `${sanitizedChatId}-${sanitizedThreadId}`;
							threadRoutedTarget = true;
						}
					}

					endpoint = `/api/v2/chats/${encodeURIComponent(resolvedChatTargetId)}/message`;
					targetIdentifier = resolvedChatTargetId;
					chatLookupId = sanitizedChatId;
					qs = legacyBotQuery ? { ...legacyBotQuery } : undefined;
					if (markAsRead) {
						body.mark_as_read = true;
					}
					break;
				}
				case 'thread': {
					if (targetSelection === 'agentChoice') {
						if (markAsRead) {
							body.mark_as_read = true;
						}
						break;
					}
					const threadChatId = this.getNodeParameter('threadChatId', i) as string;
					const sanitizedThreadChatId = validatePostChatId(this, threadChatId, i, 'Thread Chat ID');
					const threadTargetId = this.getNodeParameter('threadTargetId', i) as string;
					const sanitizedThreadId = validateThreadId(this, threadTargetId, i);
					endpoint = `/api/v2/chats/${encodeURIComponent(`${sanitizedThreadChatId}-${sanitizedThreadId}`)}/message`;
					targetIdentifier = `${sanitizedThreadChatId}-${sanitizedThreadId}`;
					chatLookupId = sanitizedThreadChatId;
					threadRoutedTarget = true;
					if (markAsRead) {
						body.mark_as_read = true;
					}
					break;
				}
				case 'user': {
					if (targetSelection === 'agentChoice') {
						if (markAsRead) {
							body.mark_as_read = true;
						}
						break;
					}
					const emailOrZuid = this.getNodeParameter('emailOrZuid', i) as string;
					const sanitizedEmailOrZuid = sanitizeDirectMessageUserIdentifier(this, emailOrZuid, i);
					endpoint = `/api/v2/buddies/${encodeURIComponent(sanitizedEmailOrZuid)}/message`;
					targetIdentifier = sanitizedEmailOrZuid;
					if (markAsRead) {
						body.mark_as_read = true;
					}
					break;
				}
			}

			prevalidatedChannel = await runPostMessageTargetPreflightIfPossible(this, i, grantedScopes, {
				target,
				targetIdentifier,
				channelLookup,
				chatLookupId,
			});

			postAttempted = true;
			const response = qs
				? await zohoCliqApiRequest.call(this, 'POST', endpoint, body, qs)
				: await zohoCliqApiRequest.call(this, 'POST', endpoint, body);
			const normalizedResponse = normalizePostResponse(response as IDataObject);
			if (threadRoutedTarget && isEffectivelyEmptyPostResponse(normalizedResponse)) {
				throw buildThreadPostFailedError(this, i, targetIdentifier as string);
			}
			const postedToChannel =
				includeEnhancedOutput && target === 'channel' && channelLookup
					? await tryResolvePostedChannelOutput(
							this,
							grantedScopes,
							channelLookup,
							prevalidatedChannel,
						)
					: undefined;

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json:
							postedToChannel && Object.keys(postedToChannel).length > 0
								? {
										...normalizedResponse,
										posted_to_channel: postedToChannel,
									}
								: normalizedResponse,
					},
				],
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			const errorForOutput = postAttempted
				? mapThreadPostFailedErrorIfPossible(
						this,
						error,
						i,
						threadRoutedTarget,
						targetIdentifier,
						replyToMessageId,
					)
				: error;
			if (
				pushMessageRecoverableError(this, returnData, i, 'post', errorForOutput, {
					contextFields: {
						...(targetSelection ? { target_selection: targetSelection } : {}),
						...(agentSelectedTarget ? { agent_selected_target: agentSelectedTarget } : {}),
						...(target ? { target } : {}),
						...(targetIdentifier ? { target_identifier: targetIdentifier } : {}),
						...(messageType ? { message_type: messageType } : {}),
						...(replyToMessageId ? { reply_to: replyToMessageId } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid target type') ||
								normalizedMessage.includes('post as bot is only supported') ||
								normalizedMessage.includes('agent selected target is required') ||
								normalizedMessage.includes('agent selected target must be one of'),
							reason: 'INVALID_TARGET',
							hint: 'Choose one supported target family and provide only the identifier fields that match that routing choice.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('bot unique name is required') ||
								normalizedMessage.includes('invalid bot unique name format') ||
								normalizedMessage.includes('bot unique name is too long'),
							reason: 'INVALID_BOT_IDENTIFIER',
							hint: 'Use the exact bot unique name from Zoho Cliq, with letters and numbers only.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid channel id format') ||
								normalizedMessage.includes('channel id is required') ||
								normalizedMessage.includes('channel unique name is required') ||
								normalizedMessage.includes('invalid channel unique name format'),
							reason: 'INVALID_CHANNEL_IDENTIFIER',
							hint: 'Use either a valid channel ID or a valid channel unique name based on the selected Channel locator mode.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('thread chat id is required') ||
								normalizedMessage.includes('thread chat id is too long') ||
								normalizedMessage.includes('invalid thread chat id format') ||
								normalizedMessage.includes('thread id is required') ||
								normalizedMessage.includes('thread id is too long') ||
								normalizedMessage.includes('invalid thread id format'),
							reason: 'INVALID_THREAD_IDENTIFIER',
							hint: 'Use the exact Thread Chat ID plus Thread ID that belong to the same Zoho Cliq thread. Thread requests need both values.',
						},
						{
							match: (_normalizedMessage, _message, error) =>
								error instanceof NodeOperationError &&
								(error as NodeOperationError & { code?: string }).code ===
									THREAD_POST_FAILED_ERROR_CODE,
							reason: 'THREAD_POST_FAILED',
							hint: THREAD_POST_FAILED_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('chat id is too long') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('must start with a number or "ct_"'),
							reason: 'INVALID_CHAT_IDENTIFIER',
							hint: 'Use the exact Zoho Cliq chat ID for the selected chat target. Chat IDs must start with a number or `CT_`. Do not provide channel IDs or thread IDs here.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('only the matching target identifier field'),
							reason: 'CONFLICTING_TARGET_FIELDS',
							hint: 'Provide only the target identifier field or fields for the selected target family. Clear any extra identifiers from other target families before retrying.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid email format') ||
								normalizedMessage.includes('invalid user id format') ||
								normalizedMessage.includes('email id / zuid is required') ||
								normalizedMessage.includes('user ids must include at least one valid id') ||
								normalizedMessage.includes('invalid user id in user ids list'),
							reason: 'INVALID_RECIPIENT_IDENTIFIER',
							hint: 'Use a valid user email/ZUID for User target, or a comma-separated list of valid user IDs for non-broadcast Bot target requests.',
						},
						{
							match: (_normalizedMessage, _message, error) =>
								error instanceof NodeOperationError &&
								(error as NodeOperationError & { code?: string }).code ===
									DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE,
							reason: DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE,
							hint: 'Use Get User or List Users to verify the exact recipient email ID or ZUID before posting a direct message.',
						},
						{
							match: (_normalizedMessage, _message, error) =>
								error instanceof NodeOperationError &&
								(error as NodeOperationError & { code?: string }).code === 'CHANNEL_NOT_FOUND',
							reason: 'CHANNEL_NOT_FOUND',
							hint: CHANNEL_NOT_FOUND_HINT,
						},
						{
							match: (_normalizedMessage, _message, error) =>
								error instanceof NodeOperationError &&
								(error as NodeOperationError & { code?: string }).code === 'CHAT_NOT_FOUND',
							reason: 'CHAT_NOT_FOUND',
							hint: CHAT_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'advanced (json) must include a top-level "text" field',
								) ||
								normalizedMessage.includes('advanced (json) "text" must be a string') ||
								normalizedMessage.includes('json payload cannot be empty'),
							reason: 'INVALID_RAW_JSON_PAYLOAD',
							hint: 'For Advanced (JSON), include a non-empty top-level `text` string. Use Advanced (JSON) mainly for card payloads such as `text` + `card`/`slides`/`buttons`. For plain-text-only messages, choose Message Type = Text (Cliq Markdown).',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid text message') ||
								normalizedMessage.includes('text is required and cannot be empty') ||
								normalizedMessage.includes('text message is too long') ||
								normalizedMessage.includes('must be valid json object/array') ||
								normalizedMessage.includes('must be a json object') ||
								normalizedMessage.includes('provide at least one slides or buttons payload') ||
								normalizedMessage.includes('invalid message type') ||
								normalizedMessage.includes('syncmessage must be a boolean') ||
								normalizedMessage.includes('markasread must be a boolean') ||
								normalizedMessage.includes('attachcomponentpayloads must be a boolean'),
							reason: 'INVALID_MESSAGE_PAYLOAD',
							hint: 'Review the message content, optional flags, and any attached slides/buttons JSON payloads before retrying.',
						},
					],
				})
			) {
				continue;
			}

			throw errorForOutput;
		}
	}

	return returnData;
}

export const __testHelpers = Object.freeze({
	runPostMessageTargetPreflightIfPossible,
});
