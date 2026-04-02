import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

export interface IReactionRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function normalizeReactionErrorForOutput(
	_context: IExecuteFunctions,
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IReactionRecoverableErrorOptions = {},
): unknown {
	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		return error;
	}

	if (!error || typeof error !== 'object' || Array.isArray(error)) {
		return error;
	}

	const errorPayload = buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'reaction',
			operation,
		},
		{
			contextFields: options.contextFields,
			fallbackMessage: options.fallbackMessage,
			messageMappings: options.messageMappings,
		},
	);

	const mutableError = error as Record<string, unknown>;
	if (typeof errorPayload.message === 'string' && errorPayload.message.trim()) {
		mutableError.message = errorPayload.message;
	}
	if (typeof errorPayload.reason === 'string' && errorPayload.reason.trim()) {
		mutableError.reason = errorPayload.reason;
	}
	if (typeof errorPayload.hint === 'string' && errorPayload.hint.trim()) {
		mutableError.hint = errorPayload.hint;
		if (typeof mutableError.description !== 'string' || !mutableError.description.trim()) {
			mutableError.description = errorPayload.hint;
		}
	}
	if (
		errorPayload.details &&
		typeof errorPayload.details === 'object' &&
		!Array.isArray(errorPayload.details)
	) {
		mutableError.details = errorPayload.details;
	}
	if (typeof errorPayload.status_code === 'number') {
		mutableError.status_code = errorPayload.status_code;
	}
	if (typeof errorPayload.status_class === 'string') {
		mutableError.status_class = errorPayload.status_class;
	}

	mutableError.itemIndex ??= itemIndex;

	return error;
}

export function isReactionAiErrorModeEnabled(
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

export function pushReactionRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IReactionRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isReactionAiErrorModeEnabled(context, itemIndex);

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
			resource: 'reaction',
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

export function resolveReactionEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
	parameterName = 'includeEnhancedOutput',
	defaultValue = true,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = parseBooleanLikeTrue(
		context.getNodeParameter(parameterName, itemIndex, defaultValue),
	);
	const rawResponse = coerceApiResponseToObject(response);
	const responseJson = { ...rawResponse };

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson,
	};
}
