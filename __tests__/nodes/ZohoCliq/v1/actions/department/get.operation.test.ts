import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/department/get.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - Get Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			departmentId?: string;
			simplify?: unknown;
			simplifyMode?: unknown;
			simplifyFields?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			departmentId = 'dept_123',
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(
					parameterName: string,
					_itemIndex?: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (parameterName === 'departmentId' && options?.extractValue) {
						return departmentId;
					}
					if (parameterName === 'departmentId') {
						return { mode: 'id', value: departmentId };
					}
					if (parameterName === 'simplify') return simplify;
					if (parameterName === 'simplifyMode') return simplifyMode;
					if (parameterName === 'simplifyFields') return simplifyFields;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should get department successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				id: 'dept_123',
				name: 'Engineering',
				parent_department_id: 'dept_root',
			},
		});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual({
			data: {
				id: 'dept_123',
				name: 'Engineering',
				parent_department_id: 'dept_root',
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/departments/dept_123');
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('department', 'get');

		let thrownError: unknown;
		try {
			await get.execute.call(context, items, '');
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
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	});

	it('should reject invalid department IDs', async () => {
		const context = createContext({ departmentId: 'invalid id' });

		await expect(get.execute.call(context, items, SCOPES.DEPARTMENTS_READ)).rejects.toThrow(
			'Invalid Department ID format',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			departmentId: 'bad id',
			continueOnFail: true,
		});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'bad id',
				reason: 'INVALID_DEPARTMENT_ID',
			}),
		);
	});

	it('should return a recoverable department-not-found error from the get request', async () => {
		const context = createContext({
			departmentId: 'dept_missing',
			continueOnFail: true,
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_missing',
				reason: 'DEPARTMENT_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/departments',
			{},
			{ limit: 100 },
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				reason: 'DEPARTMENT_NOT_FOUND',
				hint: 'Use List Departments to discover valid IDs before retrying.',
			}),
		);
	});

	it('should map main-request 404 get errors to department-not-found after shared preflight validates the department', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce({
				response: { status: 404 },
				message: 'Request failed with status code 404',
			});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				reason: 'DEPARTMENT_NOT_FOUND',
				hint: 'Use List Departments to discover valid IDs before retrying.',
			}),
		);
	});

	it('should map direct statusCode 404 get errors to department-not-found after shared preflight validates the department', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce({
				statusCode: 404,
				message: 'Request failed with status code 404',
			});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				reason: 'DEPARTMENT_NOT_FOUND',
				hint: 'Use List Departments to discover valid IDs before retrying.',
			}),
		);
	});

	it('should map response.statusCode 404 get errors to department-not-found after shared preflight validates the department', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce({
				response: { statusCode: 404 },
				message: 'Request failed with status code 404',
			});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				reason: 'DEPARTMENT_NOT_FOUND',
				hint: 'Use List Departments to discover valid IDs before retrying.',
			}),
		);
	});

	it('should keep plain-text main-request get errors generic after shared preflight validates the department', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce('plain-text-error');

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				message: 'plain-text-error',
			}),
		);
		expect(result[0].json).not.toHaveProperty('reason', 'DEPARTMENT_NOT_FOUND');
	});

	it('should keep non-object response get errors generic after shared preflight validates the department', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce({
				response: 'not-an-object',
				message: 'odd-response-shape',
			});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				message: 'odd-response-shape',
			}),
		);
		expect(result[0].json).not.toHaveProperty('reason', 'DEPARTMENT_NOT_FOUND');
	});

	it('should keep non-numeric response status get errors generic after shared preflight validates the department', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce({
				response: { status: '404' },
				message: 'weird-response-status',
			});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				message: 'weird-response-status',
			}),
		);
		expect(result[0].json).not.toHaveProperty('reason', 'DEPARTMENT_NOT_FOUND');
	});

	it('should map Zoho invalid-department get errors to invalid-department-id in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce({
				response: { status: 400 },
				message: 'Sorry, we are unable to display your departments now. Please try again later',
			});

		const result = await get.execute.call(context, items, SCOPES.DEPARTMENTS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'get',
				department_id: 'dept_123',
				status_code: 400,
				reason: 'INVALID_DEPARTMENT_ID',
				hint: 'Use the exact Zoho Cliq department ID for the department you want to retrieve.',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(get.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'getDepartmentDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'getDepartmentAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
