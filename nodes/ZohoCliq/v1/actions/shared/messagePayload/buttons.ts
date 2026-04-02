import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { allowedButtonActions, allowedButtonTypes } from './constants';
import {
	ensureSafeObject,
	getOptionalBoolean,
	getOptionalString,
	isDataObject,
	parseJsonObjectInput,
} from './common';

const systemApiActions = new Set([
	'audiocall',
	'videocall',
	'startchat',
	'invite',
	'locationpermission',
]);

const confirmEmotions = new Set(['positive', 'neutral', 'negative']);
const confirmMandatoryValues = new Set(['true', 'false']);

export function extractButtons(
	context: IExecuteFunctions,
	buttonsValue: unknown,
	itemIndex: number,
	options: { autoGenerateButtonKey?: boolean } = {},
): IDataObject[] {
	return extractButtonsFromCollection(context, buttonsValue, itemIndex, 'buttons', options);
}

export function extractButtonsFromCollection(
	context: IExecuteFunctions,
	buttonsValue: unknown,
	itemIndex: number,
	path: string,
	options: { autoGenerateButtonKey?: boolean } = {},
): IDataObject[] {
	if (!isDataObject(buttonsValue)) {
		return [];
	}

	const buttonEntries = buttonsValue.button;
	if (!Array.isArray(buttonEntries)) {
		return [];
	}

	const returnButtons: IDataObject[] = [];
	const usedKeys = new Set<string>();
	let enabledButtonCount = 0;
	const autoGenerateButtonKey = options.autoGenerateButtonKey ?? false;

	for (let buttonIndex = 0; buttonIndex < buttonEntries.length; buttonIndex++) {
		const button = buttonEntries[buttonIndex];
		if (!isDataObject(button)) {
			throw new NodeOperationError(context.getNode(), 'Each button must be a JSON object', {
				itemIndex,
			});
		}

		const buttonPath = `${path}.button[${buttonIndex}]`;
		ensureSafeObject(context, button, itemIndex, buttonPath);

		const enabled = getOptionalBoolean(
			context,
			button.enabled,
			itemIndex,
			`${buttonPath}.enabled`,
			true,
		);
		if (!enabled) {
			continue;
		}
		enabledButtonCount += 1;

		const buttonInputMode = getOptionalString(button.buttonInputMode) ?? 'structured';
		if (buttonInputMode === 'raw') {
			const rawButton = parseJsonObjectInput(
				context,
				button.rawButton,
				itemIndex,
				`${buttonPath}.rawButton`,
				{ allowEmptyObject: false },
			);
			const hadRawKey = getOptionalString(rawButton.key);
			ensureSafeObject(context, rawButton, itemIndex, `${buttonPath}.rawButton`);
			const normalizedRawButton = validateAndNormalizeRawButton(
				context,
				rawButton,
				itemIndex,
				buttonIndex,
			);
			if (autoGenerateButtonKey || Boolean(hadRawKey)) {
				registerButtonKey(context, normalizedRawButton, usedKeys, itemIndex, buttonIndex);
			}
			if (!autoGenerateButtonKey && !hadRawKey) {
				delete normalizedRawButton.key;
			}
			returnButtons.push(normalizedRawButton);
			continue;
		}

		if (buttonInputMode !== 'structured') {
			throw new NodeOperationError(
				context.getNode(),
				`Button Input Mode at index ${buttonIndex} must be one of: structured, raw`,
				{ itemIndex },
			);
		}

		const label = getRequiredTrimmedString(
			context,
			button.label,
			itemIndex,
			'Button Label is required',
		);
		validateMaxLength(context, label, 20, 'Button Label', itemIndex);

		const actionType = getOptionalString(button.actionType);
		if (!actionType || !allowedButtonActions.has(actionType)) {
			throw new NodeOperationError(
				context.getNode(),
				'Button Action Type must be one of: invoke.function, open.url, system.api, copy, preview.url',
				{ itemIndex },
			);
		}

		const actionData = resolveButtonActionData(context, button, actionType, itemIndex, buttonIndex);
		ensureSafeObject(context, actionData, itemIndex, `${buttonPath}.actionData`);

		const action: IDataObject = {
			type: actionType,
			data: actionData,
		};
		const confirm = resolveStructuredConfirm(context, button, itemIndex, buttonIndex);
		if (confirm) {
			action.confirm = confirm;
		}

		const sanitizedButton: IDataObject = {
			label,
			action,
		};

		const hint = getOptionalString(button.hint);
		if (hint) {
			validateMaxLength(context, hint, 100, 'Button Hint', itemIndex);
			sanitizedButton.hint = hint;
		}

		const explicitKey = getOptionalString(button.key);
		if (explicitKey) {
			validateMaxLength(context, explicitKey, 100, 'Button Key', itemIndex);
			if (usedKeys.has(explicitKey)) {
				throw new NodeOperationError(
					context.getNode(),
					`Button Key "${explicitKey}" must be unique within the same button collection`,
					{
						itemIndex,
					},
				);
			}
			usedKeys.add(explicitKey);
			sanitizedButton.key = explicitKey;
		} else if (autoGenerateButtonKey) {
			const key = resolveButtonKey(label, enabledButtonCount, usedKeys);
			sanitizedButton.key = key;
		}

		const buttonType = getOptionalString(button.type);
		if (buttonType) {
			if (!allowedButtonTypes.has(buttonType)) {
				throw new NodeOperationError(
					context.getNode(),
					'Button Type must be "+", "-", or empty for neutral',
					{
						itemIndex,
					},
				);
			}
			sanitizedButton.type = buttonType;
		}

		returnButtons.push(sanitizedButton);
	}

	return returnButtons;
}

