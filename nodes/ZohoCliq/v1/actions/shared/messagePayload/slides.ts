import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	allowedSlideTypes,
	allowedSlideTypesText,
	dataRequiredSlideTypes,
	textSlideMaxLength,
} from './constants';
import {
	ensureSafeObject,
	getOptionalBoolean,
	getOptionalString,
	isDataObject,
	parseJsonObjectInput,
} from './common';
import { extractButtonsFromCollection } from './buttons';

export function extractSlides(
	context: IExecuteFunctions,
	slidesValue: unknown,
	itemIndex: number,
	options: { autoGenerateButtonKey?: boolean } = {},
): IDataObject[] {
	if (!isDataObject(slidesValue)) {
		return [];
	}

	const slideEntries = slidesValue.slide;
	if (!Array.isArray(slideEntries)) {
		return [];
	}

	return slideEntries
		.map((slide, slideIndex) => {
			if (!isDataObject(slide)) {
				throw new NodeOperationError(context.getNode(), 'Each slide must be a JSON object', {
					itemIndex,
				});
			}

			ensureSafeObject(context, slide, itemIndex, `slides.slide[${slideIndex}]`);

			const enabled = getOptionalBoolean(
				context,
				slide.enabled,
				itemIndex,
				`slides.slide[${slideIndex}].enabled`,
				true,
			);
			if (!enabled) {
				return null;
			}

			const slideInputMode = getOptionalString(slide.slideInputMode) ?? 'structured';
			if (slideInputMode === 'raw') {
				const selectedType = getOptionalString(slide.type);
				const selectedTitle = getOptionalString(slide.title);
				const rawSlide = parseJsonObjectInput(
					context,
					slide.rawSlide,
					itemIndex,
					`slides.slide[${slideIndex}].rawSlide`,
					{ allowEmptyObject: false },
				);
				ensureSafeObject(context, rawSlide, itemIndex, `slides.slide[${slideIndex}].rawSlide`);
				const hasExplicitSlideShape =
					rawSlide.type !== undefined ||
					rawSlide.title !== undefined ||
					rawSlide.data !== undefined ||
					rawSlide.buttons !== undefined;

				// UX shorthand: allow raw table/list/label/text/images payloads without wrapping in { type, data }.
				if (!hasExplicitSlideShape && selectedType) {
					const shorthandSlide: IDataObject = {
						type: selectedType,
						data: rawSlide,
					};
					if (selectedTitle) {
						shorthandSlide.title = selectedTitle;
					}
					if (selectedType === 'label') {
						shorthandSlide.data = normalizeLabelData(
							context,
							rawSlide,
							itemIndex,
							`slides.slide[${slideIndex}].rawSlide`,
						);
					}
					validateRawImageSlideUrls(context, shorthandSlide, itemIndex, slideIndex);
					return shorthandSlide;
				}

				if (selectedType && rawSlide.type === undefined) {
					rawSlide.type = selectedType;
				}
				if (selectedTitle && rawSlide.title === undefined) {
					rawSlide.title = selectedTitle;
				}
				if (getOptionalString(rawSlide.type) === 'label' && rawSlide.data !== undefined) {
					rawSlide.data = normalizeLabelData(
						context,
						rawSlide.data,
						itemIndex,
						`slides.slide[${slideIndex}].rawSlide.data`,
					);
				}

				validateRawImageSlideUrls(context, rawSlide, itemIndex, slideIndex);
				return rawSlide;
			}

			if (slideInputMode !== 'structured') {
				throw new NodeOperationError(
					context.getNode(),
					`Slide Input Mode at index ${slideIndex} must be one of: structured, raw`,
					{ itemIndex },
				);
			}

			const sanitizedSlide: IDataObject = {};
			const type = getOptionalString(slide.type);
			const title = getOptionalString(slide.title);

			if (type) {
				if (!allowedSlideTypes.has(type)) {
					throw new NodeOperationError(
						context.getNode(),
						`Slide type at index ${slideIndex} must be one of: ${allowedSlideTypesText}`,
						{ itemIndex },
					);
				}
				sanitizedSlide.type = type;
			}

			if (title) {
				sanitizedSlide.title = title;
			}

			if (type === 'text') {
				const textData = getOptionalString(slide.textData);
				if (textData) {
					if (textData.length > textSlideMaxLength) {
						throw new NodeOperationError(
							context.getNode(),
							`Text slide at index ${slideIndex} exceeds ${textSlideMaxLength} characters`,
							{ itemIndex },
						);
					}
					sanitizedSlide.data = textData;
				}
			} else if (type === 'images') {
				const imageUrls = resolveImageUrls(context, slide.imageUrls, itemIndex, slideIndex);
				if (imageUrls.length > 0) {
					sanitizedSlide.data = imageUrls;
				}
			} else if (type === 'label') {
				const labelData = resolveLabelFields(context, slide.labelDataPairs, itemIndex, slideIndex);
				if (labelData !== null) {
					sanitizedSlide.data = labelData;
				}
			} else if (type === 'table') {
				const tableData = resolveTableData(context, slide, itemIndex, slideIndex);
				if (tableData !== null) {
					sanitizedSlide.data = tableData;
				}
			} else if (type === 'list') {
				const listData = resolveListItems(context, slide.listItems, itemIndex, slideIndex);
				if (listData.length > 0) {
					sanitizedSlide.data = listData;
				}
				const listStyles = resolveListStyles(context, slide, itemIndex, slideIndex);
				if (listStyles !== null) {
					sanitizedSlide.styles = listStyles;
				}
			} else if (type === 'percentage_chart') {
				const chartData = resolveChartDataPoints(
					context,
					slide.chartDataPoints,
					itemIndex,
					slideIndex,
				);
				if (chartData.length > 0) {
					sanitizedSlide.data = chartData;
				}
				const chartStyles = resolveChartStyles(context, slide, itemIndex, slideIndex);
				if (chartStyles !== null) {
					sanitizedSlide.styles = chartStyles;
				}
			} else if (type === 'graph') {
				const graphData = resolveGraphData(context, slide.graphCategories, itemIndex, slideIndex);
				if (graphData.length > 0) {
					sanitizedSlide.data = graphData;
				}
				const graphStyles = resolveGraphStyles(context, slide, itemIndex, slideIndex);
				if (graphStyles !== null) {
					sanitizedSlide.styles = graphStyles;
				}
			}

			if (type && dataRequiredSlideTypes.has(type) && sanitizedSlide.data === undefined) {
				throw new NodeOperationError(
					context.getNode(),
					`Slide at index ${slideIndex} with type "${type}" requires data`,
					{ itemIndex },
				);
			}

			const slideButtonsCollection = resolveSlideButtonsCollection(slide, type);
			const slideButtons = extractButtonsFromCollection(
				context,
				slideButtonsCollection,
				itemIndex,
				`slides.slide[${slideIndex}].buttons`,
				options,
			);
			if (slideButtons.length > 0) {
				sanitizedSlide.buttons = slideButtons;
			}

			if (Object.keys(sanitizedSlide).length === 0) {
				throw new NodeOperationError(
					context.getNode(),
					`Slide at index ${slideIndex} is empty. Add type/title/data or disable Include.`,
					{ itemIndex },
				);
			}

			return sanitizedSlide;
		})
		.filter((slide): slide is IDataObject => slide !== null);
}

