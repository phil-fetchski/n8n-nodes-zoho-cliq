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
const fieldIdPattern = /^[a-zA-Z0-9_-]+$/;
const validUserFieldInputModes = new Set(['structured', 'agentTool', 'raw']);
const createFieldTypes = new Set(['text_field', 'number', 'url', 'date_picker', 'drop_down']);
export const INVALID_USER_FIELD_ID = 'INVALID_USER_FIELD_ID';
export const MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD';
export const INVALID_USER_FIELD_NAME = 'INVALID_USER_FIELD_NAME';
export const INVALID_USER_FIELD_TYPE = 'INVALID_USER_FIELD_TYPE';
export const DROPDOWN_OPTIONS_REQUIRED = 'DROPDOWN_OPTIONS_REQUIRED';
export const DROPDOWN_OPTIONS_NOT_ALLOWED = 'DROPDOWN_OPTIONS_NOT_ALLOWED';
export const EMPTY_DROPDOWN_OPTIONS = 'EMPTY_DROPDOWN_OPTIONS';
export const INVALID_INPUT_MODE = 'INVALID_INPUT_MODE';
export const SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED = 'SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED';
const userFieldErrorContracts: Record<string, { message: string; hint: string }> = {
	FIELD_INVALID_VALUE_FOR_NUMERIC_FIELD: {
		message: 'Invalid value for numeric user field.',
		hint: 'The value for a numeric field must be a valid number.',
	},
	FIELD_INVALID_VALUE_FOR_URL_FIELD: {
		message: 'Invalid value for URL user field.',
		hint: 'The value for a URL field must be a valid URL.',
	},
	FIELD_EDIT_NOT_ALLOWED: {
		message: 'User field edit not allowed.',
		hint: 'You do not have permission to edit this user field.',
	},
	FIELD_SYSTEM_FIELD_OPTION_EDIT_NOT_ALLOWED: {
		message: 'Default user field options cannot be edited.',
		hint: 'You do not have permission to edit default/system user field options.',
	},
	FIELD_SYSTEM_FIELD_NAME_EDIT_NOT_ALLOWED: {
		message: 'Default user field name cannot be edited.',
		hint: 'You do not have permission to edit the default/system user field name.',
	},
	FIELD_SYSTEM_FIELD_EDIT_NOT_ALLOWED: {
		message: 'Default user field cannot be edited.',
		hint: 'You do not have permission to edit this default/system user field.',
	},
	FIELD_MAX_CUSTOM_FIELD_LIMIT_REACHED: {
		message: 'Maximum custom user field limit reached.',
		hint: 'Zoho Cliq supports up to 10 custom user fields per organization.',
	},
	FIELD_TYPE_NOT_SUPPORTED: {
		message: 'User field type not supported.',
		hint: 'Use one of the supported create types: text_field, number, url, date_picker, drop_down.',
	},
	FIELDS_OPTIONS_NOT_EXIST: {
		message: 'One or more user field options do not exist.',
		hint: 'Verify the dropdown option IDs or names before retrying the update.',
	},
};

export interface IUserFieldRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

const INVALID_USER_FIELD_ID_HINT =
	'Use the exact field_id returned by Retrieve All User Fields or Retrieve User Field.';
const SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED_HINT =
	'Delete is only supported for custom user fields where system_defined is false.';

function buildUserFieldOperationError(
	context: IExecuteFunctions,
	message: string,
	itemIndex: number,
	code: string,
	description?: string,
): NodeOperationError {
	const error = new NodeOperationError(context.getNode(), message, {
		itemIndex,
		description,
	});

	(error as NodeOperationError & { code?: string }).code = code;
	return error;
}

function buildInvalidUserFieldIdError(
	context: IExecuteFunctions,
	message: string,
	itemIndex: number,
): NodeOperationError {
	return buildUserFieldOperationError(
		context,
		message,
		itemIndex,
		INVALID_USER_FIELD_ID,
		INVALID_USER_FIELD_ID_HINT,
	);
}

export function buildSystemUserFieldDeleteNotAllowedError(
	context: IExecuteFunctions,
	itemIndex: number,
): NodeOperationError {
	return buildUserFieldOperationError(
		context,
		'System-defined user fields cannot be deleted.',
		itemIndex,
		SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED,
		SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED_HINT,
	);
}