function resolveButtonActionData(
	context: IExecuteFunctions,
	button: IDataObject,
	actionType: string,
	itemIndex: number,
	buttonIndex: number,
): IDataObject {
	const actionDataInputMode =
		getOptionalString(button.actionDataInputMode) ??
		(actionType === 'copy' || actionType === 'preview.url' ? 'raw' : 'structured');
	if (actionDataInputMode === 'raw') {
		const rawActionData = parseJsonObjectInput(
			context,
			button.actionData,
			itemIndex,
			`buttons.button[${buttonIndex}].actionData`,
			{ allowEmptyObject: false },
		);
		validateActionDataByType(context, actionType, rawActionData, itemIndex, buttonIndex);
		return rawActionData;
	}

	if (actionDataInputMode === 'structured') {
		const structuredData = buildStructuredActionData(
			context,
			button,
			actionType,
			itemIndex,
			buttonIndex,
		);
		validateActionDataByType(context, actionType, structuredData, itemIndex, buttonIndex);
		return structuredData;
	}

	throw new NodeOperationError(
		context.getNode(),
		`Action Data Input Mode at button index ${buttonIndex} must be one of: structured, raw`,
		{ itemIndex },
	);
}

function buildStructuredActionData(
	context: IExecuteFunctions,
	button: IDataObject,
	actionType: string,
	itemIndex: number,
	buttonIndex: number,
): IDataObject {
	const actionData: IDataObject = {};

	if (actionType === 'open.url') {
		const web = getOptionalString(button.openUrlWeb);
		const android = getOptionalString(button.openUrlAndroid);
		const ios = getOptionalString(button.openUrlIos);

		if (web) {
			actionData.web = web;
		}
		if (android) {
			actionData.android = android;
		}
		if (ios) {
			actionData.ios = ios;
		}
	}

	if (actionType === 'invoke.function') {
		const functionName = getOptionalString(button.invokeFunctionName);
		if (functionName) {
			actionData.name = functionName;
		}
	}

	if (actionType === 'system.api') {
		const apiAction = getOptionalString(button.systemApiAction);
		if (apiAction && systemApiActions.has(apiAction)) {
			if (apiAction === 'locationpermission') {
				actionData.api = apiAction;
			} else {
				const userId = getOptionalString(button.systemApiUserId);
				if (userId) {
					actionData.api = `${apiAction}/${userId}`;
				}
			}
		}

		if (apiAction && !systemApiActions.has(apiAction)) {
			throw new NodeOperationError(
				context.getNode(),
				`Button at index ${buttonIndex} has unsupported system.api action "${apiAction}"`,
				{ itemIndex },
			);
		}
	}

	if (actionType === 'copy') {
		const copyText = getOptionalString(button.copyText) ?? getOptionalString(button.copyValue);
		if (copyText) {
			actionData.text = copyText;
		}
	}

	if (actionType === 'preview.url') {
		const previewUrl = getOptionalString(button.previewUrl);
		if (previewUrl) {
			actionData.url = previewUrl;
		}
	}

	return actionData;
}