function resolveImageUrls(
	context: IExecuteFunctions,
	imageUrlsValue: unknown,
	itemIndex: number,
	slideIndex: number,
): string[] {
	if (!isDataObject(imageUrlsValue)) {
		return [];
	}

	const entries = imageUrlsValue.imageUrl;
	if (!Array.isArray(entries)) {
		return [];
	}

	return entries.map((entry, imageIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].imageUrls.imageUrl[${imageIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const url = getOptionalString(entry.url);
		if (!url) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].imageUrls.imageUrl[${imageIndex}].url is required`,
				{ itemIndex },
			);
		}
		if (!url.startsWith('https://')) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].imageUrls.imageUrl[${imageIndex}].url must start with "https://"`,
				{ itemIndex },
			);
		}

		return url;
	});
}

function validateRawImageSlideUrls(
	context: IExecuteFunctions,
	rawSlide: IDataObject,
	itemIndex: number,
	slideIndex: number,
): void {
	if (getOptionalString(rawSlide.type) !== 'images') {
		return;
	}

	if (!Array.isArray(rawSlide.data)) {
		throw new NodeOperationError(
			context.getNode(),
			`slides.slide[${slideIndex}].data must be an array of image URLs`,
			{ itemIndex },
		);
	}

	rawSlide.data.forEach((entry, imageIndex) => {
		if (typeof entry !== 'string' || !entry.startsWith('https://')) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].data[${imageIndex}] must start with "https://"`,
				{ itemIndex },
			);
		}
	});
}

function resolveSlideButtonsCollection(slide: IDataObject, slideType: string | null): unknown {
	if (slideType === 'percentage_chart' && slide.chartButtons !== undefined) {
		return slide.chartButtons;
	}
	if (slideType === 'graph' && slide.graphButtons !== undefined) {
		return slide.graphButtons;
	}
	if (slideType === 'images' && slide.imagesButtons !== undefined) {
		return slide.imagesButtons;
	}
	if (slideType === 'label' && slide.labelButtons !== undefined) {
		return slide.labelButtons;
	}
	if (slideType === 'list' && slide.listButtons !== undefined) {
		return slide.listButtons;
	}
	if (slideType === 'table' && slide.tableButtons !== undefined) {
		return slide.tableButtons;
	}
	if (slideType === 'text' && slide.textButtons !== undefined) {
		return slide.textButtons;
	}
	return undefined;
}

function resolveListItems(
	context: IExecuteFunctions,
	listItemsValue: unknown,
	itemIndex: number,
	slideIndex: number,
): string[] {
	if (!isDataObject(listItemsValue)) {
		return [];
	}

	const entries = listItemsValue.item;
	if (!Array.isArray(entries)) {
		return [];
	}

	return entries.map((entry, entryIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].listItems.item[${entryIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const value = getOptionalString(entry.value);
		if (!value) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].listItems.item[${entryIndex}].value is required`,
				{ itemIndex },
			);
		}

		return value;
	});
}

