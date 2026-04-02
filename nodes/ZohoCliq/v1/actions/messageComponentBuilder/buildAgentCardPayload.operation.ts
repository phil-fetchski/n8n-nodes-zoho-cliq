import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { MESSAGE_COMPONENT_BUILDER_AGENT_CARD_PAYLOAD_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { extractButtons } from '../shared/messagePayload/buttons';
import {
	allowedSlideTypes,
	allowedSlideTypesText,
	allowedCardThemes,
	richPayloadMaxLength,
	richTextMaxLength,
	textSlideMaxLength,
} from '../shared/messagePayload/constants';
import { isDataObject, parseJsonInput } from '../shared/messagePayload/common';
import { extractSlides } from '../shared/messagePayload/slides';
import { appendExecutionData, applyResourceDisplayOptions } from './common';

const operationName = 'buildAgentCardPayload';

const properties: INodeProperties[] = [
	{
		displayName:
			'Build a validated Zoho Cliq rich message payload object for AI-agent workflows. This operation is the recommended Message Component Builder tool for agents and returns only the final payload object.',
		name: 'buildAgentCardPayloadNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Card Theme',
		name: 'theme',
		type: 'string',
		default: '',
		description:
			'Optional card theme string. Leave blank to omit. ENUM: ["modern-inline", "basic", "poll", "prompt"].',
	},
	{
		displayName: 'Card Title',
		name: 'title',
		type: 'string',
		default: '',
		description: 'Optional card title shown in the card object. Leave blank to omit.',
	},
	{
		displayName: 'Card Text',
		name: 'text',
		type: 'string',
		typeOptions: {
			rows: 4,
			maxLength: richTextMaxLength,
		},
		default: '',
		required: true,
		description:
			'Required top-level message text. Supports Zoho Cliq markdown such as bold, italics, strike, inline code, code blocks, and links. This builder caps text at 4096 characters so the payload remains safe for Post Message, Edit Message, and Schedule Message reuse.',
	},
	{
		displayName: 'Card Icon URL',
		name: 'iconUrl',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/icon.svg',
		description:
			'Optional direct icon image URL for card.icon. Use an absolute HTTPS URL that ends in .png or .svg. Leave blank to omit.',
	},
	{
		displayName: 'Card Thumbnail URL',
		name: 'thumbnailUrl',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/thumbnail.png',
		description:
			'Optional direct thumbnail image URL for card.thumbnail. Use an absolute HTTPS URL that ends in .png or .svg. Leave blank to omit.',
	},
	{
		displayName: 'Slides JSON',
		name: 'slidesJson',
		type: 'json',
		default: '',
		description:
			'Optional JSON array of Zoho Cliq slide objects. Provide either a native JSON array or a stringified JSON array. Leave blank to omit slides. Each array item becomes one slide in payload.slides. Table slide `data.rows` entries must be JSON objects whose keys match the `data.headers` values. Graph slide data items require `category` and `values` keys, where `values` is an array of objects with `label` and `value` keys.',
	},
	{
		displayName: 'Buttons JSON',
		name: 'buttonsJson',
		type: 'json',
		default: '',
		description:
			'Optional JSON array of Zoho Cliq button objects. Provide either a native JSON array or a stringified JSON array. Leave blank to omit top-level card buttons. Slide-level buttons belong inside the relevant slide object.',
	},
	{
		displayName:
			'AI Tool Setup Recommendation: Manually set <b>Operation</b> to <b>Agent Card Payload Builder</b> before configuring this node as a tool. This operation is the dedicated tool-facing rich payload builder for Zoho Cliq message objects.',
		name: 'agentCardPayloadBuilderAiToolNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Message Component Builder/Agent Card Payload Builder as AI Tool Setup Guide: <a href="${MESSAGE_COMPONENT_BUILDER_AGENT_CARD_PAYLOAD_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'agentCardPayloadBuilderAiGuideNotice',
		type: 'notice',
		default: '',
	},
];

export const description: INodeProperties[] = applyResourceDisplayOptions(
	properties,
	operationName,
);

const allowedPercentageChartPreviewTypes = new Set(['pie', 'doughnut', 'semi_doughnut']);
const allowedGraphPreviewTypes = new Set(['vertical_bar', 'vertical_stacked_bar', 'trend']);

function getOptionalTrimmedStringParameter(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
	label: string,
): string | null {
	const value = context.getNodeParameter(name, itemIndex, '') as unknown;

	if (value === undefined || value === null || value === '') {
		return null;
	}

	if (typeof value !== 'string') {
		throw new NodeOperationError(context.getNode(), `${label} must be a string`, { itemIndex });
	}

	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return null;
	}

	return trimmed;
}

