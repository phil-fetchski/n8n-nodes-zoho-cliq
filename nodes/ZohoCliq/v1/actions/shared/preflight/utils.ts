import type { NodeOperationError } from 'n8n-workflow';

import { asDataObject } from '../../../helpers/data';

const defaultNotFoundStatusCodes = new Set([400, 404]);

export function getFirstString(value: unknown | unknown[]): string | undefined {
	const values = Array.isArray(value) ? value : [value];

	for (const entry of values) {
		if (typeof entry === 'string' && entry.trim()) {
			return entry.trim();
		}

		if (typeof entry === 'number' || typeof entry === 'bigint') {
			return String(entry);
		}
	}

	return undefined;
}

export function hasNotFoundSignal(
	error: unknown,
	config: {
		messageFragments: string[];
		statusCodes?: ReadonlySet<number>;
	},
): boolean {
	const root = asDataObject(error);
	const response = root ? asDataObject(root.response) : undefined;
	const responseBody = response ? asDataObject(response.body) : undefined;
	const responseData = response ? asDataObject(response.data) : undefined;
	const statusCodes = config.statusCodes ?? defaultNotFoundStatusCodes;

	const rawStatusCodeCandidates = [
		root?.statusCode,
		root?.httpCode,
		response?.status,
		response?.statusCode,
	];
	for (const candidate of rawStatusCodeCandidates) {
		const normalizedCandidate =
			typeof candidate === 'number'
				? candidate
				: typeof candidate === 'string' && candidate.trim()
					? Number(candidate)
					: undefined;
		if (normalizedCandidate !== undefined && Number.isInteger(normalizedCandidate)) {
			if (statusCodes.has(normalizedCandidate)) {
				return true;
			}
		}
	}

	const searchableMessage = getFirstString([
		root?.message,
		root?.error,
		root?.description,
		response?.message,
		response?.error,
		response?.description,
		responseBody?.message,
		responseBody?.error,
		responseBody?.description,
		responseData?.message,
		responseData?.error,
		responseData?.description,
	]);

	if (!searchableMessage) {
		return false;
	}

	const normalizedMessage = searchableMessage.toLowerCase();
	return config.messageFragments.some((fragment) => normalizedMessage.includes(fragment));
}

export function copyLookupErrorMetadata(target: NodeOperationError, source: unknown): void {
	const root = asDataObject(source);
	let originalResponse: unknown = undefined;
	let response: ReturnType<typeof asDataObject> | undefined;
	let rootStatusCode: unknown = undefined;
	let rootHttpCode: unknown = undefined;

	if (root) {
		originalResponse = root.response;
		rootStatusCode = root.statusCode;
		rootHttpCode = root.httpCode;
		if (originalResponse !== undefined) {
			response = asDataObject(originalResponse);
			(target as NodeOperationError & { response?: unknown }).response = originalResponse;
		}
	}

	for (const candidate of [rootStatusCode, rootHttpCode, response?.status, response?.statusCode]) {
		if (typeof candidate === 'number' && Number.isInteger(candidate)) {
			(target as NodeOperationError & { statusCode?: number }).statusCode = candidate;
			return;
		}
	}
}
