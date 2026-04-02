import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { FILES_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateFileId } from '../../helpers/utils';
import { zohoCliqApiBinaryRequest } from '../../transport';
import { pushFilesRecoverableError } from './common';
import type { ICliqErrorMessageMapping } from '../shared/errorResponse';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('files', 'getFile');

const properties: INodeProperties[] = [
	{
		displayName: 'File ID',
		name: 'fileId',
		type: 'string',
		default: '',
		required: true,
		description:
			'The exact Zoho Cliq file ID to retrieve. Use the file ID returned by a message or file-sharing response.',
		placeholder: 'e.g. a_1234567890987654321_2_0123456789',
		displayOptions: {
			show: {
				resource: ['file'],
			},
		},
	},
	{
		displayName:
			'You can retrieve the File ID for a file in a Cliq Chat or Channel by using the ZohoCliq.Messages.GetMessages Node. You can filter messages by "type": "file" to get only messages with files. The ID will be in the message JSON response under content.file. If you want to reuse the same file across multiple executions, consider storing the fileId in an Edit Fields (Set) Node.',
		name: 'getFileDocsNotice2',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Output Data Field Name',
		name: 'binaryProperty',
		type: 'string',
		default: 'data',
		required: true,
		description:
			'The name of the output data field that should receive the downloaded file. Use a simple field name such as "data" or "attachment".',
	},
	{
		displayName: 'File Name',
		name: 'fileName',
		type: 'string',
		default: '',
		description:
			'Optional output file name override. Blank values are allowed and omitted so the node can use the response headers or fall back to the file ID.',
		placeholder: 'e.g. my-document.pdf',
	},
	{
		displayName: `Get File Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#File_Download" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getFileDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Files/Get File as AI Tool Setup Guide: <a href="${FILES_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getFileAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['file'],
		operation: ['getFile'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const mimeExtensionMap: Record<string, string> = {
	'application/pdf': 'pdf',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/gif': 'gif',
	'image/webp': 'webp',
	'application/zip': 'zip',
	'text/plain': 'txt',
};

function getHeaderValue(headers: IDataObject, headerName: string): string | undefined {
	const target = headerName.toLowerCase();
	for (const [rawKey, rawValue] of Object.entries(headers)) {
		if (rawKey.toLowerCase() !== target) {
			continue;
		}

		let headerValue: string | undefined;
		if (typeof rawValue === 'string') {
			headerValue = rawValue;
		} else if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
			headerValue = String(rawValue);
		} else {
			/* istanbul ignore next: branch is exercised but can remain unmapped in transpiled output */
			if (Array.isArray(rawValue)) {
				headerValue = rawValue.find((value): value is string => typeof value === 'string');
			}
		}

		if (typeof headerValue === 'string') {
			return headerValue.trim();
		}
	}

	return undefined;
}

function decodeFileNameValue(value: string): string {
	const withoutQuotes = value.replace(/^"(.*)"$/, '$1').trim();
	try {
		return decodeURIComponent(withoutQuotes);
	} catch {
		return withoutQuotes;
	}
}

function extractFileNameFromContentDisposition(contentDisposition: string): string | undefined {
	const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
	if (utf8Match?.[1]) {
		return decodeFileNameValue(utf8Match[1]);
	}

	const standardMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
	if (standardMatch?.[1]) {
		return decodeFileNameValue(standardMatch[1]);
	}

	return undefined;
}

function sanitizeOutputFileName(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
	path: string,
): string {
	const sanitized = value.trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	const parts = sanitized.split(/[\\/]/);
	const baseName = parts[parts.length - 1];
	for (const key of blockedObjectKeys) {
		if (baseName === key) {
			throw new NodeOperationError(context.getNode(), `${path} contains an unsafe value`, {
				itemIndex,
			});
		}
	}

	if (/[\r\n]/.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), `${path} cannot contain newlines`, {
			itemIndex,
		});
	}

	if (sanitized.length > 255) {
		throw new NodeOperationError(context.getNode(), `${path} is too long (max 255 characters)`, {
			itemIndex,
		});
	}

	return sanitized.replace(/[\\/:*?"<>|]/g, '_');
}

function buildFallbackFileName(fileId: string, mimeType: string): string {
	const extension = mimeExtensionMap[mimeType.toLowerCase()];
	return extension ? `${fileId}.${extension}` : fileId;
}

function buildGetFileRecoverableMessageMappings(fileId?: string): ICliqErrorMessageMapping[] {
	if (!fileId) {
		return [];
	}

	return [
		{
			match: (_normalizedMessage, _message, _error, statusCode) => statusCode === 400,
			reason: 'INVALID_FILE_ID_OR_ACCESS',
			hint: 'The fileId is the most likely cause. Verify this exact file ID exists and is accessible to the authenticated user.',
			messageOverride: `Failed to retrieve file (HTTP 400). The fileId is the most likely cause. Verify this exact fileId exists and is accessible: ${fileId}`,
		},
	];
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let sanitizedFileId: string | undefined;
		let sanitizedBinaryProperty: string | undefined;
		let sanitizedCustomFileName: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const fileId = this.getNodeParameter('fileId', i) as string;
			const binaryProperty = this.getNodeParameter('binaryProperty', i, 'data') as string;
			const customFileName = this.getNodeParameter('fileName', i, '') as string;
			sanitizedFileId = validateFileId(this, fileId, i);
			sanitizedBinaryProperty = sanitizeOutputFileName(this, binaryProperty, i, 'Binary Property');
			sanitizedCustomFileName = customFileName.trim()
				? sanitizeOutputFileName(this, customFileName, i, 'File Name')
				: undefined;

			const endpoint = `/api/v2/files/${encodeURIComponent(sanitizedFileId)}`;
			const response = await zohoCliqApiBinaryRequest.call(this, 'GET', endpoint);
			const contentTypeHeader = getHeaderValue(response.headers, 'content-type');
			const mimeType = contentTypeHeader ? contentTypeHeader.split(';')[0].trim() : '';
			const contentDisposition = getHeaderValue(response.headers, 'content-disposition');
			const fileNameFromHeaders = contentDisposition
				? extractFileNameFromContentDisposition(contentDisposition)
				: undefined;
			const resolvedFileName =
				sanitizedCustomFileName ||
				(fileNameFromHeaders
					? sanitizeOutputFileName(this, fileNameFromHeaders, i, 'File Name')
					: '') ||
				buildFallbackFileName(sanitizedFileId, mimeType || 'application/octet-stream');

			const preparedBinary = await this.helpers.prepareBinaryData(
				response.data,
				resolvedFileName,
				mimeType || 'application/octet-stream',
			);
			const binaryData = {
				...preparedBinary,
				fileName: resolvedFileName,
				mimeType: mimeType || 'application/octet-stream',
				fileSize: String(response.data.length),
				bytes: response.data.length,
			};

			const outputItem: INodeExecutionData = {
				json: {
					fileId: sanitizedFileId,
					fileName: resolvedFileName,
					mimeType: binaryData.mimeType,
					fileSize: response.data.length,
					binaryProperty: sanitizedBinaryProperty,
					...(binaryData.id ? { binary_handle_id: binaryData.id } : {}),
				},
				binary: {
					[sanitizedBinaryProperty]: binaryData,
				},
			};

			const executionData = this.helpers.constructExecutionMetaData([outputItem], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushFilesRecoverableError(this, returnData, i, 'getFile', error, {
					contextFields: {
						...(sanitizedFileId ? { file_id: sanitizedFileId } : {}),
						...(sanitizedBinaryProperty ? { binary_property: sanitizedBinaryProperty } : {}),
						...(sanitizedCustomFileName ? { requested_file_name: sanitizedCustomFileName } : {}),
					},
					fallbackMessage: 'Failed to retrieve file from Zoho Cliq.',
					messageMappings: buildGetFileRecoverableMessageMappings(sanitizedFileId),
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
