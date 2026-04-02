import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/userFields/delete.operation';
import {
	USER_FIELD_NOT_FOUND_ERROR_CODE,
	USER_FIELD_NOT_FOUND_HINT,
	USER_FIELD_NOT_FOUND_MESSAGE,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserFields - Delete Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should delete user field successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				includeEnhancedOutput: true,
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockResolvedValue({});

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/userfields/UF_123456');
		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'userFields',
			operation: 'delete',
			field_id: 'UF_123456',
		});
	});

	it('should return raw response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				includeEnhancedOutput: false,
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result[0].json).toEqual({ deleted: true, status: 'success' });
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('userFields', 'delete');
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
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should throw error for invalid field ID format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_DELETE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return 'bad/id';
			}
			return undefined;
		});

		await expect(del.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Invalid User Field ID format',
		);
	});

	it('should return item error payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_DELETE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return '9999999999999999999';
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				status: 400,
				data: {
					message:
						'Our processor went cold :feeling-cold: <br> Try again in a few minutes to view all user fields.',
				},
			},
		});

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'delete',
				field_id: '9999999999999999999',
				message: USER_FIELD_NOT_FOUND_MESSAGE,
				reason: USER_FIELD_NOT_FOUND_ERROR_CODE,
				hint: USER_FIELD_NOT_FOUND_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/userfields/9999999999999999999',
		);
	});

	it('should return a stable invalid-user-field-id payload when continueOnFail is enabled for local validation failures', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_DELETE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return 'bad/id';
			}
			return undefined;
		});

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'delete',
				reason: 'INVALID_USER_FIELD_ID',
				hint: 'Use the exact field_id for the user field you want to delete.',
			}),
		);
	});

	it('should fail fast for system-defined user fields in recoverable mode when preflight can prove the target metadata', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_DELETE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: '5452022000000153041',
				includeEnhancedOutput: true,
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: { id: '5452022000000153041', system_defined: true },
		});

		const result = await del.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'delete',
				field_id: '5452022000000153041',
				reason: 'SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED',
				message: 'System-defined user fields cannot be deleted.',
				hint: 'Delete is only supported for custom user fields where system_defined is false.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/userfields/5452022000000153041',
		);
	});

	it('should run shared user-field preflight before delete when lookup scope is available', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_DELETE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				includeEnhancedOutput: true,
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: { id: 'UF_123456' } });
		mockZohoCliqApiRequest.mockResolvedValueOnce({});

		await del.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/userfields/UF_123456',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/userfields/UF_123456',
		);
	});

	it('should keep description property displayOptions merged on each field', () => {
		for (const property of del.description) {
			expect(property.displayOptions).toBeDefined();
			expect(property.displayOptions?.show).toMatchObject({
				resource: ['userField'],
				operation: ['delete'],
			});
		}
	});
});
