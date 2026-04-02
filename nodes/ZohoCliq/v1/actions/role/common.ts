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
import { READ_ONLY_PERMISSION_ACTIONS } from './permissions.constants';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const roleIdPattern = /^[a-zA-Z0-9_-]+$/;
const roleIdValidationErrorMessage =
	'Role ID can only contain letters, numbers, hyphens and underscores';
const userIdPattern = /^[a-zA-Z0-9_-]+$/;
const allowedProfileTypes = new Set(['Members', 'Cliq Admin', 'Admin']);
const allowedPermissionStatuses = new Set(['enabled', 'disabled']);
const validRoleInputModes = new Set(['structured', 'raw']);
export {
	CLONE_ROLE_NOT_FOUND_HINT,
	CLONE_ROLE_NOT_FOUND_MESSAGE,
	ROLE_NOT_FOUND_HINT,
	ROLE_NOT_FOUND_MESSAGE,
} from '../shared/preflight';
export const USER_IDS_NOT_FOUND_MESSAGE =
	'One or more user IDs were not found. The provided user IDs do not exist in this organization.';
export const USER_IDS_NOT_FOUND_HINT =
	'Use Get User or List Users to retrieve valid user IDs and try again.';
export const ROLE_HELPER_OPERATION_NOT_RECOMMENDED_AS_AI_TOOL_NOTICE =
	'This operation is a custom helper operation to make adjusting role permissions more user and workflow friendly, but it is not recommended for AI Agent tool use. For agent-controlled permission changes, use <code>Update Role Permissions</code>, which includes the full AI Tool setup guidance for this workflow.';

export const roleIdLocator: INodeProperties = {
	displayName: 'Role',
	name: 'roleId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The unique role ID',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchRoles',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. 5452022000003511003',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: roleIdPattern.source,
						errorMessage: roleIdValidationErrorMessage,
					},
				},
			],
		},
	],
};

export function validateRoleId(
	context: IExecuteFunctions,
	roleId: string,
	itemIndex: number,
): string {
	if (!roleId || !roleId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Role ID is required', { itemIndex });
	}

	const sanitized = roleId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Role ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	if (!roleIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Role ID format', { itemIndex });
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

export function parseRolePayloadInput(
	context: IExecuteFunctions,
	payload: unknown,
	itemIndex: number,
	fieldName: string,
): IDataObject {
	if (typeof payload === 'string') {
		const trimmed = payload.trim();
		if (!trimmed) {
			throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, {
				itemIndex,
			});
		}

		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new NodeOperationError(context.getNode(), `${fieldName} must be a JSON object`, {
					itemIndex,
				});
			}
			return parsed as IDataObject;
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}

			throw new NodeOperationError(context.getNode(), `${fieldName} must be valid JSON`, {
				itemIndex,
			});
		}
	}

	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new NodeOperationError(context.getNode(), `${fieldName} must be a JSON object`, {
			itemIndex,
		});
	}

	return payload as IDataObject;
}

export function parseDelimitedUserIds(
	context: IExecuteFunctions,
	rawValue: string,
	itemIndex: number,
	fieldName: string,
): string[] {
	if (!rawValue || !rawValue.trim()) {
		throw new NodeOperationError(context.getNode(), `${fieldName} is required`, { itemIndex });
	}

	const ids = rawValue
		.split(',')
		.map((value) => value.trim())
		.filter((value) => value.length > 0);

	if (ids.length === 0) {
		throw new NodeOperationError(context.getNode(), `At least one ${fieldName} value is required`, {
			itemIndex,
		});
	}

	const deduped = Array.from(new Set(ids));
	if (deduped.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			`Cannot process more than 100 users at once for ${fieldName}`,
			{ itemIndex },
		);
	}

	for (const userId of deduped) {
		if (userId.length > 200) {
			throw new NodeOperationError(
				context.getNode(),
				`User ID "${userId}" is too long. Maximum length is 200 characters.`,
				{ itemIndex },
			);
		}
		if (!userIdPattern.test(userId)) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid User ID "${userId}" in ${fieldName}. IDs can only contain letters, numbers, hyphens and underscores.`,
				{ itemIndex },
			);
		}
	}

	return deduped;
}

export function validateProfileType(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName = 'Profile Type',
): string {
	const normalized = String(value ?? '').trim();
	if (!normalized) {
		throw new NodeOperationError(context.getNode(), `${fieldName} is required`, { itemIndex });
	}

	if (!allowedProfileTypes.has(normalized)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be one of: Members, Cliq Admin, Admin`,
			{ itemIndex },
		);
	}

	return normalized;
}

