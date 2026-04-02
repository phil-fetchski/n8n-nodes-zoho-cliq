import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { buildCliqRecoverableErrorPayload } from '../shared/errorResponse';
import type { ICliqErrorMessageMapping } from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	sanitizeBase64ImageData,
	SUPPORTED_BASE64_IMAGE_FORMATS_TEXT,
} from '../../helpers/imageData';
import { parseBooleanLikeTrue, parseEmailList, validateUserIdArray } from '../../helpers/utils';

interface IChannelRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

const CHANNEL_ID_PREFIX_GUIDANCE =
	'Channel ID prefixes vary by channel level and commonly include P, O, T, or E.';
const INVALID_CHANNEL_ID_HINT =
	'The request may contain an incorrect channel_id value or reference a channel resource this endpoint could not identify. Verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. ' +
	CHANNEL_ID_PREFIX_GUIDANCE;
const CHAT_ID_IN_CHANNEL_ID_HINT =
	'The request may contain an incorrect channel_id value or reference a channel resource this endpoint could not identify. The value provided appears to be a Chat ID, not a Channel ID. Verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. ' +
	CHANNEL_ID_PREFIX_GUIDANCE;
const INVALID_CHANNEL_ID_MESSAGE =
	'Zoho Cliq rejected this request because a supplied channel_id parameter or related channel resource could not be identified for this endpoint.';
const CHAT_ID_IN_CHANNEL_ID_MESSAGE = `${INVALID_CHANNEL_ID_MESSAGE} The value provided appears to be a Chat ID, not a Channel ID. ${CHANNEL_ID_PREFIX_GUIDANCE}`;
const GENERIC_CHANNEL_REQUEST_HINT =
	'The request may contain an incorrect parameter value or reference a channel resource this endpoint could not identify. Review all provided inputs for missing, unsupported, or malformed values. If you supplied channel_id, verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. ' +
	CHANNEL_ID_PREFIX_GUIDANCE;
const CHAT_ID_IN_GENERIC_CHANNEL_REQUEST_HINT =
	'The request may contain an incorrect parameter value or reference a channel resource this endpoint could not identify. The supplied channel_id appears to be a Chat ID, not a Channel ID. Review all provided inputs for missing, unsupported, or malformed values, and verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. ' +
	CHANNEL_ID_PREFIX_GUIDANCE;
const GENERIC_CHANNEL_REQUEST_MESSAGE =
	'Zoho Cliq rejected this channel request because one or more supplied parameters were invalid, unsupported, or referenced a channel resource this endpoint could not identify.';
const CHAT_ID_IN_GENERIC_CHANNEL_REQUEST_MESSAGE = `${GENERIC_CHANNEL_REQUEST_MESSAGE} The supplied channel_id appears to be a Chat ID, not a Channel ID. ${CHANNEL_ID_PREFIX_GUIDANCE}`;
const CHANNEL_ID_ONLY_400_OPERATIONS = new Set([
	'approve',
	'archive',
	'delete',
	'get',
	'getMembers',
	'join',
	'leave',
	'reject',
	'unarchive',
]);

function isGenericProvider400Message(normalizedMessage: string): boolean {
	const trimmedLower = normalizedMessage.trim().toLowerCase();
	return (
		trimmedLower === 'request failed with status code 400' ||
		trimmedLower === 'bad request' ||
		trimmedLower === 'bad parameters'
	);
}

function normalizeSingleObjectCandidate(candidate: unknown): IDataObject | undefined {
	if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
		return undefined;
	}

	return candidate as IDataObject;
}

function readChannelField(candidate: unknown, keys: string[]): string | undefined {
	const normalizedCandidate = normalizeSingleObjectCandidate(candidate);
	if (!normalizedCandidate) {
		return undefined;
	}

	for (const key of keys) {
		const value = normalizedCandidate[key];
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}

	return undefined;
}

