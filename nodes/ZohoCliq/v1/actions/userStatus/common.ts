import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const statusIdPattern = /^[a-zA-Z0-9_-]+$/;
const userIdPattern = /^[a-zA-Z0-9@._:-]+$/;
const allowedStatusCodes = new Set(['available', 'busy', 'invisible']);
const validUserStatusInputModes = new Set(['structured', 'raw']);

export const USER_STATUS_INVALID_CODE_REASON = 'INVALID_STATUS_CODE';
export const USER_STATUS_INVALID_CODE_HINT =
	'Provide `code` as one of: available, busy, invisible.';
export const USER_STATUS_INVALID_MESSAGE_REASON = 'INVALID_STATUS_MESSAGE';
export const USER_STATUS_INVALID_MESSAGE_HINT = 'Provide a non-empty status message.';
export const USER_STATUS_INVALID_PAYLOAD_REASON = 'INVALID_STATUS_PAYLOAD';
export const USER_STATUS_INVALID_PAYLOAD_HINT =
	'Provide a non-empty JSON object with valid user status fields.';
export const USER_STATUS_UNSAFE_PAYLOAD_REASON = 'UNSAFE_STATUS_PAYLOAD';
export const USER_STATUS_UNSAFE_PAYLOAD_HINT =
	'Remove unsafe object keys such as __proto__, constructor, and prototype.';
export const USER_STATUS_INVALID_STATUS_ID_REASON = 'INVALID_STATUS_ID';
export const USER_STATUS_INVALID_STATUS_ID_HINT =
	'Provide a valid Zoho Cliq status ID using letters, numbers, hyphens, or underscores.';
export const USER_STATUS_INVALID_USER_ID_REASON = 'INVALID_USER_ID';
export const USER_STATUS_INVALID_USER_ID_HINT =
	'Provide a valid Zoho Cliq user ID, email address, or ZUID.';
export const USER_STATUS_INVALID_INPUT_MODE_REASON = 'INVALID_INPUT_MODE';
export const USER_STATUS_INVALID_INPUT_MODE_HINT =
	'Use either "Using Fields Below" or "Using JSON" as the input mode.';
export const USER_STATUS_INVALID_EXPIRY_REASON = 'INVALID_EXPIRY_TIME';
export const USER_STATUS_INVALID_EXPIRY_HINT =
	'Provide a future expiry as an ISO 8601 date-time value or Unix timestamp in milliseconds.';

export interface IUserStatusRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export const statusIdLocator: INodeProperties = {
	displayName: 'Status',
	name: 'statusId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'Select a reusable status by message or provide a status ID manually. Use "List User Statuses" if you need to confirm IDs first.',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchUserStatuses',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 1775998000034476000',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9_-]+$',
						errorMessage: 'Status ID can only contain letters, numbers, hyphens, and underscores',
					},
				},
			],
		},
	],
};

function buildUserStatusValidationError(
	context: IExecuteFunctions,
	message: string,
	itemIndex: number,
	reason: string,
	hint: string,
): NodeOperationError {
	const error = new NodeOperationError(context.getNode(), message, {
		itemIndex,
		description: hint,
	});
	(error as NodeOperationError & { code?: string }).code = reason;
	return error;
}

function normalizeCode(
	context: IExecuteFunctions,
	code: unknown,
	itemIndex: number,
	path: string,
): string {
	const normalizedCode = String(code ?? '')
		.trim()
		.toLowerCase();
	if (!normalizedCode) {
		throw buildUserStatusValidationError(
			context,
			`${path}.code is required`,
			itemIndex,
			USER_STATUS_INVALID_CODE_REASON,
			USER_STATUS_INVALID_CODE_HINT,
		);
	}

	if (!allowedStatusCodes.has(normalizedCode)) {
		throw buildUserStatusValidationError(
			context,
			`Invalid ${path}.code "${normalizedCode}". Use one of: available, busy, invisible.`,
			itemIndex,
			USER_STATUS_INVALID_CODE_REASON,
			USER_STATUS_INVALID_CODE_HINT,
		);
	}

	return normalizedCode;
}

