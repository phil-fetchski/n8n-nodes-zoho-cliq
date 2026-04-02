/**
 * Zoho Cliq API request helper
 * Handles authenticated requests to Zoho Cliq API endpoints
 */

import type { IDataObject, IExecuteFunctions, IHttpRequestOptions, JsonObject } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import { CLIQ_BASE_URL_MAP } from '../helpers/constants';
import { asDataObject } from '../helpers/data';

export interface IZohoCliqRequestOptions {
	headers?: IDataObject;
	json?: boolean;
}

export interface IZohoCliqBinaryResponse {
	data: Buffer;
	headers: IDataObject;
	statusCode?: number;
}

function normalizeRawResponse(response: unknown): IDataObject {
	if (typeof response === 'string') {
		const trimmed = response.trim();
		if (looksLikeJson(trimmed)) {
			try {
				const parsed = JSON.parse(trimmed) as IDataObject | IDataObject[];
				return Array.isArray(parsed) ? ({ data: parsed } as IDataObject) : parsed;
			} catch {
				// Fall through and return a text wrapper if JSON parsing fails.
			}
		}

		return { csv: response };
	}

	if (response && typeof response === 'object' && !Array.isArray(response)) {
		return response as IDataObject;
	}

	return { data: response as unknown as string | number | boolean };
}

async function resolveBaseUrl(this: IExecuteFunctions): Promise<string> {
	const credentials = await this.getCredentials('zohoCliqOAuth2Api');
	if (!credentials) {
		throw new NodeOperationError(
			this.getNode(),
			'No credentials configured. Please set up Zoho Cliq OAuth2 credentials.',
		);
	}

	const dc = (credentials.dc as string) || 'us';
	validateDataCenter(dc, this);
	return CLIQ_BASE_URL_MAP[dc];
}

function getFirstString(values: unknown[]): string | undefined {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return undefined;
}

function looksLikeJson(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) {
		return false;
	}

	return (
		(trimmed.startsWith('{') && trimmed.endsWith('}')) ||
		(trimmed.startsWith('[') && trimmed.endsWith(']'))
	);
}

function asDataObjectFromUnknown(value: unknown): IDataObject | undefined {
	const objectValue = asDataObject(value);
	if (objectValue) {
		return objectValue;
	}

	if (typeof value !== 'string') {
		return undefined;
	}

	const trimmed = value.trim();
	if (!looksLikeJson(trimmed)) {
		return undefined;
	}

	try {
		const parsed = JSON.parse(trimmed) as unknown;
		return asDataObject(parsed);
	} catch {
		return undefined;
	}
}

function extractZohoErrorText(error: unknown): string | undefined {
	const root = asDataObjectFromUnknown(error);
	if (!root) {
		return undefined;
	}

	const response = asDataObjectFromUnknown(root.response);
	const body = asDataObjectFromUnknown(response?.body);
	const bodyData = asDataObjectFromUnknown(body?.data);
	const data = asDataObjectFromUnknown(response?.data);
	const dataData = asDataObjectFromUnknown(data?.data);
	const errorObject = asDataObjectFromUnknown(root.error);
	const nestedErrorObject =
		asDataObjectFromUnknown(body?.error) ?? asDataObjectFromUnknown(data?.error);
	const stringifyPayload = (value: unknown): string | undefined => {
		const objectValue = asDataObjectFromUnknown(value);
		if (!objectValue || Object.keys(objectValue).length === 0) {
			return undefined;
		}

		try {
			return JSON.stringify(objectValue);
		} catch {
			return undefined;
		}
	};

	return (
		getFirstString([
			body?.message,
			body?.error,
			body?.description,
			body?.details,
			body?.code,
			body?.error_code,
			bodyData?.message,
			bodyData?.error,
			bodyData?.description,
			bodyData?.details,
			bodyData?.code,
			bodyData?.error_code,
			data?.message,
			data?.error,
			data?.description,
			data?.details,
			data?.code,
			data?.error_code,
			dataData?.message,
			dataData?.error,
			dataData?.description,
			dataData?.details,
			dataData?.code,
			dataData?.error_code,
			nestedErrorObject?.message,
			nestedErrorObject?.description,
			nestedErrorObject?.code,
			nestedErrorObject?.error_code,
			errorObject?.message,
			errorObject?.description,
			errorObject?.code,
			errorObject?.error_code,
			root.description,
		]) ??
		getFirstString([
			stringifyPayload(body),
			stringifyPayload(bodyData),
			stringifyPayload(data),
			stringifyPayload(dataData),
			stringifyPayload(nestedErrorObject),
			stringifyPayload(errorObject),
		])
	);
}