function resolveListStyles(
	context: IExecuteFunctions,
	slide: IDataObject,
	itemIndex: number,
	slideIndex: number,
): IDataObject | null {
	const shouldSetStyle = getOptionalBoolean(
		context,
		slide.listChangeItemStyle,
		itemIndex,
		`slides.slide[${slideIndex}].listChangeItemStyle`,
		false,
	);
	if (!shouldSetStyle) {
		return null;
	}

	const styleType = getOptionalString(slide.listStyleType);
	const allowedStyleTypes = new Set([
		'circle',
		'decimal',
		'disc',
		'lower-alpha',
		'upper-alpha',
		'square',
		'lower-roman',
		'upper-roman',
	]);

	if (!styleType || !allowedStyleTypes.has(styleType)) {
		throw new NodeOperationError(
			context.getNode(),
			`slides.slide[${slideIndex}].listStyleType must be one of: circle, decimal, disc, lower-alpha, upper-alpha, square, lower-roman, upper-roman`,
			{ itemIndex },
		);
	}

	return { type: styleType };
}

function resolveChartStyles(
	context: IExecuteFunctions,
	slide: IDataObject,
	itemIndex: number,
	slideIndex: number,
): IDataObject | null {
	const preview = getOptionalString(slide.chartPreview);
	if (!preview) {
		return null;
	}

	const allowedPreviewTypes = new Set(['pie', 'doughnut', 'semi_doughnut']);
	if (!allowedPreviewTypes.has(preview)) {
		throw new NodeOperationError(
			context.getNode(),
			`slides.slide[${slideIndex}].chartPreview must be one of: pie, doughnut, semi_doughnut`,
			{ itemIndex },
		);
	}

	return { preview };
}

