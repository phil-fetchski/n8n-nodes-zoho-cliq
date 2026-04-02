import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { validateEmail, validateUserId } from '../../../helpers/utils';
import { mentionIdentifierPattern, mentionInsertModes, mentionTypes } from './constants';
import { ensureSafeObject, getOptionalBoolean, getOptionalString, isDataObject } from './common';

export function validateMessageText(
	context: IExecuteFunctions,
	text: unknown,
	maxLength: number,
	typeErrorMessage: string,
	itemIndex: number,
): string {
	if (typeof text !== 'string') {
		throw new NodeOperationError(context.getNode(), typeErrorMessage, { itemIndex });
	}

	const sanitized = text.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Text is required and cannot be empty', {
			itemIndex,
		});
	}

	if (sanitized.length > maxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`Text message is too long. Maximum length is ${maxLength} characters.`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function applyMentionTokensToText(
	context: IExecuteFunctions,
	itemIndex: number,
	text: string,
): string {
	const addMention = getOptionalBoolean(
		context,
		context.getNodeParameter('addMention', itemIndex, false),
		itemIndex,
		'addMention',
		false,
	);
	if (!addMention) {
		return text;
	}

	const mentionInsertMode = context.getNodeParameter(
		'mentionInsertMode',
		itemIndex,
		'append',
	) as unknown;
	if (typeof mentionInsertMode !== 'string' || !mentionInsertModes.has(mentionInsertMode)) {
		throw new NodeOperationError(
			context.getNode(),
			'Mention Insert Mode must be one of: append, prepend',
			{ itemIndex },
		);
	}

	const mentionCollection = context.getNodeParameter('mentions', itemIndex, {}) as unknown;
	const mentionTokens = extractMentionTokens(context, mentionCollection, itemIndex);
	if (mentionTokens.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'Add a Mention is enabled, but no mention entries were provided',
			{ itemIndex },
		);
	}

	const mentionText = mentionTokens.join(' ');
	return mentionInsertMode === 'prepend' ? `${mentionText} ${text}` : `${text} ${mentionText}`;
}

function extractMentionTokens(
	context: IExecuteFunctions,
	mentionCollection: unknown,
	itemIndex: number,
): string[] {
	if (!isDataObject(mentionCollection)) {
		return [];
	}

	const mentionEntries = mentionCollection.mention;
	if (!Array.isArray(mentionEntries)) {
		return [];
	}

	return mentionEntries.map((mention, mentionIndex) => {
		if (!isDataObject(mention)) {
			throw new NodeOperationError(context.getNode(), 'Each mention must be a JSON object', {
				itemIndex,
			});
		}

		ensureSafeObject(context, mention, itemIndex, `mentions.mention[${mentionIndex}]`);
		return buildMentionToken(context, mention, itemIndex, mentionIndex);
	});
}

function buildMentionToken(
	context: IExecuteFunctions,
	mention: IDataObject,
	itemIndex: number,
	mentionIndex: number,
): string {
	const mentionType = getOptionalString(mention.mentionType);
	if (!mentionType || !mentionTypes.has(mentionType)) {
		throw new NodeOperationError(
			context.getNode(),
			`Mention type at index ${mentionIndex} must be one of: available, all, participants, user, silentUser, team, channel`,
			{ itemIndex },
		);
	}

	if (mentionType === 'participants') {
		return '{@participants}';
	}

	if (mentionType === 'available') {
		return '{@available}';
	}

	if (mentionType === 'all') {
		return '{@all}';
	}

	if (mentionType === 'user') {
		const userIdOrEmail = getOptionalString(mention.userIdOrEmail);
		if (!userIdOrEmail) {
			throw new NodeOperationError(
				context.getNode(),
				`User ID or Email is required for mention at index ${mentionIndex}`,
				{ itemIndex },
			);
		}

		const userToken = userIdOrEmail.includes('@')
			? validateEmail(context, userIdOrEmail, itemIndex)
			: validateUserId(context, userIdOrEmail, itemIndex);

		return `{@${userToken}}`;
	}

	if (mentionType === 'team') {
		const teamId = getOptionalString(mention.teamId);
		if (!teamId) {
			throw new NodeOperationError(
				context.getNode(),
				`Team ID is required for mention at index ${mentionIndex}`,
				{ itemIndex },
			);
		}

		if (teamId.length > 255 || !mentionIdentifierPattern.test(teamId)) {
			throw new NodeOperationError(context.getNode(), `Invalid Team ID at index ${mentionIndex}`, {
				itemIndex,
			});
		}

		return `{@${teamId}}`;
	}

	if (mentionType === 'channel') {
		const channelId = getOptionalString(mention.channelId);
		if (!channelId) {
			throw new NodeOperationError(
				context.getNode(),
				`Channel ID is required for mention at index ${mentionIndex}`,
				{ itemIndex },
			);
		}

		if (channelId.length > 255 || !mentionIdentifierPattern.test(channelId)) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid Channel ID at index ${mentionIndex}`,
				{ itemIndex },
			);
		}

		return `{#${channelId}}`;
	}

	const silentUserName = getOptionalString(mention.silentUserName);
	if (!silentUserName) {
		throw new NodeOperationError(
			context.getNode(),
			`Silent User Display Name is required for mention at index ${mentionIndex}`,
			{ itemIndex },
		);
	}

	const silentUserInputType = getOptionalString(mention.silentUserInputType) ?? 'zohoid';
	if (!['zohoid', 'mail'].includes(silentUserInputType)) {
		throw new NodeOperationError(
			context.getNode(),
			`Silent User Input Type at index ${mentionIndex} must be one of: zohoid, mail`,
			{ itemIndex },
		);
	}

	const silentUserValue = getOptionalString(mention.silentUserValue);
	if (!silentUserValue) {
		throw new NodeOperationError(
			context.getNode(),
			`Silent User Value is required for mention at index ${mentionIndex}`,
			{ itemIndex },
		);
	}

	const sanitizedValue =
		silentUserInputType === 'mail'
			? validateEmail(context, silentUserValue, itemIndex)
			: validateUserId(context, silentUserValue, itemIndex);

	if (silentUserName.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			`Silent User Display Name at index ${mentionIndex} exceeds 100 characters`,
			{ itemIndex },
		);
	}

	if (/[[\]()\r\n]/.test(silentUserName)) {
		throw new NodeOperationError(
			context.getNode(),
			`Silent User Display Name at index ${mentionIndex} contains unsupported characters`,
			{ itemIndex },
		);
	}

	return `[${silentUserName}](${silentUserInputType}:${sanitizedValue})`;
}