function extractZohoCliqDebugPayload(error: unknown): IDataObject | undefined {
	const root = asDataObjectFromUnknown(error);
	if (!root) {
		return undefined;
	}

	const response = asDataObjectFromUnknown(root.response);
	const payload: IDataObject = {};

	if (typeof root.message === 'string' && root.message.trim()) {
		payload.original_message = root.message.trim();
	}

	if (typeof root.statusCode === 'number') {
		payload.status_code = root.statusCode;
	}

	if (typeof root.httpCode === 'number') {
		payload.http_code = root.httpCode;
	}

	if (response) {
		if (typeof response.status === 'number') {
			payload.response_status = response.status;
		}
		if (typeof response.statusCode === 'number') {
			payload.response_status_code = response.statusCode;
		}
		if (response.data !== undefined) {
			payload.response_data = response.data;
		}
		if (response.body !== undefined) {
			payload.response_body = response.body;
		}
		if (response.headers !== undefined) {
			payload.response_headers = response.headers;
		}
	}

	return Object.keys(payload).length > 0 ? payload : undefined;
}

/**
 * Validates the data center selection
 * @throws NodeOperationError if data center is invalid
 */
export function validateDataCenter(dc: string, context: IExecuteFunctions): void {
	const validDataCenters = Object.keys(CLIQ_BASE_URL_MAP);

	if (!validDataCenters.includes(dc)) {
		throw new NodeOperationError(
			context.getNode(),
			`Invalid data center: "${dc}". Must be one of: ${validDataCenters.join(', ')}. Please check your credential configuration.`,
		);
	}
}

/**
 * Helper function to make authenticated API requests to Zoho Cliq
 * Uses the modern httpRequestWithAuthentication helper from N8N
 * Implements proper N8N error handling with NodeApiError for API errors
 *
 * @returns A Zoho Cliq API response with proper typing
 */
export async function zohoCliqApiRequest(
	this: IExecuteFunctions,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	endpoint: string,
	body?: IDataObject,
	qs?: Record<string, string | number | boolean>,
	requestOptions?: IZohoCliqRequestOptions,
): Promise<IDataObject> {
	const baseUrl = await resolveBaseUrl.call(this);

	// Validate endpoint format using N8N operational error
	if (!endpoint.startsWith('/')) {
		throw new NodeOperationError(
			this.getNode(),
			`Invalid API endpoint: "${endpoint}". Endpoint must start with /.`,
		);
	}

	const fullUrl = `${baseUrl}${endpoint}`;

	const options: IHttpRequestOptions = {
		method,
		url: fullUrl,
		body,
		qs,
		headers: requestOptions?.headers,
		json: requestOptions?.json ?? true,
	};

	try {
		// Use the modern N8N helper for authenticated requests
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'zohoCliqOAuth2Api',
			options,
		);

		if (options.json !== false) {
			return response as IDataObject;
		}
		return normalizeRawResponse(response);
	} catch (error: unknown) {
		// N8N Best Practice: Wrap API errors in NodeApiError for proper error handling
		// This provides better error context including HTTP status codes
		// NodeApiError expects a JsonObject with error response data
		// Runtime validation before type assertion to prevent unsafe coercion
		const jsonError =
			error && typeof error === 'object' && !Array.isArray(error)
				? (error as JsonObject)
				: ({ message: String(error) } as JsonObject);
		const zohoErrorText = extractZohoErrorText(error);
		const wrappedError = new NodeApiError(this.getNode(), jsonError, {
			message: zohoErrorText || undefined,
			description: zohoErrorText || undefined,
		});
		const debugPayload = extractZohoCliqDebugPayload(error);
		if (debugPayload) {
			(wrappedError as NodeApiError & { zohoCliqDebug?: IDataObject }).zohoCliqDebug = debugPayload;
		}
		throw wrappedError;
	}
}

