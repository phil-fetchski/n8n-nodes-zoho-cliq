import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	sanitizeBase64ImageData,
	SUPPORTED_BASE64_IMAGE_FORMATS_TEXT,
} from '../../helpers/imageData';
import { isZohoCliqErrorResponse } from '../../helpers/interfaces';
import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { USER_LOOKUP_NOT_FOUND_ERROR_CODE, USER_LOOKUP_NOT_FOUND_HINT } from '../shared/preflight';

const BLOCKED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const STRICT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const USER_FIELD_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]{0,99}$/;
const EXTRA_JSON_KEY_PATTERN = /'([^']+)' is an extra key in the json object\.?/i;

export const USER_ALLOWED_FIELDS = ['display_name', 'mobile', 'department', 'designation'] as const;
export const USER_ALLOWED_FIELDS_WITH_ALL = [...USER_ALLOWED_FIELDS, 'all'] as const;
export const USER_ALLOWED_STATUSES = [
	'active',
	'inactive',
	'pending',
	'imported_active',
	'imported_inactive',
] as const;
export const USER_ALLOWED_PLAN_TYPES = ['paid', 'free'] as const;
export const USER_ALLOWED_SORT_BY = ['usage'] as const;
export const USER_ALLOWED_LAYOUT_UNIQUE_NAMES = [
	'quick_view',
	'profile_details_android',
	'profile_details_ios',
	'profile_details_web',
] as const;
export const USER_ALLOWED_INPUT_MODES = ['structured', 'raw'] as const;
export const USER_LIST_DISCOVERY_HINT =
	'Use List_users_in_Zoho_Cliq to discover valid user IDs, email addresses, or ZUIDs before retrying.';
export const USER_IANA_TIMEZONE_NOTICE =
	'Timezone Help: Use a valid IANA timezone name (for example: America/New_York). Reference: <a href="https://timeapi.io/documentation/iana-timezones" target="_blank" rel="noopener noreferrer">Open IANA timezone list</a>';
export const RESERVED_USER_PAYLOAD_FIELDS = new Set([
	'email_id',
	'first_name',
	'last_name',
	'display_name',
	'phone',
	'mobile',
	'timezone',
	'language',
	'country',
	'designation_id',
	'department_id',
	'reporting_to_zuid',
	'work_location',
	'extension',
	'employee_id',
	'image_data',
	'channel_ids',
	'team_ids',
	'emailId',
	'firstName',
	'lastName',
	'displayName',
	'departmentId',
	'designationId',
	'reportingToZuid',
	'workLocation',
	'employeeId',
	'imageData',
	'channelIds',
	'teamIds',
]);

export const userIdLocator: INodeProperties = {
	displayName: 'User',
	name: 'userId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'Choose a user from the list, or specify a user ID, email, or ZUID using an <a href="https://docs.n8n.io/code/expressions/" target="_blank">expression</a>',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchUsers',
				searchable: true,
			},
		},
		{
			displayName: 'By ID / Email / ZUID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. user@example.com or 1234567890123456789',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9@._-]+$',
						errorMessage:
							'User identifier can only contain letters, numbers, @, periods, underscores, and hyphens',
					},
				},
			],
		},
	],
};

export interface IUserRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export interface IUserIdentifierRecoverableMessageMappingOptions {
	identifier?: string;
	notFoundHint?: string;
	treatInvalidFormatAsNotFound?: boolean;
}

export function shouldContinueOnFail(context: IExecuteFunctions): boolean {
	return typeof context.continueOnFail === 'function' && context.continueOnFail();
}

