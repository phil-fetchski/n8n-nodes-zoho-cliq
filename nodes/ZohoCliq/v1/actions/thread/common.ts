import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { normalizeZohoMessageIdOutput } from '../message/common';
import { coerceApiResponseToObject } from '../shared/responseOutput';

export interface IThreadRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export { THREAD_NOT_FOUND_HINT, THREAD_NOT_FOUND_MESSAGE } from '../shared/preflight';
export const USER_IDS_NOT_FOUND_MESSAGE =
	'One or more supplied user IDs could not be found in Zoho Cliq.';
export const USER_IDS_NOT_FOUND_HINT =
	'Use Get Followers, Get Non Followers, or List Users to source valid Zoho Cliq user IDs before retrying.';

export function extractThreadUserIdsForContext(value: unknown): string[] | undefined {
	if (typeof value === 'string') {
		const parsed = value
			.split(',')
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
		return parsed.length > 0 ? parsed : undefined;
	}

	if (Array.isArray(value)) {
		const parsed = value.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
		return parsed.length > 0 ? parsed : undefined;
	}

	return undefined;
}

export function hasThreadNotFoundCode(error: unknown): boolean {
	return (
		Boolean(error) &&
		typeof error === 'object' &&
		!Array.isArray(error) &&
		(error as Record<string, unknown>).code === 'THREAD_NOT_FOUND'
	);
}

const threadResponseMessageIdKeys = new Set([
	'message_id',
	'thread_message_id',
	'parent_message_id',
	'msguid',
	'lmsguid',
	'unpinned_message_id',
]);

function normalizeThreadResponseMessageId(value: string): string {
	const trimmed = value.trim();
	if (!trimmed) {
		return trimmed;
	}

	let decoded = trimmed;
	if (decoded.includes('%') || decoded.includes('+')) {
		try {
			decoded = decodeURIComponent(decoded.replace(/\+/g, '%20'));
		} catch {
			decoded = trimmed;
		}
	}

	return normalizeZohoMessageIdOutput(decoded);
}

function isThreadMessageObject(value: IDataObject): boolean {
	return (
		'msg' in value ||
		'content' in value ||
		'msguid' in value ||
		'lmsguid' in value ||
		'msgid' in value ||
		'threadmsg' in value ||
		'sequence_id' in value ||
		'thread_message' in value ||
		'thread_information' in value
	);
}

export function normalizeThreadResponseMessageIds<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((entry) => normalizeThreadResponseMessageIds(entry)) as T;
	}

	if (!value || typeof value !== 'object') {
		return value;
	}

	const source = value as IDataObject;
	const normalized: IDataObject = {};

	for (const [key, entryValue] of Object.entries(source)) {
		if (typeof entryValue === 'string') {
			if (threadResponseMessageIdKeys.has(key)) {
				normalized[key] = normalizeThreadResponseMessageId(entryValue);
				continue;
			}

			if (
				key === 'id' &&
				(entryValue.includes('%') || entryValue.includes('+') || /\s/.test(entryValue)) &&
				isThreadMessageObject(source)
			) {
				normalized[key] = normalizeThreadResponseMessageId(entryValue);
				continue;
			}

			normalized[key] = entryValue;
			continue;
		}

		if (Array.isArray(entryValue) || (entryValue && typeof entryValue === 'object')) {
			normalized[key] = normalizeThreadResponseMessageIds(entryValue);
			continue;
		}

		normalized[key] = entryValue;
	}

	return normalized as T;
}

export function isThreadAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

export function pushThreadRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IThreadRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isThreadAiErrorModeEnabled(context, itemIndex);
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
			resource: 'thread',
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

export function resolveThreadEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
	defaultIncludeEnhancedOutput = false,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = Boolean(
		context.getNodeParameter('includeEnhancedOutput', itemIndex, defaultIncludeEnhancedOutput),
	);
	const rawResponse = coerceApiResponseToObject(normalizeThreadResponseMessageIds(response));

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}
