/**
 * Utility functions for validation and sanitization
 */

import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { hasRequiredScope } from '../../../../credentials/ZohoCliqOAuth2Api.credentials';
import { buildScopeMissingPayload } from './scopeRegistry';

export const EMOJI_SHORTCODE_REGEX = /^:[a-zA-Z0-9_+-]+:$/;

export function parseScopes(input: unknown): string[] {
	const rawValues: string[] = [];

	if (Array.isArray(input)) {
		for (const entry of input) {
			if (typeof entry === 'string') {
				rawValues.push(entry);
			}
		}
	} else if (typeof input === 'string') {
		rawValues.push(input);
	}

	const parsed = rawValues
		.flatMap((value) => value.split(/[,\s]+/))
		.map((scope) => scope.trim())
		.filter((scope) => scope.length > 0);

	return Array.from(new Set(parsed));
}

function resolveGrantedScopesFromTokenData(oauthTokenData: IDataObject): string[] {
	return Array.from(
		new Set([...parseScopes(oauthTokenData.scope), ...parseScopes(oauthTokenData.scopes)]),
	);
}

/**
 * Parse boolean-like values used in node parameters.
 * Accepts: true, 1, and case-insensitive string tokens: true|1|yes|on.
 */
export function parseBooleanLikeTrue(value: unknown): boolean {
	if (value === true) {
		return true;
	}
	if (typeof value === 'number') {
		return value === 1;
	}
	if (typeof value === 'string') {
		return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
	}
	return false;
}

/**
 * Validate OAuth credentials and scopes
 */
export async function validateCredentials(context: IExecuteFunctions): Promise<string> {
	const credentials = await context.getCredentials('zohoCliqOAuth2Api');
	if (!credentials) {
		throw new NodeOperationError(
			context.getNode(),
			'No credentials configured. Please set up Zoho Cliq OAuth2 credentials.',
		);
	}

	// Validate OAuth token exists
	const oauthTokenData = credentials.oauthTokenData as IDataObject | undefined;
	if (!oauthTokenData) {
		throw new NodeOperationError(
			context.getNode(),
			'OAuth token not found. Please reconnect your Zoho Cliq credentials.',
		);
	}

	const accessToken = oauthTokenData.access_token;
	if (typeof accessToken !== 'string' || accessToken.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'OAuth token not found. Please reconnect your Zoho Cliq credentials.',
		);
	}

	const tokenScopes = resolveGrantedScopesFromTokenData(oauthTokenData);
	if (tokenScopes.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'OAuth token scope data is missing. Reconnect your Zoho Cliq credentials to grant the required scopes.',
		);
	}

	return tokenScopes.join(',');
}

/**
 * Check if required OAuth scope is granted
 */
