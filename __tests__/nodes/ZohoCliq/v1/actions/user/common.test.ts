import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	TINY_AVIF_BASE64,
	TINY_AVIF_COMPATIBLE_BRAND_BASE64,
	TINY_PNG_BASE64,
} from '../../../../../helpers/base64Images';

import {
	appendWarningsToResponse,
	buildUserContinueOnFailError,
	ensureSafeUserObject,
	getUserCustomFieldRecoverableMessageMappings,
	getUserIdentifierRecoverableMessageMappings,
	isUserAiErrorModeEnabled,
	parseIdList,
	parseUserFieldsQueryParam,
	pushUserRecoverableError,
	sanitizeImageDataBase64,
	sanitizeOptionalString,
	sanitizeStrictId,
	shouldRunUserRecoverablePreflight,
	shouldContinueOnFail,
	USER_ALLOWED_FIELDS_WITH_ALL,
	USER_ALLOWED_INPUT_MODES,
	USER_ALLOWED_LAYOUT_UNIQUE_NAMES,
	USER_ALLOWED_PLAN_TYPES,
	USER_ALLOWED_SORT_BY,
	USER_ALLOWED_STATUSES,
	validateCustomFieldKey,
	validateUserInputMode,
} from '../../../../../../nodes/ZohoCliq/v1/actions/user/common';

