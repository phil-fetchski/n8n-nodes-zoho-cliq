import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { parseBooleanLikeTrue } from '../../helpers/utils';
import { buildCliqRecoverableErrorPayload } from '../shared/errorResponse';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const botUniqueNamePattern = /^[a-z]+$/;
const allowedActionTypes = new Set(['open.url', 'invoke.function', 'system.api', 'open.dialog']);
const knownSystemApiActions = new Set([
	'audiocall',
	'videocall',
	'startchat',
	'invite',
	'locationpermission',
]);

function validateSystemApiValue(
	context: IExecuteFunctions,
	apiValue: string,
	itemIndex: number,
	actionIndex: number,
): string {
	const sanitized = apiValue.trim();
	const match = sanitized.match(/^([a-z]+)\/([^/\s]+)$/);
	if (!match) {
		throw new NodeOperationError(
			context.getNode(),
			`Call Payload actions[${actionIndex}].action.data.api must use format "<system_action>/<user_id>"`,
			{ itemIndex },
		);
	}

	const actionName = match[1];
	if (!knownSystemApiActions.has(actionName)) {
		throw new NodeOperationError(
			context.getNode(),
			`Call Payload actions[${actionIndex}].action.data.api uses unsupported system action "${actionName}". Allowed values: audiocall, videocall, startchat, invite, locationpermission`,
			{ itemIndex },
		);
	}

	return sanitized;
}

function getOptionalString(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	const normalized = String(value).trim();
	return normalized ? normalized : undefined;
}

export function validateBotUniqueName(
	context: IExecuteFunctions,
	botUniqueName: string,
	itemIndex: number,
): string {
	if (!botUniqueName || !botUniqueName.trim()) {
		throw new NodeOperationError(context.getNode(), 'Bot Unique Name is required', { itemIndex });
	}

	const sanitized = botUniqueName.trim();
	if (sanitized.length > 120) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Unique Name is too long. Maximum length is 120 characters.',
			{ itemIndex },
		);
	}

	if (!botUniqueNamePattern.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid Bot Unique Name format. Use lowercase letters only (a-z) with no numbers, spaces, or special characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

export function buildBotRecoverableErrorPayload(
	error: unknown,
	botUniqueName?: string,
	operation: 'getSubscribers' | 'triggerCalls' | 'unknown' = 'unknown',
): IDataObject {
	const normalizedBotUniqueName = botUniqueName?.trim() || undefined;

	return buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'bot',
			operation,
		},
		{
			contextFields: normalizedBotUniqueName
				? {
						bot_unique_name: normalizedBotUniqueName,
					}
				: undefined,
			messageMappings: [
				{
					match: (normalizedMessage) =>
						normalizedMessage.includes('request url is invalid') ||
						normalizedMessage.includes('check the url pattern'),
					messageOverride:
						'Bot Unique Name was rejected. Use the exact existing bot unique name in lowercase letters only (a-z), with no numbers, spaces, or special characters.',
					reason: 'INVALID_BOT_UNIQUE_NAME',
					hint: 'Use the bot unique name value from Cliq (for example, spotthewatchdog), not the display name.',
				},
				{
					match: (normalizedMessage) =>
						normalizedMessage.includes("bot you're looking for couldn't be found") ||
						(normalizedMessage.includes('bot') &&
							normalizedMessage.includes("couldn't be found")) ||
						(normalizedMessage.includes('bot') && normalizedMessage.includes('not found')),
					reason: 'BOT_NOT_FOUND',
					hint: 'Verify the bot exists and that the authenticated account can access the bot subscribers/calls endpoint.',
				},
			],
		},
	);
}

export function isBotAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

