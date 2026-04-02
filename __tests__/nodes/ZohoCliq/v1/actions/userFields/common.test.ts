import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	ensureSafeObject,
	isUserFieldAiErrorModeEnabled,
	parseFieldArrayInput,
	parseFieldPayloadInput,
	pushUserFieldRecoverableError,
	resolveUserFieldEnhancedOutput,
	shouldContinueOnFail,
	validateCreateFieldPayload,
	validateFieldPayload,
	validateUserFieldInputMode,
	validateUpdateFieldPayload,
	validateUserFieldId,
} from '../../../../../../nodes/ZohoCliq/v1/actions/userFields/common';

describe('ZohoCliq - UserFields - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	describe('validateUserFieldId', () => {
		it('should trim and return valid field ID', () => {
			const result = validateUserFieldId(mockExecuteFunctions, '  UF_123-abc  ', 0);
			expect(result).toBe('UF_123-abc');
		});

		it('should throw for empty field ID', () => {
			expect(() => validateUserFieldId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateUserFieldId(mockExecuteFunctions, '   ', 0)).toThrow(
				'User Field ID is required',
			);
		});

		it('should throw for invalid field ID characters', () => {
			expect(() => validateUserFieldId(mockExecuteFunctions, 'bad/id', 0)).toThrow(
				'Invalid User Field ID format',
			);
		});

		it('should throw for field ID longer than 200 characters', () => {
			const longId = 'a'.repeat(201);
			expect(() => validateUserFieldId(mockExecuteFunctions, longId, 0)).toThrow(
				'Maximum length is 200 characters',
			);
		});
	});

	describe('validateUserFieldInputMode', () => {
		it('should accept structured, agentTool, and raw modes after trimming', () => {
			expect(validateUserFieldInputMode(mockExecuteFunctions, ' structured ', 0)).toBe(
				'structured',
			);
			expect(validateUserFieldInputMode(mockExecuteFunctions, 'agentTool', 0)).toBe('agentTool');
			expect(validateUserFieldInputMode(mockExecuteFunctions, 'raw', 0)).toBe('raw');
		});

		it('should reject unsupported input modes', () => {
			expect(() => validateUserFieldInputMode(mockExecuteFunctions, 'guided', 0)).toThrow(
				'Input Mode must be "structured", "agentTool", or "raw"',
			);
		});

		it('should reject non-string input modes', () => {
			expect(() => validateUserFieldInputMode(mockExecuteFunctions, true, 0)).toThrow(
				'Input Mode must be "structured", "agentTool", or "raw"',
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined values', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, null, 0, 'payload')).not.toThrow();
			expect(() => ensureSafeObject(mockExecuteFunctions, undefined, 0, 'payload')).not.toThrow();
		});

		it('should throw when value is not an object', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, 'text', 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when value is an array', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, [], 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when top-level unsafe key is present', () => {
			const payload = { constructor: 'blocked' } as unknown as IDataObject;
			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "constructor" is not allowed',
			);
		});

		it('should throw when nested unsafe key is present in object', () => {
			const payload = {
				nested: {
					prototype: 'blocked',
				},
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "prototype" is not allowed',
			);
		});

		it('should throw when nested unsafe key is present inside array object', () => {
			const parsedUnsafe = JSON.parse('{"__proto__":"blocked"}') as IDataObject;
			const payload = {
				list: [{ safe: true }, parsedUnsafe],
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "__proto__" is not allowed',
			);
		});

		it('should allow safe nested objects and arrays', () => {
			const payload = {
				name: 'employee_code',
				config: {
					meta: { required: true },
					options: [{ key: 'A' }, { key: 'B' }],
				},
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).not.toThrow();
		});
	});

	describe('parseFieldArrayInput', () => {
		it('should accept an array value directly', () => {
			const result = parseFieldArrayInput(
				mockExecuteFunctions,
				[{ name: 'Yes', id: '123' }, { name: 'No' }],
				0,
				'Dropdown Options',
			);

			expect(result).toEqual([{ name: 'Yes', id: '123' }, { name: 'No' }]);
		});

		it('should parse a JSON array string', () => {
			const result = parseFieldArrayInput(
				mockExecuteFunctions,
				'[{"name":"Yes","id":"123"},{"name":"No"}]',
				0,
				'Dropdown Options',
			);

			expect(result).toEqual([{ name: 'Yes', id: '123' }, { name: 'No' }]);
		});

		it('should reject null, undefined, and blank string input', () => {
			expect(() => parseFieldArrayInput(mockExecuteFunctions, null, 0, 'Dropdown Options')).toThrow(
				'Dropdown Options cannot be empty',
			);

			expect(() =>
				parseFieldArrayInput(mockExecuteFunctions, undefined, 0, 'Dropdown Options'),
			).toThrow('Dropdown Options cannot be empty');

			expect(() =>
				parseFieldArrayInput(mockExecuteFunctions, '   ', 0, 'Dropdown Options'),
			).toThrow('Dropdown Options cannot be empty');
		});

		it('should reject invalid JSON text', () => {
			expect(() =>
				parseFieldArrayInput(mockExecuteFunctions, '[{"name":"Yes"}', 0, 'Dropdown Options'),
			).toThrow('Dropdown Options must be a valid JSON array when provided as text');
		});

		it('should reject non-array parsed values', () => {
			expect(() =>
				parseFieldArrayInput(mockExecuteFunctions, '{"name":"Yes"}', 0, 'Dropdown Options'),
			).toThrow('Dropdown Options must be a JSON array');

			expect(() =>
				parseFieldArrayInput(mockExecuteFunctions, { name: 'Yes' }, 0, 'Dropdown Options'),
			).toThrow('Dropdown Options must be a JSON array');
		});

		it('should allow primitive array entries without object validation', () => {
			const result = parseFieldArrayInput(
				mockExecuteFunctions,
				'["Yes","No",3,false,null]',
				0,
				'Dropdown Options',
			);

			expect(result).toEqual(['Yes', 'No', 3, false, null]);
		});

		it('should reject unsafe keys in array objects', () => {
			expect(() =>
				parseFieldArrayInput(
					mockExecuteFunctions,
					'[{"name":"Yes"},{"constructor":"bad"}]',
					0,
					'Dropdown Options',
				),
			).toThrow('Unsafe key "constructor" is not allowed');
		});
	});

	describe('validateFieldPayload', () => {
		it('should return payload when valid', () => {
			const payload: IDataObject = {
				name: 'employee_code',
				label: 'Employee Code',
				type: 'text_field',
			};

			const result = validateFieldPayload(mockExecuteFunctions, payload, 0, 'Field Definition');
			expect(result).toEqual(payload);
		});

		it('should throw for empty payload when allowEmpty is false', () => {
			expect(() => validateFieldPayload(mockExecuteFunctions, {}, 0, 'Field Definition')).toThrow(
				'Field Definition cannot be empty',
			);
		});

		it('should throw for null payload', () => {
			expect(() =>
				validateFieldPayload(
					mockExecuteFunctions,
					null as unknown as IDataObject,
					0,
					'Field Definition',
				),
			).toThrow('Field Definition cannot be empty');
		});

		it('should allow empty payload when allowEmpty is true', () => {
			const result = validateFieldPayload(mockExecuteFunctions, {}, 0, 'Update Definition', true);
			expect(result).toEqual({});
		});

		it('should throw for blank name-related fields', () => {
			expect(() =>
				validateFieldPayload(
					mockExecuteFunctions,
					{ name: '   ' } as unknown as IDataObject,
					0,
					'Field Definition',
				),
			).toThrow('name cannot be empty');

			expect(() =>
				validateFieldPayload(
					mockExecuteFunctions,
					{ unique_name: '   ' } as unknown as IDataObject,
					0,
					'Field Definition',
				),
			).toThrow('unique_name cannot be empty');
		});

		it('should throw for name-related field longer than 30 chars', () => {
			expect(() =>
				validateFieldPayload(
					mockExecuteFunctions,
					{ label: 'a'.repeat(31) } as unknown as IDataObject,
					0,
					'Field Definition',
				),
			).toThrow('label is too long. Maximum length is 30 characters.');
		});
	});

	describe('validateCreateFieldPayload', () => {
		it('should require name with a structured missing-required-field code', () => {
			let thrownError: unknown;
			try {
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ type: 'text_field' },
					0,
					'Field Definition',
				);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect(thrownError).toMatchObject({
				message: 'name is required',
				code: 'MISSING_REQUIRED_FIELD',
				description: 'Provide the required "name" field before creating a user field.',
			});
		});

		it('should reject unsupported fields', () => {
			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Title', unknown: true } as unknown as IDataObject,
					0,
					'Field Definition',
				),
			).toThrow('contains unsupported field "unknown"');
		});

		it('should reject missing, empty, and invalid type with structured codes', () => {
			let missingTypeError: unknown;
			try {
				validateCreateFieldPayload(mockExecuteFunctions, { name: 'Title' }, 0, 'Field Definition');
			} catch (error) {
				missingTypeError = error;
			}

			expect(missingTypeError).toBeInstanceOf(NodeOperationError);
			expect(missingTypeError).toMatchObject({
				message: 'type is required',
				code: 'MISSING_REQUIRED_FIELD',
				description: 'Provide the required "type" field before creating a user field.',
			});

			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Title', type: '   ' },
					0,
					'Field Definition',
				),
			).toThrow('type cannot be empty');

			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Title', type: 'numeric' },
					0,
					'Field Definition',
				),
			).toThrow('Invalid type "numeric"');
		});

		it('should accept the QA-verified number and url types', () => {
			expect(
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Score', type: 'number' },
					0,
					'Field Definition',
				),
			).toEqual({
				name: 'Score',
				type: 'number',
			});

			expect(
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Website', type: 'url' },
					0,
					'Field Definition',
				),
			).toEqual({
				name: 'Website',
				type: 'url',
			});
		});

		it('should require options for drop_down fields', () => {
			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Vaccinated', type: 'drop_down' },
					0,
					'Field Definition',
				),
			).toThrow('options are required when type is "drop_down"');
		});

		it('should reject invalid options payloads', () => {
			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Vaccinated', type: 'drop_down', options: 'x' as unknown as string[] },
					0,
					'Field Definition',
				),
			).toThrow('options must be an array of strings');

			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Vaccinated', type: 'drop_down', options: [] },
					0,
					'Field Definition',
				),
			).toThrow('options cannot be empty');
		});

		it('should reject blank and long options', () => {
			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Vaccinated', type: 'drop_down', options: ['ok', '   '] },
					0,
					'Field Definition',
				),
			).toThrow('options[1] must be a non-empty string');

			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Vaccinated', type: 'drop_down', options: ['a'.repeat(101)] },
					0,
					'Field Definition',
				),
			).toThrow('options[0] is too long');

			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Vaccinated', type: 'drop_down', options: [{}] as unknown as string[] },
					0,
					'Field Definition',
				),
			).toThrow('options[0] must be a non-empty string');
		});

		it('should reject options when type is not drop_down', () => {
			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'Department', type: 'text_field', options: ['A'] },
					0,
					'Field Definition',
				),
			).toThrow('options are only supported when type is "drop_down"');
		});

		it('should normalize booleans and dedupe options on valid payload', () => {
			const payload = validateCreateFieldPayload(
				mockExecuteFunctions,
				{
					name: 'Vaccinated',
					type: 'drop_down',
					mandatory: 'true',
					encrypted: 'false',
					edit_permission: true,
					options: ['Yes', 'No', 'Yes'],
				},
				0,
				'Field Definition',
			);

			expect(payload).toEqual({
				name: 'Vaccinated',
				type: 'drop_down',
				mandatory: true,
				encrypted: false,
				edit_permission: true,
				options: ['Yes', 'No'],
			});
		});

		it('should reject invalid boolean values on create', () => {
			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'A', type: 'text_field', mandatory: 'maybe' },
					0,
					'Field Definition',
				),
			).toThrow('mandatory must be a boolean');

			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{ name: 'A', type: 'text_field', mandatory: 123 } as unknown as IDataObject,
					0,
					'Field Definition',
				),
			).toThrow('mandatory must be a boolean');
		});

		it('should reject undefined option entries', () => {
			expect(() =>
				validateCreateFieldPayload(
					mockExecuteFunctions,
					{
						name: 'Vaccinated',
						type: 'drop_down',
						options: [undefined] as unknown as string[],
					},
					0,
					'Field Definition',
				),
			).toThrow('options[0] must be a non-empty string');
		});
	});

	describe('validateUpdateFieldPayload', () => {
		it('should reject unsupported update fields', () => {
			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ type: 'drop_down' } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('contains unsupported field "type"');
		});

		it('should reject empty name when provided', () => {
			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ name: '   ' } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('name cannot be empty');
		});

		it('should reject invalid boolean fields', () => {
			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ encrypted: 'not-bool' } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('encrypted must be a boolean');
		});

		it('should reject invalid options payload', () => {
			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: 'x' } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('options must be an array of objects with name and optional id');

			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: [] } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('options cannot be empty');
		});

		it('should validate option object fields and duplicate ids', () => {
			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: [{ name: '   ' }] } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('options[0].name is required');

			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: [{ name: undefined }] } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('options[0].name is required');

			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: [{ name: 'a'.repeat(101) }] } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('options[0].name is too long');

			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: [{ name: 'Yes', id: '' }] } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('options[0].id cannot be empty');

			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: [{ name: 'Yes', id: null }] } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('options[0].id cannot be empty');

			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{ options: [{ name: 'Yes', id: 'bad/id' }] } as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('invalid format');

			expect(() =>
				validateUpdateFieldPayload(
					mockExecuteFunctions,
					{
						options: [
							{ name: 'Yes', id: '1' },
							{ name: 'No', id: '1' },
						],
					} as unknown as IDataObject,
					0,
					'Update Definition',
				),
			).toThrow('duplicate id "1"');
		});

		it('should normalize valid update payload', () => {
			const payload = validateUpdateFieldPayload(
				mockExecuteFunctions,
				{
					name: '  Vaccinated  ',
					mandatory: 'false',
					encrypted: 'true',
					edit_permission: false,
					options: [{ name: 'Yes', id: '11' }, { name: 'No' }],
				} as unknown as IDataObject,
				0,
				'Update Definition',
			);

			expect(payload).toEqual({
				name: 'Vaccinated',
				mandatory: false,
				encrypted: true,
				edit_permission: false,
				options: [{ name: 'Yes', id: '11' }, { name: 'No' }],
			});
		});
	});

	describe('parseFieldPayloadInput', () => {
		it('should reject null and blank string', () => {
			expect(() =>
				parseFieldPayloadInput(mockExecuteFunctions, null, 0, 'Field Definition'),
			).toThrow('Field Definition cannot be empty');
			expect(() =>
				parseFieldPayloadInput(mockExecuteFunctions, '   ', 0, 'Field Definition'),
			).toThrow('Field Definition cannot be empty');
		});

		it('should reject invalid json string', () => {
			expect(() =>
				parseFieldPayloadInput(mockExecuteFunctions, '{ bad json', 0, 'Field Definition'),
			).toThrow('must be a valid JSON object');
		});

		it('should parse valid json string', () => {
			const parsed = parseFieldPayloadInput(
				mockExecuteFunctions,
				'{"name":"Vaccinated","type":"drop_down"}',
				0,
				'Field Definition',
			);
			expect(parsed).toEqual({ name: 'Vaccinated', type: 'drop_down' });
		});
	});

	describe('isUserFieldAiErrorModeEnabled', () => {
		it('should read AI Error Mode from node parameters when direct lookup is unavailable', () => {
			const context = {
				getNodeParameter: jest.fn(() => {
					throw new Error('no direct lookup');
				}),
				getNode: jest.fn(() => ({
					parameters: {
						enableAiErrorMode: true,
					},
				})),
			} as unknown as IExecuteFunctions;

			expect(isUserFieldAiErrorModeEnabled(context, 0)).toBe(true);
		});

		it('should return false when getNode is unavailable', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
			} as unknown as IExecuteFunctions;

			expect(isUserFieldAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when node parameters are missing or invalid', () => {
			const noParametersContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({})),
			} as unknown as IExecuteFunctions;
			const nullNodeContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => null),
			} as unknown as IExecuteFunctions;
			const arrayParametersContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: [] })),
			} as unknown as IExecuteFunctions;

			expect(isUserFieldAiErrorModeEnabled(noParametersContext, 0)).toBe(false);
			expect(isUserFieldAiErrorModeEnabled(nullNodeContext, 0)).toBe(false);
			expect(isUserFieldAiErrorModeEnabled(arrayParametersContext, 0)).toBe(false);
		});

		it('should return false when getNode throws', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => {
					throw new Error('boom');
				}),
			} as unknown as IExecuteFunctions;

			expect(isUserFieldAiErrorModeEnabled(context, 0)).toBe(false);
		});
	});

	describe('pushUserFieldRecoverableError', () => {
		it('should include friendly hint for known user field error codes', () => {
			const context = {
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];
			const error = {
				message: 'API request failed',
				response: {
					status: 400,
					data: {
						error: 'Request failed',
						message: 'Type unsupported',
						code: 'FIELD_TYPE_NOT_SUPPORTED',
					},
				},
			};

			expect(pushUserFieldRecoverableError(context, returnData, 0, 'create', error)).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'userFields',
					operation: 'create',
					status_code: 400,
					reason: 'FIELD_TYPE_NOT_SUPPORTED',
					message: 'User field type not supported.',
					hint: 'Use one of the supported create types: text_field, number, url, date_picker, drop_down.',
				}),
			);
			expect(returnData[0].json.details).toEqual(
				expect.objectContaining({
					code: 'FIELD_TYPE_NOT_SUPPORTED',
				}),
			);
		});

		it('should return false when neither continueOnFail nor AI Error Mode is enabled', () => {
			const context = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];

			expect(pushUserFieldRecoverableError(context, returnData, 0, 'list', new Error('boom'))).toBe(
				false,
			);
			expect(returnData).toEqual([]);
		});

		it('should return scope payload with merged context fields when present', () => {
			const context = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];

			expect(
				pushUserFieldRecoverableError(
					context,
					returnData,
					0,
					'delete',
					{
						zohoCliqScopeErrorPayload: { success: false, requiredScopes: ['scope.a'] },
					},
					{
						contextFields: { field_id: 'UF_123' },
					},
				),
			).toBe(true);
			expect(returnData[0].json).toEqual({
				success: false,
				requiredScopes: ['scope.a'],
				field_id: 'UF_123',
			});
		});

		it('should support error_code hints and scope payloads without extra context', () => {
			const context = {
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];

			expect(
				pushUserFieldRecoverableError(context, returnData, 0, 'update', {
					message: 'request failed',
					response: {
						status: 400,
						data: {
							error: 'Request failed',
							message: 'Missing options',
							error_code: 'FIELDS_OPTIONS_NOT_EXIST',
						},
					},
				}),
			).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					reason: 'FIELDS_OPTIONS_NOT_EXIST',
					message: 'One or more user field options do not exist.',
					hint: 'Verify the dropdown option IDs or names before retrying the update.',
				}),
			);

			const scopeReturnData: Array<{ json: IDataObject }> = [];
			expect(
				pushUserFieldRecoverableError(context, scopeReturnData, 0, 'get', {
					zohoCliqScopeErrorPayload: { success: false, requiredScopes: ['scope.b'] },
				}),
			).toBe(true);
			expect(scopeReturnData[0].json).toEqual({
				success: false,
				requiredScopes: ['scope.b'],
			});
		});

		it('should handle primitive errors in recoverable mode', () => {
			const context = {
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];

			expect(pushUserFieldRecoverableError(context, returnData, 0, 'list', 'plain error')).toBe(
				true,
			);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'userFields',
					operation: 'list',
				}),
			);
		});

		it('should keep the generic hint when the API error code is unknown', () => {
			const context = {
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];

			expect(
				pushUserFieldRecoverableError(context, returnData, 0, 'create', {
					message: 'request failed',
					response: {
						status: 400,
						data: {
							error: 'Request failed',
							message: 'Unknown issue',
							code: 'UNKNOWN_CODE',
						},
					},
				}),
			).toBe(true);
			expect(returnData[0].json.hint).toBe(
				'Check required parameters, field formats, and request constraints.',
			);
			expect(returnData[0].json.reason).toBe('BAD_REQUEST');
		});

		it('should keep the generic hint when no error code is present', () => {
			const context = {
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];

			expect(
				pushUserFieldRecoverableError(context, returnData, 0, 'get', {
					message: 'request failed',
					response: {
						status: 400,
						data: {
							error: 'Request failed',
							message: 'Validation failed',
						},
					},
				}),
			).toBe(true);
			expect(returnData[0].json.hint).toBe(
				'Check required parameters, field formats, and request constraints.',
			);
			expect(returnData[0].json.reason).toBe('BAD_REQUEST');
		});

		it('should promote known permission-style user field API codes into stable contracts', () => {
			const context = {
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;
			const returnData: Array<{ json: IDataObject }> = [];

			expect(
				pushUserFieldRecoverableError(context, returnData, 0, 'update', {
					message: 'request failed',
					response: {
						status: 400,
						data: {
							error: 'Request failed',
							message: 'You do not have permission to edit the default field',
							code: 'FIELD_SYSTEM_FIELD_EDIT_NOT_ALLOWED',
						},
					},
				}),
			).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					reason: 'FIELD_SYSTEM_FIELD_EDIT_NOT_ALLOWED',
					message: 'Default user field cannot be edited.',
					hint: 'You do not have permission to edit this default/system user field.',
				}),
			);
		});
	});

	describe('resolveUserFieldEnhancedOutput', () => {
		it('should return enhanced-output toggle state and coerced response object', () => {
			const context = {
				getNodeParameter: jest.fn(() => true),
			} as unknown as IExecuteFunctions;

			expect(resolveUserFieldEnhancedOutput(context, 0, '')).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { data: '' },
				responseJson: { data: '' },
			});
		});

		it('should return includeEnhancedOutput false and preserve object responses', () => {
			const context = {
				getNodeParameter: jest.fn(() => false),
			} as unknown as IExecuteFunctions;

			expect(resolveUserFieldEnhancedOutput(context, 0, { id: '123' })).toEqual({
				includeEnhancedOutput: false,
				rawResponse: { id: '123' },
				responseJson: { id: '123' },
			});
		});

		it('should coerce null responses to empty objects', () => {
			const context = {
				getNodeParameter: jest.fn(() => true),
			} as unknown as IExecuteFunctions;

			expect(resolveUserFieldEnhancedOutput(context, 0, null)).toEqual({
				includeEnhancedOutput: true,
				rawResponse: {},
				responseJson: {},
			});
		});

		it('should coerce array responses into data arrays', () => {
			const context = {
				getNodeParameter: jest.fn(() => true),
			} as unknown as IExecuteFunctions;

			expect(resolveUserFieldEnhancedOutput(context, 0, [{ id: '123' }])).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { data: [{ id: '123' }] },
				responseJson: { data: [{ id: '123' }] },
			});
		});

		it('should preserve object responses when enhanced output is enabled', () => {
			const context = {
				getNodeParameter: jest.fn(() => true),
			} as unknown as IExecuteFunctions;

			expect(resolveUserFieldEnhancedOutput(context, 0, { status: 'ok' })).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { status: 'ok' },
				responseJson: { status: 'ok' },
			});
		});
	});

	describe('shouldContinueOnFail', () => {
		it('should return false when function is missing', () => {
			const context = {} as IExecuteFunctions;
			expect(shouldContinueOnFail(context)).toBe(false);
		});

		it('should return continueOnFail value when function exists', () => {
			const context = {
				continueOnFail: jest.fn(() => true),
			} as unknown as IExecuteFunctions;
			expect(shouldContinueOnFail(context)).toBe(true);
		});
	});
});
