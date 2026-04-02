import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/department/list.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - List Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			additionalFields?: Record<string, unknown>;
			simplify?: unknown;
			simplifyMode?: unknown;
			simplifyFields?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			additionalFields = {},
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'additionalFields') return additionalFields;
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

	it('should list departments successfully', async () => {
		const context = createContext({
			additionalFields: {
				limit: 25,
				search: 'Engineering',
				nextToken: 'next_123',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			data: [
				{ id: 'dept_1', name: 'Engineering' },
				{ id: 'dept_2', name: 'Marketing' },
			],
			next_token: 'next_456',
		});

		const result = await list.execute.call(context, items, SCOPES.DEPARTMENT_LIST);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			data: [
				{ id: 'dept_1', name: 'Engineering' },
				{ id: 'dept_2', name: 'Marketing' },
			],
			next_token: 'next_456',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/departments',
			{},
			{ limit: 25, search: 'Engineering', next_token: 'next_123' },
		);
	});

	it('should omit blank optional search and next token values', async () => {
		const context = createContext({
			additionalFields: {
				search: '   ',
				nextToken: '   ',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ id: 'dept_1' }] });

		await list.execute.call(context, items, SCOPES.DEPARTMENT_LIST);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/departments', {}, {});
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('department', 'list');

		let thrownError: unknown;
		try {
			await list.execute.call(context, items, '');
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

	it('should reject invalid limit values', async () => {
		const context = createContext({
			additionalFields: { limit: 0 },
		});

		await expect(list.execute.call(context, items, SCOPES.DEPARTMENT_LIST)).rejects.toThrow(
			'Limit must be a whole number between 1 and 100',
		);
	});

	it('should reject overlong next tokens', async () => {
		const context = createContext({
			additionalFields: { nextToken: 'a'.repeat(1025) },
		});

		await expect(list.execute.call(context, items, SCOPES.DEPARTMENT_LIST)).rejects.toThrow(
			'Next Token is too long',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			additionalFields: { limit: 101 },
			continueOnFail: true,
		});

		const result = await list.execute.call(context, items, SCOPES.DEPARTMENT_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'list',
				reason: 'INVALID_LIMIT',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable next token validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			additionalFields: { nextToken: 'a'.repeat(1025) },
			continueOnFail: true,
		});

		const result = await list.execute.call(context, items, SCOPES.DEPARTMENT_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'list',
				next_token: '[REDACTED]',
				reason: 'INVALID_NEXT_TOKEN',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({
			additionalFields: { search: 'Engineering' },
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 500,
			message: 'department_list_failed',
		});

		const result = await list.execute.call(context, items, SCOPES.DEPARTMENT_LIST);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'list',
				search: 'Engineering',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(list.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'listDepartmentsDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'listDepartmentsAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});

	it('should expose the additional fields collection placeholder', () => {
		expect(list.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'additionalFields',
					type: 'collection',
					placeholder: 'Add Additional Fields',
				}),
			]),
		);
	});
});
