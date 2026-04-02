import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseBooleanLikeTrue, validateEmail } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const supportedPayloadKeys = new Set(['name', 'email_id', 'cname_status']);
const allowedStatuses = new Set(['verified', 'not_verified']);

export interface ICustomEmailRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function extractCustomEmailIdFromResponse(response: unknown): string | undefined {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return undefined;
	}

	const responseObject = response as IDataObject;
	const directEmailId = responseObject.email_id;
	if (typeof directEmailId === 'string' && directEmailId.trim()) {
		return directEmailId.trim();
	}

	const data = responseObject.data;
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return undefined;
	}

	const nestedEmailId = (data as IDataObject).email_id;
	if (typeof nestedEmailId === 'string' && nestedEmailId.trim()) {
		return nestedEmailId.trim();
	}

	return undefined;
}

export function appendCustomEmailWarningsToResponse(
	response: unknown,
	warnings: IDataObject[],
): IDataObject {
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

export function validateCustomEmailCnameStatus(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): 'verified' | 'not_verified' {
	const rawCnameStatus = String(value ?? '')
		.trim()
		.toLowerCase();
	const cnameStatus = rawCnameStatus === 'unverified' ? 'not_verified' : rawCnameStatus;

	if (!cnameStatus) {
		throw new NodeOperationError(context.getNode(), 'Custom Email cname_status is required', {
			itemIndex,
		});
	}

	if (!allowedStatuses.has(cnameStatus)) {
		throw new NodeOperationError(
			context.getNode(),
			`Custom Email cname_status must be one of: ${Array.from(allowedStatuses).join(', ')}`,
			{ itemIndex },
		);
	}

	return cnameStatus as 'verified' | 'not_verified';
}

export function validateCustomEmailPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
): IDataObject {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new NodeOperationError(context.getNode(), 'Custom Email Payload must be a JSON object', {
			itemIndex,
		});
	}

	for (const key of Object.keys(payload)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in Custom Email Payload`,
				{ itemIndex },
			);
		}

		if (!supportedPayloadKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Custom Email Payload contains unsupported field "${key}". Allowed fields: ${Array.from(
					supportedPayloadKeys,
				).join(', ')}`,
				{ itemIndex },
			);
		}
	}

	const name = String(payload.name ?? '').trim();
	if (!name) {
		throw new NodeOperationError(context.getNode(), 'Custom Email name is required', { itemIndex });
	}
	if (name.length > 120) {
		throw new NodeOperationError(
			context.getNode(),
			'Custom Email name is too long. Maximum length is 120 characters.',
			{ itemIndex },
		);
	}

	const emailId = String(payload.email_id ?? '').trim();
	if (!emailId) {
		throw new NodeOperationError(context.getNode(), 'Custom Email email_id is required', {
			itemIndex,
		});
	}

	return {
		name,
		email_id: validateEmail(context, emailId, itemIndex),
		cname_status: validateCustomEmailCnameStatus(context, payload.cname_status, itemIndex),
	};
}

export function isCustomEmailAiErrorModeEnabled(
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

export function pushCustomEmailRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: ICustomEmailRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isCustomEmailAiErrorModeEnabled(context, itemIndex);

	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		const mergedPayload: IDataObject = {
			...(options.contextFields ?? {}),
			...(scopePayload as IDataObject),
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
			resource: 'customEmail',
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
