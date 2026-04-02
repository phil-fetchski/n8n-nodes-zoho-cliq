import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	ensureSafeObject,
	handleContinueOnFailError,
	parseDateTimeOrUnixMs,
	parseStatusPayloadInput,
	resolveUserStatusEnhancedOutput,
	USER_STATUS_INVALID_CODE_HINT,
	USER_STATUS_INVALID_CODE_REASON,
	USER_STATUS_INVALID_EXPIRY_HINT,
	USER_STATUS_INVALID_EXPIRY_REASON,
	USER_STATUS_INVALID_INPUT_MODE_HINT,
	USER_STATUS_INVALID_INPUT_MODE_REASON,
	USER_STATUS_INVALID_STATUS_ID_HINT,
	USER_STATUS_INVALID_STATUS_ID_REASON,
	validateTransientStatusPayload,
	validateStatusId,
	validateStatusPayload,
	validateUserStatusInputMode,
	validateUserId,
} from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/common';

describe('ZohoCliq - UserStatus - Common', () => {
	const mockExecuteFunctions = {
		getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
	} as unknown as IExecuteFunctions;

	const assertNodeOperationErrorMetadata = (
		fn: () => unknown,
		expectedCode: string,
		expectedDescription: string,
	): void => {
		try {
			fn();
			throw new Error('Expected function to throw');
		} catch (error) {
			expect(error).toBeInstanceOf(NodeOperationError);
			expect((error as NodeOperationError & { code?: string }).code).toBe(expectedCode);
			expect((error as NodeOperationError & { description?: string }).description).toBe(
				expectedDescription,
			);
		}
	};

	it('should validate status id', () => {
		expect(validateStatusId(mockExecuteFunctions, '  ST_123  ', 0)).toBe('ST_123');
	});

	it('should throw for invalid status id format', () => {
		expect(() => validateStatusId(mockExecuteFunctions, 'ST 123', 0)).toThrow(NodeOperationError);
		expect(() => validateStatusId(mockExecuteFunctions, 'ST 123', 0)).toThrow(
			'Invalid Status ID format',
		);
	});

	it('should throw when status id is empty', () => {
		expect(() => validateStatusId(mockExecuteFunctions, '   ', 0)).toThrow('Status ID is required');
	});

	it('should throw when status id is too long', () => {
		expect(() => validateStatusId(mockExecuteFunctions, 'a'.repeat(121), 0)).toThrow(
			'Status ID is too long',
		);
	});

	it('should validate user id', () => {
		expect(validateUserId(mockExecuteFunctions, '  user-123@example.com  ', 0)).toBe(
			'user-123@example.com',
		);
	});

	it('should throw for invalid user id format', () => {
		expect(() => validateUserId(mockExecuteFunctions, 'u/123', 0)).toThrow(NodeOperationError);
		expect(() => validateUserId(mockExecuteFunctions, 'u/123', 0)).toThrow(
			'Invalid User ID format',
		);
	});

	it('should throw when user id is empty', () => {
		expect(() => validateUserId(mockExecuteFunctions, '   ', 0)).toThrow('User ID is required');
	});

	it('should throw when user id is too long', () => {
		expect(() => validateUserId(mockExecuteFunctions, 'a'.repeat(151), 0)).toThrow(
			'User ID is too long',
		);
	});

	it('should block unsafe keys in payload', () => {
		expect(() =>
			ensureSafeObject(mockExecuteFunctions, { constructor: 'bad' }, 0, 'Status Definition'),
		).toThrow('Unsafe key');
	});

	it('should block unsafe keys in nested payload objects', () => {
		expect(() =>
			ensureSafeObject(
				mockExecuteFunctions,
				{ top: { nested: { prototype: 'bad' } } },
				0,
				'Status Definition',
			),
		).toThrow('Unsafe key');
	});

	it('should block unsafe keys inside object arrays', () => {
		expect(() =>
			ensureSafeObject(
				mockExecuteFunctions,
				{ slides: [{ ok: true }, { inner: { constructor: 'bad' } }] },
				0,
				'Status Definition',
			),
		).toThrow('Unsafe key');
	});

	it('should allow primitive values inside object arrays', () => {
		expect(() =>
			ensureSafeObject(
				mockExecuteFunctions,
				{ slides: [{ ok: true }, 'note', 42, null] as unknown[] },
				0,
				'Status Definition',
			),
		).not.toThrow();
	});

	it('should allow null and undefined safe-object values', () => {
		expect(() =>
			ensureSafeObject(mockExecuteFunctions, null, 0, 'Status Definition'),
		).not.toThrow();
		expect(() =>
			ensureSafeObject(mockExecuteFunctions, undefined, 0, 'Status Definition'),
		).not.toThrow();
	});

	it('should reject non-object safe-object values', () => {
		expect(() => ensureSafeObject(mockExecuteFunctions, 'bad', 0, 'Status Definition')).toThrow(
			'Status Definition must be a JSON object',
		);
		expect(() => ensureSafeObject(mockExecuteFunctions, 123, 0, 'Status Definition')).toThrow(
			'Status Definition must be a JSON object',
		);
	});

	it('should reject array safe-object values', () => {
		expect(() => ensureSafeObject(mockExecuteFunctions, [], 0, 'Status Definition')).toThrow(
			'Status Definition must be a JSON object',
		);
	});

	it('should validate and normalize status payload', () => {
		const payload = validateStatusPayload(
			mockExecuteFunctions,
			{ code: 'BUSY', message: '  Busy in meetings  ' },
			0,
			'Status Definition',
		);

		expect(payload).toEqual({ code: 'busy', message: 'Busy in meetings' });
	});

	it('should reject empty payload', () => {
		expect(() => validateStatusPayload(mockExecuteFunctions, {}, 0, 'Status Definition')).toThrow(
			'Status Definition cannot be empty',
		);
	});

	it('should reject empty message after trim', () => {
		expect(() =>
			validateStatusPayload(
				mockExecuteFunctions,
				{ code: 'busy', message: '   ' },
				0,
				'Status Definition',
			),
		).toThrow('Status Definition.message is required');
	});

	it('should reject missing code', () => {
		expect(() =>
			validateStatusPayload(mockExecuteFunctions, { message: 'Hello' }, 0, 'Status Definition'),
		).toThrow('Status Definition.code is required');
	});

	it('should reject missing message', () => {
		expect(() =>
			validateStatusPayload(mockExecuteFunctions, { code: 'busy' }, 0, 'Status Definition'),
		).toThrow('Status Definition.message is required');
	});

	it('should reject invalid status values', () => {
		expect(() =>
			validateStatusPayload(
				mockExecuteFunctions,
				{ code: 'offline', message: 'Hello' },
				0,
				'Status Definition',
			),
		).toThrow('Invalid Status Definition.code');
	});

	it('should tag invalid status code errors with a machine-readable reason and hint', () => {
		assertNodeOperationErrorMetadata(
			() =>
				validateStatusPayload(
					mockExecuteFunctions,
					{ code: 'offline', message: 'Hello' },
					0,
					'Status Definition',
				),
			USER_STATUS_INVALID_CODE_REASON,
			USER_STATUS_INVALID_CODE_HINT,
		);
	});

	it('should validate and normalize transient payload', () => {
		const payload = validateTransientStatusPayload(
			mockExecuteFunctions,
			{ code: 'AVAILABLE', message: 'Heads down coding', expiry: 1641883476276 },
			0,
			'Transient Status Definition',
		);

		expect(payload).toEqual({
			code: 'available',
			message: 'Heads down coding',
			expiry: 1641883476276,
		});
	});

	it('should normalize ISO date-time expiry inside transient payloads', () => {
		const payload = validateTransientStatusPayload(
			mockExecuteFunctions,
			{
				code: 'busy',
				message: 'In a call',
				expiry: '2022-01-11T16:44:36.276Z',
			},
			0,
			'Transient Status Definition',
		);

		expect(payload).toEqual({
			code: 'busy',
			message: 'In a call',
			expiry: 1641919476276,
		});
	});

	it('should reject invalid transient expiry', () => {
		expect(() =>
			validateTransientStatusPayload(
				mockExecuteFunctions,
				{ code: 'busy', message: 'In a call', expiry: 0 },
				0,
				'Transient Status Definition',
			),
		).toThrow(
			'Transient Status Definition.expiry must resolve to a positive Unix timestamp in milliseconds',
		);
	});

	it('should reject empty transient payload', () => {
		expect(() =>
			validateTransientStatusPayload(mockExecuteFunctions, {}, 0, 'Transient Status Definition'),
		).toThrow('Transient Status Definition cannot be empty');
	});

	it('should parse JSON string payload input', () => {
		const payload = parseStatusPayloadInput(
			mockExecuteFunctions,
			'{"code":"busy","message":"In meeting"}',
			0,
			'Status Definition',
		);

		expect(payload).toEqual({ code: 'busy', message: 'In meeting' });
	});

	it('should reject invalid JSON payload input', () => {
		expect(() =>
			parseStatusPayloadInput(mockExecuteFunctions, '{oops', 0, 'Status Definition'),
		).toThrow('Status Definition must be valid JSON');
	});

	it('should reject empty string payload input', () => {
		expect(() =>
			parseStatusPayloadInput(mockExecuteFunctions, '   ', 0, 'Status Definition'),
		).toThrow('Status Definition cannot be empty');
	});

	it('should parse date-time string to Unix milliseconds', () => {
		const value = parseDateTimeOrUnixMs(
			mockExecuteFunctions,
			'2022-01-11T16:44:36.276Z',
			0,
			'Expiry',
		);
		expect(value).toBe(1641919476276);
	});

	it('should parse Unix millisecond string', () => {
		const value = parseDateTimeOrUnixMs(mockExecuteFunctions, '1641919476276', 0, 'Expiry');
		expect(value).toBe(1641919476276);
	});

	it('should reject undefined date-time input', () => {
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, undefined, 0, 'Expiry')).toThrow(
			'Expiry is required',
		);
	});

	it('should reject empty-string date-time input', () => {
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, '   ', 0, 'Expiry')).toThrow(
			'Expiry is required',
		);
	});

	it('should reject non-positive unix millisecond input', () => {
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, 0, 0, 'Expiry')).toThrow(
			'Expiry must resolve to a positive Unix timestamp in milliseconds',
		);
	});

	it('should parse object input with ts value', () => {
		const value = parseDateTimeOrUnixMs(mockExecuteFunctions, { ts: 1641919476276 }, 0, 'Expiry');
		expect(value).toBe(1641919476276);
	});

	it('should parse object input with valueOf returning number', () => {
		const value = parseDateTimeOrUnixMs(
			mockExecuteFunctions,
			{ valueOf: () => 1641919476276 },
			0,
			'Expiry',
		);
		expect(value).toBe(1641919476276);
	});

	it('should reject object input that cannot resolve to timestamp', () => {
		expect(() =>
			parseDateTimeOrUnixMs(mockExecuteFunctions, { valueOf: () => 'bad' }, 0, 'Expiry'),
		).toThrow('Expiry must be a valid date-time value or Unix timestamp in milliseconds');
	});

	it('should reject non-object/non-string/non-number input', () => {
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, true, 0, 'Expiry')).toThrow(
			'Expiry must be a valid date-time value or Unix timestamp in milliseconds',
		);
	});

	it('should reject null-prototype object without timestamp resolvers', () => {
		const value = Object.create(null) as Record<string, unknown>;
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, value, 0, 'Expiry')).toThrow(
			'Expiry must be a valid date-time value or Unix timestamp in milliseconds',
		);
	});

	it('should parse luxon-like objects with toMillis', () => {
		const value = parseDateTimeOrUnixMs(
			mockExecuteFunctions,
			{ toMillis: () => 1641919476276 },
			0,
			'Expiry',
		);
		expect(value).toBe(1641919476276);
	});

	it('should reject invalid date-time input', () => {
		expect(() => parseDateTimeOrUnixMs(mockExecuteFunctions, 'not-a-date', 0, 'Expiry')).toThrow(
			'Expiry must be a valid date-time value or Unix timestamp in milliseconds',
		);
	});

	it('should tag invalid expiry date-time errors with a machine-readable reason and hint', () => {
		assertNodeOperationErrorMetadata(
			() => parseDateTimeOrUnixMs(mockExecuteFunctions, 'not-a-date', 0, 'Expiry'),
			USER_STATUS_INVALID_EXPIRY_REASON,
			USER_STATUS_INVALID_EXPIRY_HINT,
		);
	});

	it('should tag non-positive expiry errors with a machine-readable reason and hint', () => {
		assertNodeOperationErrorMetadata(
			() => parseDateTimeOrUnixMs(mockExecuteFunctions, 0, 0, 'Expiry'),
			USER_STATUS_INVALID_EXPIRY_REASON,
			USER_STATUS_INVALID_EXPIRY_HINT,
		);
	});

	it('should pass through object payload input unchanged', () => {
		const payload = parseStatusPayloadInput(
			mockExecuteFunctions,
			{ code: 'busy', message: 'In a call' },
			0,
			'Status Definition',
		);

		expect(payload).toEqual({ code: 'busy', message: 'In a call' });
	});

	it('should reject non-object payload input', () => {
		expect(() =>
			parseStatusPayloadInput(mockExecuteFunctions, 123, 0, 'Status Definition'),
		).toThrow('Status Definition must be a JSON object');
	});

	it('should validate supported user status input modes', () => {
		expect(validateUserStatusInputMode(mockExecuteFunctions, 'structured', 0)).toBe('structured');
		expect(validateUserStatusInputMode(mockExecuteFunctions, 'raw', 0)).toBe('raw');
	});

	it('should reject unsupported user status input modes', () => {
		expect(() => validateUserStatusInputMode(mockExecuteFunctions, 'agentTool', 0)).toThrow(
			'Input Mode must be either "structured" or "raw"',
		);
	});

	it('should tag invalid input mode errors with a machine-readable reason and hint', () => {
		assertNodeOperationErrorMetadata(
			() => validateUserStatusInputMode(mockExecuteFunctions, 'agentTool', 0),
			USER_STATUS_INVALID_INPUT_MODE_REASON,
			USER_STATUS_INVALID_INPUT_MODE_HINT,
		);
	});

	it('should tag invalid status id errors with a machine-readable reason and hint', () => {
		assertNodeOperationErrorMetadata(
			() => validateStatusId(mockExecuteFunctions, 'ST 123', 0),
			USER_STATUS_INVALID_STATUS_ID_REASON,
			USER_STATUS_INVALID_STATUS_ID_HINT,
		);
	});

	it('should append continue-on-fail generic error payload', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('failed'),
			0,
			'create',
			{ id: 'S1' },
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'failed',
					resource: 'userStatus',
					operation: 'create',
					id: 'S1',
				},
			},
		]);
	});

	it('should append continue-on-fail scope payload when present', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			{ zohoCliqScopeErrorPayload: { success: false, missingScopes: ['ZohoCliq.Profile.CREATE'] } },
			0,
			'create',
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					missingScopes: ['ZohoCliq.Profile.CREATE'],
				},
			},
		]);
	});

	it('should merge extra context into scope payload recoverable output', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			{ zohoCliqScopeErrorPayload: { success: false, missingScopes: ['ZohoCliq.Profile.READ'] } },
			0,
			'list',
			{ attempted: 'current' },
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					missingScopes: ['ZohoCliq.Profile.READ'],
					attempted: 'current',
				},
			},
		]);
	});

	it('should append recoverable payload when AI Error Mode is enabled from parameters', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn((name: string) => {
				if (name === 'enableAiErrorMode') {
					return true;
				}
				return undefined;
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ parameters: {} })),
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('ai recoverable'),
			0,
			'getCurrent',
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'ai recoverable',
					resource: 'userStatus',
					operation: 'getCurrent',
				},
			},
		]);
	});

	it('should append recoverable payload when AI Error Mode is enabled in persisted node parameters', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup unavailable');
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: true } })),
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('persisted ai recoverable'),
			0,
			'list',
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'persisted ai recoverable',
					resource: 'userStatus',
					operation: 'list',
				},
			},
		]);
	});

	it('should not handle recoverable errors when persisted node parameters are unavailable', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup unavailable');
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ parameters: undefined })),
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('unhandled'),
			0,
			'list',
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should not handle recoverable errors when getNode returns undefined', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup unavailable');
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => undefined),
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('unhandled'),
			0,
			'list',
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should not handle recoverable errors when getNode throws', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter lookup unavailable');
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => {
				throw new Error('node unavailable');
			}),
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('unhandled'),
			0,
			'list',
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should return false when continueOnFail is not a function', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('failed'),
			0,
			'create',
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should return false when continueOnFail returns false', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			new Error('failed'),
			0,
			'create',
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should fallback to generic payload when scope payload is not an object', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(
			context,
			returnData,
			{ zohoCliqScopeErrorPayload: 'invalid', message: 'bad scope payload' },
			0,
			'create',
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'bad scope payload',
					resource: 'userStatus',
					operation: 'create',
				},
			},
		]);
	});

	it('should fallback to generic payload when error is undefined', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => true),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const handled = handleContinueOnFailError(context, returnData, undefined, 0, 'create');

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'An unexpected issue occurred with the API request',
					resource: 'userStatus',
					operation: 'create',
				},
			},
		]);
	});

	it('should resolve enhanced output with the default toggle enabled', () => {
		const context = {
			getNodeParameter: jest.fn(
				(_name: string, _itemIndex?: number, fallback?: unknown) => fallback,
			),
		} as unknown as IExecuteFunctions;

		expect(resolveUserStatusEnhancedOutput(context, 0, '')).toEqual({
			includeEnhancedOutput: true,
			rawResponse: { data: '' },
			responseJson: { data: '' },
		});
	});

	it('should resolve enhanced output with the toggle disabled', () => {
		const context = {
			getNodeParameter: jest.fn((name: string) => {
				if (name === 'includeEnhancedOutput') {
					return false;
				}
				return undefined;
			}),
		} as unknown as IExecuteFunctions;

		expect(resolveUserStatusEnhancedOutput(context, 0, { ok: true })).toEqual({
			includeEnhancedOutput: false,
			rawResponse: { ok: true },
			responseJson: { ok: true },
		});
	});
});
