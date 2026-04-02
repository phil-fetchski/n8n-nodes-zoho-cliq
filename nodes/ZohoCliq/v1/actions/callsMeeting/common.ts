import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const ALLOWED_MEDIA_SESSION_TYPES = new Set([
	'all',
	'handshake',
	'assembly',
	'direct_call',
	'audio_conference',
	'video_conference',
]);

const ALLOWED_HISTORY_FILTERS = new Set([
	'live',
	'viewed',
	'scheduled',
	'missed',
	'received',
	'dialled',
]);

const ALLOWED_PARTICIPANT_FILTERS = new Set(['live', 'invited', 'joined']);

export function validateMediaSessionId(
	context: IExecuteFunctions,
	sessionId: string,
	itemIndex: number,
): string {
	if (!sessionId || !sessionId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Media Session ID is required', { itemIndex });
	}

	const sanitized = sessionId.trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Media Session ID format', {
			itemIndex,
		});
	}

	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Media Session ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateMediaSessionType(
	context: IExecuteFunctions,
	type: string,
	itemIndex: number,
): string {
	const sanitized = type.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Type must not be empty', { itemIndex });
	}

	if (!ALLOWED_MEDIA_SESSION_TYPES.has(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`Type must be one of: ${Array.from(ALLOWED_MEDIA_SESSION_TYPES).join(', ')}`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateMediaSessionTypes(
	context: IExecuteFunctions,
	rawValue: unknown,
	itemIndex: number,
): string | undefined {
	if (rawValue === undefined || rawValue === null) {
		return undefined;
	}

	const values = Array.isArray(rawValue)
		? rawValue.map((value) => String(value).trim()).filter((value) => value.length > 0)
		: String(rawValue)
				.split(',')
				.map((value) => value.trim())
				.filter((value) => value.length > 0);

	if (values.length === 0) {
		return undefined;
	}

	const uniqueValues = Array.from(
		new Set(values.map((value) => validateMediaSessionType(context, value, itemIndex))),
	);

	if (uniqueValues.includes('all') && uniqueValues.length > 1) {
		throw new NodeOperationError(
			context.getNode(),
			'Type "all" cannot be combined with any other type',
			{ itemIndex },
		);
	}

	if (uniqueValues.includes('direct_call') && uniqueValues.length > 1) {
		throw new NodeOperationError(
			context.getNode(),
			'Type "direct_call" cannot be combined with any other type',
			{ itemIndex },
		);
	}

	return uniqueValues.join(',');
}

export function validateHistoryFilter(
	context: IExecuteFunctions,
	filter: string,
	itemIndex: number,
): string {
	const sanitized = filter.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Filter must not be empty', { itemIndex });
	}

	if (!ALLOWED_HISTORY_FILTERS.has(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`Filter must be one of: ${Array.from(ALLOWED_HISTORY_FILTERS).join(', ')}`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateParticipantsFilter(
	context: IExecuteFunctions,
	filter: string,
	itemIndex: number,
): string {
	const sanitized = filter.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Filter must not be empty', { itemIndex });
	}

	if (!ALLOWED_PARTICIPANT_FILTERS.has(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`Filter must be one of: ${Array.from(ALLOWED_PARTICIPANT_FILTERS).join(', ')}`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateTimestampParam(
	context: IExecuteFunctions,
	value: unknown,
	fieldName: string,
	itemIndex: number,
): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a non-negative timestamp in milliseconds`,
			{ itemIndex },
		);
	}

	return parsed;
}

export function validateNumericId(
	context: IExecuteFunctions,
	value: unknown,
	fieldName: string,
	itemIndex: number,
): string {
	const sanitized = String(value).trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, { itemIndex });
	}

	if (!/^\d+$/.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), `${fieldName} must contain only digits`, {
			itemIndex,
		});
	}

	if (sanitized.length > 30) {
		throw new NodeOperationError(context.getNode(), `${fieldName} is too long`, { itemIndex });
	}

	return sanitized;
}

export function validateNumericIdList(
	context: IExecuteFunctions,
	value: unknown,
	fieldName: string,
	itemIndex: number,
): string {
	const parts = String(value)
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	if (parts.length === 0) {
		throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, { itemIndex });
	}

	const unique = Array.from(
		new Set(parts.map((part) => validateNumericId(context, part, fieldName, itemIndex))),
	);

	return unique.join(',');
}

export function validateSearchTerm(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	const sanitized = String(value).trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Search cannot be empty', { itemIndex });
	}

	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Search is too long. Maximum length is 200 characters.',
			{
				itemIndex,
			},
		);
	}

	return sanitized;
}
