import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getOptionalBoolean, getOptionalString, isDataObject } from './common';

export function extractBot(
	context: IExecuteFunctions,
	richMessage: IDataObject,
	itemIndex: number,
): IDataObject | null {
	const postAsBot = getOptionalBoolean(
		context,
		richMessage.postAsBot,
		itemIndex,
		'postAsBot',
		false,
	);
	if (!postAsBot) {
		return null;
	}

	const bot: IDataObject = {};
	const name = getOptionalString(richMessage.botDisplayName);
	if (name) {
		bot.name = name;
	}
	const image = getOptionalString(richMessage.botImage);
	if (image) {
		bot.image = image;
	}

	return Object.keys(bot).length > 0 ? bot : null;
}

function resolveOptionalBotIdentity(
	context: IExecuteFunctions,
	itemIndex: number,
): IDataObject | null {
	const postAsBot = getOptionalBoolean(
		context,
		context.getNodeParameter('postAsBot', itemIndex, false),
		itemIndex,
		'postAsBot',
		false,
	);
	if (!postAsBot) {
		return null;
	}

	return extractBot(
		context,
		{
			postAsBot,
			botDisplayName: context.getNodeParameter('botDisplayName', itemIndex, ''),
			botImage: context.getNodeParameter('botImage', itemIndex, ''),
		},
		itemIndex,
	);
}

export function mergeOptionalBotIdentity(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
): void {
	const optionalBotIdentity = resolveOptionalBotIdentity(context, itemIndex);
	if (!optionalBotIdentity) {
		return;
	}

	if (payload.bot === undefined) {
		payload.bot = optionalBotIdentity;
		return;
	}

	if (!isDataObject(payload.bot)) {
		throw new NodeOperationError(context.getNode(), 'bot must be a JSON object when provided', {
			itemIndex,
		});
	}

	payload.bot = {
		...payload.bot,
		...optionalBotIdentity,
	};
}
