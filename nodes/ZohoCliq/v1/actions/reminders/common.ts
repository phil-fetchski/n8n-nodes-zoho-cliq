import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { extractErrorText, parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const reminderIdPattern = /^[a-zA-Z0-9_:.-]+$/;
const userIdPattern = /^[a-zA-Z0-9@._-]+$/;
const reminderEntityIdPattern = /^[a-zA-Z0-9_:.-]+$/;
const reminderMessageIdPattern = /^\d+_\d+$/;
const reminderMessageLongPattern = /^\d+$/;
const strictIsoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const strictIsoDateTimePattern =
	/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

const reminderCategories = ['mine', 'mine-completed', 'others', 'others-completed'] as const;
const completedReminderCategories = ['mine-completed', 'others-completed'] as const;
const reminderInputModes = ['structured', 'raw'] as const;
const reminderCreateTypes = ['self', 'users', 'chat', 'message'] as const;
const reminderTimeInputModes = ['dateTime', 'unix'] as const;

export interface IRemindersRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export const reminderIdLocator: INodeProperties = {
	displayName: 'Reminder ID',
	name: 'reminderId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'Choose a reminder from the list, or specify a Reminder ID using an <a href="https://docs.n8n.io/code/expressions/" target="_blank">expression</a>',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchReminders',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 11360000000204033',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9_:.-]+$',
						errorMessage:
							'Reminder ID can only contain letters, numbers, underscores, hyphens, colons, and periods',
					},
				},
			],
		},
	],
};

export function validateReminderId(
	context: IExecuteFunctions,
	reminderId: string,
	itemIndex: number,
): string {
	if (!reminderId || !reminderId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Reminder ID is required', { itemIndex });
	}

	const sanitized = reminderId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Reminder ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	if (!reminderIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Reminder ID format', { itemIndex });
	}

	return sanitized;
}

export function validateReminderInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
	allowedModes: readonly string[] = reminderInputModes,
): string {
	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be one of: ${allowedModes.join(', ')}`,
			{ itemIndex },
		);
	}

	const sanitized = value.trim();
	if (!allowedModes.includes(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be one of: ${allowedModes.join(', ')}`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateReminderCreateType(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): (typeof reminderCreateTypes)[number] {
	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`Create Type must be one of: ${reminderCreateTypes.join(', ')}`,
			{ itemIndex },
		);
	}

	const sanitized = value.trim() as (typeof reminderCreateTypes)[number];
	if (!reminderCreateTypes.includes(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`Create Type must be one of: ${reminderCreateTypes.join(', ')}`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateReminderTimeInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Time Input Mode',
): (typeof reminderTimeInputModes)[number] {
	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be one of: ${reminderTimeInputModes.join(', ')}`,
			{ itemIndex },
		);
	}

	const sanitized = value.trim() as (typeof reminderTimeInputModes)[number];
	if (!reminderTimeInputModes.includes(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be one of: ${reminderTimeInputModes.join(', ')}`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function ensureSafeObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (value === null || value === undefined) {
		return;
	}

	if (typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	for (const key of Object.keys(value as IDataObject)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{ itemIndex },
			);
		}

		const child = (value as IDataObject)[key];
		if (child && typeof child === 'object') {
			if (Array.isArray(child)) {
				for (let idx = 0; idx < child.length; idx++) {
					const arrayValue = child[idx];
					if (arrayValue && typeof arrayValue === 'object') {
						ensureSafeObject(context, arrayValue, itemIndex, `${path}.${key}[${idx}]`);
					}
				}
			} else {
				ensureSafeObject(context, child, itemIndex, `${path}.${key}`);
			}
		}
	}
}

