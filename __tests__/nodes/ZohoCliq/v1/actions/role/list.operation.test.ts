import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/role/list.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - List Operation', () => {
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

	it('should list roles successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		mockZohoCliqApiRequest.mockResolvedValue({ roles: [] });

		const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles');
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const requiredScope = getRequiredScopeForOperation('role', 'list');
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'list';
			return undefined;
		});

		let thrownError: unknown;
		try {
			await list.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'list',
			requiredScopes: [requiredScope],
			missingScopes: [requiredScope],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);
		const grantedScopes = SCOPES.ORGANISATION_READ;
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('list failed'))
			.mockResolvedValueOnce({ roles: [{ id: 'role_123' }] });

		const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			message: 'list failed',
			resource: 'role',
			operation: 'list',
		});
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[1].json).toMatchObject({
			roles: [{ id: 'role_123' }],
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should return recoverable scope payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const requiredScope = getRequiredScopeForOperation('role', 'list');

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'list';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await list.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: false,
			resource: 'role',
			operation: 'list',
			requiredScopes: [requiredScope],
			missingScopes: [requiredScope],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});
});