export function checkRequiredScope(
	context: IExecuteFunctions,
	grantedScopes: string,
	requiredScope: string | string[],
	itemIndex: number,
	options?: {
		caseInsensitive?: boolean;
		disallowedScopes?: string[];
		missingScopeMessage?: string;
		disallowedScopeMessage?: string;
		scopeContext?: {
			resource: string;
			operation: string;
		};
	},
): void {
	const normalizedOptions = options ?? {};
	const caseInsensitive = normalizedOptions.caseInsensitive ?? false;
	const normalize = (value: string) => (caseInsensitive ? value.toLowerCase() : value);
	const grantedScopeList = grantedScopes
		.split(',')
		.map((scope) => scope.trim())
		.filter((scope) => scope.length > 0);
	const grantedScopeSet = new Set(grantedScopeList.map(normalize));
	const disallowedScopes = normalizedOptions.disallowedScopes ?? [];

	for (const disallowedScope of disallowedScopes) {
		if (grantedScopeSet.has(normalize(disallowedScope))) {
			throw new NodeOperationError(
				context.getNode(),
				normalizedOptions.disallowedScopeMessage ??
					`OAuth scope "${disallowedScope}" is not supported for this operation.`,
				{ itemIndex },
			);
		}
	}

	if (Array.isArray(requiredScope)) {
		const requiredScopes = requiredScope
			.map((scope) => scope.trim())
			.filter((scope) => scope.length > 0);
		const hasAllowedScope =
			requiredScopes.length === 1
				? grantedScopeSet.has(normalize(requiredScopes[0]))
				: requiredScopes.some((scope) =>
						hasRequiredScope(grantedScopes, scope, {
							caseInsensitive: normalizedOptions.caseInsensitive === true,
						}),
					);
		if (!hasAllowedScope) {
			const requiredScopeLabel = requiredScopes.join(', ');
			const resource =
				normalizedOptions.scopeContext?.resource ?? resolveResourceName(context, itemIndex);
			const operation =
				normalizedOptions.scopeContext?.operation ?? resolveOperationName(context, itemIndex);
			const payload = buildScopeMissingPayload({
				resource,
				operation,
				requiredScopes,
				missingScopes: requiredScopes,
			});
			const scopeError = new NodeOperationError(
				context.getNode(),
				normalizedOptions.missingScopeMessage ?? `Missing OAuth scope for ${resource}.${operation}`,
				{
					itemIndex,
					description: `Required scopes not currently granted: "${requiredScopeLabel}". Open Zoho Cliq credentials, update Scope Mode / Scope Packs to include the missing scopes, then reconnect.`,
				},
			);
			Object.assign(scopeError as unknown as Record<string, unknown>, {
				zohoCliqScopeErrorPayload: payload,
			});
			throw scopeError;
		}
		return;
	}

	if (
		!hasRequiredScope(grantedScopes, requiredScope, {
			caseInsensitive: normalizedOptions.caseInsensitive === true,
		})
	) {
		const resource =
			normalizedOptions.scopeContext?.resource ?? resolveResourceName(context, itemIndex);
		const operation =
			normalizedOptions.scopeContext?.operation ?? resolveOperationName(context, itemIndex);
		const payload = buildScopeMissingPayload({
			resource,
			operation,
			requiredScopes: [requiredScope],
			missingScopes: [requiredScope],
		});
		const scopeError = new NodeOperationError(
			context.getNode(),
			normalizedOptions.missingScopeMessage ?? `Missing OAuth scope for ${resource}.${operation}`,
			{
				itemIndex,
				description: `Required scope not currently granted: "${requiredScope}". Open Zoho Cliq credentials, update Scope Mode / Scope Packs to include this scope, then reconnect.`,
			},
		);
		Object.assign(scopeError as unknown as Record<string, unknown>, {
			zohoCliqScopeErrorPayload: payload,
		});
		throw scopeError;
	}
}

function resolveResourceName(context: IExecuteFunctions, itemIndex: number): string {
	try {
		const value = context.getNodeParameter('resource', itemIndex);
		return typeof value === 'string' && value.length > 0 ? value : 'unknown';
	} catch {
		return 'unknown';
	}
}

function resolveOperationName(context: IExecuteFunctions, itemIndex: number): string {
	try {
		const value = context.getNodeParameter('operation', itemIndex);
		return typeof value === 'string' && value.length > 0 ? value : 'unknown';
	} catch {
		return 'unknown';
	}
}

/**
 * Extract human-readable text from an API/client error object.
 */
export function extractErrorText(error: unknown): string {
	if (typeof error === 'string') {
		return error;
	}

	if (error && typeof error === 'object') {
		const errorRecord = error as Record<string, unknown>;
		const response = errorRecord.response as Record<string, unknown> | undefined;
		const responseData = response?.data as Record<string, unknown> | undefined;
		const responseBody = response?.body as Record<string, unknown> | undefined;

		return String(
			responseData?.message ??
				responseBody?.message ??
				errorRecord.message ??
				errorRecord.description ??
				'An unexpected issue occurred with the API request',
		);
	}

	return 'An unexpected issue occurred with the API request';
}

/**
 * Validate and sanitize channel ID
 */