export function isUserAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
	try {
		return parseBooleanLikeTrue(context.getNodeParameter('enableAiErrorMode', itemIndex, false));
	} catch {
		// Fall through to persisted node parameters when runtime parameter lookup is unavailable.
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

export function shouldRunUserRecoverablePreflight(context: IExecuteFunctions): boolean {
	if (shouldContinueOnFail(context)) {
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

export function getUserIdentifierRecoverableMessageMappings(
	options: IUserIdentifierRecoverableMessageMappingOptions = {},
): ICliqErrorMessageMapping[] {
	const notFoundHint = options.notFoundHint ?? USER_LOOKUP_NOT_FOUND_HINT;
	const invalidIdentifierMessage = options.identifier?.trim()
		? `No Zoho Cliq user found for User ID / Email / ZUID "${options.identifier.trim()}".`
		: 'No Zoho Cliq user found for the supplied user identifier.';

	const mappings: ICliqErrorMessageMapping[] = [
		{
			match: (normalizedMessage) => normalizedMessage.includes('user id is required'),
			reason: 'INVALID_USER_IDENTIFIER',
			hint: 'Provide a valid Zoho Cliq user ID, email address, or ZUID.',
		},
		{
			match: (normalizedMessage) => normalizedMessage.includes('invalid user id format'),
			reason: options.treatInvalidFormatAsNotFound
				? USER_LOOKUP_NOT_FOUND_ERROR_CODE
				: 'INVALID_USER_IDENTIFIER',
			hint: options.treatInvalidFormatAsNotFound
				? notFoundHint
				: 'Provide a valid Zoho Cliq user ID, email address, or ZUID.',
			messageOverride: options.treatInvalidFormatAsNotFound ? invalidIdentifierMessage : undefined,
		},
		{
			match: (normalizedMessage, _message, error) =>
				(error instanceof NodeOperationError &&
					(error as NodeOperationError & { code?: string }).code ===
						USER_LOOKUP_NOT_FOUND_ERROR_CODE) ||
				normalizedMessage.includes('no zoho cliq user found for user id / email / zuid'),
			reason: USER_LOOKUP_NOT_FOUND_ERROR_CODE,
			hint: notFoundHint,
		},
	];

	return mappings;
}

export function getUserEmailRecoverableMessageMappings(): ICliqErrorMessageMapping[] {
	return [
		{
			match: (normalizedMessage) =>
				normalizedMessage.includes('invalid email format') ||
				normalizedMessage.includes('email id is required'),
			reason: 'INVALID_EMAIL',
			hint: 'Provide a valid email address in email_id format such as name@example.com.',
		},
	];
}

function extractExtraJsonKey(message: string): string | undefined {
	const trimmedMessage = message.trim();
	const match = trimmedMessage.match(EXTRA_JSON_KEY_PATTERN);
	return match?.[1];
}

export function getUserCustomFieldRecoverableMessageMappings(
	customFieldKeys: Iterable<string>,
): ICliqErrorMessageMapping[] {
	const knownCustomFieldKeys = new Set(
		Array.from(customFieldKeys)
			.map((key) => String(key).trim())
			.filter((key) => key.length > 0),
	);

	if (!knownCustomFieldKeys.size) {
		return [];
	}

	return [
		{
			match: (_normalizedMessage, message) => {
				const extraKey = extractExtraJsonKey(message);
				return extraKey !== undefined && knownCustomFieldKeys.has(extraKey);
			},
			reason: 'INVALID_CUSTOM_FIELD',
			messageOverride: (_normalizedMessage, message) => {
				const extraKey = extractExtraJsonKey(message);
				if (!extraKey) {
					return undefined;
				}

				return `Custom field '${extraKey}' does not exist in this organization.`;
			},
			hint: () =>
				'If available, use Retrieve_all_user_field_schema_definitions_in_Zoho_Cliq to retrieve the valid custom field unique_name values for this organization before retrying. If available, use Add_a_user_field_schema_definition_in_Zoho_Cliq to create this field first if it does not already exist. Otherwise, verify the custom field unique_name with your Zoho Cliq administrator before retrying.',
			payloadFields: (_normalizedMessage, message) => {
				const extraKey = extractExtraJsonKey(message);
				if (!extraKey) {
					return undefined;
				}

				return {
					custom_field: extraKey,
				};
			},
		},
	];
}

export function appendWarningsToResponse(response: unknown, warnings: IDataObject[]): IDataObject {
	const baseResponse =
		response && typeof response === 'object' && !Array.isArray(response)
			? { ...(response as IDataObject) }
			: ({ data: response } as IDataObject);

	if (!warnings.length) {
		return baseResponse;
	}

	const existingWarnings = Array.isArray(baseResponse._warnings)
		? [...(baseResponse._warnings as IDataObject[])]
		: [];
	baseResponse._warnings = [...existingWarnings, ...warnings];
	return baseResponse;
}

export function buildUserContinueOnFailError(error: unknown): IDataObject {
	const scopePayload =
		error && typeof error === 'object' && !Array.isArray(error)
			? ((error as IDataObject).zohoCliqScopeErrorPayload as IDataObject | undefined)
			: undefined;

	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		return {
			...(scopePayload as IDataObject),
			success: false,
		};
	}

	const details: IDataObject = {};
	const msg = error instanceof Error ? (error.message || '').trim() : '';
	const errorMessage = msg || 'An unexpected issue occurred';

	if (error && typeof error === 'object' && !Array.isArray(error)) {
		const response = (error as IDataObject).response as IDataObject | undefined;
		if (typeof response?.status === 'number') {
			details.statusCode = response.status;
		}

		if (isZohoCliqErrorResponse(response?.data)) {
			if (typeof response.data.message === 'string') {
				details.message = response.data.message;
			}
			if (typeof response.data.code === 'string' || typeof response.data.code === 'number') {
				details.code = response.data.code;
			}
			if (
				typeof response.data.error_code === 'string' ||
				typeof response.data.error_code === 'number'
			) {
				details.error_code = response.data.error_code;
			}
			if (typeof response.data.status === 'string' || typeof response.data.status === 'number') {
				details.status = response.data.status;
			}
		}
	}

	return {
		success: false,
		error: errorMessage,
		details,
	};
}

export function pushUserRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IUserRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isUserAiErrorModeEnabled(context, itemIndex);

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
			resource: 'user',
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

export function ensureSafeUserObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (!value || typeof value !== 'object') {
		return;
	}

	if (Array.isArray(value)) {
		for (let idx = 0; idx < value.length; idx++) {
			ensureSafeUserObject(context, value[idx], itemIndex, `${path}[${idx}]`);
		}
		return;
	}

	for (const key of Object.keys(value as IDataObject)) {
		if (BLOCKED_OBJECT_KEYS.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{ itemIndex },
			);
		}
		ensureSafeUserObject(context, (value as IDataObject)[key], itemIndex, `${path}.${key}`);
	}
}

