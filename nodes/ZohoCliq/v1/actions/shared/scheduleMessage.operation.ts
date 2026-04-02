/**
 * Schedule Message operation (SHARED)
 * Schedules a message to be sent at a specific time or based on user status
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { MESSAGE_SCHEDULE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getOperationScopePolicy } from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	validateChatId,
	validateScheduleTime,
	validateScheduleStatus,
	validateTimezone,
} from '../../helpers/utils';
import { isChatLookupNotFoundError } from '../chat/shared';
import {
	assertChatLookupPreflightScopesOrThrow,
	CHAT_NOT_FOUND_HINT,
	enrichMessageChatLookupErrorIfPossible,
	validateChatExistsIfPossible,
} from './preflight';
import { messagePayloadDescription, resolveMessagePayload } from './messagePayload';
import { applyDisplayOptions, messageChatIdDescription } from '../common.descriptions';
import { coerceApiResponseToObject } from './responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from './simplifyOutput';
import { pushMessageRecoverableError } from '../message/common';

type ScheduleFieldVisibilityMode = 'guided' | 'agent';

const scheduleFieldVisibilityModes = new Set<ScheduleFieldVisibilityMode>(['guided', 'agent']);

const payloadFieldByName = new Map(messagePayloadDescription.map((field) => [field.name, field]));

const schedulePayloadFieldOrder = [
	'messageType',
	'text',
	'showCliqMarkdownGuidance',
	'plainTextMarkdownNotice',
	'addMention',
	'mentionInsertMode',
	'mentionsGuidanceNotice',
	'mentions',
	'jsonBody',
	'cardPayloadMappingNotice',
	'postAsBot',
	'botUniqueName',
] as const;

const scheduleMessagePayloadDescription = schedulePayloadFieldOrder
	.map((name) => payloadFieldByName.get(name))
	.filter((field): field is INodeProperties => field !== undefined)
	.map((field) => {
		if (field.name === 'botUniqueName') {
			const showOptions = {
				...(field.displayOptions?.show ?? {}),
			} as Record<string, unknown>;
			delete showOptions.postAsBot;

			return {
				...field,
				required: false,
				description:
					'Provide the exact bot unique name when Post as Bot is enabled for a time-based scheduled message. Leave blank otherwise.',
				displayOptions: {
					show: {
						...showOptions,
						scheduleFieldVisibility: ['guided'],
						scheduleMode: ['time'],
					},
				},
			} satisfies INodeProperties;
		}

		if (field.name === 'text') {
			return {
				...field,
				required: false,
				description:
					'Used when Message Type resolves to Text (Cliq Markdown). Provide a non-empty string up to 4096 characters. Leave blank when Message Type resolves to Advanced (JSON).',
				displayOptions: undefined,
			} satisfies INodeProperties;
		}

		if (field.name === 'jsonBody') {
			return {
				...field,
				description:
					'Used when Message Type resolves to Advanced (JSON). Provide a raw JSON object with a non-empty top-level `text` string. Leave blank when Message Type resolves to Text (Cliq Markdown).',
				displayOptions: undefined,
			} satisfies INodeProperties;
		}

		if (field.name === 'postAsBot') {
			return {
				...field,
				displayOptions: {
					show: {
						scheduleFieldVisibility: ['guided'],
						scheduleMode: ['time'],
					},
				},
			} satisfies INodeProperties;
		}

		return field;
	});

const scheduleAgentPayloadDescription: INodeProperties[] = [
	{
		displayName: 'Post as Bot',
		name: 'agentPostAsBot',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['agent'],
			},
		},
		description:
			'Whether the scheduled message should appear from a bot sender identity when Schedule Mode resolves to Time-Based. Leave false when Schedule Mode resolves to Status-Based.',
	},
	{
		displayName: 'Bot Unique Name',
		name: 'agentBotUniqueName',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['agent'],
			},
		},
		description:
			'Used when Schedule Field Visibility is Agent Setup and Post as Bot resolves to true for a time-based scheduled message. Provide the exact bot unique name. Leave blank otherwise.',
	},
];

const properties: INodeProperties[] = [
	{
		displayName: 'Schedule Field Visibility',
		name: 'scheduleFieldVisibility',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Guided by Schedule Mode',
				value: 'guided',
				description:
					'Standard workflow setup. Show only the fields that match the selected Schedule Mode.',
			},
			{
				name: 'Agent Setup',
				value: 'agent',
				description:
					'AI tool setup. Keep both time-based and status-based schedule fields visible so expressions can populate the matching branch.',
			},
		],
		default: 'guided',
		description:
			'How schedule-mode-specific fields should be displayed in the editor. Use Agent Setup when Schedule Mode will be expression-driven by an AI tool.',
	},
	{
		displayName: 'Schedule Mode',
		name: 'scheduleMode',
		type: 'options',
		options: [
			{
				name: 'Time-Based',
				value: 'time',
				description: 'Schedule message for a specific date and time',
			},
			{
				name: 'Status-Based',
				value: 'status',
				description: 'Schedule message based on user status change',
			},
		],
		default: 'time',
		description: 'How to schedule the message',
	},
	{
		displayName: 'Schedule Time',
		name: 'scheduleTime',
		type: 'dateTime',
		default: '',
		required: true,
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['time'],
			},
		},
		description:
			'When to send the message. Use `yyyyMMddTHHmmss` (ISO 8601 basic), for example `20270109T143000`.',
	},
	{
		displayName: 'Schedule Time',
		name: 'agentScheduleTime',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['agent'],
			},
		},
		description:
			'Used when Schedule Mode resolves to Time-Based. Provide when to send the message in `yyyyMMddTHHmmss` (ISO 8601 basic), for example `20270109T143000`. Leave blank when Schedule Mode resolves to Status-Based.',
	},
	{
		displayName: 'Schedule Timezone',
		name: 'scheduleTimezone',
		type: 'string',
		default: '',
		placeholder: 'e.g. America/New_York',
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['time'],
			},
		},
		description:
			'Timezone that should govern Schedule Time. When scheduling by time, provide a canonical IANA timezone such as America/New_York or Europe/London. Avoid abbreviations like EST or PST.',
	},
	{
		displayName: 'Schedule Timezone',
		name: 'agentScheduleTimezone',
		type: 'string',
		default: '',
		placeholder: 'e.g. America/New_York',
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['agent'],
			},
		},
		description:
			'Used when Schedule Mode resolves to Time-Based. Provide the canonical IANA timezone that should govern Schedule Time, such as America/New_York or Europe/London. Leave blank when Schedule Mode resolves to Status-Based. Avoid abbreviations like EST or PST.',
	},
	{
		displayName:
			'IANA Timezones Reference: <a href="https://timeapi.io/documentation/iana-timezones" target="_blank" rel="noopener noreferrer">Open IANA timezone list</a>',
		name: 'scheduleTimezoneDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['time'],
			},
		},
	},
	{
		displayName: 'Schedule Status',
		name: 'scheduleStatus',
		type: 'options',
		options: [
			{
				name: 'Check In',
				value: 'check_in',
				description: 'Send when user checks in',
			},
			{
				name: 'User Available',
				value: 'user_available',
				description: 'Send when user becomes available',
			},
			{
				name: 'Call End',
				value: 'call_end',
				description: 'Send when call ends',
			},
			{
				name: 'Check Out',
				value: 'check_out',
				description: 'Send when user checks out',
			},
		],
		default: 'user_available',
		required: true,
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['status'],
			},
		},
		description: 'User status that triggers the message',
	},
	{
		displayName: 'Schedule Status',
		name: 'agentScheduleStatus',
		type: 'options',
		options: [
			{
				name: 'Check In',
				value: 'check_in',
				description: 'Send when user checks in',
			},
			{
				name: 'User Available',
				value: 'user_available',
				description: 'Send when user becomes available',
			},
			{
				name: 'Call End',
				value: 'call_end',
				description: 'Send when call ends',
			},
			{
				name: 'Check Out',
				value: 'check_out',
				description: 'Send when user checks out',
			},
		],
		default: 'user_available',
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['agent'],
			},
		},
		description:
			'Used when Schedule Mode resolves to Status-Based. Choose the user status that should trigger the message. Leave the default unchanged or ignore this field when Schedule Mode resolves to Time-Based.',
	},
	{
		displayName:
			'Status-Based Guidance: For status-based scheduling, Chat ID must point to a direct conversation (DM). Channel and group chat IDs are not supported.',
		name: 'scheduleStatusConversationNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['status'],
			},
		},
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. CT_1234567890_1234567890',
		description: messageChatIdDescription,
	},
	...scheduleMessagePayloadDescription,
	...scheduleAgentPayloadDescription,
	...getSimplifyParameters('scheduledMessage', 'message', 'scheduleMessage'),
	{
		displayName:
			'Schedule Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#send-a-scheduled-message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.messages.CREATE</code>. CHAT LOOKUP PREFLIGHT ALSO REQUIRES: <code>ZohoCliq.Chats.READ</code>',
		name: 'scheduleMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Message/Schedule Message as AI Tool Setup Guide: <a href="${MESSAGE_SCHEDULE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'scheduleMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['message'],
		operation: ['scheduleMessage'],
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

function validateScheduleFieldVisibilityMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): ScheduleFieldVisibilityMode {
	const sanitized = getOptionalTrimmedString(value) ?? 'guided';
	if (!scheduleFieldVisibilityModes.has(sanitized as ScheduleFieldVisibilityMode)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid schedule field visibility mode: "${sanitized}". Must be "guided" or "agent".`,
			{ itemIndex },
		);
	}

	return sanitized as ScheduleFieldVisibilityMode;
}

function getScheduleFieldNames(scheduleFieldVisibility: ScheduleFieldVisibilityMode) {
	if (scheduleFieldVisibility === 'agent') {
		return {
			scheduleTimeFieldName: 'agentScheduleTime',
			scheduleTimezoneFieldName: 'agentScheduleTimezone',
			scheduleStatusFieldName: 'agentScheduleStatus',
			postAsBotFieldName: 'agentPostAsBot',
			botUniqueNameFieldName: 'agentBotUniqueName',
		};
	}

	return {
		scheduleTimeFieldName: 'scheduleTime',
		scheduleTimezoneFieldName: 'scheduleTimezone',
		scheduleStatusFieldName: 'scheduleStatus',
		postAsBotFieldName: 'postAsBot',
		botUniqueNameFieldName: 'botUniqueName',
	};
}

function resolveScheduleBotSettings(
	context: IExecuteFunctions,
	itemIndex: number,
	fieldNames: ReturnType<typeof getScheduleFieldNames>,
	postAsBotRaw: unknown,
): {
	postAsBot: boolean;
	botQuery?: Record<string, string>;
} {
	const postAsBot = postAsBotRaw ?? false;
	if (typeof postAsBot !== 'boolean') {
		throw new NodeOperationError(context.getNode(), 'postAsBot must be a boolean', {
			itemIndex,
		});
	}

	if (!postAsBot) {
		return { postAsBot: false };
	}

	const botUniqueNameRaw = context.getNodeParameter(
		fieldNames.botUniqueNameFieldName,
		itemIndex,
		'',
	) as unknown;
	if (typeof botUniqueNameRaw !== 'string' || !botUniqueNameRaw.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Unique Name is required when Post as Bot is enabled for a time-based scheduled message',
			{ itemIndex },
		);
	}

	const botUniqueName = botUniqueNameRaw.trim();
	if (!/^[a-zA-Z0-9]+$/.test(botUniqueName)) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Unique Name must contain only letters and numbers (no spaces or special characters) when Post as Bot is enabled for a time-based scheduled message',
			{ itemIndex },
		);
	}
	if (botUniqueName.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Unique Name is too long. Maximum length is 100 characters when Post as Bot is enabled for a time-based scheduled message',
			{ itemIndex },
		);
	}

	return {
		postAsBot: true,
		botQuery: {
			bot_unique_name: botUniqueName,
		},
	};
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const scopePolicy = getOperationScopePolicy('shared', 'scheduleMessage');
	if (!scopePolicy || scopePolicy.requiredScopes.length !== 1) {
		throw new NodeOperationError(
			this.getNode(),
			'Scope registry misconfiguration for shared.scheduleMessage.',
		);
	}

	const requiredScope = scopePolicy.requiredScopes[0];
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let chatId: string | undefined;
		let sanitizedChatId: string | undefined;
		let scheduleMode: 'time' | 'status' | undefined;
		let scheduleFieldVisibility: ScheduleFieldVisibilityMode | undefined;
		let messageType: 'text' | 'rich' | 'json' | undefined;
		let scheduleTimezone: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, [requiredScope], i, {
				disallowedScopes: [...scopePolicy.disallowedScopes],
				missingScopeMessage:
					'Schedule Message requires the OAuth scope "ZohoCliq.messages.CREATE" (lowercase "messages"). Reconnect credentials with this scope.',
				disallowedScopeMessage:
					'Schedule Message does not support "ZohoCliq.messages.ALL". Use the explicit scope "ZohoCliq.messages.CREATE".',
			});

			chatId = this.getNodeParameter('chatId', i) as string;
			scheduleFieldVisibility = validateScheduleFieldVisibilityMode(
				this,
				this.getNodeParameter('scheduleFieldVisibility', i, 'guided'),
				i,
			);
			const resource = this.getNodeParameter('resource', i, '') as string;
			const scheduleFieldNames = getScheduleFieldNames(scheduleFieldVisibility);
			scheduleMode =
				resource === 'thread'
					? 'time'
					: (this.getNodeParameter('scheduleMode', i, 'time') as 'time' | 'status');
			scheduleTimezone = this.getNodeParameter(
				scheduleFieldNames.scheduleTimezoneFieldName,
				i,
				'',
			) as string;
			messageType = this.getNodeParameter('messageType', i) as 'text' | 'rich' | 'json';

			// Status-based scheduling supports only direct-message chat IDs.
			sanitizedChatId = validateChatId(this, chatId, i, {
				mode: scheduleMode === 'status' ? 'directMessage' : 'chatConversation',
			});
			assertChatLookupPreflightScopesOrThrow(this, grantedScopes, i, {
				resource: 'shared',
				operation: 'scheduleMessage',
				missingScopeMessage:
					'Schedule Message also requires the ZohoCliq.Chats.READ scope so the chat ID can be checked before scheduling delivery.',
				description:
					'Reconnect the Zoho Cliq credentials with the ZohoCliq.Chats.READ scope, then try again.',
			});
			await validateChatExistsIfPossible(this, sanitizedChatId, i, grantedScopes);

			const body: IDataObject = resolveMessagePayload(this, i, {
				textMaxLength: 4096,
				requireMessageContent: true,
				includeBotIdentity: false,
			});
			const postAsBotRaw = this.getNodeParameter(scheduleFieldNames.postAsBotFieldName, i, false);
			let botSettings: ReturnType<typeof resolveScheduleBotSettings> = { postAsBot: false };

			// Handle schedule mode
			if (scheduleMode === 'time') {
				botSettings = resolveScheduleBotSettings(this, i, scheduleFieldNames, postAsBotRaw);
				const scheduleTime = this.getNodeParameter(
					scheduleFieldNames.scheduleTimeFieldName,
					i,
				) as string;
				const parsedScheduleTime = parseScheduleTime(this, scheduleTime, i);
				validateScheduleTime(this, parsedScheduleTime.timestamp, i);
				body.schedule_time = parsedScheduleTime.isoBasic;

				// Optional timezone
				if (scheduleTimezone && scheduleTimezone.trim()) {
					const sanitizedTimezone = validateTimezone(this, scheduleTimezone, i);
					body.schedule_timezone = sanitizedTimezone;
				}
			} else if (scheduleMode === 'status') {
				if (postAsBotRaw === true) {
					throw new NodeOperationError(
						this.getNode(),
						'Post as Bot is only supported for time-based scheduled messages.',
						{ itemIndex: i },
					);
				}
				const scheduleStatus = this.getNodeParameter(
					scheduleFieldNames.scheduleStatusFieldName,
					i,
				) as string;
				const sanitizedScheduleStatus = validateScheduleStatus(this, scheduleStatus, i);
				delete body.schedule_time;
				delete body.schedule_timezone;
				body.schedule_status = sanitizedScheduleStatus;
			} else {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid schedule mode: "${scheduleMode}". Must be "time" or "status".`,
					{ itemIndex: i },
				);
			}

			const endpoint = `/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/scheduledmessages`;

			const botQuery = botSettings.botQuery;
			const response = botQuery
				? await zohoCliqApiRequest.call(this, 'POST', endpoint, body, botQuery)
				: await zohoCliqApiRequest.call(this, 'POST', endpoint, body);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('scheduledMessage');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});

			returnData.push(...executionData);
		} catch (error) {
			const chatIdForErrorContext =
				sanitizedChatId ?? (typeof chatId === 'string' ? chatId.trim() : undefined);
			const errorForOutput = await enrichMessageChatLookupErrorIfPossible(
				this,
				error,
				i,
				grantedScopes,
				sanitizedChatId,
			);

			if (
				pushMessageRecoverableError(this, returnData, i, 'scheduleMessage', errorForOutput, {
					contextFields: {
						...(chatIdForErrorContext ? { chat_id: chatIdForErrorContext } : {}),
						...(scheduleMode ? { schedule_mode: scheduleMode } : {}),
						...(scheduleFieldVisibility
							? { schedule_field_visibility: scheduleFieldVisibility }
							: {}),
						...(messageType ? { message_type: messageType } : {}),
						...(scheduleTimezone && scheduleTimezone.trim().length > 0
							? { schedule_timezone: scheduleTimezone.trim() }
							: {}),
					},
					messageMappings: [
						{
							match: (_normalizedMessage, _message, error) => isChatLookupNotFoundError(error),
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
							hint: 'Use Advanced (JSON) only with a JSON object that includes a non-empty top-level `text` string. Use Text (Cliq Markdown) for simple scheduled messages.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('bot unique name is required') ||
								normalizedMessage.includes(
									'bot unique name must contain only letters and numbers',
								) ||
								normalizedMessage.includes('bot unique name is too long') ||
								normalizedMessage.includes('post as bot is only supported'),
							reason: 'INVALID_BOT_IDENTIFIER',
							hint: 'Use Post as Bot only for time-based scheduled messages, and provide the exact bot unique name with letters and numbers only.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(
									'must start with a number because status-based scheduling requires a direct-message chat id',
								),
							reason: 'INVALID_CHAT_ID_FOR_STATUS_SCHEDULE',
							hint: 'Status-based scheduling requires a direct-message Chat ID, which starts with a number. Channel and group chat IDs are not supported for status-based scheduling.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('must start with a number or "ct_"'),
							reason: 'INVALID_CHAT_ID',
							hint: "Chat ID must start with a number or 'CT_'. It appears a Channel ID or other non-chat identifier was provided. Use Get a Channel to obtain the channel's Chat ID, or verify the correct Chat ID for this conversation.",
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_CHAT_ID',
							hint: 'Use the Zoho Cliq chat ID for the conversation where the scheduled message should be delivered.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('schedule time must be') ||
								normalizedMessage.includes('schedule time is required'),
							reason: 'INVALID_SCHEDULE_TIME',
							hint: 'Provide Schedule Time as `yyyyMMddTHHmmss`, for example `20270109T143000`.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid schedule mode') ||
								normalizedMessage.includes('invalid schedule status') ||
								normalizedMessage.includes('invalid timezone'),
							reason: 'INVALID_SCHEDULE_CONFIGURATION',
							hint: 'Verify Schedule Mode, Schedule Status, and Schedule Timezone values before retrying.',
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

function parseScheduleTime(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): { isoBasic: string; timestamp: number } {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return {
			isoBasic: formatTimestampToIsoBasic(value),
			timestamp: value,
		};
	}

	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			'Schedule Time must be a valid date/time value, Unix timestamp (milliseconds), or yyyyMMddTHHmmss string.',
			{ itemIndex },
		);
	}

	const trimmed = value.trim();
	if (!trimmed) {
		throw new NodeOperationError(context.getNode(), 'Schedule Time is required.', { itemIndex });
	}

	if (/^-?\d+$/.test(trimmed)) {
		const asNumber = parseInt(trimmed, 10);
		if (Number.isFinite(asNumber)) {
			return {
				isoBasic: formatTimestampToIsoBasic(asNumber),
				timestamp: asNumber,
			};
		}
	}

	const isoBasicMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
	if (isoBasicMatch) {
		const [, year, month, day, hour, minute, second] = isoBasicMatch;
		const timestamp = new Date(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second),
		).getTime();

		return {
			isoBasic: trimmed,
			timestamp,
		};
	}

	const isoExtendedMatch = trimmed.match(
		/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?$/,
	);
	if (isoExtendedMatch) {
		const [, year, month, day, hour, minute, second = '00', timezoneOffset] = isoExtendedMatch;
		const timestamp = timezoneOffset
			? Date.parse(trimmed)
			: new Date(
					Number(year),
					Number(month) - 1,
					Number(day),
					Number(hour),
					Number(minute),
					Number(second),
				).getTime();

		if (!Number.isFinite(timestamp)) {
			throw new NodeOperationError(
				context.getNode(),
				'Schedule Time must be a valid date/time value or yyyyMMddTHHmmss string.',
				{
					itemIndex,
				},
			);
		}

		return {
			isoBasic: `${year}${month}${day}T${hour}${minute}${second}`,
			timestamp,
		};
	}

	const timestamp = Date.parse(trimmed);
	if (!Number.isFinite(timestamp)) {
		throw new NodeOperationError(
			context.getNode(),
			'Schedule Time must be a valid date/time value or yyyyMMddTHHmmss string.',
			{
				itemIndex,
			},
		);
	}

	return {
		isoBasic: formatTimestampToIsoBasic(timestamp),
		timestamp,
	};
}

function formatTimestampToIsoBasic(timestamp: number): string {
	const date = new Date(timestamp);
	const year = date.getUTCFullYear();
	const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
	const day = `${date.getUTCDate()}`.padStart(2, '0');
	const hour = `${date.getUTCHours()}`.padStart(2, '0');
	const minute = `${date.getUTCMinutes()}`.padStart(2, '0');
	const second = `${date.getUTCSeconds()}`.padStart(2, '0');

	return `${year}${month}${day}T${hour}${minute}${second}`;
}
