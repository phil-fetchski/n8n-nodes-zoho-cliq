import type { INodeProperties } from 'n8n-workflow';

import { channelIdOnlyRLC } from '../common.descriptions';
import { FILES_SHARE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';

const requiredScope = getRequiredScopeForOperation('files', 'shareFile');

type ShareDocsNoticeConfig = {
	docsLabel: string;
	name: string;
	target: 'channelId' | 'channelUniqueName' | 'chat' | 'bot' | 'buddy' | 'agentChoice';
	url: string;
};

const shareDocsNoticeConfigs: ShareDocsNoticeConfig[] = [
	{
		docsLabel: 'Share Files to Channel by ID Docs',
		name: 'shareFileChannelIdDocsNotice',
		target: 'channelId',
		url: 'https://www.zoho.com/cliq/help/restapi/v2/#Channel_File_Sharing',
	},
	{
		docsLabel: 'Share Files to Channel by Unique Name Docs',
		name: 'shareFileChannelUniqueNameDocsNotice',
		target: 'channelUniqueName',
		url: 'https://www.zoho.com/cliq/help/restapi/v2/#Channel_File_Sharing',
	},
	{
		docsLabel: 'Share Files to Chat Docs',
		name: 'shareFileChatDocsNotice',
		target: 'chat',
		url: 'https://www.zoho.com/cliq/help/restapi/v2/#Chat_File_Sharing',
	},
	{
		docsLabel: 'Share Files to Bot Docs',
		name: 'shareFileBotDocsNotice',
		target: 'bot',
		url: 'https://www.zoho.com/cliq/help/restapi/v2/#Bot_File_Sharing',
	},
	{
		docsLabel: 'Share Files to User Docs',
		name: 'shareFileBuddyDocsNotice',
		target: 'buddy',
		url: 'https://www.zoho.com/cliq/help/restapi/v2/#User_File_Sharing',
	},
	{
		docsLabel: 'Share Files Agent Choice Docs',
		name: 'shareFileAgentChoiceDocsNotice',
		target: 'agentChoice',
		url: 'https://www.zoho.com/cliq/help/restapi/v2/#Chat_File_Sharing',
	},
];

const shareDocsNotices: INodeProperties[] = shareDocsNoticeConfigs.map((entry) => ({
	displayName: `${entry.docsLabel}: <a href="${entry.url}" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
	name: entry.name,
	type: 'notice',
	default: '',
	displayOptions: {
		show: {
			shareTarget: [entry.target],
		},
	},
}));

export const properties: INodeProperties[] = [
	{
		displayName: 'Share Target',
		name: 'shareTarget',
		type: 'options',
		required: true,
		noDataExpression: true,
		default: 'chat',
		description:
			'Choose where the files should be shared: a chat, a channel, a bot conversation, or a direct user target',
		options: [
			{
				name: "Agent's Choice",
				value: 'agentChoice',
			},
			{
				name: 'Bot',
				value: 'bot',
			},
			{
				name: 'Channel (By ID)',
				value: 'channelId',
			},
			{
				name: 'Channel (By Unique Name)',
				value: 'channelUniqueName',
			},
			{
				name: 'Chat',
				value: 'chat',
			},
			{
				name: 'User',
				value: 'buddy',
			},
		],
	},
	{
		displayName: `Agent Choice Guidance: To use <b>Agent's Choice</b> as an AI Tool, switch <b>Agent Selected Share Target</b> to expression mode and apply the provided <code>$fromAI()</code> setup. Then configure <b>every</b> target identifier field in PATH 2 of the <a href="${FILES_SHARE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Tool Setup Guide</a> with its provided optional AI expression so those inputs appear in the tool schema. This mode gives the AI broader routing access across chats, channels, bots, and users, so enable it only when that level of access is intentional. `,
		name: 'agentChoiceGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName: 'Agent Selected Share Target',
		name: 'agentSelectedShareTarget',
		type: 'options',
		required: true,
		default: 'chat',
		description:
			"Choose which target family should be used for this tool call. In the Agent's Choice AI setup path, switch this field to expression mode and use the provided AI expression.",
		options: [
			{
				name: 'Bot',
				value: 'bot',
			},
			{
				name: 'Channel (By ID)',
				value: 'channelId',
			},
			{
				name: 'Channel (By Unique Name)',
				value: 'channelUniqueName',
			},
			{
				name: 'Chat',
				value: 'chat',
			},
			{
				name: 'User',
				value: 'buddy',
			},
		],
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName: 'Post as Bot',
		name: 'agentPostAsBot',
		type: 'boolean',
		default: false,
		description:
			'Whether to share the files into an agent-selected channel using a bot sender identity. Use Bot Unique Name to choose the bot identity.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName: 'Bot Unique Name',
		name: 'agentBotUniqueName',
		type: 'string',
		default: '',
		placeholder: 'e.g. helpdeskbot',
		description:
			'Provide the exact bot unique name when Agent Selected Share Target is Bot, or when Agent Selected Share Target is Channel (By ID)/Channel (By Unique Name) and Post as Bot is enabled. Leave blank otherwise.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName:
			'Agent Choice Channel Bot Posting Note: To post as a bot in an agent-selected channel, the bot must already be a channel participant. Use <code>ZohoCliq.Channel.GetChannelMembers</code> to verify membership and <code>ZohoCliq.Channel.AddBotToChannel</code> to add the bot if needed.',
		name: 'agentChoiceChannelPostAsBotMembershipNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
				agentPostAsBot: [true],
			},
		},
	},
	{
		displayName: 'Bot Display Name',
		name: 'agentBotDisplayName',
		type: 'string',
		default: '',
		placeholder: 'e.g. Helpdesk Bot',
		description:
			'Optional custom sender display name for agent-selected channel shares when Post as Bot is true. Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
				agentPostAsBot: [true],
			},
		},
	},
	{
		displayName: 'Bot Image URL',
		name: 'agentBotImageUrl',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/bot-avatar.png',
		description:
			'Optional HTTP or HTTPS image URL to use as the sender avatar for agent-selected channel shares when Post as Bot is true. Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
				agentPostAsBot: [true],
			},
		},
	},
	{
		displayName: 'Channel ID',
		name: 'agentChannelId',
		type: 'string',
		default: '',
		placeholder: 'e.g. P1234567890123456789',
		description:
			'Only provide the exact Zoho Cliq channel ID when Agent Selected Share Target is set to Channel (By ID). Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName: 'Channel Unique Name',
		name: 'agentChannelUniqueName',
		type: 'string',
		default: '',
		placeholder: 'e.g. engineering-announcements',
		description:
			'Only provide the exact channel unique name when Agent Selected Share Target is set to Channel (By Unique Name). Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName: 'Chat ID',
		name: 'agentChatId',
		type: 'string',
		default: '',
		placeholder: 'e.g. CT_1234567890_1234567890',
		description:
			'Only provide the exact chat ID when Agent Selected Share Target is set to Chat. Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName: 'User ID',
		name: 'agentBuddyUserId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 66578893',
		description:
			'Only provide the exact Zoho Cliq user ID when Agent Selected Share Target is set to User and the recipient should be identified by user ID. Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		displayName: 'User Email',
		name: 'agentBuddyEmail',
		type: 'string',
		default: '',
		placeholder: 'e.g. user@example.com',
		description:
			'Only provide the exact user email when Agent Selected Share Target is set to User and the recipient should be identified by email address. Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['agentChoice'],
			},
		},
	},
	{
		...channelIdOnlyRLC,
		required: false,
		displayOptions: {
			...(channelIdOnlyRLC.displayOptions ?? {}),
			show: {
				...(channelIdOnlyRLC.displayOptions?.show ?? {}),
				shareTarget: ['channelId'],
			},
		},
	},
	{
		displayName: 'Channel Unique Name',
		name: 'channelUniqueName',
		type: 'string',
		default: '',
		placeholder: 'e.g. engineering-announcements',
		description:
			'The exact channel unique name to share the files to. Use the permanent unique name, not the display label.',
		displayOptions: {
			show: {
				shareTarget: ['channelUniqueName'],
			},
		},
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		placeholder: 'e.g. CT_1234567890_1234567890',
		description: 'The exact chat ID that should receive the files',
		displayOptions: {
			show: {
				shareTarget: ['chat'],
			},
		},
	},
	{
		displayName: 'User Identifier Type',
		name: 'buddyIdentifierType',
		type: 'options',
		noDataExpression: true,
		default: 'userId',
		description:
			'Choose whether the direct user target should be identified by Zoho Cliq user ID or email address',
		options: [
			{
				name: 'User ID',
				value: 'userId',
			},
			{
				name: 'Email',
				value: 'email',
			},
		],
		displayOptions: {
			show: {
				shareTarget: ['buddy'],
			},
		},
	},
	{
		displayName: 'User ID',
		name: 'buddyUserId',
		type: 'string',
		default: '',
		placeholder: 'e.g. 66578893',
		description: 'The exact Zoho Cliq user ID that should receive the files',
		displayOptions: {
			show: {
				shareTarget: ['buddy'],
				buddyIdentifierType: ['userId'],
			},
		},
	},
	{
		displayName: 'User Email',
		name: 'buddyEmail',
		type: 'string',
		default: '',
		placeholder: 'e.g. user@example.com',
		description: 'The exact email address of the user that should receive the files',
		displayOptions: {
			show: {
				shareTarget: ['buddy'],
				buddyIdentifierType: ['email'],
			},
		},
	},
	{
		displayName: 'Post as Bot',
		name: 'postAsBot',
		type: 'boolean',
		default: false,
		description:
			'Whether to share the files into the target channel using a bot sender identity. The bot must already be a participant in that channel. Use Bot Unique Name to choose the bot identity.',
		displayOptions: {
			show: {
				shareTarget: ['channelId', 'channelUniqueName'],
			},
		},
	},
	{
		displayName: 'Bot Unique Name',
		name: 'botUniqueName',
		type: 'string',
		default: '',
		placeholder: 'e.g. helpdeskbot',
		description:
			'Provide the exact bot unique name when the target is Bot or when Post as Bot is enabled for a channel target. Leave blank when this run does not need a bot unique name.',
		displayOptions: {
			show: {
				shareTarget: ['bot', 'channelId', 'channelUniqueName'],
			},
		},
	},
	{
		displayName:
			'Channel Bot Posting Note: To post as a bot in a channel, the bot must already be a channel participant. Use <code>ZohoCliq.Channel.GetChannelMembers</code> to verify membership and <code>ZohoCliq.Channel.AddBotToChannel</code> to add the bot if needed.',
		name: 'channelPostAsBotMembershipNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				shareTarget: ['channelId', 'channelUniqueName'],
				postAsBot: [true],
			},
		},
	},
	{
		displayName: 'Bot Display Name',
		name: 'botDisplayName',
		type: 'string',
		default: '',
		placeholder: 'e.g. Helpdesk Bot',
		description:
			'Optional custom sender display name for bot-posted channel shares. Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['channelId', 'channelUniqueName'],
				postAsBot: [true],
			},
		},
	},
	{
		displayName: 'Bot Image URL',
		name: 'botImageUrl',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/bot-avatar.png',
		description:
			'Optional HTTP or HTTPS image URL to use as the sender avatar for bot-posted channel shares. Blank values are allowed and omitted.',
		displayOptions: {
			show: {
				shareTarget: ['channelId', 'channelUniqueName'],
				postAsBot: [true],
			},
		},
	},
	{
		displayName: 'File Input Mode',
		name: 'fileInputMode',
		type: 'options',
		noDataExpression: true,
		default: 'mapped',
		options: [
			{
				name: 'Mapped Entries (Recommended)',
				value: 'mapped',
			},
			{
				name: 'Using JSON',
				value: 'raw',
			},
		],
		description:
			'Choose whether to provide file/comment pairs through individual rows or a JSON array',
	},
	{
		displayName:
			'Mapped Entries Guidance: Add one row per file. Each row maps <b>Input Data Field Name</b> to an optional <b>Comment</b>. Empty rows are ignored, so expression-driven rows that resolve to empty do not fail the run. Maximum 10 rows.',
		name: 'mappedEntriesGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				fileInputMode: ['mapped'],
			},
		},
	},
	{
		displayName: 'File Entries',
		name: 'fileEntries',
		type: 'fixedCollection',
		placeholder: 'Add Another File',
		typeOptions: {
			multipleValues: true,
			sortable: true,
			multipleValueButtonText: 'Add Another File',
			maxValue: 10,
		},
		default: {
			fileEntry: [{ binaryProperty: 'data', comment: '' }],
		},
		displayOptions: {
			show: {
				fileInputMode: ['mapped'],
			},
		},
		options: [
			{
				displayName: 'File Entry',
				name: 'fileEntry',
				values: [
					{
						displayName: 'Input Data Field Name',
						name: 'binaryProperty',
						type: 'string',
						default: '',
						placeholder: 'e.g. data',
						description: 'The name of the input data field that contains this file',
					},
					{
						displayName: 'Comment',
						name: 'comment',
						type: 'string',
						default: '',
						description: 'Optional comment for this specific file',
						typeOptions: {
							rows: 2,
						},
					},
				],
			},
		],
	},
	{
		displayName:
			'Advanced JSON Guidance: Expected array shape is <code>[{"binaryProperty":"data","comment":"Optional comment"}]</code> for normal workflow binary input or <code>[{"binaryHandleId":"opaque-handle","comment":"Optional comment"}]</code> for handle-based tool chaining. Allowed keys per entry: <code>binaryProperty</code>, <code>binaryHandleId</code>, <code>comment</code>. Provide exactly one file source field per entry. Maximum 10 entries.',
		name: 'rawEntriesGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				fileInputMode: ['raw'],
			},
		},
	},
	{
		displayName: 'File Entries (JSON)',
		name: 'fileEntriesRaw',
		type: 'json',
		default: '[]',
		required: true,
		description:
			'Provide an array of file entry objects. Example: [{"binaryProperty":"data","comment":"Report PDF"}] or [{"binaryHandleId":"opaque-handle","comment":"Report PDF"}]. Each entry must include exactly one of `binaryProperty` or `binaryHandleId`. Blank optional comments are allowed. If every comment is blank they are omitted entirely, otherwise empty-string placeholders are preserved to keep file/comment index alignment',
		displayOptions: {
			show: {
				fileInputMode: ['raw'],
			},
		},
	},
	{
		displayName: 'Mark As Read',
		name: 'markAsRead',
		type: 'boolean',
		default: false,
		description:
			'Whether the shared file message should be marked as read immediately for the current user',
		displayOptions: {
			show: {
				shareTarget: ['chat', 'channelId', 'channelUniqueName', 'buddy', 'agentChoice'],
			},
		},
	},
	{
		displayName: 'Bot Subscriber User IDs',
		name: 'botSubscriberUserIds',
		type: 'fixedCollection',
		placeholder: 'Add Subscriber',
		typeOptions: {
			multipleValues: true,
			sortable: true,
			multipleValueButtonText: 'Add Subscriber',
		},
		default: {
			subscriber: [],
		},
		description:
			'Optional bot subscriber user IDs. When provided, the node sends one bot-file-share request per listed subscriber user ID.',
		options: [
			{
				displayName: 'Subscriber',
				name: 'subscriber',
				values: [
					{
						displayName: 'User ID',
						name: 'userId',
						type: 'string',
						default: '',
						placeholder: 'e.g. 66578893',
						description: 'Subscriber user ID',
					},
				],
			},
		],
		displayOptions: {
			show: {
				shareTarget: ['bot', 'agentChoice'],
			},
		},
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this often-minimal share response. Disable to return Cliq's standard response.",
	},
	{
		displayName:
			'Bot Subscriber Note: Each listed user ID must already be subscribed to the selected bot to receive shared files. Use <code>ZohoCliq.Bot.GetBotSubscribers</code> to verify subscribers before sending.',
		name: 'botSubscriberUserIdsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				shareTarget: ['bot', 'agentChoice'],
			},
		},
	},
	...shareDocsNotices,
	{
		displayName: `Zoho Cliq Files/Share Files as AI Tool Setup Guide: <a href="${FILES_SHARE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'shareFileAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['file'],
		operation: ['shareFile'],
	},
};

export const description: INodeProperties[] = properties.map((property) => ({
	...property,
	displayOptions: {
		...displayOptions,
		...property.displayOptions,
		show: {
			...displayOptions.show,
			...(property.displayOptions?.show ?? {}),
		},
	},
}));