function resolveChartDataPoints(
	context: IExecuteFunctions,
	chartDataValue: unknown,
	itemIndex: number,
	slideIndex: number,
): IDataObject[] {
	if (!isDataObject(chartDataValue)) {
		return [];
	}

	const entries = chartDataValue.point;
	if (!Array.isArray(entries)) {
		return [];
	}

	if (entries.length > 5) {
		throw new NodeOperationError(
			context.getNode(),
			`slides.slide[${slideIndex}].chartDataPoints supports a maximum of 5 items`,
			{ itemIndex },
		);
	}

	const chartData = entries.map((entry, entryIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].chartDataPoints.point[${entryIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const label = getOptionalString(entry.label);
		if (!label) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].chartDataPoints.point[${entryIndex}].label is required`,
				{ itemIndex },
			);
		}
		if (label.length > 20) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].chartDataPoints.point[${entryIndex}].label must be at most 20 characters`,
				{ itemIndex },
			);
		}

		const value = resolveNumericValue(
			context,
			entry.value,
			itemIndex,
			`slides.slide[${slideIndex}].chartDataPoints.point[${entryIndex}].value`,
		);
		return { label, value };
	});

	const total = chartData.reduce((sum, point) => sum + (point.value as number), 0);
	// Floating-point tolerance for percentage sums (e.g. 33.333 + 33.333 + 33.334 = 100.00000000000001)
	const tolerance = 0.000001;
	if (Math.abs(total - 100) > tolerance) {
		throw new NodeOperationError(
			context.getNode(),
			`slides.slide[${slideIndex}].chartDataPoints values must add up to 100`,
			{ itemIndex },
		);
	}

	return chartData;
}

function resolveGraphStyles(
	context: IExecuteFunctions,
	slide: IDataObject,
	itemIndex: number,
	slideIndex: number,
): IDataObject | null {
	const preview = getOptionalString(slide.graphPreview);
	const xAxisTitle = getOptionalString(slide.graphXAxisTitle);
	const yAxisTitle = getOptionalString(slide.graphYAxisTitle);

	if (!preview && !xAxisTitle && !yAxisTitle) {
		return null;
	}

	const styles: IDataObject = {};
	if (preview) {
		const allowedPreviewTypes = new Set(['vertical_bar', 'vertical_stacked_bar', 'trend']);
		if (!allowedPreviewTypes.has(preview)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphPreview must be one of: vertical_bar, vertical_stacked_bar, trend`,
				{ itemIndex },
			);
		}
		styles.preview = preview;
	}

	if (xAxisTitle) {
		if (xAxisTitle.length > 20) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphXAxisTitle must be at most 20 characters`,
				{ itemIndex },
			);
		}
		styles.x_axis = { title: xAxisTitle };
	}

	if (yAxisTitle) {
		if (yAxisTitle.length > 20) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphYAxisTitle must be at most 20 characters`,
				{ itemIndex },
			);
		}
		styles.y_axis = { title: yAxisTitle };
	}

	return styles;
}

function resolveGraphData(
	context: IExecuteFunctions,
	graphDataValue: unknown,
	itemIndex: number,
	slideIndex: number,
): IDataObject[] {
	if (!isDataObject(graphDataValue)) {
		return [];
	}

	const categories = graphDataValue.category;
	if (!Array.isArray(categories)) {
		return [];
	}

	if (categories.length > 5) {
		throw new NodeOperationError(
			context.getNode(),
			`slides.slide[${slideIndex}].graphCategories supports a maximum of 5 items`,
			{ itemIndex },
		);
	}

	return categories.map((categoryEntry, categoryIndex) => {
		if (!isDataObject(categoryEntry)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const category = getOptionalString(categoryEntry.category);
		if (!category) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}].category is required`,
				{ itemIndex },
			);
		}
		if (category.length > 20) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}].category must be at most 20 characters`,
				{ itemIndex },
			);
		}

		const values = resolveGraphCategoryValues(
			context,
			categoryEntry.values,
			itemIndex,
			slideIndex,
			categoryIndex,
		);
		if (values.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}] requires at least one value point`,
				{ itemIndex },
			);
		}

		return { category, values };
	});
}

function resolveGraphCategoryValues(
	context: IExecuteFunctions,
	valuesValue: unknown,
	itemIndex: number,
	slideIndex: number,
	categoryIndex: number,
): IDataObject[] {
	if (!isDataObject(valuesValue)) {
		return [];
	}

	const values = valuesValue.value;
	if (!Array.isArray(values)) {
		return [];
	}
	if (values.length > 20) {
		throw new NodeOperationError(
			context.getNode(),
			`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}].values supports a maximum of 20 items`,
			{ itemIndex },
		);
	}

	return values.map((valueEntry, valueIndex) => {
		if (!isDataObject(valueEntry)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}].values.value[${valueIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const label = getOptionalString(valueEntry.label);
		if (!label) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}].values.value[${valueIndex}].label is required`,
				{ itemIndex },
			);
		}
		if (label.length > 20) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}].values.value[${valueIndex}].label must be at most 20 characters`,
				{ itemIndex },
			);
		}

		const value = resolveNumericValue(
			context,
			valueEntry.value,
			itemIndex,
			`slides.slide[${slideIndex}].graphCategories.category[${categoryIndex}].values.value[${valueIndex}].value`,
		);
		return { label, value };
	});
}

