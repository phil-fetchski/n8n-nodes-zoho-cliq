import type { IDataObject } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { isZohoCliqErrorResponse } from '../../helpers/interfaces';

type CliqErrorMappingResolver<T> = (
	normalizedMessage: string,
	message: string,
	error?: unknown,
	statusCode?: number,
) => T;

export interface ICliqErrorMessageMapping {
	hint?: string | CliqErrorMappingResolver<string | undefined>;
	match: (
		normalizedMessage: string,
		message: string,
		error?: unknown,
		statusCode?: number,
	) => boolean;
	messageOverride?: string | CliqErrorMappingResolver<string | undefined>;
	payloadFields?: CliqErrorMappingResolver<IDataObject | undefined>;
	reason: string;
}

export interface ICliqRecoverableErrorContext {
	operation: string;
	resource: string;
}

export interface ICliqRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}

	return value as Record<string, unknown>;
}

const SEARCHABLE_TEXT_KEYS = [
	'message',
	'error',
	'description',
	'details',
	'code',
	'error_code',
	'reason',
];
const NESTED_OBJECT_KEYS = ['response', 'body', 'data', 'error', 'details'];

function appendUniquePart(parts: string[], value: unknown): void {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (trimmed && !parts.includes(trimmed)) {
			parts.push(trimmed);
		}
		return;
	}
	if (typeof value === 'number') {
		const text = String(value);
		if (!parts.includes(text)) {
			parts.push(text);
		}
	}
}

export function extractCliqErrorSearchText(error: unknown): string {
	if (typeof error === 'string') {
		return error.trim();
	}

	const root = asRecord(error);
	if (!root) {
		return '';
	}

	const parts: string[] = [];
	const queue: Array<Record<string, unknown>> = [root];
	const visited = new Set<Record<string, unknown>>();

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current || visited.has(current)) {
			continue;
		}
		visited.add(current);

		for (const key of SEARCHABLE_TEXT_KEYS) {
			appendUniquePart(parts, current[key]);
		}

		for (const key of NESTED_OBJECT_KEYS) {
			const nested = asRecord(current[key]);
			if (nested && !visited.has(nested)) {
				queue.push(nested);
			}
		}
	}

	return parts.join(' ');
}

export function extractCliqErrorMessage(
	error: unknown,
	fallbackMessage = 'An unexpected issue occurred with the API request',
): string {
	if (error instanceof NodeOperationError) {
		const directMessage = error.message.trim();
		return directMessage || fallbackMessage;
	}

	const text = extractCliqErrorSearchText(error).trim();
	return text || fallbackMessage;
}

function resolveStatusCode(error: unknown): number | undefined {
	const root = asRecord(error);
	if (!root) {
		return undefined;
	}

	const directStatusCode = root.statusCode;
	if (typeof directStatusCode === 'number' && Number.isInteger(directStatusCode)) {
		return directStatusCode;
	}

	const directHttpCode = root.httpCode;
	if (typeof directHttpCode === 'number' && Number.isInteger(directHttpCode)) {
		return directHttpCode;
	}

	const response = asRecord(root.response);
	if (!response) {
		return undefined;
	}

	const responseStatusCode = response.statusCode;
	if (typeof responseStatusCode === 'number' && Number.isInteger(responseStatusCode)) {
		return responseStatusCode;
	}

	const responseStatus = response.status;
	if (typeof responseStatus === 'number' && Number.isInteger(responseStatus)) {
		return responseStatus;
	}

	return undefined;
}

function resolveSafeErrorDetails(error: unknown): IDataObject | undefined {
	const root = asRecord(error);
	if (!root) {
		return undefined;
	}

	const details: IDataObject = {};
	const directStatusCode = root.statusCode;
	if (
		typeof directStatusCode === 'number' &&
		Number.isInteger(directStatusCode) &&
		directStatusCode !== 0
	) {
		details.statusCode = directStatusCode;
	}

	const directHttpCode = root.httpCode;
	if (
		details.statusCode === undefined &&
		typeof directHttpCode === 'number' &&
		Number.isInteger(directHttpCode) &&
		directHttpCode !== 0
	) {
		details.statusCode = directHttpCode;
	}

	const response = asRecord(root.response);
	if (!response) {
		return Object.keys(details).length > 0 ? details : undefined;
	}

	const responseStatus = response.status;
	if (
		typeof responseStatus === 'number' &&
		Number.isInteger(responseStatus) &&
		responseStatus !== 0
	) {
		details.statusCode = responseStatus;
	}

	const responseStatusCode = response.statusCode;
	if (
		details.statusCode === undefined &&
		typeof responseStatusCode === 'number' &&
		Number.isInteger(responseStatusCode) &&
		responseStatusCode !== 0
	) {
		details.statusCode = responseStatusCode;
	}

	if (isZohoCliqErrorResponse(response.data)) {
		if (typeof response.data.message === 'string') {
			details.message = response.data.message;
		}
		if (typeof response.data.code === 'string' || typeof response.data.code === 'number') {
			details.code = response.data.code;
		}
		if (
			typeof response.data.error_code === 'string' ||
			typeof response.data.error_code === 'number'
		) {
			details.error_code = response.data.error_code;
		}
		if (typeof response.data.status === 'string' || typeof response.data.status === 'number') {
			details.status = response.data.status;
		}
	}

	return Object.keys(details).length > 0 ? details : undefined;
}