function getRequiredTrimmedText(context: IExecuteFunctions, itemIndex: number): string {
	const value = context.getNodeParameter('text', itemIndex, '') as unknown;

	if (typeof value !== 'string') {
		throw new NodeOperationError(context.getNode(), 'Card Text must be a string', { itemIndex });
	}

	const trimmed = value.trim();
	if (!trimmed) {
		throw new NodeOperationError(context.getNode(), 'Card Text is required', { itemIndex });
	}

	if (trimmed.length > richTextMaxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`Card Text exceeds ${richTextMaxLength} characters`,
			{ itemIndex },
		);
	}

	return trimmed;
}

function validateDirectImageUrl(
	context: IExecuteFunctions,
	itemIndex: number,
	value: string,
	label: string,
): string {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		throw new NodeOperationError(context.getNode(), `${label} must be a valid absolute URL`, {
			itemIndex,
		});
	}

	if (url.protocol !== 'https:') {
		throw new NodeOperationError(context.getNode(), `${label} must start with "https://"`, {
			itemIndex,
		});
	}

	if (!/\.(png|svg)$/i.test(url.pathname)) {
		throw new NodeOperationError(
			context.getNode(),
			`${label} must point to a direct .png or .svg image URL`,
			{ itemIndex },
		);
	}

	return value;
}

function parseOptionalObjectArrayParameter(
	context: IExecuteFunctions,
	name: 'slidesJson' | 'buttonsJson',
	itemIndex: number,
	label: string,
): IDataObject[] {
	const value = context.getNodeParameter(name, itemIndex, '') as unknown;

	if (value === undefined || value === null) {
		return [];
	}

	if (typeof value === 'string' && value.trim() === '') {
		return [];
	}

	const parsed = parseJsonInput(context, value, itemIndex, label);
	if (!Array.isArray(parsed)) {
		throw new NodeOperationError(
			context.getNode(),
			`${label} must be a JSON array of objects. Leave it blank to omit this section.`,
			{ itemIndex },
		);
	}

	parsed.forEach((entry, index) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(context.getNode(), `${label}[${index}] must be a JSON object`, {
				itemIndex,
			});
		}
	});

	return parsed as IDataObject[];
}

function validateCardTheme(
	context: IExecuteFunctions,
	itemIndex: number,
	value: string | null,
): string | null {
	if (!value) {
		return null;
	}

	if (!allowedCardThemes.has(value)) {
		throw new NodeOperationError(
			context.getNode(),
			'Card Theme must be one of: modern-inline, basic, poll, prompt',
			{ itemIndex },
		);
	}

	return value;
}

function validateTextSlide(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	const textData = slide.data;
	if (typeof textData !== 'string' || textData.trim().length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must be a non-empty string for text slides`,
			{ itemIndex },
		);
	}

	const trimmed = textData.trim();
	if (trimmed.length > textSlideMaxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data exceeds ${textSlideMaxLength} characters for text slides`,
			{ itemIndex },
		);
	}

	slide.data = trimmed;
}

