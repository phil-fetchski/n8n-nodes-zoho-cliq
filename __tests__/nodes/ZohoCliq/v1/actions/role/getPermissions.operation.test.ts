import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import * as getPermissions from '../../../../../../nodes/ZohoCliq/v1/actions/role/getPermissions.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - Get Permissions Operation', () => {
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

	it('should get role permissions successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('role_123');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'enabled' });

		const result = await getPermissions.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/profiles/role_123/permissions',
		);
	});

	it('should return empty object when API response is nullish', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('role_123');
		mockZohoCliqApiRequest.mockResolvedValue(undefined as unknown as never);

		const result = await getPermissions.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/profiles/role_123/permissions',
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'getPermissions';
			if (name === 'roleId') return 'role_123';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await getPermissions.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'getPermissions',
			requiredScopes: [SCOPES.ORGANISATION_READ],
			missingScopes: [SCOPES.ORGANISATION_READ],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number) => {
				if (name === 'roleId') {
					return itemIndex === 0 ? 'role/invalid' : 'role_123';
				}
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ list: [{ module: 'users' }] });

		const result = await getPermissions.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			message: 'Invalid Role ID format',
			resource: 'role',
			operation: 'getPermissions',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
		});
		expect(result[1].json).toMatchObject({
			list: [{ module: 'users' }],
		});
	});

	it('should recover invalid role id when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role/invalid';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await getPermissions.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getPermissions',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
			message: 'Invalid Role ID format',
		});
	});

	it('should recover not found API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_404';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			profiles: [{ id: 'role_123', name: 'Admin' }],
		});

		const result = await getPermissions.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getPermissions',
			reason: 'ROLE_NOT_FOUND',
			role_id: 'role_404',
			message: 'Role not found. The role ID provided does not exist in this organization.',
			hint: 'Use List Roles to retrieve valid role IDs and try again.',
		});
	});

	it('should recover admin-only API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockRejectedValueOnce({
				response: {
					status: 403,
					data: { message: 'operation_not_allowed' },
				},
			});

		const result = await getPermissions.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getPermissions',
			reason: 'ROLE_PERMISSIONS_READ_NOT_ALLOWED',
			role_id: 'role_123',
		});
	});

	it('should recover not-an-organization-admin API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockRejectedValueOnce({
				response: {
					status: 403,
					data: { message: 'not_an_organization_admin' },
				},
			});

		const result = await getPermissions.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getPermissions',
			reason: 'ROLE_PERMISSIONS_READ_NOT_ALLOWED',
			role_id: 'role_123',
		});
	});
});