export function resolveChannelLocatorMode(channelLocator: unknown): 'id' | 'name' {
	const normalizedCandidate = normalizeSingleObjectCandidate(channelLocator);
	if (!normalizedCandidate) {
		return 'id';
	}

	return normalizedCandidate.mode === 'name' ? 'name' : 'id';
}

export function resolveChannelLocatorInput(
	context: IExecuteFunctions,
	itemIndex: number,
	parameterName = 'channelId',
): { mode: 'id' | 'name'; value: string } {
	const rawValue = context.getNodeParameter(parameterName, itemIndex, undefined) as unknown;
	const mode = resolveChannelLocatorMode(rawValue);

	if (typeof rawValue === 'string') {
		return {
			mode,
			value: rawValue.trim(),
		};
	}

	const normalizedRawValue = normalizeSingleObjectCandidate(rawValue);
	const directValue = normalizedRawValue?.value;
	if (typeof directValue === 'string') {
		return {
			mode,
			value: directValue.trim(),
		};
	}

	const extractedValue = context.getNodeParameter(parameterName, itemIndex, '', {
		extractValue: true,
	}) as unknown;

	return {
		mode,
		value:
			typeof extractedValue === 'string'
				? extractedValue.trim()
				: String(extractedValue ?? '').trim(),
	};
}

export function extractChannelIdFromLookupEntity(response: unknown): string | undefined {
	const root = normalizeSingleObjectCandidate(response);
	if (!root) {
		return undefined;
	}

	const direct = readChannelField(root, ['channel_id', 'id']);
	if (direct) {
		return direct;
	}

	const nestedCandidates = [root.channel, root.data, root.result];
	for (const candidate of nestedCandidates) {
		const channelId = readChannelField(candidate, ['channel_id', 'id']);
		if (channelId) {
			return channelId;
		}
	}

	return undefined;
}

export function extractChannelUniqueNameFromLookupEntity(response: unknown): string | undefined {
	const root = normalizeSingleObjectCandidate(response);
	if (!root) {
		return undefined;
	}

	const direct = readChannelField(root, ['unique_name']);
	if (direct) {
		return direct;
	}

	const nestedCandidates = [root.channel, root.data, root.result];
	for (const candidate of nestedCandidates) {
		const uniqueName = readChannelField(candidate, ['unique_name']);
		if (uniqueName) {
			return uniqueName;
		}
	}

	return undefined;
}

export interface IChannelEnhancedOutputOptions {
	includeEnhancedOutput: boolean;
	responseJson: IDataObject;
	rawResponse: IDataObject;
}

export const CHANNEL_LEVELS = ['organization', 'team', 'private', 'external'] as const;

export type ChannelLevel = (typeof CHANNEL_LEVELS)[number];

export const CHANNEL_LEVEL_OPTIONS: Array<{ name: string; value: ChannelLevel }> = [
	{ name: 'Organization', value: 'organization' },
	{ name: 'Team', value: 'team' },
	{ name: 'Private', value: 'private' },
	{ name: 'External', value: 'external' },
];

export const channelConfigKeys = [
	'reply_mode',
	'leave_join_info',
	'add_remove_info',
	'meeting_chat_type',
] as const;

export type ChannelConfigKey = (typeof channelConfigKeys)[number];

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
export const channelConfigJsonExample =
	'{"reply_mode":"normal_reply","leave_join_info":"enable","add_remove_info":"enable","meeting_chat_type":"channel"}';
export const channelConfigJsonAllowedKeysText = channelConfigKeys.join(', ');
const rawConfigObjectSentinel = '[object Object]';

function getChannelConfigJsonExampleMessage(): string {
	return `Example: ${channelConfigJsonExample}`;
}

function getChannelConfigJsonHint(): string {
	return `Use a JSON object with only these keys: ${channelConfigJsonAllowedKeysText}. ${getChannelConfigJsonExampleMessage()}`;
}

function isEmptyChannelConfigObject(value: unknown): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.keys(value as IDataObject).length === 0
	);
}