export async function zohoCliqApiMultipartRequest(
	this: IExecuteFunctions,
	method: 'POST' | 'PUT',
	endpoint: string,
	body: Buffer,
	contentType: string,
	qs?: Record<string, string | number | boolean>,
): Promise<IDataObject> {
	if (!endpoint.startsWith('/')) {
		throw new NodeOperationError(
			this.getNode(),
			`Invalid API endpoint: "${endpoint}". Endpoint must start with /.`,
		);
	}

	if (!contentType.trim()) {
		throw new NodeOperationError(this.getNode(), 'Content-Type is required for multipart requests');
	}

	const baseUrl = await resolveBaseUrl.call(this);
	const fullUrl = `${baseUrl}${endpoint}`;

	const options: IHttpRequestOptions = {
		method,
		url: fullUrl,
		body,
		qs,
		headers: {
			'Content-Type': contentType,
		},
		json: false,
	};

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'zohoCliqOAuth2Api',
			options,
		);
		return normalizeRawResponse(response);
	} catch (error: unknown) {
		const jsonError =
			error && typeof error === 'object' && !Array.isArray(error)
				? (error as JsonObject)
				: ({ message: String(error) } as JsonObject);
		const zohoErrorText = extractZohoErrorText(error);
		throw new NodeApiError(this.getNode(), jsonError, {
			message: zohoErrorText || undefined,
			description: zohoErrorText || undefined,
		});
	}
}

export async function zohoCliqApiBinaryRequest(
	this: IExecuteFunctions,
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	endpoint: string,
	body?: IDataObject,
	qs?: Record<string, string | number | boolean>,
	headers?: IDataObject,
): Promise<IZohoCliqBinaryResponse> {
	const baseUrl = await resolveBaseUrl.call(this);

	if (!endpoint.startsWith('/')) {
		throw new NodeOperationError(
			this.getNode(),
			`Invalid API endpoint: "${endpoint}". Endpoint must start with /.`,
		);
	}

	const fullUrl = `${baseUrl}${endpoint}`;

	const options = {
		method,
		url: fullUrl,
		body,
		qs,
		headers,
		json: false,
		returnFullResponse: true,
		encoding: 'arraybuffer' as const,
	};

	try {
		const response = await this.helpers.httpRequestWithAuthentication.call(
			this,
			'zohoCliqOAuth2Api',
			options,
		);

		const responseObject =
			response && typeof response === 'object' && !Array.isArray(response)
				? (response as IDataObject)
				: undefined;
		const responseBody = responseObject?.body;
		const responseHeaders = responseObject?.headers;
		const statusCodeValue = responseObject?.statusCode;
		const bodyBuffer = Buffer.isBuffer(responseBody)
			? responseBody
			: responseBody instanceof ArrayBuffer
				? Buffer.from(responseBody)
				: ArrayBuffer.isView(responseBody)
					? Buffer.from(responseBody.buffer, responseBody.byteOffset, responseBody.byteLength)
					: Buffer.from(String(responseBody ?? ''), 'binary');

		return {
			data: bodyBuffer,
			headers:
				responseHeaders && typeof responseHeaders === 'object' && !Array.isArray(responseHeaders)
					? (responseHeaders as IDataObject)
					: {},
			statusCode: typeof statusCodeValue === 'number' ? statusCodeValue : undefined,
		};
	} catch (error: unknown) {
		const jsonError =
			error && typeof error === 'object' && !Array.isArray(error)
				? (error as JsonObject)
				: ({ message: String(error) } as JsonObject);
		const zohoErrorText = extractZohoErrorText(error);
		throw new NodeApiError(this.getNode(), jsonError, {
			message: zohoErrorText || undefined,
			description: zohoErrorText || undefined,
		});
	}
}
