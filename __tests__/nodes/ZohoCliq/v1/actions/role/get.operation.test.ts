import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/role/get.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - Get Operation', () => {
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

	it('should get role successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('role_123');
		mockZohoCliqApiRequest.mockResolvedValue({ role_id: 'role_123', name: 'Admin' });

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles/role_123');
	});

	it('should throw error for invalid role ID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('role/123');

		await expect(get.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Invalid Role ID format',
		);
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);

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
			.mockResolvedValueOnce({ role_id: 'role_123', name: 'Admin' });

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			message: 'Invalid Role ID format',
			resource: 'role',
			operation: 'get',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
		});
		expect(result[1].json).toMatchObject({
			role_id: 'role_123',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'get';
			if (name === 'roleId') return 'role_123';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await get.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'get',
			requiredScopes: [SCOPES.ORGANISATION_READ],
			missingScopes: [SCOPES.ORGANISATION_READ],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should return recoverable validation payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role/invalid';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'get',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
			message: 'Invalid Role ID format',
		});
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should recover not-found API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			profiles: [{ id: 'role_999', name: 'Other Role' }],
		});

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'get',
			reason: 'ROLE_NOT_FOUND',
			role_id: 'role_123',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
	});
});
