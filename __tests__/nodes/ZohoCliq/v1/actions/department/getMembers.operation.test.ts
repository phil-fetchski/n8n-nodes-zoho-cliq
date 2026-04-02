import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as getMembers from '../../../../../../nodes/ZohoCliq/v1/actions/department/getMembers.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - Get Members Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const operationScope = getRequiredScopeForOperation('department', 'getMembers');
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			departmentId?: string;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const { departmentId = 'dept_123', enableAiErrorMode = false, continueOnFail = false } = values;

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

	it('should get department members successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ email_id: 'user@example.com', id: '123456789' }],
		});

		const result = await getMembers.execute.call(context, items, operationScope);

		expect(result[0].json).toEqual({
			data: [{ email_id: 'user@example.com', id: '123456789' }],
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/departments/dept_123/members',
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();

		let thrownError: unknown;
		try {
			await getMembers.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [operationScope],
				missingScopes: [operationScope],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	});

	it('should reject invalid department IDs', async () => {
		const context = createContext({ departmentId: 'invalid id' });

		await expect(getMembers.execute.call(context, items, operationScope)).rejects.toThrow(
			'Invalid Department ID format',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			departmentId: 'bad id',
			continueOnFail: true,
		});

		const result = await getMembers.execute.call(context, items, operationScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'getMembers',
				department_id: 'bad id',
				reason: 'INVALID_DEPARTMENT_ID',
			}),
		);
	});

	it('should short-circuit with a recoverable department-not-found error before the members request', async () => {
		const context = createContext({
			departmentId: 'dept_missing',
			continueOnFail: true,
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await getMembers.execute.call(context, items, operationScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'getMembers',
				department_id: 'dept_missing',
				reason: 'DEPARTMENT_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockRejectedValueOnce({
				statusCode: 404,
				message: 'department_not_exist',
			});

		const result = await getMembers.execute.call(context, items, operationScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'getMembers',
				department_id: 'dept_123',
				status_code: 404,
				reason: 'NOT_FOUND',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(getMembers.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'getDepartmentMembersDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'getDepartmentMembersAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
