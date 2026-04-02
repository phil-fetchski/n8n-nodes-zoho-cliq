import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/department/delete.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			departmentId?: string;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			departmentId = 'dept_123',
			includeEnhancedOutput = true,
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
					if (parameterName === 'includeEnhancedOutput') return includeEnhancedOutput;
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
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);
	});

	it('should return enhanced output by default for delete', async () => {
		const context = createContext();

		const result = await del.execute.call(context, items, SCOPES.DEPARTMENTS_DELETE);

		expect(result[0].json).toEqual({
			data: '',
			deleted: true,
			success: true,
			resource: 'department',
			operation: 'delete',
			department_id: 'dept_123',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/departments/dept_123');
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });

		const result = await del.execute.call(context, items, SCOPES.DEPARTMENTS_DELETE);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('department', 'delete');

		let thrownError: unknown;
		try {
			await del.execute.call(context, items, '');
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

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			departmentId: 'bad id',
			continueOnFail: true,
		});

		const result = await del.execute.call(context, items, SCOPES.DEPARTMENTS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'delete',
				department_id: 'bad id',
				reason: 'INVALID_DEPARTMENT_ID',
			}),
		);
	});

	it('should short-circuit with a recoverable department-not-found error when read scope is also granted', async () => {
		const context = createContext({
			departmentId: 'dept_missing',
			continueOnFail: true,
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await del.execute.call(
			context,
			items,
			`${SCOPES.DEPARTMENTS_DELETE},${SCOPES.DEPARTMENTS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'delete',
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
		const context = createContext({ enableAiErrorMode: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 500,
			message: 'department_delete_failed',
		});

		const result = await del.execute.call(context, items, SCOPES.DEPARTMENTS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'delete',
				department_id: 'dept_123',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(del.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'deleteDepartmentDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'deleteDepartmentAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
