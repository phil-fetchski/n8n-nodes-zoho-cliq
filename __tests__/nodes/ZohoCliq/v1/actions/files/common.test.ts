import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	isFilesAiErrorModeEnabled,
	pushFilesRecoverableError,
	resolveFilesEnhancedOutput,
} from '../../../../../../nodes/ZohoCliq/v1/actions/files/common';

describe('ZohoCliq - Files - common helpers', () => {
	const createContext = (
		options: {
			continueOnFail?: boolean;
			enableAiErrorMode?: unknown;
			throwOnGetNodeParameter?: boolean;
			getNodeParameters?: unknown;
		} = {},
	): IExecuteFunctions => {
		const {
			continueOnFail = false,
			enableAiErrorMode = false,
			throwOnGetNodeParameter = false,
			getNodeParameters = { enableAiErrorMode },
		} = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (throwOnGetNodeParameter) {
					throw new Error('parameter lookup failed');
				}
				if (name === 'enableAiErrorMode') {
					return enableAiErrorMode;
				}
				if (name === 'includeEnhancedOutput') {
					return true;
				}
				return fallback;
			}),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: getNodeParameters,
			})),
		} as unknown as IExecuteFunctions;
	};

	it('should detect AI Error Mode from the node parameter', () => {
		expect(isFilesAiErrorModeEnabled(createContext({ enableAiErrorMode: 'true' }), 0)).toBe(true);
	});

	it('should fall back to getNode().parameters when getNodeParameter is unavailable', () => {
		expect(
			isFilesAiErrorModeEnabled(
				createContext({
					enableAiErrorMode: false,
					throwOnGetNodeParameter: true,
					getNodeParameters: { enableAiErrorMode: 'true' },
				}),
				0,
			),
		).toBe(true);
	});

	it('should return false when AI Error Mode lookup fails and node parameters are unusable', () => {
		expect(
			isFilesAiErrorModeEnabled(
				createContext({
					enableAiErrorMode: false,
					throwOnGetNodeParameter: true,
					getNodeParameters: undefined,
				}),
				0,
			),
		).toBe(false);
	});

	it('should return false when getNode is not a function during AI Error Mode fallback', () => {
		const context = {
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: undefined,
		} as unknown as IExecuteFunctions;

		expect(isFilesAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when getNode parameters are array-shaped during fallback', () => {
		expect(
			isFilesAiErrorModeEnabled(
				createContext({
					enableAiErrorMode: false,
					throwOnGetNodeParameter: true,
					getNodeParameters: [],
				}),
				0,
			),
		).toBe(false);
	});

	it('should return false when getNode returns undefined during AI Error Mode fallback', () => {
		const context = {
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => undefined),
		} as unknown as IExecuteFunctions;

		expect(isFilesAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when getNode throws during AI Error Mode fallback', () => {
		const context = {
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup failed');
			}),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => {
				throw new Error('node lookup failed');
			}),
		} as unknown as IExecuteFunctions;

		expect(isFilesAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when neither continueOnFail nor AI Error Mode is enabled', () => {
		const context = createContext();
		const returnData: INodeExecutionData[] = [];

		expect(pushFilesRecoverableError(context, returnData, 0, 'shareFile', new Error('boom'))).toBe(
			false,
		);
		expect(returnData).toEqual([]);
	});

	it('should merge scope payload context when AI Error Mode is enabled', () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		const returnData: INodeExecutionData[] = [];

		expect(
			pushFilesRecoverableError(
				context,
				returnData,
				0,
				'getFile',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						resource: 'files',
						operation: 'getFile',
					},
				},
				{
					contextFields: {
						file_id: 'FILE_123',
						binary_property: 'data',
					},
				},
			),
		).toBe(true);
		expect(returnData[0].json).toEqual({
			success: false,
			resource: 'files',
			operation: 'getFile',
			file_id: 'FILE_123',
			binary_property: 'data',
		});
	});

	it('should preserve a scope payload without extra context fields', () => {
		const context = createContext({ continueOnFail: true });
		const returnData: INodeExecutionData[] = [];

		expect(
			pushFilesRecoverableError(context, returnData, 0, 'getFile', {
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'files',
					operation: 'getFile',
				},
			}),
		).toBe(true);
		expect(returnData[0].json).toEqual({
			success: false,
			resource: 'files',
			operation: 'getFile',
		});
	});

	it('should build a recoverable API payload when continueOnFail is enabled', () => {
		const context = createContext({ continueOnFail: true });
		const returnData: INodeExecutionData[] = [];

		expect(
			pushFilesRecoverableError(
				context,
				returnData,
				0,
				'shareFile',
				{ statusCode: 404, message: 'File target not found' },
				{
					contextFields: {
						share_target: 'chat',
						target_identifier: 'CT_12345',
					},
				},
			),
		).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'files',
				operation: 'shareFile',
				status_code: 404,
				reason: 'NOT_FOUND',
				share_target: 'chat',
				target_identifier: 'CT_12345',
			}),
		);
	});

	it('should resolve enhanced output and coerce primitive API responses', () => {
		const context = createContext();

		expect(resolveFilesEnhancedOutput(context, 0, '')).toEqual({
			includeEnhancedOutput: true,
			rawResponse: { data: '' },
			responseJson: { data: '' },
		});
	});

	it('should parse string false for includeEnhancedOutput correctly', () => {
		const context = {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'includeEnhancedOutput') {
					return 'false';
				}
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		expect(resolveFilesEnhancedOutput(context, 0, '')).toEqual({
			includeEnhancedOutput: false,
			rawResponse: { data: '' },
			responseJson: { data: '' },
		});
	});
});
