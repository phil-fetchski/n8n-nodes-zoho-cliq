import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { asDataObject } from '../../helpers/data';
import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import {
	CHAT_LOOKUP_FAILED_ERROR_CODE,
	CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
} from '../shared/preflight';
import { coerceApiResponseToObject } from '../shared/responseOutput';

const CHAT_ONLY_OPERATION_CHANNEL_ID_PREFIXES = new Set(['P', 'O', 'T', 'E']);

export const CHAT_ONLY_OPERATION_CHANNEL_ID_MESSAGE =
	'This operation requires a chat ID, but the provided identifier looks like a channel ID.';

export const CHAT_ONLY_OPERATION_CHANNEL_ID_HINT =
	'Use the channel chat ID instead of the channel ID. Channel IDs can start with P, O, T, or E. Every channel also has its own chat ID, usually starting with CT_, though some valid chat IDs are fully numeric.';
export { CHAT_LOOKUP_FAILED_ERROR_CODE, CHAT_LOOKUP_NOT_FOUND_ERROR_CODE };

export interface IChatRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function isChatAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

export function pushChatRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IChatRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isChatAiErrorModeEnabled(context, itemIndex);
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
			resource: 'chat',
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

export function resolveChatEnhancedOutput(
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

export function looksLikeChannelIdForChatOnlyOperation(chatId: string): boolean {
	const trimmedChatId = chatId.trim();
	if (!trimmedChatId) {
		return false;
	}

	return CHAT_ONLY_OPERATION_CHANNEL_ID_PREFIXES.has(trimmedChatId.charAt(0).toUpperCase());
}

export function isChatLookupNotFoundError(error: unknown): boolean {
	const record = asDataObject(error);
	return record?.code === CHAT_LOOKUP_NOT_FOUND_ERROR_CODE;
}

export function normalizeZohoMessageIdOutput(messageId: string): string {
	return messageId.replace(/%20/gi, '_').replace(/\s+/g, '_');
}

function normalizeStickyMessageObject(object: IDataObject): IDataObject {
	const normalizedObject: IDataObject = { ...object };

	const messageId = normalizedObject.message_id;
	if (typeof messageId === 'string' && messageId.trim()) {
		normalizedObject.message_id = normalizeZohoMessageIdOutput(messageId.trim());
	}

	const unpinnedMessageId = normalizedObject.unpinned_message_id;
	if (typeof unpinnedMessageId === 'string' && unpinnedMessageId.trim()) {
		normalizedObject.unpinned_message_id = normalizeZohoMessageIdOutput(unpinnedMessageId.trim());
	}

	const data = normalizedObject.data;
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return normalizedObject;
	}

	const normalizedData: IDataObject = { ...(data as IDataObject) };
	const dataId = normalizedData.id;
	if (typeof dataId === 'string' && dataId.trim()) {
		normalizedData.id = normalizeZohoMessageIdOutput(dataId.trim());
	}

	const message = normalizedData.message;
	if (!message || typeof message !== 'object' || Array.isArray(message)) {
		normalizedObject.data = normalizedData;
		return normalizedObject;
	}

	const normalizedMessage: IDataObject = { ...(message as IDataObject) };
	const msguid = normalizedMessage.msguid;
	if (typeof msguid === 'string' && msguid.trim()) {
		normalizedMessage.msguid = normalizeZohoMessageIdOutput(msguid.trim());
	}

	const messageObjectId = normalizedMessage.id;
	if (typeof messageObjectId === 'string' && messageObjectId.trim()) {
		normalizedMessage.id = normalizeZohoMessageIdOutput(messageObjectId.trim());
	}

	normalizedData.message = normalizedMessage;
	normalizedObject.data = normalizedData;
	return normalizedObject;
}

export function normalizeStickyMessageResponseOutput<T>(response: T): T {
	if (Array.isArray(response)) {
		return response.map((entry) =>
			entry && typeof entry === 'object' && !Array.isArray(entry)
				? normalizeStickyMessageObject(entry as IDataObject)
				: entry,
		) as T;
	}

	if (response && typeof response === 'object' && !Array.isArray(response)) {
		return normalizeStickyMessageObject(response as IDataObject) as T;
	}

	return response;
}