function getRequiredNestedString(
	context: IExecuteFunctions,
	itemIndex: number,
	path: string,
	value: unknown,
): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} is required and must be a non-empty string`,
			{
				itemIndex,
			},
		);
	}

	return value.trim();
}

function getRequiredNestedNumber(
	context: IExecuteFunctions,
	itemIndex: number,
	path: string,
	value: unknown,
): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new NodeOperationError(context.getNode(), `${path} is required and must be a number`, {
			itemIndex,
		});
	}

	return value;
}

function validateAbsoluteHttpsUrl(
	context: IExecuteFunctions,
	itemIndex: number,
	path: string,
	value: unknown,
): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} must be a valid absolute HTTPS URL`, {
			itemIndex,
		});
	}

	const normalized = value.trim();

	let url: URL;
	try {
		url = new URL(normalized);
	} catch {
		throw new NodeOperationError(context.getNode(), `${path} must be a valid absolute HTTPS URL`, {
			itemIndex,
		});
	}

	if (url.protocol !== 'https:' || !url.host) {
		throw new NodeOperationError(context.getNode(), `${path} must be a valid absolute HTTPS URL`, {
			itemIndex,
		});
	}

	return normalized;
}

function normalizeOptionalSlideTitle(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	if (slide.title === undefined) {
		return;
	}

	if (typeof slide.title !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].title must be a string`,
			{
				itemIndex,
			},
		);
	}

	const trimmed = slide.title.trim();
	if (trimmed.length === 0) {
		delete slide.title;
		return;
	}

	slide.title = trimmed;
}

function getOptionalStylesObject(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): IDataObject | null {
	if (slide.styles === undefined) {
		return null;
	}

	if (!isDataObject(slide.styles)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].styles must be a JSON object`,
			{ itemIndex },
		);
	}

	return slide.styles;
}

function formatNumericTotal(value: number): string {
	return Number(value.toFixed(6)).toString();
}

function validateImagesSlide(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	if (!Array.isArray(slide.data)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must be an array of image URLs`,
			{ itemIndex },
		);
	}

	if (slide.data.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must contain at least 1 image URL`,
			{ itemIndex },
		);
	}

	slide.data = slide.data.map((entry, imageIndex) =>
		validateAbsoluteHttpsUrl(
			context,
			itemIndex,
			`Slides JSON[${slideIndex}].data[${imageIndex}]`,
			entry,
		),
	);
}

function validateListSlide(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	if (!Array.isArray(slide.data)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must be an array of strings for list slides`,
			{ itemIndex },
		);
	}

	if (slide.data.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must contain at least 1 list item`,
			{ itemIndex },
		);
	}

	slide.data = slide.data.map((entry, entryIndex) =>
		getRequiredNestedString(
			context,
			itemIndex,
			`Slides JSON[${slideIndex}].data[${entryIndex}]`,
			entry,
		),
	);
}

