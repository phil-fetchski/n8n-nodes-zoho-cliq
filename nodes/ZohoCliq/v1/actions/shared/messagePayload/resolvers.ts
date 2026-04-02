import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { sanitizeJsonBody } from '../../../helpers/utils';
import { mergeOptionalBotIdentity } from './bot';
import { getOptionalBoolean, parseJsonObjectInput, serializeRichPayloadFields } from './common';
import { resolveCardPayload, resolveRichMessagePayload } from './rich';
import { applyMentionTokensToText, validateMessageText } from './text';

export { resolveCardPayload };

export function resolveMessagePayload(
	context: IExecuteFunctions,
	itemIndex: number,
	options: {
		textFieldName?: string;
		jsonFieldName?: string;
		textMaxLength?: number;
		textTypeErrorMessage?: string;
		requireMessageContent?: boolean;
		includeBotIdentity?: boolean;
	} = {},
): IDataObject {
	const {
		textFieldName = 'text',
		jsonFieldName = 'jsonBody',
		textMaxLength = 4096,
		textTypeErrorMessage = 'Text must be a string',
		requireMessageContent = true,
		includeBotIdentity = true,
	} = options;

	const messageType = context.getNodeParameter('messageType', itemIndex) as
		| 'text'
		| 'json'
		| 'rich';

	if (messageType === 'json') {
		const jsonBody = context.getNodeParameter(jsonFieldName, itemIndex, {}) as unknown;
		const jsonObject = parseJsonObjectInput(context, jsonBody, itemIndex, jsonFieldName, {
			allowEmptyObject: true,
		});
		const sanitizedJson = sanitizeJsonBody(context, jsonObject, itemIndex);
		if (requireMessageContent && Object.keys(sanitizedJson).length === 0) {
			throw new NodeOperationError(context.getNode(), 'JSON payload cannot be empty', {
				itemIndex,
			});
		}
		if (requireMessageContent) {
			const rawJsonText = sanitizedJson.text;
			if (rawJsonText === undefined) {
				throw new NodeOperationError(
					context.getNode(),
					'Advanced (JSON) must include a top-level "text" field. Use a non-empty string for "text". For plain-text-only messages, choose Message Type = Text (Cliq Markdown). Use Advanced (JSON) mainly for card payloads such as text + card/slides/buttons.',
					{ itemIndex },
				);
			}

			sanitizedJson.text = validateMessageText(
				context,
				rawJsonText,
				textMaxLength,
				'Advanced (JSON) "text" must be a string',
				itemIndex,
			);
		}
		if (includeBotIdentity) {
			mergeOptionalBotIdentity(context, sanitizedJson, itemIndex);
		}
		return serializeRichPayloadFields(sanitizedJson);
	}

	if (messageType === 'text') {
		const text = context.getNodeParameter(textFieldName, itemIndex) as unknown;
		const sanitizedText = validateMessageText(
			context,
			text,
			textMaxLength,
			textTypeErrorMessage,
			itemIndex,
		);
		const textPayload: IDataObject = {
			text: applyMentionTokensToText(context, itemIndex, sanitizedText),
		};
		if (includeBotIdentity) {
			mergeOptionalBotIdentity(context, textPayload, itemIndex);
		}
		return textPayload;
	}

	if (messageType !== 'rich') {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid message type "${String(messageType)}". Must be one of: text, rich, json.`,
			{ itemIndex },
		);
	}

	return resolveRichMessagePayload(context, itemIndex, {
		requireMessageContent,
		textTypeErrorMessage,
		includeBot: includeBotIdentity,
		serializeRichFields: true,
		requireTopLevelText: false,
		autoGenerateButtonKey: false,
	});
}

export function resolveBotUniqueNameQueryParam(
	context: IExecuteFunctions,
	itemIndex: number,
	options: {
		botUniqueNameFieldName?: string;
		validationContext?: string;
	} = {},
): Record<string, string> | undefined {
	const { botUniqueNameFieldName = 'botUniqueName', validationContext = 'Post as Bot is enabled' } =
		options;
	const postAsBot = getOptionalBoolean(
		context,
		context.getNodeParameter('postAsBot', itemIndex, false),
		itemIndex,
		'postAsBot',
		false,
	);
	if (!postAsBot) {
		return undefined;
	}

	const botUniqueNameRaw = context.getNodeParameter(
		botUniqueNameFieldName,
		itemIndex,
		'',
	) as unknown;
	if (typeof botUniqueNameRaw !== 'string' || !botUniqueNameRaw.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			`Bot Unique Name is required when ${validationContext}`,
			{ itemIndex },
		);
	}

	const botUniqueName = botUniqueNameRaw.trim();
	if (!/^[a-zA-Z0-9]+$/.test(botUniqueName)) {
		throw new NodeOperationError(
			context.getNode(),
			`Bot Unique Name must contain only letters and numbers (no spaces or special characters) when ${validationContext}`,
			{ itemIndex },
		);
	}
	if (botUniqueName.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			`Bot Unique Name is too long. Maximum length is 100 characters when ${validationContext}`,
			{ itemIndex },
		);
	}

	return {
		bot_unique_name: botUniqueName,
	};
}
