import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	ensureSafeObject,
	isDepartmentAiErrorModeEnabled,
	parseDelimitedIds,
	parseFlexibleUserIdsInput,
	parseDepartmentMemberIdentifiers,
	parseDepartmentPayloadInput,
	pushDepartmentRecoverableError,
	resolveDepartmentEnhancedOutput,
	validateDepartmentId,
	validateDepartmentInputMode,
	validateDepartmentPayload,
} from '../../../../../../nodes/ZohoCliq/v1/actions/department/common';
import {
	runDepartmentEmailsPreflightGate,
	runDepartmentLookupPreflightGate,
	runDepartmentMemberIdentifiersPreflightGate,
	runDepartmentUsersPreflightGate,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

async function validateDepartmentExistsIfPossible(
	context: IExecuteFunctions,
	departmentId: string,
	itemIndex: number,
	grantedScopes: string,
	options: {
		fieldLabel?: string;
	} = {},
): Promise<void> {
	if (!departmentId) {
		return;
	}

	await runDepartmentLookupPreflightGate(context, itemIndex, grantedScopes, departmentId, options);
}

describe('ZohoCliq - Department - common helpers', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			enableAiErrorMode?: unknown;
			includeEnhancedOutput?: boolean;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			enableAiErrorMode = false,
			includeEnhancedOutput = true,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					if (parameterName === 'includeEnhancedOutput') return includeEnhancedOutput;
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

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	describe('validateDepartmentId', () => {
		it('should trim and return valid department ID', () => {
			const result = validateDepartmentId(createContext(), '  dept_123-abc  ', 0);
			expect(result).toBe('dept_123-abc');
		});

		it('should throw for empty department ID', () => {
			expect(() => validateDepartmentId(createContext(), '', 0)).toThrow(NodeOperationError);
			expect(() => validateDepartmentId(createContext(), '   ', 0)).toThrow(
				'Department ID is required',
			);
		});

		it('should throw for invalid department ID format', () => {
			expect(() => validateDepartmentId(createContext(), 'dept/id', 0)).toThrow(
				'Invalid Department ID format',
			);
		});

		it('should throw for department ID longer than 200 chars', () => {
			expect(() => validateDepartmentId(createContext(), 'a'.repeat(201), 0)).toThrow(
				'Maximum length is 200 characters',
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined', () => {
			expect(() => ensureSafeObject(createContext(), null, 0, 'payload')).not.toThrow();
			expect(() => ensureSafeObject(createContext(), undefined, 0, 'payload')).not.toThrow();
		});

		it('should throw when value is not object', () => {
			expect(() => ensureSafeObject(createContext(), 'bad', 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when value is an array', () => {
			expect(() => ensureSafeObject(createContext(), [], 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when unsafe top-level key is present', () => {
			const payload = { constructor: 'bad' } as unknown as IDataObject;
			expect(() => ensureSafeObject(createContext(), payload, 0, 'payload')).toThrow(
				'Unsafe key "constructor" is not allowed',
			);
		});

		it('should throw when unsafe nested key is present', () => {
			const payload = {
				config: {
					prototype: 'bad',
				},
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(createContext(), payload, 0, 'payload')).toThrow(
				'Unsafe key "prototype" is not allowed',
			);
		});

		it('should throw when unsafe nested array object key is present', () => {
			const parsedUnsafe = JSON.parse('{"__proto__":"blocked"}') as IDataObject;
			const payload = { items: [{ ok: true }, parsedUnsafe] } as unknown as IDataObject;

			expect(() => ensureSafeObject(createContext(), payload, 0, 'payload')).toThrow(
				'Unsafe key "__proto__" is not allowed',
			);
		});

		it('should allow safe nested structures', () => {
			const payload = {
				name: 'Engineering',
				meta: { region: 'US', tags: [{ key: 'core' }] },
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(createContext(), payload, 0, 'payload')).not.toThrow();
		});
	});

	describe('validateDepartmentPayload', () => {
		it('should return normalized payload', () => {
			const payload: IDataObject = {
				name: '  Engineering  ',
				description: '  Platform team  ',
			};

			const result = validateDepartmentPayload(
				createContext(),
				payload,
				0,
				'Department Definition',
			);

			expect(result).toEqual({
				name: 'Engineering',
				description: 'Platform team',
			});
		});

		it('should throw for null payload', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					null as unknown as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('Department Definition cannot be empty');
		});

		it('should throw for empty payload when allowEmpty is false', () => {
			expect(() => validateDepartmentPayload(createContext(), {}, 0, 'Department Updates')).toThrow(
				'Department Updates cannot be empty',
			);
		});

		it('should allow empty payload when allowEmpty is true', () => {
			const result = validateDepartmentPayload(createContext(), {}, 0, 'Department Updates', {
				allowEmpty: true,
			});
			expect(result).toEqual({});
		});

		it('should require name when requireName is true', () => {
			expect(() =>
				validateDepartmentPayload(createContext(), { name: '   ' }, 0, 'Department Definition', {
					requireName: true,
				}),
			).toThrow('Department name is required');
		});

		it('should throw when name is null and validation touches the name field', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: null } as unknown as IDataObject,
					0,
					'Department Definition',
					{
						allowEmpty: true,
					},
				),
			).toThrow('Department name is required');
		});

		it('should require lead zuid when requested', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering' },
					0,
					'Department Definition',
					{
						requireLeadZuid: true,
					},
				),
			).toThrow('Lead ZUID is required');
		});

		it('should require parent department id when requested', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', lead_zuid: '123456789' },
					0,
					'Department Definition',
					{
						requireParentDepartmentId: true,
					},
				),
			).toThrow('Parent Department ID is required');
		});

		it('should throw when name exceeds max length', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'a'.repeat(121) } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('Department name is too long. Maximum length is 120 characters.');
		});

		it('should drop empty description', () => {
			const result = validateDepartmentPayload(
				createContext(),
				{ name: 'Engineering', description: '   ' } as IDataObject,
				0,
				'Department Definition',
			);

			expect(result).toEqual({ name: 'Engineering' });
		});

		it('should throw when description exceeds max length', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ description: 'a'.repeat(1001) } as IDataObject,
					0,
					'Department Updates',
				),
			).toThrow('Description is too long. Maximum length is 1000 characters.');
		});

		it('should validate lead_zuid and user_ids', () => {
			const payload: IDataObject = {
				name: 'Engineering',
				lead_zuid: '123456789',
				user_ids: ['987654321', '112233445'],
			};

			const result = validateDepartmentPayload(
				createContext(),
				payload,
				0,
				'Department Definition',
			);

			expect(result).toEqual({
				name: 'Engineering',
				lead_zuid: '123456789',
				user_ids: ['987654321', '112233445'],
			});
		});

		it('should throw when user_ids is not an array', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', user_ids: '987654321' as unknown as string[] } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('user_ids must be an array of strings');
		});

		it('should throw when user_ids is an empty array', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', user_ids: [] } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('user_ids cannot be empty');
		});

		it('should validate parent_department_id', () => {
			const payload: IDataObject = {
				name: 'Engineering',
				parent_department_id: 'dept_parent_1',
			};

			const result = validateDepartmentPayload(createContext(), payload, 0, 'Department Updates');

			expect(result).toEqual({
				name: 'Engineering',
				parent_department_id: 'dept_parent_1',
			});
		});

		it('should allow payloads that do not include a name when name is not required', () => {
			const payload: IDataObject = {
				lead_zuid: '123456789',
			};

			const result = validateDepartmentPayload(createContext(), payload, 0, 'Department Updates', {
				allowEmpty: true,
			});

			expect(result).toEqual({
				lead_zuid: '123456789',
			});
		});

		it('should reject unsupported fields when allowedFields is provided', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', description: 'Nope' } as IDataObject,
					0,
					'Department Updates',
					{
						allowedFields: ['name', 'lead_zuid', 'user_ids', 'parent_department_id'],
					},
				),
			).toThrow('contains unsupported field "description"');
		});
	});

	describe('parseDepartmentPayloadInput', () => {
		it('should throw for null payload input', () => {
			expect(() =>
				parseDepartmentPayloadInput(createContext(), null, 0, 'Department Definition'),
			).toThrow('Department Definition cannot be empty');
		});

		it('should throw for empty string payload input', () => {
			expect(() =>
				parseDepartmentPayloadInput(createContext(), '   ', 0, 'Department Definition'),
			).toThrow('Department Definition cannot be empty');
		});

		it('should parse stringified JSON object', () => {
			const result = parseDepartmentPayloadInput(
				createContext(),
				'{"name":"Engineering"}',
				0,
				'Department Definition',
			);

			expect(result).toEqual({ name: 'Engineering' });
		});

		it('should throw for invalid JSON string', () => {
			expect(() =>
				parseDepartmentPayloadInput(
					createContext(),
					'{"name":"Engineering"',
					0,
					'Department Definition',
				),
			).toThrow('must be a valid JSON object when provided as text');
		});

		it('should throw when JSON string is not an object', () => {
			expect(() =>
				parseDepartmentPayloadInput(createContext(), '[]', 0, 'Department Definition'),
			).toThrow('Department Definition must be a JSON object');
		});

		it('should accept direct object payload input', () => {
			const payload = { name: 'Engineering' } as IDataObject;
			const result = parseDepartmentPayloadInput(
				createContext(),
				payload,
				0,
				'Department Definition',
			);

			expect(result).toEqual({ name: 'Engineering' });
		});
	});

	describe('parseDelimitedIds', () => {
		it('should throw when parseDelimitedIds receives a non-string value', () => {
			expect(() => parseDelimitedIds(createContext(), 42, 0, 'User IDs')).toThrow(
				'User IDs must be a string containing comma-separated IDs',
			);
		});

		it('should parse and trim comma separated IDs', () => {
			const result = parseDelimitedIds(createContext(), ' 123 , 456 ,789 ', 0, 'User IDs');

			expect(result).toEqual(['123', '456', '789']);
		});

		it('should throw when no IDs are provided', () => {
			expect(() => parseDelimitedIds(createContext(), ' ,  , ', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
		});
	});

	describe('parseFlexibleUserIdsInput', () => {
		it('should accept literal arrays, JSON array strings, and CSV strings', () => {
			expect(parseFlexibleUserIdsInput(createContext(), ['123', '456'], 0, 'User IDs')).toEqual([
				'123',
				'456',
			]);
			expect(parseFlexibleUserIdsInput(createContext(), '["123","456"]', 0, 'User IDs')).toEqual([
				'123',
				'456',
			]);
			expect(parseFlexibleUserIdsInput(createContext(), '123,456', 0, 'User IDs')).toEqual([
				'123',
				'456',
			]);
		});

		it('should reject empty arrays, blank strings, and unsupported input types', () => {
			expect(() => parseFlexibleUserIdsInput(createContext(), [], 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
			expect(() => parseFlexibleUserIdsInput(createContext(), '   ', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
			expect(() => parseFlexibleUserIdsInput(createContext(), 1, 0, 'User IDs')).toThrow(
				'User IDs must be either a JSON array of user IDs or a comma-separated string of user IDs',
			);
		});

		it('should reject invalid JSON array forms', () => {
			expect(() => parseFlexibleUserIdsInput(createContext(), '["123",]', 0, 'User IDs')).toThrow(
				'User IDs must be a valid JSON array when provided in array form',
			);
			const parseSpy = jest.spyOn(JSON, 'parse').mockReturnValueOnce({ id: '123' } as unknown);
			try {
				expect(() =>
					parseFlexibleUserIdsInput(createContext(), '[forced-non-array]', 0, 'User IDs'),
				).toThrow('User IDs must be a JSON array of user IDs when provided in array form');
			} finally {
				parseSpy.mockRestore();
			}
			expect(() => parseFlexibleUserIdsInput(createContext(), '[]', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
		});
	});

	describe('validateDepartmentInputMode', () => {
		it('should allow structured and raw input modes', () => {
			expect(validateDepartmentInputMode(createContext(), 'structured', 0)).toBe('structured');
			expect(validateDepartmentInputMode(createContext(), 'raw', 0)).toBe('raw');
		});

		it('should reject unsupported input modes', () => {
			expect(() => validateDepartmentInputMode(createContext(), 'invalid', 0)).toThrow(
				'Input Mode must be either "structured" or "raw"',
			);
		});
	});

	describe('parseDepartmentMemberIdentifiers', () => {
		it('should parse email identifiers', () => {
			const result = parseDepartmentMemberIdentifiers(
				createContext(),
				'amy@example.com, ben@example.com ',
				0,
			);

			expect(result).toEqual({
				identifierType: 'email_ids',
				identifiers: ['amy@example.com', 'ben@example.com'],
			});
		});

		it('should parse user identifiers', () => {
			const result = parseDepartmentMemberIdentifiers(createContext(), '123, 456', 0);

			expect(result).toEqual({
				identifierType: 'user_ids',
				identifiers: ['123', '456'],
			});
		});

		it('should parse literal arrays and JSON array strings for both email and user identifiers', () => {
			expect(
				parseDepartmentMemberIdentifiers(
					createContext(),
					['amy@example.com', 'ben@example.com'],
					0,
				),
			).toEqual({
				identifierType: 'email_ids',
				identifiers: ['amy@example.com', 'ben@example.com'],
			});
			expect(parseDepartmentMemberIdentifiers(createContext(), '["123","456"]', 0)).toEqual({
				identifierType: 'user_ids',
				identifiers: ['123', '456'],
			});
		});

		it('should reject mixed identifier types', () => {
			expect(() =>
				parseDepartmentMemberIdentifiers(createContext(), 'amy@example.com,123', 0),
			).toThrow('Mixed identifier types are not supported');
		});

		it('should reject unsupported input types and invalid JSON array forms', () => {
			expect(() => parseDepartmentMemberIdentifiers(createContext(), 42, 0)).toThrow(
				'Member Identifiers must be either a JSON array of user IDs or email IDs, or a comma-separated string of identifiers',
			);
			expect(() => parseDepartmentMemberIdentifiers(createContext(), '["123",]', 0)).toThrow(
				'Member Identifiers must be a valid JSON array when provided in array form',
			);
			const parseSpy = jest.spyOn(JSON, 'parse').mockReturnValueOnce({ id: '123' } as unknown);
			try {
				expect(() =>
					parseDepartmentMemberIdentifiers(createContext(), '[forced-non-array]', 0),
				).toThrow(
					'Member Identifiers must be a JSON array of user IDs or email IDs when provided in array form',
				);
			} finally {
				parseSpy.mockRestore();
			}
		});

		it('should reject empty array-form identifier inputs', () => {
			expect(() => parseDepartmentMemberIdentifiers(createContext(), [], 0)).toThrow(
				'At least one member identifier is required',
			);
			expect(() => parseDepartmentMemberIdentifiers(createContext(), '[]', 0)).toThrow(
				'At least one member identifier is required',
			);
		});

		it('should reject empty identifiers', () => {
			expect(() => parseDepartmentMemberIdentifiers(createContext(), '   ', 0)).toThrow(
				'At least one member identifier is required',
			);
		});

		it('should reject an empty identifier string before splitting', () => {
			expect(() => parseDepartmentMemberIdentifiers(createContext(), '', 0)).toThrow(
				'Member Identifiers are required',
			);
		});
	});

	describe('validateDepartmentExistsIfPossible', () => {
		const recoverableContext = () => createContext({ continueOnFail: true });

		it('should skip department lookup when department-read scope is unavailable', async () => {
			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_123',
					0,
					'ZohoCliq.Departments.UPDATE',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should no-op when department lookup is asked to validate an empty department ID', async () => {
			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'',
					0,
					'ZohoCliq.Departments.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should accept department IDs resolved across paginated department listings', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: [{ id: 'dept_001' }],
					next_token: 'next_departments_page',
				})
				.mockResolvedValueOnce({
					data: [{ id: 'dept_123' }],
				});

			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_123',
					0,
					'ZohoCliq.Departments.READ',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/departments',
				{},
				{ limit: 100 },
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/departments',
				{},
				{ limit: 100, next_token: 'next_departments_page' },
			);
		});

		it('should accept department IDs from the response.departments shape too', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				departments: [{ id: 'dept_123' }],
			});

			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_123',
					0,
					'ZohoCliq.Departments.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should accept department IDs from the department_id field too', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ department_id: 'dept_123' }],
			});

			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_123',
					0,
					'ZohoCliq.Departments.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should reject unknown department IDs when the lookup result is exhaustive', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_missing',
					0,
					'ZohoCliq.Departments.READ',
				),
			).rejects.toThrow('No department found for Department ID "dept_missing".');
		});

		it('should accept department IDs from nested data.departments and nested data.next_token shapes', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: {
						next_token: 'departments_page_2',
					},
				})
				.mockResolvedValueOnce({
					data: {
						departments: [{ id: 'dept_123' }],
					},
				});

			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_123',
					0,
					'ZohoCliq.Departments.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should fail an active department preflight when Zoho Cliq repeats next_token', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: [{ id: 'dept_001' }],
					next_token: 'departments_page_2',
				})
				.mockResolvedValueOnce({
					data: [{ id: 'dept_002' }],
					next_token: 'departments_page_2',
				});

			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_123',
					0,
					'ZohoCliq.Departments.READ',
				),
			).rejects.toThrow('repeated next_token "departments_page_2"');
		});

		it('should fail an active department preflight when the roster lookup fails', async () => {
			mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('lookup failed'));

			await expect(
				validateDepartmentExistsIfPossible(
					recoverableContext(),
					'dept_123',
					0,
					'ZohoCliq.Departments.READ',
				),
			).rejects.toThrow(
				'The department roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});
	});

	describe('runDepartmentUsersPreflightGate', () => {
		it('should no-op when department user identifiers normalize to an empty list', async () => {
			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['', ''],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should no-op when department user identifiers are provided as a non-array value', async () => {
			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					'not-an-array' as unknown as string[],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should skip user lookup when user-read scope is unavailable', async () => {
			await expect(
				runDepartmentUsersPreflightGate(createContext(), ['123'], 0, 'ZohoCliq.Departments.UPDATE'),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when the active user lookup fails', async () => {
			mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('lookup failed'));

			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123'],
					0,
					'ZohoCliq.Users.READ',
					{ actionDescription: 'updating this department' },
				),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should accept user IDs resolved across paginated user listings', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: [{ id: '123' }],
					next_token: 'next_users_page',
				})
				.mockResolvedValueOnce({
					data: [{ user_id: '456' }],
				});

			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123', '456'],
					0,
					'ZohoCliq.Users.READ',
					{ actionDescription: 'updating this department' },
				),
			).resolves.toBeUndefined();
		});

		it('should accept user IDs resolved from the response.users shape', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				users: [{ user_id: '123' }],
			});

			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123'],
					0,
					'ZohoCliq.Users.READ',
					{ actionDescription: 'updating this department' },
				),
			).resolves.toBeUndefined();
		});

		it('should reject unresolved user IDs after user-list traversal', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ id: '123' }],
			});

			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123', 'missing_user'],
					0,
					'ZohoCliq.Users.READ',
					{ actionDescription: 'updating this department' },
				),
			).rejects.toThrow(
				'The following user IDs could not be found: ["missing_user"]. Verify them before updating this department.',
			);
		});

		it('should throw when no user array is returned during an active preflight', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({});

			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['missing_user'],
					0,
					'ZohoCliq.Users.READ',
					{ actionDescription: 'updating this department' },
				),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should use the default action description when user lookup options are omitted', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ id: 'known_user' }],
			});

			await expect(
				runDepartmentUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['missing_user'],
					0,
					'ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The following user IDs could not be found: ["missing_user"]. Verify them before continuing with this department operation.',
			);
		});
	});

	describe('runDepartmentEmailsPreflightGate', () => {
		it('should resolve email IDs from list-users responses', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: { users: [{ email_id: 'user@example.com' }] },
			});

			await expect(
				runDepartmentEmailsPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['user@example.com'],
					0,
					'ZohoCliq.Users.READ',
					{ actionDescription: 'adding department members' },
				),
			).resolves.toBeUndefined();
		});

		it('should use default email lookup options when none are provided', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ email: 'known@example.com' }],
			});

			await expect(
				runDepartmentEmailsPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['missing@example.com'],
					0,
					'ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The following email IDs could not be found: ["missing@example.com"]. Verify them before continuing with this department operation.',
			);
		});
	});

	describe('runDepartmentMemberIdentifiersPreflightGate', () => {
		it('should dispatch email identifier validation for member identifiers', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				users: [{ email: 'amy@example.com' }],
			});

			await expect(
				runDepartmentMemberIdentifiersPreflightGate(
					createContext(),
					{
						identifierType: 'email_ids',
						identifiers: ['amy@example.com'],
					},
					0,
					'ZohoCliq.Users.READ',
					{ actionDescription: 'adding department members' },
				),
			).resolves.toBeUndefined();
		});

		it('should dispatch user identifier validation for member identifiers too', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ zuid: '123' }],
			});

			await expect(
				runDepartmentMemberIdentifiersPreflightGate(
					createContext(),
					{
						identifierType: 'user_ids',
						identifiers: ['123'],
					},
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
		});
	});

	describe('isDepartmentAiErrorModeEnabled', () => {
		it('should read AI error mode from node parameters', () => {
			expect(isDepartmentAiErrorModeEnabled(createContext({ enableAiErrorMode: 'true' }), 0)).toBe(
				true,
			);
		});

		it('should return false when AI error mode is disabled', () => {
			expect(isDepartmentAiErrorModeEnabled(createContext(), 0)).toBe(false);
		});

		it('should return false when getNode is not available', () => {
			const context = {
				getNodeParameter: jest.fn(() => {
					throw new Error('parameter unavailable');
				}),
			} as unknown as IExecuteFunctions;

			expect(isDepartmentAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when node parameters are not an object', () => {
			const context = {
				getNodeParameter: jest.fn(() => {
					throw new Error('parameter unavailable');
				}),
				getNode: jest.fn(() => ({
					parameters: [],
				})),
			} as unknown as IExecuteFunctions;

			expect(isDepartmentAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNode returns undefined', () => {
			const context = {
				getNodeParameter: jest.fn(() => {
					throw new Error('parameter unavailable');
				}),
				getNode: jest.fn(() => undefined),
			} as unknown as IExecuteFunctions;

			expect(isDepartmentAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNode throws', () => {
			const context = {
				getNodeParameter: jest.fn(() => {
					throw new Error('parameter unavailable');
				}),
				getNode: jest.fn(() => {
					throw new Error('node unavailable');
				}),
			} as unknown as IExecuteFunctions;

			expect(isDepartmentAiErrorModeEnabled(context, 0)).toBe(false);
		});
	});

	describe('pushDepartmentRecoverableError', () => {
		it('should return false when recoverable mode is disabled', () => {
			const context = createContext();
			const returnData: INodeExecutionData[] = [];

			const handled = pushDepartmentRecoverableError(
				context,
				returnData,
				0,
				'get',
				new Error('fail'),
			);

			expect(handled).toBe(false);
			expect(returnData).toEqual([]);
		});

		it('should preserve scope payloads in recoverable mode', () => {
			const context = createContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			const handled = pushDepartmentRecoverableError(context, returnData, 0, 'get', {
				zohoCliqScopeErrorPayload: {
					success: false,
					requiredScopes: ['ZohoCliq.Departments.READ'],
				},
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual({
				success: false,
				requiredScopes: ['ZohoCliq.Departments.READ'],
			});
		});

		it('should merge scope payloads with context fields in recoverable mode', () => {
			const context = createContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			const handled = pushDepartmentRecoverableError(
				context,
				returnData,
				0,
				'get',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						requiredScopes: ['ZohoCliq.Departments.READ'],
					},
				},
				{
					contextFields: {
						department_id: 'dept_123',
					},
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual({
				success: false,
				requiredScopes: ['ZohoCliq.Departments.READ'],
				department_id: 'dept_123',
			});
		});

		it('should build a generic recoverable payload with context fields', () => {
			const context = createContext({ enableAiErrorMode: 'true' });
			const returnData: INodeExecutionData[] = [];

			const handled = pushDepartmentRecoverableError(
				context,
				returnData,
				0,
				'delete',
				{
					statusCode: 404,
					message: 'department_not_exist',
				},
				{
					contextFields: {
						department_id: 'dept_123',
					},
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'department',
					operation: 'delete',
					department_id: 'dept_123',
					status_code: 404,
					reason: 'NOT_FOUND',
				}),
			);
		});

		it('should build a generic recoverable payload for string errors', () => {
			const context = createContext({ enableAiErrorMode: 'true' });
			const returnData: INodeExecutionData[] = [];

			const handled = pushDepartmentRecoverableError(
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
					resource: 'department',
					operation: 'get',
					message: 'plain string failure',
				}),
			);
		});

		it('should ignore non-object scope payloads and fall back to generic recoverable output', () => {
			const context = createContext({ enableAiErrorMode: 'true' });
			const returnData: INodeExecutionData[] = [];

			const handled = pushDepartmentRecoverableError(context, returnData, 0, 'get', {
				zohoCliqScopeErrorPayload: ['invalid'],
				message: 'fallback required',
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'department',
					operation: 'get',
					message: 'fallback required',
				}),
			);
		});

		it('should fall back to the generic recoverable output when error is undefined', () => {
			const context = createContext({ enableAiErrorMode: 'true' });
			const returnData: INodeExecutionData[] = [];

			const handled = pushDepartmentRecoverableError(context, returnData, 0, 'get', undefined);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'department',
					operation: 'get',
					message: 'An unexpected issue occurred with the API request',
				}),
			);
		});
	});

	describe('resolveDepartmentEnhancedOutput', () => {
		it('should coerce minimal responses to objects and keep enhanced output enabled by default', () => {
			const result = resolveDepartmentEnhancedOutput(createContext(), 0, undefined);

			expect(result).toEqual({
				includeEnhancedOutput: true,
				rawResponse: {},
				responseJson: {},
			});
		});

		it('should coerce empty primitive responses to a data field', () => {
			const result = resolveDepartmentEnhancedOutput(
				createContext({ includeEnhancedOutput: false }),
				0,
				'',
			);

			expect(result).toEqual({
				includeEnhancedOutput: false,
				rawResponse: { data: '' },
				responseJson: { data: '' },
			});
		});
	});

	describe('validateZohoEntityId via validateDepartmentPayload', () => {
		it('should throw when lead_zuid is not a non-empty string', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', lead_zuid: 123 as unknown as string } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('Lead ZUID must be a non-empty string');
		});

		it('should throw when lead_zuid exceeds max length', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', lead_zuid: 'a'.repeat(201) } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('Lead ZUID is too long');
		});

		it('should throw when lead_zuid format is invalid', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', lead_zuid: 'bad/id' } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('Lead ZUID has an invalid format');
		});

		it('should throw when user_ids contains an invalid entry', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', user_ids: ['valid_id', 'bad/id'] } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('user_ids[1] has an invalid format');
		});

		it('should throw when parent_department_id format is invalid', () => {
			expect(() =>
				validateDepartmentPayload(
					createContext(),
					{ name: 'Engineering', parent_department_id: 'bad/id' } as IDataObject,
					0,
					'Department Definition',
				),
			).toThrow('Parent Department ID has an invalid format');
		});
	});
});