function validateLabelSlide(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	if (!Array.isArray(slide.data)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must be an array of label objects`,
			{ itemIndex },
		);
	}

	if (slide.data.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must contain at least 1 label entry`,
			{ itemIndex },
		);
	}

	slide.data = slide.data.map((entry, entryIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data[${entryIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		return {
			key: getRequiredNestedString(
				context,
				itemIndex,
				`Slides JSON[${slideIndex}].data[${entryIndex}].key`,
				entry.key,
			),
			value: getRequiredNestedString(
				context,
				itemIndex,
				`Slides JSON[${slideIndex}].data[${entryIndex}].value`,
				entry.value,
			),
		};
	});
}

function validateTableSlide(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	if (!isDataObject(slide.data)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must be an object with headers and rows`,
			{ itemIndex },
		);
	}

	const headers = slide.data.headers;
	if (!Array.isArray(headers)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data.headers must be an array`,
			{ itemIndex },
		);
	}

	if (headers.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data.headers must contain at least 1 column name`,
			{ itemIndex },
		);
	}

	const normalizedHeaders = headers.map((entry, headerIndex) =>
		getRequiredNestedString(
			context,
			itemIndex,
			`Slides JSON[${slideIndex}].data.headers[${headerIndex}]`,
			entry,
		),
	);

	const duplicateHeader = normalizedHeaders.find(
		(header, index) => normalizedHeaders.indexOf(header) !== index,
	);
	if (duplicateHeader) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data.headers contains duplicate header "${duplicateHeader}". Header names must be unique`,
			{ itemIndex },
		);
	}

	const rowsValue = slide.data.rows;
	if (rowsValue !== undefined && !Array.isArray(rowsValue)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data.rows must be an array`,
			{ itemIndex },
		);
	}

	const headerSet = new Set(normalizedHeaders);
	const normalizedRows = Array.isArray(rowsValue)
		? rowsValue.map((entry, rowIndex) => {
				if (!isDataObject(entry)) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data.rows[${rowIndex}] must be a JSON object`,
						{ itemIndex },
					);
				}

				const rowKeys = Object.keys(entry);
				const unknownKey = rowKeys.find((key) => !headerSet.has(key));
				if (unknownKey) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data.rows[${rowIndex}] contains unknown key "${unknownKey}". Row keys must match the headers array`,
						{ itemIndex },
					);
				}

				const missingHeaders = normalizedHeaders.filter((header) => !(header in entry));
				if (missingHeaders.length > 0) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data.rows[${rowIndex}] must include values for every header. Missing keys: ${missingHeaders.join(', ')}`,
						{ itemIndex },
					);
				}

				return entry;
			})
		: undefined;

	let normalizedStyles: IDataObject | undefined;
	if (slide.data.styles !== undefined) {
		if (!isDataObject(slide.data.styles)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data.styles must be a JSON object`,
				{ itemIndex },
			);
		}

		const styles: IDataObject = {};

		if (slide.data.styles.width !== undefined) {
			if (!Array.isArray(slide.data.styles.width)) {
				throw new NodeOperationError(
					context.getNode(),
					`Slides JSON[${slideIndex}].data.styles.width must be an array of numbers`,
					{ itemIndex },
				);
			}

			if (slide.data.styles.width.length !== normalizedHeaders.length) {
				throw new NodeOperationError(
					context.getNode(),
					`Slides JSON[${slideIndex}].data.styles.width must contain exactly ${normalizedHeaders.length} entries to match the headers array`,
					{ itemIndex },
				);
			}

			const widths = slide.data.styles.width.map((entry, widthIndex) => {
				if (typeof entry !== 'number' || !Number.isFinite(entry) || entry <= 0) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data.styles.width[${widthIndex}] must be a positive number`,
						{ itemIndex },
					);
				}

				return entry;
			});

			const widthTotal = widths.reduce((sum, value) => sum + value, 0);
			if (Math.abs(widthTotal - 100) > 0.000001) {
				throw new NodeOperationError(
					context.getNode(),
					`Slides JSON[${slideIndex}].data.styles.width values must add up to 100. Received ${formatNumericTotal(widthTotal)}`,
					{ itemIndex },
				);
			}

			styles.width = widths;
		}

		if (slide.data.styles.sticky !== undefined) {
			if (!isDataObject(slide.data.styles.sticky)) {
				throw new NodeOperationError(
					context.getNode(),
					`Slides JSON[${slideIndex}].data.styles.sticky must be a JSON object`,
					{ itemIndex },
				);
			}

			const sticky: IDataObject = {};
			if (slide.data.styles.sticky.rows !== undefined) {
				if (
					typeof slide.data.styles.sticky.rows !== 'number' ||
					!Number.isInteger(slide.data.styles.sticky.rows) ||
					slide.data.styles.sticky.rows < 0 ||
					slide.data.styles.sticky.rows > 2
				) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data.styles.sticky.rows must be a whole number between 0 and 2`,
						{ itemIndex },
					);
				}

				sticky.rows = slide.data.styles.sticky.rows;
			}

			if (slide.data.styles.sticky.columns !== undefined) {
				if (
					typeof slide.data.styles.sticky.columns !== 'number' ||
					!Number.isInteger(slide.data.styles.sticky.columns) ||
					slide.data.styles.sticky.columns < 0 ||
					slide.data.styles.sticky.columns > 2
				) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data.styles.sticky.columns must be a whole number between 0 and 2`,
						{ itemIndex },
					);
				}

				sticky.columns = slide.data.styles.sticky.columns;
			}

			styles.sticky = sticky;
		}

		normalizedStyles = styles;
	}

	slide.data = {
		...slide.data,
		headers: normalizedHeaders,
		...(normalizedRows !== undefined ? { rows: normalizedRows } : {}),
		...(normalizedStyles !== undefined ? { styles: normalizedStyles } : {}),
	};
}

