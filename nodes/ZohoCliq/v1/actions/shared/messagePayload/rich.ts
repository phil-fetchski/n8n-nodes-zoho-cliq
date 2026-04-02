import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { extractBot } from './bot';
import { extractButtons } from './buttons';
import {
	allowedCardThemes,
	allowedSlideTypes,
	allowedSlideTypesText,
	richPayloadMaxLength,
	richTextMaxLength,
	textSlideMaxLength,
} from './constants';
import {
	ensureSafeObject,
	getOptionalBoolean,
	getOptionalString,
	isDataObject,
	parseJsonObjectInput,
	serializeRichPayloadFields,
} from './common';
import { extractSlides } from './slides';
import { validateMessageText } from './text';
import { resolveCliqIconValue } from '../richUi';

function extractCard(
	context: IExecuteFunctions,
	richMessage: IDataObject,
	itemIndex: number,
): IDataObject | null {
	const card: IDataObject = {};
	const title = getOptionalString(richMessage.cardTitle);
	const theme = getOptionalString(richMessage.cardTheme);
	const legacyIconGroup = isDataObject(richMessage.cardIconGroup)
		? (richMessage.cardIconGroup as IDataObject)
		: {};
	const legacyThumbnailGroup = isDataObject(richMessage.cardThumbnailGroup)
		? (richMessage.cardThumbnailGroup as IDataObject)
		: {};
	const hasTopLevelIconFields =
		richMessage.cardIconInputMode !== undefined ||
		richMessage.cardIconIconify !== undefined ||
		richMessage.cardIconPicker !== undefined ||
		getOptionalString(richMessage.cardIcon) !== null;
	const iconGroup = hasTopLevelIconFields
		? {
				cardIconInputMode: richMessage.cardIconInputMode,
				cardIconIconify: richMessage.cardIconIconify,
				cardIconPicker: richMessage.cardIconPicker,
				cardIcon: richMessage.cardIcon,
			}
		: legacyIconGroup;
	const hasTopLevelThumbnailFields =
		richMessage.cardThumbnailInputMode !== undefined ||
		richMessage.cardThumbnailIconify !== undefined ||
		richMessage.cardThumbnailPicker !== undefined ||
		getOptionalString(richMessage.cardThumbnail) !== null;
	const thumbnailGroup = hasTopLevelThumbnailFields
		? {
				cardThumbnailInputMode: richMessage.cardThumbnailInputMode,
				cardThumbnailIconify: richMessage.cardThumbnailIconify,
				cardThumbnailPicker: richMessage.cardThumbnailPicker,
				cardThumbnail: richMessage.cardThumbnail,
			}
		: legacyThumbnailGroup;
	const iconGroupHasValues = Object.keys(iconGroup).length > 0;
	const thumbnailGroupHasValues = Object.keys(thumbnailGroup).length > 0;
	const legacyIcon = getOptionalString(richMessage.cardIcon);
	const legacyThumbnail = getOptionalString(richMessage.cardThumbnail);
	const addCardIcon = getOptionalBoolean(
		context,
		richMessage.addCardIcon,
		itemIndex,
		'addCardIcon',
		false,
	);
	const addCardThumbnail = getOptionalBoolean(
		context,
		richMessage.addCardThumbnail,
		itemIndex,
		'addCardThumbnail',
		false,
	);

	let icon: string | null = null;
	if (addCardIcon || iconGroupHasValues || legacyIcon) {
		icon =
			resolveCliqIconValue(context, itemIndex, iconGroup, {
				modeFieldName: 'cardIconInputMode',
				pickerFieldName: 'cardIconPicker',
				knownFieldName: 'cardKnownIconId',
				customFieldName: 'cardIcon',
				iconifyFieldName: 'cardIconIconify',
				pathPrefix: 'card.icon',
				allowKnownMode: false,
				allowIconifyMode: true,
			}) ?? legacyIcon;
	}

	let thumbnail: string | null = null;
	if (addCardThumbnail || thumbnailGroupHasValues || legacyThumbnail) {
		thumbnail =
			resolveCliqIconValue(context, itemIndex, thumbnailGroup, {
				modeFieldName: 'cardThumbnailInputMode',
				pickerFieldName: 'cardThumbnailPicker',
				knownFieldName: 'cardThumbnailKnownIconId',
				customFieldName: 'cardThumbnail',
				iconifyFieldName: 'cardThumbnailIconify',
				pathPrefix: 'card.thumbnail',
				allowKnownMode: false,
				allowIconifyMode: true,
			}) ?? legacyThumbnail;
	}

	if (title) {
		card.title = title;
	}

	if (thumbnail) {
		card.thumbnail = thumbnail;
	}

	if (theme) {
		if (!allowedCardThemes.has(theme)) {
			throw new NodeOperationError(
				context.getNode(),
				'Card Theme must be one of: modern-inline, basic, poll, prompt',
				{ itemIndex },
			);
		}
		card.theme = theme;
	}

	if (icon) {
		card.icon = icon;
	}

	return Object.keys(card).length > 0 ? card : null;
}

