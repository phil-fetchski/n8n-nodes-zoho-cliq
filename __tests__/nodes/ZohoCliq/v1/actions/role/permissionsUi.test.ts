import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import adminRoleStandardPermissions from '../../../../../helpers/role/AdminRoleStandardPermissions.json';

import {
	buildIntentListFromTemplate,
	buildFilteredTemplateList,
	buildPermissionsTemplateList,
	collectSelectedPermissions,
	defaultPermissionsTemplatePayload,
	getPermissionGroupsBySection,
	isSupportedPermissionOptionValue,
	permissionGroupDefinitions,
	summarizePermissionList,
	toPermissionGroupProperty,
} from '../../../../../../nodes/ZohoCliq/v1/actions/role/permissionsUi';
import {
	READ_ONLY_PERMISSION_ACTIONS,
	UNSUPPORTED_PERMISSION_MODULES,
} from '../../../../../../nodes/ZohoCliq/v1/actions/role/permissions.constants';

describe('ZohoCliq - Role - permissionsUi helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	it('should map a group definition into a multiOptions property', () => {
		const property = toPermissionGroupProperty(permissionGroupDefinitions[0]);
		expect(property.type).toBe('multiOptions');
		expect(property.default).toEqual([]);
		expect(property.options).toEqual(permissionGroupDefinitions[0].options);
	});

	it('should partition permission groups by section prefix without index slicing', () => {
		const admin = getPermissionGroupsBySection('admin');
		const configuration = getPermissionGroupsBySection('configuration');
		const mobile = getPermissionGroupsBySection('mobile');

		expect(admin.every((group) => group.name.startsWith('admin'))).toBe(true);
		expect(configuration.every((group) => group.name.startsWith('config'))).toBe(true);
		expect(mobile.every((group) => group.name.startsWith('mobile'))).toBe(true);
		expect(admin.length + configuration.length + mobile.length).toBe(
			permissionGroupDefinitions.length,
		);
	});

	it('should throw for unknown permission group prefix in section resolver', () => {
		const injected = {
			name: 'legacyPermissionGroup',
			section: 'legacy',
			displayName: 'Legacy',
			description: 'for test',
			options: [],
		};
		(permissionGroupDefinitions as Array<typeof injected>).push(injected);
		try {
			expect(() => getPermissionGroupsBySection('admin')).toThrow(
				'Unknown permission group section for "legacyPermissionGroup"',
			);
		} finally {
			permissionGroupDefinitions.pop();
		}
	});

	it('should trim summary values for module action and status', () => {
		const summary = summarizePermissionList([
			{ module: ' users ', action: ' create ', status: ' enabled ' },
		]);
		expect(summary).toEqual([{ module: 'users', action: 'create', status: 'enabled' }]);
	});

	it('should normalize missing summary values to empty strings', () => {
		const summary = summarizePermissionList([
			{ module: undefined, action: undefined, status: undefined },
		]);
		expect(summary).toEqual([{ module: '', action: '', status: '' }]);
	});

	it('should collect and dedupe selected structured permissions', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue: unknown) => {
				if (name === 'adminUsersAndProfilesPermissions') {
					return ['users::create', 'users::create'];
				}
				if (name === 'configDirectConversationsPermissions') {
					return ['organisation_member::message'];
				}
				return defaultValue;
			},
		);

		const list = collectSelectedPermissions(mockExecuteFunctions, 0, 'enabled');
		expect(list).toEqual(
			expect.arrayContaining([
				{ module: 'users', action: 'create', status: 'enabled' },
				{ module: 'organisation_member', action: 'message', status: 'enabled' },
			]),
		);
		expect(list).toHaveLength(2);
	});

	it('should throw for invalid structured permission selection values', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue: unknown) => {
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create::extra'];
				return defaultValue;
			},
		);

		expect(() => collectSelectedPermissions(mockExecuteFunctions, 0, 'enabled')).toThrow(
			NodeOperationError,
		);
	});

	it('should throw when structured selection is missing action segment', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue: unknown) => {
				if (name === 'adminUsersAndProfilesPermissions') return ['users::'];
				return defaultValue;
			},
		);

		expect(() => collectSelectedPermissions(mockExecuteFunctions, 0, 'enabled')).toThrow(
			NodeOperationError,
		);
	});

	it('should throw when structured selection is missing module segment', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue: unknown) => {
				if (name === 'adminUsersAndProfilesPermissions') return ['::create'];
				return defaultValue;
			},
		);

		expect(() => collectSelectedPermissions(mockExecuteFunctions, 0, 'enabled')).toThrow(
			NodeOperationError,
		);
	});

	it('should include config template entries for direct_message and organisation_member', () => {
		const list = buildPermissionsTemplateList();

		expect(list).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					module: 'direct_message',
					configs: [{ name: 'profile_based_restricted_reply_time_frame', value: '' }],
				}),
				expect.objectContaining({
					module: 'organisation_member',
					configs: [
						{
							name: 'custom_rule',
							value: { enabled: [], disabled: [] },
						},
					],
				}),
			]),
		);
	});

	it('should expose a valid JSON template payload string', () => {
		const parsed = JSON.parse(defaultPermissionsTemplatePayload) as { list?: unknown[] };
		expect(Array.isArray(parsed.list)).toBe(true);
		expect(parsed.list!.length).toBeGreaterThan(0);
	});

	it('should keep structured permissions in parity with admin role snapshot action pairs', () => {
		const adminSnapshot = adminRoleStandardPermissions as Array<
			Record<string, { actions?: Record<string, string> }>
		>;
		const expected = new Set<string>();
		for (const snapshotEntry of adminSnapshot) {
			for (const [module, value] of Object.entries(snapshotEntry ?? {})) {
				if (UNSUPPORTED_PERMISSION_MODULES.has(module)) {
					continue;
				}
				for (const action of Object.keys(value?.actions ?? {})) {
					if (READ_ONLY_PERMISSION_ACTIONS.has(action)) {
						continue;
					}
					expected.add(`${module}::${action}`);
				}
			}
		}

		const actual = new Set<string>();
		for (const group of permissionGroupDefinitions) {
			for (const option of group.options) {
				actual.add(option.value);
			}
		}

		expect(actual).toEqual(expected);
	});

	it('should exclude read-only get actions from structured permission options', () => {
		for (const group of permissionGroupDefinitions) {
			for (const option of group.options) {
				expect(option.value.endsWith('::get')).toBe(false);
			}
		}
	});

	it('should exclude unsupported custom_admin module from structured permission options', () => {
		for (const group of permissionGroupDefinitions) {
			for (const option of group.options) {
				expect(option.value.startsWith('custom_admin::')).toBe(false);
			}
		}
	});

	it('should identify supported and unsupported permission option values', () => {
		expect(isSupportedPermissionOptionValue('users::create')).toBe(true);
		expect(isSupportedPermissionOptionValue('users::get')).toBe(false);
		expect(isSupportedPermissionOptionValue('custom_admin::edit')).toBe(false);
		expect(isSupportedPermissionOptionValue('malformed-option')).toBe(false);
		expect(isSupportedPermissionOptionValue('users::')).toBe(false);
		expect(isSupportedPermissionOptionValue('::create')).toBe(false);
	});

	it('should include module-level and action-level template rows', () => {
		const list = buildPermissionsTemplateList();
		expect(list).toEqual(
			expect.arrayContaining([
				{ module: 'users', status: '' },
				{ module: 'users', action: 'create', status: '' },
			]),
		);
	});

	it('should avoid adding duplicate module/action template rows', () => {
		const injected = {
			name: 'injectedDuplicateGroup',
			section: 'admin',
			displayName: 'Injected Duplicate Group',
			description: 'for test',
			options: [
				{ name: 'Duplicate 1', value: 'users::create' },
				{ name: 'Duplicate 2', value: 'users::create' },
			],
		};
		(permissionGroupDefinitions as Array<typeof injected>).push(injected);
		try {
			const list = buildPermissionsTemplateList();
			const matches = list.filter((entry) => entry.module === 'users' && entry.action === 'create');
			expect(matches).toHaveLength(1);
		} finally {
			permissionGroupDefinitions.pop();
		}
	});

	it('should keep only non-empty status/config entries when building intent list', () => {
		const list = buildIntentListFromTemplate(
			mockExecuteFunctions,
			0,
			[
				{ module: 'users', action: 'create', status: '' },
				{ module: 'users', action: 'delete', status: 'include' },
				{ module: 'direct_message', status: '', configs: [] },
				{
					module: 'direct_message',
					status: '',
					configs: [{ name: 'profile_based_restricted_reply_time_frame', value: 345600000 }],
				},
			],
			'enabled',
		);

		expect(list).toEqual([
			{ module: 'users', action: 'delete', status: 'enabled' },
			{
				module: 'direct_message',
				status: 'enabled',
				configs: [{ name: 'profile_based_restricted_reply_time_frame', value: 345600000 }],
			},
		]);
	});

	it('should throw when buildIntentListFromTemplate receives invalid list input', () => {
		expect(() =>
			buildIntentListFromTemplate(mockExecuteFunctions, 0, 'bad-list', 'enabled'),
		).toThrow(NodeOperationError);
	});

	it('should throw when buildIntentListFromTemplate receives non-object entry', () => {
		expect(() =>
			buildIntentListFromTemplate(mockExecuteFunctions, 0, ['bad-entry'], 'enabled'),
		).toThrow(NodeOperationError);
	});

	it('should throw when included template entry has empty module', () => {
		expect(() =>
			buildIntentListFromTemplate(
				mockExecuteFunctions,
				0,
				[{ module: '', action: 'create', status: 'selected' }],
				'enabled',
			),
		).toThrow(NodeOperationError);
	});

	it('should handle undefined module/action/status fields in intent filtering', () => {
		expect(() =>
			buildIntentListFromTemplate(
				mockExecuteFunctions,
				0,
				[
					{
						module: undefined,
						action: undefined,
						status: undefined,
						configs: [{ name: 'cfg', value: 1 }],
					},
				],
				'enabled',
			),
		).toThrow(NodeOperationError);
	});

	it('should skip stale read-only and unsupported selections in collection', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue: unknown) => {
				if (name === 'adminUsersAndProfilesPermissions') {
					return ['users::get', 'users::create'];
				}
				if (name === 'adminPermissionsPermissions') {
					return ['custom_admin::edit'];
				}
				return defaultValue;
			},
		);

		const list = collectSelectedPermissions(mockExecuteFunctions, 0, 'enabled');
		expect(list).toEqual([{ module: 'users', action: 'create', status: 'enabled' }]);
	});

	it('should keep config entries with meaningful primitive/array/object values', () => {
		const list = buildIntentListFromTemplate(
			mockExecuteFunctions,
			0,
			[
				{
					module: 'direct_message',
					status: '',
					configs: [
						{ name: 'a', value: 1 },
						{ name: 'b', value: [''] },
						{ name: 'c', value: { allow: true } },
					],
				},
			],
			'disabled',
		);

		expect(list).toEqual([
			{
				module: 'direct_message',
				status: 'disabled',
				configs: [
					{ name: 'a', value: 1 },
					{ name: 'c', value: { allow: true } },
				],
			},
		]);
	});

	it('should skip invalid config rows and non-meaningful values in intent list', () => {
		const list = buildIntentListFromTemplate(
			mockExecuteFunctions,
			0,
			[
				{
					module: 'direct_message',
					status: '',
					configs: [
						'bad-config',
						{ value: 999 },
						{ name: '', value: 123 },
						{ name: 'x', value: null },
						{ name: 'y', value: () => 'noop' },
						{ name: 'z', value: { nested: 2 } },
					],
				},
			],
			'enabled',
		);

		expect(list).toEqual([
			{
				module: 'direct_message',
				status: 'enabled',
				configs: [{ name: 'z', value: { nested: 2 } }],
			},
		]);
	});

	it('should ignore config templates with empty config values when filtering', () => {
		const list = buildFilteredTemplateList(mockExecuteFunctions, 0, [
			{
				module: 'organisation_member',
				status: '',
				configs: [{ name: 'custom_rule', value: { enabled: [], disabled: [] } }],
			},
			{
				module: 'direct_message',
				status: '',
				configs: [{ name: 'profile_based_restricted_reply_time_frame', value: '' }],
			},
		]);

		expect(list).toEqual([]);
	});

	it('should filter rows and preserve action/status/config for valid entries', () => {
		const list = buildFilteredTemplateList(mockExecuteFunctions, 0, [
			{ module: 'users', action: 'delete', status: 'disabled' },
			{ module: 'team_channels', action: '', status: 'enabled' },
			{
				module: 'organisation_member',
				status: '',
				configs: [{ name: 'custom_rule', value: { enabled: ['message'], disabled: [] } }],
			},
		]);

		expect(list).toEqual([
			{ module: 'users', action: 'delete', status: 'disabled' },
			{ module: 'team_channels', status: 'enabled' },
			{
				module: 'organisation_member',
				configs: [{ name: 'custom_rule', value: { enabled: ['message'], disabled: [] } }],
			},
		]);
	});

	it('should throw when buildFilteredTemplateList receives invalid list input', () => {
		expect(() => buildFilteredTemplateList(mockExecuteFunctions, 0, null)).toThrow(
			NodeOperationError,
		);
	});

	it('should handle undefined module/action/status fields in filtered output', () => {
		expect(() =>
			buildFilteredTemplateList(mockExecuteFunctions, 0, [
				{
					module: undefined,
					action: undefined,
					status: undefined,
					configs: [{ name: 'cfg', value: 1 }],
				},
			]),
		).toThrow(NodeOperationError);
	});

	it('should throw when filtered list entry is not an object', () => {
		expect(() => buildFilteredTemplateList(mockExecuteFunctions, 0, ['bad-entry'])).toThrow(
			NodeOperationError,
		);
	});

	it('should throw when filtered entry has invalid status value', () => {
		expect(() =>
			buildFilteredTemplateList(mockExecuteFunctions, 0, [
				{ module: 'users', action: 'create', status: 'maybe' },
			]),
		).toThrow(NodeOperationError);
	});

	it('should throw when included filtered entry has empty module', () => {
		expect(() =>
			buildFilteredTemplateList(mockExecuteFunctions, 0, [{ module: '', status: 'enabled' }]),
		).toThrow(NodeOperationError);
	});

	it('should ignore invalid option values when building template list', () => {
		const injected = {
			name: 'injectedInvalidGroup',
			section: 'admin',
			displayName: 'Injected Invalid Group',
			description: 'for test',
			options: [{ name: 'Invalid', value: 'badvalue' }],
		};
		(permissionGroupDefinitions as Array<typeof injected>).push(injected);
		try {
			const list = buildPermissionsTemplateList();
			expect(list.find((entry) => entry.module === 'badvalue')).toBeUndefined();
		} finally {
			permissionGroupDefinitions.pop();
		}
	});
});
