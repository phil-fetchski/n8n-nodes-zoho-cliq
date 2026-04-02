import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	listAcceptedScopesForConditionalRequirement,
	listAcceptedScopesForOperation,
} from '../../../helpers/scopeRegistry';
import { encodePathSegmentPreservingEscapes, parseBooleanLikeTrue } from '../../../helpers/utils';
import { zohoCliqApiRequest } from '../../../transport';
import { extractCliqErrorSearchText } from '../errorResponse';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { isAuthoritativeNotFoundError } from './direct';
import { runPreflightGate } from './gate';
import {
	CHAT_LOOKUP_NOT_FOUND_ERROR_CODE,
	runChatLookupPreflightGate,
	validateChatExistsOrThrow,
} from './chat';
import { copyLookupErrorMetadata } from './utils';
import { lookupDirectUserExhaustively } from './users';

export const MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE = 'MESSAGE_NOT_FOUND';
export const MESSAGE_NOT_FOUND_HINT =
	'Check that the chat ID and message ID belong to the same conversation, then try again.';
export const DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE = 'USER_NOT_FOUND';

function isRecoverableMessageTargetLookupCandidate(error: unknown): boolean {
	const response = (error as { response?: { statusCode?: number; status?: number } } | undefined)
		?.response;
	const statusCode = Number(
		(error as { statusCode?: number; status?: number } | undefined)?.statusCode ??
			(error as { statusCode?: number; status?: number } | undefined)?.status ??
			response?.statusCode ??
			response?.status,
	);

	if (statusCode === 400) {
		return true;
	}

	const normalizedMessage = extractCliqErrorSearchText(error).toLowerCase();

	return (
		normalizedMessage.includes('request url is invalid') ||
		normalizedMessage.includes("couldn't process your request due to a technical error") ||
		normalizedMessage.includes('technical error') ||
		normalizedMessage.includes('message not found') ||
		normalizedMessage.includes('no message found') ||
		normalizedMessage.includes('no such message found')
	);
}

function isMessageAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

function getMessageRetrieveLookupScopes(): string[] {
	return listAcceptedScopesForOperation('message', 'retrieve') ?? [];
}

function getDirectMessageRecipientLookupScopes(): string[] {
	const acceptedScopes = listAcceptedScopesForConditionalRequirement(
		'message',
		'post',
		'directMessageUserPreflight',
	);
	if (!acceptedScopes?.length) {
		throw new Error(
			'Message.post directMessageUserPreflight scope registry entry is missing or empty.',
		);
	}

	return acceptedScopes;
}

export async function lookupMessageExhaustively(
	context: IExecuteFunctions,
	_itemIndex: number,
	config: {
		chatId: string;
		messageId: string;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	try {
		await zohoCliqApiRequest.call(
			context,
			'GET',
			`/api/v2/chats/${encodeURIComponent(config.chatId)}/messages/${encodePathSegmentPreservingEscapes(config.messageId)}`,
		);
		return { status: 'confirmed_exists' };
	} catch (error) {
		if (
			isAuthoritativeNotFoundError(error, [
				'request url is invalid',
				'message not found',
				'no message found',
				'no such message found',
			])
		) {
			return {
				status: 'confirmed_missing',
				evidence: `Zoho Cliq did not return a message for chat "${config.chatId}" and message "${config.messageId}".`,
			};
		}

		throw error;
	}
}

export async function runMessageLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	chatId: string,
	messageId: string,
): Promise<PreflightGateResult<void>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'message',
			identifier: `${chatId}:${messageId}`,
			label: 'Chat/Message Target',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: getMessageRetrieveLookupScopes(),
		},
		strategy: async () =>
			await lookupMessageExhaustively(context, itemIndex, {
				chatId,
				messageId,
			}),
		errors: {
			missing: {
				code: MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: `Unable to find Message ID "${messageId}" in Chat ID "${chatId}". The chat_id or message_id may be incorrect, or the message may not belong to that chat.`,
				hint: MESSAGE_NOT_FOUND_HINT,
			},
		},
	});
}

