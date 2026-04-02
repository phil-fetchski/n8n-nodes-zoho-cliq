import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

export interface IMessageRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function isMessageAiErrorModeEnabled(
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

export function pushMessageRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IMessageRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isMessageAiErrorModeEnabled(context, itemIndex);
	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		const executionData = context.helpers.constructExecutionMetaData(
			[{ json: { ...(scopePayload as IDataObject) } }],
			{ itemData: { item: itemIndex } },
		);
		returnData.push(...executionData);
		return true;
	}

	const errorPayload = buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'message',
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

export function resolveMessageEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
	parameterName: string,
	defaultValue: boolean,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const rawIncludeEnhancedOutput = context.getNodeParameter(
		parameterName,
		itemIndex,
		defaultValue,
	) as unknown;
	if (rawIncludeEnhancedOutput === undefined || rawIncludeEnhancedOutput === null) {
		const rawResponse = coerceApiResponseToObject(response);
		return {
			includeEnhancedOutput: defaultValue,
			rawResponse,
			responseJson: rawResponse,
		};
	}

	if (typeof rawIncludeEnhancedOutput !== 'boolean') {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid ${parameterName} value: must be a boolean`,
			{ itemIndex },
		);
	}

	const includeEnhancedOutput = rawIncludeEnhancedOutput;
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}

export function normalizeZohoMessageIdOutput(messageId: string): string {
	return messageId.replace(/%20/gi, '_').replace(/\s+/g, '_');
}