function validateActionDataByType(
	context: IExecuteFunctions,
	actionType: string,
	actionData: IDataObject,
	itemIndex: number,
	buttonIndex: number,
): void {
	switch (actionType) {
		case 'open.url': {
			const url = getOptionalString(actionData.url);
			const web = getOptionalString(actionData.web);
			const android = getOptionalString(actionData.android);
			const ios = getOptionalString(actionData.ios);
			if (!url && !web && !android && !ios) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type open.url requires at least one of: url, web, android, ios`,
					{ itemIndex },
				);
			}
			return;
		}
		case 'invoke.function': {
			const name = getOptionalString(actionData.name);
			if (!name) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type invoke.function requires action data field "name"`,
					{ itemIndex },
				);
			}
			return;
		}
		case 'system.api': {
			const api = getOptionalString(actionData.api);
			if (!api) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type system.api requires action data field "api"`,
					{ itemIndex },
				);
			}
			if (api === 'locationpermission') {
				return;
			}
			if (!/^(audiocall|videocall|startchat|invite)\/[^/\s]+$/.test(api)) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type system.api expects api format "<system_action>/<zuid>" or "locationpermission"`,
					{ itemIndex },
				);
			}
			return;
		}
		case 'copy': {
			if (Object.keys(actionData).length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type copy requires a non-empty action.data object`,
					{ itemIndex },
				);
			}
			const text = getOptionalString(actionData.text);
			const value = getOptionalString(actionData.value);
			if (!text && !value) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type copy requires action data field "text" or "value"`,
					{ itemIndex },
				);
			}
			return;
		}
		case 'preview.url': {
			const url = getOptionalString(actionData.url);
			if (!url) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type preview.url requires action data field "url"`,
					{ itemIndex },
				);
			}
			if (!isValidAbsoluteUrl(url)) {
				throw new NodeOperationError(
					context.getNode(),
					`Button at index ${buttonIndex} with action type preview.url requires a valid absolute HTTPS URL in action data field "url"`,
					{ itemIndex },
				);
			}
			return;
		}
	}
}

function isValidAbsoluteUrl(value: string): boolean {
	try {
		const parsed = new URL(value);
		return parsed.protocol === 'https:' && Boolean(parsed.host);
	} catch {
		return false;
	}
}

function resolveStructuredConfirm(
	context: IExecuteFunctions,
	button: IDataObject,
	itemIndex: number,
	buttonIndex: number,
): IDataObject | undefined {
	const enableConfirm = getOptionalBoolean(
		context,
		button.enableConfirm,
		itemIndex,
		`buttons.button[${buttonIndex}].enableConfirm`,
		false,
	);
	if (!enableConfirm) {
		return undefined;
	}

	const confirm = extractConfirmFromFields(context, button, itemIndex, buttonIndex, 'buttons');
	validateConfirmObject(context, confirm, itemIndex, buttonIndex, 'buttons');
	return confirm;
}

function extractConfirmFromFields(
	context: IExecuteFunctions,
	button: IDataObject,
	itemIndex: number,
	buttonIndex: number,
	path: string,
): IDataObject {
	const title = getRequiredTrimmedString(
		context,
		button.confirmTitle,
		itemIndex,
		`${path}.button[${buttonIndex}].confirmTitle is required when confirmation is enabled`,
	);
	const input = getRequiredTrimmedString(
		context,
		button.confirmInput,
		itemIndex,
		`${path}.button[${buttonIndex}].confirmInput is required when confirmation is enabled`,
	);
	const buttonLabel = getRequiredTrimmedString(
		context,
		button.confirmButtonLabel,
		itemIndex,
		`${path}.button[${buttonIndex}].confirmButtonLabel is required when confirmation is enabled`,
	);

	const confirm: IDataObject = {
		title,
		input,
		button_label: buttonLabel,
	};

	const description = getOptionalString(button.confirmDescription);
	if (description) {
		confirm.description = description;
	}

	const cancelButtonLabel = getOptionalString(button.confirmCancelButtonLabel);
	if (cancelButtonLabel) {
		confirm.cancel_button_label = cancelButtonLabel;
	}

	const emotion = getOptionalString(button.confirmEmotion);
	if (emotion) {
		confirm.emotion = emotion;
	}

	const mandatory = getOptionalString(button.confirmMandatory);
	if (mandatory) {
		confirm.mandatory = mandatory;
	}

	return confirm;
}

function validateConfirmObject(
	context: IExecuteFunctions,
	confirm: IDataObject,
	itemIndex: number,
	buttonIndex: number,
	path: string,
): void {
	const confirmPath = `${path}.button[${buttonIndex}].action.confirm`;
	const title = getOptionalString(confirm.title);
	if (!title) {
		throw new NodeOperationError(context.getNode(), `${confirmPath}.title is required`, {
			itemIndex,
		});
	}
	validateMaxLength(context, title, 100, `${confirmPath}.title`, itemIndex);

	const input = getOptionalString(confirm.input);
	if (!input) {
		throw new NodeOperationError(context.getNode(), `${confirmPath}.input is required`, {
			itemIndex,
		});
	}
	validateMaxLength(context, input, 300, `${confirmPath}.input`, itemIndex);

	const buttonLabel = getOptionalString(confirm.button_label);
	if (!buttonLabel) {
		throw new NodeOperationError(context.getNode(), `${confirmPath}.button_label is required`, {
			itemIndex,
		});
	}
	validateMaxLength(context, buttonLabel, 100, `${confirmPath}.button_label`, itemIndex);

	const description = getOptionalString(confirm.description);
	if (description) {
		validateMaxLength(context, description, 100, `${confirmPath}.description`, itemIndex);
	}

	const cancelButtonLabel = getOptionalString(confirm.cancel_button_label);
	if (cancelButtonLabel) {
		validateMaxLength(
			context,
			cancelButtonLabel,
			100,
			`${confirmPath}.cancel_button_label`,
			itemIndex,
		);
	}

	const emotion = getOptionalString(confirm.emotion);
	if (emotion && !confirmEmotions.has(emotion)) {
		throw new NodeOperationError(
			context.getNode(),
			`${confirmPath}.emotion must be one of: positive, neutral, negative`,
			{
				itemIndex,
			},
		);
	}

	const mandatory = getOptionalString(confirm.mandatory);
	if (mandatory && !confirmMandatoryValues.has(mandatory)) {
		throw new NodeOperationError(
			context.getNode(),
			`${confirmPath}.mandatory must be one of: true, false`,
			{
				itemIndex,
			},
		);
	}
}

function resolveButtonKey(
	label: string,
	enabledButtonCount: number,
	usedKeys: Set<string>,
): string {
	const base = `${slugifyLabel(label)}_${enabledButtonCount}`;
	let generated = base;
	let sequence = 2;
	while (usedKeys.has(generated)) {
		generated = `${base}_${sequence}`;
		sequence += 1;
	}
	usedKeys.add(generated);
	return generated;
}

function registerButtonKey(
	context: IExecuteFunctions,
	button: IDataObject,
	usedKeys: Set<string>,
	itemIndex: number,
	buttonIndex: number,
): void {
	// validateAndNormalizeRawButton guarantees a non-empty label before this helper is called.
	const label = getOptionalString(button.label)!;
	const existingKey = getOptionalString(button.key);
	if (existingKey) {
		validateMaxLength(context, existingKey, 100, 'Button Key', itemIndex);
		if (usedKeys.has(existingKey)) {
			throw new NodeOperationError(
				context.getNode(),
				`Raw button at index ${buttonIndex} has duplicate key "${existingKey}"`,
				{
					itemIndex,
				},
			);
		}
		usedKeys.add(existingKey);
		return;
	}

	const generated = resolveButtonKey(label, usedKeys.size + 1, usedKeys);
	button.key = generated;
}

function slugifyLabel(label: string): string {
	const normalized = label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
	return normalized || 'button';
}

function validateMaxLength(
	context: IExecuteFunctions,
	value: string,
	maxLength: number,
	fieldName: string,
	itemIndex: number,
): void {
	if (value.length > maxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} exceeds ${maxLength} characters`,
			{
				itemIndex,
			},
		);
	}
}