export function isMessageLookupNotFoundError(error: unknown): boolean {
	return (
		error instanceof NodeOperationError &&
		(error as NodeOperationError & { code?: string }).code === MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE
	);
}

function isChatLookupNotFoundPreflightError(error: unknown): boolean {
	return (
		error instanceof NodeOperationError &&
		(error as NodeOperationError & { code?: string }).code === CHAT_LOOKUP_NOT_FOUND_ERROR_CODE
	);
}

export function normalizeMessageLookupNotFoundError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	options: {
		chatId?: string;
		messageId?: string;
	} = {},
): NodeOperationError | undefined {
	if (
		!isAuthoritativeNotFoundError(error, [
			'request url is invalid',
			'message not found',
			'no message found',
			'no such message found',
		])
	) {
		return undefined;
	}

	const chatId = options.chatId ?? 'unknown';
	const messageId = options.messageId ?? 'unknown';
	const notFoundError = new NodeOperationError(
		context.getNode(),
		`Unable to find Message ID "${messageId}" in Chat ID "${chatId}". The chat_id or message_id may be incorrect, or the message may not belong to that chat.`,
		{
			itemIndex,
			description:
				'The selected message could not be found in this chat. Check the chat ID and message ID, then try again.',
		},
	);
	(notFoundError as NodeOperationError & { code?: string }).code =
		MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE;
	copyLookupErrorMetadata(notFoundError, error);
	return notFoundError;
}

export async function validateMessageExistsIfPossible(
	context: IExecuteFunctions,
	chatId: string,
	messageId: string,
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	if (!chatId || !messageId) {
		return;
	}

	await runMessageLookupPreflightGate(context, itemIndex, grantedScopes, chatId, messageId);
}

export async function validateMessageExistsOrThrow(
	context: IExecuteFunctions,
	chatId: string,
	messageId: string,
	itemIndex: number,
): Promise<void> {
	if (!chatId || !messageId) {
		return;
	}

	const outcome = await lookupMessageExhaustively(context, itemIndex, {
		chatId,
		messageId,
	});
	if (outcome.status === 'confirmed_exists') {
		return;
	}

	const messageLookupError = new NodeOperationError(
		context.getNode(),
		`Unable to find Message ID "${messageId}" in Chat ID "${chatId}". The chat_id or message_id may be incorrect, or the message may not belong to that chat.`,
		{
			itemIndex,
			description:
				'The selected message could not be found in this chat. Check the chat ID and message ID, then try again.',
		},
	);
	(messageLookupError as NodeOperationError & { code?: string }).code =
		MESSAGE_LOOKUP_NOT_FOUND_ERROR_CODE;
	throw messageLookupError;
}

export async function runMessageTargetPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	chatId: string,
	messageId: string,
): Promise<void> {
	await runChatLookupPreflightGate(context, itemIndex, grantedScopes, chatId);
	await runMessageLookupPreflightGate(context, itemIndex, grantedScopes, chatId, messageId);
}

export async function preflightMessageTargetIfPossible(
	context: IExecuteFunctions,
	chatId: string,
	messageId: string,
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	if (!chatId || !messageId) {
		return;
	}

	await runMessageTargetPreflightGate(context, itemIndex, grantedScopes, chatId, messageId);
}

export async function preflightMessageTargetOrThrowIfPossible(
	context: IExecuteFunctions,
	chatId: string,
	messageId: string,
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	if (!chatId || !messageId) {
		return;
	}

	await runMessageTargetPreflightGate(context, itemIndex, grantedScopes, chatId, messageId);
}

export async function preflightMessageTargetOrThrow(
	context: IExecuteFunctions,
	chatId: string,
	messageId: string,
	itemIndex: number,
	options: {
		fieldLabel?: string;
	} = {},
): Promise<void> {
	await validateChatExistsOrThrow(context, chatId, itemIndex, options);
	await validateMessageExistsOrThrow(context, chatId, messageId, itemIndex);
}