function validatePercentageChartSlide(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	if (!Array.isArray(slide.data)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must be an array of percentage chart data points`,
			{ itemIndex },
		);
	}

	if (slide.data.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must contain at least 1 percentage chart data point`,
			{ itemIndex },
		);
	}

	const normalizedData = slide.data.map((entry, entryIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data[${entryIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const value = getRequiredNestedNumber(
			context,
			itemIndex,
			`Slides JSON[${slideIndex}].data[${entryIndex}].value`,
			entry.value,
		);
		if (value < 0) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data[${entryIndex}].value must be greater than or equal to 0`,
				{ itemIndex },
			);
		}

		return {
			...entry,
			label: getRequiredNestedString(
				context,
				itemIndex,
				`Slides JSON[${slideIndex}].data[${entryIndex}].label`,
				entry.label,
			),
			value,
		};
	});

	const total = normalizedData.reduce((sum, entry) => sum + (entry.value as number), 0);
	if (Math.abs(total - 100) > 0.000001) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data values must add up to 100. Received ${formatNumericTotal(total)}`,
			{ itemIndex },
		);
	}

	const styles = getOptionalStylesObject(context, itemIndex, slideIndex, slide);
	if (styles?.preview !== undefined) {
		const preview = getRequiredNestedString(
			context,
			itemIndex,
			`Slides JSON[${slideIndex}].styles.preview`,
			styles.preview,
		);
		if (!allowedPercentageChartPreviewTypes.has(preview)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].styles.preview must be one of: pie, doughnut, semi_doughnut`,
				{ itemIndex },
			);
		}

		styles.preview = preview;
	}

	slide.data = normalizedData;
}

function validateGraphSlide(
	context: IExecuteFunctions,
	itemIndex: number,
	slideIndex: number,
	slide: IDataObject,
): void {
	if (!Array.isArray(slide.data)) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must be an array of graph category objects`,
			{ itemIndex },
		);
	}

	if (slide.data.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`Slides JSON[${slideIndex}].data must contain at least 1 graph category`,
			{ itemIndex },
		);
	}

	slide.data = slide.data.map((entry, entryIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data[${entryIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const category = getRequiredNestedString(
			context,
			itemIndex,
			`Slides JSON[${slideIndex}].data[${entryIndex}].category`,
			entry.category,
		);
		if (category.length > 20) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data[${entryIndex}].category must be at most 20 characters`,
				{ itemIndex },
			);
		}

		if (!Array.isArray(entry.values)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data[${entryIndex}].values must be an array of graph value objects`,
				{ itemIndex },
			);
		}

		if (entry.values.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].data[${entryIndex}].values must contain at least 1 data point`,
				{ itemIndex },
			);
		}

		return {
			...entry,
			category,
			values: entry.values.map((valueEntry, valueIndex) => {
				if (!isDataObject(valueEntry)) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data[${entryIndex}].values[${valueIndex}] must be a JSON object`,
						{ itemIndex },
					);
				}

				const label = getRequiredNestedString(
					context,
					itemIndex,
					`Slides JSON[${slideIndex}].data[${entryIndex}].values[${valueIndex}].label`,
					valueEntry.label,
				);
				if (label.length > 20) {
					throw new NodeOperationError(
						context.getNode(),
						`Slides JSON[${slideIndex}].data[${entryIndex}].values[${valueIndex}].label must be at most 20 characters`,
						{ itemIndex },
					);
				}

				return {
					label,
					value: getRequiredNestedNumber(
						context,
						itemIndex,
						`Slides JSON[${slideIndex}].data[${entryIndex}].values[${valueIndex}].value`,
						valueEntry.value,
					),
				};
			}),
		};
	});

	const styles = getOptionalStylesObject(context, itemIndex, slideIndex, slide);
	if (styles?.preview !== undefined) {
		const preview = getRequiredNestedString(
			context,
			itemIndex,
			`Slides JSON[${slideIndex}].styles.preview`,
			styles.preview,
		);
		if (!allowedGraphPreviewTypes.has(preview)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].styles.preview must be one of: vertical_bar, vertical_stacked_bar, trend`,
				{ itemIndex },
			);
		}

		styles.preview = preview;
	}
}

const slideValidators: Record<string, typeof validateTextSlide> = {
	graph: validateGraphSlide,
	images: validateImagesSlide,
	label: validateLabelSlide,
	list: validateListSlide,
	percentage_chart: validatePercentageChartSlide,
	table: validateTableSlide,
	text: validateTextSlide,
};

function toSlidesCollection(slides: IDataObject[]): IDataObject {
	return {
		slide: slides.map((slide) => ({
			enabled: true,
			slideInputMode: 'raw',
			type: slide.type as string,
			title: typeof slide.title === 'string' ? slide.title : '',
			rawSlide: slide,
		})),
	};
}

function toButtonsCollection(buttons: IDataObject[]): IDataObject {
	return {
		button: buttons.map((button) => ({
			enabled: true,
			buttonInputMode: 'raw',
			rawButton: button,
		})),
	};
}

function validateRawButtonArrayInput(
	context: IExecuteFunctions,
	itemIndex: number,
	buttons: unknown[],
	path: string,
	explicitKeyLocations: Map<string, string>,
): void {
	buttons.forEach((entry, buttonIndex) => {
		const buttonPath = `${path}[${buttonIndex}]`;
		if (!isDataObject(entry)) {
			throw new NodeOperationError(context.getNode(), `${buttonPath} must be a JSON object`, {
				itemIndex,
			});
		}

		if (entry.label === undefined) {
			throw new NodeOperationError(context.getNode(), `${buttonPath}.label is required`, {
				itemIndex,
			});
		}

		if (typeof entry.label !== 'string') {
			throw new NodeOperationError(context.getNode(), `${buttonPath}.label must be a string`, {
				itemIndex,
			});
		}

		const trimmedLabel = entry.label.trim();
		if (trimmedLabel.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${buttonPath}.label must be a non-empty string`,
				{ itemIndex },
			);
		}
		entry.label = trimmedLabel;

		if (entry.key !== undefined) {
			if (typeof entry.key !== 'string') {
				throw new NodeOperationError(context.getNode(), `${buttonPath}.key must be a string`, {
					itemIndex,
				});
			}

			const trimmedKey = entry.key.trim();
			if (trimmedKey.length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					`${buttonPath}.key must be a non-empty string when provided`,
					{ itemIndex },
				);
			}

			const explicitKeyPath = `${buttonPath}.key`;
			const existingKeyPath = explicitKeyLocations.get(trimmedKey);
			if (existingKeyPath) {
				throw new NodeOperationError(
					context.getNode(),
					`Duplicate button key "${trimmedKey}" found in ${existingKeyPath} and ${explicitKeyPath}`,
					{ itemIndex },
				);
			}

			explicitKeyLocations.set(trimmedKey, explicitKeyPath);
			entry.key = trimmedKey;
		}
	});
}

