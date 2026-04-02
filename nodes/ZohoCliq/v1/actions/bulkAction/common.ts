import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { parseBooleanLikeTrue, validateNextToken } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObjectWithOptions } from '../shared/responseOutput';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const validConversationFieldSet = new Set([
	'title',
	'chat_id',
	'creation_time',
	'last_modified_time',
	'participant_count',
	'total_message_count',
	'creator_id',
]);
const validChannelFieldSet = new Set([
	'name',
	'channel_id',
	'creation_time',
	'last_modified_time',
	'creator_id',
	'description',
	'participant_count',
	'total_message_count',
	'status',
]);
const validConversationMemberFieldSet = new Set(['name', 'email_id', 'user_id']);
const maintenanceOperationMap = {
	conversations: 'exportConversations',
	conversationMembers: 'exportConversationMembers',
	messages: 'exportMessages',
	channels: 'exportChannels',
} as const;

type MaintenanceOperation = keyof typeof maintenanceOperationMap;

export interface IBulkActionRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

function validateSelectedFields(
	context: IExecuteFunctions,
	selectedFields: string[],
	allowedFields: Set<string>,
	label: string,
	itemIndex: number,
): string {
	if (!Array.isArray(selectedFields) || selectedFields.length === 0) {
		throw new NodeOperationError(context.getNode(), `${label} must include at least one field`, {
			itemIndex,
		});
	}

	const seen = new Set<string>();
	const sanitizedFields = selectedFields.map((field) => String(field).trim()).filter(Boolean);
	if (sanitizedFields.length === 0) {
		throw new NodeOperationError(context.getNode(), `${label} must include at least one field`, {
			itemIndex,
		});
	}

	for (const field of sanitizedFields) {
		if (!allowedFields.has(field)) {
			throw new NodeOperationError(context.getNode(), `Unsupported ${label} value: "${field}"`, {
				itemIndex,
			});
		}

		if (seen.has(field)) {
			throw new NodeOperationError(context.getNode(), `${label} cannot contain duplicate values`, {
				itemIndex,
			});
		}

		seen.add(field);
	}

	return sanitizedFields.join(',');
}

function sanitizeResponseObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (!value || typeof value !== 'object') {
		return;
	}

	if (Array.isArray(value)) {
		for (let idx = 0; idx < value.length; idx++) {
			sanitizeResponseObject(context, value[idx], itemIndex, `${path}[${idx}]`);
		}
		return;
	}

	for (const key of Object.keys(value as Record<string, unknown>)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" found in maintenance export response`,
				{ itemIndex },
			);
		}

		sanitizeResponseObject(
			context,
			(value as Record<string, unknown>)[key],
			itemIndex,
			`${path}.${key}`,
		);
	}
}

export function getMaintenanceRequestHeaders(): Record<string, string> {
	return {
		'Content-Type': 'text/csv',
	};
}

export function getMaintenanceResponseData(
	context: IExecuteFunctions,
	response: unknown,
	itemIndex: number,
): IDataObject {
	const responseObject = coerceApiResponseToObjectWithOptions(response, {
		primitiveKey: 'csv',
	});
	sanitizeResponseObject(context, responseObject, itemIndex, 'response');
	return responseObject;
}

export function getOptionalMaintenanceNextToken(
	context: IExecuteFunctions,
	nextTokenValue: unknown,
	itemIndex: number,
): string | undefined {
	const nextToken = String(nextTokenValue ?? '').trim();
	if (!nextToken) {
		return undefined;
	}

	return validateNextToken(context, nextToken, itemIndex);
}

export function getMaintenanceScope(operation: MaintenanceOperation): string {
	const resolvedOperation = maintenanceOperationMap[operation];

	return getRequiredScopeForOperation('bulkAction', resolvedOperation);
}

export function validateConversationExportFields(
	context: IExecuteFunctions,
	selectedFields: string[],
	itemIndex: number,
): string {
	return validateSelectedFields(
		context,
		selectedFields,
		validConversationFieldSet,
		'Conversation Fields',
		itemIndex,
	);
}

export function validateChannelExportFields(
	context: IExecuteFunctions,
	selectedFields: string[],
	itemIndex: number,
): string {
	return validateSelectedFields(
		context,
		selectedFields,
		validChannelFieldSet,
		'Channel Fields',
		itemIndex,
	);
}

export function validateConversationMemberExportFields(
	context: IExecuteFunctions,
	selectedFields: string[],
	itemIndex: number,
): string {
	return validateSelectedFields(
		context,
		selectedFields,
		validConversationMemberFieldSet,
		'Member Fields',
		itemIndex,
	);
}

export function isBulkActionAiErrorModeEnabled(
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

export function pushBulkActionRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IBulkActionRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isBulkActionAiErrorModeEnabled(context, itemIndex);
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
			resource: 'bulkAction',
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