export function parseReminderPayloadInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (value === null || value === undefined) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, { itemIndex });
	}

	if (typeof value === 'string') {
		const rawValue = value.trim();
		if (!rawValue) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, { itemIndex });
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawValue);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a valid JSON object when provided as text`,
				{ itemIndex },
			);
		}

		ensureSafeObject(context, parsed, itemIndex, path);
		return parsed as IDataObject;
	}

	ensureSafeObject(context, value, itemIndex, path);
	return value as IDataObject;
}

function validateDateOnly(
	context: IExecuteFunctions,
	value: string,
	fieldName: string,
	itemIndex: number,
): string {
	const trimmed = value.trim();
	if (!trimmed) {
		throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, { itemIndex });
	}

	if (!strictIsoDatePattern.test(trimmed)) {
		throw new NodeOperationError(context.getNode(), `${fieldName} must be in YYYY-MM-DD format`, {
			itemIndex,
		});
	}

	return trimmed;
}

export function validateReminderDate(
	context: IExecuteFunctions,
	value: string,
	fieldName: string,
	itemIndex: number,
): string {
	return validateDateOnly(context, value, fieldName, itemIndex);
}

export function validateReminderTaskDateTime(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string | number {
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || value <= 0) {
			throw new NodeOperationError(
				context.getNode(),
				'Task Date Time must be a positive timestamp number',
				{ itemIndex },
			);
		}
		return value;
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new NodeOperationError(context.getNode(), 'Task Date Time cannot be empty', {
				itemIndex,
			});
		}

		if (!strictIsoDateTimePattern.test(trimmed)) {
			throw new NodeOperationError(
				context.getNode(),
				'Task Date Time must be a strict ISO 8601 datetime (e.g. 2026-03-01T10:00:00Z)',
				{ itemIndex },
			);
		}

		const parsed = new Date(trimmed);
		if (Number.isNaN(parsed.getTime())) {
			throw new NodeOperationError(context.getNode(), 'Task Date Time must be a valid datetime', {
				itemIndex,
			});
		}

		return trimmed;
	}

	throw new NodeOperationError(
		context.getNode(),
		'Task Date Time must be a timestamp number or ISO datetime string',
		{ itemIndex },
	);
}

export function validateReminderContent(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	const content = String(value ?? '').trim();
	if (!content) {
		throw new NodeOperationError(context.getNode(), 'Content is required', { itemIndex });
	}

	if (content.length > 512) {
		throw new NodeOperationError(
			context.getNode(),
			'Content is too long. Maximum length is 512 characters.',
			{ itemIndex },
		);
	}

	return content;
}

export function validateReminderTime(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName = 'Time',
): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric <= 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a positive whole-number timestamp in milliseconds`,
			{ itemIndex },
		);
	}

	return numeric;
}

export function parseReminderDateTimeOrUnixMs(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
): number {
	if (typeof value === 'number') {
		return validateReminderTime(context, value, itemIndex, fieldName);
	}

	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a datetime string or Unix timestamp in milliseconds`,
			{ itemIndex },
		);
	}

	const trimmed = value.trim();
	if (!trimmed) {
		throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, {
			itemIndex,
		});
	}

	if (/^\d+$/.test(trimmed)) {
		return validateReminderTime(context, trimmed, itemIndex, fieldName);
	}

	if (!strictIsoDateTimePattern.test(trimmed)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a valid datetime or Unix timestamp in milliseconds`,
			{ itemIndex },
		);
	}

	const parsedDate = Date.parse(trimmed);
	if (!Number.isFinite(parsedDate) || parsedDate <= 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a valid datetime or Unix timestamp in milliseconds`,
			{ itemIndex },
		);
	}

	return parsedDate;
}

export function validateReminderEntityId(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
): string {
	const sanitized = String(value ?? '').trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), `${fieldName} is required`, { itemIndex });
	}

	if (sanitized.length > 255) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is too long. Maximum length is 255 characters.`,
			{ itemIndex },
		);
	}

	if (!reminderEntityIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), `Invalid ${fieldName} format`, { itemIndex });
	}

	return sanitized;
}