export function validateRoleInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'raw' {
	if (typeof value !== 'string' || !validRoleInputModes.has(value)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be either "structured" or "raw"`,
			{ itemIndex },
		);
	}

	return value as 'structured' | 'raw';
}

export function validateRolePayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
	options: {
		requireName?: boolean;
		requireProfileType?: boolean;
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
		const allowedFieldsSet = new Set(options.allowedFields);
		for (const key of Object.keys(payload)) {
			if (!allowedFieldsSet.has(key)) {
				throw new NodeOperationError(
					context.getNode(),
					`Unsupported field "${key}" in ${path}. Allowed fields: ${options.allowedFields.join(', ')}`,
					{ itemIndex },
				);
			}
		}
	}

	if (payload.name !== undefined || options.requireName) {
		const name = String(payload.name ?? '').trim();
		if (!name) {
			throw new NodeOperationError(context.getNode(), 'Role name is required', {
				itemIndex,
			});
		}

		if (name.length > 120) {
			throw new NodeOperationError(
				context.getNode(),
				'Role name is too long. Maximum length is 120 characters.',
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

	if (payload.profile_type !== undefined) {
		payload.profile_type = validateProfileType(
			context,
			payload.profile_type,
			itemIndex,
			'Profile Type',
		);
	} else if (options.requireProfileType) {
		throw new NodeOperationError(context.getNode(), 'Profile Type is required', { itemIndex });
	}

	if (payload.clone_id !== undefined) {
		payload.clone_id = validateRoleId(context, String(payload.clone_id), itemIndex);
	}

	if (payload.user_ids !== undefined) {
		if (!Array.isArray(payload.user_ids)) {
			throw new NodeOperationError(context.getNode(), 'User IDs must be an array of strings', {
				itemIndex,
			});
		}

		const normalized = payload.user_ids.map((value) => String(value).trim()).filter(Boolean);
		if (normalized.length === 0) {
			payload.user_ids = [];
		} else {
			payload.user_ids = parseDelimitedUserIds(
				context,
				normalized.join(','),
				itemIndex,
				'User IDs',
			);
		}
	}

	return payload;
}

export function validateRolePermissionUpdatePayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
	path: string,
	options: { allowReadOnlyActions?: boolean } = {},
): IDataObject {
	ensureSafeObject(context, payload, itemIndex, path);

	const list = payload.list;
	if (!Array.isArray(list) || list.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must include a non-empty "list" array`,
			{ itemIndex },
		);
	}

	for (let idx = 0; idx < list.length; idx++) {
		const entry = list[idx];
		const entryPath = `${path}.list[${idx}]`;
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			throw new NodeOperationError(context.getNode(), `${entryPath} must be an object`, {
				itemIndex,
			});
		}

		ensureSafeObject(context, entry, itemIndex, entryPath);

		const typedEntry = entry as IDataObject;
		if (typeof typedEntry.module !== 'string') {
			throw new NodeOperationError(context.getNode(), `${entryPath}.module must be a string`, {
				itemIndex,
			});
		}

		const module = typedEntry.module.trim();
		if (!module) {
			throw new NodeOperationError(context.getNode(), `${entryPath}.module is required`, {
				itemIndex,
			});
		}
		typedEntry.module = module;

		const actionProvided = typedEntry.action !== undefined;
		if (actionProvided) {
			if (typeof typedEntry.action !== 'string') {
				throw new NodeOperationError(context.getNode(), `${entryPath}.action must be a string`, {
					itemIndex,
				});
			}

			const action = typedEntry.action.trim();
			if (!action) {
				throw new NodeOperationError(context.getNode(), `${entryPath}.action cannot be empty`, {
					itemIndex,
				});
			}
			if (READ_ONLY_PERMISSION_ACTIONS.has(action)) {
				if (!options.allowReadOnlyActions) {
					throw new NodeOperationError(
						context.getNode(),
						`${entryPath}.action "${action}" is read-only and cannot be updated`,
						{ itemIndex },
					);
				}
			}
			typedEntry.action = action;
		}

		let hasStatus = false;
		if (typedEntry.status !== undefined) {
			const normalizedStatus = String(typedEntry.status).trim();
			if (!normalizedStatus) {
				throw new NodeOperationError(context.getNode(), `${entryPath}.status cannot be empty`, {
					itemIndex,
				});
			}
			if (!allowedPermissionStatuses.has(normalizedStatus)) {
				throw new NodeOperationError(
					context.getNode(),
					`${entryPath}.status must be one of: enabled, disabled`,
					{ itemIndex },
				);
			}
			hasStatus = true;
			typedEntry.status = normalizedStatus;
		}

		let hasConfigs = false;
		if (typedEntry.configs !== undefined) {
			if (!Array.isArray(typedEntry.configs) || typedEntry.configs.length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					`${entryPath}.configs must be a non-empty array when provided`,
					{ itemIndex },
				);
			}

			for (let configIdx = 0; configIdx < typedEntry.configs.length; configIdx++) {
				const configEntry = typedEntry.configs[configIdx];
				const configPath = `${entryPath}.configs[${configIdx}]`;
				if (!configEntry || typeof configEntry !== 'object' || Array.isArray(configEntry)) {
					throw new NodeOperationError(context.getNode(), `${configPath} must be an object`, {
						itemIndex,
					});
				}

				ensureSafeObject(context, configEntry, itemIndex, configPath);

				const typedConfigEntry = configEntry as IDataObject;
				if (typeof typedConfigEntry.name !== 'string') {
					throw new NodeOperationError(context.getNode(), `${configPath}.name must be a string`, {
						itemIndex,
					});
				}
				const configName = typedConfigEntry.name.trim();
				if (!configName) {
					throw new NodeOperationError(context.getNode(), `${configPath}.name is required`, {
						itemIndex,
					});
				}
				typedConfigEntry.name = configName;
				if (!Object.prototype.hasOwnProperty.call(typedConfigEntry, 'value')) {
					throw new NodeOperationError(context.getNode(), `${configPath}.value is required`, {
						itemIndex,
					});
				}
			}

			hasConfigs = true;
		}

		if (actionProvided && !hasStatus) {
			throw new NodeOperationError(
				context.getNode(),
				`${entryPath}.status is required when action is provided`,
				{ itemIndex },
			);
		}

		if (!hasStatus && !hasConfigs) {
			throw new NodeOperationError(
				context.getNode(),
				`${entryPath} must include status and/or configs`,
				{ itemIndex },
			);
		}
	}

	return payload;
}