function resolveLabelFields(
	context: IExecuteFunctions,
	labelDataValue: unknown,
	itemIndex: number,
	slideIndex: number,
): IDataObject[] | null {
	if (!isDataObject(labelDataValue)) {
		return null;
	}

	const entries = labelDataValue.pair;
	if (!Array.isArray(entries)) {
		return null;
	}

	const labelData: IDataObject[] = [];
	entries.forEach((entry, entryIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].labelDataPairs.pair[${entryIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const key = getOptionalString(entry.key);
		if (!key) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].labelDataPairs.pair[${entryIndex}].key is required`,
				{ itemIndex },
			);
		}

		labelData.push({ [key]: getOptionalString(entry.value) ?? '' });
	});

	return labelData.length > 0 ? labelData : null;
}

function normalizeLabelData(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject[] {
	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			if (!isDataObject(entry)) {
				throw new NodeOperationError(context.getNode(), `${path}[${index}] must be an object`, {
					itemIndex,
				});
			}
		});
		return value as IDataObject[];
	}

	if (isDataObject(value)) {
		return Object.entries(value).map(([key, entryValue]) => ({ [key]: entryValue }));
	}

	throw new NodeOperationError(context.getNode(), `${path} must be an object or array`, {
		itemIndex,
	});
}

function resolveTableData(
	context: IExecuteFunctions,
	slide: IDataObject,
	itemIndex: number,
	slideIndex: number,
): IDataObject | null {
	const headers = resolveTableHeaders(context, slide.tableHeaders, itemIndex, slideIndex);
	const rows = resolveTableRows(context, slide.tableRows, itemIndex, slideIndex);
	const styles = resolveTableStyles(context, slide, itemIndex, slideIndex, headers.length);
	if (headers.length === 0 && rows.length === 0) {
		return null;
	}

	const tableData: IDataObject = {};
	if (headers.length > 0) {
		tableData.headers = headers;
	}
	if (rows.length > 0) {
		tableData.rows = rows;
	}
	if (styles !== null) {
		tableData.styles = styles;
	}

	return tableData;
}

function resolveTableStyles(
	context: IExecuteFunctions,
	slide: IDataObject,
	itemIndex: number,
	slideIndex: number,
	headerCount: number,
): IDataObject | null {
	const shouldSetStyles = getOptionalBoolean(
		context,
		slide.tableAdjustStyles,
		itemIndex,
		`slides.slide[${slideIndex}].tableAdjustStyles`,
		false,
	);
	if (!shouldSetStyles) {
		return null;
	}

	const widths = resolveTableStyleWidths(context, slide.tableStyleWidths, itemIndex, slideIndex);
	if (widths.length > 0) {
		if (headerCount > 0 && widths.length !== headerCount) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].tableStyleWidths width count must match table column count`,
				{ itemIndex },
			);
		}

		const widthTotal = widths.reduce((sum, width) => sum + width, 0);
		if (widthTotal !== 100) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].tableStyleWidths values must add up to 100`,
				{ itemIndex },
			);
		}
	}

	const stickyRows = resolveBoundedInteger(
		context,
		slide.tableStickyRows,
		itemIndex,
		`slides.slide[${slideIndex}].tableStickyRows`,
		0,
		2,
	);
	const stickyColumns = resolveBoundedInteger(
		context,
		slide.tableStickyColumns,
		itemIndex,
		`slides.slide[${slideIndex}].tableStickyColumns`,
		0,
		2,
	);

	const styles: IDataObject = {};
	if (widths.length > 0) {
		styles.width = widths;
	}
	if (stickyRows > 0 || stickyColumns > 0) {
		const sticky: IDataObject = {};
		if (stickyRows > 0) {
			sticky.rows = stickyRows;
		}
		if (stickyColumns > 0) {
			sticky.columns = stickyColumns;
		}
		styles.sticky = sticky;
	}

	return Object.keys(styles).length > 0 ? styles : null;
}

function resolveTableStyleWidths(
	context: IExecuteFunctions,
	widthsValue: unknown,
	itemIndex: number,
	slideIndex: number,
): number[] {
	if (typeof widthsValue === 'string') {
		const trimmed = widthsValue.trim();
		if (!trimmed) {
			return [];
		}

		return trimmed.split(',').map((entry, widthIndex) => {
			const normalized = entry.trim();
			if (!/^\d+$/.test(normalized)) {
				throw new NodeOperationError(
					context.getNode(),
					`slides.slide[${slideIndex}].tableStyleWidths must be a comma-separated list of whole numbers`,
					{ itemIndex },
				);
			}

			const parsed = Number(normalized);
			return resolveBoundedInteger(
				context,
				parsed,
				itemIndex,
				`slides.slide[${slideIndex}].tableStyleWidths[${widthIndex}]`,
				1,
				100,
			);
		});
	}

	if (!isDataObject(widthsValue)) {
		return [];
	}

	const widths = widthsValue.width;
	if (!Array.isArray(widths)) {
		return [];
	}

	return widths.map((entry, widthIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`slides.slide[${slideIndex}].tableStyleWidths.width[${widthIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		return resolveBoundedInteger(
			context,
			entry.value,
			itemIndex,
			`slides.slide[${slideIndex}].tableStyleWidths.width[${widthIndex}].value`,
			1,
			100,
		);
	});
}

