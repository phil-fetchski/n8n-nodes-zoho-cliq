import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseBooleanLikeTrue, validateEmail } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { parseFlexibleUserIdsInput as parseFlexibleUserIdsInputShared } from '../shared/flexibleUserIds';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import { validateZohoEntityId } from '../shared/validation';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const departmentIdPattern = /^[a-zA-Z0-9_-]+$/;
const validDepartmentInputModes = new Set(['structured', 'raw']);
const strictEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const departmentIdLocator: INodeProperties = {
	displayName: 'Department',
	name: 'departmentId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'Choose a department from the list, or specify a Department ID using an <a href="https://docs.n8n.io/code/expressions/" target="_blank">expression</a>',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchDepartments',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. dept_1234567890',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9_-]+$',
						errorMessage:
							'Department ID can only contain letters, numbers, hyphens and underscores',
					},
				},
			],
		},
	],
};

export function validateDepartmentId(
	context: IExecuteFunctions,
	departmentId: string,
	itemIndex: number,
): string {
	if (!departmentId || !departmentId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Department ID is required', { itemIndex });
	}

	const sanitized = departmentId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Department ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	if (!departmentIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Department ID format', { itemIndex });
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

export function parseDepartmentPayloadInput(
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

	return ids;
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

export interface IParsedDepartmentMemberIdentifiers {
	identifierType: 'email_ids' | 'user_ids';
	identifiers: string[];
}

export interface IDepartmentRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function validateDepartmentInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'raw' {
	if (typeof value !== 'string' || !validDepartmentInputModes.has(value)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be either "structured" or "raw"`,
			{ itemIndex },
		);
	}

	return value as 'structured' | 'raw';
}

function isValidEmailIdentifier(value: string): boolean {
	return strictEmailPattern.test(value.trim());
}

export function parseDepartmentMemberIdentifiers(
	context: IExecuteFunctions,
	identifiersRaw: unknown,
	itemIndex: number,
): IParsedDepartmentMemberIdentifiers {
	if (!identifiersRaw) {
		throw new NodeOperationError(context.getNode(), 'Member Identifiers are required', {
			itemIndex,
		});
	}

	let identifierParts: string[];
	if (Array.isArray(identifiersRaw)) {
		identifierParts = identifiersRaw
			.map((identifier) => String(identifier).trim())
			.filter((identifier) => identifier.length > 0);
	} else if (typeof identifiersRaw === 'string') {
		const trimmedIdentifiers = identifiersRaw.trim();
		if (!trimmedIdentifiers) {
			throw new NodeOperationError(
				context.getNode(),
				'At least one member identifier is required',
				{
					itemIndex,
				},
			);
		}

		const looksLikeJsonArray =
			trimmedIdentifiers.startsWith('[') && trimmedIdentifiers.endsWith(']');

		if (looksLikeJsonArray) {
			let parsedIdentifiers: unknown;
			try {
				parsedIdentifiers = JSON.parse(trimmedIdentifiers);
			} catch {
				throw new NodeOperationError(
					context.getNode(),
					'Member Identifiers must be a valid JSON array when provided in array form',
					{
						itemIndex,
					},
				);
			}

			if (!Array.isArray(parsedIdentifiers)) {
				throw new NodeOperationError(
					context.getNode(),
					'Member Identifiers must be a JSON array of user IDs or email IDs when provided in array form',
					{
						itemIndex,
					},
				);
			}

			identifierParts = parsedIdentifiers
				.map((identifier) => String(identifier).trim())
				.filter((identifier) => identifier.length > 0);
		} else {
			identifierParts = trimmedIdentifiers
				.split(',')
				.map((part) => part.trim())
				.filter((part) => part.length > 0);
		}
	} else {
		throw new NodeOperationError(
			context.getNode(),
			'Member Identifiers must be either a JSON array of user IDs or email IDs, or a comma-separated string of identifiers',
			{ itemIndex },
		);
	}

	if (identifierParts.length === 0) {
		throw new NodeOperationError(context.getNode(), 'At least one member identifier is required', {
			itemIndex,
		});
	}

	const hasEmailIds = identifierParts.some((identifier) => isValidEmailIdentifier(identifier));
	const hasUserIds = identifierParts.some((identifier) => !isValidEmailIdentifier(identifier));

	if (hasEmailIds && hasUserIds) {
		throw new NodeOperationError(
			context.getNode(),
			'Use either email IDs or user IDs in one request. Mixed identifier types are not supported.',
			{ itemIndex },
		);
	}

	if (hasEmailIds) {
		const identifiers = identifierParts.map((identifier) =>
			validateEmail(context, identifier, itemIndex),
		);

		return {
			identifierType: 'email_ids',
			identifiers,
		};
	}

	const identifiers = identifierParts.map((identifier, index) =>
		validateZohoEntityId(context, identifier, itemIndex, `User IDs[${index}]`),
	);

	return {
		identifierType: 'user_ids',
		identifiers,
	};
}

export function validateDepartmentPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
	options: {
		requireName?: boolean;
		allowEmpty?: boolean;
		allowedFields?: string[];
		requireLeadZuid?: boolean;
		requireParentDepartmentId?: boolean;
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

	if (payload.name !== undefined || options.requireName) {
		const name = String(payload.name ?? '').trim();
		if (!name) {
			throw new NodeOperationError(context.getNode(), 'Department name is required', {
				itemIndex,
			});
		}

		if (name.length > 120) {
			throw new NodeOperationError(
				context.getNode(),
				'Department name is too long. Maximum length is 120 characters.',
				{ itemIndex },
			);
		}

		payload.name = name;
	}

	if (payload.description !== undefined) {
		const description = String(payload.description).trim();
		if (!description) {
			delete payload.description;
		} else {
			if (description.length > 1000) {
				throw new NodeOperationError(
					context.getNode(),
					'Description is too long. Maximum length is 1000 characters.',
					{ itemIndex },
				);
			}
			payload.description = description;
		}
	}

	if (payload.lead_zuid !== undefined) {
		payload.lead_zuid = validateZohoEntityId(context, payload.lead_zuid, itemIndex, 'Lead ZUID');
	} else if (options.requireLeadZuid) {
		throw new NodeOperationError(context.getNode(), 'Lead ZUID is required', {
			itemIndex,
		});
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

		payload.user_ids = payload.user_ids.map((userId, idx) =>
			validateZohoEntityId(context, userId, itemIndex, `user_ids[${idx}]`),
		);
	}

	if (payload.parent_department_id !== undefined) {
		payload.parent_department_id = validateZohoEntityId(
			context,
			payload.parent_department_id,
			itemIndex,
			'Parent Department ID',
		);
	} else if (options.requireParentDepartmentId) {
		throw new NodeOperationError(context.getNode(), 'Parent Department ID is required', {
			itemIndex,
		});
	}

	return payload;
}

export function isDepartmentAiErrorModeEnabled(
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

export function pushDepartmentRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IDepartmentRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isDepartmentAiErrorModeEnabled(context, itemIndex);

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
			resource: 'department',
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

export function resolveDepartmentEnhancedOutput(
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