export function validateChannelId(
	context: IExecuteFunctions,
	channelId: string,
	itemIndex: number,
): string {
	if (!channelId || !channelId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Channel ID is required', { itemIndex });
	}

	const sanitized = channelId.trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(sanitized) || sanitized.length > 100) {
		throw new NodeOperationError(context.getNode(), 'Invalid Channel ID format', {
			itemIndex,
			description:
				'Provide a Channel ID containing only alphanumeric characters, hyphens, or underscores (max 100 characters).',
		});
	}

	return sanitized;
}

/**
 * Validate and sanitize member ID
 */
export function validateMemberId(
	context: IExecuteFunctions,
	memberId: string,
	itemIndex: number,
): string {
	if (!memberId || !memberId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Member ID is required', { itemIndex });
	}

	const sanitized = memberId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(context.getNode(), 'Member ID is too long', { itemIndex });
	}

	if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Member ID format', {
			itemIndex,
			description:
				'Provide a Member ID containing only alphanumeric characters, hyphens, or underscores.',
		});
	}

	return sanitized;
}

/**
 * Validate and sanitize channel name
 */
export function validateChannelName(
	context: IExecuteFunctions,
	channelName: string,
	itemIndex: number,
): string {
	if (!channelName || !channelName.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Channel Unique Name is required and cannot be empty',
			{ itemIndex },
		);
	}

	const sanitized = channelName.trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid Channel Unique Name format. Only alphanumeric characters, hyphens, and underscores are allowed.',
			{ itemIndex },
		);
	}

	if (sanitized.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			'Channel Unique Name is too long. Maximum length is 100 characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

/**
 * Validate thread ID
 */
export function validateThreadId(
	context: IExecuteFunctions,
	threadId: string,
	itemIndex: number,
): string {
	const sanitized = threadId.trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid Thread ID format. Only alphanumeric characters, hyphens, and underscores are allowed.',
			{ itemIndex },
		);
	}

	if (sanitized.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			'Thread ID is too long. Maximum length is 100 characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

/**
 * Sanitize JSON body with whitelist
 * @returns Sanitized message body object
 */
export function sanitizeJsonBody(
	context: IExecuteFunctions,
	jsonBody: IDataObject,
	itemIndex: number,
): IDataObject {
	// Validate it's a plain object
	if (typeof jsonBody !== 'object' || jsonBody === null || Array.isArray(jsonBody)) {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid jsonBody parameter: must be a plain object',
			{ itemIndex },
		);
	}

	return sanitizeJsonValue(context, jsonBody, itemIndex, 'jsonBody') as IDataObject;
}

function sanitizeJsonValue(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): unknown {
	if (Array.isArray(value)) {
		return value.map((entry, index) =>
			sanitizeJsonValue(context, entry, itemIndex, `${path}[${index}]`),
		);
	}

	if (value && typeof value === 'object') {
		const input = value as IDataObject;
		const sanitized: IDataObject = {};

		for (const key of Object.keys(input)) {
			if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
				throw new NodeOperationError(
					context.getNode(),
					`Invalid field in ${path}: ${key} is not allowed`,
					{ itemIndex },
				);
			}

			sanitized[key] = sanitizeJsonValue(
				context,
				input[key],
				itemIndex,
				`${path}.${key}`,
			) as IDataObject[string];
		}

		return sanitized;
	}

	return value;
}

/**
 * Validate email format
 */
export function validateEmail(
	context: IExecuteFunctions,
	email: string,
	itemIndex: number,
): string {
	const sanitized = email.trim();
	if (
		!/^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/.test(
			sanitized,
		) ||
		sanitized.length > 255
	) {
		throw new NodeOperationError(context.getNode(), `Invalid email format: ${email}`, {
			itemIndex,
			description: 'Provide a valid email address (max 255 characters).',
		});
	}
	return sanitized;
}

/**
 * Normalize a human name to "Sentence case" (first letter uppercase, remaining lowercase)
 */
export function normalizeNameCase(name: string): string {
	const trimmed = name.trim();
	if (!trimmed) {
		return '';
	}

	return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
}

/**
 * Parse and validate comma-separated emails
 */