function normalizeSlidesInput(
	context: IExecuteFunctions,
	itemIndex: number,
	slides: IDataObject[],
	explicitKeyLocations: Map<string, string>,
): IDataObject[] {
	return slides.map((slide, slideIndex) => {
		const type =
			typeof slide.type === 'string' && slide.type.trim().length > 0 ? slide.type.trim() : null;
		if (!type) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].type is required`,
				{ itemIndex },
			);
		}

		if (!allowedSlideTypes.has(type)) {
			throw new NodeOperationError(
				context.getNode(),
				`Slides JSON[${slideIndex}].type must be one of: ${allowedSlideTypesText}`,
				{ itemIndex },
			);
		}

		const normalized: IDataObject = {
			...slide,
			type,
		};

		normalizeOptionalSlideTitle(context, itemIndex, slideIndex, normalized);
		slideValidators[type](context, itemIndex, slideIndex, normalized);

		if (normalized.buttons !== undefined) {
			if (!Array.isArray(normalized.buttons)) {
				throw new NodeOperationError(
					context.getNode(),
					`Slides JSON[${slideIndex}].buttons must be a JSON array of button objects`,
					{ itemIndex },
				);
			}

			validateRawButtonArrayInput(
				context,
				itemIndex,
				normalized.buttons as unknown[],
				`Slides JSON[${slideIndex}].buttons`,
				explicitKeyLocations,
			);
			normalized.buttons = extractButtons(
				context,
				toButtonsCollection(normalized.buttons as IDataObject[]),
				itemIndex,
				{
					autoGenerateButtonKey: true,
				},
			);
		}

		return normalized;
	});
}

function validatePayloadButtonKeyUniqueness(
	context: IExecuteFunctions,
	itemIndex: number,
	payload: IDataObject,
): void {
	const keyLocations = new Map<string, string>();

	const registerPayloadButtons = (buttons: unknown, pathPrefix: string): void => {
		if (!Array.isArray(buttons)) {
			return;
		}

		buttons.forEach((entry, buttonIndex) => {
			if (!isDataObject(entry) || typeof entry.key !== 'string' || entry.key.trim().length === 0) {
				return;
			}

			const key = entry.key.trim();
			const currentPath = `${pathPrefix}[${buttonIndex}].key`;
			const existingPath = keyLocations.get(key);
			if (existingPath) {
				throw new NodeOperationError(
					context.getNode(),
					`Duplicate button key "${key}" found in ${existingPath} and ${currentPath}`,
					{ itemIndex },
				);
			}

			keyLocations.set(key, currentPath);
		});
	};

	registerPayloadButtons(payload.buttons, 'Buttons JSON');

	if (Array.isArray(payload.slides)) {
		payload.slides.forEach((slide, slideIndex) => {
			if (!isDataObject(slide)) {
				return;
			}

			registerPayloadButtons(slide.buttons, `Slides JSON[${slideIndex}].buttons`);
		});
	}
}

function buildRecoverableErrorPayload(message: string): IDataObject {
	let hint =
		'Fix the invalid input and retry. Leave optional fields blank when you do not want that payload section included.';

	if (message.includes('Slides JSON')) {
		hint =
			'Provide Slides JSON as a JSON array of Zoho Cliq slide objects, or leave it blank to omit slides.';
	} else if (message.includes('Buttons JSON')) {
		hint =
			'Provide Buttons JSON as a JSON array of Zoho Cliq button objects, or leave it blank to omit top-level buttons.';
	} else if (message.includes('Card Text')) {
		hint =
			'Provide a non-empty top-level text string up to 4096 characters. This builder keeps the limit safe for Post, Edit, and Schedule Message reuse.';
	} else if (message.includes('Card Icon URL') || message.includes('Card Thumbnail URL')) {
		hint =
			'Use an absolute HTTPS URL that points directly to a .png or .svg image, or leave the field blank.';
	}

	return {
		success: false,
		resource: 'messageComponentBuilder',
		operation: operationName,
		reason: message,
		hint,
	};
}

export const __testHelpers = Object.freeze({
	getOptionalTrimmedStringParameter,
	getRequiredTrimmedText,
	validateDirectImageUrl,
	parseOptionalObjectArrayParameter,
	validateCardTheme,
	toSlidesCollection,
	toButtonsCollection,
	validateAbsoluteHttpsUrl,
	validateRawButtonArrayInput,
	normalizeSlidesInput,
	validatePayloadButtonKeyUniqueness,
	buildRecoverableErrorPayload,
});

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	_grantedScopes: string,
): Promise<INodeExecutionData[]> {
	void _grantedScopes;
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const text = getRequiredTrimmedText(this, i);
			const title = getOptionalTrimmedStringParameter(this, 'title', i, 'Card Title');
			const theme = validateCardTheme(
				this,
				i,
				getOptionalTrimmedStringParameter(this, 'theme', i, 'Card Theme'),
			);
			const iconUrl = getOptionalTrimmedStringParameter(this, 'iconUrl', i, 'Card Icon URL');
			const thumbnailUrl = getOptionalTrimmedStringParameter(
				this,
				'thumbnailUrl',
				i,
				'Card Thumbnail URL',
			);

			const payload: IDataObject = {
				text,
			};
			const explicitButtonKeyLocations = new Map<string, string>();

			const card: IDataObject = {};
			if (title) {
				card.title = title;
			}
			if (theme) {
				card.theme = theme;
			}
			if (iconUrl) {
				card.icon = validateDirectImageUrl(this, i, iconUrl, 'Card Icon URL');
			}
			if (thumbnailUrl) {
				card.thumbnail = validateDirectImageUrl(this, i, thumbnailUrl, 'Card Thumbnail URL');
			}
			if (Object.keys(card).length > 0) {
				payload.card = card;
			}

			const slidesJsonInput = parseOptionalObjectArrayParameter(
				this,
				'slidesJson',
				i,
				'Slides JSON',
			);
			const buttonsInput = parseOptionalObjectArrayParameter(
				this,
				'buttonsJson',
				i,
				'Buttons JSON',
			);

			validateRawButtonArrayInput(
				this,
				i,
				buttonsInput,
				'Buttons JSON',
				explicitButtonKeyLocations,
			);

			const slidesInput = normalizeSlidesInput(
				this,
				i,
				slidesJsonInput,
				explicitButtonKeyLocations,
			);
			if (slidesInput.length > 0) {
				payload.slides = extractSlides(this, toSlidesCollection(slidesInput), i, {
					autoGenerateButtonKey: true,
				});
			}

			if (buttonsInput.length > 0) {
				payload.buttons = extractButtons(this, toButtonsCollection(buttonsInput), i, {
					autoGenerateButtonKey: true,
				});
			}

			validatePayloadButtonKeyUniqueness(this, i, payload);

			const payloadLength = JSON.stringify(payload).length;
			if (payloadLength > richPayloadMaxLength) {
				throw new NodeOperationError(
					this.getNode(),
					`Agent card payload exceeds ${richPayloadMaxLength} characters`,
					{ itemIndex: i },
				);
			}

			appendExecutionData(this, returnData, i, payload);
		} catch (error) {
			if (!this.continueOnFail()) {
				if (error instanceof Error) {
					throw error;
				}

				throw new NodeOperationError(this.getNode(), 'Unable to build agent card payload', {
					itemIndex: i,
				});
			}

			const message = error instanceof Error ? error.message : 'Unable to build agent card payload';
			appendExecutionData(this, returnData, i, buildRecoverableErrorPayload(message));
		}
	}

	return returnData;
}
