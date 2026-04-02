import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

export interface IFilesRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function isFilesAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

export function pushFilesRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IFilesRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isFilesAiErrorModeEnabled(context, itemIndex);

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
			resource: 'files',
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

export function resolveFilesEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = parseBooleanLikeTrue(
		context.getNodeParameter('includeEnhancedOutput', itemIndex, true),
	);
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}