export function parseEmailList(
	context: IExecuteFunctions,
	emailsStr: string,
	itemIndex: number,
): string[] {
	const emails = emailsStr
		.split(',')
		.map((email) => email.trim())
		.filter((email) => email.length > 0);

	// Validate each email
	for (const email of emails) {
		validateEmail(context, email, itemIndex);
	}

	return emails;
}

/**
 * Type guard to check if value is a valid string
 */
export function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard to check if value is a valid boolean
 */
export function isBoolean(value: unknown): value is boolean {
	return typeof value === 'boolean';
}

/**
 * Type guard to check if value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
	return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

export type ChatIdValidationMode = 'default' | 'chatConversation' | 'directMessage';

/**
 * Validate and sanitize chat ID
 */
export function validateChatId(
	context: IExecuteFunctions,
	chatId: string,
	itemIndex: number,
	options?: {
		mode?: ChatIdValidationMode;
		fieldName?: string;
	},
): string {
	if (!chatId || !chatId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Chat ID is required and cannot be empty', {
			itemIndex,
		});
	}

	const sanitized = chatId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Chat ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Chat ID format', { itemIndex });
	}

	const mode = options?.mode ?? 'default';
	const fieldName = options?.fieldName ?? 'Chat ID';
	if (mode === 'chatConversation' && !/^(?:CT_|[0-9])/.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must start with a number or "CT_". It appears a Channel ID or other non-chat identifier was provided.`,
			{ itemIndex },
		);
	}

	if (mode === 'directMessage' && !/^[0-9]/.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must start with a number because status-based scheduling requires a direct-message Chat ID. Channel and group chat IDs are not supported.`,
			{ itemIndex },
		);
	}

	return sanitized;
}

/**
 * Validate and sanitize message ID
 */
export function validateMessageId(
	context: IExecuteFunctions,
	messageId: string,
	itemIndex: number,
): string {
	if (!messageId || !messageId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Message ID is required and cannot be empty', {
			itemIndex,
		});
	}

	const sanitized = messageId.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Message ID is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	// Allow URL-safe message IDs used by Zoho (commonly include percent-encoding like %20)
	if (!/^[a-zA-Z0-9_%:.-]+$/.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Message ID format', { itemIndex });
	}

	return sanitized;
}

export function encodePathSegmentPreservingEscapes(segment: string): string {
	return encodeURIComponent(segment).replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
}

/**
 * Validate and sanitize emoji code
 * Supports Zomoji format (:name:) and Unicode emojis
 */
export function validateEmojiCode(
	context: IExecuteFunctions,
	emojiCode: string,
	itemIndex: number,
): string {
	if (!emojiCode || !emojiCode.trim()) {
		throw new NodeOperationError(context.getNode(), 'Emoji Code is required', { itemIndex });
	}

	const sanitized = emojiCode.trim();

	// Validate Zomoji format (:name:) or Unicode emoji
	// Zomoji: :alphanumeric_with_underscores:
	// Unicode: Use Unicode emoji property detection
	const isZomoji = EMOJI_SHORTCODE_REGEX.test(sanitized);
	const isUnicodeEmoji = /\p{Extended_Pictographic}/u.test(sanitized);

	if (!isZomoji && !isUnicodeEmoji) {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid Emoji Code format. Use Zomoji format like :smile: or a Unicode emoji',
			{
				itemIndex,
				description:
					'Use a Zoho Cliq Zomoji shortcode (e.g. :thumbsup:) or a string containing a Unicode emoji.',
			},
		);
	}

	if (sanitized.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			'Emoji Code is too long. Maximum length is 100 characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

/**
 * Validate file ID
 */
export function validateFileId(
	context: IExecuteFunctions,
	fileId: string,
	itemIndex: number,
): string {
	if (!fileId || !fileId.trim()) {
		throw new NodeOperationError(context.getNode(), 'File ID is required', { itemIndex });
	}

	const sanitized = fileId.trim();
	if (!/^[a-zA-Z0-9_-]+$/.test(sanitized) || sanitized.length > 200) {
		throw new NodeOperationError(context.getNode(), 'Invalid File ID format', {
			itemIndex,
			description:
				'Provide a File ID containing only alphanumeric characters, hyphens, or underscores (max 200 characters).',
		});
	}

	return sanitized;
}

/**
 * Validate comment ID
 */
export function validateCommentId(
	context: IExecuteFunctions,
	commentId: string,
	itemIndex: number,
): string {
	if (!commentId || !commentId.trim()) {
		throw new NodeOperationError(context.getNode(), 'Comment ID is required', { itemIndex });
	}

	const sanitized = commentId.trim();
	if (!/^[a-zA-Z0-9_:.-]+$/.test(sanitized) || sanitized.length > 200) {
		throw new NodeOperationError(context.getNode(), 'Invalid Comment ID format', { itemIndex });
	}

	return sanitized;
}

/**
 * Validate pagination limit
 */
export function validateLimit(
	context: IExecuteFunctions,
	limitValue: unknown,
	itemIndex: number,
): number {
	const limit = Number(limitValue);
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new NodeOperationError(
			context.getNode(),
			'Limit must be a whole number between 1 and 100',
			{
				itemIndex,
			},
		);
	}

	return limit;
}