function resolveStatusClass(statusCode: number): '2xx' | '4xx' | '5xx' | 'other' {
	if (statusCode >= 200 && statusCode < 300) {
		return '2xx';
	}
	if (statusCode >= 400 && statusCode < 500) {
		return '4xx';
	}
	if (statusCode >= 500 && statusCode < 600) {
		return '5xx';
	}
	return 'other';
}

function getStatusReasonAndHint(statusCode: number): { hint: string; reason: string } | undefined {
	switch (statusCode) {
		case 400:
			return {
				reason: 'BAD_REQUEST',
				hint: 'Check required parameters, field formats, and request constraints.',
			};
		case 401:
			return {
				reason: 'UNAUTHORIZED',
				hint: 'Reconnect Zoho Cliq credentials and confirm the OAuth token is valid.',
			};
		case 403:
			return {
				reason: 'FORBIDDEN',
				hint: 'Verify account permissions and required OAuth scopes for this operation.',
			};
		case 404:
			return {
				reason: 'NOT_FOUND',
				hint: 'Verify path/resource identifiers and confirm the target resource exists.',
			};
		case 405:
			return {
				reason: 'METHOD_NOT_ALLOWED',
				hint: 'The endpoint does not support this HTTP method.',
			};
		case 406:
			return {
				reason: 'NOT_ACCEPTABLE',
				hint: 'The requested response format is not supported by the endpoint.',
			};
		case 429:
			return {
				reason: 'RATE_LIMITED',
				hint: 'Too many requests in a short period. Retry with backoff.',
			};
		case 500:
			return {
				reason: 'SERVER_ERROR',
				hint: 'Zoho Cliq returned a server error. Retry later.',
			};
		default:
			return undefined;
	}
}

export function buildCliqRecoverableErrorPayload(
	error: unknown,
	context: ICliqRecoverableErrorContext,
	options: ICliqRecoverableErrorOptions = {},
): IDataObject {
	const fallbackMessage =
		options.fallbackMessage ?? 'An unexpected issue occurred with the API request';
	const message = extractCliqErrorMessage(error, fallbackMessage);
	const normalizedMessage = message.toLowerCase();
	const statusCode = resolveStatusCode(error);

	const payload: IDataObject = {
		success: false,
		message,
		resource: context.resource,
		operation: context.operation,
	};

	if (error instanceof NodeOperationError) {
		const operationError = error as NodeOperationError & {
			code?: unknown;
			description?: unknown;
		};
		if (typeof operationError.code === 'string' && operationError.code.trim()) {
			payload.reason = operationError.code.trim();
		}
		if (typeof operationError.description === 'string' && operationError.description.trim()) {
			payload.hint = operationError.description.trim();
		}
	}

	const details = resolveSafeErrorDetails(error);
	if (details) {
		payload.details = details;
	}

	if (options.contextFields) {
		Object.assign(payload, options.contextFields);
	}

	if (typeof statusCode === 'number') {
		payload.status_code = statusCode;
		payload.status_class = resolveStatusClass(statusCode);
		const statusMetadata = getStatusReasonAndHint(statusCode);
		if (statusMetadata) {
			payload.reason = statusMetadata.reason;
			payload.hint = statusMetadata.hint;
		}
	}

	for (const mapping of options.messageMappings ?? []) {
		if (!mapping.match(normalizedMessage, message, error, statusCode)) {
			continue;
		}

		payload.reason = mapping.reason;
		const resolvedHint =
			typeof mapping.hint === 'function'
				? mapping.hint(normalizedMessage, message, error, statusCode)
				: mapping.hint;
		if (resolvedHint) {
			payload.hint = resolvedHint;
		}
		const resolvedMessageOverride =
			typeof mapping.messageOverride === 'function'
				? mapping.messageOverride(normalizedMessage, message, error, statusCode)
				: mapping.messageOverride;
		if (resolvedMessageOverride) {
			payload.message = resolvedMessageOverride;
		}
		const resolvedPayloadFields = mapping.payloadFields?.(
			normalizedMessage,
			message,
			error,
			statusCode,
		);
		if (resolvedPayloadFields) {
			Object.assign(payload, resolvedPayloadFields);
		}
		break;
	}

	return payload;
}
