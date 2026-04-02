import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';

import * as getFile from '../../../../../../nodes/ZohoCliq/v1/actions/files/getFile.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Files - Get File Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	let mockPrepareBinaryData: jest.Mock;
	const mockZohoCliqApiBinaryRequest = transport.zohoCliqApiBinaryRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiBinaryRequest
	>;

	beforeEach(() => {
		mockPrepareBinaryData = jest.fn(
			async (binaryData: Buffer, fileName?: string, mimeType?: string) => ({
				data: 'filesystem-v2',
				fileName,
				mimeType: mimeType ?? 'application/octet-stream',
				fileSize: String(binaryData.length),
				id: 'opaque-binary-handle',
			}),
		);

		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn().mockReturnValue(false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
				prepareBinaryData: mockPrepareBinaryData,
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: false },
			})),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiBinaryRequest.mockClear();
	});

	it('should get file by file ID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('%PDF-1.7', 'utf8'),
			headers: {
				'content-type': 'application/pdf',
				'content-disposition': 'attachment; filename="invoice.pdf"',
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiBinaryRequest).toHaveBeenCalledWith('GET', '/api/v2/files/FILE_12345');
		expect(mockPrepareBinaryData).toHaveBeenCalledWith(
			Buffer.from('%PDF-1.7', 'utf8'),
			'invoice.pdf',
			'application/pdf',
		);
		expect(result).toHaveLength(1);
		expect(result[0].binary?.data.fileName).toBe('invoice.pdf');
		expect(result[0].binary?.data.mimeType).toBe('application/pdf');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				fileId: 'FILE_12345',
				fileName: 'invoice.pdf',
				binaryProperty: 'data',
				binary_handle_id: 'opaque-binary-handle',
			}),
		);
	});

	it('should throw for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'files';
			if (paramName === 'operation') return 'getFile';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await getFile.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'files',
			operation: 'getFile',
			requiredScopes: [SCOPES.ATTACHMENTS_READ],
			missingScopes: [SCOPES.ATTACHMENTS_READ],
			hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
		});
	});

	it('should return structured scope payload when continueOnFail is enabled and scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'files';
			if (paramName === 'operation') return 'getFile';
			return undefined;
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: false,
			resource: 'files',
			operation: 'getFile',
			requiredScopes: [SCOPES.ATTACHMENTS_READ],
			missingScopes: [SCOPES.ATTACHMENTS_READ],
			hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
		});
		expect(mockZohoCliqApiBinaryRequest).not.toHaveBeenCalled();
	});

	it('should throw for invalid file ID format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE/123')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');

		await expect(getFile.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Invalid File ID format',
		);
	});

	it('should return paired error item when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockRejectedValue(new Error('API unavailable'));

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'API unavailable',
				resource: 'files',
				operation: 'getFile',
				file_id: 'FILE_12345',
				binary_property: 'data',
			}),
		);
	});

	it('should replace a generic 400 API message with actionable file guidance in continueOnFail mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_400_GENERIC')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message:
					'Failed to retrieve file (HTTP 400). The fileId is the most likely cause. Verify this exact fileId exists and is accessible: FILE_400_GENERIC',
				resource: 'files',
				operation: 'getFile',
				status_code: 400,
				reason: 'INVALID_FILE_ID_OR_ACCESS',
				hint: 'The fileId is the most likely cause. Verify this exact file ID exists and is accessible to the authenticated user.',
				file_id: 'FILE_400_GENERIC',
				binary_property: 'data',
			}),
		);
	});

	it('should replace any 400 API message with the custom fileId guidance for this operation', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_400_DETAIL')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Bad Request',
			response: {
				body: {
					message: 'No file found for the provided ID',
				},
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message:
					'Failed to retrieve file (HTTP 400). The fileId is the most likely cause. Verify this exact fileId exists and is accessible: FILE_400_DETAIL',
				resource: 'files',
				operation: 'getFile',
				status_code: 400,
				reason: 'INVALID_FILE_ID_OR_ACCESS',
				hint: 'The fileId is the most likely cause. Verify this exact file ID exists and is accessible to the authenticated user.',
				file_id: 'FILE_400_DETAIL',
				binary_property: 'data',
			}),
		);
	});

	it('should return structured scope payload from API error in continueOnFail mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockRejectedValue({
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'files',
				operation: 'getFile',
				requiredScopes: [SCOPES.ATTACHMENTS_READ],
				missingScopes: [SCOPES.ATTACHMENTS_READ],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: false,
			resource: 'files',
			operation: 'getFile',
			requiredScopes: [SCOPES.ATTACHMENTS_READ],
			missingScopes: [SCOPES.ATTACHMENTS_READ],
			hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			file_id: 'FILE_12345',
			binary_property: 'data',
		});
	});

	it('should stringify non-Error API failures in continueOnFail payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockRejectedValue('binary request failed');

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'binary request failed',
				resource: 'files',
				operation: 'getFile',
			}),
		);
	});

	it('should stringify undefined API failures in continueOnFail payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockRejectedValue(undefined);

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Failed to retrieve file from Zoho Cliq.',
				resource: 'files',
				operation: 'getFile',
			}),
		);
	});

	it('should return a recoverable API payload in AI Error Mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: 'true' },
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'fileId') return 'FILE_98765';
				if (name === 'binaryProperty') return 'data';
				if (name === 'fileName') return '';
				if (name === 'enableAiErrorMode') return 'true';
				return fallback;
			},
		);
		mockZohoCliqApiBinaryRequest.mockRejectedValue({ statusCode: 404, message: 'File not found' });

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'files',
				operation: 'getFile',
				status_code: 404,
				reason: 'NOT_FOUND',
				file_id: 'FILE_98765',
				binary_property: 'data',
			}),
		);
	});

	it('should include requested_file_name in recoverable payloads when a custom file name was provided', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_45678')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('custom-name.pdf');
		mockZohoCliqApiBinaryRequest.mockRejectedValue(new Error('API unavailable'));

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				requested_file_name: 'custom-name.pdf',
			}),
		);
	});

	it('should omit binary_handle_id when prepareBinaryData does not return an id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		mockPrepareBinaryData.mockResolvedValueOnce({
			data: 'filesystem-v2',
			fileName: 'invoice.pdf',
			mimeType: 'application/pdf',
			fileSize: '8',
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('%PDF-1.7', 'utf8'),
			headers: {
				'content-type': 'application/pdf',
				'content-disposition': 'attachment; filename="invoice.pdf"',
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				fileId: 'FILE_12345',
				fileName: 'invoice.pdf',
				binaryProperty: 'data',
			}),
		);
		expect(result[0].json).not.toHaveProperty('binary_handle_id');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(getFile.description[getFile.description.length - 2]?.name).toBe('getFileDocsNotice');
		expect(getFile.description[getFile.description.length - 1]?.name).toBe(
			'getFileAiToolGuideNotice',
		);
	});

	it('should rethrow API failures when continueOnFail is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockRejectedValue(new Error('API unavailable'));

		await expect(getFile.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'API unavailable',
		);
	});

	it('should support custom binary property and fallback file name', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_999')
			.mockReturnValueOnce('attachment')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from([1, 2, 3]),
			headers: {
				'content-type': 'application/pdf',
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].binary?.attachment).toBeDefined();
		expect(result[0].binary?.attachment.fileName).toBe('FILE_999.pdf');
		expect(result[0].json.binaryProperty).toBe('attachment');
	});

	it('should parse content-disposition filename from array header values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_321')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('hello', 'utf8'),
			headers: {
				'content-type': 'application/pdf',
				'content-disposition': ['attachment; filename="array-name.pdf"'],
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.fileName).toBe('array-name.pdf');
	});

	it('should parse RFC5987 UTF-8 filename* from content-disposition', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_654')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('hello', 'utf8'),
			headers: {
				'content-type': 'application/pdf',
				'content-disposition': "attachment; filename*=UTF-8''report%20v2.pdf",
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.fileName).toBe('report v2.pdf');
	});

	it('should gracefully handle malformed filename encoding and keep fallback text', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_777')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('hello', 'utf8'),
			headers: {
				'content-type': 'application/pdf',
				'content-disposition': "attachment; filename*=UTF-8''bad%ZZname.pdf",
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.fileName).toBe('bad%ZZname.pdf');
	});

	it('should fallback to file ID when content-disposition has no filename token', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_111')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('hello', 'utf8'),
			headers: {
				'content-type': true,
				'content-disposition': 'attachment',
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.fileName).toBe('FILE_111');
		expect(result[0].binary?.data.mimeType).toBe('true');
	});

	it('should throw when binary property is empty after trim', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('   ')
			.mockReturnValueOnce('');

		await expect(getFile.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Binary Property cannot be empty',
		);
	});

	it('should throw when binary property basename matches blocked key', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('__proto__')
			.mockReturnValueOnce('');

		await expect(getFile.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Binary Property contains an unsafe value',
		);
	});

	it('should evaluate blocked keys using basename for path-like binary properties', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_10101')
			.mockReturnValueOnce('folder/__proto__')
			.mockReturnValueOnce('');

		await expect(getFile.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Binary Property contains an unsafe value',
		);
	});

	it('should allow names that merely contain blocked-key words', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_24680')
			.mockReturnValueOnce('constructor-not-blocked')
			.mockReturnValueOnce('report-constructor.pdf');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('raw', 'utf8'),
			headers: {
				'content-type': 'application/pdf',
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.['constructor-not-blocked']).toBeDefined();
		expect(result[0].binary?.['constructor-not-blocked'].fileName).toBe('report-constructor.pdf');
	});

	it('should throw when file name contains a newline', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('bad\nname.pdf');

		await expect(getFile.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'File Name cannot contain newlines',
		);
	});

	it('should throw when file name exceeds max length', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_12345')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce(`${'a'.repeat(256)}.pdf`);

		await expect(getFile.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'File Name is too long (max 255 characters)',
		);
	});

	it('should read content-type from array header values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_555')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('png', 'utf8'),
			headers: {
				'content-type': ['image/png; charset=utf-8'],
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.mimeType).toBe('image/png');
		expect(result[0].binary?.data.fileName).toBe('FILE_555.png');
	});

	it('should use octet-stream default when content-type header is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_NO_MIME')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('raw', 'utf8'),
			headers: {},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.mimeType).toBe('application/octet-stream');
		expect(result[0].binary?.data.fileName).toBe('FILE_NO_MIME');
	});

	it('should ignore non-string values in array header and fallback safely', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_ARRAY_FALLBACK')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('raw', 'utf8'),
			headers: {
				'content-type': [100, false],
				'content-disposition': ['   attachment; filename="trimmed.pdf"   '],
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.mimeType).toBe('application/octet-stream');
		expect(result[0].binary?.data.fileName).toBe('trimmed.pdf');
	});

	it('should convert numeric content-type header values to strings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ATTACHMENTS_READ;
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('FILE_NUM_MIME')
			.mockReturnValueOnce('data')
			.mockReturnValueOnce('');
		mockZohoCliqApiBinaryRequest.mockResolvedValue({
			data: Buffer.from('raw', 'utf8'),
			headers: {
				'content-type': 123,
			},
		});

		const result = await getFile.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].binary?.data.mimeType).toBe('123');
		expect(result[0].binary?.data.fileName).toBe('FILE_NUM_MIME');
	});

	it('should define unique notice parameter names in description', () => {
		const noticeNames = getFile.description
			.filter((parameter) => parameter.type === 'notice')
			.map((parameter) => parameter.name);
		expect(noticeNames).toContain('getFileDocsNotice');
		expect(noticeNames).toContain('getFileDocsNotice2');
		expect(new Set(noticeNames).size).toBe(noticeNames.length);
	});
});
