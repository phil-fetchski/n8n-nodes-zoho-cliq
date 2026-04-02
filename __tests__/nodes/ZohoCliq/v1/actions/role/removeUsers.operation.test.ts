import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as removeUsers from '../../../../../../nodes/ZohoCliq/v1/actions/role/removeUsers.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const acceptedRemoveUsersScopes = ['ZohoCliq.Organisation.UPDATE', 'ZohoCliq.Organisation.DELETE'];

describe('ZohoCliq - Role - Remove Users Operation', () => {
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

	it('should remove users from role successfully with enhanced output', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return '62913657,63569660';
				if (name === 'includeEnhancedOutput') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/profiles/role_123/users',
			{
				user_ids: ['62913657', '63569660'],
			},
		);
		expect(result[0].json).toMatchObject({
			deleted: true,
			success: true,
			resource: 'role',
			operation: 'removeUsers',
			role_id: 'role_123',
			removed_user_ids: ['62913657', '63569660'],
			count: 2,
			status: 'success',
		});
	});

	it('should remove users from role successfully with Organisation.DELETE scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return '62913657';
				if (name === 'includeEnhancedOutput') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Organisation.DELETE',
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			deleted: true,
			success: true,
			resource: 'role',
			operation: 'removeUsers',
			role_id: 'role_123',
			removed_user_ids: ['62913657'],
			count: 1,
		});
	});

	it('should remove users from role successfully with Organisation.ALL scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return '62913657';
				if (name === 'includeEnhancedOutput') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Organisation.ALL',
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			deleted: true,
			success: true,
			resource: 'role',
			operation: 'removeUsers',
			role_id: 'role_123',
			removed_user_ids: ['62913657'],
			count: 1,
		});
	});

	it('should return raw API response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const apiResponse = { status: 'success', removed: true };

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return '62913657';
				if (name === 'includeEnhancedOutput') return false;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue(apiResponse);

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toEqual({ ...apiResponse, deleted: true });
	});

	it('should handle empty remove users response payload safely', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return '62913657';
				if (name === 'includeEnhancedOutput') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue(undefined as never);

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			deleted: true,
			success: true,
			resource: 'role',
			operation: 'removeUsers',
			role_id: 'role_123',
			removed_user_ids: ['62913657'],
			count: 1,
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'removeUsers';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await removeUsers.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'role',
			operation: 'removeUsers',
			requiredScopes: acceptedRemoveUsersScopes,
			missingScopes: acceptedRemoveUsersScopes,
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return itemIndex === 0 ? 'role/invalid' : 'role_123';
				if (name === 'userIds') return '62913657';
				if (name === 'includeEnhancedOutput') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'removeUsers',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
			user_ids: '62913657',
		});
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[1].json).toMatchObject({
			success: true,
			role_id: 'role_123',
			removed_user_ids: ['62913657'],
		});
	});

	it('should recover invalid user IDs when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return 'bad/id';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'removeUsers',
			reason: 'INVALID_USER_IDS',
			role_id: 'role_123',
			user_ids: 'bad/id',
		});
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should recover missing user IDs via Users endpoint preflight when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return '62913657,63569660';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockImplementation(async (method, endpoint) => {
			if (method === 'GET' && endpoint === '/api/v2/profiles') {
				return { profiles: [{ id: 'role_123', name: 'Members' }] };
			}
			if (method === 'GET' && endpoint === '/api/v2/users') {
				return {
					users: [{ user_id: '62913657', display_name: 'Valid User' }],
				};
			}
			throw new Error(`Unexpected request: ${method} ${endpoint}`);
		});

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'removeUsers',
			reason: 'USER_IDS_NOT_FOUND',
			role_id: 'role_123',
			user_ids: ['62913657', '63569660'],
			invalid_user_ids: ['63569660'],
			message:
				'One or more user IDs were not found. The provided user IDs do not exist in this organization.',
			hint: 'Use Get User or List Users to retrieve valid user IDs and try again.',
		});
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/profiles/role_123/users',
			expect.anything(),
		);
	});

	it('should recover not found API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_404';
				if (name === 'userIds') return '62913657';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({
			profiles: [{ id: 'role_123', name: 'Admin' }],
		});

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'removeUsers',
			reason: 'ROLE_NOT_FOUND',
			role_id: 'role_404',
			user_ids: ['62913657'],
			message: 'Role not found. The role ID provided does not exist in this organization.',
			hint: 'Use List Roles to retrieve valid role IDs and try again.',
		});
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
	});

	it('should recover admin-only API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'userIds') return '62913657';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockRejectedValueOnce(new Error('not_an_organization_admin'));

		const result = await removeUsers.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'removeUsers',
			reason: 'ROLE_USERS_UPDATE_NOT_ALLOWED',
			role_id: 'role_123',
			user_ids: ['62913657'],
		});
		expect(result[0].json).not.toHaveProperty('error');
	});
});