function getRequiredTrimmedString(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	errorMessage: string,
): string {
	const normalized = getOptionalString(value);
	if (!normalized) {
		throw new NodeOperationError(context.getNode(), errorMessage, { itemIndex });
	}
	return normalized;
}

function validateAndNormalizeRawButton(
	context: IExecuteFunctions,
	button: IDataObject,
	itemIndex: number,
	buttonIndex: number,
): IDataObject {
	const label = getOptionalString(button.label);
	if (!label) {
		throw new NodeOperationError(
			context.getNode(),
			`Raw button at index ${buttonIndex} is missing required field "label"`,
			{ itemIndex },
		);
	}
	validateMaxLength(context, label, 20, 'Button Label', itemIndex);

	const hint = getOptionalString(button.hint);
	if (hint) {
		validateMaxLength(context, hint, 100, 'Button Hint', itemIndex);
	}

	const key = getOptionalString(button.key);
	if (key) {
		validateMaxLength(context, key, 100, 'Button Key', itemIndex);
	}

	const action = button.action;
	if (!isDataObject(action)) {
		throw new NodeOperationError(
			context.getNode(),
			`Raw button at index ${buttonIndex} is missing required object field "action"`,
			{ itemIndex },
		);
	}

	const actionType = getOptionalString(action.type);
	if (!actionType || !allowedButtonActions.has(actionType)) {
		throw new NodeOperationError(
			context.getNode(),
			'Button Action Type must be one of: invoke.function, open.url, system.api, copy, preview.url',
			{ itemIndex },
		);
	}

	const actionData = action.data;
	if (!isDataObject(actionData)) {
		throw new NodeOperationError(
			context.getNode(),
			`Raw button at index ${buttonIndex} is missing required object field "action.data"`,
			{ itemIndex },
		);
	}

	validateActionDataByType(context, actionType, actionData, itemIndex, buttonIndex);

	const rawConfirm = action.confirm;
	if (rawConfirm !== undefined) {
		if (!isDataObject(rawConfirm)) {
			throw new NodeOperationError(
				context.getNode(),
				`Raw button at index ${buttonIndex} field "action.confirm" must be an object`,
				{ itemIndex },
			);
		}
		validateConfirmObject(context, rawConfirm, itemIndex, buttonIndex, 'buttons');
	}

	const buttonType = getOptionalString(button.type);
	if (buttonType && !allowedButtonTypes.has(buttonType)) {
		throw new NodeOperationError(
			context.getNode(),
			'Button Type must be "+", "-", or empty for neutral',
			{
				itemIndex,
			},
		);
	}

	return button;
}