describe('ZohoCliq - User Common Helpers', () => {
	let mockContext: IExecuteFunctions;

	beforeEach(() => {
		mockContext = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	it('should expose allowed options constants', () => {
		expect(USER_ALLOWED_STATUSES).toContain('active');
		expect(USER_ALLOWED_PLAN_TYPES).toContain('paid');
		expect(USER_ALLOWED_SORT_BY).toContain('usage');
		expect(USER_ALLOWED_LAYOUT_UNIQUE_NAMES).toContain('profile_details_web');
		expect(USER_ALLOWED_FIELDS_WITH_ALL).toContain('all');
		expect(USER_ALLOWED_INPUT_MODES).toEqual(['structured', 'raw']);
	});

	it('should parse valid comma-separated IDs', () => {
		expect(parseIdList(mockContext, 'A1,B_2,C-3', 'team ID', 0)).toEqual(['A1', 'B_2', 'C-3']);
	});

	it('should detect continueOnFail only when the callback exists and returns true', () => {
		expect(shouldContinueOnFail(mockContext)).toBe(false);
		expect(
			shouldContinueOnFail({
				...mockContext,
				continueOnFail: jest.fn(() => true),
			} as unknown as IExecuteFunctions),
		).toBe(true);
	});

	it('should detect when user recoverable preflights should run', () => {
		expect(shouldRunUserRecoverablePreflight(mockContext)).toBe(false);
		expect(
			shouldRunUserRecoverablePreflight({
				...mockContext,
				continueOnFail: jest.fn(() => true),
			} as unknown as IExecuteFunctions),
		).toBe(true);
		expect(
			shouldRunUserRecoverablePreflight({
				...mockContext,
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: { enableAiErrorMode: 'true' },
				})),
			} as unknown as IExecuteFunctions),
		).toBe(true);
	});

	it('should return false when user recoverable preflight fallback context is unavailable or invalid', () => {
		expect(
			shouldRunUserRecoverablePreflight({
				...mockContext,
				getNode: undefined,
			} as unknown as IExecuteFunctions),
		).toBe(false);
		expect(
			shouldRunUserRecoverablePreflight({
				...mockContext,
				getNode: jest.fn(() => undefined),
			} as unknown as IExecuteFunctions),
		).toBe(false);
		expect(
			shouldRunUserRecoverablePreflight({
				...mockContext,
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: [],
				})),
			} as unknown as IExecuteFunctions),
		).toBe(false);
		expect(
			shouldRunUserRecoverablePreflight({
				...mockContext,
				getNode: jest.fn(() => {
					throw new Error('boom');
				}),
			} as unknown as IExecuteFunctions),
		).toBe(false);
	});

	it('should expose stable user identifier recoverable message mappings', () => {
		const mappings = getUserIdentifierRecoverableMessageMappings();
		expect(mappings).toHaveLength(3);
		expect(
			mappings[1]?.match('invalid user id format', 'Invalid User ID format', undefined, undefined),
		).toBe(true);

		const notFoundError = new NodeOperationError(
			{ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' } as never,
			'No Zoho Cliq user found for User ID / Email / ZUID "missing@example.com".',
			{
				description:
					'Use List_users_in_Zoho_Cliq to discover valid user IDs, email addresses, or ZUIDs before retrying.',
			},
		);
		(notFoundError as NodeOperationError & { code?: string }).code = 'USER_NOT_FOUND';
		expect(
			mappings[2]?.match(
				'no zoho cliq user found for user id / email / zuid',
				'No Zoho Cliq user found for user ID / email / zuid',
				notFoundError,
				404,
			),
		).toBe(true);
	});

	it('should allow overriding the not-found hint for user identifier recoverable mappings', () => {
		const mappings = getUserIdentifierRecoverableMessageMappings({
			notFoundHint: 'Use a custom lookup hint.',
		});

		expect(mappings[2]?.hint).toBe('Use a custom lookup hint.');
		expect(
			mappings[2]?.match(
				'no zoho cliq user found for user id / email / zuid',
				'No Zoho Cliq user found for User ID / Email / ZUID "missing@example.com".',
				undefined,
				404,
			),
		).toBe(true);
	});

	it('should not treat raw endpoint text as USER_NOT_FOUND outside shared preflight', () => {
		const mappings = getUserIdentifierRecoverableMessageMappings();

		expect(
			mappings[2]?.match('request url is invalid', 'Request URL is invalid', undefined, 400),
		).toBe(false);
		expect(mappings[2]?.match('user not found', 'User not found', undefined, 404)).toBe(false);
	});

	it('should allow invalid-format user identifiers to reuse the USER_NOT_FOUND shape', () => {
		const mappings = getUserIdentifierRecoverableMessageMappings({
			identifier: 'invalid user id!',
			treatInvalidFormatAsNotFound: true,
		});

		expect(mappings[1]?.reason).toBe('USER_NOT_FOUND');
		expect(
			typeof mappings[1]?.messageOverride === 'string'
				? mappings[1]?.messageOverride
				: mappings[1]?.messageOverride?.(
						'invalid user id format',
						'Invalid User ID format',
						undefined,
						undefined,
					),
		).toContain('invalid user id!');
	});

	it('should expose custom field recoverable mappings and safely no-op when the extra-key message cannot be parsed', () => {
		const mappings = getUserCustomFieldRecoverableMessageMappings(['fake_custom_field']);
		expect(mappings).toHaveLength(1);

		const mapping = mappings[0];
		expect(
			mapping?.match(
				"'fake_custom_field' is an extra key in the json object.",
				"'fake_custom_field' is an extra key in the JSON Object.",
				undefined,
				400,
			),
		).toBe(true);
		expect(mapping?.reason).toBe('INVALID_CUSTOM_FIELD');
		expect(
			typeof mapping?.hint === 'function'
				? mapping.hint('ignored', 'ignored', undefined, 400)
				: mapping?.hint,
		).toContain('If available, use Retrieve_all_user_field_schema_definitions_in_Zoho_Cliq');
		expect(
			typeof mapping?.messageOverride === 'function'
				? mapping.messageOverride('ignored', 'not the expected format', undefined, 400)
				: mapping?.messageOverride,
		).toBeUndefined();
		expect(
			mapping?.payloadFields?.('ignored', 'not the expected format', undefined, 400),
		).toBeUndefined();
	});

	it('should match custom field recoverable mappings when the extra-key message is embedded in larger error text', () => {
		const mapping = getUserCustomFieldRecoverableMessageMappings(['fake_custom_field'])[0];
		expect(
			mapping?.match(
				"bad request 'fake_custom_field' is an extra key in the json object. request failed",
				"Bad request: 'fake_custom_field' is an extra key in the JSON Object. Request failed.",
				undefined,
				400,
			),
		).toBe(true);
		expect(
			typeof mapping?.messageOverride === 'function'
				? mapping.messageOverride(
						'ignored',
						"Bad request: 'fake_custom_field' is an extra key in the JSON Object. Request failed.",
						undefined,
						400,
					)
				: mapping?.messageOverride,
		).toBe("Custom field 'fake_custom_field' does not exist in this organization.");
		expect(
			mapping?.payloadFields?.(
				'ignored',
				"Bad request: 'fake_custom_field' is an extra key in the JSON Object. Request failed.",
				undefined,
				400,
			),
		).toEqual({ custom_field: 'fake_custom_field' });
	});

	it('should throw for invalid ID format', () => {
		expect(() => parseIdList(mockContext, 'bad id', 'team ID', 0)).toThrow(
			'Invalid team ID format',
		);
	});

	it('should sanitize optional strings and strict IDs', () => {
		expect(sanitizeOptionalString(mockContext, '  value  ', 'Field', 0, 10)).toBe('value');
		expect(sanitizeOptionalString(mockContext, '   ', 'Field', 0, 10)).toBeUndefined();
		expect(sanitizeOptionalString(mockContext, undefined, 'Field', 0, 10)).toBeUndefined();
		expect(sanitizeStrictId(mockContext, 'abc_123', 'Role ID', 0)).toBe('abc_123');
		expect(sanitizeStrictId(mockContext, '   ', 'Role ID', 0)).toBeUndefined();
		expect(() => sanitizeStrictId(mockContext, 'bad id', 'Role ID', 0)).toThrow(
			'Invalid Role ID format',
		);
	});

	it('should validate supported user input modes', () => {
		expect(validateUserInputMode(mockContext, 'structured', 0)).toBe('structured');
		expect(validateUserInputMode(mockContext, ' raw ', 0)).toBe('raw');
		expect(
			validateUserInputMode(mockContext, ' agentTool ', 0, ['structured', 'agentTool', 'raw']),
		).toBe('agentTool');
		expect(() => validateUserInputMode(mockContext, 'legacy', 0)).toThrow(
			'Input Mode must be one of: structured, raw',
		);
		expect(() =>
			validateUserInputMode(mockContext, 'legacy', 0, ['structured', 'agentTool', 'raw']),
		).toThrow('Input Mode must be one of: structured, agentTool, raw');
		expect(() => validateUserInputMode(mockContext, undefined, 0)).toThrow(
			'Input Mode must be one of: structured, raw',
		);
	});

	it('should reject optional strings longer than the max length', () => {
		expect(() => sanitizeOptionalString(mockContext, 'toolongvalue', 'Field', 0, 5)).toThrow(
			'Field is too long',
		);
	});

	it('should return an empty parsed ID list when input only has separators', () => {
		expect(parseIdList(mockContext, ' ,  , ', 'team ID', 0)).toEqual([]);
	});

	it('should sanitize and validate image_data base64', () => {
		expect(sanitizeImageDataBase64(mockContext, TINY_PNG_BASE64, 0)).toBe(TINY_PNG_BASE64);
		expect(
			sanitizeImageDataBase64(
				mockContext,
				`data:image/png;charset=utf-8;base64,${TINY_PNG_BASE64}`,
				0,
			),
		).toBe(TINY_PNG_BASE64);
		expect(sanitizeImageDataBase64(mockContext, TINY_AVIF_BASE64, 0)).toBe(TINY_AVIF_BASE64);
		expect(sanitizeImageDataBase64(mockContext, TINY_AVIF_COMPATIBLE_BRAND_BASE64, 0)).toBe(
			TINY_AVIF_COMPATIBLE_BRAND_BASE64,
		);
		expect(
			sanitizeImageDataBase64(
				mockContext,
				`${TINY_PNG_BASE64.slice(0, 20)}\n${TINY_PNG_BASE64.slice(20)}`,
				0,
			),
		).toBe(TINY_PNG_BASE64);
		expect(sanitizeImageDataBase64(mockContext, '', 0)).toBeUndefined();
		expect(sanitizeImageDataBase64(mockContext, null, 0)).toBeUndefined();
		expect(() => sanitizeImageDataBase64(mockContext, 'invalid-***', 0)).toThrow(
			'Image Data must be a valid base64-encoded string',
		);
		expect(() =>
			sanitizeImageDataBase64(mockContext, Buffer.from('not-an-image').toString('base64'), 0),
		).toThrow('Image Data must decode to a supported image file');
		expect(() => sanitizeImageDataBase64(mockContext, TINY_PNG_BASE64, 0, 'Image Data', 3)).toThrow(
			'Image Data is too long',
		);
	});

	it('should reject non-image base64 data even when the alphabet is valid', () => {
		expect(() => sanitizeImageDataBase64(mockContext, 'QmFzZTY0', 0)).toThrow(
			'Image Data must decode to a supported image file',
		);
	});

	it('should validate custom field keys', () => {
		expect(() => validateCustomFieldKey(mockContext, 'workplace_name', 0)).not.toThrow();
		expect(() => validateCustomFieldKey(mockContext, '__proto__', 0)).toThrow('Unsafe key');
		expect(() => validateCustomFieldKey(mockContext, '1bad', 0)).toThrow(
			'Invalid custom field name',
		);
	});

	it('should handle scalar and null user fields inputs', () => {
		expect(() => parseUserFieldsQueryParam(mockContext, 42, 0)).toThrow(
			'Invalid fields value "42"',
		);
		expect(parseUserFieldsQueryParam(mockContext, null, 0)).toBe('all');
	});

	it('should normalize valid array and CSV user field inputs', () => {
		expect(
			parseUserFieldsQueryParam(mockContext, [' display_name ', 'mobile', 'display_name'], 0),
		).toBe('display_name,mobile');
		expect(parseUserFieldsQueryParam(mockContext, ' department , designation ', 0)).toBe(
			'department,designation',
		);
	});

	it('should reject unsafe nested object keys', () => {
		expect(() =>
			ensureSafeUserObject(mockContext, { safe: { constructor: 'x' } }, 0, 'payload'),
		).toThrow('Unsafe key "constructor" is not allowed in payload.safe');
	});

	it('should recurse through arrays and ignore scalar user objects safely', () => {
		expect(() =>
			ensureSafeUserObject(mockContext, [{ safe: true }, { alsoSafe: { ok: true } }], 0, 'payload'),
		).not.toThrow();
		expect(() => ensureSafeUserObject(mockContext, 'text', 0, 'payload')).not.toThrow();
	});

	it('should append warnings to both object and scalar responses', () => {
		expect(
			appendWarningsToResponse({ id: '163315760' }, [
				{ code: 'IGNORED_FIELD', message: 'Skipped empty input' },
			]),
		).toEqual({
			id: '163315760',
			_warnings: [{ code: 'IGNORED_FIELD', message: 'Skipped empty input' }],
		});
		expect(
			appendWarningsToResponse('ok', [{ code: 'PARTIAL', message: 'Converted response' }]),
		).toEqual({
			data: 'ok',
			_warnings: [{ code: 'PARTIAL', message: 'Converted response' }],
		});
	});

	it('should return the original normalized response when no warnings are provided', () => {
		expect(appendWarningsToResponse({ id: '163315760' }, [])).toEqual({ id: '163315760' });
		expect(appendWarningsToResponse('ok', [])).toEqual({ data: 'ok' });
	});

	it('should preserve existing warnings when appending additional warnings', () => {
		expect(
			appendWarningsToResponse(
				{
					id: '163315760',
					_warnings: [{ code: 'FIRST', message: 'Existing warning' }],
				},
				[{ code: 'SECOND', message: 'New warning' }],
			),
		).toEqual({
			id: '163315760',
			_warnings: [
				{ code: 'FIRST', message: 'Existing warning' },
				{ code: 'SECOND', message: 'New warning' },
			],
		});
	});

	it('should build continueOnFail payload from scope payload when present', () => {
		const payload = buildUserContinueOnFailError({
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'user',
				operation: 'update',
			},
		});

		expect(payload).toEqual({
			success: false,
			resource: 'user',
			operation: 'update',
		});
	});

	it('should build continueOnFail payload from standard error', () => {
		const payload = buildUserContinueOnFailError(new Error('boom'));
		expect(payload).toEqual(
			expect.objectContaining({
				success: false,
				error: 'boom',
				details: {},
			}),
		);
	});

	it('should include HTTP and Zoho error details in continueOnFail payload', () => {
		const payload = buildUserContinueOnFailError({
			message: 'Request failed',
			response: {
				status: 400,
				data: {
					error: 'invalid_request',
					message: 'Invalid payload',
					code: 1001,
					error_code: 'USR_001',
					status: 'failure',
				},
			},
		});

		expect(payload).toEqual({
			success: false,
			error: 'An unexpected issue occurred',
			details: {
				statusCode: 400,
				message: 'Invalid payload',
				code: 1001,
				error_code: 'USR_001',
				status: 'failure',
			},
		});
	});

	it('should keep empty details when response shape is not a Zoho error payload', () => {
		const payload = buildUserContinueOnFailError({
			response: {
				status: 500,
				data: {
					message: 'not-zoho-shape',
				},
			},
		});

		expect(payload).toEqual({
			success: false,
			error: 'An unexpected issue occurred',
			details: {
				statusCode: 500,
			},
		});
	});

	it('should handle non-object errors gracefully', () => {
		const payload = buildUserContinueOnFailError('plain string error');

		expect(payload).toEqual({
			success: false,
			error: 'An unexpected issue occurred',
			details: {},
		});
	});

	it('should use fallback message when Error has an empty message', () => {
		const payload = buildUserContinueOnFailError(new Error(''));

		expect(payload).toEqual({
			success: false,
			error: 'An unexpected issue occurred',
			details: {},
		});
	});

	it('should include numeric/string variants for Zoho error detail fields', () => {
		const payload = buildUserContinueOnFailError({
			response: {
				status: 422,
				data: {
					error: 'invalid_request',
					message: 'Bad request',
					code: 'USR_CODE',
					error_code: 9001,
					status: 0,
				},
			},
		});

		expect(payload).toEqual({
			success: false,
			error: 'An unexpected issue occurred',
			details: {
				statusCode: 422,
				message: 'Bad request',
				code: 'USR_CODE',
				error_code: 9001,
				status: 0,
			},
		});
	});

	it('should ignore Zoho error detail fields when value types are unsupported', () => {
		const payload = buildUserContinueOnFailError({
			response: {
				status: 409,
				data: {
					error: 'conflict',
					message: 12345,
					code: true,
					error_code: { nested: 'bad' },
					status: null,
				},
			},
		});

		expect(payload).toEqual({
			success: false,
			error: 'An unexpected issue occurred',
			details: {
				statusCode: 409,
			},
		});
	});

	describe('AI Error Mode + recoverable errors', () => {
		const createRecoverableContext = (
			values: {
				enableAiErrorMode?: unknown;
				continueOnFail?: boolean;
			} = {},
		): IExecuteFunctions => {
			const { enableAiErrorMode = false, continueOnFail = false } = values;

			return {
				getNodeParameter: jest.fn(
					(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
						if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
						return fallback;
					},
				),
				continueOnFail: jest.fn(() => continueOnFail),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: { enableAiErrorMode },
				})),
			} as unknown as IExecuteFunctions;
		};

		it('should detect AI Error Mode from node parameter or persisted node settings', () => {
			expect(
				isUserAiErrorModeEnabled(createRecoverableContext({ enableAiErrorMode: 'true' }), 0),
			).toBe(true);
			expect(
				isUserAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNodeParameter: jest.fn(() => {
							throw new Error('not available');
						}),
						getNode: jest.fn(() => ({
							name: 'Test Node',
							type: 'n8n-nodes-base.zohoCliq',
							parameters: { enableAiErrorMode: 'true' },
						})),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(true);
			expect(isUserAiErrorModeEnabled(createRecoverableContext(), 0)).toBe(false);
		});

		it('should return false when getNode is unavailable, invalid, or throws', () => {
			expect(
				isUserAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNodeParameter: jest.fn(() => {
							throw new Error('unavailable');
						}),
						getNode: jest.fn(() => undefined),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
			expect(
				isUserAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNodeParameter: jest.fn(() => {
							throw new Error('unavailable');
						}),
						getNode: undefined,
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
			expect(
				isUserAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNodeParameter: jest.fn(() => {
							throw new Error('unavailable');
						}),
						getNode: jest.fn(() => ({
							name: 'Test Node',
							type: 'n8n-nodes-base.zohoCliq',
							parameters: [],
						})),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
			expect(
				isUserAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNodeParameter: jest.fn(() => {
							throw new Error('unavailable');
						}),
						getNode: jest.fn(() => {
							throw new Error('boom');
						}),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
		});

		it('should return false without continueOnFail or AI Error Mode', () => {
			const context = createRecoverableContext();
			const returnData: INodeExecutionData[] = [];

			expect(pushUserRecoverableError(context, returnData, 0, 'get', new Error('boom'))).toBe(
				false,
			);
			expect(returnData).toEqual([]);
		});

		it('should preserve scope payloads and merge context fields', () => {
			const context = createRecoverableContext({ enableAiErrorMode: 'true' });
			const returnData: INodeExecutionData[] = [];

			const handled = pushUserRecoverableError(
				context,
				returnData,
				0,
				'get',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						resource: 'user',
						operation: 'get',
						requiredScopes: ['ZohoCliq.Users.READ'],
						missingScopes: ['ZohoCliq.Users.READ'],
					},
				},
				{
					contextFields: { user_id: 'user@example.com' },
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'get',
					requiredScopes: ['ZohoCliq.Users.READ'],
					missingScopes: ['ZohoCliq.Users.READ'],
					user_id: 'user@example.com',
				}),
			);
		});

		it('should preserve scope payloads without adding extra context fields when none are provided', () => {
			const context = createRecoverableContext({ enableAiErrorMode: 'true' });
			const returnData: INodeExecutionData[] = [];

			const handled = pushUserRecoverableError(context, returnData, 0, 'get', {
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'user',
					operation: 'get',
					requiredScopes: ['ZohoCliq.Users.READ'],
					missingScopes: ['ZohoCliq.Users.READ'],
				},
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'get',
					requiredScopes: ['ZohoCliq.Users.READ'],
					missingScopes: ['ZohoCliq.Users.READ'],
				}),
			);
			expect(returnData[0].json).not.toHaveProperty('user_id');
		});

		it('should build a recoverable payload when continueOnFail is enabled', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			const handled = pushUserRecoverableError(
				context,
				returnData,
				0,
				'getTeams',
				{ statusCode: 404, message: 'Not Found' },
				{
					contextFields: { user_id: 'user@example.com' },
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'getTeams',
					user_id: 'user@example.com',
					status_code: 404,
					reason: 'NOT_FOUND',
				}),
			);
		});

		it('should honor caller-supplied message mappings for recoverable payloads', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];
			const sharedNotFoundError = new NodeOperationError(
				{ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' } as never,
				'No Zoho Cliq user found for User ID / Email / ZUID "missing.user@example.com".',
			);
			(sharedNotFoundError as NodeOperationError & { code?: string }).code = 'USER_NOT_FOUND';

			pushUserRecoverableError(context, returnData, 0, 'get', sharedNotFoundError, {
				contextFields: { user_id: 'missing.user@example.com' },
				messageMappings: getUserIdentifierRecoverableMessageMappings(),
			});

			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'get',
					user_id: 'missing.user@example.com',
					reason: 'USER_NOT_FOUND',
				}),
			);
		});

		it('should fall back to generic BAD_REQUEST when raw endpoint text is not backed by shared preflight', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			pushUserRecoverableError(
				context,
				returnData,
				0,
				'update',
				{
					message: 'Request URL is invalid',
					response: { statusCode: 400 },
				},
				{
					contextFields: { user_id: 'missing.user@example.com' },
					messageMappings: getUserIdentifierRecoverableMessageMappings(),
				},
			);

			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'update',
					user_id: 'missing.user@example.com',
					reason: 'BAD_REQUEST',
				}),
			);
		});

		it('should ignore invalid scope payload shapes and fall back to generic recoverable errors', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			pushUserRecoverableError(context, returnData, 0, 'list', {
				zohoCliqScopeErrorPayload: ['bad-scope-payload'],
				statusCode: 400,
				message: 'Bad Request',
			});

			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'list',
					status_code: 400,
					reason: 'BAD_REQUEST',
				}),
			);
		});

		it('should build a generic recoverable payload when the error is undefined', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			pushUserRecoverableError(context, returnData, 0, 'listLayouts', undefined, {
				fallbackMessage: 'Fallback user error',
			});

			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'listLayouts',
					message: 'Fallback user error',
				}),
			);
		});
	});
});
