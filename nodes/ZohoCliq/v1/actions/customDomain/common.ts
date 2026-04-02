import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const validCustomDomainStatuses = new Set(['active', 'inactive']);
const validCustomDomainInputModes = new Set(['structured', 'raw']);
const domainPattern =
	/^(?=.{1,255}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$/;

export interface ICustomDomainRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function validateDomainName(
	context: IExecuteFunctions,
	domain: string,
	itemIndex: number,
): string {
	const sanitized = domain?.trim().toLowerCase();

	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Custom Domain is required', { itemIndex });
	}

	if (!domainPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Custom Domain format', {
			itemIndex,
		});
	}

	return sanitized;
}

function ensureSafeObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	for (const key of Object.keys(value as IDataObject)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{
					itemIndex,
				},
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

export function parseCustomDomainPayloadInput(
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

export function validateCustomDomainAddPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
): IDataObject {
	ensureSafeObject(context, payload, itemIndex, 'Custom Domain Payload');

	for (const key of Object.keys(payload)) {
		if (!['name', 'customdomain_domain', 'domain'].includes(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Custom Domain Payload contains unsupported field "${key}". Allowed fields: name, customdomain_domain, domain`,
				{ itemIndex },
			);
		}
	}

	const rawDomain = String(
		payload.name ?? payload.customdomain_domain ?? payload.domain ?? '',
	).trim();
	const name = validateDomainName(context, rawDomain, itemIndex);

	return {
		name,
	};
}

export function validateCustomDomainStatus(
	context: IExecuteFunctions,
	status: unknown,
	itemIndex: number,
): 'active' | 'inactive' {
	if (typeof status !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			'Status must be either "active" or "inactive"',
			{ itemIndex },
		);
	}

	const normalized = status.trim().toLowerCase();
	if (!validCustomDomainStatuses.has(normalized)) {
		throw new NodeOperationError(
			context.getNode(),
			'Status must be either "active" or "inactive"',
			{ itemIndex },
		);
	}

	return normalized as 'active' | 'inactive';
}

export function validateCustomDomainInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'raw' {
	if (typeof value !== 'string' || !validCustomDomainInputModes.has(value)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be either "structured" or "raw"`,
			{ itemIndex },
		);
	}

	return value as 'structured' | 'raw';
}

export function validateCustomDomainVerifyPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
): IDataObject {
	ensureSafeObject(context, payload, itemIndex, 'Custom Domain Payload');

	for (const key of Object.keys(payload)) {
		if (key !== 'status') {
			throw new NodeOperationError(
				context.getNode(),
				`Custom Domain Payload contains unsupported field "${key}". Allowed fields: status`,
				{ itemIndex },
			);
		}
	}

	return {
		status: validateCustomDomainStatus(context, payload.status, itemIndex),
	};
}

export function isCustomDomainAiErrorModeEnabled(
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

export function pushCustomDomainRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: ICustomDomainRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isCustomDomainAiErrorModeEnabled(context, itemIndex);

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
			resource: 'customDomain',
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

export function resolveCustomDomainEnhancedOutput(
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
