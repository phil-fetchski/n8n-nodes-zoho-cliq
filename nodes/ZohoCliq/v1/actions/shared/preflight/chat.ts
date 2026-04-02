import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { hasRequiredScope } from '../../../../../../credentials/ZohoCliqOAuth2Api.credentials';

import {
	buildScopeMissingPayload,
	getConditionalScopeRequirement,
	getRequiredScopesForOperationOrThrow,
	listAcceptedScopesForConditionalRequirement,
	listAcceptedScopesForOperation,
} from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { isAuthoritativeNotFoundError } from './direct';
import { runPreflightGate } from './gate';
import { copyLookupErrorMetadata } from './utils';

export const CHAT_LOOKUP_NOT_FOUND_ERROR_CODE = 'CHAT_NOT_FOUND';
export const CHAT_LOOKUP_FAILED_ERROR_CODE = 'CHAT_LOOKUP_FAILED';
export const CHAT_LOOKUP_SCOPE_REQUIRED_ERROR_CODE = 'CHAT_LOOKUP_SCOPE_REQUIRED';
export const CHAT_NOT_FOUND_HINT =
	'Use a valid chat ID that belongs to a conversation accessible to the authenticated Zoho Cliq account. If you intended a channel conversation, use the conversation chat ID rather than the channel ID.';

function getChatMembersLookupScopes(): string[] {
	return listAcceptedScopesForOperation('chat', 'getMembers') ?? [];
}

function isAuthoritativeChatLookupNotFoundError(error: unknown): boolean {
	return isAuthoritativeNotFoundError(error, [
		'request url is invalid',
		'chat not found',
		'no chat found',
		'invalid chat id',
	]);
}

function buildChatNotFoundError(
	context: IExecuteFunctions,
	chatId: string,
	itemIndex: number,
	fieldLabel: string,
): NodeOperationError {
	const chatNotFoundError = new NodeOperationError(
		context.getNode(),
		`No chat found for ${fieldLabel} "${chatId}".`,
		{
			itemIndex,
			description:
				'The provided chat ID does not exist in Zoho Cliq or is not accessible to the authenticated account.',
		},
	);
	(chatNotFoundError as NodeOperationError & { code?: string }).code =
		CHAT_LOOKUP_NOT_FOUND_ERROR_CODE;
	return chatNotFoundError;
}