/**
 * Validate pagination next token
 */
export function validateNextToken(
	context: IExecuteFunctions,
	nextTokenValue: unknown,
	itemIndex: number,
): string {
	return validateToken(context, nextTokenValue, itemIndex, 'Next Token');
}

/**
 * Validate pagination/sync token
 */
export function validateToken(
	context: IExecuteFunctions,
	tokenValue: unknown,
	itemIndex: number,
	fieldName: string,
): string {
	const token = String(tokenValue).trim();
	if (!token) {
		throw new NodeOperationError(context.getNode(), `${fieldName} cannot be empty`, {
			itemIndex,
		});
	}

	if (token.length > 1024) {
		throw new NodeOperationError(context.getNode(), `${fieldName} is too long`, {
			itemIndex,
		});
	}

	return token;
}

/**
 * Validate schedule time (Unix timestamp in milliseconds)
 */
export function validateScheduleTime(
	context: IExecuteFunctions,
	scheduleTime: number,
	itemIndex: number,
): number {
	if (typeof scheduleTime !== 'number' || isNaN(scheduleTime) || !isFinite(scheduleTime)) {
		throw new NodeOperationError(context.getNode(), 'Schedule Time must be a valid number', {
			itemIndex,
			description:
				'Provide Schedule Time as a Unix timestamp in milliseconds (e.g. 1893456000000).',
		});
	}

	if (scheduleTime < 0) {
		throw new NodeOperationError(context.getNode(), 'Schedule Time must be a positive number', {
			itemIndex,
			description:
				'Provide Schedule Time as a Unix timestamp in milliseconds (e.g. 1893456000000).',
		});
	}

	// Check if schedule time is in the future
	const now = Date.now();
	if (scheduleTime <= now) {
		throw new NodeOperationError(context.getNode(), 'Schedule Time must be in the future', {
			itemIndex,
			description: 'Provide a Unix timestamp in milliseconds that is later than the current time.',
		});
	}

	return scheduleTime;
}

/**
 * Validate schedule status
 */