export function pushBotRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	error: unknown,
	botUniqueName?: string,
	operation: 'getSubscribers' | 'triggerCalls' | 'unknown' = 'unknown',
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isBotAiErrorModeEnabled(context, itemIndex);

	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		const executionData = context.helpers.constructExecutionMetaData(
			[{ json: { ...(scopePayload as IDataObject) } }],
			{ itemData: { item: itemIndex } },
		);
		returnData.push(...executionData);
		return true;
	}

	const errorPayload = buildBotRecoverableErrorPayload(error, botUniqueName, operation);
	const executionData = context.helpers.constructExecutionMetaData([{ json: errorPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export function ensureSafeObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (value === null || value === undefined) {
		return;
	}

	if (typeof value !== 'object') {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	if (Array.isArray(value)) {
		for (let idx = 0; idx < value.length; idx++) {
			const arrayValue = value[idx];
			if (arrayValue && typeof arrayValue === 'object') {
				ensureSafeObject(context, arrayValue, itemIndex, `${path}[${idx}]`);
			}
		}
		return;
	}

	for (const key of Object.keys(value as IDataObject)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{ itemIndex },
			);
		}

		const child = (value as IDataObject)[key];
		if (child && typeof child === 'object') {
			ensureSafeObject(context, child, itemIndex, `${path}.${key}`);
		}
	}
}

export function parseBotPayloadInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (value === null || value === undefined) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	if (typeof value === 'string') {
		const rawValue = value.trim();
		if (!rawValue) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
				itemIndex,
			});
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(rawValue);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a valid JSON object when provided as text`,
				{ itemIndex },
			);
		}

		if (Array.isArray(parsed)) {
			throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
				itemIndex,
			});
		}

		ensureSafeObject(context, parsed, itemIndex, path);
		return parsed as IDataObject;
	}

	if (Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	ensureSafeObject(context, value, itemIndex, path);
	return value as IDataObject;
}

export function parseDelimitedIds(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): string[] {
	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must be a string containing comma-separated IDs`,
			{ itemIndex },
		);
	}

	const ids = value
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id.length > 0);

	if (ids.length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} must contain at least one ID`, {
			itemIndex,
		});
	}

	return ids;
}

export function validateTriggerCallPayload(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
): IDataObject {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new NodeOperationError(context.getNode(), 'Call Payload must be a JSON object', {
			itemIndex,
		});
	}

	ensureSafeObject(context, payload, itemIndex, 'Call Payload');

	const text = String(payload.text ?? '').trim();
	if (!text) {
		throw new NodeOperationError(context.getNode(), 'Call Payload text is required', { itemIndex });
	}
	if (text.length > 500) {
		throw new NodeOperationError(
			context.getNode(),
			'Call Payload text is too long. Maximum length is 500 characters.',
			{ itemIndex },
		);
	}

	if (payload.user_ids !== undefined) {
		if (!Array.isArray(payload.user_ids)) {
			throw new NodeOperationError(context.getNode(), 'Call Payload user_ids must be an array', {
				itemIndex,
			});
		}
		if (payload.user_ids.length > 10) {
			throw new NodeOperationError(
				context.getNode(),
				'Call Payload user_ids cannot exceed 10 items',
				{ itemIndex },
			);
		}
		for (const userId of payload.user_ids) {
			const sanitizedUserId = String(userId ?? '').trim();
			if (!sanitizedUserId) {
				throw new NodeOperationError(
					context.getNode(),
					'Call Payload user_ids cannot contain empty values',
					{ itemIndex },
				);
			}
			if (sanitizedUserId.length > 255) {
				throw new NodeOperationError(
					context.getNode(),
					'Call Payload user_ids values are too long. Maximum length is 255 characters.',
					{ itemIndex },
				);
			}
		}
	}

	if (payload.retry !== undefined) {
		const retry = Number(payload.retry);
		if (!Number.isInteger(retry) || retry < 1 || retry > 3) {
			throw new NodeOperationError(
				context.getNode(),
				'Call Payload retry must be a whole number between 1 and 3',
				{ itemIndex },
			);
		}
	}

	if (payload.loop !== undefined) {
		const loop = Number(payload.loop);
		if (!Number.isInteger(loop) || loop < 1 || loop > 3) {
			throw new NodeOperationError(
				context.getNode(),
				'Call Payload loop must be a whole number between 1 and 3',
				{ itemIndex },
			);
		}
	}

	if (payload.actions !== undefined) {
		if (!Array.isArray(payload.actions)) {
			throw new NodeOperationError(context.getNode(), 'Call Payload actions must be an array', {
				itemIndex,
			});
		}
		if (payload.actions.length > 5) {
			throw new NodeOperationError(
				context.getNode(),
				'Call Payload actions cannot exceed 5 items',
				{ itemIndex },
			);
		}

		for (let actionIndex = 0; actionIndex < payload.actions.length; actionIndex++) {
			const action = payload.actions[actionIndex];
			if (!action || typeof action !== 'object' || Array.isArray(action)) {
				throw new NodeOperationError(
					context.getNode(),
					`Call Payload actions[${actionIndex}] must be a JSON object`,
					{ itemIndex },
				);
			}

			const actionObject = action as IDataObject;
			const label = getOptionalString(actionObject.label);
			if (!label) {
				throw new NodeOperationError(
					context.getNode(),
					`Call Payload actions[${actionIndex}].label is required`,
					{ itemIndex },
				);
			}
			if (label.length > 20) {
				throw new NodeOperationError(
					context.getNode(),
					`Call Payload actions[${actionIndex}].label is too long. Maximum length is 20 characters.`,
					{ itemIndex },
				);
			}

			for (const optionalField of ['icon', 'hint', 'key']) {
				const fieldValue = getOptionalString(actionObject[optionalField]);
				if (fieldValue && fieldValue.length > 255) {
					throw new NodeOperationError(
						context.getNode(),
						`Call Payload actions[${actionIndex}].${optionalField} is too long. Maximum length is 255 characters.`,
						{ itemIndex },
					);
				}
			}

			const nestedAction = actionObject.action;
			if (!nestedAction || typeof nestedAction !== 'object' || Array.isArray(nestedAction)) {
				throw new NodeOperationError(
					context.getNode(),
					`Call Payload actions[${actionIndex}].action must be a JSON object`,
					{ itemIndex },
				);
			}

			const nestedActionObject = nestedAction as IDataObject;
			const actionType = getOptionalString(nestedActionObject.type);
			if (!actionType || !allowedActionTypes.has(actionType)) {
				throw new NodeOperationError(
					context.getNode(),
					`Call Payload actions[${actionIndex}].action.type must be one of: open.url, invoke.function, system.api, open.dialog`,
					{ itemIndex },
				);
			}

			const actionData = nestedActionObject.data;
			if (!actionData || typeof actionData !== 'object' || Array.isArray(actionData)) {
				throw new NodeOperationError(
					context.getNode(),
					`Call Payload actions[${actionIndex}].action.data must be a JSON object`,
					{ itemIndex },
				);
			}

			const actionDataObject = actionData as IDataObject;
			if (actionType === 'open.url') {
				const webUrl = getOptionalString(actionDataObject.web);
				if (!webUrl) {
					throw new NodeOperationError(
						context.getNode(),
						`Call Payload actions[${actionIndex}].action.data.web is required for open.url`,
						{ itemIndex },
					);
				}
				if (!/^https?:\/\/\S+$/i.test(webUrl)) {
					throw new NodeOperationError(
						context.getNode(),
						`Call Payload actions[${actionIndex}].action.data.web must be a valid HTTP/HTTPS URL`,
						{ itemIndex },
					);
				}
			}

			if (actionType === 'invoke.function') {
				const functionName = getOptionalString(actionDataObject.name);
				if (!functionName) {
					throw new NodeOperationError(
						context.getNode(),
						`Call Payload actions[${actionIndex}].action.data.name is required for invoke.function`,
						{ itemIndex },
					);
				}
			}

			if (actionType === 'system.api') {
				const apiValue = getOptionalString(actionDataObject.api);
				if (!apiValue) {
					throw new NodeOperationError(
						context.getNode(),
						`Call Payload actions[${actionIndex}].action.data.api is required for system.api`,
						{ itemIndex },
					);
				}
				validateSystemApiValue(context, apiValue, itemIndex, actionIndex);
			}
		}
	}

	return payload;
}
