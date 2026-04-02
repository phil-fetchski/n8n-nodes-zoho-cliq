import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as addPermissions from '../../../../../../nodes/ZohoCliq/v1/actions/role/addPermissions.operation';
import * as permissionsUi from '../../../../../../nodes/ZohoCliq/v1/actions/role/permissionsUi';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - Add Permissions Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should enable selected permissions', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create'];
				return defaultValue ?? [];
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'ok' });

		await addPermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [{ module: 'users', action: 'create', status: 'enabled' }],
			},
		);
	});

	it('should output enhanced payload only when output toggle is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return true;
				if (name === 'enableEnhancedOutput') return true;
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create'];
				return defaultValue ?? [];
			},
		);

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);
		expect(result[0].json).toMatchObject({
			success: true,
			resource: 'role',
			operation: 'addPermissions',
			outputOnly: true,
			method: 'PUT',
			endpoint: '/api/v2/profiles/role_123/permissions',
		});
		expect(result[0].json).toHaveProperty('payload');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return raw API response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const apiResponse = { status: 'ok', applied: true };
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return false;
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create'];
				return defaultValue ?? [];
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue(apiResponse);

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toEqual(apiResponse);
	});

	it('should throw when no permissions are selected', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				return defaultValue ?? [];
			},
		);

		await expect(
			addPermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toBeInstanceOf(NodeOperationError);
	});

	it('should reject malformed selected permission entries before API call', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const collectSpy = jest
			.spyOn(permissionsUi, 'collectSelectedPermissions')
			.mockReturnValue([{ module: undefined, action: undefined, status: undefined }] as never);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return true;
				return defaultValue ?? [];
			},
		);
		await expect(
			addPermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toBeInstanceOf(NodeOperationError);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();

		collectSpy.mockRestore();
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return true;
				if (name === 'adminUsersAndProfilesPermissions') {
					return itemIndex === 0 ? [] : ['users::create'];
				}
				return defaultValue ?? [];
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'ok' });

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'addPermissions',
			reason: 'NO_PERMISSIONS_SELECTED',
			role_id: 'role_123',
			message: 'Select at least one permission to add.',
		});
		expect(result[1].json).toMatchObject({
			success: true,
			resource: 'role',
			operation: 'addPermissions',
			operationIntent: 'addPermissions',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should recover missing permission selection when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				return defaultValue ?? [];
			},
		);

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'addPermissions',
			reason: 'NO_PERMISSIONS_SELECTED',
			role_id: 'role_123',
			message: 'Select at least one permission to add.',
		});
	});

	it('should recover invalid structured permission selections when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create::bad'];
				return defaultValue ?? [];
			},
		);

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'addPermissions',
			reason: 'INVALID_PERMISSION_SELECTION',
			role_id: 'role_123',
		});
	});

	it('should recover invalid role id when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role/invalid';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create'];
				return defaultValue ?? [];
			},
		);

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'addPermissions',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
		});
	});

	it('should recover admin-only API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create'];
				return defaultValue ?? [];
			},
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 403,
				data: { message: 'operation_not_allowed' },
			},
		});

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'addPermissions',
			reason: 'ROLE_PERMISSIONS_UPDATE_NOT_ALLOWED',
			role_id: 'role_123',
		});
	});

	it('should recover not-an-organization-admin API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'outputUpdatePayloadOnly') return false;
				if (name === 'enableEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				if (name === 'adminUsersAndProfilesPermissions') return ['users::create'];
				return defaultValue ?? [];
			},
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 403,
				data: { message: 'not_an_organization_admin' },
			},
		});

		const result = await addPermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'addPermissions',
			reason: 'ROLE_PERMISSIONS_UPDATE_NOT_ALLOWED',
			role_id: 'role_123',
		});
	});

	it('should recover missing-scope errors without role context when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'resource') return 'role';
				if (name === 'operation') return 'addPermissions';
				if (name === 'enableAiErrorMode') return true;
				return defaultValue ?? [];
			},
		);

		const result = await addPermissions.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'addPermissions',
			requiredScopes: [SCOPES.ORGANISATION_UPDATE],
			missingScopes: [SCOPES.ORGANISATION_UPDATE],
		});
		expect(result[0].json).not.toHaveProperty('role_id');
	});
});