function normalizeMessage(
	context: IExecuteFunctions,
	message: unknown,
	itemIndex: number,
	path: string,
): string {
	const normalizedMessage = String(message ?? '').trim();
	if (!normalizedMessage) {
		throw buildUserStatusValidationError(
			context,
			`${path}.message is required`,
			itemIndex,
			USER_STATUS_INVALID_MESSAGE_REASON,
			USER_STATUS_INVALID_MESSAGE_HINT,
		);
	}

	return normalizedMessage;
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
		throw buildUserStatusValidationError(
			context,
			`${path} must be a JSON object`,
			itemIndex,
			USER_STATUS_INVALID_PAYLOAD_REASON,
			USER_STATUS_INVALID_PAYLOAD_HINT,
		);
	}

	for (const key of Object.keys(value as IDataObject)) {
		if (blockedObjectKeys.has(key)) {
			throw buildUserStatusValidationError(
				context,
				`Unsafe key "${key}" is not allowed in ${path}`,
				itemIndex,
				USER_STATUS_UNSAFE_PAYLOAD_REASON,
				USER_STATUS_UNSAFE_PAYLOAD_HINT,
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

export function validateStatusId(
	context: IExecuteFunctions,
	statusId: string,
	itemIndex: number,
): string {
	if (!statusId || !statusId.trim()) {
		throw buildUserStatusValidationError(
			context,
			'Status ID is required',
			itemIndex,
			USER_STATUS_INVALID_STATUS_ID_REASON,
			USER_STATUS_INVALID_STATUS_ID_HINT,
		);
	}

	const sanitized = statusId.trim();
	if (sanitized.length > 120) {
		throw buildUserStatusValidationError(
			context,
			'Status ID is too long. Maximum length is 120 characters.',
			itemIndex,
			USER_STATUS_INVALID_STATUS_ID_REASON,
			USER_STATUS_INVALID_STATUS_ID_HINT,
		);
	}

	if (!statusIdPattern.test(sanitized)) {
		throw buildUserStatusValidationError(
			context,
			'Invalid Status ID format',
			itemIndex,
			USER_STATUS_INVALID_STATUS_ID_REASON,
			USER_STATUS_INVALID_STATUS_ID_HINT,
		);
	}

	return sanitized;
}

export function validateUserId(
	context: IExecuteFunctions,
	userId: string,
	itemIndex: number,
): string {
	if (!userId || !userId.trim()) {
		throw buildUserStatusValidationError(
			context,
			'User ID is required',
			itemIndex,
			USER_STATUS_INVALID_USER_ID_REASON,
			USER_STATUS_INVALID_USER_ID_HINT,
		);
	}

	const sanitized = userId.trim();
	if (sanitized.length > 150) {
		throw buildUserStatusValidationError(
			context,
			'User ID is too long. Maximum length is 150 characters.',
			itemIndex,
			USER_STATUS_INVALID_USER_ID_REASON,
			USER_STATUS_INVALID_USER_ID_HINT,
		);
	}

	if (!userIdPattern.test(sanitized)) {
		throw buildUserStatusValidationError(
			context,
			'Invalid User ID format',
			itemIndex,
			USER_STATUS_INVALID_USER_ID_REASON,
			USER_STATUS_INVALID_USER_ID_HINT,
		);
	}

	return sanitized;
}

export function validateStatusPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
): IDataObject {
	ensureSafeObject(context, payload, itemIndex, path);

	if (Object.keys(payload).length === 0) {
		throw buildUserStatusValidationError(
			context,
			`${path} cannot be empty`,
			itemIndex,
			USER_STATUS_INVALID_PAYLOAD_REASON,
			USER_STATUS_INVALID_PAYLOAD_HINT,
		);
	}

	return {
		code: normalizeCode(context, payload.code, itemIndex, path),
		message: normalizeMessage(context, payload.message, itemIndex, path),
	};
}

export function validateTransientStatusPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
): IDataObject {
	ensureSafeObject(context, payload, itemIndex, path);

	if (Object.keys(payload).length === 0) {
		throw buildUserStatusValidationError(
			context,
			`${path} cannot be empty`,
			itemIndex,
			USER_STATUS_INVALID_PAYLOAD_REASON,
			USER_STATUS_INVALID_PAYLOAD_HINT,
		);
	}

	return {
		code: normalizeCode(context, payload.code, itemIndex, path),
		message: normalizeMessage(context, payload.message, itemIndex, path),
		expiry: parseDateTimeOrUnixMs(context, payload.expiry, itemIndex, `${path}.expiry`),
	};
}

export function validateUserStatusInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'raw' {
	if (typeof value !== 'string' || !validUserStatusInputModes.has(value)) {
		throw buildUserStatusValidationError(
			context,
			`${fieldLabel} must be either "structured" or "raw"`,
			itemIndex,
			USER_STATUS_INVALID_INPUT_MODE_REASON,
			USER_STATUS_INVALID_INPUT_MODE_HINT,
		);
	}

	return value as 'structured' | 'raw';
}

export function parseStatusPayloadInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	let payload: unknown = value;

	if (typeof payload === 'string') {
		const trimmed = payload.trim();
		if (!trimmed) {
			throw buildUserStatusValidationError(
				context,
				`${path} cannot be empty`,
				itemIndex,
				USER_STATUS_INVALID_PAYLOAD_REASON,
				USER_STATUS_INVALID_PAYLOAD_HINT,
			);
		}

		try {
			payload = JSON.parse(trimmed);
		} catch {
			throw buildUserStatusValidationError(
				context,
				`${path} must be valid JSON when provided as a string`,
				itemIndex,
				USER_STATUS_INVALID_PAYLOAD_REASON,
				USER_STATUS_INVALID_PAYLOAD_HINT,
			);
		}
	}

	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw buildUserStatusValidationError(
			context,
			`${path} must be a JSON object`,
			itemIndex,
			USER_STATUS_INVALID_PAYLOAD_REASON,
			USER_STATUS_INVALID_PAYLOAD_HINT,
		);
	}

	return payload as IDataObject;
}

