import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildRoleContinueOnFailError,
	ensureSafeObject,
	isRoleRecoverableModeEnabled,
	isRoleAiErrorModeEnabled,
	parseDelimitedUserIds,
	parseRolePayloadInput,
	pushRoleRecoverableError,
	ROLE_NOT_FOUND_MESSAGE,
	resolveRoleEnhancedOutput,
	roleIdLocator,
	shouldContinueOnFail,
	validateProfileType,
	validateRoleId,
	validateRoleInputMode,
	validateRolePermissionUpdatePayload,
	validateRolePayload,
} from '../../../../../../nodes/ZohoCliq/v1/actions/role/common';
import {
	runRoleLookupPreflightGate,
	runRoleUsersPreflightGate,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

async function preflightRoleLookupForRecoverableMode(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	roleId: string,
): Promise<unknown | undefined> {
	const result = await runRoleLookupPreflightGate(context, itemIndex, grantedScopes, roleId);
	return result.status === 'validated' ? result.entity : undefined;
}

describe('ZohoCliq - Role - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
		mockZohoCliqApiRequest.mockReset();
	});

	describe('validateRoleId', () => {
		it('should trim and return valid role ID', () => {
			const result = validateRoleId(mockExecuteFunctions, '  role_123-abc  ', 0);
			expect(result).toBe('role_123-abc');
		});

		it('should throw for empty role ID', () => {
			expect(() => validateRoleId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateRoleId(mockExecuteFunctions, '   ', 0)).toThrow('Role ID is required');
		});

		it('should throw for invalid role ID format', () => {
			expect(() => validateRoleId(mockExecuteFunctions, 'role/id', 0)).toThrow(
				'Invalid Role ID format',
			);
		});

		it('should throw for role ID longer than 200 chars', () => {
			expect(() => validateRoleId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Maximum length is 200 characters',
			);
		});
	});

	describe('roleIdLocator', () => {
		it('should define a searchable resource locator for roles', () => {
			expect(roleIdLocator.type).toBe('resourceLocator');
			expect(roleIdLocator.name).toBe('roleId');
			expect(roleIdLocator.required).toBe(true);
			expect(roleIdLocator.default).toEqual({ mode: 'list', value: '' });
			expect(roleIdLocator.modes).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: 'list',
						typeOptions: expect.objectContaining({
							searchListMethod: 'searchRoles',
							searchable: true,
						}),
					}),
					expect.objectContaining({
						name: 'id',
						type: 'string',
						placeholder: 'e.g. 5452022000003511003',
					}),
				]),
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, null, 0, 'payload')).not.toThrow();
			expect(() => ensureSafeObject(mockExecuteFunctions, undefined, 0, 'payload')).not.toThrow();
		});

		it('should throw when value is not object', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, 'bad', 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when value is an array', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, [], 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when unsafe top-level key is present', () => {
			const payload = { constructor: 'bad' } as unknown as IDataObject;
			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "constructor" is not allowed',
			);
		});

		it('should throw when unsafe nested key is present', () => {
			const payload = {
				config: {
					prototype: 'bad',
				},
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "prototype" is not allowed',
			);
		});

		it('should throw when unsafe nested array object key is present', () => {
			const parsedUnsafe = JSON.parse('{"__proto__":"blocked"}') as IDataObject;
			const payload = { items: [{ ok: true }, parsedUnsafe] } as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "__proto__" is not allowed',
			);
		});

		it('should allow safe nested structures', () => {
			const payload = {
				name: 'Admin',
				meta: { region: 'US', tags: [{ key: 'core' }] },
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).not.toThrow();
		});
	});

	describe('validateRolePayload', () => {
		it('should return normalized payload', () => {
			const payload: IDataObject = {
				name: '  Admin  ',
				description: '  Leadership role  ',
			};

			const result = validateRolePayload(mockExecuteFunctions, payload, 0, 'Role Definition');

			expect(result).toEqual({
				name: 'Admin',
				description: 'Leadership role',
			});
		});

		it('should throw for null payload', () => {
			expect(() =>
				validateRolePayload(
					mockExecuteFunctions,
					null as unknown as IDataObject,
					0,
					'Role Definition',
				),
			).toThrow('Role Definition cannot be empty');
		});

		it('should throw for empty payload when allowEmpty is false', () => {
			expect(() => validateRolePayload(mockExecuteFunctions, {}, 0, 'Role Updates')).toThrow(
				'Role Updates cannot be empty',
			);
		});

		it('should allow empty payload when allowEmpty is true', () => {
			const result = validateRolePayload(mockExecuteFunctions, {}, 0, 'Role Updates', {
				allowEmpty: true,
			});
			expect(result).toEqual({});
		});

		it('should require name when requireName is true', () => {
			expect(() =>
				validateRolePayload(mockExecuteFunctions, { name: '   ' }, 0, 'Role Definition', {
					requireName: true,
				}),
			).toThrow('Role name is required');
		});

		it('should throw when name exceeds max length', () => {
			expect(() =>
				validateRolePayload(
					mockExecuteFunctions,
					{ name: 'a'.repeat(121) } as IDataObject,
					0,
					'Role Definition',
				),
			).toThrow('Role name is too long. Maximum length is 120 characters.');
		});

		it('should drop empty description', () => {
			const result = validateRolePayload(
				mockExecuteFunctions,
				{ name: 'Admin', description: '   ' } as IDataObject,
				0,
				'Role Definition',
			);

			expect(result).toEqual({ name: 'Admin' });
		});

		it('should throw when description exceeds max length', () => {
			expect(() =>
				validateRolePayload(
					mockExecuteFunctions,
					{ description: 'a'.repeat(1001) } as IDataObject,
					0,
					'Role Updates',
				),
			).toThrow('Description is too long. Maximum length is 1000 characters.');
		});

		it('should enforce allowed fields list', () => {
			expect(() =>
				validateRolePayload(
					mockExecuteFunctions,
					{ invalid_field: 'x' } as unknown as IDataObject,
					0,
					'Role Definition',
					{ allowedFields: ['name'] },
				),
			).toThrow('Unsupported field "invalid_field"');
		});

		it('should require profile type when requireProfileType is true', () => {
			expect(() =>
				validateRolePayload(
					mockExecuteFunctions,
					{ name: 'Admin' } as IDataObject,
					0,
					'Role Definition',
					{ requireProfileType: true },
				),
			).toThrow('Profile Type is required');
		});

		it('should normalize valid profile type, clone_id, and user_ids', () => {
			const result = validateRolePayload(
				mockExecuteFunctions,
				{
					name: 'Admin',
					profile_type: ' Cliq Admin ',
					clone_id: ' role_123 ',
					user_ids: [' 62913657 ', '63569660', '62913657'],
				} as unknown as IDataObject,
				0,
				'Role Definition',
			);

			expect(result).toEqual({
				name: 'Admin',
				profile_type: 'Cliq Admin',
				clone_id: 'role_123',
				user_ids: ['62913657', '63569660'],
			});
		});

		it('should treat null name as missing when name is required', () => {
			expect(() =>
				validateRolePayload(
					mockExecuteFunctions,
					{ name: null } as unknown as IDataObject,
					0,
					'Role Definition',
					{ requireName: true },
				),
			).toThrow('Role name is required');
		});

		it('should reject non-array user_ids', () => {
			expect(() =>
				validateRolePayload(
					mockExecuteFunctions,
					{ user_ids: '62913657' } as unknown as IDataObject,
					0,
					'Role Definition',
				),
			).toThrow('User IDs must be an array of strings');
		});

		it('should normalize empty user_ids entries to empty array', () => {
			const result = validateRolePayload(
				mockExecuteFunctions,
				{ user_ids: [' ', ''] } as unknown as IDataObject,
				0,
				'Role Definition',
			);

			expect(result).toEqual({ user_ids: [] });
		});
	});

	describe('parseRolePayloadInput', () => {
		it('should parse valid JSON string payload', () => {
			const result = parseRolePayloadInput(
				mockExecuteFunctions,
				'{"name":"Admin","profile_type":"Members"}',
				0,
				'Role Definition',
			);
			expect(result).toEqual({ name: 'Admin', profile_type: 'Members' });
		});

		it('should throw for empty string payload', () => {
			expect(() => parseRolePayloadInput(mockExecuteFunctions, '  ', 0, 'Role Definition')).toThrow(
				'Role Definition cannot be empty',
			);
		});

		it('should throw for invalid JSON string payload', () => {
			expect(() =>
				parseRolePayloadInput(mockExecuteFunctions, '{"name":"Admin"', 0, 'Role Definition'),
			).toThrow('Role Definition must be valid JSON');
		});

		it('should throw when parsed JSON is not an object', () => {
			expect(() => parseRolePayloadInput(mockExecuteFunctions, '[]', 0, 'Role Definition')).toThrow(
				'Role Definition must be a JSON object',
			);
		});

		it('should throw when non-string payload is invalid', () => {
			expect(() => parseRolePayloadInput(mockExecuteFunctions, 123, 0, 'Role Definition')).toThrow(
				'Role Definition must be a JSON object',
			);
		});
	});

	describe('parseDelimitedUserIds', () => {
		it('should parse, trim, and dedupe user IDs', () => {
			const result = parseDelimitedUserIds(
				mockExecuteFunctions,
				' 62913657,63569660,62913657 ',
				0,
				'User IDs',
			);
			expect(result).toEqual(['62913657', '63569660']);
		});

		it('should throw for empty user ID input', () => {
			expect(() => parseDelimitedUserIds(mockExecuteFunctions, '  ', 0, 'User IDs')).toThrow(
				'User IDs is required',
			);
		});

		it('should throw for too many user IDs', () => {
			const value = Array(101)
				.fill(0)
				.map((_, index) => `user_${index}`)
				.join(',');
			expect(() => parseDelimitedUserIds(mockExecuteFunctions, value, 0, 'User IDs')).toThrow(
				'Cannot process more than 100 users at once',
			);
		});

		it('should throw when parsed list contains no IDs', () => {
			expect(() => parseDelimitedUserIds(mockExecuteFunctions, ',,', 0, 'User IDs')).toThrow(
				'At least one User IDs value is required',
			);
		});

		it('should throw when a user ID exceeds max length', () => {
			expect(() =>
				parseDelimitedUserIds(mockExecuteFunctions, `ok,${'a'.repeat(201)}`, 0, 'User IDs'),
			).toThrow('is too long. Maximum length is 200 characters.');
		});

		it('should throw for invalid user ID format', () => {
			expect(() =>
				parseDelimitedUserIds(mockExecuteFunctions, 'good,bad/id', 0, 'User IDs'),
			).toThrow('Invalid User ID "bad/id"');
		});
	});

	describe('validateProfileType', () => {
		it('should normalize and accept valid profile type', () => {
			const result = validateProfileType(mockExecuteFunctions, ' Members ', 0);
			expect(result).toBe('Members');
		});

		it('should reject invalid profile type', () => {
			expect(() => validateProfileType(mockExecuteFunctions, 'Owner', 0)).toThrow(
				'Profile Type must be one of: Members, Cliq Admin, Admin',
			);
		});

		it('should reject missing profile type value', () => {
			expect(() => validateProfileType(mockExecuteFunctions, undefined, 0)).toThrow(
				'Profile Type is required',
			);
		});
	});

	describe('validateRoleInputMode', () => {
		it('should return valid input modes', () => {
			expect(validateRoleInputMode(mockExecuteFunctions, 'structured', 0)).toBe('structured');
			expect(validateRoleInputMode(mockExecuteFunctions, 'raw', 0)).toBe('raw');
		});

		it('should reject unsupported input modes', () => {
			expect(() => validateRoleInputMode(mockExecuteFunctions, 'broken', 0)).toThrow(
				'Input Mode must be either "structured" or "raw"',
			);
		});
	});

	describe('validateRolePermissionUpdatePayload', () => {
		it('should reject missing or empty list array', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{} as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates must include a non-empty "list" array');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{ list: [] } as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates must include a non-empty "list" array');
		});

		it('should validate well-formed permission update payload', () => {
			const payload = {
				list: [{ module: 'organisation_member', action: 'attachments', status: 'enabled' }],
			} as IDataObject;

			const result = validateRolePermissionUpdatePayload(
				mockExecuteFunctions,
				payload,
				0,
				'Permissions Updates',
			);
			expect(result).toEqual(payload);
		});

		it('should reject non-object list entries', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{ list: ['bad'] } as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0] must be an object');
		});

		it('should reject non-string module/action/config name values', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{ list: [{ module: 123, status: 'enabled' }] } as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].module must be a string');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'users', action: 123, status: 'enabled' }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].action must be a string');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [
							{
								module: 'direct_message',
								configs: [{ name: 123, value: 1 }],
							},
						],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].configs[0].name must be a string');
		});

		it('should reject empty module/action/status values', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{ list: [{ module: ' ' }] } as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].module is required');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'users', action: ' ' }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].action cannot be empty');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'users', action: 'create', status: ' ' }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].status cannot be empty');
		});

		it('should reject read-only get action updates', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'users', action: 'get', status: 'disabled' }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].action "get" is read-only and cannot be updated');
		});

		it('should allow read-only get action when explicitly requested by caller', () => {
			const payload = {
				list: [{ module: 'users', action: 'get', status: 'disabled' }],
			} as IDataObject;

			const result = validateRolePermissionUpdatePayload(
				mockExecuteFunctions,
				payload,
				0,
				'Permissions Updates',
				{ allowReadOnlyActions: true },
			);

			expect(result).toEqual(payload);
		});

		it('should reject status values outside enabled/disabled', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'users', action: 'create', status: 'active' }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].status must be one of: enabled, disabled');
		});

		it('should require status when action is provided', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'users', action: 'create' }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].status is required when action is provided');
		});

		it('should require status and/or configs for each list entry', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'users' }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0] must include status and/or configs');
		});

		it('should validate config-only entry without status', () => {
			const payload = {
				list: [
					{
						module: 'direct_message',
						configs: [{ name: 'profile_based_restricted_reply_time_frame', value: 345600000 }],
					},
				],
			} as IDataObject;

			const result = validateRolePermissionUpdatePayload(
				mockExecuteFunctions,
				payload,
				0,
				'Permissions Updates',
			);

			expect(result).toEqual(payload);
		});

		it('should trim and persist normalized module/action/config names', () => {
			const payload = {
				list: [
					{
						module: ' users ',
						action: ' create ',
						status: 'enabled',
						configs: [{ name: ' custom_rule ', value: { enabled: [], disabled: [] } }],
					},
				],
			} as IDataObject;

			const result = validateRolePermissionUpdatePayload(
				mockExecuteFunctions,
				payload,
				0,
				'Permissions Updates',
			);

			expect(result).toEqual({
				list: [
					{
						module: 'users',
						action: 'create',
						status: 'enabled',
						configs: [{ name: 'custom_rule', value: { enabled: [], disabled: [] } }],
					},
				],
			});
		});

		it('should reject invalid configs shape', () => {
			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'direct_message', configs: [] }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].configs must be a non-empty array when provided');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'direct_message', configs: [{ name: '   ', value: 1 }] }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].configs[0].name is required');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'direct_message', configs: ['bad'] }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].configs[0] must be an object');

			expect(() =>
				validateRolePermissionUpdatePayload(
					mockExecuteFunctions,
					{
						list: [{ module: 'direct_message', configs: [{ name: 'cfg' }] }],
					} as unknown as IDataObject,
					0,
					'Permissions Updates',
				),
			).toThrow('Permissions Updates.list[0].configs[0].value is required');
		});
	});

	describe('shouldContinueOnFail', () => {
		it('should return true when continueOnFail is enabled', () => {
			(
				mockExecuteFunctions as unknown as {
					continueOnFail: () => boolean;
				}
			).continueOnFail = jest.fn(() => true);

			expect(shouldContinueOnFail(mockExecuteFunctions)).toBe(true);
		});

		it('should return false when continueOnFail is unavailable', () => {
			expect(shouldContinueOnFail(mockExecuteFunctions)).toBe(false);
		});

		it('should return false when continueOnFail returns false', () => {
			(
				mockExecuteFunctions as unknown as {
					continueOnFail: () => boolean;
				}
			).continueOnFail = jest.fn(() => false);

			expect(shouldContinueOnFail(mockExecuteFunctions)).toBe(false);
		});
	});

	describe('isRoleAiErrorModeEnabled', () => {
		it('should return true when the parameter is enabled', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) =>
					name === 'enableAiErrorMode' ? true : undefined,
				),
			} as unknown as IExecuteFunctions;

			expect(isRoleAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
		});

		it('should return true when node parameters enable AI Error Mode', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: { enableAiErrorMode: true },
				})),
			} as unknown as IExecuteFunctions;

			expect(isRoleAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
		});

		it('should return false when AI Error Mode is disabled', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => false),
			} as unknown as IExecuteFunctions;

			expect(isRoleAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
		});

		it('should return false when node parameters are missing or invalid', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: [],
				})),
			} as unknown as IExecuteFunctions;

			expect(isRoleAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
		});

		it('should return false when getNode returns no node object', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => undefined),
			} as unknown as IExecuteFunctions;

			expect(isRoleAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
		});

		it('should return false when getNode is not available', () => {
			mockExecuteFunctions = {
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
			} as unknown as IExecuteFunctions;

			expect(isRoleAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
		});

		it('should return false when getNode throws unexpectedly', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => {
					throw new Error('boom');
				}),
			} as unknown as IExecuteFunctions;

			expect(isRoleAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
		});
	});

	describe('runRoleUsersPreflightGate', () => {
		it('should return without throwing when all user IDs are found in the users roster', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue({
				users: [
					{ user_id: 'user_1', display_name: 'User One' },
					{ id: 'user_2', display_name: 'User Two' },
				],
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/users',
				{},
				{
					limit: 100,
					fields: 'display_name',
				},
			);
		});

		it('should skip user preflight when recoverable mode is not enabled', async () => {
			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should skip user preflight when user read scopes are unavailable', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1'],
					0,
					'ZohoCliq.Organisation.UPDATE',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw when one or more user IDs are missing from a completed users roster', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;

			mockZohoCliqApiRequest.mockResolvedValue({
				users: [{ user_id: 'user_1', display_name: 'User One' }],
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(NodeOperationError);
		});

		it('should report only the unresolved role user IDs in the missing-user message', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;

			mockZohoCliqApiRequest.mockResolvedValue({
				users: [{ user_id: 'user_1', display_name: 'User One' }],
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow('Missing user IDs: ["user_2"].');
		});

		it('should parse a top-level users array response and ignore non-user entries', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue([
				null,
				'bad-entry',
				{ email: 'user_1@example.com', display_name: 'User One' },
			] as unknown as IDataObject);

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1@example.com', 'missing@example.com'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw when the users response is a non-object value during an active preflight', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue('unexpected-response' as unknown as IDataObject);

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should throw when the users response contains no usable user list during an active preflight', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue({
				data: { next_token: 'page_2' },
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should parse users from a data array response shape', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue({
				data: [{ user_id: 'user_1', display_name: 'User One' }],
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(NodeOperationError);
		});

		it('should continue to the next users roster page when next_token is present', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					users: [{ user_id: 'user_1', display_name: 'User One' }],
					next_token: 'page_2',
					has_more: true,
				})
				.mockResolvedValueOnce({
					data: {
						users: [{ zuid: 'user_2', display_name: 'User Two' }],
						has_more: false,
					},
				});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/users',
				{},
				{
					limit: 100,
					fields: 'display_name',
				},
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/users',
				{},
				{
					limit: 100,
					fields: 'display_name',
					next_token: 'page_2',
				},
			);
		});

		it('should read pagination metadata from nested data objects', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: {
						users: [{ user_id: 'user_1', display_name: 'User One' }],
						nextToken: 'nested_page_2',
					},
				})
				.mockResolvedValueOnce({
					data: {
						users: [{ user_id: 'user_2', display_name: 'User Two' }],
						hasMore: false,
					},
				});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2', 'user_3'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw when the users roster repeats the same next token during an active preflight', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					users: [{ user_id: 'user_1', display_name: 'User One' }],
					next_token: 'repeat_page',
				})
				.mockResolvedValueOnce({
					users: [{ user_id: 'user_1', display_name: 'User One' }],
					next_token: 'repeat_page',
				});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow('repeated next_token "repeat_page"');
		});

		it('should throw when the users roster cannot be fetched during an active preflight', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockRejectedValueOnce(
				new Error('request failed with status code 500'),
			);

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should throw when the users roster indicates more pages without a token during an active preflight', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue({
				users: [{ user_id: 'user_1', display_name: 'User One' }],
				has_more: true,
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'user_2'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow('reported more results without returning a next_token');
		});

		it('should throw when the users page hits the limit with no pagination metadata during an active preflight', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue({
				users: Array.from({ length: 100 }, (_, index) => ({
					user_id: `user_${index}`,
					display_name: `User ${index}`,
				})),
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'missing_user'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'could not confirm exhaustive pagination because Zoho Cliq returned a full page without next_token or has_more=false',
			);
		});

		it('should treat has_more false as a definitive final page even when the page size hits the limit', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			mockZohoCliqApiRequest.mockResolvedValue({
				users: Array.from({ length: 100 }, (_, index) => ({
					user_id: `user_${index}`,
					display_name: `User ${index}`,
				})),
				has_more: false,
			});

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					['user_1', 'missing_user'],
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).rejects.toThrow(NodeOperationError);
		});

		it('should return without throwing when iteration fails unexpectedly', async () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
			const malformedUserIds = {
				length: 1,
				[Symbol.iterator]: () => {
					throw new Error('iterator failed');
				},
			} as unknown as string[];

			await expect(
				runRoleUsersPreflightGate(
					mockExecuteFunctions,
					malformedUserIds,
					0,
					'ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
		});
	});

	describe('preflightRoleLookupForRecoverableMode', () => {
		beforeEach(() => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
		});

		it('should return the matched role from the role roster when recoverable mode is enabled', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				profiles: [
					{ id: 'role_123', name: 'Admins' },
					{ id: 'role_456', name: 'Members' },
				],
			});

			await expect(
				preflightRoleLookupForRecoverableMode(
					mockExecuteFunctions,
					0,
					'ZohoCliq.Organisation.READ',
					'role_123',
				),
			).resolves.toEqual({ id: 'role_123', name: 'Admins' });

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
		});

		it('should match numeric role IDs from a top-level array roster and ignore non-role entries', async () => {
			mockZohoCliqApiRequest.mockResolvedValue([
				null,
				'invalid-entry',
				{ id: 123, name: 'Numeric Role' },
			] as unknown as IDataObject);

			await expect(
				preflightRoleLookupForRecoverableMode(
					mockExecuteFunctions,
					0,
					'ZohoCliq.Organisation.READ',
					'123',
				),
			).resolves.toEqual({ id: 123, name: 'Numeric Role' });

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
		});

		it('should match roles from a data array using profile_id when id is absent', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				data: [{ profile_id: 'role_789', name: 'Profile Id Role' }],
			});

			await expect(
				preflightRoleLookupForRecoverableMode(
					mockExecuteFunctions,
					0,
					'ZohoCliq.Organisation.READ',
					'role_789',
				),
			).resolves.toEqual({ profile_id: 'role_789', name: 'Profile Id Role' });

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
		});

		it('should match roles using profileId when id and profile_id are absent', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				roles: [{ profileId: 'role_999', name: 'Camel Role Id' }],
			});

			await expect(
				preflightRoleLookupForRecoverableMode(
					mockExecuteFunctions,
					0,
					'ZohoCliq.Organisation.READ',
					'role_999',
				),
			).resolves.toEqual({ profileId: 'role_999', name: 'Camel Role Id' });

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
		});

		it('should throw a role-not-found operation error when the role roster is parsed and the role is missing', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				data: {
					profiles: [{ profile_id: 'role_456', name: 'Members' }],
				},
			});

			await expect(
				preflightRoleLookupForRecoverableMode(
					mockExecuteFunctions,
					0,
					'ZohoCliq.Organisation.READ',
					'role_123',
				),
			).rejects.toThrow(ROLE_NOT_FOUND_MESSAGE);
		});

		it('should fail an active role preflight when the role roster response is malformed', async () => {
			mockZohoCliqApiRequest.mockResolvedValue('unexpected-response' as unknown as IDataObject);

			await expect(
				preflightRoleLookupForRecoverableMode(
					mockExecuteFunctions,
					0,
					'ZohoCliq.Organisation.READ',
					'role_123',
				),
			).rejects.toThrow(
				'The role roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should fail an active role preflight when the role roster request fails', async () => {
			mockZohoCliqApiRequest.mockRejectedValue(new Error('request failed with status code 403'));

			await expect(
				preflightRoleLookupForRecoverableMode(
					mockExecuteFunctions,
					0,
					'ZohoCliq.Organisation.READ',
					'role_123',
				),
			).rejects.toThrow(
				'The role roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});
	});

	describe('isRoleRecoverableModeEnabled', () => {
		it('should return true when continueOnFail is enabled or AI Error Mode is active', () => {
			expect(
				isRoleRecoverableModeEnabled(
					{
						continueOnFail: jest.fn(() => true),
						getNodeParameter: jest.fn(() => false),
						getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: false } })),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(true);

			expect(
				isRoleRecoverableModeEnabled(
					{
						continueOnFail: jest.fn(() => false),
						getNodeParameter: jest.fn((name: string) =>
							name === 'enableAiErrorMode' ? true : undefined,
						),
						getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: true } })),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(true);
		});
	});

	describe('pushRoleRecoverableError', () => {
		it('should return false when neither continueOnFail nor AI Error Mode is enabled', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => false),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			expect(
				pushRoleRecoverableError(mockExecuteFunctions, returnData, 0, 'list', new Error('boom')),
			).toBe(false);
			expect(returnData).toEqual([]);
		});

		it('should preserve scope payload precedence and merge context fields', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			const handled = pushRoleRecoverableError(
				mockExecuteFunctions,
				returnData,
				0,
				'list',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						resource: 'role',
						operation: 'list',
					},
				},
				{
					contextFields: { role_id: 'role_123' },
				},
			);

			expect(handled).toBe(true);
			expect(returnData).toEqual([
				{
					json: {
						success: false,
						resource: 'role',
						operation: 'list',
						role_id: 'role_123',
					},
				},
			]);
		});

		it('should preserve scope payload precedence without requiring context fields', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			const handled = pushRoleRecoverableError(mockExecuteFunctions, returnData, 0, 'list', {
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'role',
					operation: 'list',
				},
			});

			expect(handled).toBe(true);
			expect(returnData).toEqual([
				{
					json: {
						success: false,
						resource: 'role',
						operation: 'list',
					},
				},
			]);
		});

		it('should build a recoverable payload with role context', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			const handled = pushRoleRecoverableError(
				mockExecuteFunctions,
				returnData,
				0,
				'get',
				new Error('Invalid Role ID format'),
				{
					contextFields: { role_id: 'role/invalid' },
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('role id'),
							reason: 'INVALID_ROLE_ID',
							hint: 'Use the exact canonical Zoho Cliq role ID returned by List Roles.',
						},
					],
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0]).toEqual({
				json: {
					success: false,
					message: 'Invalid Role ID format',
					resource: 'role',
					operation: 'get',
					role_id: 'role/invalid',
					reason: 'INVALID_ROLE_ID',
					hint: 'Use the exact canonical Zoho Cliq role ID returned by List Roles.',
				},
			});
		});

		it('should ignore malformed scope payloads and fall back to generic recoverable output', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			pushRoleRecoverableError(
				mockExecuteFunctions,
				returnData,
				0,
				'list',
				{
					message: 'request failed',
					zohoCliqScopeErrorPayload: 'bad-scope-payload',
				},
				{
					contextFields: { role_id: 'role_123' },
				},
			);

			expect(returnData[0]).toEqual({
				json: {
					success: false,
					message: 'request failed',
					resource: 'role',
					operation: 'list',
					role_id: 'role_123',
				},
			});
		});

		it('should handle plain string errors without scope payloads', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			pushRoleRecoverableError(mockExecuteFunctions, returnData, 0, 'list', 'plain string error');

			expect(returnData[0]).toEqual({
				json: {
					success: false,
					message: 'plain string error',
					resource: 'role',
					operation: 'list',
				},
			});
		});

		it('should ignore array scope payloads and fall back to generic recoverable output', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			pushRoleRecoverableError(mockExecuteFunctions, returnData, 0, 'list', {
				message: 'request failed',
				zohoCliqScopeErrorPayload: ['bad-scope-payload'],
			});

			expect(returnData[0]).toEqual({
				json: {
					success: false,
					message: 'request failed',
					resource: 'role',
					operation: 'list',
				},
			});
		});

		it('should handle null errors without scope payloads', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			pushRoleRecoverableError(mockExecuteFunctions, returnData, 0, 'list', null);

			expect(returnData[0]).toEqual({
				json: {
					success: false,
					message: 'An unexpected issue occurred with the API request',
					resource: 'role',
					operation: 'list',
				},
			});
		});
	});

	describe('resolveRoleEnhancedOutput', () => {
		it('should default enhanced output to enabled and coerce primitive responses', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string, _itemIndex: number, defaultValue?: unknown) =>
					name === 'includeEnhancedOutput' ? defaultValue : undefined,
				),
			} as unknown as IExecuteFunctions;

			expect(resolveRoleEnhancedOutput(mockExecuteFunctions, 0, '')).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { data: '' },
				responseJson: { data: '' },
			});
		});

		it('should return disabled enhanced output state when requested', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) =>
					name === 'includeEnhancedOutput' ? false : undefined,
				),
			} as unknown as IExecuteFunctions;

			expect(resolveRoleEnhancedOutput(mockExecuteFunctions, 0, { status: 'success' })).toEqual({
				includeEnhancedOutput: false,
				rawResponse: { status: 'success' },
				responseJson: { status: 'success' },
			});
		});
	});

	describe('buildRoleContinueOnFailError', () => {
		it('should preserve scope payload when present', () => {
			const result = buildRoleContinueOnFailError({
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'role',
					operation: 'list',
				},
			});

			expect(result).toEqual({
				success: false,
				resource: 'role',
				operation: 'list',
			});
		});

		it('should sanitize response details from api error object', () => {
			const error = new Error('request failed') as Error & {
				response?: {
					status?: number;
					data?: {
						message?: string;
						code?: number;
						error_code?: number;
						status?: number;
					};
				};
			};
			error.response = {
				status: 400,
				data: {
					message: 'Bad request',
					code: 1001,
					error_code: 42,
					status: 0,
				},
			};

			const result = buildRoleContinueOnFailError(error);

			expect(result).toEqual({
				success: false,
				error: 'request failed',
				details: {
					statusCode: 400,
					message: 'Bad request',
					code: 1001,
					error_code: 42,
					status: 0,
				},
			});
		});

		it('should include string code fields from api error response', () => {
			const error = new Error('request failed') as Error & {
				response?: {
					status?: number;
					data?: {
						code?: string;
						error_code?: string;
						status?: string;
					};
				};
			};
			error.response = {
				status: 401,
				data: {
					code: 'E_UNAUTHORIZED',
					error_code: 'AUTH_401',
					status: 'error',
				},
			};

			const result = buildRoleContinueOnFailError(error);

			expect(result).toEqual({
				success: false,
				error: 'request failed',
				details: {
					statusCode: 401,
					code: 'E_UNAUTHORIZED',
					error_code: 'AUTH_401',
					status: 'error',
				},
			});
		});

		it('should skip non-string and non-number response data fields', () => {
			const error = new Error('request failed') as Error & {
				response?: {
					status?: number;
					data?: {
						message?: unknown;
						code?: unknown;
						error_code?: unknown;
						status?: unknown;
					};
				};
			};
			error.response = {
				status: 500,
				data: {
					message: { bad: true },
					code: { bad: true },
					error_code: null,
					status: { bad: true },
				},
			};

			const result = buildRoleContinueOnFailError(error);

			expect(result).toEqual({
				success: false,
				error: 'request failed',
				details: {
					statusCode: 500,
				},
			});
		});

		it('should return unknown error message for non-error values', () => {
			const result = buildRoleContinueOnFailError('plain string error');
			expect(result).toEqual({
				success: false,
				error: 'An unexpected issue occurred',
				details: {},
			});
		});

		it('should ignore non-numeric status and non-object response data', () => {
			const error = new Error('request failed') as Error & {
				response?: {
					status?: unknown;
					data?: unknown;
				};
			};
			error.response = {
				status: '400',
				data: 'bad request',
			};

			const result = buildRoleContinueOnFailError(error);

			expect(result).toEqual({
				success: false,
				error: 'request failed',
				details: {},
			});
		});

		it('should ignore array-shaped response data when sanitizing api errors', () => {
			const error = new Error('request failed') as Error & {
				response?: {
					status?: number;
					data?: unknown;
				};
			};
			error.response = {
				status: 400,
				data: ['bad request'],
			};

			const result = buildRoleContinueOnFailError(error);

			expect(result).toEqual({
				success: false,
				error: 'request failed',
				details: {
					statusCode: 400,
				},
			});
		});

		it('should ignore missing response objects when sanitizing api errors', () => {
			const error = new Error('request failed');
			const result = buildRoleContinueOnFailError(error);

			expect(result).toEqual({
				success: false,
				error: 'request failed',
				details: {},
			});
		});
	});
});
