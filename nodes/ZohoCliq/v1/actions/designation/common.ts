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
import { parseFlexibleUserIdsInput as parseFlexibleUserIdsInputShared } from '../shared/flexibleUserIds';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import { validateZohoEntityId } from '../shared/validation';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const validDesignationInputModes = new Set(['structured', 'raw']);
const designationNameMaxLength = 30;
const designationApiErrorMessages: Record<string, string> = {
	operation_not_allowed:
		'This operation is not allowed. Your Cliq organization may be managed through Zoho People.',
	not_an_organization_admin:
		'Only organization admins can manage designations in this organization.',
	not_zoho_organization_user: 'One or more user IDs do not belong to this Zoho Cliq organization.',
	designation_already_exist: 'A designation with this name already exists.',
	designation_not_exist: 'The provided designation does not exist.',
	designation_create_failed: 'Zoho Cliq failed to create the designation due to an internal error.',
	designation_edit_failed: 'Zoho Cliq failed to update the designation due to an internal error.',
	department_not_exist: 'The provided designation does not exist.',
	department_base_dept_delete_not_allowed: 'Zoho Cliq did not allow deleting this designation.',
	department_delete_failed: 'Zoho Cliq failed to delete the designation due to an internal error.',
};

function asDataObjectFromUnknown(value: unknown): IDataObject | undefined {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return value as IDataObject;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	if (
		!trimmed ||
		(!trimmed.startsWith('{') && !trimmed.startsWith('[')) ||
		(!trimmed.endsWith('}') && !trimmed.endsWith(']'))
	) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(trimmed) as unknown;
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return parsed as IDataObject;
		}
	} catch {
		// Ignore parse failures and treat as non-object.
	}

	return undefined;
}

function getFirstString(values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}

	return undefined;
}

function extractErrorParts(root: IDataObject): {
	body: IDataObject | undefined;
	bodyData: IDataObject | undefined;
	data: IDataObject | undefined;
	dataData: IDataObject | undefined;
	rootError: IDataObject | undefined;
	responseError: IDataObject | undefined;
} {
	const response = asDataObjectFromUnknown(root.response);
	const body = asDataObjectFromUnknown(response?.body);
	const bodyData = asDataObjectFromUnknown(body?.data);
	const data = asDataObjectFromUnknown(response?.data);
	const dataData = asDataObjectFromUnknown(data?.data);
	const rootError = asDataObjectFromUnknown(root.error);
	const responseError =
		asDataObjectFromUnknown(body?.error) ?? asDataObjectFromUnknown(data?.error);

	return { body, bodyData, data, dataData, rootError, responseError };
}

function extractDesignationApiErrorCode(root: IDataObject | undefined): string | undefined {
	if (!root) {
		return undefined;
	}

	const { body, bodyData, data, dataData, rootError, responseError } = extractErrorParts(root);

	return getFirstString([
		body?.error_code,
		body?.code,
		bodyData?.error_code,
		bodyData?.code,
		data?.error_code,
		data?.code,
		dataData?.error_code,
		dataData?.code,
		rootError?.error_code,
		rootError?.code,
		responseError?.error_code,
		responseError?.code,
		root.error_code,
		root.code,
	])?.toLowerCase();
}

function extractDesignationApiMessage(root: IDataObject): string | undefined {
	const { body, bodyData, data, dataData, rootError, responseError } = extractErrorParts(root);

	return getFirstString([
		body?.message,
		body?.description,
		bodyData?.message,
		bodyData?.description,
		data?.message,
		data?.description,
		dataData?.message,
		dataData?.description,
		responseError?.message,
		responseError?.description,
		rootError?.message,
		rootError?.description,
		root.message,
		root.description,
	]);
}

export const designationIdLocator: INodeProperties = {
	displayName: 'Designation',
	name: 'designationId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The unique designation ID',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchDesignations',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 1901318000001072003',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9_-]+$',
						errorMessage:
							'Designation ID can only contain letters, numbers, hyphens and underscores',
					},
				},
			],
		},
	],
};