export function sanitizeOptionalString(
	context: IExecuteFunctions,
	value: unknown,
	fieldLabel: string,
	itemIndex: number,
	maxLength: number,
): string | undefined {
	const stringValue = String(value ?? '').trim();
	if (!stringValue) {
		return undefined;
	}
	if (stringValue.length > maxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} is too long. Maximum length is ${maxLength} characters.`,
			{ itemIndex },
		);
	}
	return stringValue;
}

export function sanitizeStrictId(
	context: IExecuteFunctions,
	value: unknown,
	fieldLabel: string,
	itemIndex: number,
): string | undefined {
	const stringValue = sanitizeOptionalString(context, value, fieldLabel, itemIndex, 200);
	if (!stringValue) {
		return undefined;
	}
	if (!STRICT_ID_PATTERN.test(stringValue)) {
		throw new NodeOperationError(context.getNode(), `Invalid ${fieldLabel} format`, { itemIndex });
	}
	return stringValue;
}

export function sanitizeImageDataBase64(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Image Data',
	maxLength = 4_000_000,
): string | undefined {
	return sanitizeBase64ImageData(context, value, itemIndex, {
		fieldLabel,
		maxLength,
		unsupportedFormatMessage: `${fieldLabel} must decode to a supported image file. Supported formats: ${SUPPORTED_BASE64_IMAGE_FORMATS_TEXT}. Provide Base64 from the original image file, not arbitrary Base64 text, HTML, or an image URL.`,
	});
}

export function validateUserInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	allowedModes: readonly string[] = USER_ALLOWED_INPUT_MODES,
): string {
	const inputMode = String(value ?? '').trim();

	if (!allowedModes.includes(inputMode)) {
		throw new NodeOperationError(
			context.getNode(),
			`Input Mode must be one of: ${allowedModes.join(', ')}`,
			{
				itemIndex,
			},
		);
	}

	return inputMode;
}

export function parseIdList(
	context: IExecuteFunctions,
	value: string,
	fieldLabel: string,
	itemIndex: number,
): string[] {
	const parsed = value
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id.length > 0);

	if (!parsed.length) {
		return [];
	}

	for (const id of parsed) {
		if (!STRICT_ID_PATTERN.test(id) || id.length > 200) {
			throw new NodeOperationError(context.getNode(), `Invalid ${fieldLabel} format: "${id}"`, {
				itemIndex,
			});
		}
	}

	return parsed;
}

export function parseUserFieldsQueryParam(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	let rawFields: string[] = [];

	if (Array.isArray(value)) {
		rawFields = value.map((field) => String(field));
	} else if (typeof value === 'string') {
		rawFields = value.split(',');
	} else if (value !== undefined && value !== null) {
		rawFields = [String(value)];
	}

	const normalizedFields = Array.from(
		new Set(rawFields.map((field) => field.trim()).filter((field) => field.length > 0)),
	);

	if (normalizedFields.length === 0 || normalizedFields.includes('all')) {
		return 'all';
	}

	for (const field of normalizedFields) {
		if (
			!USER_ALLOWED_FIELDS_WITH_ALL.includes(field as (typeof USER_ALLOWED_FIELDS_WITH_ALL)[number])
		) {
			throw new NodeOperationError(context.getNode(), `Invalid fields value "${field}"`, {
				itemIndex,
			});
		}
	}

	return normalizedFields.join(',');
}

export function validateCustomFieldKey(
	context: IExecuteFunctions,
	key: string,
	itemIndex: number,
): void {
	if (BLOCKED_OBJECT_KEYS.has(key)) {
		throw new NodeOperationError(context.getNode(), `Unsafe key "${key}" is not allowed`, {
			itemIndex,
		});
	}

	if (!USER_FIELD_NAME_PATTERN.test(key)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid custom field name "${key}". Use alphanumeric and underscore only.`,
			{ itemIndex },
		);
	}
}