export async function enrichMessageChatLookupErrorIfPossible(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	grantedScopes: string,
	chatId: string | undefined,
): Promise<unknown> {
	if (!chatId) {
		return error;
	}

	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isMessageAiErrorModeEnabled(context, itemIndex);
	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return error;
	}

	const normalizedMessage = extractCliqErrorSearchText(error).toLowerCase();
	const shouldValidateChatExistence =
		normalizedMessage.includes('request url is invalid') ||
		normalizedMessage.includes("couldn't process your request due to a technical error") ||
		normalizedMessage.includes('technical error');

	if (!shouldValidateChatExistence) {
		return error;
	}

	try {
		await runChatLookupPreflightGate(context, itemIndex, grantedScopes, chatId);
	} catch (chatLookupError) {
		if (isChatLookupNotFoundPreflightError(chatLookupError)) {
			return chatLookupError;
		}
	}

	return error;
}

export async function enrichMessageTargetLookupErrorIfPossible(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	grantedScopes: string,
	chatId: string | undefined,
	messageId: string | undefined,
): Promise<unknown> {
	if (!chatId || !messageId) {
		return error;
	}

	if (isChatLookupNotFoundPreflightError(error) || isMessageLookupNotFoundError(error)) {
		return error;
	}

	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isMessageAiErrorModeEnabled(context, itemIndex);
	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return error;
	}

	if (!isRecoverableMessageTargetLookupCandidate(error)) {
		return error;
	}

	try {
		await runChatLookupPreflightGate(context, itemIndex, grantedScopes, chatId);
	} catch (chatLookupError) {
		if (isChatLookupNotFoundPreflightError(chatLookupError)) {
			return chatLookupError;
		}
	}

	try {
		await runMessageLookupPreflightGate(context, itemIndex, grantedScopes, chatId, messageId);
	} catch (messageLookupError) {
		if (isMessageLookupNotFoundError(messageLookupError)) {
			return messageLookupError;
		}
	}

	return error;
}

export async function runDirectMessageRecipientPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	userIdentifier: string,
): Promise<PreflightGateResult<IDataObject>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'user',
			identifier: userIdentifier,
			label: 'Direct Message Recipient',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: getDirectMessageRecipientLookupScopes(),
		},
		strategy: async () =>
			await lookupDirectUserExhaustively(context, itemIndex, {
				identifier: userIdentifier,
			}),
		errors: {
			missing: {
				code: DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE,
				message: `No Zoho Cliq user found for Email ID / ZUID "${userIdentifier}". Verify the recipient exists before posting a direct message.`,
				hint: 'Use Get User or List Users to verify the exact recipient email ID or ZUID before posting a direct message.',
			},
		},
	});
}

export function mapDirectMessageUserNotFoundErrorIfPossible(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	target: string | undefined,
	targetIdentifier: string | undefined,
): unknown {
	if (target !== 'user' || !targetIdentifier) {
		return error;
	}

	const normalizedMessage = extractCliqErrorSearchText(error).toLowerCase();
	const userNotFound =
		normalizedMessage.includes('request url is invalid') ||
		normalizedMessage.includes('no user found') ||
		normalizedMessage.includes('user not found');

	if (!userNotFound) {
		return error;
	}

	const guidedError = new NodeOperationError(
		context.getNode(),
		`No Zoho Cliq user found for Email ID / ZUID "${targetIdentifier}". Verify the recipient exists before posting a direct message.`,
		{
			itemIndex,
			description:
				'Zoho Cliq rejected the direct-message target. Verify the recipient email ID or ZUID exists and is accessible to the authenticated account.',
		},
	);
	(guidedError as NodeOperationError & { code?: string }).code =
		DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE;
	return guidedError;
}