function validateRichPayloadContentLimits(
	context: IExecuteFunctions,
	payload: IDataObject,
	itemIndex: number,
): void {
	const topLevelText = getOptionalString(payload.text);
	if (topLevelText && topLevelText.length > richTextMaxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`Card Text exceeds ${richTextMaxLength} characters`,
			{ itemIndex },
		);
	}

	const slides = payload.slides;
	const card = payload.card;
	if (isDataObject(card)) {
		const cardTheme = getOptionalString(card.theme);
		if (cardTheme && !allowedCardThemes.has(cardTheme)) {
			throw new NodeOperationError(
				context.getNode(),
				'Card Theme must be one of: modern-inline, basic, poll, prompt',
				{ itemIndex },
			);
		}
	}

	if (Array.isArray(slides)) {
		slides.forEach((slide, slideIndex) => {
			if (!isDataObject(slide)) {
				return;
			}
			const slideType = getOptionalString(slide.type);
			if (slideType && !allowedSlideTypes.has(slideType)) {
				throw new NodeOperationError(
					context.getNode(),
					`Slide type at index ${slideIndex} must be one of: ${allowedSlideTypesText}`,
					{ itemIndex },
				);
			}
			if (slideType === 'text') {
				const slideText = getOptionalString(slide.data);
				if (slideText && slideText.length > textSlideMaxLength) {
					throw new NodeOperationError(
						context.getNode(),
						`Text slide at index ${slideIndex} exceeds ${textSlideMaxLength} characters`,
						{ itemIndex },
					);
				}
			}
		});
	}

	const totalLength = JSON.stringify(payload).length;
	if (totalLength > richPayloadMaxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`Rich message payload exceeds ${richPayloadMaxLength} characters`,
			{ itemIndex },
		);
	}
}