export function resolveRawChannelConfigInput(...candidates: unknown[]): unknown {
	let sawEmptyObjectLikeValue = false;

	for (const candidate of candidates) {
		if (candidate === undefined || candidate === null) {
			continue;
		}

		if (isEmptyChannelConfigObject(candidate)) {
			sawEmptyObjectLikeValue = true;
			continue;
		}

		if (typeof candidate === 'object' && !Array.isArray(candidate)) {
			return candidate;
		}

		if (typeof candidate === 'string') {
			const trimmed = candidate.trim();
			if (!trimmed) {
				continue;
			}

			if (trimmed === '{}' || trimmed === rawConfigObjectSentinel) {
				sawEmptyObjectLikeValue = true;
				continue;
			}

			return trimmed;
		}

		return candidate;
	}

	return sawEmptyObjectLikeValue ? {} : undefined;
}

const allowedConfigValues: Record<ChannelConfigKey, string[]> = {
	reply_mode: ['normal_reply', 'threads', 'both'],
	leave_join_info: ['enable', 'disable'],
	add_remove_info: ['enable', 'disable'],
	meeting_chat_type: ['channel', 'thread', 'host_choice'],
};

export const channelStructuredConfigFields: INodeProperties[] = [
	{
		displayName: 'Add/Remove Notifications',
		name: 'add_remove_info',
		type: 'options',
		options: [
			{ name: 'Enable', value: 'enable' },
			{ name: 'Disable', value: 'disable' },
		],
		default: 'enable',
		description:
			'Optional channel config value. Controls whether member add/remove notifications are posted. Allowed values: enable, disable.',
		displayOptions: {
			show: {
				configInputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Join/Leave Notifications',
		name: 'leave_join_info',
		type: 'options',
		options: [
			{ name: 'Enable', value: 'enable' },
			{ name: 'Disable', value: 'disable' },
		],
		default: 'enable',
		description:
			'Optional channel config value. Controls whether join/leave notifications are posted. Allowed values: enable, disable.',
		displayOptions: {
			show: {
				configInputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Meeting Chat Type',
		name: 'meeting_chat_type',
		type: 'options',
		options: [
			{ name: 'Channel', value: 'channel' },
			{ name: 'Thread', value: 'thread' },
			{ name: 'Host Choice', value: 'host_choice' },
		],
		default: 'channel',
		description:
			'Optional channel config value. Controls how meeting chat messages are posted. Allowed values: channel, thread, host_choice.',
		displayOptions: {
			show: {
				configInputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Reply Mode',
		name: 'reply_mode',
		type: 'options',
		options: [
			{ name: 'Normal Reply', value: 'normal_reply' },
			{ name: 'Threads', value: 'threads' },
			{ name: 'Both', value: 'both' },
		],
		default: 'normal_reply',
		description:
			'Optional channel config value. Controls how replies are posted in the channel. Allowed values: normal_reply, threads, both.',
		displayOptions: {
			show: {
				configInputMode: ['structured'],
			},
		},
	},
];

export function getRequiredStructuredConfigField(name: string): INodeProperties {
	const field = channelStructuredConfigFields.find((candidate) => candidate.name === name);
	if (!field) {
		throw new Error(`Missing required channel structured config field: ${name}`);
	}
	return field;
}

export const channelStructuredConfigFieldsByName = {
	add_remove_info: getRequiredStructuredConfigField('add_remove_info'),
	leave_join_info: getRequiredStructuredConfigField('leave_join_info'),
	meeting_chat_type: getRequiredStructuredConfigField('meeting_chat_type'),
	reply_mode: getRequiredStructuredConfigField('reply_mode'),
} as const;

export function resolveChannelEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
): IChannelEnhancedOutputOptions {
	const includeEnhancedOutputParam = context.getNodeParameter(
		'includeEnhancedOutput',
		itemIndex,
		true,
	) as boolean | undefined;
	const includeEnhancedOutput = includeEnhancedOutputParam !== false;
	const responseJson = coerceApiResponseToObject(response);
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		responseJson,
		rawResponse,
	};
}

export function validateChannelLevel(
	context: IExecuteFunctions,
	level: unknown,
	itemIndex: number,
): ChannelLevel {
	const normalized = String(level ?? '').trim() as ChannelLevel;
	if (!CHANNEL_LEVELS.includes(normalized)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid level: "${String(level ?? '')}". Must be one of: ${CHANNEL_LEVELS.join(', ')}`,
			{ itemIndex },
		);
	}

	return normalized;
}

export function validateChannelConfigValue(
	context: IExecuteFunctions,
	key: ChannelConfigKey,
	value: unknown,
	itemIndex: number,
): string {
	const normalized = String(value ?? '').trim();
	if (!normalized) {
		throw new NodeOperationError(context.getNode(), `Config field "${key}" cannot be empty`, {
			itemIndex,
		});
	}

	const validValues = allowedConfigValues[key];
	if (!validValues.includes(normalized)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid value for "${key}". Allowed values: ${validValues.join(', ')}`,
			{ itemIndex },
		);
	}

	return normalized;
}

function assertAllowedConfigKey(context: IExecuteFunctions, key: string, itemIndex: number): void {
	if (blockedKeys.has(key)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid key "${key}" in Config JSON. ${getChannelConfigJsonHint()}`,
			{
				itemIndex,
			},
		);
	}
}

export function parseRawChannelConfig(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	let parsed: unknown = value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return undefined;
		}

		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`Config JSON must be valid JSON. ${getChannelConfigJsonHint()}`,
				{
					itemIndex,
				},
			);
		}
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		throw new NodeOperationError(
			context.getNode(),
			`Config JSON must be an object. ${getChannelConfigJsonExampleMessage()}`,
			{
				itemIndex,
			},
		);
	}

	const configObject = parsed as IDataObject;
	for (const key of Object.keys(configObject)) {
		assertAllowedConfigKey(context, key, itemIndex);
		if (!channelConfigKeys.includes(key as ChannelConfigKey)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsupported config key "${key}". Allowed keys: ${channelConfigJsonAllowedKeysText}. ${getChannelConfigJsonExampleMessage()}`,
				{ itemIndex },
			);
		}

		configObject[key] = validateChannelConfigValue(
			context,
			key as ChannelConfigKey,
			configObject[key],
			itemIndex,
		);
	}

	return Object.keys(configObject).length > 0 ? configObject : undefined;
}

export function validateChannelImageData(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string | undefined {
	return sanitizeBase64ImageData(context, value, itemIndex, {
		fieldLabel: 'Image Data',
		unsupportedFormatMessage: `Image Data must decode to a supported image file. Supported formats: ${SUPPORTED_BASE64_IMAGE_FORMATS_TEXT}. Provide Base64 from the original image file, not arbitrary Base64 text, HTML, or an image URL.`,
	});
}

export function parseChannelStringArray(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel: string,
	options: { allowEmail?: boolean } = {},
): string[] | undefined {
	const parts =
		typeof value === 'string'
			? value
					.split(',')
					.map((part) => part.trim())
					.filter((part) => part.length > 0)
			: Array.isArray(value)
				? value.map((part) => String(part).trim()).filter((part) => part.length > 0)
				: [];

	if (parts.length === 0) {
		return undefined;
	}

	for (const part of parts) {
		const isValid = options.allowEmail
			? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part)
			: /^[a-zA-Z0-9_-]+$/.test(part);
		if (!isValid) {
			throw new NodeOperationError(context.getNode(), `Invalid ${fieldLabel} value: ${part}`, {
				itemIndex,
			});
		}
	}

	return parts;
}

export function pushChannelRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IChannelRecoverableErrorOptions = {},
): boolean {
	const getAiErrorModeEnabled = (): boolean => {
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
	};

	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = getAiErrorModeEnabled();
	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const resolveMessageMappings = (): ICliqErrorMessageMapping[] | undefined => {
		const baseMappings = options.messageMappings ?? [];
		const rawChannelId = options.contextFields?.channel_id;
		const requestedChannelId = typeof rawChannelId === 'string' ? rawChannelId.trim() : '';
		const looksLikeChatId = requestedChannelId.toUpperCase().startsWith('CT_');
		const resolvedMappings = baseMappings.map((mapping) => {
			if (mapping.reason !== 'INVALID_CHANNEL_ID') {
				return mapping;
			}

			return {
				...mapping,
				hint: looksLikeChatId ? CHAT_ID_IN_CHANNEL_ID_HINT : INVALID_CHANNEL_ID_HINT,
				messageOverride: looksLikeChatId
					? CHAT_ID_IN_CHANNEL_ID_MESSAGE
					: INVALID_CHANNEL_ID_MESSAGE,
			};
		});
		const isChannelIdOnlyOperation = CHANNEL_ID_ONLY_400_OPERATIONS.has(operation);
		return [
			...resolvedMappings,
			{
				match: (normalizedMessage) => isGenericProvider400Message(normalizedMessage),
				reason: isChannelIdOnlyOperation
					? 'CHANNEL_RESOURCE_UNIDENTIFIED'
					: 'CHANNEL_REQUEST_BAD_PARAMETERS',
				hint: isChannelIdOnlyOperation
					? looksLikeChatId
						? CHAT_ID_IN_CHANNEL_ID_HINT
						: INVALID_CHANNEL_ID_HINT
					: looksLikeChatId
						? CHAT_ID_IN_GENERIC_CHANNEL_REQUEST_HINT
						: GENERIC_CHANNEL_REQUEST_HINT,
				messageOverride: looksLikeChatId
					? isChannelIdOnlyOperation
						? CHAT_ID_IN_CHANNEL_ID_MESSAGE
						: CHAT_ID_IN_GENERIC_CHANNEL_REQUEST_MESSAGE
					: isChannelIdOnlyOperation
						? INVALID_CHANNEL_ID_MESSAGE
						: GENERIC_CHANNEL_REQUEST_MESSAGE,
			},
		];
	};

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
			resource: 'channel',
			operation,
		},
		{
			contextFields: options.contextFields,
			fallbackMessage: options.fallbackMessage,
			messageMappings: resolveMessageMappings(),
		},
	);

	const executionData = context.helpers.constructExecutionMetaData([{ json: errorPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export interface IParsedChannelMemberIdentifiers {
	identifierType: 'email_ids' | 'user_ids';
	identifiers: string[];
}

const strictEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmailIdentifier(value: string): boolean {
	return strictEmailPattern.test(value.trim());
}

export function parseChannelMemberIdentifiers(
	context: IExecuteFunctions,
	identifiersRaw: string,
	itemIndex: number,
): IParsedChannelMemberIdentifiers {
	if (!identifiersRaw) {
		throw new NodeOperationError(context.getNode(), 'Member identifiers are required', {
			itemIndex,
		});
	}

	const identifierParts = identifiersRaw
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part.length > 0);

	if (identifierParts.length === 0) {
		throw new NodeOperationError(context.getNode(), 'At least one member identifier is required', {
			itemIndex,
		});
	}

	const hasEmailIds = identifierParts.some((identifier) => isValidEmailIdentifier(identifier));
	const hasUserIds = identifierParts.some((identifier) => !isValidEmailIdentifier(identifier));

	if (hasEmailIds && hasUserIds) {
		throw new NodeOperationError(
			context.getNode(),
			'Use either email IDs or user IDs in one request. Mixed identifier types are not supported.',
			{
				itemIndex,
			},
		);
	}

	if (hasEmailIds) {
		const identifiers = parseEmailList(context, identifierParts.join(','), itemIndex);
		if (identifiers.length === 0) {
			throw new NodeOperationError(context.getNode(), 'At least one email ID is required', {
				itemIndex,
			});
		}
		return {
			identifierType: 'email_ids',
			identifiers,
		};
	}

	const identifiers = validateUserIdArray(context, identifierParts.join(','), itemIndex);
	if (identifiers.length === 0) {
		throw new NodeOperationError(context.getNode(), 'At least one user ID is required', {
			itemIndex,
		});
	}

	return {
		identifierType: 'user_ids',
		identifiers,
	};
}