export const userFieldIdLocator: INodeProperties = {
	displayName: 'User Field',
	name: 'fieldId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'The user-field schema definition ID (field metadata/configuration ID), not a user ID',
	hint: 'Use the field-definition ID returned by list/get/create/update operations. This is not a user identifier.',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchUserFields',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 1901318000003603019',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9_-]+$',
						errorMessage:
							'User Field ID can only contain letters, numbers, hyphens and underscores',
					},
				},
			],
		},
	],
};

export function validateUserFieldId(
	context: IExecuteFunctions,
	fieldId: string,
	itemIndex: number,
): string {
	if (!fieldId || !fieldId.trim()) {
		throw buildInvalidUserFieldIdError(context, 'User Field ID is required', itemIndex);
	}

	const sanitized = fieldId.trim();
	if (sanitized.length > 200) {
		throw buildInvalidUserFieldIdError(
			context,
			'User Field ID is too long. Maximum length is 200 characters.',
			itemIndex,
		);
	}

	if (!fieldIdPattern.test(sanitized)) {
		throw buildInvalidUserFieldIdError(context, 'Invalid User Field ID format', itemIndex);
	}

	return sanitized;
}

export function validateUserFieldInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'agentTool' | 'raw' {
	if (typeof value !== 'string') {
		throw buildUserFieldOperationError(
			context,
			`${fieldLabel} must be "structured", "agentTool", or "raw"`,
			itemIndex,
			INVALID_INPUT_MODE,
		);
	}

	const sanitized = value.trim();
	if (!validUserFieldInputModes.has(sanitized)) {
		throw buildUserFieldOperationError(
			context,
			`${fieldLabel} must be "structured", "agentTool", or "raw"`,
			itemIndex,
			INVALID_INPUT_MODE,
		);
	}

	return sanitized as 'structured' | 'agentTool' | 'raw';
}

