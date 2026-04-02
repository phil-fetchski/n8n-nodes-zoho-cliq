import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/role/delete.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const acceptedDeleteScopes = ['ZohoCliq.Organisation.UPDATE', 'ZohoCliq.Organisation.DELETE'];

describe('ZohoCliq - Role - Delete Operation', () => {
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

	it('should delete role successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'role_123', is_default: false } })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/profiles/role_123',
		);
		expect(result[0].json).toMatchObject({
			deleted: true,
			role_id: 'role_123',
			success: true,
			resource: 'role',
			operation: 'delete',
		});
	});

	it('should delete role successfully with Organisation.DELETE scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'role_123', is_default: false } })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Organisation.DELETE',
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			deleted: true,
			role_id: 'role_123',
			success: true,
			resource: 'role',
			operation: 'delete',
		});
	});

	it('should delete role successfully with Organisation.ALL scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'role_123', is_default: false } })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(mockExecuteFunctions, items, 'ZohoCliq.Organisation.ALL');

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			deleted: true,
			role_id: 'role_123',
			success: true,
			resource: 'role',
			operation: 'delete',
		});
	});

	it('should delete role successfully when preflight returns root-level is_default false', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'role_123', is_default: false })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			deleted: true,
			role_id: 'role_123',
			success: true,
			resource: 'role',
			operation: 'delete',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/profiles/role_123',
		);
	});

	it('should delete role successfully when preflight response has no is_default field', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'role_123', name: 'Custom Role' })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(result[0].json).toMatchObject({
			deleted: true,
			role_id: 'role_123',
			success: true,
			resource: 'role',
			operation: 'delete',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/profiles/role_123',
		);
	});

	it('should delete role successfully when nested preflight candidate has no boolean is_default field', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'role_123', is_default: 'false', name: 'Custom Role' } })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(result[0].json).toMatchObject({
			deleted: true,
			role_id: 'role_123',
			success: true,
			resource: 'role',
			operation: 'delete',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/profiles/role_123',
		);
	});

	it('should delete role successfully when preflight response is null', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		(mockZohoCliqApiRequest as jest.Mock).mockImplementationOnce(async () => null);
		mockZohoCliqApiRequest.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(result[0].json).toMatchObject({
			deleted: true,
			role_id: 'role_123',
			success: true,
			resource: 'role',
			operation: 'delete',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/profiles/role_123',
		);
	});

	it('should throw error for empty role ID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('');

		await expect(del.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Role ID is required',
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'delete';
			if (name === 'roleId') return 'role_123';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await del.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'delete',
			requiredScopes: acceptedDeleteScopes,
			missingScopes: acceptedDeleteScopes,
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number) => {
				if (name === 'roleId') {
					return itemIndex === 0 ? '' : 'role_123';
				}
				if (name === 'includeEnhancedOutput') {
					return true;
				}
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'role_123', is_default: false } })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			message: 'Role ID is required',
			resource: 'role',
			operation: 'delete',
			reason: 'INVALID_ROLE_ID',
		});
		expect(result[1].json).toMatchObject({
			success: true,
			role_id: 'role_123',
		});
	});

	it('should return raw API response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'role_123', is_default: false } })
			.mockResolvedValueOnce({ data: '' });

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should return recoverable validation payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return '';
			if (name === 'includeEnhancedOutput') return true;
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'delete',
			reason: 'INVALID_ROLE_ID',
			message: 'Role ID is required',
		});
	});

	it('should recover not-found API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			profiles: [{ id: 'role_999', name: 'Other Role' }],
		});

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'delete',
			reason: 'ROLE_NOT_FOUND',
			role_id: 'role_123',
			message: 'Role not found. The role ID provided does not exist in this organization.',
			hint: 'Use List Roles to retrieve valid role IDs and try again.',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
	});

	it('should recover delete-permission API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue(new Error('not_an_organization_admin'));

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'delete',
			reason: 'ROLE_DELETE_NOT_ALLOWED',
			role_id: 'role_123',
		});
	});

	it('should stop before delete when the preflight get finds a default role', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: { id: 'role_123', is_default: true } });

		await expect(
			del.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toThrow(
			'Default Zoho Cliq roles cannot be deleted. Only custom roles can be deleted.',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles/role_123');
	});

	it('should stop before delete when the preflight get finds a root-level default role', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'role_123', is_default: true });

		await expect(
			del.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toThrow(
			'Default Zoho Cliq roles cannot be deleted. Only custom roles can be deleted.',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles/role_123');
	});

	it('should rethrow non-object preflight errors that do not match not-found detection', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue(42);

		await expect(
			del.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toBe(42);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles/role_123');
	});

	it('should return recoverable default-role delete error when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'includeEnhancedOutput') return true;
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Default Role' }] })
			.mockResolvedValueOnce({ data: { id: 'role_123', is_default: true } });

		const result = await del.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'delete',
			reason: 'DEFAULT_ROLE_DELETE_NOT_ALLOWED',
			role_id: 'role_123',
			message: 'Default Zoho Cliq roles cannot be deleted. Only custom roles can be deleted.',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles', {}, {});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'GET', '/api/v2/profiles/role_123');
	});
});
