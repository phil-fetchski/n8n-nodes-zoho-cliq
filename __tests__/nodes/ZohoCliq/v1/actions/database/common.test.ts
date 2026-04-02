import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildRecordValuesFromCollection,
	isDatabaseAiErrorModeEnabled,
	parseJsonObjectInput,
	parseRecordValuesFromResourceMapper,
	pushDatabaseRecoverableError,
	resolveDatabaseEnhancedOutput,
	validateDatabaseInputMode,
	validateJsonObject,
	validateQueryParameters,
	validateRecordId,
	validateTableName,
} from '../../../../../../nodes/ZohoCliq/v1/actions/database/common';

describe('ZohoCliq - Database - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	describe('validateTableName', () => {
		it('should trim and return valid table name', () => {
			expect(validateTableName(mockExecuteFunctions, '  orders_table  ', 0)).toBe('orders_table');
		});

		it('should throw for missing table name', () => {
			expect(() => validateTableName(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateTableName(mockExecuteFunctions, '  ', 0)).toThrow(
				'Database Name is required',
			);
		});

		it('should throw when table name contains "/"', () => {
			expect(() => validateTableName(mockExecuteFunctions, 'orders/name', 0)).toThrow(
				'Database Name cannot include "/" characters',
			);
		});

		it('should throw when table name exceeds max length', () => {
			expect(() => validateTableName(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Database Name is too long. Maximum length is 200 characters.',
			);
		});

		it('should throw when table name is undefined', () => {
			expect(() =>
				validateTableName(mockExecuteFunctions, undefined as unknown as string, 0),
			).toThrow('Database Name is required');
		});
	});

	describe('validateRecordId', () => {
		it('should trim and return valid record id', () => {
			expect(validateRecordId(mockExecuteFunctions, '  REC_123:abc  ', 0)).toBe('REC_123:abc');
		});

		it('should throw for missing record id', () => {
			expect(() => validateRecordId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateRecordId(mockExecuteFunctions, '  ', 0)).toThrow(
				'Record ID is required',
			);
		});

		it('should throw for invalid record id format', () => {
			expect(() => validateRecordId(mockExecuteFunctions, 'rec/id', 0)).toThrow(
				'Invalid Record ID format',
			);
		});

		it('should throw when record id is undefined', () => {
			expect(() =>
				validateRecordId(mockExecuteFunctions, undefined as unknown as string, 0),
			).toThrow('Record ID is required');
		});
	});

	describe('validateJsonObject', () => {
		it('should throw when payload is not object', () => {
			expect(() =>
				validateJsonObject(mockExecuteFunctions, 'bad' as unknown as IDataObject, 0, 'Body'),
			).toThrow('Body must be a JSON object');
			expect(() =>
				validateJsonObject(mockExecuteFunctions, [] as unknown as IDataObject, 0, 'Body'),
			).toThrow('Body must be a JSON object');
		});

		it('should throw when payload is empty and allowEmpty is false', () => {
			expect(() => validateJsonObject(mockExecuteFunctions, {}, 0, 'Body')).toThrow(
				'Body cannot be empty',
			);
		});

		it('should allow empty payload when allowEmpty is true', () => {
			expect(validateJsonObject(mockExecuteFunctions, {}, 0, 'Body', { allowEmpty: true })).toEqual(
				{},
			);
		});

		it('should throw for unsafe nested keys', () => {
			const parsedUnsafe = JSON.parse('{"__proto__":"blocked"}') as IDataObject;
			const payload = { list: [{ ok: true }, parsedUnsafe] } as IDataObject;

			expect(() => validateJsonObject(mockExecuteFunctions, payload, 0, 'Body')).toThrow(
				'Unsafe key "__proto__" is not allowed in Body.list[1]',
			);
		});

		it('should allow safe nested objects and arrays', () => {
			const payload = {
				id: '1',
				nested: { a: 1, b: [{ c: true }] },
			} as IDataObject;

			expect(validateJsonObject(mockExecuteFunctions, payload, 0, 'Body')).toEqual(payload);
		});

		it('should ignore primitive and null entries inside nested arrays', () => {
			const payload = {
				id: '1',
				nested: { list: [null, 1, 'x', { safe: true }] },
			} as IDataObject;

			expect(validateJsonObject(mockExecuteFunctions, payload, 0, 'Body')).toEqual(payload);
		});

		it('should throw when nested array contains an array value', () => {
			expect(() =>
				validateJsonObject(mockExecuteFunctions, { list: [[]] } as IDataObject, 0, 'Body'),
			).toThrow('Body.list[0] must be a JSON object');
		});
	});

	describe('parseJsonObjectInput', () => {
		it('should parse stringified JSON object', () => {
			const result = parseJsonObjectInput(mockExecuteFunctions, '{"status":"open"}', 0, 'Body');
			expect(result).toEqual({ status: 'open' });
		});

		it('should accept direct object input', () => {
			const result = parseJsonObjectInput(mockExecuteFunctions, { status: 'open' }, 0, 'Body');
			expect(result).toEqual({ status: 'open' });
		});

		it('should throw when value is null', () => {
			expect(() => parseJsonObjectInput(mockExecuteFunctions, null, 0, 'Body')).toThrow(
				'Body cannot be empty',
			);
		});

		it('should throw for empty json text input', () => {
			expect(() => parseJsonObjectInput(mockExecuteFunctions, '   ', 0, 'Body')).toThrow(
				'Body cannot be empty',
			);
		});

		it('should throw for invalid json string', () => {
			expect(() => parseJsonObjectInput(mockExecuteFunctions, '{"status":', 0, 'Body')).toThrow(
				'Body must be a valid JSON object when provided as text',
			);
		});
	});

	describe('parseRecordValuesFromResourceMapper', () => {
		it('should throw when mapper value is missing', () => {
			expect(() =>
				parseRecordValuesFromResourceMapper(mockExecuteFunctions, undefined, 0, 'Record Values'),
			).toThrow('Record Values is required');
		});

		it('should parse value object from mapper payload', () => {
			const result = parseRecordValuesFromResourceMapper(
				mockExecuteFunctions,
				{
					mappingMode: 'defineBelow',
					value: { status: 'open' },
				},
				0,
				'Record Values',
			);

			expect(result).toEqual({ status: 'open' });
		});

		it('should map values from input item json in auto map mode', () => {
			const result = parseRecordValuesFromResourceMapper(
				mockExecuteFunctions,
				{
					mappingMode: 'autoMapInputData',
					value: null,
					schema: [
						{ id: 'text', displayName: 'text' },
						{ id: 'bool', displayName: 'bool' },
					],
				},
				0,
				'Record Values',
				{ text: 'hello', bool: true, ignored: 'x' },
			);

			expect(result).toEqual({ text: 'hello', bool: true });
		});

		it('should throw when auto map mode has no source item json', () => {
			expect(() =>
				parseRecordValuesFromResourceMapper(
					mockExecuteFunctions,
					{
						mappingMode: 'autoMapInputData',
						value: null,
						schema: [{ id: 'text', displayName: 'text' }],
					},
					0,
					'Record Values',
				),
			).toThrow('Auto mapping requires an input item JSON object');
		});

		it('should treat non-array mapper schema as empty in auto map mode', () => {
			expect(() =>
				parseRecordValuesFromResourceMapper(
					mockExecuteFunctions,
					{
						mappingMode: 'autoMapInputData',
						value: null,
						schema: { id: 'status' } as unknown as Array<{ id: string }>,
					},
					0,
					'Record Values',
					{ status: 'open' },
				),
			).toThrow('Auto mapping found no matching input fields for this database schema');
		});

		it('should ignore schema entries without field ids and still map valid ids', () => {
			const result = parseRecordValuesFromResourceMapper(
				mockExecuteFunctions,
				{
					mappingMode: 'autoMapInputData',
					value: null,
					schema: [{ displayName: 'missing id' }, { id: 'status', displayName: 'status' }],
				},
				0,
				'Record Values',
				{ status: 'open' },
			);

			expect(result).toEqual({ status: 'open' });
		});

		it('should skip nullish schema entries during auto map resolution', () => {
			expect(() =>
				parseRecordValuesFromResourceMapper(
					mockExecuteFunctions,
					{
						mappingMode: 'autoMapInputData',
						value: null,
						schema: [undefined, null] as unknown as Array<{ id: string }>,
					},
					0,
					'Record Values',
					{ status: 'open' },
				),
			).toThrow('Auto mapping found no matching input fields for this database schema');
		});

		it('should throw when auto map has no matching schema fields', () => {
			expect(() =>
				parseRecordValuesFromResourceMapper(
					mockExecuteFunctions,
					{
						mappingMode: 'autoMapInputData',
						value: null,
						schema: [{ id: 'status', displayName: 'status' }],
					},
					0,
					'Record Values',
					{ text: 'hello' },
				),
			).toThrow('Auto mapping found no matching input fields for this database schema');
		});

		it('should throw when define-below mapper has no value object', () => {
			expect(() =>
				parseRecordValuesFromResourceMapper(
					mockExecuteFunctions,
					{
						mappingMode: 'defineBelow',
						value: null,
					},
					0,
					'Record Values',
				),
			).toThrow('Record Values must include at least one mapped field');
		});
	});

	describe('buildRecordValuesFromCollection', () => {
		it('should build record values from field collection', () => {
			const result = buildRecordValuesFromCollection(
				mockExecuteFunctions,
				{
					field: [
						{ name: 'order_id', valueType: 'string', stringValue: 'A-1' },
						{ name: 'amount', valueType: 'number', numberValue: 10 },
					],
				},
				0,
			);

			expect(result).toEqual({
				order_id: 'A-1',
				amount: 10,
			});
		});
		it('should throw when no field entries are provided', () => {
			expect(() => buildRecordValuesFromCollection(mockExecuteFunctions, { field: [] }, 0)).toThrow(
				'Record Fields must contain at least one field',
			);
		});

		it('should throw when record fields collection is missing', () => {
			expect(() =>
				buildRecordValuesFromCollection(mockExecuteFunctions, {} as IDataObject, 0),
			).toThrow('Record Fields must contain at least one field');
		});

		it('should throw when record fields collection input is undefined', () => {
			expect(() =>
				buildRecordValuesFromCollection(
					mockExecuteFunctions,
					undefined as unknown as IDataObject,
					0,
				),
			).toThrow('Record Fields must contain at least one field');
		});

		it('should throw when a field entry is not an object', () => {
			expect(() =>
				buildRecordValuesFromCollection(mockExecuteFunctions, { field: ['bad'] }, 0),
			).toThrow('Record Fields.field[0] must be a JSON object');
		});

		it('should throw for invalid field name', () => {
			expect(() =>
				buildRecordValuesFromCollection(
					mockExecuteFunctions,
					{
						field: [{ name: 'bad field', valueType: 'string', stringValue: 'A-1' }],
					},
					0,
				),
			).toThrow('invalid format');
		});

		it('should infer type from selected field option when enabled', () => {
			const result = buildRecordValuesFromCollection(
				mockExecuteFunctions,
				{
					field: [
						{
							fieldNameMode: 'fromList',
							nameFromList: 'bool:boolean',
							useInferredValueType: true,
							valueType: 'string',
							booleanValue: true,
						},
					],
				},
				0,
			);

			expect(result).toEqual({ bool: true });
		});

		it('should support from-list field names without inferred type', () => {
			const result = buildRecordValuesFromCollection(
				mockExecuteFunctions,
				{
					field: [
						{
							fieldNameMode: 'fromList',
							nameFromList: 'status',
							valueType: 'string',
							stringValue: 'open',
						},
					],
				},
				0,
			);

			expect(result).toEqual({ status: 'open' });
		});

		it('should throw when field name is missing in from-list mode', () => {
			expect(() =>
				buildRecordValuesFromCollection(
					mockExecuteFunctions,
					{
						field: [
							{
								fieldNameMode: 'fromList',
								nameFromList: '',
								valueType: 'string',
								stringValue: 'open',
							},
						],
					},
					0,
				),
			).toThrow('Record Fields.field[0].nameFromList is required');
		});

		it('should throw when number value is not finite', () => {
			expect(() =>
				buildRecordValuesFromCollection(
					mockExecuteFunctions,
					{
						field: [{ name: 'amount', valueType: 'number', numberValue: 'nan' }],
					},
					0,
				),
			).toThrow('Record Fields.field[0].numberValue must be a valid number');
		});

		it('should support null and json field value types', () => {
			const result = buildRecordValuesFromCollection(
				mockExecuteFunctions,
				{
					field: [
						{ name: 'note', valueType: 'null' },
						{ name: 'meta', valueType: 'json', jsonValue: '{"nested":true}' },
					],
				},
				0,
			);

			expect(result).toEqual({
				note: null,
				meta: { nested: true },
			});
		});

		it('should default invalid valueType to string and allow empty string fallback', () => {
			const result = buildRecordValuesFromCollection(
				mockExecuteFunctions,
				{
					field: [
						{
							name: 'status',
							valueType: 123 as unknown as string,
						},
					],
				},
				0,
			);

			expect(result).toEqual({ status: '' });
		});

		it('should treat missing nameFromList as required in from-list mode', () => {
			expect(() =>
				buildRecordValuesFromCollection(
					mockExecuteFunctions,
					{
						field: [
							{
								fieldNameMode: 'fromList',
								valueType: 'string',
								stringValue: 'x',
							},
						],
					},
					0,
				),
			).toThrow('Record Fields.field[0].nameFromList is required');
		});
	});

	describe('validateQueryParameters', () => {
		it('should keep only supported query parameter values', () => {
			const result = validateQueryParameters(
				mockExecuteFunctions,
				{
					criteria: ' status==open ',
					from_index: '0',
					limit: 50,
					order_by: '-created_at',
					start_token: ' token-123 ',
					empty: null,
					notSet: undefined,
				},
				0,
			);

			expect(result).toEqual({
				criteria: 'status==open',
				from_index: 0,
				limit: 50,
				order_by: '-created_at',
				start_token: 'token-123',
			});
		});

		it('should reject unsupported query parameter keys', () => {
			expect(() =>
				validateQueryParameters(mockExecuteFunctions, { include_meta: true } as IDataObject, 0),
			).toThrow('Unsupported query parameter "include_meta"');
		});

		it('should reject invalid query parameter types', () => {
			expect(() =>
				validateQueryParameters(mockExecuteFunctions, { criteria: false } as IDataObject, 0),
			).toThrow('Query parameter "criteria" must be a string');
		});

		it('should reject non-string order_by values', () => {
			expect(() =>
				validateQueryParameters(mockExecuteFunctions, { order_by: 1 } as IDataObject, 0),
			).toThrow('Query parameter "order_by" must be a string');
		});

		it('should reject invalid raw order_by formats', () => {
			expect(() =>
				validateQueryParameters(mockExecuteFunctions, { order_by: 'created_at' } as IDataObject, 0),
			).toThrow('Order By must be in the format +column_name or -column_name');
		});

		it('should reject blank numeric query parameter strings', () => {
			expect(() =>
				validateQueryParameters(mockExecuteFunctions, { from_index: '   ' } as IDataObject, 0),
			).toThrow('From Index must be a whole number greater than or equal to 0');
		});

		it('should accept numeric query parameters from both numbers and strings', () => {
			expect(
				validateQueryParameters(
					mockExecuteFunctions,
					{ from_index: 3, limit: '75' } as IDataObject,
					0,
				),
			).toEqual({
				from_index: 3,
				limit: 75,
			});
		});

		it('should reject blank limit strings', () => {
			expect(() =>
				validateQueryParameters(mockExecuteFunctions, { limit: '   ' } as IDataObject, 0),
			).toThrow('Limit must be a whole number between 1 and 100');
		});
	});

	describe('validateDatabaseInputMode', () => {
		it('should accept structured and raw modes', () => {
			expect(validateDatabaseInputMode(mockExecuteFunctions, 'structured', 0)).toBe('structured');
			expect(validateDatabaseInputMode(mockExecuteFunctions, 'raw', 0)).toBe('raw');
		});

		it('should reject unsupported modes', () => {
			expect(() => validateDatabaseInputMode(mockExecuteFunctions, 'legacy', 0)).toThrow(
				'Input Mode must be either "structured" or "raw"',
			);
		});
	});

	describe('isDatabaseAiErrorModeEnabled', () => {
		it('should read AI Error Mode from node parameters', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: 'true' } })),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(true);
		});

		it('should return false when AI Error Mode is disabled', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNodeParameter throws and getNode is unavailable', () => {
			const context = {
				getNodeParameter: jest.fn(() => {
					throw new Error('missing parameter');
				}),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNodeParameter is missing entirely', () => {
			const context = {
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when node parameters are not a plain object', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: [] })),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when node parameters are missing', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({})),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNode returns undefined', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => undefined),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNode throws', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => {
					throw new Error('bad node');
				}),
			} as unknown as IExecuteFunctions;

			expect(isDatabaseAiErrorModeEnabled(context, 0)).toBe(false);
		});
	});

	describe('pushDatabaseRecoverableError', () => {
		it('should return false when recoverable handling is disabled', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				getNodeParameter: jest.fn(() => false),
				continueOnFail: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
			} as unknown as IExecuteFunctions;

			expect(pushDatabaseRecoverableError(context, returnData, 0, 'list', new Error('fail'))).toBe(
				false,
			);
			expect(returnData).toEqual([]);
		});

		it('should preserve scope payloads in recoverable mode', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				getNodeParameter: jest.fn(() => false),
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
			} as unknown as IExecuteFunctions;

			const handled = pushDatabaseRecoverableError(context, returnData, 0, 'list', {
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'database',
					operation: 'list',
					reason: 'MISSING_SCOPE',
				},
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'database',
					operation: 'list',
					reason: 'MISSING_SCOPE',
				}),
			);
		});

		it('should fall back to a generic recoverable payload when scope payload is invalid', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				getNodeParameter: jest.fn(() => false),
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
			} as unknown as IExecuteFunctions;

			const handled = pushDatabaseRecoverableError(
				context,
				returnData,
				0,
				'list',
				{
					message: 'boom',
					zohoCliqScopeErrorPayload: 'invalid',
				},
				{
					contextFields: { database_name: 'orders' },
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'database',
					operation: 'list',
					database_name: 'orders',
					message: 'boom',
				}),
			);
		});

		it('should ignore array scope payloads and build a generic recoverable payload', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				getNodeParameter: jest.fn(() => false),
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
			} as unknown as IExecuteFunctions;

			const handled = pushDatabaseRecoverableError(
				context,
				returnData,
				0,
				'list',
				{
					message: 'array scope payload',
					zohoCliqScopeErrorPayload: [],
				},
				{
					contextFields: { database_name: 'orders' },
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'database',
					operation: 'list',
					database_name: 'orders',
					message: 'array scope payload',
				}),
			);
		});

		it('should build a generic recoverable payload when the error has no scope payload', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				getNodeParameter: jest.fn(() => 'true'),
				continueOnFail: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: 'true' } })),
			} as unknown as IExecuteFunctions;

			const handled = pushDatabaseRecoverableError(
				context,
				returnData,
				0,
				'get',
				'plain string failure',
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'database',
					operation: 'get',
					message: 'plain string failure',
				}),
			);
		});

		it('should build a generic recoverable payload when the error is undefined', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				getNodeParameter: jest.fn(() => 'true'),
				continueOnFail: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: 'true' } })),
			} as unknown as IExecuteFunctions;

			const handled = pushDatabaseRecoverableError(context, returnData, 0, 'get', undefined);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'database',
					operation: 'get',
					message: 'An unexpected issue occurred with the API request',
				}),
			);
		});
	});

	describe('resolveDatabaseEnhancedOutput', () => {
		it('should coerce minimal API responses and keep enhanced output enabled by default', () => {
			const context = {
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex?: number, fallback?: unknown) => fallback,
				),
			} as unknown as IExecuteFunctions;

			expect(resolveDatabaseEnhancedOutput(context, 0, 'done')).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { data: 'done' },
				responseJson: { data: 'done' },
			});
		});

		it('should reflect when enhanced output is disabled', () => {
			const context = {
				getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) =>
					name === 'includeEnhancedOutput' ? false : fallback,
				),
			} as unknown as IExecuteFunctions;

			expect(resolveDatabaseEnhancedOutput(context, 0, 'done')).toEqual({
				includeEnhancedOutput: false,
				rawResponse: { data: 'done' },
				responseJson: { data: 'done' },
			});
		});
	});
});