export function parseFieldArrayInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): unknown[] {
	if (value === null || value === undefined) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	let parsed: unknown = value;
	if (typeof value === 'string') {
		const rawValue = value.trim();
		if (!rawValue) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
				itemIndex,
			});
		}

		try {
			parsed = JSON.parse(rawValue);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a valid JSON array when provided as text`,
				{ itemIndex },
			);
		}
	}

	if (!Array.isArray(parsed)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, {
			itemIndex,
		});
	}

	for (let idx = 0; idx < parsed.length; idx++) {
		const entry = parsed[idx];
		if (entry && typeof entry === 'object') {
			ensureSafeObject(context, entry, itemIndex, `${path}[${idx}]`);
		}
	}

	return parsed;
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

	if (typeof value !== 'object') {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	if (Array.isArray(value)) {
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

export function validateFieldPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
	allowEmpty = false,
): IDataObject {
	if (payload == null) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	ensureSafeObject(context, payload, itemIndex, path);

	if (!allowEmpty && Object.keys(payload).length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	const potentialNameKeys = ['name', 'label', 'display_name', 'unique_name'];
	for (const key of potentialNameKeys) {
		const value = payload[key];
		if (value !== undefined) {
			const stringValue = String(value).trim();
			if (!stringValue) {
				throw buildUserFieldOperationError(
					context,
					`${key} cannot be empty`,
					itemIndex,
					INVALID_USER_FIELD_NAME,
				);
			}
			if (stringValue.length > 30) {
				throw buildUserFieldOperationError(
					context,
					`${key} is too long. Maximum length is 30 characters.`,
					itemIndex,
					INVALID_USER_FIELD_NAME,
				);
			}
		}
	}

	return payload;
}

export function parseFieldPayloadInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (value === null || value === undefined) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	if (typeof value === 'string') {
		const rawValue = value.trim();
		if (!rawValue) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
				itemIndex,
			});
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

function coerceOptionalBoolean(
	context: IExecuteFunctions,
	value: unknown,
	fieldName: string,
	itemIndex: number,
): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true') {
			return true;
		}
		if (normalized === 'false') {
			return false;
		}
	}

	throw new NodeOperationError(context.getNode(), `${fieldName} must be a boolean`, {
		itemIndex,
	});
}

function validateCreateFieldType(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	if (value === undefined) {
		throw buildUserFieldOperationError(
			context,
			'type is required',
			itemIndex,
			MISSING_REQUIRED_FIELD,
			'Provide the required "type" field before creating a user field.',
		);
	}

	const typeValue = String(value).trim();
	if (!typeValue) {
		throw buildUserFieldOperationError(
			context,
			'type cannot be empty',
			itemIndex,
			INVALID_USER_FIELD_TYPE,
		);
	}

	if (!createFieldTypes.has(typeValue)) {
		throw buildUserFieldOperationError(
			context,
			`Invalid type "${typeValue}". Use one of: ${Array.from(createFieldTypes).join(', ')}`,
			itemIndex,
			INVALID_USER_FIELD_TYPE,
		);
	}

	return typeValue;
}

function validateCreateOptions(
	context: IExecuteFunctions,
	options: unknown,
	itemIndex: number,
): string[] | undefined {
	if (options === undefined) {
		return undefined;
	}

	if (!Array.isArray(options)) {
		throw new NodeOperationError(context.getNode(), 'options must be an array of strings', {
			itemIndex,
		});
	}

	if (options.length === 0) {
		throw buildUserFieldOperationError(
			context,
			'options cannot be empty',
			itemIndex,
			EMPTY_DROPDOWN_OPTIONS,
		);
	}

	const normalizedOptions = options.map((option, idx) => {
		if (typeof option !== 'string') {
			throw new NodeOperationError(
				context.getNode(),
				`options[${idx}] must be a non-empty string`,
				{ itemIndex },
			);
		}
		const optionName = option.trim();
		if (!optionName) {
			throw new NodeOperationError(
				context.getNode(),
				`options[${idx}] must be a non-empty string`,
				{ itemIndex },
			);
		}
		if (optionName.length > 100) {
			throw new NodeOperationError(context.getNode(), `options[${idx}] is too long`, {
				itemIndex,
			});
		}
		return optionName;
	});

	return Array.from(new Set(normalizedOptions));
}

function validateUpdateOptions(
	context: IExecuteFunctions,
	options: unknown,
	itemIndex: number,
): IDataObject[] | undefined {
	if (options === undefined) {
		return undefined;
	}

	if (!Array.isArray(options)) {
		throw new NodeOperationError(
			context.getNode(),
			'options must be an array of objects with name and optional id',
			{
				itemIndex,
			},
		);
	}

	if (options.length === 0) {
		throw buildUserFieldOperationError(
			context,
			'options cannot be empty',
			itemIndex,
			EMPTY_DROPDOWN_OPTIONS,
		);
	}

	const seenIds = new Set<string>();
	return options.map((option, idx) => {
		ensureSafeObject(context, option, itemIndex, `options[${idx}]`);
		const normalized = option as IDataObject;
		const name = String(normalized.name ?? '').trim();
		if (!name) {
			throw new NodeOperationError(context.getNode(), `options[${idx}].name is required`, {
				itemIndex,
			});
		}
		if (name.length > 100) {
			throw new NodeOperationError(context.getNode(), `options[${idx}].name is too long`, {
				itemIndex,
			});
		}

		const result: IDataObject = { name };
		if (normalized.id !== undefined) {
			const id = String(normalized.id ?? '').trim();
			if (!id) {
				throw new NodeOperationError(context.getNode(), `options[${idx}].id cannot be empty`, {
					itemIndex,
				});
			}
			if (!fieldIdPattern.test(id)) {
				throw new NodeOperationError(
					context.getNode(),
					`options[${idx}].id has invalid format. Use only letters, numbers, hyphens and underscores.`,
					{ itemIndex },
				);
			}
			if (seenIds.has(id)) {
				throw new NodeOperationError(
					context.getNode(),
					`options contains duplicate id "${id}". Option IDs must be unique.`,
					{ itemIndex },
				);
			}
			seenIds.add(id);
			result.id = id;
		}

		return result;
	});
}

export function validateCreateFieldPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
): IDataObject {
	validateFieldPayload(context, payload, itemIndex, path);

	const allowedFields = ['name', 'type', 'mandatory', 'encrypted', 'edit_permission', 'options'];
	for (const key of Object.keys(payload)) {
		if (!allowedFields.includes(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`${path} contains unsupported field "${key}". Allowed fields: ${allowedFields.join(', ')}`,
				{ itemIndex },
			);
		}
	}

	const name = String(payload.name ?? '').trim();
	if (!name) {
		throw buildUserFieldOperationError(
			context,
			'name is required',
			itemIndex,
			MISSING_REQUIRED_FIELD,
			'Provide the required "name" field before creating a user field.',
		);
	}
	payload.name = name;

	payload.type = validateCreateFieldType(context, payload.type, itemIndex);

	const mandatory = coerceOptionalBoolean(context, payload.mandatory, 'mandatory', itemIndex);
	if (mandatory !== undefined) {
		payload.mandatory = mandatory;
	}

	const encrypted = coerceOptionalBoolean(context, payload.encrypted, 'encrypted', itemIndex);
	if (encrypted !== undefined) {
		payload.encrypted = encrypted;
	}

	const editPermission = coerceOptionalBoolean(
		context,
		payload.edit_permission,
		'edit_permission',
		itemIndex,
	);
	if (editPermission !== undefined) {
		payload.edit_permission = editPermission;
	}

	const options = validateCreateOptions(context, payload.options, itemIndex);
	if (options !== undefined) {
		payload.options = options;
	}

	if (
		payload.type === 'drop_down' &&
		(!Array.isArray(payload.options) || payload.options.length === 0)
	) {
		throw buildUserFieldOperationError(
			context,
			'options are required when type is "drop_down"',
			itemIndex,
			DROPDOWN_OPTIONS_REQUIRED,
		);
	}

	if (payload.type !== 'drop_down' && payload.options !== undefined) {
		throw buildUserFieldOperationError(
			context,
			'options are only supported when type is "drop_down"',
			itemIndex,
			DROPDOWN_OPTIONS_NOT_ALLOWED,
		);
	}

	return payload;
}

export function validateUpdateFieldPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
): IDataObject {
	validateFieldPayload(context, payload, itemIndex, path);

	const allowedFields = ['name', 'mandatory', 'encrypted', 'edit_permission', 'options'];
	for (const key of Object.keys(payload)) {
		if (!allowedFields.includes(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`${path} contains unsupported field "${key}". Allowed fields: ${allowedFields.join(', ')}`,
				{ itemIndex },
			);
		}
	}

	const name = payload.name !== undefined ? String(payload.name).trim() : undefined;
	if (name !== undefined) {
		payload.name = name;
	}

	const mandatory = coerceOptionalBoolean(context, payload.mandatory, 'mandatory', itemIndex);
	if (mandatory !== undefined) {
		payload.mandatory = mandatory;
	}

	const encrypted = coerceOptionalBoolean(context, payload.encrypted, 'encrypted', itemIndex);
	if (encrypted !== undefined) {
		payload.encrypted = encrypted;
	}

	const editPermission = coerceOptionalBoolean(
		context,
		payload.edit_permission,
		'edit_permission',
		itemIndex,
	);
	if (editPermission !== undefined) {
		payload.edit_permission = editPermission;
	}

	const options = validateUpdateOptions(context, payload.options, itemIndex);
	if (options !== undefined) {
		payload.options = options;
	}

	return payload;
}

export function shouldContinueOnFail(context: IExecuteFunctions): boolean {
	return typeof context.continueOnFail === 'function' && context.continueOnFail();
}

export function isUserFieldAiErrorModeEnabled(
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

function applyKnownUserFieldErrorContract(errorPayload: IDataObject): IDataObject {
	const details =
		errorPayload.details &&
		typeof errorPayload.details === 'object' &&
		!Array.isArray(errorPayload.details)
			? (errorPayload.details as IDataObject)
			: undefined;

	if (!details) {
		return errorPayload;
	}

	let errorCode: string | undefined;
	for (const candidate of [details.code, details.error_code]) {
		if (typeof candidate === 'string' && candidate) {
			errorCode = candidate;
			break;
		}
	}

	if (errorCode !== undefined) {
		const knownContract = userFieldErrorContracts[errorCode];
		if (knownContract !== undefined) {
			errorPayload.reason = errorCode;
			errorPayload.message = knownContract.message;
			errorPayload.hint = knownContract.hint;
		}
	}

	return errorPayload;
}

export function pushUserFieldRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IUserFieldRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isUserFieldAiErrorModeEnabled(context, itemIndex);

	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	let scopePayload: unknown;
	if (error && typeof error === 'object' && !Array.isArray(error)) {
		scopePayload = (error as IDataObject).zohoCliqScopeErrorPayload;
	}
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

	const errorPayload = applyKnownUserFieldErrorContract(
		buildCliqRecoverableErrorPayload(
			error,
			{
				resource: 'userFields',
				operation,
			},
			{
				contextFields: options.contextFields,
				fallbackMessage: options.fallbackMessage,
				messageMappings: options.messageMappings,
			},
		),
	);

	const executionData = context.helpers.constructExecutionMetaData([{ json: errorPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export function resolveUserFieldEnhancedOutput(
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
