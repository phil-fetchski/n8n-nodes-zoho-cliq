import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/userFields/get.operation';
import {
	USER_FIELD_NOT_FOUND_ERROR_CODE,
	USER_FIELD_NOT_FOUND_HINT,
	USER_FIELD_NOT_FOUND_MESSAGE,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserFields - Get Operation', () => {
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

	it('should get user field successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return 'UF_123456';
			}
			if (name === 'simplify') {
				return false;
			}
			if (name === 'simplifyMode') {
				return 'simplified';
			}
			if (name === 'simplifyFields') {
				return [];
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'UF_123456', label: 'Employee Code' });

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/userfields/UF_123456');
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('userFields', 'get');
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
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return 'UF bad id';
			}
			return undefined;
		});

		await expect(get.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Invalid User Field ID format',
		);
	});

	it('should return item error payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return '9999999999999999999';
			}
			if (name === 'simplify') {
				return false;
			}
			if (name === 'simplifyMode') {
				return 'simplified';
			}
			if (name === 'simplifyFields') {
				return [];
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 400,
				data: {
					message:
						'Our processor went cold :feeling-cold: <br> Try again in a few minutes to view all user fields.',
				},
			},
		});

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'get',
				field_id: '9999999999999999999',
				message: USER_FIELD_NOT_FOUND_MESSAGE,
				reason: USER_FIELD_NOT_FOUND_ERROR_CODE,
				hint: USER_FIELD_NOT_FOUND_HINT,
				status_code: 400,
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a stable invalid-user-field-id payload when continueOnFail is enabled for local validation failures', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return 'bad/id';
			}
			if (name === 'simplify') {
				return false;
			}
			if (name === 'simplifyMode') {
				return 'simplified';
			}
			if (name === 'simplifyFields') {
				return [];
			}
			return undefined;
		});

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'get',
				reason: 'INVALID_USER_FIELD_ID',
				hint: 'Use the exact field_id returned by Retrieve All User Fields or Retrieve User Field.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should throw a normalized user-field-not-found error for authoritative missing-target failures after the lookup call begins', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return '9999999999999999999';
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 400,
				data: {
					message: 'Request URL is invalid',
				},
			},
		});

		let thrownError: unknown;
		try {
			await get.execute.call(mockExecuteFunctions, items, grantedScopes);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(thrownError).toMatchObject({
			code: USER_FIELD_NOT_FOUND_ERROR_CODE,
			message: USER_FIELD_NOT_FOUND_MESSAGE,
			description: USER_FIELD_NOT_FOUND_HINT,
			zohoCliqInvalidUserFieldId: '9999999999999999999',
		});
	});

	it('should rethrow non-authoritative failures after the lookup call begins', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;
		const apiError = new Error('API failed');

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'fieldId') {
				return '9999999999999999999';
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue(apiError);

		await expect(get.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toBe(
			apiError,
		);
	});

	it('should keep description property displayOptions merged on each field', () => {
		for (const property of get.description) {
			expect(property.displayOptions).toBeDefined();
			const show = property.displayOptions?.show;
			// Properties with their own displayOptions (e.g. simplifyFields) may override the base show
			const hasBaseDisplayOptions = show?.resource !== undefined && show?.operation !== undefined;
			const hasOwnDisplayOptions = show !== undefined && Object.keys(show).length > 0;
			expect(hasBaseDisplayOptions || hasOwnDisplayOptions).toBe(true);
			if (hasBaseDisplayOptions) {
				expect(show).toMatchObject({
					resource: ['userField'],
					operation: ['get'],
				});
			}
		}
	});
});
