import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const idPattern = /^[a-zA-Z0-9_-]+$/;
const allowedTickerTypes = new Set([
	'person',
	'bicycle',
	'motorcycle',
	'car',
	'van',
	'bus',
	'plane',
	'office',
	'home',
]);
export const TICKER_COLORS = ['green', 'red', 'yellow'] as const;
const allowedTickerColors = new Set<string>(TICKER_COLORS);

export function validateEntityId(
	context: IExecuteFunctions,
	value: string,
	fieldName: string,
	itemIndex: number,
): string {
	if (!value || !value.trim()) {
		throw new NodeOperationError(context.getNode(), `${fieldName} is required`, { itemIndex });
	}

	const sanitized = value.trim();
	if (!idPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), `Invalid ${fieldName} format`, { itemIndex });
	}

	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} is too long. Maximum length is 200 characters.`,
			{ itemIndex },
		);
	}

	return sanitized;
}

export function validateAppKey(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
): string {
	const sanitized = value.trim();
	if (!sanitized) {
		throw new NodeOperationError(
			context.getNode(),
			'App Key is required when "Map Is Custom Extension" is enabled',
			{
				itemIndex,
			},
		);
	}

	if (sanitized.length > 300) {
		throw new NodeOperationError(context.getNode(), 'App Key is too long', { itemIndex });
	}

	return sanitized;
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
			const child = value[idx];
			if (child && typeof child === 'object') {
				ensureSafeObject(context, child, itemIndex, `${path}[${idx}]`);
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

export function resolveTickerEndpoint(
	mapId: string,
	widgetId?: string,
	useExtensionEndpoint = false,
): string {
	if (useExtensionEndpoint) {
		return `/api/v2/extensions/widgets/maps/${encodeURIComponent(mapId)}`;
	}

	if (!widgetId) {
		throw new Error('Widget ID is required for internal widget map endpoints');
	}

	return `/api/v2/widgets/${encodeURIComponent(widgetId)}/maps/${encodeURIComponent(mapId)}`;
}

export function validateInputMode(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
	fieldName = 'Input Mode',
): 'structured' | 'raw' {
	const normalized = String(value ?? '').trim();
	if (normalized === 'structured' || normalized === 'raw') {
		return normalized;
	}

	throw new NodeOperationError(
		context.getNode(),
		`${fieldName} must be either "structured" or "raw"`,
		{ itemIndex },
	);
}

export function parseBooleanFlag(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
): boolean {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'true') {
			return true;
		}
		if (normalized === 'false') {
			return false;
		}
	}

	throw new NodeOperationError(context.getNode(), `${fieldName} must be a boolean value`, {
		itemIndex,
	});
}

export function parseJsonObjectInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
				itemIndex,
			});
		}

		try {
			const parsed = JSON.parse(trimmed) as unknown;
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
				throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
					itemIndex,
				});
			}
			ensureSafeObject(context, parsed, itemIndex, path);
			return parsed as IDataObject;
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}
			throw new NodeOperationError(context.getNode(), `${path} must be valid JSON`, {
				itemIndex,
			});
		}
	}

	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	ensureSafeObject(context, value, itemIndex, path);
	return value as IDataObject;
}

function normalizeLastModifiedTime(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): number {
	const lastModifiedTimeNumber = Number(value);
	if (
		!Number.isFinite(lastModifiedTimeNumber) ||
		!Number.isInteger(lastModifiedTimeNumber) ||
		lastModifiedTimeNumber <= 0
	) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must be a positive whole Unix timestamp in seconds or milliseconds`,
			{ itemIndex },
		);
	}

	if (lastModifiedTimeNumber >= 1_000_000_000 && lastModifiedTimeNumber < 10_000_000_000) {
		return lastModifiedTimeNumber * 1000;
	}

	if (lastModifiedTimeNumber >= 10_000_000_000) {
		return lastModifiedTimeNumber;
	}

	throw new NodeOperationError(
		context.getNode(),
		`${path} must be a 10-digit Unix seconds timestamp or a Unix milliseconds timestamp`,
		{ itemIndex },
	);
}

