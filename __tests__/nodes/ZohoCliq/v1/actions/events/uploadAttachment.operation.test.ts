import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

import * as uploadAttachment from '../../../../../../nodes/ZohoCliq/v1/actions/events/uploadAttachment.operation';
import { getRequiredScopesForOperationOrThrow } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Events - Upload Attachment Operation', () => {
	const baseItems: INodeExecutionData[] = [
		{
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello').toString('base64'),
					fileName: 'test.txt',
					mimeType: 'text/plain',
				},
			},
		},
	];
	const mockZohoCliqApiMultipartRequest =
		transport.zohoCliqApiMultipartRequest as jest.MockedFunction<
			typeof transport.zohoCliqApiMultipartRequest
		>;

	const createContext = (
		values: {
			binaryProperty?: string;
			getBinaryDataBuffer?: ((itemIndex: number, propertyName: string) => Promise<Buffer>) | null;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { binaryProperty = 'data', getBinaryDataBuffer = async () => Buffer.from('hello') } =
			values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'binaryProperty') return binaryProperty;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers:
				getBinaryDataBuffer === null
					? {
							constructExecutionMetaData: jest.fn((data) => data),
						}
					: {
							constructExecutionMetaData: jest.fn((data) => data),
							getBinaryDataBuffer: jest.fn(getBinaryDataBuffer),
						},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiMultipartRequest.mockReset();
	});

	it('should upload event attachment from binary property', async () => {
		const context = createContext();
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ attachments: [] });

		await uploadAttachment.execute.call(context, baseItems, SCOPES.EVENTS_UPLOAD_ATTACHMENT);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/events/attachments',
			expect.any(Buffer),
			expect.stringContaining('multipart/form-data; boundary='),
		);
	});

	it('should use getBinaryDataBuffer when available', async () => {
		const getBinaryDataBuffer = jest.fn(async () => Buffer.from('from-helper'));
		const context = createContext({ getBinaryDataBuffer });
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ attachments: [] });

		await uploadAttachment.execute.call(context, baseItems, SCOPES.EVENTS_UPLOAD_ATTACHMENT);

		expect(getBinaryDataBuffer).toHaveBeenCalledWith(0, 'data');
		const multipartBuffer = mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer;
		expect(multipartBuffer.toString('utf8')).toContain('from-helper');
	});

	it('should upload using a direct binary object expression value', async () => {
		const context = createContext({
			binaryProperty: {
				data: Buffer.from('direct-object').toString('base64'),
				fileName: 'direct.txt',
				mimeType: 'text/plain',
			} as unknown as string,
		});
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ attachments: [] });

		await uploadAttachment.execute.call(context, baseItems, SCOPES.EVENTS_UPLOAD_ATTACHMENT);

		const multipartBuffer = mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer;
		const multipartText = multipartBuffer.toString('utf8');
		expect(multipartText).toContain('direct-object');
		expect(multipartText).toContain('filename="direct.txt"');
	});

	it('should upload using a wrapped binary-map expression value', async () => {
		const context = createContext({
			binaryProperty: {
				data: {
					data: Buffer.from('wrapped-object').toString('base64'),
					fileName: 'wrapped.txt',
					mimeType: 'text/plain',
				},
			} as unknown as string,
			getBinaryDataBuffer: null,
		});
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ attachments: [] });

		await uploadAttachment.execute.call(context, baseItems, SCOPES.EVENTS_UPLOAD_ATTACHMENT);

		const multipartBuffer = mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer;
		const multipartText = multipartBuffer.toString('utf8');
		expect(multipartText).toContain('wrapped-object');
		expect(multipartText).toContain('filename="wrapped.txt"');
	});

	it('should sanitize filename and use default MIME type', async () => {
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: {
					data: {
						data: Buffer.from('hello').toString('base64'),
						fileName: 'test"\\\nname.txt',
						mimeType: '',
					},
				},
			},
		];
		const context = createContext();
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ attachments: [] });

		await uploadAttachment.execute.call(context, items, SCOPES.EVENTS_UPLOAD_ATTACHMENT);

		const multipartBuffer = mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer;
		const multipartText = multipartBuffer.toString('utf8');
		expect(multipartText).toContain('filename="test\\"\\\\_name.txt"');
		expect(multipartText).toContain('Content-Type: application/octet-stream');
	});

	it('should fall back to inline base64 data when getBinaryDataBuffer is unavailable', async () => {
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: {
					data: {
						data: Buffer.from('fallback-data').toString('base64'),
						mimeType: undefined as unknown as string,
					},
				},
			},
		];
		const context = createContext({ getBinaryDataBuffer: null });
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ attachments: [] });

		await uploadAttachment.execute.call(context, items, SCOPES.EVENTS_UPLOAD_ATTACHMENT);

		const multipartBuffer = mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer;
		const multipartText = multipartBuffer.toString('utf8');
		expect(multipartText).toContain('fallback-data');
		expect(multipartText).toContain('filename="data"');
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const firstMissingScope = getRequiredScopesForOperationOrThrow(
			'events',
			'uploadAttachment',
		).find((scope) => !SCOPES.EVENTS_GET_CALENDARS.split(',').includes(scope));

		let thrownError: unknown;
		try {
			await uploadAttachment.execute.call(context, baseItems, SCOPES.EVENTS_GET_CALENDARS);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [firstMissingScope],
				missingScopes: [firstMissingScope],
			}),
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ binaryProperty: 'missing' }, { continueOnFail: true });

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				binary_property: 'missing',
				reason: 'BINARY_DATA_NOT_FOUND',
			}),
		);
	});

	it('should return a recoverable validation error when binary property is blank', async () => {
		const context = createContext({ binaryProperty: '   ' }, { continueOnFail: true });

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				reason: 'INVALID_BINARY_PROPERTY',
			}),
		);
	});

	it('should return a recoverable validation error when binary property is null', async () => {
		const context = createContext(
			{ binaryProperty: null as unknown as string },
			{ continueOnFail: true },
		);

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				reason: 'INVALID_BINARY_PROPERTY',
			}),
		);
	});

	it('should return a recoverable validation error when binary property is too long', async () => {
		const context = createContext({ binaryProperty: 'a'.repeat(256) }, { continueOnFail: true });

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				reason: 'INVALID_BINARY_PROPERTY',
			}),
		);
	});

	it('should return a recoverable validation error when binary property is an unsupported type', async () => {
		const context = createContext(
			{ binaryProperty: true as unknown as string },
			{ continueOnFail: true },
		);

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				reason: 'INVALID_BINARY_PROPERTY',
			}),
		);
	});

	it('should return a recoverable validation error when the item has no binary data object', async () => {
		const context = createContext({}, { continueOnFail: true });

		const result = await uploadAttachment.execute.call(
			context,
			[{ json: {} }],
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				binary_property: 'data',
				reason: 'BINARY_DATA_NOT_FOUND',
			}),
		);
	});

	it('should return a recoverable validation error when a direct binary object lacks inline data', async () => {
		const context = createContext(
			{
				binaryProperty: {
					id: 'binary-id-only',
					fileName: 'stored.txt',
					mimeType: 'text/plain',
				} as unknown as string,
			},
			{ continueOnFail: true },
		);

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				reason: 'BINARY_DATA_NOT_FOUND',
			}),
		);
	});

	it('should return a recoverable validation error when a wrapped binary object lacks inline data', async () => {
		const context = createContext(
			{
				binaryProperty: {
					data: {
						id: 'binary-id-only',
						fileName: 'stored.txt',
						mimeType: 'text/plain',
					},
				} as unknown as string,
			},
			{ continueOnFail: true },
		);

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				reason: 'BINARY_DATA_NOT_FOUND',
			}),
		);
	});

	it('should default the filename when a direct binary object omits fileName', async () => {
		const context = createContext({
			binaryProperty: {
				data: Buffer.from('no-filename').toString('base64'),
				mimeType: 'text/plain',
			} as unknown as string,
		});
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ attachments: [] });

		await uploadAttachment.execute.call(context, baseItems, SCOPES.EVENTS_UPLOAD_ATTACHMENT);

		const multipartBuffer = mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer;
		expect(multipartBuffer.toString('utf8')).toContain('filename="attachment"');
	});

	it('should reject inherited binary properties during validation', async () => {
		const inheritedBinary = Object.create({
			data: {
				data: Buffer.from('hello').toString('base64'),
				fileName: 'test.txt',
				mimeType: 'text/plain',
			},
		}) as NonNullable<INodeExecutionData['binary']>;
		const context = createContext({}, { continueOnFail: true });

		const result = await uploadAttachment.execute.call(
			context,
			[{ json: {}, binary: inheritedBinary }],
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				binary_property: 'data',
				reason: 'BINARY_DATA_NOT_FOUND',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiMultipartRequest.mockRejectedValue({
			statusCode: 413,
			message: 'Payload Too Large',
		});

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				binary_property: 'data',
				status_code: 413,
				reason: 'PAYLOAD_TOO_LARGE',
			}),
		);
	});

	it('should map alternate large-payload wording to PAYLOAD_TOO_LARGE', async () => {
		const context = createContext({}, { continueOnFail: true });
		mockZohoCliqApiMultipartRequest.mockRejectedValue({
			statusCode: 413,
			message: 'Request entity too large',
		});

		const result = await uploadAttachment.execute.call(
			context,
			baseItems,
			SCOPES.EVENTS_UPLOAD_ATTACHMENT,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'events',
				operation: 'uploadAttachment',
				reason: 'PAYLOAD_TOO_LARGE',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(uploadAttachment.description[uploadAttachment.description.length - 2]?.name).toBe(
			'uploadEventAttachmentDocsNotice',
		);
		expect(uploadAttachment.description[uploadAttachment.description.length - 1]?.name).toBe(
			'uploadEventAttachmentAiToolGuideNotice',
		);
	});
});
