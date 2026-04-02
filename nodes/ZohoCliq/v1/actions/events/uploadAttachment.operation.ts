/**
 * Upload Event Attachment operation
 */

import type {
	IBinaryData,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { EVENTS_UPLOAD_ATTACHMENT_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiMultipartRequest } from '../../transport';
import { pushEventsRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('events', 'uploadAttachment');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

function validateBinaryProperty(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	const sanitized = String(value ?? '').trim();
	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Binary Property is required', {
			itemIndex,
		});
	}

	if (sanitized.length > 255) {
		throw new NodeOperationError(context.getNode(), 'Binary Property is too long', {
			itemIndex,
		});
	}

	return sanitized;
}

function isBinaryDataLike(value: unknown): value is IBinaryData {
	return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function resolveBinaryInput(
	context: IExecuteFunctions,
	value: unknown,
	item: INodeExecutionData,
	itemIndex: number,
): { binaryData: IBinaryData; binaryProperty?: string; source: 'inline' | 'item' } {
	if (
		value === null ||
		value === undefined ||
		typeof value === 'string' ||
		typeof value === 'number'
	) {
		const binaryProperty = validateBinaryProperty(context, value, itemIndex);
		const binaryDataMap =
			item.binary && typeof item.binary === 'object' && !Array.isArray(item.binary)
				? item.binary
				: undefined;
		if (!binaryDataMap || !Object.prototype.hasOwnProperty.call(binaryDataMap, binaryProperty)) {
			throw new NodeOperationError(
				context.getNode(),
				`No binary data found for property "${binaryProperty}". Please provide a file from a previous node.`,
				{ itemIndex },
			);
		}

		return {
			binaryData: binaryDataMap[binaryProperty],
			binaryProperty,
			source: 'item',
		};
	}

	if (isBinaryDataLike(value)) {
		const directBinary = value as Record<string, unknown>;
		if (typeof directBinary.data === 'string') {
			return { binaryData: value, source: 'inline' };
		}

		const entries = Object.entries(directBinary);
		if (entries.length === 1 && isBinaryDataLike(entries[0][1])) {
			const [binaryProperty, nestedBinaryData] = entries[0];
			const nestedBinary = nestedBinaryData as Record<string, unknown>;
			if (typeof nestedBinary.data === 'string') {
				return {
					binaryData: nestedBinaryData,
					binaryProperty,
					source: 'inline',
				};
			}
		}

		throw new NodeOperationError(
			context.getNode(),
			'Direct binary object input must include inline base64 file data. If your file is stored on the item, pass the binary property name instead, for example "data".',
			{ itemIndex },
		);
	}

	throw new NodeOperationError(
		context.getNode(),
		'Binary Property must be a binary property name such as "data" or a direct binary object expression.',
		{ itemIndex },
	);
}

function sanitizeMimeType(value: unknown): string {
	const mimeType = String(value ?? '')
		.trim()
		.replace(/[\r\n]/g, '');
	return mimeType || 'application/octet-stream';
}

const properties: INodeProperties[] = [
	{
		displayName: 'Input Data Field Name',
		name: 'binaryProperty',
		type: 'string',
		default: 'data',
		required: true,
		description:
			'The name of the input data field containing the file, for example `data`, or a direct binary object expression from a previous node',
	},
	{
		displayName:
			'Usage Note: Use the returned <code>attachments.fileId</code> value in the ZohoCliq <b>Create Event</b> or <b>Update Event</b> operation to attach this uploaded file to an event.',
		name: 'uploadAttachmentUsageNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Upload Event Attachment Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#upload-attachments-to-event" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'uploadEventAttachmentDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Events/Upload Event Attachment as AI Tool Setup Guide: <a href="${EVENTS_UPLOAD_ATTACHMENT_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'uploadEventAttachmentAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['event'],
		operation: ['uploadAttachment'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let sanitizedBinaryProperty: string | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			const item = items[i];
			const rawBinaryInput = this.getNodeParameter('binaryProperty', i);
			if (typeof rawBinaryInput === 'string' || typeof rawBinaryInput === 'number') {
				sanitizedBinaryProperty = validateBinaryProperty(this, rawBinaryInput, i);
			}
			const { binaryData, binaryProperty, source } = resolveBinaryInput(
				this,
				rawBinaryInput,
				item,
				i,
			);
			sanitizedBinaryProperty = binaryProperty;
			const getBinaryDataBuffer = (
				this.helpers as unknown as {
					getBinaryDataBuffer?: (itemIndex: number, propertyName: string) => Promise<Buffer>;
				}
			).getBinaryDataBuffer;
			const fileBuffer =
				source === 'item' && typeof getBinaryDataBuffer === 'function' && sanitizedBinaryProperty
					? await getBinaryDataBuffer(i, sanitizedBinaryProperty)
					: Buffer.from(binaryData.data, 'base64');
			const fileName = (binaryData.fileName || sanitizedBinaryProperty || 'attachment')
				.replace(/[\r\n]/g, '_')
				.replace(/\\/g, '\\\\')
				.replace(/"/g, '\\"');
			const mimeType = sanitizeMimeType(binaryData.mimeType);

			const boundary = `----n8nFormBoundary${Date.now()}${i}`;
			const formDataParts: Buffer[] = [];
			const pushText = (text: string) => formDataParts.push(Buffer.from(text, 'utf8'));

			pushText(`--${boundary}\r\n`);
			pushText(`Content-Disposition: form-data; name="files"; filename="${fileName}"\r\n`);
			pushText(`Content-Type: ${mimeType}\r\n\r\n`);
			formDataParts.push(fileBuffer);
			pushText('\r\n');
			pushText(`--${boundary}--\r\n`);

			const response = await zohoCliqApiMultipartRequest.call(
				this,
				'POST',
				'/api/v2/events/attachments',
				Buffer.concat(formDataParts),
				`multipart/form-data; boundary=${boundary}`,
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushEventsRecoverableError(this, returnData, i, 'uploadAttachment', error, {
					contextFields: {
						...(sanitizedBinaryProperty ? { binary_property: sanitizedBinaryProperty } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('binary property is required') ||
								normalizedMessage.includes('binary property is too long') ||
								normalizedMessage.includes('binary property must be a binary property name'),
							reason: 'INVALID_BINARY_PROPERTY',
							hint: 'Provide the exact incoming binary property name, for example "data", or a direct binary object expression from a previous node.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('no binary data found for property') ||
								normalizedMessage.includes(
									'direct binary object input must include inline base64 file data',
								),
							reason: 'BINARY_DATA_NOT_FOUND',
							hint: 'Pass a file from a previous node and use the matching binary property name, such as "data", or pass a direct binary object that includes inline file data.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('payload too large') ||
								normalizedMessage.includes('request entity too large'),
							reason: 'PAYLOAD_TOO_LARGE',
							hint: 'Use a smaller file or compress the attachment before retrying the upload.',
						},
					],
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
