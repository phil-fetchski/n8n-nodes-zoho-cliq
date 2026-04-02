/**
 * Create Reminder operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { REMINDERS_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateUserIdArray } from '../../helpers/utils';
import { normalizeZohoMessageIdOutput } from '../message/common';
import {
	runChatLookupPreflightGate,
	runMessageLookupPreflightGate,
	runUserIdentifiersPreflightGate,
	userListLookupScopes,
} from '../shared/preflight';
import { zohoCliqApiRequest } from '../../transport';
import {
	omitBlankReminderTime,
	parseReminderDateTimeOrUnixMs,
	parseReminderPayloadInput,
	pushRemindersRecoverableError,
	stringifyReminderTimeForApi,
	validateReminderChatIds,
	validateReminderPayload,
	validateReminderCreateType,
	validateReminderContent,
	validateReminderEntityId,
	validateReminderInputMode,
	validateReminderMessageId,
	validateReminderUserIds,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'create');
const createReminderInputModes = ['structured', 'agentTool', 'raw'] as const;
type CreateReminderInputMode = (typeof createReminderInputModes)[number];
type CreateReminderVariant = 'self' | 'users' | 'chat' | 'message';
const CHAT_ID_DESCRIPTION =
	'Single chat ID string. Required when Create Type is chat or message. Use chat IDs only, not channel IDs. For chat mode, this is the target chat for the reminder. For message mode, this is the chat that contains the source message. Example shapes: CT_2230748078536646675_631836344 or 1277744356562927809.';

const structuredCreateFieldNames = {
	createType: 'createType',
	content: 'content',
	time: 'time',
	userIds: 'userIds',
	chatId: 'chatId',
	messageId: 'messageId',
} as const;

const agentToolCreateFieldNames = {
	createType: 'agentToolCreateType',
	content: 'agentToolContent',
	time: 'agentToolTime',
	userIds: 'agentToolUserIds',
	chatId: 'agentToolChatId',
	messageId: 'agentToolMessageId',
} as const;
const REMINDER_USER_IDS_NOT_FOUND_HINT =
	'Use List_users_in_Zoho_Cliq to verify the exact user IDs before creating the reminder.';
const REMINDER_USER_IDS_NOT_FOUND_MESSAGE = 'One or more reminder user IDs were not found.';

function normalizeCreateReminderResponseMessageIds(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeCreateReminderResponseMessageIds(entry));
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	const normalizedValue = { ...(value as IDataObject) };
	const rawMessage = normalizedValue.message;

	if (rawMessage && typeof rawMessage === 'object' && !Array.isArray(rawMessage)) {
		const normalizedMessage = { ...(rawMessage as IDataObject) };

		if (typeof normalizedMessage.msguid === 'string') {
			normalizedMessage.msguid = normalizeZohoMessageIdOutput(normalizedMessage.msguid);
		}

		if (typeof normalizedMessage.lmsguid === 'string') {
			normalizedMessage.lmsguid = normalizeZohoMessageIdOutput(normalizedMessage.lmsguid);
		}

		normalizedValue.message = normalizedMessage;
	}

	return normalizedValue;
}

const properties: INodeProperties[] = [
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Agent/Tool Setup Fields', value: 'agentTool' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Choose whether to build the payload with individual fields or provide JSON directly',
	},
	{
		displayName: 'Create Type',
		name: 'createType',
		type: 'options',
		options: [
			{ name: 'Self Reminder', value: 'self' },
			{ name: 'Assign to User(s)', value: 'users' },
			{ name: 'Assign to Chat', value: 'chat' },
			{ name: 'Set Message in Chat as Reminder', value: 'message' },
		],
		default: 'self',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Which reminder variant to create. Expressions are allowed. Use one of: self, users, chat, message.',
	},
	{
		displayName: 'Create Type',
		name: 'agentToolCreateType',
		type: 'options',
		options: [
			{ name: 'Self Reminder', value: 'self' },
			{ name: 'Assign to User(s)', value: 'users' },
			{ name: 'Assign to Chat', value: 'chat' },
			{ name: 'Set Message in Chat as Reminder', value: 'message' },
		],
		default: 'self',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
		description:
			'Which reminder variant to create. Use Create Type to decide which of the always-visible ID fields below are required.',
	},
	{
		displayName: 'Content',
		name: 'content',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'The reminder content (max 512 characters)',
	},
	{
		displayName: 'Content',
		name: 'agentToolContent',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
		description:
			'Reminder text content. Leave blank only when Create Type is message and the source message should provide the reminder content.',
	},
	{
		displayName: 'Time',
		name: 'time',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Reminder trigger time. Required when Create Type is users, chat, or message. Optional for self reminders. Leave blank only for self reminders to omit it from the create request. Use the picker normally, or use an expression that resolves to an ISO 8601 datetime string.',
	},
	{
		displayName: 'Time',
		name: 'agentToolTime',
		type: 'dateTime',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
		description:
			'Reminder trigger time. Required when Create Type is users, chat, or message. Optional for self reminders. Leave blank only for self reminders to omit it from the create request. Expressions should resolve to an ISO 8601 datetime string.',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				createType: ['users', 'message'],
			},
		},
		description: 'Comma-separated user IDs (maximum 4)',
		placeholder: 'e.g. 7234192,2498713',
	},
	{
		displayName: 'User IDs',
		name: 'agentToolUserIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
		description:
			'Optional comma-separated user IDs. Required when Create Type is users. Optional for message. Leave blank for self or chat. Maximum 4.',
		placeholder: 'e.g. 7234192,2498713',
	},
	{
		displayName: 'Chat ID',
		name: 'chatId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
				createType: ['chat', 'message'],
			},
		},
		description: CHAT_ID_DESCRIPTION,
	},
	{
		displayName: 'Chat ID',
		name: 'agentToolChatId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
		description: CHAT_ID_DESCRIPTION,
	},
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
				createType: ['message'],
			},
		},
		description:
			'Message ID to set as reminder. Accepts long numeric ID or timestamp_uniqueId format (for example 1772395354414_196142356543).',
	},
	{
		displayName: 'Message ID',
		name: 'agentToolMessageId',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
		description:
			'Optional message ID to turn into a reminder. Required when Create Type is message. Accepts long numeric ID or timestamp_uniqueId format.',
	},
	{
		displayName: 'Reminder Definition (JSON)',
		name: 'reminderDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload to create a reminder. Pass a JSON object or stringified JSON object. Allowed fields: content, time, user_ids, chat_ids, chat_id, message_id. Use ISO 8601 datetime text for the time field.',
	},
	{
		displayName: `Create Self Reminder Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_self" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createSelfReminderDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				createType: ['self'],
			},
		},
	},
	{
		displayName: `Create Reminder for Users Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_userids" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createUserReminderDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				createType: ['users'],
			},
		},
	},
	{
		displayName: `Create Reminder for Chat Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_chatids" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createChatReminderDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				createType: ['chat'],
			},
		},
	},
	{
		displayName: `Set Message as Reminder Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_msgid" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createMessageReminderDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
				createType: ['message'],
			},
		},
	},
	{
		displayName: `Create Reminder Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_self" target="_blank" rel="noopener noreferrer">Self</a> | <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_userids" target="_blank" rel="noopener noreferrer">Users</a> | <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_chatids" target="_blank" rel="noopener noreferrer">Chat</a> | <a href="https://www.zoho.com/cliq/help/restapi/v2/#create_reminder_msgid" target="_blank" rel="noopener noreferrer">Message</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createReminderAllVariantsDocsNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool', 'raw'],
			},
		},
	},
	{
		displayName: `Zoho Cliq Reminders/Create Reminder as an AI Tool Setup Guide: <a href="${REMINDERS_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createReminderAiToolGuideNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['agentTool'],
			},
		},
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const hasNonBlankValue = (value: unknown): boolean => {
		if (value === undefined || value === null) {
			return false;
		}

		if (typeof value === 'string') {
			return value.trim().length > 0;
		}

		if (Array.isArray(value)) {
			return value.some((entry) => String(entry ?? '').trim().length > 0);
		}

		return true;
	};
	const parseAndValidateUserIds = (
		itemIndex: number,
		parameterName: string,
		fieldLabel = 'User IDs',
	): string[] => {
		const rawUserIds = this.getNodeParameter(parameterName, itemIndex) as string | string[];
		const parsedUserIds = validateUserIdArray(this, rawUserIds, itemIndex);
		return validateReminderUserIds(this, parsedUserIds, itemIndex, fieldLabel, {
			max: 4,
		});
	};
	const getRequiredCreateFieldValue = (
		itemIndex: number,
		parameterName: string,
		fieldLabel: string,
		createType: CreateReminderVariant,
	): unknown => {
		const rawValue = this.getNodeParameter(parameterName, itemIndex, '') as unknown;
		if (!hasNonBlankValue(rawValue)) {
			const verb = fieldLabel === 'User IDs' ? 'are' : 'is';
			throw new NodeOperationError(
				this.getNode(),
				`${fieldLabel} ${verb} required when create_type is ${createType}`,
				{ itemIndex },
			);
		}

		return rawValue;
	};
	const inferCreateVariantFromPayload = (payload: IDataObject): CreateReminderVariant => {
		if (payload.message_id !== undefined || payload.chat_id !== undefined) {
			return 'message';
		}

		if (payload.chat_ids !== undefined) {
			return 'chat';
		}

		if (payload.user_ids !== undefined) {
			return 'users';
		}

		return 'self';
	};
	const validateCreatePayloadVariant = (
		payload: IDataObject,
		itemIndex: number,
		variant: CreateReminderVariant,
	): void => {
		if (variant === 'self') {
			if (payload.content === undefined) {
				throw new NodeOperationError(
					this.getNode(),
					'Content is required when create_type is self',
					{
						itemIndex,
					},
				);
			}

			return;
		}

		if (variant === 'users') {
			if (payload.content === undefined) {
				throw new NodeOperationError(
					this.getNode(),
					'Content is required when create_type is users',
					{ itemIndex },
				);
			}

			if (payload.time === undefined) {
				throw new NodeOperationError(this.getNode(), 'Time is required when create_type is users', {
					itemIndex,
				});
			}

			return;
		}

		if (variant === 'chat') {
			if (payload.content === undefined) {
				throw new NodeOperationError(
					this.getNode(),
					'Content is required when create_type is chat',
					{ itemIndex },
				);
			}

			if (payload.time === undefined) {
				throw new NodeOperationError(this.getNode(), 'Time is required when create_type is chat', {
					itemIndex,
				});
			}

			return;
		}

		if (payload.chat_id === undefined) {
			throw new NodeOperationError(
				this.getNode(),
				'Chat ID is required when create_type is message',
				{
					itemIndex,
				},
			);
		}

		if (payload.message_id === undefined) {
			throw new NodeOperationError(
				this.getNode(),
				'Message ID is required when create_type is message',
				{ itemIndex },
			);
		}

		if (payload.time === undefined) {
			throw new NodeOperationError(this.getNode(), 'Time is required when create_type is message', {
				itemIndex,
			});
		}
	};
	const runCreateTargetPreflight = async (
		itemIndex: number,
		createVariant: CreateReminderVariant,
		body: IDataObject,
	): Promise<void> => {
		const runReminderUsersPreflight = async (userIds: string[]): Promise<void> => {
			await runUserIdentifiersPreflightGate(this, itemIndex, grantedScopes, {
				identifiers: userIds,
				subjectLabel: 'Reminder User IDs',
				acceptedScopes: userListLookupScopes,
				missing: {
					code: 'USER_IDS_NOT_FOUND',
					message: ({ missingIdentifiers }) =>
						`${REMINDER_USER_IDS_NOT_FOUND_MESSAGE} Missing user IDs: ${JSON.stringify(
							missingIdentifiers,
						)}.`,
					hint: REMINDER_USER_IDS_NOT_FOUND_HINT,
				},
			});
		};

		// The payload has already passed validateReminderPayload() and
		// validateCreatePayloadVariant(), so variant-specific target fields are present here.
		if (createVariant === 'users') {
			await runReminderUsersPreflight(body.user_ids as string[]);
			return;
		}

		if (createVariant === 'chat') {
			const chatIds = body.chat_ids as string[];
			await runChatLookupPreflightGate(this, itemIndex, grantedScopes, chatIds[0], {
				fieldLabel: 'Chat ID',
			});
			return;
		}

		if (createVariant !== 'message') {
			return;
		}

		const chatId = body.chat_id as string;
		const messageId = String(body.message_id);
		const userIds = Array.isArray(body.user_ids) ? (body.user_ids as string[]) : undefined;

		if (userIds?.length) {
			await runReminderUsersPreflight(userIds);
		}

		await runChatLookupPreflightGate(this, itemIndex, grantedScopes, chatId, {
			fieldLabel: 'Chat ID',
		});
		await runMessageLookupPreflightGate(this, itemIndex, grantedScopes, chatId, messageId);
	};

	for (let i = 0; i < items.length; i++) {
		let inputModeForContext: CreateReminderInputMode | undefined;
		let createVariantForContext: CreateReminderVariant | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const inputMode = validateReminderInputMode(
				this,
				this.getNodeParameter('inputMode', i),
				i,
				'Input Mode',
				createReminderInputModes,
			) as CreateReminderInputMode;
			inputModeForContext = inputMode;
			let body: IDataObject;
			let createVariant: CreateReminderVariant | undefined;

			if (inputMode === 'structured' || inputMode === 'agentTool') {
				const fieldNames =
					inputMode === 'agentTool' ? agentToolCreateFieldNames : structuredCreateFieldNames;
				const createType = validateReminderCreateType(
					this,
					this.getNodeParameter(fieldNames.createType, i, 'self'),
					i,
				);
				createVariant = createType as CreateReminderVariant;
				createVariantForContext = createVariant;
				body = {};
				const rawContent = this.getNodeParameter(fieldNames.content, i, '') as unknown;
				if (createType !== 'message' && !hasNonBlankValue(rawContent)) {
					throw new NodeOperationError(
						this.getNode(),
						`Content is required when create_type is ${createType}`,
						{ itemIndex: i },
					);
				}

				if (hasNonBlankValue(rawContent)) {
					body.content = validateReminderContent(this, rawContent, i);
				}

				const rawTime = this.getNodeParameter(fieldNames.time, i, '') as unknown;
				if (rawTime != null && !(typeof rawTime === 'string' && rawTime.trim() === '')) {
					body.time = parseReminderDateTimeOrUnixMs(this, rawTime, i, 'Time');
				} else if (createType !== 'self') {
					throw new NodeOperationError(
						this.getNode(),
						`Time is required when create_type is ${createType}`,
						{ itemIndex: i },
					);
				}

				if (createType === 'users') {
					getRequiredCreateFieldValue(i, fieldNames.userIds, 'User IDs', 'users');
					body.user_ids = parseAndValidateUserIds(i, fieldNames.userIds);
				}

				if (createType === 'chat') {
					const rawChatId = getRequiredCreateFieldValue(i, fieldNames.chatId, 'Chat ID', 'chat');
					body.chat_ids = validateReminderChatIds(this, [rawChatId], i, 'chat_ids', { max: 1 });
				}

				if (createType === 'message') {
					const rawUserIds = this.getNodeParameter(fieldNames.userIds, i, '') as unknown;
					if (hasNonBlankValue(rawUserIds)) {
						body.user_ids = parseAndValidateUserIds(i, fieldNames.userIds);
					}

					body.chat_id = validateReminderEntityId(
						this,
						getRequiredCreateFieldValue(i, fieldNames.chatId, 'Chat ID', 'message'),
						i,
						'Chat ID',
					);
					body.message_id = validateReminderMessageId(
						this,
						getRequiredCreateFieldValue(i, fieldNames.messageId, 'Message ID', 'message'),
						i,
					);
				}
			} else {
				const reminderDefinition = this.getNodeParameter('reminderDefinition', i, {}) as unknown;
				body = parseReminderPayloadInput(this, reminderDefinition, i, 'Reminder Definition');
			}

			omitBlankReminderTime(body);
			body = validateReminderPayload(this, body, i, 'Reminder Definition', {
				allowedFields: ['content', 'time', 'user_ids', 'chat_ids', 'chat_id', 'message_id'],
			});
			createVariant ??= inferCreateVariantFromPayload(body);
			createVariantForContext ??= createVariant;
			validateCreatePayloadVariant(body, i, createVariant);
			await runCreateTargetPreflight(i, createVariant, body);
			stringifyReminderTimeForApi(body);

			const response = (await zohoCliqApiRequest.call(this, 'POST', '/api/v2/reminders', body)) as
				| IDataObject
				| IDataObject[]
				| undefined
				| null;
			const safeResponse = normalizeCreateReminderResponseMessageIds(response ?? {}) as IDataObject;

			const executionData = this.helpers.constructExecutionMetaData([{ json: safeResponse }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'create', error, {
					contextFields: {
						...(inputModeForContext ? { input_mode: inputModeForContext } : {}),
						...(createVariantForContext ? { create_type: createVariantForContext } : {}),
					},
					fallbackMessage: 'Unable to create reminder.',
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('create type'),
							reason: 'INVALID_CREATE_TYPE',
							hint: 'Use one of: self, users, chat, message.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use Using Fields Below, Agent/Tool Setup Fields, or Using JSON.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('reminder definition cannot be empty') ||
								normalizedMessage.includes('must be a valid json object') ||
								normalizedMessage.includes('must be a json object') ||
								normalizedMessage.includes('contains unsupported field') ||
								normalizedMessage.includes('unsafe key'),
							reason: 'INVALID_REMINDER_DEFINITION',
							hint: 'Provide a safe JSON object using only supported keys: content, time, user_ids, chat_ids, chat_id, message_id.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('content is required when create_type is'),
							reason: 'MISSING_CONTENT',
							hint: 'Provide reminder content for self, users, and chat reminders. Message reminders may omit content.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('time is required when create_type is'),
							reason: 'MISSING_TIME',
							hint: 'Provide `time` for users, chat, and message reminders as ISO 8601 datetime text or Unix milliseconds.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('time must be') ||
								normalizedMessage.includes('time cannot be empty'),
							reason: 'INVALID_TIME',
							hint: 'Use a valid ISO 8601 datetime, including timezone offsets if needed, or a Unix timestamp in milliseconds.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user ids are required when create_type is users'),
							reason: 'MISSING_USER_IDS',
							hint: 'Provide one to four exact Zoho Cliq user IDs when create_type is users.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid user id format') ||
								normalizedMessage.includes('user ids must contain at least') ||
								normalizedMessage.includes('user ids can contain at most') ||
								normalizedMessage.includes('user_ids must contain at least') ||
								normalizedMessage.includes('user_ids can contain at most'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide one to four exact Zoho Cliq user IDs. Use a comma-separated string in field mode or a string array in raw JSON mode.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required when create_type is'),
							reason: 'MISSING_CHAT_ID',
							hint: 'Provide exactly one Zoho Cliq chat ID. Use `chat_id` in field mode, or `chat_ids` as a single-item array in raw JSON for chat reminders.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat_ids must contain at least') ||
								normalizedMessage.includes('chat_ids can contain at most'),
							reason: 'INVALID_CHAT_ID',
							hint: 'Use exactly one valid Zoho Cliq chat ID. Do not pass a channel ID.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('message id is required when create_type is message'),
							reason: 'MISSING_MESSAGE_ID',
							hint: 'Provide the source `message_id` when create_type is message.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('message id is required') ||
								normalizedMessage.includes('invalid message id format'),
							reason: 'INVALID_MESSAGE_ID',
							hint: 'Use the exact Zoho Cliq message ID in long numeric form or timestamp_uniqueId form.',
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