export function validateScheduleStatus(
	context: IExecuteFunctions,
	status: string,
	itemIndex: number,
): string {
	const validStatuses = ['check_in', 'user_available', 'call_end', 'check_out'];
	const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';
	if (!normalizedStatus || !validStatuses.includes(normalizedStatus)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid Schedule Status. Must be one of: ${validStatuses.join(', ')}`,
			{
				itemIndex,
				description: `Select a valid Schedule Status value: ${validStatuses.join(', ')}.`,
			},
		);
	}
	return normalizedStatus;
}

/**
 * Validate timezone
 */
export function validateTimezone(
	context: IExecuteFunctions,
	timezone: string,
	itemIndex: number,
): string {
	if (!timezone || !timezone.trim()) {
		throw new NodeOperationError(context.getNode(), 'Timezone is required', { itemIndex });
	}

	const sanitized = timezone.trim();
	// Basic validation for timezone format (e.g., "America/New_York", "UTC", "Asia/Kolkata")
	if (!/^[A-Za-z0-9_/:+-]+$/.test(sanitized) || sanitized.length > 100) {
		throw new NodeOperationError(context.getNode(), 'Invalid timezone format', { itemIndex });
	}

	try {
		new Intl.DateTimeFormat('en-US', { timeZone: sanitized });
	} catch {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid timezone. Provide a valid IANA timezone such as America/New_York, Europe/London, or Asia/Kolkata.',
			{ itemIndex },
		);
	}

	return sanitized;
}

/**
 * Validate thread chat ID (same as chat ID but for thread context)
 */
export function validateThreadChatId(
	context: IExecuteFunctions,
	chatId: string,
	itemIndex: number,
): string {
	return validateChatId(context, chatId, itemIndex);
}

/**
 * Validate a single user ID/email/ZUID
 */
export function validateUserId(
	context: IExecuteFunctions,
	userId: string,
	itemIndex: number,
): string {
	if (!userId || !userId.trim()) {
		throw new NodeOperationError(context.getNode(), 'User ID is required', { itemIndex });
	}

	const sanitized = userId.trim();
	if (!/^[a-zA-Z0-9@._-]+$/.test(sanitized) || sanitized.length > 255) {
		throw new NodeOperationError(context.getNode(), 'Invalid User ID format', {
			itemIndex,
			description:
				'Provide a valid Zoho User ID (alphanumeric characters, dots, hyphens, underscores, or @ signs, max 255 characters).',
		});
	}

	return sanitized;
}

/**
 * Validate user ID array
 */
export function validateUserIdArray(
	context: IExecuteFunctions,
	userIds: string | string[],
	itemIndex: number,
): string[] {
	let ids: string[];

	if (typeof userIds === 'string') {
		// Split comma-separated string
		ids = userIds
			.split(',')
			.map((id) => id.trim())
			.filter((id) => id.length > 0);
	} else if (Array.isArray(userIds)) {
		ids = userIds.map((id) => String(id).trim()).filter((id) => id.length > 0);
	} else {
		throw new NodeOperationError(context.getNode(), 'User IDs must be a string or array', {
			itemIndex,
		});
	}

	if (ids.length === 0) {
		throw new NodeOperationError(context.getNode(), 'At least one user ID is required', {
			itemIndex,
		});
	}

	// Validate each ID
	ids.forEach((id) => {
		if (!/^[a-zA-Z0-9@._-]+$/.test(id) || id.length > 255) {
			throw new NodeOperationError(context.getNode(), `Invalid User ID format: ${id}`, {
				itemIndex,
			});
		}
	});

	return ids;
}

/**
 * Validate thread state filter
 */
export function validateThreadStateFilter(
	context: IExecuteFunctions,
	state: string,
	itemIndex: number,
): string {
	const validStates = ['followed', 'not_followed', 'all'];
	if (!state || !validStates.includes(state)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid Thread State. Must be one of: ${validStates.join(', ')}`,
			{
				itemIndex,
				description: `Select a valid State filter value: ${validStates.join(', ')}.`,
			},
		);
	}
	return state;
}

/**
 * Validate thread type filter
 */
export function validateThreadTypeFilter(
	context: IExecuteFunctions,
	type: string,
	itemIndex: number,
): string {
	const validTypes = ['open', 'closed'];
	if (!type || !validTypes.includes(type)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid Thread Type. Must be one of: ${validTypes.join(', ')}`,
			{
				itemIndex,
				description: `Select a valid Type filter value: ${validTypes.join(', ')}.`,
			},
		);
	}
	return type;
}

/**
 * Validate thread action
 */
export function validateThreadAction(
	context: IExecuteFunctions,
	action: string,
	itemIndex: number,
): string {
	const validActions = ['close', 'reopen'];
	if (!action || !validActions.includes(action)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid Thread Action. Must be one of: ${validActions.join(', ')}`,
			{
				itemIndex,
				description: `Select a valid Action value: ${validActions.join(', ')}.`,
			},
		);
	}
	return action;
}
