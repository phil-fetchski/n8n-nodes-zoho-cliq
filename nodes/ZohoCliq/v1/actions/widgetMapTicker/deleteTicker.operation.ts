import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { asDataObject } from '../../helpers/data';
import { WIDGET_MAP_TICKER_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	extractWidgetMapTickerRecoverableContext,
	extractTickerRequestContext,
	pushWidgetMapTickerRecoverableError,
	resolveWidgetMapTickerEnhancedOutput,
	validateDeleteTickerBody,
	validateTickerId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('widgetMapTicker', 'deleteTicker');

const properties: INodeProperties[] = [
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Use individual fields for ticker IDs, or JSON when you already have a payload with an ID array',
	},
	{
		displayName: 'Widget ID',
		name: 'widgetId',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				mapIsCustomExtension: [false],
			},
		},
		placeholder: 'e.g. WD_1234567890',
		description:
			'Unique widget ID from Zoho Cliq widget settings. Required only for the internal widget API endpoint /widgets/{WIDGET_ID}/maps/{MAP_ID}.',
	},
	{
		displayName: 'Map ID',
		name: 'mapId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. MAP_1234567890',
		description:
			'Unique map ID for the target map. Internal widgets use /widgets/{WIDGET_ID}/maps/{MAP_ID}; extensions use /extensions/widgets/maps/{MAP_ID}.',
	},
	{
		displayName: 'Map Is Custom Extension',
		name: 'mapIsCustomExtension',
		type: 'boolean',
		default: false,
		description:
			'Whether the widget map belongs to a custom extension. When enabled, this operation uses the extension endpoint and sends appkey as a query parameter.',
	},
	{
		displayName: 'App Key',
		name: 'appKey',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				mapIsCustomExtension: [true],
			},
		},
		placeholder: 'e.g. 1000.xxxxxx.yyyyyy',
		description:
			'Extension app key sent as the appkey query parameter for /extensions/widgets/maps/{MAP_ID}',
	},
	{
		displayName: 'Ticker IDs',
		name: 'tickerIdsEntries',
		type: 'fixedCollection',
		typeOptions: {
			multipleValues: true,
		},
		default: {
			id: [],
		},
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Add one or more ticker IDs to delete. These become ID array values in the API payload body.',
		options: [
			{
				name: 'id',
				displayName: 'Ticker ID',
				values: [
					{
						displayName: 'Ticker ID',
						name: 'tickerId',
						type: 'string',
						default: '',
						required: true,
						placeholder: 'e.g. chennai',
						description: 'Ticker ID to delete. Allowed: letters, numbers, hyphen, underscore.',
					},
				],
			},
		],
	},
	{
		displayName: 'Delete Ticker Payload (JSON)',
		name: 'deleteTickerPayload',
		type: 'json',
		default: '{"ids":[]}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Raw request body for deleting tickers. Must be an object with a non-empty ID array using the lowercase plural key for ID.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata with widget/map context and deleted ticker IDs. Disable to return Cliq's standard delete response.",
	},
	{
		displayName: `Delete Ticker Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete_ticker" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteTickerDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'Extension Guidance: <a href="https://www.zoho.com/cliq/help/platform/build-cliq-extensions.html" target="_blank" rel="noopener noreferrer">Build Zoho Cliq Extensions</a>',
		name: 'deleteTickerExtensionDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Widget Map Tickers/Delete Ticker as AI Tool Setup Guide: <a href="${WIDGET_MAP_TICKER_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteTickerAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['widgetMapTicker'],
		operation: ['deleteTicker'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function buildStructuredDeletePayload(
	context: IExecuteFunctions,
	itemIndex: number,
	rawEntries: IDataObject,
): IDataObject {
	const rawTickerIdEntries = rawEntries.id;
	const entries = Array.isArray(rawTickerIdEntries)
		? rawTickerIdEntries.filter((entry) => entry && typeof entry === 'object')
		: [];

	const ids = entries.map((entry, idx) =>
		validateTickerId(context, String(entry.tickerId ?? ''), itemIndex, `Ticker ID at index ${idx}`),
	);

	return validateDeleteTickerBody(context, { ids }, itemIndex, 'Delete Ticker Payload');
}

function extractDeleteTickerDebugFields(error: unknown): IDataObject {
	const debugFields: IDataObject = {};

	if (error instanceof Error) {
		debugFields.debug_error_name = error.name;
		debugFields.debug_error_message = error.message;
		debugFields.debug_error_properties = Object.getOwnPropertyNames(error);
	}

	if (!error || typeof error !== 'object' || Array.isArray(error)) {
		return debugFields;
	}

	const description = Reflect.get(error, 'description');
	const httpCode = Reflect.get(error, 'httpCode');
	const context = asDataObject(Reflect.get(error, 'context'));
	const errorResponse = asDataObject(Reflect.get(error, 'errorResponse'));
	const zohoCliqDebug = asDataObject(Reflect.get(error, 'zohoCliqDebug'));
	const response =
		asDataObject(Reflect.get(error, 'response')) ??
		(errorResponse ? asDataObject(errorResponse.response) : undefined);

	const projectDebugContext = (value: IDataObject | undefined): IDataObject | undefined => {
		if (!value) {
			return undefined;
		}

		const projected: IDataObject = {};
		for (const key of ['requestId', 'accountId', 'userId']) {
			const candidate = value[key];
			if (
				typeof candidate === 'string' ||
				typeof candidate === 'number' ||
				typeof candidate === 'boolean'
			) {
				projected[key] = candidate;
			}
		}

		return Object.keys(projected).length > 0 ? projected : undefined;
	};

	const projectDebugResponse = (value: IDataObject | undefined): IDataObject | undefined => {
		if (!value) {
			return undefined;
		}

		const projected: IDataObject = {};
		if (typeof value.status === 'number') {
			projected.status = value.status;
		}
		if (typeof value.statusText === 'string' && value.statusText.trim()) {
			projected.statusText = value.statusText.trim();
		}
		if (value.headers !== undefined) {
			projected.headers = value.headers;
		}
		if (value.data !== undefined) {
			projected.data = value.data;
		} else if (value.body !== undefined) {
			projected.data = value.body;
		}

		return Object.keys(projected).length > 0 ? projected : undefined;
	};

	const projectDebugErrorResponse = (value: IDataObject | undefined): IDataObject | undefined => {
		if (!value) {
			return undefined;
		}

		const projected: IDataObject = {};
		for (const key of ['message', 'code', 'details']) {
			if (value[key] !== undefined) {
				projected[key] = value[key];
			}
		}

		if (value.status !== undefined) {
			projected.status = value.status;
		} else if (value.statusCode !== undefined) {
			projected.status = value.statusCode;
		}

		return Object.keys(projected).length > 0 ? projected : undefined;
	};

	const projectedContext = projectDebugContext(context);
	const projectedResponse = projectDebugResponse(response);
	const projectedErrorResponse = projectDebugErrorResponse(errorResponse);

	const debugResponse: IDataObject = {};
	const statusCode =
		typeof httpCode === 'number'
			? httpCode
			: response && typeof response.status === 'number'
				? response.status
				: response && typeof response.statusCode === 'number'
					? response.statusCode
					: typeof errorResponse?.statusCode === 'number'
						? (errorResponse.statusCode as number)
						: undefined;

	if (statusCode !== undefined) {
		debugResponse.status = statusCode;
		debugFields.debug_status_code = statusCode;
	}

	if (typeof description === 'string' && description.trim()) {
		debugResponse.description = description.trim();
		debugFields.debug_description = description.trim();
	}

	if (projectedContext) {
		debugResponse.context = projectedContext;
		debugFields.debug_context = projectedContext;
	}

	if (projectedResponse) {
		if (projectedResponse.statusText !== undefined) {
			debugResponse.statusText = projectedResponse.statusText;
		}
		if (projectedResponse.headers !== undefined) {
			debugResponse.headers = projectedResponse.headers;
		}
		if (projectedResponse.data !== undefined) {
			debugResponse.data = projectedResponse.data;
		}
	}

	if (!response && projectedErrorResponse) {
		debugResponse.error_response = projectedErrorResponse;
	}

	if (projectedErrorResponse) {
		debugFields.debug_error_response = projectedErrorResponse;
	}

	if (zohoCliqDebug && Object.keys(zohoCliqDebug).length > 0) {
		debugFields.debug_transport = zohoCliqDebug;
	}

	if (Object.keys(debugResponse).length > 0) {
		debugFields.debug_response = debugResponse;
	}

	return debugFields;
}

function collectDeleteTickerErrorTexts(error: unknown): string[] {
	const values: string[] = [];
	const extractText = (value: unknown): string | undefined => {
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (!trimmed) {
				return undefined;
			}

			try {
				const parsed = JSON.parse(trimmed) as unknown;
				if (typeof parsed === 'string') {
					return parsed.trim() || trimmed;
				}
				if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
					const parsedObject = parsed as IDataObject;
					if (typeof parsedObject.message === 'string' && parsedObject.message.trim()) {
						return parsedObject.message.trim();
					}
				}
			} catch {
				// Ignore parse failures and fall back to the raw string value.
			}

			return trimmed;
		}

		if (value && typeof value === 'object' && !Array.isArray(value)) {
			const objectValue = value as IDataObject;
			if (typeof objectValue.message === 'string' && objectValue.message.trim()) {
				return objectValue.message.trim();
			}
		}

		return undefined;
	};
	const push = (value: unknown) => {
		const extracted = extractText(value);
		if (!extracted) {
			return;
		}
		if (!values.includes(extracted)) {
			values.push(extracted);
		}
	};

	if (error instanceof Error) {
		push(error.message);
	}

	if (!error || typeof error !== 'object' || Array.isArray(error)) {
		return values;
	}

	const description = Reflect.get(error, 'description');
	const context = asDataObject(Reflect.get(error, 'context'));
	const errorResponse = asDataObject(Reflect.get(error, 'errorResponse'));
	const zohoCliqDebug = asDataObject(Reflect.get(error, 'zohoCliqDebug'));
	const response =
		asDataObject(Reflect.get(error, 'response')) ??
		(errorResponse ? asDataObject(errorResponse.response) : undefined);

	push(description);
	push(context?.data);
	push(response?.data);
	push(response?.body);
	push(zohoCliqDebug?.original_message);
	push(zohoCliqDebug?.response_data);
	push(zohoCliqDebug?.response_body);

	return values;
}

function isKnownExtensionDeleteFalseNegative(error: unknown): boolean {
	return collectDeleteTickerErrorTexts(error).some((text) =>
		text.toLowerCase().includes('the http method you are trying is invalid'),
	);
}

function buildKnownExtensionDeleteFallbackResponse(ids: string[]): IDataObject {
	return {
		success: true,
		ids,
	};
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let sanitizedMapId: string | undefined;
		let sanitizedWidgetId: string | undefined;
		let tickerIds: string[] = [];
		let requestedAppKey: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);
			const recoverableContext = extractWidgetMapTickerRecoverableContext(this, i, {
				operation: 'deleteTicker',
				structuredEntriesFieldName: 'tickerIdsEntries',
				structuredEntriesDefault: { id: [] },
				rawPayloadFieldName: 'deleteTickerPayload',
				payloadPath: 'Delete Ticker Payload',
				supportExtensionEndpoint: true,
			});
			sanitizedMapId =
				typeof recoverableContext.map_id === 'string' ? recoverableContext.map_id : undefined;
			sanitizedWidgetId =
				typeof recoverableContext.widget_id === 'string' ? recoverableContext.widget_id : undefined;
			tickerIds = Array.isArray(recoverableContext.ids)
				? [...(recoverableContext.ids as string[])]
				: [];
			requestedAppKey =
				typeof recoverableContext.appkey === 'string' ? recoverableContext.appkey : undefined;

			const {
				sanitizedMapId: mapId,
				sanitizedWidgetId: widgetId,
				endpoint,
				body,
				qs,
				mapIsCustomExtension,
			} = extractTickerRequestContext(this, i, {
				structuredEntriesFieldName: 'tickerIdsEntries',
				structuredEntriesDefault: { id: [] },
				rawPayloadFieldName: 'deleteTickerPayload',
				payloadPath: 'Delete Ticker Payload',
				buildStructuredPayload: buildStructuredDeletePayload,
				validatePayload: validateDeleteTickerBody,
				supportExtensionEndpoint: true,
			});
			sanitizedMapId = mapId;
			sanitizedWidgetId = widgetId;
			tickerIds = [...(body.ids as string[])];
			requestedAppKey = typeof qs.appkey === 'string' ? qs.appkey : requestedAppKey;

			let response: IDataObject | undefined | null;
			try {
				response = (await zohoCliqApiRequest.call(this, 'DELETE', endpoint, body, qs)) as
					| IDataObject
					| undefined
					| null;
			} catch (error) {
				if (!(mapIsCustomExtension && isKnownExtensionDeleteFalseNegative(error))) {
					throw error;
				}

				response = buildKnownExtensionDeleteFallbackResponse(tickerIds);
			}
			const { includeEnhancedOutput, rawResponse, responseJson } =
				resolveWidgetMapTickerEnhancedOutput(this, i, response);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									deleted: true,
									success: true,
									resource: 'widgetMapTicker',
									operation: 'deleteTicker',
									...(sanitizedWidgetId ? { widget_id: sanitizedWidgetId } : {}),
									map_id: sanitizedMapId,
									ids: tickerIds,
									data: responseJson,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushWidgetMapTickerRecoverableError(this, returnData, i, 'deleteTicker', error, {
					contextFields: {
						...(sanitizedWidgetId ? { widget_id: sanitizedWidgetId } : {}),
						...(sanitizedMapId ? { map_id: sanitizedMapId } : {}),
						...(tickerIds.length > 0 ? { ids: tickerIds } : {}),
						...(requestedAppKey ? { appkey: requestedAppKey } : {}),
						...extractDeleteTickerDebugFields(error),
					},
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
