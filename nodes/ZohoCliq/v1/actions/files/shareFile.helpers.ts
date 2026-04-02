import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	validateChannelId,
	validateChannelName,
	validateChatId,
	validateEmail,
	validateUserId,
	validateUserIdArray,
} from '../../helpers/utils';

export type ShareTarget = 'chat' | 'channelId' | 'channelUniqueName' | 'bot' | 'buddy';
export type ShareTargetSelection = ShareTarget | 'agentChoice';
export type FileInputMode = 'mapped' | 'raw';
export type BuddyIdentifierType = 'email' | 'userId';

export interface IFileEntry {
	binaryProperty?: string;
	binaryHandleId?: string;
	comment?: string;
}

const MAX_FILE_COUNT = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const botUniqueNamePattern = /^[a-zA-Z0-9_-]+$/;
const mimeTypePattern = /^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/;
const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const validShareTargets = new Set<ShareTarget>([
	'chat',
	'channelId',
	'channelUniqueName',
	'bot',
	'buddy',
]);
const validShareTargetSelections = new Set<ShareTargetSelection>([
	'chat',
	'channelId',
	'channelUniqueName',
	'bot',
	'buddy',
	'agentChoice',
]);
const validFileInputModes = new Set<FileInputMode>(['mapped', 'raw']);
const validBuddyIdentifierTypes = new Set<BuddyIdentifierType>(['email', 'userId']);

export interface IResolvedShareTargetConfig {
	shareTarget: ShareTarget;
	endpoint: string;
	targetIdentifier: string;
}

export function isChannelTarget(target: ShareTarget): boolean {
	return target === 'channelId' || target === 'channelUniqueName';
}

export function validateShareTarget(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): ShareTarget {
	if (typeof value !== 'string') {
		throw new NodeOperationError(context.getNode(), 'Share Target is required', { itemIndex });
	}

	const sanitized = value.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Share Target is required', { itemIndex });
	}

	if (!validShareTargets.has(sanitized as ShareTarget)) {
		throw new NodeOperationError(
			context.getNode(),
			'Share Target must be one of: "chat", "channelId", "channelUniqueName", "bot", "buddy".',
			{ itemIndex },
		);
	}

	return sanitized as ShareTarget;
}

export function validateShareTargetSelection(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): ShareTargetSelection {
	if (typeof value !== 'string') {
		throw new NodeOperationError(context.getNode(), 'Share Target is required', { itemIndex });
	}

	const sanitized = value.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Share Target is required', { itemIndex });
	}

	if (!validShareTargetSelections.has(sanitized as ShareTargetSelection)) {
		throw new NodeOperationError(
			context.getNode(),
			'Share Target must be one of: "chat", "channelId", "channelUniqueName", "bot", "buddy", "agentChoice".',
			{ itemIndex },
		);
	}

	return sanitized as ShareTargetSelection;
}

export function validateFileInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): FileInputMode {
	if (typeof value !== 'string' || !validFileInputModes.has(value as FileInputMode)) {
		throw new NodeOperationError(
			context.getNode(),
			'File Input Mode must be either "mapped" or "raw".',
			{ itemIndex },
		);
	}

	return value as FileInputMode;
}

export function validateBuddyIdentifierType(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): BuddyIdentifierType {
	if (typeof value !== 'string' || !validBuddyIdentifierTypes.has(value as BuddyIdentifierType)) {
		throw new NodeOperationError(
			context.getNode(),
			'User Identifier Type must be either "userId" or "email".',
			{ itemIndex },
		);
	}

	return value as BuddyIdentifierType;
}

