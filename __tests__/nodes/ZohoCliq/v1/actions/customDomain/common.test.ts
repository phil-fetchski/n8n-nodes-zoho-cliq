import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	isCustomDomainAiErrorModeEnabled,
	parseCustomDomainPayloadInput,
	pushCustomDomainRecoverableError,
	resolveCustomDomainEnhancedOutput,
	validateCustomDomainAddPayload,
	validateCustomDomainInputMode,
	validateCustomDomainStatus,
	validateCustomDomainVerifyPayload,
	validateDomainName,
} from '../../../../../../nodes/ZohoCliq/v1/actions/customDomain/common';

describe('ZohoCliq - CustomDomain - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	it('should trim and normalize a valid domain', () => {
		expect(validateDomainName(mockExecuteFunctions, '  APP.EXAMPLE.COM ', 0)).toBe(
			'app.example.com',
		);
	});

	it('should throw for invalid domain format', () => {
		expect(() => validateDomainName(mockExecuteFunctions, 'bad_domain', 0)).toThrow(
			'Invalid Custom Domain format',
		);
	});

	it('should throw when domain is missing', () => {
		expect(() => validateDomainName(mockExecuteFunctions, '   ', 0)).toThrow(
			'Custom Domain is required',
		);
	});

	it('should throw when domain input is undefined', () => {
		expect(() =>
			validateDomainName(mockExecuteFunctions, undefined as unknown as string, 0),
		).toThrow('Custom Domain is required');
	});

	it('should reject labels that start or end with a hyphen', () => {
		expect(() => validateDomainName(mockExecuteFunctions, 'foo.-bar.com', 0)).toThrow(
			'Invalid Custom Domain format',
		);
		expect(() => validateDomainName(mockExecuteFunctions, 'foo.bar-.com', 0)).toThrow(
			'Invalid Custom Domain format',
		);
	});

	it('should accept valid rfc-style labels', () => {
		expect(validateDomainName(mockExecuteFunctions, 'example.com', 0)).toBe('example.com');
	});

	it('should parse object payload input', () => {
		expect(
			parseCustomDomainPayloadInput(
				mockExecuteFunctions,
				{ name: 'chat.example.com' },
				0,
				'Payload',
			),
		).toEqual({
			name: 'chat.example.com',
		});
	});

	it('should parse stringified JSON payload input', () => {
		expect(
			parseCustomDomainPayloadInput(mockExecuteFunctions, '{"status":"active"}', 0, 'Payload'),
		).toEqual({ status: 'active' });
	});

	it('should reject invalid stringified JSON payload input', () => {
		expect(() =>
			parseCustomDomainPayloadInput(mockExecuteFunctions, '{"status"', 0, 'Payload'),
		).toThrow('Payload must be a valid JSON object when provided as text');
	});

	it('should reject non-object payloads from stringified JSON', () => {
		expect(() => parseCustomDomainPayloadInput(mockExecuteFunctions, '[]', 0, 'Payload')).toThrow(
			'Payload must be a JSON object',
		);
	});

	it('should validate add payload and map domain field', () => {
		expect(
			validateCustomDomainAddPayload(mockExecuteFunctions, { domain: 'portal.example.com' }, 0),
		).toEqual({
			name: 'portal.example.com',
		});
	});

	it('should validate add payload and map customdomain_domain alias', () => {
		expect(
			validateCustomDomainAddPayload(
				mockExecuteFunctions,
				{ customdomain_domain: 'alias.example.com' },
				0,
			),
		).toEqual({
			name: 'alias.example.com',
		});
	});

	it('should reject prototype pollution keys', () => {
		const unsafe = JSON.parse('{"__proto__":"bad"}') as Record<string, string>;
		expect(() =>
			parseCustomDomainPayloadInput(mockExecuteFunctions, unsafe, 0, 'Custom Domain Payload'),
		).toThrow('Unsafe key "__proto__" is not allowed');
	});

	it('should reject nested prototype pollution keys', () => {
		const unsafe = { wrapper: { constructor: 'bad' } };
		expect(() =>
			parseCustomDomainPayloadInput(mockExecuteFunctions, unsafe, 0, 'Custom Domain Payload'),
		).toThrow('Unsafe key "constructor" is not allowed');
	});

	it('should reject prototype pollution keys nested inside arrays', () => {
		const unsafe = {
			slides: [{ safe: true }, { prototype: 'bad' }],
		};
		expect(() =>
			parseCustomDomainPayloadInput(mockExecuteFunctions, unsafe, 0, 'Custom Domain Payload'),
		).toThrow('Unsafe key "prototype" is not allowed');
	});

	it('should allow safe nested object payloads', () => {
		expect(
			parseCustomDomainPayloadInput(
				mockExecuteFunctions,
				{ nested: { key: 'value' } },
				0,
				'Custom Domain Payload',
			),
		).toEqual({ nested: { key: 'value' } });
	});

	it('should preserve non-object entries in flat arrays', () => {
		expect(
			parseCustomDomainPayloadInput(
				mockExecuteFunctions,
				{ attachments: [null, 1, 'two'] },
				0,
				'Custom Domain Payload',
			),
		).toEqual({ attachments: [null, 1, 'two'] });
	});

	it('should reject unsupported fields in add payload', () => {
		expect(() =>
			validateCustomDomainAddPayload(
				mockExecuteFunctions,
				{ name: 'chat.example.com', foo: 'bar' },
				0,
			),
		).toThrow('contains unsupported field "foo"');
	});

	it('should reject non-object payload input', () => {
		expect(() =>
			parseCustomDomainPayloadInput(
				mockExecuteFunctions,
				'bad' as unknown as Record<string, string>,
				0,
				'Custom Domain Payload',
			),
		).toThrow('Custom Domain Payload must be a valid JSON object when provided as text');
	});

	it('should use name when multiple domain aliases are provided', () => {
		expect(
			validateCustomDomainAddPayload(
				mockExecuteFunctions,
				{
					name: 'chosen.example.com',
					domain: 'ignored.example.com',
					customdomain_domain: 'ignored-too.example.com',
				},
				0,
			),
		).toEqual({ name: 'chosen.example.com' });
	});

	it('should throw when add payload has no domain value', () => {
		expect(() => validateCustomDomainAddPayload(mockExecuteFunctions, {}, 0)).toThrow(
			'Custom Domain is required',
		);
	});

	it('should reject empty payload input when null is provided', () => {
		expect(() => parseCustomDomainPayloadInput(mockExecuteFunctions, null, 0, 'Payload')).toThrow(
			'Payload cannot be empty',
		);
	});

	it('should reject empty payload input when undefined is provided', () => {
		expect(() =>
			parseCustomDomainPayloadInput(mockExecuteFunctions, undefined, 0, 'Payload'),
		).toThrow('Payload cannot be empty');
	});

	it('should reject empty payload input when empty string is provided', () => {
		expect(() => parseCustomDomainPayloadInput(mockExecuteFunctions, '', 0, 'Payload')).toThrow(
			'Payload cannot be empty',
		);
	});

	it('should validate custom domain status case-insensitively', () => {
		expect(validateCustomDomainStatus(mockExecuteFunctions, 'ACTIVE', 0)).toBe('active');
		expect(validateCustomDomainStatus(mockExecuteFunctions, 'inactive', 0)).toBe('inactive');
	});

	it('should reject invalid custom domain status', () => {
		expect(() => validateCustomDomainStatus(mockExecuteFunctions, 'pending', 0)).toThrow(
			'Status must be either "active" or "inactive"',
		);
	});

	it('should reject non-string custom domain status', () => {
		expect(() => validateCustomDomainStatus(mockExecuteFunctions, 42, 0)).toThrow(
			'Status must be either "active" or "inactive"',
		);
	});

	it('should validate input mode values', () => {
		expect(validateCustomDomainInputMode(mockExecuteFunctions, 'structured', 0)).toBe('structured');
		expect(validateCustomDomainInputMode(mockExecuteFunctions, 'raw', 0)).toBe('raw');
	});

	it('should reject invalid input mode values', () => {
		expect(() => validateCustomDomainInputMode(mockExecuteFunctions, 'legacy', 0)).toThrow(
			'Input Mode must be either "structured" or "raw"',
		);
	});

	it('should validate verify payload and normalize status', () => {
		expect(
			validateCustomDomainVerifyPayload(mockExecuteFunctions, { status: 'ACTIVE' }, 0),
		).toEqual({
			status: 'active',
		});
	});

	it('should reject verify payload with unsupported fields', () => {
		expect(() =>
			validateCustomDomainVerifyPayload(
				mockExecuteFunctions,
				{ status: 'active', name: 'chat.example.com' },
				0,
			),
		).toThrow('contains unsupported field "name"');
	});

	it('should reject verify payload when status is missing', () => {
		expect(() => validateCustomDomainVerifyPayload(mockExecuteFunctions, {}, 0)).toThrow(
			'Status must be either "active" or "inactive"',
		);
	});

	it('should reject null add payload as non-object input', () => {
		expect(() =>
			validateCustomDomainAddPayload(mockExecuteFunctions, null as unknown as IDataObject, 0),
		).toThrow('Custom Domain Payload must be a JSON object');
	});

	it('should reject null verify payload as non-object input', () => {
		expect(() =>
			validateCustomDomainVerifyPayload(mockExecuteFunctions, null as unknown as IDataObject, 0),
		).toThrow('Custom Domain Payload must be a JSON object');
	});

	it('should detect AI Error Mode from node parameters', () => {
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			})),
		} as unknown as IExecuteFunctions;

		expect(isCustomDomainAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
	});

	it('should return false when reading AI Error Mode throws and getNode is unavailable', () => {
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			getNodeParameter: jest.fn(() => {
				throw new Error('Parameter lookup failed');
			}),
			getNode: undefined as unknown as IExecuteFunctions['getNode'],
		} as unknown as IExecuteFunctions;

		expect(isCustomDomainAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when reading AI Error Mode falls back to a throwing getNode call', () => {
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			getNodeParameter: jest.fn(() => {
				throw new Error('Parameter lookup failed');
			}),
			getNode: jest.fn(() => {
				throw new Error('Node lookup failed');
			}),
		} as unknown as IExecuteFunctions;

		expect(isCustomDomainAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when node parameters are missing during AI Error Mode fallback', () => {
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			getNodeParameter: jest.fn(
				(_name: string, _itemIndex?: number, fallback?: unknown) => fallback,
			),
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
			})),
		} as unknown as IExecuteFunctions;

		expect(isCustomDomainAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode returns undefined during AI Error Mode fallback', () => {
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			getNodeParameter: jest.fn(
				(_name: string, _itemIndex?: number, fallback?: unknown) => fallback,
			),
			getNode: jest.fn(() => undefined),
		} as unknown as IExecuteFunctions;

		expect(isCustomDomainAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should prefer continueOnFail recoverable payloads for scope errors', () => {
		const returnData: INodeExecutionData[] = [];
		const error = {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'customDomain',
				operation: 'get',
			},
		};
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			continueOnFail: jest.fn(() => true),
		} as unknown as IExecuteFunctions;

		const handled = pushCustomDomainRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'get',
			error,
		);

		expect(handled).toBe(true);
		expect(returnData[0]?.json).toEqual({
			success: false,
			resource: 'customDomain',
			operation: 'get',
		});
	});

	it('should build recoverable API payloads when AI Error Mode is enabled', () => {
		const returnData: INodeExecutionData[] = [];
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'enableAiErrorMode') return 'true';
				return fallback;
			}),
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			})),
		} as unknown as IExecuteFunctions;

		const handled = pushCustomDomainRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'delete',
			{ statusCode: 429, message: 'Too many requests' },
			{
				contextFields: { target: 'current_custom_domain' },
			},
		);

		expect(handled).toBe(true);
		expect(returnData[0]?.json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'delete',
				target: 'current_custom_domain',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
	});

	it('should ignore malformed scope payload values and fall back to the generic recoverable error payload', () => {
		const returnData: INodeExecutionData[] = [];
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			continueOnFail: jest.fn(() => true),
		} as unknown as IExecuteFunctions;

		const handled = pushCustomDomainRecoverableError(mockExecuteFunctions, returnData, 0, 'get', {
			message: 'Fallback please',
			zohoCliqScopeErrorPayload: ['not', 'an', 'object'],
		});

		expect(handled).toBe(true);
		expect(returnData[0]?.json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'get',
				message: 'Fallback please',
			}),
		);
	});

	it('should fall back to the generic recoverable error payload when the error is undefined', () => {
		const returnData: INodeExecutionData[] = [];
		mockExecuteFunctions = {
			...mockExecuteFunctions,
			continueOnFail: jest.fn(() => true),
		} as unknown as IExecuteFunctions;

		const handled = pushCustomDomainRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'verify',
			undefined,
		);

		expect(handled).toBe(true);
		expect(returnData[0]?.json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'verify',
				message: 'An unexpected issue occurred with the API request',
			}),
		);
	});

	it('should not push a recoverable payload when neither continueOnFail nor AI Error Mode is enabled', () => {
		const returnData: INodeExecutionData[] = [];

		const handled = pushCustomDomainRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'get',
			new Error('Not handled'),
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should resolve enhanced output with a default enabled toggle', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'includeEnhancedOutput') {
					return fallback;
				}
				return fallback;
			},
		);

		expect(resolveCustomDomainEnhancedOutput(mockExecuteFunctions, 0, '')).toEqual({
			includeEnhancedOutput: true,
			rawResponse: { data: '' },
			responseJson: { data: '' },
		});
	});
});