async function lookupChatViaMembersEndpoint(
	context: IExecuteFunctions,
	_identifier: string,
	encodedIdentifier: string,
): Promise<ExhaustiveLookupOutcome<void>> {
	try {
		await zohoCliqApiRequest.call(
			context,
			'GET',
			`/api/v2/chats/${encodedIdentifier}/members`,
			{},
			{},
		);
		return { status: 'confirmed_exists' };
	} catch (error) {
		if (isAuthoritativeChatLookupNotFoundError(error)) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Chat Members returned an authoritative invalid-chat response for "${_identifier}".`,
			};
		}

		throw error;
	}
}

export async function lookupChatExhaustively(
	context: IExecuteFunctions,
	_itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	return await lookupChatViaMembersEndpoint(
		context,
		config.identifier,
		encodeURIComponent(config.identifier),
	);
}

export async function lookupDirectChatExhaustively(
	context: IExecuteFunctions,
	_itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	return await lookupChatViaMembersEndpoint(
		context,
		config.identifier,
		encodeURIComponent(config.identifier),
	);
}

export async function runChatLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	chatId: string,
	options: {
		fieldLabel?: string;
	} = {},
): Promise<PreflightGateResult<void>> {
	const fieldLabel = options.fieldLabel ?? 'Chat ID';

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'chat',
			identifier: chatId,
			label: fieldLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: getChatMembersLookupScopes(),
		},
		strategy: async () =>
			await lookupChatExhaustively(context, itemIndex, {
				identifier: chatId,
			}),
		errors: {
			missing: {
				code: CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: `No chat found for ${fieldLabel} "${chatId}".`,
				hint: CHAT_NOT_FOUND_HINT,
			},
		},
	});
}

export function normalizeChatLookupNotFoundError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	options: {
		chatId?: string;
		fieldLabel?: string;
	} = {},
): NodeOperationError | undefined {
	if (!isAuthoritativeChatLookupNotFoundError(error)) {
		return undefined;
	}

	const fieldLabel = options.fieldLabel ?? 'Chat ID';
	const chatId = options.chatId ?? 'unknown';
	const notFoundError = buildChatNotFoundError(context, chatId, itemIndex, fieldLabel);
	copyLookupErrorMetadata(notFoundError, error);
	return notFoundError;
}

function buildChatLookupFailedError(
	context: IExecuteFunctions,
	chatId: string,
	itemIndex: number,
	fieldLabel: string,
): NodeOperationError {
	const lookupError = new NodeOperationError(
		context.getNode(),
		`Unable to verify ${fieldLabel} "${chatId}" before continuing. Retry after confirming the authenticated account can access that conversation.`,
		{
			itemIndex,
			description:
				'The node could not conclusively verify this chat through Get Chat Members during the preflight lookup, so it stopped before calling the main endpoint.',
		},
	);
	(lookupError as NodeOperationError & { code?: string }).code = CHAT_LOOKUP_FAILED_ERROR_CODE;
	return lookupError;
}

export function assertChatLookupPreflightScopesOrThrow(
	context: IExecuteFunctions,
	grantedScopes: string,
	itemIndex: number,
	options: {
		resource: string;
		operation: string;
		missingScopeMessage: string;
		description: string;
	},
): void {
	const operationPath = `${options.resource.charAt(0).toUpperCase()}${options.resource.slice(1)}.${options.operation}`;
	const acceptedLookupScopes = listAcceptedScopesForConditionalRequirement(
		options.resource,
		options.operation,
		'chatLookupPreflight',
	);
	if (!acceptedLookupScopes?.length) {
		throw new Error(
			`${operationPath} chatLookupPreflight scope registry entry is missing or empty.`,
		);
	}

	const condition = getConditionalScopeRequirement(
		options.resource,
		options.operation,
		'chatLookupPreflight',
	);
	if (!condition?.requiredScopes.length) {
		throw new Error(
			`${operationPath} chatLookupPreflight scope registry entry is missing or empty.`,
		);
	}

	const hasAcceptedLookupScope = acceptedLookupScopes.some((scope) =>
		hasRequiredScope(grantedScopes, scope),
	);
	if (hasAcceptedLookupScope) {
		return;
	}

	const payload = buildScopeMissingPayload({
		resource: options.resource,
		operation: options.operation,
		requiredScopes: Array.from(
			new Set([
				...getRequiredScopesForOperationOrThrow(options.resource, options.operation),
				...condition.requiredScopes,
			]),
		),
		missingScopes: [...condition.requiredScopes],
	});
	const scopeError = new NodeOperationError(context.getNode(), options.missingScopeMessage, {
		itemIndex,
		description: options.description,
	});
	(scopeError as NodeOperationError & { code?: string }).code =
		CHAT_LOOKUP_SCOPE_REQUIRED_ERROR_CODE;
	Object.assign(scopeError as unknown as Record<string, unknown>, {
		zohoCliqScopeErrorPayload: payload,
	});
	throw scopeError;
}

export async function validateChatExistsIfPossible(
	context: IExecuteFunctions,
	chatId: string,
	itemIndex: number,
	grantedScopes: string,
	options: {
		fieldLabel?: string;
	} = {},
): Promise<void> {
	if (!chatId) {
		return;
	}

	await runChatLookupPreflightGate(context, itemIndex, grantedScopes, chatId, options);
}

export async function validateChatExistsOrThrow(
	context: IExecuteFunctions,
	chatId: string,
	itemIndex: number,
	options: {
		fieldLabel?: string;
	} = {},
): Promise<void> {
	if (!chatId) {
		return;
	}

	const fieldLabel = options.fieldLabel ?? 'Chat ID';

	let outcome;
	try {
		outcome = await lookupDirectChatExhaustively(context, itemIndex, {
			identifier: chatId,
		});
	} catch {
		throw buildChatLookupFailedError(context, chatId, itemIndex, fieldLabel);
	}

	if (outcome.status === 'confirmed_exists') {
		return;
	}

	throw buildChatNotFoundError(context, chatId, itemIndex, fieldLabel);
}