export function validateReminderMessageId(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): number {
	if (typeof value === 'number') {
		if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
			throw new NodeOperationError(
				context.getNode(),
				'Message ID must be a positive whole number',
				{
					itemIndex,
				},
			);
		}
		return value;
	}

	const raw = String(value ?? '').trim();
	if (!raw) {
		throw new NodeOperationError(context.getNode(), 'Message ID is required', { itemIndex });
	}

	if (raw.length > 255) {
		throw new NodeOperationError(
			context.getNode(),
			'Message ID is too long. Maximum length is 255 characters.',
			{ itemIndex },
		);
	}

	const normalizedNumericString = reminderMessageIdPattern.test(raw) ? raw.split('_')[0] : raw;
	if (!reminderMessageLongPattern.test(normalizedNumericString)) {
		throw new NodeOperationError(
			context.getNode(),
			'Message ID must be a numeric value or timestamp_uniqueId format (example: 1772395354414_196142356543).',
			{ itemIndex },
		);
	}

	const parsed = Number(normalizedNumericString);
	if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
		throw new NodeOperationError(context.getNode(), 'Message ID must be a positive whole number', {
			itemIndex,
		});
	}

	return parsed;
}

export function validateReminderCategory(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): (typeof reminderCategories)[number] {
	const category = String(value ?? '').trim() as (typeof reminderCategories)[number];
	if (!reminderCategories.includes(category)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid category. Allowed values: ${reminderCategories.join(', ')}`,
			{ itemIndex },
		);
	}

	return category;
}

export function validateCompletedReminderCategory(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): (typeof completedReminderCategories)[number] {
	const category = String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/[_\s]+/g, '-') as (typeof completedReminderCategories)[number];
	if (!completedReminderCategories.includes(category)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid category. Use one of: ${completedReminderCategories.join(', ')}. Expression values like "Mine Completed" and "others completed" are also accepted.`,
			{ itemIndex },
		);
	}

	return category;
}