export interface IDesignationRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function validateDesignationId(
	context: IExecuteFunctions,
	designationId: string,
	itemIndex: number,
): string {
	if (!designationId || !designationId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Designation ID is required', { itemIndex });
	}

	const sanitized = designationId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Designation ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	return validateZohoEntityId(context, sanitized, itemIndex, 'Designation ID');
}

export function validateDesignationInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'raw' {
	if (typeof value !== 'string' || !validDesignationInputModes.has(value)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be either "structured" or "raw"`,
			{ itemIndex },
		);
	}

	return value as 'structured' | 'raw';
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
		if (!child || typeof child !== 'object') {
			continue;
		}

		if (Array.isArray(child)) {
			for (let index = 0; index < child.length; index++) {
				const arrayValue = child[index];
				if (arrayValue && typeof arrayValue === 'object') {
					ensureSafeObject(context, arrayValue, itemIndex, `${path}.${key}[${index}]`);
				}
			}
			continue;
		}

		ensureSafeObject(context, child, itemIndex, `${path}.${key}`);
	}
}

export function parseDesignationPayloadInput(
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

export function parseDelimitedIds(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): string[] {
	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must be a string containing comma-separated IDs`,
			{ itemIndex },
		);
	}

	const ids = value
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id.length > 0);

	if (ids.length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} must contain at least one ID`, {
			itemIndex,
		});
	}

	return ids.map((id, index) => validateZohoEntityId(context, id, itemIndex, `${path}[${index}]`));
}

export function parseFlexibleUserIdsInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): string[] {
	return parseFlexibleUserIdsInputShared(context, value, itemIndex, path, {
		parseDelimitedIds,
		validateUserId: validateZohoEntityId,
	});
}

export function validateDesignationPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
	options: { requireName?: boolean; allowEmpty?: boolean; allowedFields?: string[] } = {},
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

	if (payload.name !== undefined || options.requireName) {
		const name = String(payload.name ?? '').trim();
		if (!name) {
			throw new NodeOperationError(context.getNode(), 'Designation name is required', {
				itemIndex,
			});
		}

		if (name.length > designationNameMaxLength) {
			throw new NodeOperationError(
				context.getNode(),
				`Designation name is too long. Maximum length is ${designationNameMaxLength} characters.`,
				{ itemIndex },
			);
		}

		payload.name = name;
	}

	if (payload.user_ids !== undefined) {
		if (!Array.isArray(payload.user_ids)) {
			throw new NodeOperationError(context.getNode(), 'user_ids must be an array of strings', {
				itemIndex,
			});
		}

		if (payload.user_ids.length === 0) {
			throw new NodeOperationError(context.getNode(), 'user_ids cannot be empty', {
				itemIndex,
			});
		}

		payload.user_ids = payload.user_ids.map((userId, index) =>
			validateZohoEntityId(context, userId, itemIndex, `user_ids[${index}]`),
		);
	}

	return payload;
}

export function isDesignationAiErrorModeEnabled(
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

export function pushDesignationRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IDesignationRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isDesignationAiErrorModeEnabled(context, itemIndex);

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
			resource: 'designation',
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

export function resolveDesignationEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = Boolean(
		context.getNodeParameter('includeEnhancedOutput', itemIndex, true),
	);
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}

export function rethrowDesignationApiError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	operationLabel: string,
	_options: {
		designationId?: string;
	} = {},
): never {
	void _options;

	const root = asDataObjectFromUnknown(error);
	const errorCode = extractDesignationApiErrorCode(root);
	const mappedMessage = errorCode ? designationApiErrorMessages[errorCode] : undefined;
	if (!mappedMessage || !root) {
		throw error;
	}

	const apiMessage = extractDesignationApiMessage(root);
	const description = apiMessage
		? `Zoho Cliq API error code: ${errorCode}. ${apiMessage}`
		: `Zoho Cliq API error code: ${errorCode}.`;
	throw new NodeOperationError(context.getNode(), `${operationLabel} failed: ${mappedMessage}`, {
		itemIndex,
		description,
	});
}