export function validateBotUniqueName(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
	fieldName: string,
): string {
	const sanitized = value.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), `${fieldName} is required`, { itemIndex });
	}

	if (!botUniqueNamePattern.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} has an invalid format. Use letters, numbers, hyphens, and underscores.`,
			{ itemIndex },
		);
	}

	if (sanitized.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is too long. Maximum length is 100 characters.`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateOptionalBotDisplayName(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
): string | undefined {
	const sanitized = value.trim();
	if (!sanitized) {
		return undefined;
	}

	if (sanitized.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Display Name is too long. Maximum length is 100 characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateOptionalImageUrl(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
): string | undefined {
	const sanitized = value.trim();
	if (!sanitized) {
		return undefined;
	}

	let parsed: URL;
	try {
		parsed = new URL(sanitized);
	} catch {
		throw new NodeOperationError(context.getNode(), 'Bot Image URL must be a valid URL', {
			itemIndex,
		});
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new NodeOperationError(context.getNode(), 'Bot Image URL must use HTTP or HTTPS', {
			itemIndex,
		});
	}

	if (sanitized.length > 500) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Image URL is too long. Maximum length is 500 characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

function sanitizeMimeType(value: unknown): string {
	if (typeof value !== 'string') {
		return 'application/octet-stream';
	}

	const candidate = value.trim();
	if (!candidate) {
		return 'application/octet-stream';
	}

	if (/[\r\n]/.test(candidate) || hasControlCharacters(candidate)) {
		return 'application/octet-stream';
	}

	return mimeTypePattern.test(candidate) ? candidate : 'application/octet-stream';
}

function hasControlCharacters(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i);
		if (code <= 31 || code === 127) {
			return true;
		}
	}

	return false;
}

function normalizeComment(
	context: IExecuteFunctions,
	comment: unknown,
	itemIndex: number,
	path: string,
): string | undefined {
	if (comment === undefined || comment === null) {
		return undefined;
	}

	const sanitizedComment = String(comment).trim();
	if (!sanitizedComment) {
		return undefined;
	}

	if (sanitizedComment.length > 1000) {
		throw new NodeOperationError(context.getNode(), `${path} must be 1000 characters or fewer.`, {
			itemIndex,
		});
	}

	return sanitizedComment;
}

function validateBinaryHandleId(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): string {
	if (value === undefined || value === null) {
		return '';
	}

	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must be a string opaque binary handle returned by Files/Get File.`,
			{ itemIndex },
		);
	}

	const sanitized = value.trim();
	if (!sanitized) {
		return '';
	}

	if (sanitized.length > 1024) {
		throw new NodeOperationError(context.getNode(), `${path} is too long.`, {
			itemIndex,
		});
	}

	if (/[\r\n]/.test(sanitized) || hasControlCharacters(sanitized)) {
		throw new NodeOperationError(context.getNode(), `${path} contains invalid characters.`, {
			itemIndex,
		});
	}

	return sanitized;
}

function ensureSafePlainObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	const objectValue = value as IDataObject;
	for (const key of Object.keys(objectValue)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{ itemIndex },
			);
		}
	}

	return objectValue;
}

function parseRawFileEntriesInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): unknown[] {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new NodeOperationError(
				context.getNode(),
				'File Entries (JSON) cannot be empty. Provide a JSON array.',
				{ itemIndex },
			);
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				'File Entries (JSON) must be valid JSON when provided as text.',
				{ itemIndex },
			);
		}

		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				context.getNode(),
				'File Entries (JSON) must be an array of objects.',
				{ itemIndex },
			);
		}
		return parsed;
	}

	if (!Array.isArray(value)) {
		throw new NodeOperationError(
			context.getNode(),
			'File Entries (JSON) must be an array of objects.',
			{ itemIndex },
		);
	}

	return value;
}

function normalizeFileEntries(
	context: IExecuteFunctions,
	entries: unknown[],
	itemIndex: number,
	path: string,
	options: {
		allowBinaryHandleId: boolean;
		ignoreEmptyEntries: boolean;
	},
): IFileEntry[] {
	if (entries.length > MAX_FILE_COUNT) {
		throw new NodeOperationError(
			context.getNode(),
			`You can upload at most ${MAX_FILE_COUNT} files per request.`,
			{ itemIndex },
		);
	}

	const normalizedEntries: IFileEntry[] = [];
	for (let idx = 0; idx < entries.length; idx++) {
		const objectValue = ensureSafePlainObject(context, entries[idx], itemIndex, `${path}[${idx}]`);
		const allowedKeys = new Set([
			'binaryProperty',
			...(options.allowBinaryHandleId ? ['binaryHandleId'] : []),
			'comment',
		]);
		for (const key of Object.keys(objectValue)) {
			if (!allowedKeys.has(key)) {
				throw new NodeOperationError(
					context.getNode(),
					`${path}[${idx}] has unsupported field "${key}". Allowed fields: ${options.allowBinaryHandleId ? 'binaryProperty, binaryHandleId, comment' : 'binaryProperty, comment'}`,
					{ itemIndex },
				);
			}
		}

		const binaryPropertyValue = objectValue.binaryProperty;
		if (
			binaryPropertyValue !== undefined &&
			binaryPropertyValue !== null &&
			typeof binaryPropertyValue !== 'string'
		) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}[${idx}].binaryProperty must be a string property name (for example, "data"), not a binary object.`,
				{ itemIndex },
			);
		}

		const binaryProperty = String(binaryPropertyValue ?? '').trim();
		const binaryHandleId = options.allowBinaryHandleId
			? validateBinaryHandleId(
					context,
					objectValue.binaryHandleId,
					itemIndex,
					`${path}[${idx}].binaryHandleId`,
				)
			: '';
		const comment = normalizeComment(
			context,
			objectValue.comment,
			itemIndex,
			`${path}[${idx}].comment`,
		);

		if (binaryProperty && binaryHandleId) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}[${idx}] must include exactly one of binaryProperty or binaryHandleId, not both.`,
				{ itemIndex },
			);
		}

		if (!binaryProperty && !binaryHandleId) {
			if (options.ignoreEmptyEntries && !comment) {
				continue;
			}

			if (comment) {
				throw new NodeOperationError(
					context.getNode(),
					options.allowBinaryHandleId
						? `${path}[${idx}] must include either binaryProperty or binaryHandleId when comment is provided.`
						: `${path}[${idx}].binaryProperty is required when comment is provided.`,
					{ itemIndex },
				);
			}

			throw new NodeOperationError(
				context.getNode(),
				`${path}[${idx}] must include exactly one of binaryProperty or binaryHandleId.`,
				{ itemIndex },
			);
		}

		normalizedEntries.push({
			...(binaryProperty ? { binaryProperty } : {}),
			...(binaryHandleId ? { binaryHandleId } : {}),
			...(comment ? { comment } : {}),
		});
	}

	if (normalizedEntries.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			options.allowBinaryHandleId
				? 'Provide at least one file entry with a non-empty Binary Property or Binary Handle ID.'
				: 'Provide at least one file entry with a non-empty Binary Property.',
			{ itemIndex },
		);
	}

	const seen = new Set<string>();
	for (const entry of normalizedEntries) {
		if (entry.binaryProperty) {
			const duplicateKey = `binaryProperty:${entry.binaryProperty}`;
			if (seen.has(duplicateKey)) {
				throw new NodeOperationError(
					context.getNode(),
					`Duplicate Binary Property "${entry.binaryProperty}" is not allowed.`,
					{ itemIndex },
				);
			}
			seen.add(duplicateKey);
		}

		if (entry.binaryHandleId) {
			const duplicateKey = `binaryHandleId:${entry.binaryHandleId}`;
			if (seen.has(duplicateKey)) {
				throw new NodeOperationError(
					context.getNode(),
					`Duplicate Binary Handle ID "${entry.binaryHandleId}" is not allowed.`,
					{ itemIndex },
				);
			}
			seen.add(duplicateKey);
		}
	}

	return normalizedEntries;
}

export function parseMappedFileEntries(
	context: IExecuteFunctions,
	value: IDataObject,
	itemIndex: number,
): IFileEntry[] {
	const maybeEntries = value.fileEntry;
	const entries = Array.isArray(maybeEntries) ? maybeEntries : [];
	return normalizeFileEntries(context, entries, itemIndex, 'File Entries', {
		allowBinaryHandleId: false,
		ignoreEmptyEntries: true,
	});
}

export function parseRawFileEntries(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IFileEntry[] {
	const entries = parseRawFileEntriesInput(context, value, itemIndex);
	return normalizeFileEntries(context, entries, itemIndex, 'File Entries (JSON)', {
		allowBinaryHandleId: true,
		ignoreEmptyEntries: false,
	});
}

export function buildBinaryPropertiesAndComments(entries: IFileEntry[]): {
	binaryProperties: string[];
	comments: string[];
} {
	const binaryProperties = entries.flatMap((entry) =>
		entry.binaryProperty ? [entry.binaryProperty] : [],
	);
	const hasAnyComment = entries.some((entry) => Boolean(entry.comment));
	const comments = hasAnyComment ? entries.map((entry) => entry.comment ?? '') : [];
	return { binaryProperties, comments };
}

export function getBinaryHandleIds(entries: IFileEntry[]): string[] {
	return entries.flatMap((entry) => (entry.binaryHandleId ? [entry.binaryHandleId] : []));
}

export function resolveShareEndpoint(
	context: IExecuteFunctions,
	itemIndex: number,
	target: ShareTarget,
): string {
	if (target === 'chat') {
		const chatId = context.getNodeParameter('chatId', itemIndex) as string;
		const sanitizedChatId = validateChatId(context, chatId, itemIndex);
		return `/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/files`;
	}

	if (target === 'channelId') {
		const channelId = context.getNodeParameter('channelId', itemIndex, '', {
			extractValue: true,
		}) as string;
		const sanitizedChannelId = validateChannelId(context, channelId, itemIndex);
		return `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/files`;
	}

	if (target === 'channelUniqueName') {
		const channelUniqueName = context.getNodeParameter('channelUniqueName', itemIndex) as string;
		const sanitizedChannelUniqueName = validateChannelName(context, channelUniqueName, itemIndex);
		return `/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelUniqueName)}/files`;
	}

	if (target === 'bot') {
		const sanitizedBotUniqueName = validateConfiguredBotUniqueName(
			context,
			itemIndex,
			'Bot Unique Name',
		);
		return `/api/v2/bots/${encodeURIComponent(sanitizedBotUniqueName)}/files`;
	}

	const buddyIdentifierType = validateBuddyIdentifierType(
		context,
		context.getNodeParameter('buddyIdentifierType', itemIndex),
		itemIndex,
	);
	if (buddyIdentifierType === 'email') {
		const buddyEmail = context.getNodeParameter('buddyEmail', itemIndex) as string;
		const sanitizedEmail = validateEmail(context, buddyEmail, itemIndex);
		return `/api/v2/buddies/${encodeURIComponent(sanitizedEmail)}/files`;
	}

	const buddyUserId = context.getNodeParameter('buddyUserId', itemIndex) as string;
	const sanitizedUserId = validateUserId(context, buddyUserId, itemIndex);
	return `/api/v2/buddies/${encodeURIComponent(sanitizedUserId)}/files`;
}

function getOptionalTrimmedString(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	const sanitized = String(value).trim();
	return sanitized ? sanitized : undefined;
}

function isTrueLike(value: unknown): boolean {
	return value === true || value === 'true' || value === 1 || value === '1';
}

export function validateConfiguredBotUniqueName(
	context: IExecuteFunctions,
	itemIndex: number,
	fieldName: string,
	parameterName = 'botUniqueName',
): string {
	return validateBotUniqueName(
		context,
		(context.getNodeParameter(parameterName, itemIndex, '') as string) ?? '',
		itemIndex,
		fieldName,
	);
}

function validateAgentChoiceSelectedShareTarget(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): ShareTarget {
	const sanitized = getOptionalTrimmedString(value);
	if (!sanitized) {
		throw new NodeOperationError(
			context.getNode(),
			'Agent Selected Share Target is required when Share Target is set to "Agent\'s Choice".',
			{ itemIndex },
		);
	}

	if (!validShareTargets.has(sanitized as ShareTarget)) {
		throw new NodeOperationError(
			context.getNode(),
			'Agent Selected Share Target must be one of: "chat", "channelId", "channelUniqueName", "bot", "buddy".',
			{ itemIndex },
		);
	}

	return sanitized as ShareTarget;
}

function validateAgentChoiceFieldSet(
	context: IExecuteFunctions,
	itemIndex: number,
	selectedTarget: ShareTarget,
	providedFields: Array<{ fieldName: string; displayName: string }>,
	allowedFieldNames: string[],
): void {
	const unexpectedFields = providedFields.filter(
		(field) => !allowedFieldNames.includes(field.fieldName),
	);

	if (unexpectedFields.length === 0) {
		return;
	}

	const unexpectedNames = unexpectedFields.map((field) => `"${field.displayName}"`).join(', ');
	throw new NodeOperationError(
		context.getNode(),
		`When Agent Selected Share Target is "${selectedTarget}", only the matching target identifier field(s) may be provided. Clear ${unexpectedNames}.`,
		{ itemIndex },
	);
}

function resolveAgentChoiceShareTarget(
	context: IExecuteFunctions,
	itemIndex: number,
): IResolvedShareTargetConfig {
	const selectedTarget = validateAgentChoiceSelectedShareTarget(
		context,
		context.getNodeParameter('agentSelectedShareTarget', itemIndex, ''),
		itemIndex,
	);
	const channelId = getOptionalTrimmedString(
		context.getNodeParameter('agentChannelId', itemIndex, ''),
	);
	const channelUniqueName = getOptionalTrimmedString(
		context.getNodeParameter('agentChannelUniqueName', itemIndex, ''),
	);
	const chatId = getOptionalTrimmedString(context.getNodeParameter('agentChatId', itemIndex, ''));
	const botUniqueName = getOptionalTrimmedString(
		context.getNodeParameter('agentBotUniqueName', itemIndex, ''),
	);
	const postAsBot = isTrueLike(context.getNodeParameter('agentPostAsBot', itemIndex, false));
	const userId = getOptionalTrimmedString(
		context.getNodeParameter('agentBuddyUserId', itemIndex, ''),
	);
	const userEmail = getOptionalTrimmedString(
		context.getNodeParameter('agentBuddyEmail', itemIndex, ''),
	);

	const providedFields = [
		...(channelId ? [{ fieldName: 'agentChannelId', displayName: 'Channel ID' }] : []),
		...(channelUniqueName
			? [{ fieldName: 'agentChannelUniqueName', displayName: 'Channel Unique Name' }]
			: []),
		...(chatId ? [{ fieldName: 'agentChatId', displayName: 'Chat ID' }] : []),
		...(botUniqueName ? [{ fieldName: 'agentBotUniqueName', displayName: 'Bot Unique Name' }] : []),
		...(userId ? [{ fieldName: 'agentBuddyUserId', displayName: 'User ID' }] : []),
		...(userEmail ? [{ fieldName: 'agentBuddyEmail', displayName: 'User Email' }] : []),
	];

	if (selectedTarget === 'chat') {
		validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
			'agentChatId',
		]);
		if (!chatId) {
			throw new NodeOperationError(
				context.getNode(),
				'Chat ID is required when Agent Selected Share Target is "chat".',
				{ itemIndex },
			);
		}

		const sanitizedChatId = validateChatId(context, chatId, itemIndex);
		return {
			shareTarget: 'chat',
			endpoint: `/api/v2/chats/${encodeURIComponent(sanitizedChatId)}/files`,
			targetIdentifier: sanitizedChatId,
		};
	}

	if (selectedTarget === 'channelId') {
		validateAgentChoiceFieldSet(
			context,
			itemIndex,
			selectedTarget,
			providedFields,
			postAsBot ? ['agentChannelId', 'agentBotUniqueName'] : ['agentChannelId'],
		);
		if (!channelId) {
			throw new NodeOperationError(
				context.getNode(),
				'Channel ID is required when Agent Selected Share Target is "channelId".',
				{ itemIndex },
			);
		}

		const sanitizedChannelId = validateChannelId(context, channelId, itemIndex);
		return {
			shareTarget: 'channelId',
			endpoint: `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/files`,
			targetIdentifier: sanitizedChannelId,
		};
	}

	if (selectedTarget === 'channelUniqueName') {
		validateAgentChoiceFieldSet(
			context,
			itemIndex,
			selectedTarget,
			providedFields,
			postAsBot ? ['agentChannelUniqueName', 'agentBotUniqueName'] : ['agentChannelUniqueName'],
		);
		if (!channelUniqueName) {
			throw new NodeOperationError(
				context.getNode(),
				'Channel Unique Name is required when Agent Selected Share Target is "channelUniqueName".',
				{ itemIndex },
			);
		}

		const sanitizedChannelUniqueName = validateChannelName(context, channelUniqueName, itemIndex);
		return {
			shareTarget: 'channelUniqueName',
			endpoint: `/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelUniqueName)}/files`,
			targetIdentifier: sanitizedChannelUniqueName,
		};
	}

	if (selectedTarget === 'bot') {
		validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
			'agentBotUniqueName',
		]);
		const sanitizedBotUniqueName = validateConfiguredBotUniqueName(
			context,
			itemIndex,
			'Bot Unique Name',
			'agentBotUniqueName',
		);
		return {
			shareTarget: 'bot',
			endpoint: `/api/v2/bots/${encodeURIComponent(sanitizedBotUniqueName)}/files`,
			targetIdentifier: sanitizedBotUniqueName,
		};
	}

	validateAgentChoiceFieldSet(context, itemIndex, selectedTarget, providedFields, [
		'agentBuddyUserId',
		'agentBuddyEmail',
	]);

	if (userId && userEmail) {
		throw new NodeOperationError(
			context.getNode(),
			'When Agent Selected Share Target is "buddy", provide either User ID or User Email, not both.',
			{ itemIndex },
		);
	}

	if (!userId && !userEmail) {
		throw new NodeOperationError(
			context.getNode(),
			'When Agent Selected Share Target is "buddy", provide either User ID or User Email.',
			{ itemIndex },
		);
	}

	if (userEmail) {
		const sanitizedEmail = validateEmail(context, userEmail, itemIndex);
		return {
			shareTarget: 'buddy',
			endpoint: `/api/v2/buddies/${encodeURIComponent(sanitizedEmail)}/files`,
			targetIdentifier: sanitizedEmail,
		};
	}

	const sanitizedUserId = validateUserId(context, userId as string, itemIndex);
	return {
		shareTarget: 'buddy',
		endpoint: `/api/v2/buddies/${encodeURIComponent(sanitizedUserId)}/files`,
		targetIdentifier: sanitizedUserId,
	};
}

export function resolveConfiguredShareTarget(
	context: IExecuteFunctions,
	itemIndex: number,
	targetSelection: ShareTargetSelection,
): IResolvedShareTargetConfig {
	if (targetSelection === 'agentChoice') {
		return resolveAgentChoiceShareTarget(context, itemIndex);
	}

	return {
		shareTarget: targetSelection,
		endpoint: resolveShareEndpoint(context, itemIndex, targetSelection),
		targetIdentifier: resolveShareTargetIdentifier(context, itemIndex, targetSelection),
	};
}

function appendMultipartField(
	parts: Buffer[],
	boundary: string,
	name: string,
	value: string,
): void {
	parts.push(Buffer.from(`--${boundary}\r\n`, 'utf8'));
	parts.push(Buffer.from(`Content-Disposition: form-data; name="${name}"\r\n\r\n`, 'utf8'));
	parts.push(Buffer.from(`${value}\r\n`, 'utf8'));
}

function sanitizeUploadFileName(value: string): string {
	return value
		.replace(/[\r\n]/g, '_')
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"');
}

async function resolveBinaryPropertyUpload(
	context: IExecuteFunctions,
	item: INodeExecutionData,
	itemIndex: number,
	binaryProperty: string,
): Promise<{ fileBuffer: Buffer; safeFileName: string; mimeType: string }> {
	if (!item.binary || !item.binary[binaryProperty]) {
		throw new NodeOperationError(
			context.getNode(),
			`No binary data found for property "${binaryProperty}".`,
			{ itemIndex },
		);
	}

	const binaryData = item.binary[binaryProperty];
	const getBinaryDataBuffer = (
		context.helpers as unknown as {
			getBinaryDataBuffer?: (itemIndex: number, propertyName: string) => Promise<Buffer>;
		}
	).getBinaryDataBuffer;
	const fileBuffer =
		typeof getBinaryDataBuffer === 'function'
			? await getBinaryDataBuffer(itemIndex, binaryProperty)
			: Buffer.from(binaryData.data, 'base64');

	if (fileBuffer.length > MAX_FILE_BYTES) {
		throw new NodeOperationError(
			context.getNode(),
			`File in binary property "${binaryProperty}" exceeds 50 MB.`,
			{ itemIndex },
		);
	}

	return {
		fileBuffer,
		safeFileName: sanitizeUploadFileName(binaryData.fileName || binaryProperty),
		mimeType: sanitizeMimeType(binaryData.mimeType),
	};
}

async function resolveBinaryHandleUpload(
	context: IExecuteFunctions,
	itemIndex: number,
	binaryHandleId: string,
): Promise<{ fileBuffer: Buffer; safeFileName: string; mimeType: string }> {
	const getBinaryStream = (
		context.helpers as unknown as {
			getBinaryStream?: (
				binaryDataId: string,
				chunkSize?: number,
			) => Promise<NodeJS.ReadableStream>;
		}
	).getBinaryStream;
	const getBinaryMetadata = (
		context.helpers as unknown as {
			getBinaryMetadata?: (binaryDataId: string) => Promise<{
				fileName?: string;
				mimeType?: string;
				fileSize: number;
			}>;
		}
	).getBinaryMetadata;
	const binaryToBuffer = (
		context.helpers as unknown as {
			binaryToBuffer?: (body: Buffer | NodeJS.ReadableStream) => Promise<Buffer>;
		}
	).binaryToBuffer;

	if (
		typeof getBinaryStream !== 'function' ||
		typeof getBinaryMetadata !== 'function' ||
		typeof binaryToBuffer !== 'function'
	) {
		throw new NodeOperationError(
			context.getNode(),
			'Binary handle uploads are not supported by this n8n runtime.',
			{ itemIndex },
		);
	}

	try {
		const metadata = await getBinaryMetadata(binaryHandleId);
		if (metadata.fileSize > MAX_FILE_BYTES) {
			throw new NodeOperationError(
				context.getNode(),
				`File for binaryHandleId "${binaryHandleId}" exceeds 50 MB.`,
				{ itemIndex },
			);
		}

		const binaryStream = await getBinaryStream(binaryHandleId);
		const fileBuffer = await binaryToBuffer(binaryStream);

		return {
			fileBuffer,
			safeFileName: sanitizeUploadFileName(metadata.fileName || `file-${binaryHandleId}`),
			mimeType: sanitizeMimeType(metadata.mimeType),
		};
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		const message = error instanceof Error ? error.message : String(error);
		throw new NodeOperationError(
			context.getNode(),
			`Unable to resolve binaryHandleId "${binaryHandleId}". ${message}`,
			{ itemIndex },
		);
	}
}

export async function buildMultipartBody(
	context: IExecuteFunctions,
	item: INodeExecutionData,
	itemIndex: number,
	fileEntries: IFileEntry[],
	markAsRead: boolean,
	target: ShareTarget,
	optionalBotDisplayName: string | undefined,
	optionalBotImageUrl: string | undefined,
	postAsBotUniqueName: string | undefined,
	botSubscriberUserId: string | undefined,
): Promise<{ body: Buffer; boundary: string }> {
	const boundary = `----n8nFormBoundary${Date.now()}${itemIndex}`;
	const parts: Buffer[] = [];
	const comments = fileEntries.some((entry) => Boolean(entry.comment))
		? fileEntries.map((entry) => entry.comment ?? '')
		: [];

	for (const fileEntry of fileEntries) {
		const resolvedUpload = fileEntry.binaryProperty
			? await resolveBinaryPropertyUpload(context, item, itemIndex, fileEntry.binaryProperty)
			: await resolveBinaryHandleUpload(context, itemIndex, fileEntry.binaryHandleId as string);

		parts.push(Buffer.from(`--${boundary}\r\n`, 'utf8'));
		parts.push(
			Buffer.from(
				`Content-Disposition: form-data; name="file"; filename="${resolvedUpload.safeFileName}"\r\n`,
				'utf8',
			),
		);
		parts.push(Buffer.from(`Content-Type: ${resolvedUpload.mimeType}\r\n\r\n`, 'utf8'));
		parts.push(resolvedUpload.fileBuffer);
		parts.push(Buffer.from('\r\n', 'utf8'));
	}

	if (comments.length > 0) {
		appendMultipartField(parts, boundary, 'comments', JSON.stringify(comments));
	}

	if (
		target === 'chat' ||
		target === 'channelId' ||
		target === 'channelUniqueName' ||
		target === 'buddy'
	) {
		appendMultipartField(parts, boundary, 'mark_as_read', String(markAsRead));
	}

	if (optionalBotDisplayName) {
		appendMultipartField(parts, boundary, 'bot_name', optionalBotDisplayName);
	}

	if (optionalBotImageUrl) {
		appendMultipartField(parts, boundary, 'bot_image', optionalBotImageUrl);
	}

	if (postAsBotUniqueName) {
		appendMultipartField(parts, boundary, 'bot_unique_name', postAsBotUniqueName);
	}

	if (target === 'bot' && botSubscriberUserId) {
		appendMultipartField(parts, boundary, 'user_id', botSubscriberUserId);
	}

	parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf8'));
	return { body: Buffer.concat(parts), boundary };
}

export function parseBotSubscriberUserIds(
	context: IExecuteFunctions,
	botSubscriberUserIdsInput: unknown,
	itemIndex: number,
): string[] | undefined {
	if (typeof botSubscriberUserIdsInput === 'string') {
		return botSubscriberUserIdsInput.trim()
			? validateUserIdArray(context, botSubscriberUserIdsInput, itemIndex)
			: undefined;
	}

	if (
		!botSubscriberUserIdsInput ||
		typeof botSubscriberUserIdsInput !== 'object' ||
		Array.isArray(botSubscriberUserIdsInput)
	) {
		return undefined;
	}

	const entries = (botSubscriberUserIdsInput as IDataObject).subscriber;
	if (!Array.isArray(entries)) {
		return undefined;
	}

	const userIds = entries
		.map((entry) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				return '';
			}

			const rawUserId = (entry as IDataObject).userId;
			return typeof rawUserId === 'string' ? rawUserId.trim() : '';
		})
		.filter((value) => value.length > 0);

	if (userIds.length === 0) {
		return undefined;
	}

	return validateUserIdArray(context, userIds.join(','), itemIndex);
}

export function resolveShareTargetIdentifier(
	context: IExecuteFunctions,
	itemIndex: number,
	target: ShareTarget,
): string {
	if (target === 'chat') {
		return validateChatId(
			context,
			context.getNodeParameter('chatId', itemIndex) as string,
			itemIndex,
		);
	}

	if (target === 'channelId') {
		return validateChannelId(
			context,
			context.getNodeParameter('channelId', itemIndex, '', { extractValue: true }) as string,
			itemIndex,
		);
	}

	if (target === 'channelUniqueName') {
		return validateChannelName(
			context,
			context.getNodeParameter('channelUniqueName', itemIndex) as string,
			itemIndex,
		);
	}

	if (target === 'bot') {
		return validateConfiguredBotUniqueName(context, itemIndex, 'Bot Unique Name');
	}

	const buddyIdentifierType = validateBuddyIdentifierType(
		context,
		context.getNodeParameter('buddyIdentifierType', itemIndex),
		itemIndex,
	);
	if (buddyIdentifierType === 'email') {
		return validateEmail(
			context,
			context.getNodeParameter('buddyEmail', itemIndex) as string,
			itemIndex,
		);
	}

	return validateUserId(
		context,
		context.getNodeParameter('buddyUserId', itemIndex) as string,
		itemIndex,
	);
}
