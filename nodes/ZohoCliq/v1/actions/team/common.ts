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
import { validateZohoEntityId as sharedValidateZohoEntityId } from '../shared/validation';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const entityIdPattern = /^[a-zA-Z0-9_-]+$/;
const validTeamInputModes = new Set(['structured', 'raw']);
export const TEAM_NAME_MAX_LENGTH = 30;

export { TEAM_NOT_FOUND_HINT, TEAM_NOT_FOUND_MESSAGE } from '../shared/preflight';
export const USER_IDS_NOT_FOUND_MESSAGE =
	'One or more user IDs were not found. The provided user IDs do not exist in this Zoho Cliq organization.';
export const USER_IDS_NOT_FOUND_HINT =
	'Use Get User or List Users to retrieve valid user IDs and try again.';
export const USER_IDS_NOT_TEAM_MEMBERS_MESSAGE =
	'One or more user IDs are not members of this team. The provided user IDs are valid Zoho Cliq users but are not currently members of the specified team.';
export const USER_IDS_NOT_TEAM_MEMBERS_HINT =
	'Use Get Team Members to retrieve the current team roster and retry with only user IDs that are members of this team.';

export const teamIdLocator: INodeProperties = {
	displayName: 'Team',
	name: 'teamId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description:
		'Choose a team from the list, or specify a Team ID using an <a href="https://docs.n8n.io/code/expressions/" target="_blank">expression</a>',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'searchTeams',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g. team_1234567890',
			validation: [
				{
					type: 'regex',
					properties: {
						regex: '^[a-zA-Z0-9_-]+$',
						errorMessage: 'Team ID can only contain letters, numbers, hyphens and underscores',
					},
				},
			],
		},
	],
};

export interface ITeamRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function validateTeamId(
	context: IExecuteFunctions,
	teamId: string,
	itemIndex: number,
): string {
	if (!teamId || !teamId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Team ID is required', { itemIndex });
	}

	const sanitized = teamId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Team ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	if (!entityIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Team ID format', { itemIndex });
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

export function parseTeamPayloadInput(
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

		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
				itemIndex,
			});
		}

		ensureSafeObject(context, parsed, itemIndex, path);
		return parsed as IDataObject;
	}

	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
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

export function validateTeamInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'raw' {
	if (typeof value !== 'string' || !validTeamInputModes.has(value)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be either "structured" or "raw"`,
			{ itemIndex },
		);
	}

	return value as 'structured' | 'raw';
}

export function validateZohoEntityId(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): string {
	return sharedValidateZohoEntityId(context, value, itemIndex, path);
}

export function validateTeamPayload(
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
			throw new NodeOperationError(context.getNode(), 'Team name is required', {
				itemIndex,
			});
		}

		if (name.length > TEAM_NAME_MAX_LENGTH) {
			throw new NodeOperationError(
				context.getNode(),
				`Team name is too long. Maximum length is ${TEAM_NAME_MAX_LENGTH} characters.`,
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

	return payload;
}

export function isTeamAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

export function pushTeamRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: ITeamRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isTeamAiErrorModeEnabled(context, itemIndex);

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
			resource: 'team',
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

export function resolveTeamEnhancedOutput(
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