function resolveBoundedInteger(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	minValue: number,
	maxValue: number,
): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a whole number`, {
			itemIndex,
		});
	}

	if (value < minValue || value > maxValue) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must be between ${minValue} and ${maxValue}`,
			{
				itemIndex,
			},
		);
	}

	return value;
}

function resolveNumericValue(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a number`, {
			itemIndex,
		});
	}

	return value;
}

function resolveTableHeaders(
	context: IExecuteFunctions,
	headersValue: unknown,
	itemIndex: number,
	slideIndex: number,
): string[] {
	if (!isDataObject(headersValue)) {
		return [];
	}

	const entries = headersValue.header;
	if (!Array.isArray(entries)) {
		return [];
	}

	return entries
		.map((entry, entryIndex) => {
			if (!isDataObject(entry)) {
				throw new NodeOperationError(
					context.getNode(),
					`slides.slide[${slideIndex}].tableHeaders.header[${entryIndex}] must be a JSON object`,
					{ itemIndex },
				);
			}

			const header = getOptionalString(entry.name);
			if (!header) {
				throw new NodeOperationError(
					context.getNode(),
					`slides.slide[${slideIndex}].tableHeaders.header[${entryIndex}].name is required`,
					{ itemIndex },
				);
			}
			return header;
		})
		.filter((header) => header.length > 0);
}

function resolveTableRows(
	context: IExecuteFunctions,
	rowsValue: unknown,
	itemIndex: number,
	slideIndex: number,
): IDataObject[] {
	if (!isDataObject(rowsValue)) {
		return [];
	}

	const rows = rowsValue.row;
	if (!Array.isArray(rows)) {
		return [];
	}

	return rows
		.map((row, rowIndex) => {
			if (!isDataObject(row)) {
				throw new NodeOperationError(
					context.getNode(),
					`slides.slide[${slideIndex}].tableRows.row[${rowIndex}] must be a JSON object`,
					{ itemIndex },
				);
			}

			const rowData = resolveKeyValueEntries(
				context,
				row.values,
				itemIndex,
				`slides.slide[${slideIndex}].tableRows.row[${rowIndex}].values`,
			);
			return Object.keys(rowData).length > 0 ? rowData : null;
		})
		.filter((row): row is IDataObject => row !== null);
}

function resolveKeyValueEntries(
	context: IExecuteFunctions,
	valuesCollection: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (!isDataObject(valuesCollection)) {
		return {};
	}

	const entries = valuesCollection.entry;
	if (!Array.isArray(entries)) {
		return {};
	}

	const data: IDataObject = {};
	entries.forEach((entry, entryIndex) => {
		if (!isDataObject(entry)) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.entry[${entryIndex}] must be a JSON object`,
				{
					itemIndex,
				},
			);
		}

		const key = getOptionalString(entry.key);
		if (!key) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.entry[${entryIndex}].key is required`,
				{
					itemIndex,
				},
			);
		}

		data[key] = getOptionalString(entry.value) ?? '';
	});

	return data;
}