function validateIdArray(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	options: { min: number; max: number; label: string },
	validateId: (id: string) => string,
): string[] {
	if (!Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be an array`, { itemIndex });
	}

	const ids = value.map((id) => String(id).trim()).filter((id) => id.length > 0);
	if (ids.length < options.min) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must contain at least ${options.min} ${options.label}`,
			{
				itemIndex,
			},
		);
	}

	if (ids.length > options.max) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} can contain at most ${options.max} ${options.label}`,
			{ itemIndex },
		);
	}

	return ids.map(validateId);
}

export function validateReminderUserIds(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	options: { min?: number; max?: number } = {},
): string[] {
	const min = options.min ?? 1;
	const max = options.max ?? 4;
	return validateIdArray(
		context,
		value,
		itemIndex,
		path,
		{ min, max, label: 'user ID(s)' },
		(userId) => {
			if (!userIdPattern.test(userId) || userId.length > 255) {
				throw new NodeOperationError(context.getNode(), `Invalid User ID format: ${userId}`, {
					itemIndex,
				});
			}
			return userId;
		},
	);
}

export function validateReminderChatIds(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	options: { min?: number; max?: number } = {},
): string[] {
	const min = options.min ?? 1;
	const max = options.max ?? 1;
	return validateIdArray(
		context,
		value,
		itemIndex,
		path,
		{ min, max, label: 'chat ID(s)' },
		(chatId) => validateReminderEntityId(context, chatId, itemIndex, 'Chat ID'),
	);
}

export function validateReminderIdArray(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string[] {
	try {
		return validateIdArray(
			context,
			value,
			itemIndex,
			'reminder_ids',
			{ min: 1, max: 20, label: 'ID(s)' },
			(id) => validateReminderId(context, id, itemIndex),
		);
	} catch (error) {
		const message = extractErrorText(error);
		if (message.includes('reminder_ids must contain at least 1 ID(s)')) {
			throw new NodeOperationError(context.getNode(), 'reminder_ids must contain at least one ID', {
				itemIndex,
			});
		}
		if (message.includes('reminder_ids can contain at most 20 ID(s)')) {
			throw new NodeOperationError(context.getNode(), 'reminder_ids can contain at most 20 IDs', {
				itemIndex,
			});
		}
		throw error;
	}
}

export function validateReminderPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
	options: {
		requireContent?: boolean;
		requireTime?: boolean;
		allowEmpty?: boolean;
		allowedFields?: string[];
	} = {},
): IDataObject {
	if (payload == null) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	ensureSafeObject(context, payload, itemIndex, path);

	if (!options.allowEmpty && Object.keys(payload).length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	if (options.allowedFields && options.allowedFields.length > 0) {
		for (const key of Object.keys(payload)) {
			if (!options.allowedFields.includes(key)) {
				throw new NodeOperationError(
					context.getNode(),
					`${path} contains unsupported field "${key}". Allowed fields: ${options.allowedFields.join(', ')}`,
					{ itemIndex },
				);
			}
		}
	}

	if (payload.content !== undefined || options.requireContent) {
		payload.content = validateReminderContent(context, payload.content, itemIndex);
	}

	if (payload.time !== undefined || options.requireTime) {
		payload.time = parseReminderDateTimeOrUnixMs(context, payload.time, itemIndex, 'Time');
	}

	if (payload.user_ids !== undefined) {
		payload.user_ids = validateReminderUserIds(context, payload.user_ids, itemIndex, 'user_ids');
	}

	if (payload.chat_ids !== undefined) {
		payload.chat_ids = validateReminderChatIds(context, payload.chat_ids, itemIndex, 'chat_ids');
	}

	if (payload.chat_id !== undefined) {
		payload.chat_id = validateReminderEntityId(context, payload.chat_id, itemIndex, 'Chat ID');
	}

	if (payload.message_id !== undefined) {
		payload.message_id = validateReminderMessageId(context, payload.message_id, itemIndex);
	}

	if (payload.task_datetime !== undefined) {
		payload.task_datetime = validateReminderTaskDateTime(context, payload.task_datetime, itemIndex);
	}

	if (payload.date !== undefined) {
		payload.date = validateDateOnly(context, String(payload.date), 'Date', itemIndex);
	}

	return payload;
}

export function stringifyReminderTimeForApi(payload: IDataObject): void {
	if (payload.time === undefined) {
		return;
	}

	payload.time = String(payload.time);
}

export function omitBlankReminderTime(payload: IDataObject): void {
	if (!Object.prototype.hasOwnProperty.call(payload, 'time')) {
		return;
	}

	const rawTime = payload.time;
	if (rawTime === undefined || rawTime === null) {
		delete payload.time;
		return;
	}

	if (typeof rawTime === 'string' && rawTime.trim() === '') {
		delete payload.time;
	}
}

export function isRemindersAiErrorModeEnabled(
	context: IExecuteFunctions,
	itemIndex: number,
): boolean {
	let rawFromParameter: unknown;
	try {
		rawFromParameter = context.getNodeParameter('enableAiErrorMode', itemIndex, false);
	} catch {
		rawFromParameter = undefined;
	}

	if (parseBooleanLikeTrue(rawFromParameter)) {
		return true;
	}

	try {
		if (typeof context.getNode !== 'function') {
			return false;
		}

		const node = context.getNode() as { parameters?: IDataObject };
		const parameters = node?.parameters;
		if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
			return false;
		}

		return parseBooleanLikeTrue(parameters.enableAiErrorMode);
	} catch {
		return false;
	}
}

export function pushRemindersRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IRemindersRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isRemindersAiErrorModeEnabled(context, itemIndex);

	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		const mergedPayload: IDataObject = {
			...(scopePayload as IDataObject),
			...(options.contextFields ?? {}),
		};
		const executionData = context.helpers.constructExecutionMetaData([{ json: mergedPayload }], {
			itemData: { item: itemIndex },
		});
		returnData.push(...executionData);
		return true;
	}

	const errorPayload = buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'reminders',
			operation,
		},
		{
			contextFields: options.contextFields,
			fallbackMessage: options.fallbackMessage,
			messageMappings: options.messageMappings,
		},
	);

	const executionData = context.helpers.constructExecutionMetaData([{ json: errorPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export function resolveRemindersEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
	defaultIncludeEnhancedOutput = true,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = Boolean(
		context.getNodeParameter('includeEnhancedOutput', itemIndex, defaultIncludeEnhancedOutput),
	);
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}
