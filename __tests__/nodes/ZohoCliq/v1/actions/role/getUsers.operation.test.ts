import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as getUsers from '../../../../../../nodes/ZohoCliq/v1/actions/role/getUsers.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - Get Users Operation', () => {
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

	it('should get users in role successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ user_id: '62913657' }] });

		const result = await getUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_READ,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [{ user_id: '62913657' }] });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles/role_123/users');
	});

	it('should return empty object when API response is nullish', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue(undefined as never);

		const result = await getUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_READ,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({});
	});

	it('should throw error for invalid role ID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role/123';
				return defaultValue;
			},
		);

		await expect(
			getUsers.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_READ),
		).rejects.toThrow('Invalid Role ID format');
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'getUsers';
			if (name === 'roleId') return 'role_123';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await getUsers.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'getUsers',
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

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return itemIndex === 0 ? 'role/invalid' : 'role_123';
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ data: [{ user_id: 'u1' }] });

		const result = await getUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_READ,
		);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			message: 'Invalid Role ID format',
			resource: 'role',
			operation: 'getUsers',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
		});
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[1].json).toEqual({ data: [{ user_id: 'u1' }] });
	});

	it('should recover invalid role id when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role/invalid';
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);

		const result = await getUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_READ,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getUsers',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
			message: 'Invalid Role ID format',
		});
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should recover not found API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_404';
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({
			profiles: [{ id: 'role_123', name: 'Admin' }],
		});

		const result = await getUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_READ,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getUsers',
			reason: 'ROLE_NOT_FOUND',
			role_id: 'role_404',
			message: 'Role not found. The role ID provided does not exist in this organization.',
			hint: 'Use List Roles to retrieve valid role IDs and try again.',
		});
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should recover admin-only API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockRejectedValueOnce({
				response: {
					status: 403,
					data: { message: 'operation_not_allowed' },
				},
			});

		const result = await getUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_READ,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getUsers',
			reason: 'ROLE_USERS_READ_NOT_ALLOWED',
			role_id: 'role_123',
		});
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should recover not-an-organization-admin API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockRejectedValueOnce(new Error('not_an_organization_admin'));

		const result = await getUsers.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_READ,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'getUsers',
			reason: 'ROLE_USERS_READ_NOT_ALLOWED',
			role_id: 'role_123',
		});
		expect(result[0].json).not.toHaveProperty('error');
	});
});