export function validateTickerBody(
	context: IExecuteFunctions,
	body: IDataObject,
	itemIndex: number,
	path: string,
): IDataObject {
	ensureSafeObject(context, body, itemIndex, path);

	const tickers = body.tickers;
	if (!tickers || typeof tickers !== 'object' || Array.isArray(tickers)) {
		throw new NodeOperationError(context.getNode(), `${path}.tickers must be a JSON object`, {
			itemIndex,
		});
	}

	const tickerEntries = Object.entries(tickers as IDataObject);
	if (tickerEntries.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${path}.tickers must include at least one ticker entry`,
			{
				itemIndex,
			},
		);
	}

	const normalizedTickers: IDataObject = {};

	for (const [tickerId, tickerValue] of tickerEntries) {
		const sanitizedTickerId = validateTickerId(context, tickerId, itemIndex, 'Ticker ID');
		if (!tickerValue || typeof tickerValue !== 'object' || Array.isArray(tickerValue)) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.tickers.${sanitizedTickerId} must be a JSON object`,
				{ itemIndex },
			);
		}

		ensureSafeObject(context, tickerValue, itemIndex, `${path}.tickers.${sanitizedTickerId}`);
		const typedTicker = tickerValue as IDataObject;

		const title = String(typedTicker.title ?? '').trim();
		if (!title) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.tickers.${sanitizedTickerId}.title is required`,
				{ itemIndex },
			);
		}
		if (title.length > 20) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.tickers.${sanitizedTickerId}.title cannot exceed 20 characters`,
				{ itemIndex },
			);
		}

		const type = String(typedTicker.type ?? '').trim();
		if (!allowedTickerTypes.has(type)) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.tickers.${sanitizedTickerId}.type must be one of: ${Array.from(allowedTickerTypes).join(', ')}`,
				{ itemIndex },
			);
		}

		const lastModifiedTimeNumber = normalizeLastModifiedTime(
			context,
			typedTicker.last_modified_time,
			itemIndex,
			`${path}.tickers.${sanitizedTickerId}.last_modified_time`,
		);

		const latitudeNumber = Number(typedTicker.latitude);
		if (!Number.isFinite(latitudeNumber) || latitudeNumber < -90 || latitudeNumber > 90) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.tickers.${sanitizedTickerId}.latitude must be between -90 and 90`,
				{ itemIndex },
			);
		}

		const longitudeNumber = Number(typedTicker.longitude);
		if (!Number.isFinite(longitudeNumber) || longitudeNumber < -180 || longitudeNumber > 180) {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.tickers.${sanitizedTickerId}.longitude must be between -180 and 180`,
				{ itemIndex },
			);
		}

		const normalizedTicker: IDataObject = {
			title,
			type,
			last_modified_time: lastModifiedTimeNumber,
			latitude: latitudeNumber,
			longitude: longitudeNumber,
		};

		if (typedTicker.color !== undefined) {
			const color = String(typedTicker.color).trim();
			if (!allowedTickerColors.has(color)) {
				throw new NodeOperationError(
					context.getNode(),
					`${path}.tickers.${sanitizedTickerId}.color must be one of: ${Array.from(
						allowedTickerColors,
					).join(', ')}`,
					{ itemIndex },
				);
			}
			normalizedTicker.color = color;
		}

		if (typedTicker.info !== undefined) {
			const info = String(typedTicker.info).trim();
			if (!info) {
				throw new NodeOperationError(
					context.getNode(),
					`${path}.tickers.${sanitizedTickerId}.info cannot be empty when provided`,
					{ itemIndex },
				);
			}
			if (info.length > 30) {
				throw new NodeOperationError(
					context.getNode(),
					`${path}.tickers.${sanitizedTickerId}.info cannot exceed 30 characters`,
					{ itemIndex },
				);
			}
			normalizedTicker.info = info;
		}

		if (typedTicker.destination !== undefined && typedTicker.destination !== null) {
			if (typeof typedTicker.destination !== 'object' || Array.isArray(typedTicker.destination)) {
				throw new NodeOperationError(
					context.getNode(),
					`${path}.tickers.${sanitizedTickerId}.destination must be a JSON object with latitude and longitude`,
					{ itemIndex },
				);
			}

			const dest = typedTicker.destination as IDataObject;
			const destLat = Number(dest.latitude);
			const destLng = Number(dest.longitude);

			if (!Number.isFinite(destLat) || destLat < -90 || destLat > 90) {
				throw new NodeOperationError(
					context.getNode(),
					`${path}.tickers.${sanitizedTickerId}.destination.latitude must be between -90 and 90`,
					{ itemIndex },
				);
			}

			if (!Number.isFinite(destLng) || destLng < -180 || destLng > 180) {
				throw new NodeOperationError(
					context.getNode(),
					`${path}.tickers.${sanitizedTickerId}.destination.longitude must be between -180 and 180`,
					{ itemIndex },
				);
			}

			normalizedTicker.destination = {
				latitude: Number(destLat.toFixed(7)),
				longitude: Number(destLng.toFixed(7)),
			};
		}

		normalizedTickers[sanitizedTickerId] = normalizedTicker;
	}

	return { tickers: normalizedTickers };
}

export function validateDeleteTickerBody(
	context: IExecuteFunctions,
	body: IDataObject,
	itemIndex: number,
	path: string,
): IDataObject {
	ensureSafeObject(context, body, itemIndex, path);

	const idsValue = body.ids;
	if (!Array.isArray(idsValue)) {
		throw new NodeOperationError(context.getNode(), `${path}.ids must be an array of strings`, {
			itemIndex,
		});
	}

	if (idsValue.length === 0) {
		throw new NodeOperationError(context.getNode(), `${path}.ids cannot be empty`, { itemIndex });
	}

	const normalizedIds: string[] = [];
	for (let idx = 0; idx < idsValue.length; idx++) {
		const rawId = idsValue[idx];
		if (typeof rawId !== 'string') {
			throw new NodeOperationError(
				context.getNode(),
				`${path}.ids[${idx}] must be a string ticker ID`,
				{
					itemIndex,
				},
			);
		}
		normalizedIds.push(validateTickerId(context, rawId, itemIndex, `Ticker ID at index ${idx}`));
	}

	return {
		ids: Array.from(new Set(normalizedIds)),
	};
}

type BuildStructuredPayloadFn = (
	context: IExecuteFunctions,
	itemIndex: number,
	rawEntries: IDataObject,
) => IDataObject;

type ValidatePayloadFn = (
	context: IExecuteFunctions,
	body: IDataObject,
	itemIndex: number,
	path: string,
) => IDataObject;

export interface IWidgetMapTickerRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

type WidgetMapTickerOperation = 'addOrUpdateTicker' | 'deleteTicker';

export interface IWidgetMapTickerRecoverableContextOptions {
	operation: WidgetMapTickerOperation;
	payloadPath: string;
	rawPayloadFieldName: string;
	structuredEntriesDefault: IDataObject;
	structuredEntriesFieldName: string;
	supportExtensionEndpoint?: boolean;
}

export type TickerRequestContext = {
	inputMode: 'structured' | 'raw';
	sanitizedMapId: string;
	sanitizedWidgetId?: string;
	endpoint: string;
	mapIsCustomExtension: boolean;
	appKeyRaw: string;
	body: IDataObject;
	qs: Record<string, string>;
};

function tryGetNodeParameter(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
	defaultValue: unknown,
): unknown {
	try {
		return context.getNodeParameter(name, itemIndex, defaultValue);
	} catch {
		return defaultValue;
	}
}

function tryValidateEntityId(
	context: IExecuteFunctions,
	value: unknown,
	fieldName: string,
	itemIndex: number,
): string | undefined {
	try {
		return validateEntityId(context, String(value ?? ''), fieldName, itemIndex);
	} catch {
		return undefined;
	}
}

function tryValidateTickerId(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName = 'Ticker ID',
): string | undefined {
	try {
		return validateTickerId(context, String(value ?? ''), itemIndex, fieldName);
	} catch {
		return undefined;
	}
}

function extractTickerIdsFromStructuredEntries(
	context: IExecuteFunctions,
	itemIndex: number,
	options: IWidgetMapTickerRecoverableContextOptions,
): string[] {
	const rawEntries = tryGetNodeParameter(
		context,
		options.structuredEntriesFieldName,
		itemIndex,
		options.structuredEntriesDefault,
	) as IDataObject;

	const collectionKey = options.operation === 'addOrUpdateTicker' ? 'ticker' : 'id';
	const rawCollection = rawEntries?.[collectionKey];
	const entries = Array.isArray(rawCollection)
		? rawCollection.filter((entry) => entry && typeof entry === 'object')
		: [];

	return Array.from(
		new Set(
			entries
				.map((entry, idx) =>
					tryValidateTickerId(context, entry.tickerId, itemIndex, `Ticker ID at index ${idx}`),
				)
				.filter((value): value is string => Boolean(value)),
		),
	);
}

function extractTickerIdsFromRawPayload(
	context: IExecuteFunctions,
	itemIndex: number,
	options: IWidgetMapTickerRecoverableContextOptions,
): string[] {
	const rawPayload = tryGetNodeParameter(context, options.rawPayloadFieldName, itemIndex, {});
	let parsedPayload: IDataObject;

	try {
		parsedPayload = parseJsonObjectInput(context, rawPayload, itemIndex, options.payloadPath);
	} catch {
		return [];
	}

	if (options.operation === 'addOrUpdateTicker') {
		const tickers = parsedPayload.tickers;
		if (!tickers || typeof tickers !== 'object' || Array.isArray(tickers)) {
			return [];
		}

		return Array.from(
			new Set(
				Object.keys(tickers as IDataObject)
					.map((tickerId) => tryValidateTickerId(context, tickerId, itemIndex))
					.filter((value): value is string => Boolean(value)),
			),
		);
	}

	const idsValue = parsedPayload.ids;
	if (!Array.isArray(idsValue)) {
		return [];
	}

	return Array.from(
		new Set(
			idsValue
				.map((tickerId, idx) =>
					typeof tickerId === 'string'
						? tryValidateTickerId(context, tickerId, itemIndex, `Ticker ID at index ${idx}`)
						: undefined,
				)
				.filter((value): value is string => Boolean(value)),
		),
	);
}

export function extractWidgetMapTickerRecoverableContext(
	context: IExecuteFunctions,
	itemIndex: number,
	options: IWidgetMapTickerRecoverableContextOptions,
): IDataObject {
	const contextFields: IDataObject = {};

	const sanitizedMapId = tryValidateEntityId(
		context,
		tryGetNodeParameter(context, 'mapId', itemIndex, ''),
		'Map ID',
		itemIndex,
	);
	if (sanitizedMapId) {
		contextFields.map_id = sanitizedMapId;
	}

	const rawMapIsCustomExtension = tryGetNodeParameter(
		context,
		'mapIsCustomExtension',
		itemIndex,
		false,
	);
	let mapIsCustomExtension = false;
	try {
		mapIsCustomExtension = parseBooleanFlag(
			context,
			rawMapIsCustomExtension,
			itemIndex,
			'Map Is Custom Extension',
		);
	} catch {
		mapIsCustomExtension = false;
	}

	const shouldRequireWidgetId = !(mapIsCustomExtension && options.supportExtensionEndpoint);
	if (shouldRequireWidgetId) {
		const sanitizedWidgetId = tryValidateEntityId(
			context,
			tryGetNodeParameter(context, 'widgetId', itemIndex, ''),
			'Widget ID',
			itemIndex,
		);
		if (sanitizedWidgetId) {
			contextFields.widget_id = sanitizedWidgetId;
		}
	}

	const requestedAppKey = String(
		tryGetNodeParameter(context, 'appKey', itemIndex, '') ?? '',
	).trim();
	if (mapIsCustomExtension && requestedAppKey) {
		contextFields.appkey = requestedAppKey;
	}

	const rawInputMode = String(
		tryGetNodeParameter(context, 'inputMode', itemIndex, '') ?? '',
	).trim();
	const tickerIds =
		rawInputMode === 'structured'
			? extractTickerIdsFromStructuredEntries(context, itemIndex, options)
			: rawInputMode === 'raw'
				? extractTickerIdsFromRawPayload(context, itemIndex, options)
				: [];

	if (tickerIds.length > 0) {
		if (options.operation === 'addOrUpdateTicker') {
			contextFields.ticker_ids = tickerIds;
		} else {
			contextFields.ids = tickerIds;
		}
	}

	return contextFields;
}

export function extractTickerRequestContext(
	context: IExecuteFunctions,
	itemIndex: number,
	options: {
		structuredEntriesFieldName: string;
		structuredEntriesDefault: IDataObject;
		rawPayloadFieldName: string;
		payloadPath: string;
		buildStructuredPayload: BuildStructuredPayloadFn;
		validatePayload: ValidatePayloadFn;
		supportExtensionEndpoint?: boolean;
	},
): TickerRequestContext {
	const inputMode = validateInputMode(
		context,
		context.getNodeParameter('inputMode', itemIndex) as string,
		itemIndex,
	);
	const mapId = context.getNodeParameter('mapId', itemIndex) as string;
	const mapIsCustomExtension = parseBooleanFlag(
		context,
		context.getNodeParameter('mapIsCustomExtension', itemIndex, false),
		itemIndex,
		'Map Is Custom Extension',
	);
	const sanitizedMapId = validateEntityId(context, mapId, 'Map ID', itemIndex);
	const shouldRequireWidgetId = !(mapIsCustomExtension && options.supportExtensionEndpoint);
	const widgetId = shouldRequireWidgetId
		? (context.getNodeParameter('widgetId', itemIndex) as string)
		: (tryGetNodeParameter(context, 'widgetId', itemIndex, '') as string);
	const appKeyRaw = context.getNodeParameter('appKey', itemIndex, '') as string;
	const sanitizedWidgetId = shouldRequireWidgetId
		? validateEntityId(context, widgetId, 'Widget ID', itemIndex)
		: undefined;
	const endpoint =
		mapIsCustomExtension && options.supportExtensionEndpoint === true
			? resolveTickerEndpoint(sanitizedMapId, undefined, true)
			: resolveTickerEndpoint(sanitizedMapId, sanitizedWidgetId as string);

	let body: IDataObject;
	if (inputMode === 'structured') {
		const rawEntries = context.getNodeParameter(
			options.structuredEntriesFieldName,
			itemIndex,
			options.structuredEntriesDefault,
		) as IDataObject;
		body = options.buildStructuredPayload(context, itemIndex, rawEntries);
	} else {
		const rawPayload = context.getNodeParameter(
			options.rawPayloadFieldName,
			itemIndex,
			{},
		) as unknown;
		body = options.validatePayload(
			context,
			parseJsonObjectInput(context, rawPayload, itemIndex, options.payloadPath),
			itemIndex,
			options.payloadPath,
		);
	}

	const qs: Record<string, string> = {};
	if (mapIsCustomExtension) {
		qs.appkey = validateAppKey(context, appKeyRaw, itemIndex);
	}

	return {
		inputMode,
		sanitizedMapId,
		sanitizedWidgetId,
		endpoint,
		mapIsCustomExtension,
		appKeyRaw,
		body,
		qs,
	};
}

export function validateTickerId(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
	fieldName = 'Ticker ID',
): string {
	return validateEntityId(context, value, fieldName, itemIndex);
}

export function isWidgetMapTickerAiErrorModeEnabled(
	context: IExecuteFunctions,
	itemIndex: number,
): boolean {
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

export function pushWidgetMapTickerRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IWidgetMapTickerRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isWidgetMapTickerAiErrorModeEnabled(context, itemIndex);

	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload =
		error && typeof error === 'object' && !Array.isArray(error)
			? ((error as IDataObject).zohoCliqScopeErrorPayload as IDataObject | undefined)
			: undefined;

	if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
		const mergedPayload: IDataObject = {
			...(scopePayload as IDataObject),
			...(options.contextFields ?? {}),
		};
		const executionData = context.helpers.constructExecutionMetaData([{ json: mergedPayload }], {
			itemData: { item: itemIndex },
		});
		returnData.push(...executionData);
		return true;
	}

	const errorPayload = buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'widgetMapTicker',
			operation,
		},
		{
			contextFields: options.contextFields,
			fallbackMessage: options.fallbackMessage,
			messageMappings: options.messageMappings,
		},
	);

	const executionData = context.helpers.constructExecutionMetaData([{ json: errorPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export function resolveWidgetMapTickerEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
	parameterName = 'includeEnhancedOutput',
	defaultValue = true,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = parseBooleanLikeTrue(
		context.getNodeParameter(parameterName, itemIndex, defaultValue),
	);
	const rawResponse = coerceApiResponseToObject(response);
	const responseJson = { ...rawResponse };

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson,
	};
}