function normalizeEpochMilliseconds(
	context: IExecuteFunctions,
	value: number,
	itemIndex: number,
	path: string,
): number {
	const normalized = Math.trunc(value);
	if (!Number.isFinite(normalized) || normalized <= 0) {
		throw buildUserStatusValidationError(
			context,
			`${path} must resolve to a positive Unix timestamp in milliseconds`,
			itemIndex,
			USER_STATUS_INVALID_EXPIRY_REASON,
			USER_STATUS_INVALID_EXPIRY_HINT,
		);
	}
	return normalized;
}

export function parseDateTimeOrUnixMs(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): number {
	if (value === undefined || value === null) {
		throw buildUserStatusValidationError(
			context,
			`${path} is required`,
			itemIndex,
			USER_STATUS_INVALID_EXPIRY_REASON,
			USER_STATUS_INVALID_EXPIRY_HINT,
		);
	}

	if (typeof value === 'number') {
		return normalizeEpochMilliseconds(context, value, itemIndex, path);
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw buildUserStatusValidationError(
				context,
				`${path} is required`,
				itemIndex,
				USER_STATUS_INVALID_EXPIRY_REASON,
				USER_STATUS_INVALID_EXPIRY_HINT,
			);
		}

		if (/^-?\d+$/.test(trimmed)) {
			return normalizeEpochMilliseconds(context, Number(trimmed), itemIndex, path);
		}

		const parsed = Date.parse(trimmed);
		if (Number.isNaN(parsed)) {
			throw buildUserStatusValidationError(
				context,
				`${path} must be a valid date-time value or Unix timestamp in milliseconds`,
				itemIndex,
				USER_STATUS_INVALID_EXPIRY_REASON,
				USER_STATUS_INVALID_EXPIRY_HINT,
			);
		}
		return normalizeEpochMilliseconds(context, parsed, itemIndex, path);
	}

	if (typeof value === 'object' && !Array.isArray(value)) {
		const maybeDateTime = value as {
			toMillis?: () => number;
			ts?: number;
			valueOf?: () => unknown;
		};

		if (typeof maybeDateTime.toMillis === 'function') {
			return normalizeEpochMilliseconds(context, maybeDateTime.toMillis(), itemIndex, path);
		}

		if (typeof maybeDateTime.ts === 'number') {
			return normalizeEpochMilliseconds(context, maybeDateTime.ts, itemIndex, path);
		}

		if (typeof maybeDateTime.valueOf === 'function') {
			const resolved = maybeDateTime.valueOf();
			if (typeof resolved === 'number') {
				return normalizeEpochMilliseconds(context, resolved, itemIndex, path);
			}
		}
	}

	throw buildUserStatusValidationError(
		context,
		`${path} must be a valid date-time value or Unix timestamp in milliseconds`,
		itemIndex,
		USER_STATUS_INVALID_EXPIRY_REASON,
		USER_STATUS_INVALID_EXPIRY_HINT,
	);
}

export function handleContinueOnFailError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	error: unknown,
	itemIndex: number,
	operation: string,
	extra?: IDataObject,
	options: IUserStatusRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isUserStatusAiErrorModeEnabled(context, itemIndex);

	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	const jsonPayload =
		scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)
			? {
					...(scopePayload as IDataObject),
					success: false,
					...(extra ?? {}),
				}
			: {
					success: false,
					...buildCliqRecoverableErrorPayload(
						error,
						{
							resource: 'userStatus',
							operation,
						},
						{
							contextFields: extra ?? options.contextFields,
							fallbackMessage: options.fallbackMessage,
							messageMappings: options.messageMappings,
						},
					),
				};

	const executionData = context.helpers.constructExecutionMetaData([{ json: jsonPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export function isUserStatusAiErrorModeEnabled(
	context: IExecuteFunctions,
	itemIndex: number,
): boolean {
	try {
		return parseBooleanLikeTrue(context.getNodeParameter('enableAiErrorMode', itemIndex, false));
	} catch {
		// Fall through to persisted node parameters when runtime lookup is unavailable.
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

export function resolveUserStatusEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
	defaultValue = true,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = Boolean(
		context.getNodeParameter('includeEnhancedOutput', itemIndex, defaultValue),
	);
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}