export function resolveRichMessagePayload(
	context: IExecuteFunctions,
	itemIndex: number,
	options: {
		requireMessageContent: boolean;
		textTypeErrorMessage: string;
		includeBot: boolean;
		serializeRichFields: boolean;
		requireTopLevelText: boolean;
		autoGenerateButtonKey: boolean;
	},
): IDataObject {
	const {
		requireMessageContent,
		textTypeErrorMessage,
		includeBot,
		serializeRichFields,
		requireTopLevelText,
		autoGenerateButtonKey,
	} = options;
	const hasMessageContent = (value: IDataObject): boolean =>
		Object.keys(value).some((key) => key !== 'bot');
	const payload: IDataObject = {};
	const bot = includeBot
		? extractBot(
				context,
				{
					postAsBot: context.getNodeParameter('postAsBot', itemIndex, false),
					botDisplayName: context.getNodeParameter('botDisplayName', itemIndex, ''),
					botImage: context.getNodeParameter('botImage', itemIndex, ''),
				},
				itemIndex,
			)
		: undefined;
	const cardInputMode = context.getNodeParameter(
		'cardInputMode',
		itemIndex,
		'structured',
	) as string;
	if (cardInputMode === 'raw') {
		const rawRichPayloadValue = context.getNodeParameter(
			'richPayloadJson',
			itemIndex,
			'{}',
		) as unknown;
		const rawRichPayload = parseJsonObjectInput(
			context,
			rawRichPayloadValue,
			itemIndex,
			'richPayloadJson',
			{ allowEmptyObject: false },
		);
		ensureSafeObject(context, rawRichPayload, itemIndex, 'richPayloadJson');
		validateRichPayloadContentLimits(context, rawRichPayload, itemIndex);
		if (requireTopLevelText) {
			const rawText = getOptionalString(rawRichPayload.text);
			if (!rawText) {
				throw new NodeOperationError(context.getNode(), 'Card Text is required', { itemIndex });
			}
		}

		if (bot) {
			rawRichPayload.bot = bot;
		}

		if (requireMessageContent && !hasMessageContent(rawRichPayload)) {
			throw new NodeOperationError(
				context.getNode(),
				'Rich Message must include at least one of: text, card, slides, or buttons',
				{ itemIndex },
			);
		}

		return serializeRichFields ? serializeRichPayloadFields(rawRichPayload) : rawRichPayload;
	}

	if (cardInputMode !== 'structured') {
		throw new NodeOperationError(
			context.getNode(),
			'Card Input Mode must be one of: structured, raw',
			{
				itemIndex,
			},
		);
	}

	const richTextValue = context.getNodeParameter('richText', itemIndex, '') as unknown;
	if (
		richTextValue !== undefined &&
		richTextValue !== null &&
		String(richTextValue).trim() !== ''
	) {
		payload.text = validateMessageText(
			context,
			richTextValue,
			richTextMaxLength,
			textTypeErrorMessage,
			itemIndex,
		);
	}
	if (requireTopLevelText && !payload.text) {
		throw new NodeOperationError(context.getNode(), 'Card Text is required', { itemIndex });
	}

	const addCardIcon = context.getNodeParameter('addCardIcon', itemIndex, false) as boolean;
	const addCardThumbnail = context.getNodeParameter(
		'addCardThumbnail',
		itemIndex,
		false,
	) as boolean;
	const getOptionalNodeParameter = (name: string): unknown => {
		try {
			return context.getNodeParameter(name, itemIndex, undefined);
		} catch {
			return undefined;
		}
	};
	const cardIconInputMode = addCardIcon
		? (context.getNodeParameter('cardIconInputMode', itemIndex, 'iconify') as string)
		: undefined;
	const cardThumbnailInputMode = addCardThumbnail
		? (context.getNodeParameter('cardThumbnailInputMode', itemIndex, 'iconify') as string)
		: undefined;
	const card = extractCard(
		context,
		{
			cardInputMode,
			addCardIcon,
			addCardThumbnail,
			cardIconInputMode,
			cardIconIconify:
				addCardIcon && cardIconInputMode === 'iconify'
					? context.getNodeParameter('cardIconIconify', itemIndex, '')
					: (getOptionalNodeParameter('cardIconIconify') as string | undefined),
			cardIconPicker:
				addCardIcon && cardIconInputMode === 'picker'
					? context.getNodeParameter('cardIconPicker', itemIndex, undefined)
					: undefined,
			cardIconGroup: context.getNodeParameter('cardIconGroup', itemIndex, {}),
			cardIcon:
				addCardIcon && cardIconInputMode === 'custom'
					? context.getNodeParameter('cardIcon', itemIndex, '')
					: (getOptionalNodeParameter('cardIcon') ?? ''),
			cardTheme: context.getNodeParameter('cardTheme', itemIndex, ''),
			cardThumbnailInputMode,
			cardThumbnailIconify:
				addCardThumbnail && cardThumbnailInputMode === 'iconify'
					? context.getNodeParameter('cardThumbnailIconify', itemIndex, '')
					: (getOptionalNodeParameter('cardThumbnailIconify') as string | undefined),
			cardThumbnailPicker:
				addCardThumbnail && cardThumbnailInputMode === 'picker'
					? context.getNodeParameter('cardThumbnailPicker', itemIndex, undefined)
					: undefined,
			cardThumbnailGroup: context.getNodeParameter('cardThumbnailGroup', itemIndex, {}),
			cardThumbnail:
				addCardThumbnail && cardThumbnailInputMode === 'custom'
					? context.getNodeParameter('cardThumbnail', itemIndex, '')
					: (getOptionalNodeParameter('cardThumbnail') ?? ''),
			cardTitle: context.getNodeParameter('cardTitle', itemIndex, ''),
		},
		itemIndex,
	);
	if (card) {
		payload.card = card;
	}

	const slides = extractSlides(
		context,
		context.getNodeParameter('slides', itemIndex, {}),
		itemIndex,
		{ autoGenerateButtonKey },
	);
	if (slides.length > 0) {
		payload.slides = slides;
	}

	const buttons = extractButtons(
		context,
		context.getNodeParameter('buttons', itemIndex, {}),
		itemIndex,
		{ autoGenerateButtonKey },
	);
	if (buttons.length > 0) {
		payload.buttons = buttons;
	}

	if (bot) {
		payload.bot = bot;
	}

	if (requireMessageContent && !hasMessageContent(payload)) {
		throw new NodeOperationError(
			context.getNode(),
			'Rich Message must include at least one of: text, card, slides, or buttons',
			{ itemIndex },
		);
	}

	validateRichPayloadContentLimits(context, payload, itemIndex);

	return serializeRichFields ? serializeRichPayloadFields(payload) : payload;
}

export function resolveCardPayload(
	context: IExecuteFunctions,
	itemIndex: number,
	options: {
		requireMessageContent?: boolean;
		textTypeErrorMessage?: string;
	} = {},
): IDataObject {
	const { requireMessageContent = true, textTypeErrorMessage = 'Card Text must be a string' } =
		options;

	return resolveRichMessagePayload(context, itemIndex, {
		requireMessageContent,
		textTypeErrorMessage,
		includeBot: false,
		serializeRichFields: false,
		requireTopLevelText: true,
		autoGenerateButtonKey: true,
	});
}