export function shouldContinueOnFail(context: IExecuteFunctions): boolean {
	return typeof context.continueOnFail === 'function' && context.continueOnFail();
}

export function isRoleRecoverableModeEnabled(
	context: IExecuteFunctions,
	itemIndex: number,
): boolean {
	return shouldContinueOnFail(context) || isRoleAiErrorModeEnabled(context, itemIndex);
}

export interface IRoleRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function isRoleAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

export function pushRoleRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IRoleRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled = shouldContinueOnFail(context);
	const aiErrorModeEnabled = isRoleAiErrorModeEnabled(context, itemIndex);

	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		const executionData = context.helpers.constructExecutionMetaData(
			[
				{
					json: {
						success: false,
						...(scopePayload as IDataObject),
						...(options.contextFields ?? {}),
					},
				},
			],
			{ itemData: { item: itemIndex } },
		);
		returnData.push(...executionData);
		return true;
	}

	const errorPayload = buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'role',
			operation,
		},
		{
			contextFields: options.contextFields,
			fallbackMessage: options.fallbackMessage,
			messageMappings: options.messageMappings,
		},
	);

	const executionData = context.helpers.constructExecutionMetaData(
		[
			{
				json: {
					success: false,
					...errorPayload,
				},
			},
		],
		{ itemData: { item: itemIndex } },
	);
	returnData.push(...executionData);
	return true;
}

export function resolveRoleEnhancedOutput(
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

export function buildRoleContinueOnFailError(error: unknown): IDataObject {
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

	let errorMessage = 'An unexpected issue occurred';
	const details: IDataObject = {};

	if (error instanceof Error) {
		errorMessage = error.message;
	}

	if (error && typeof error === 'object' && !Array.isArray(error)) {
		const errorRecord = error as IDataObject;
		const response = errorRecord.response as IDataObject | undefined;

		if (typeof response?.status === 'number') {
			details.statusCode = response.status;
		}

		const responseData = response?.data;
		if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
			const typedResponseData = responseData as IDataObject;
			if (typeof typedResponseData.message === 'string') {
				details.message = typedResponseData.message;
			}
			if (
				typeof typedResponseData.code === 'string' ||
				typeof typedResponseData.code === 'number'
			) {
				details.code = typedResponseData.code;
			}
			if (
				typeof typedResponseData.error_code === 'string' ||
				typeof typedResponseData.error_code === 'number'
			) {
				details.error_code = typedResponseData.error_code;
			}
			if (
				typeof typedResponseData.status === 'string' ||
				typeof typedResponseData.status === 'number'
			) {
				details.status = typedResponseData.status;
			}
		}
	}

	return {
		success: false,
		error: errorMessage,
		details,
	};
}
