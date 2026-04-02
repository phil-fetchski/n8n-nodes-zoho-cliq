import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/department/create.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - Create Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			inputMode?: unknown;
			name?: string;
			leadZuid?: string;
			parentDepartmentId?: string;
			userIds?: string;
			departmentDefinition?: unknown;
			simplify?: unknown;
			simplifyMode?: unknown;
			simplifyFields?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			inputMode = 'structured',
			name = 'Engineering',
			leadZuid = '631830849',
			parentDepartmentId = '1901318000001424001',
			userIds = '',
			departmentDefinition,
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'name') return name;
					if (parameterName === 'leadZuid') return leadZuid;
					if (parameterName === 'parentDepartmentId') return parentDepartmentId;
					if (parameterName === 'userIds') return userIds;
					if (parameterName === 'departmentDefinition') return departmentDefinition ?? fallback;
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

	it('should create department successfully in structured mode', async () => {
		const context = createContext({
			userIds: '123456789,987654321',
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			data: {
				id: '1901318000002280001',
				name: 'Engineering',
				lead_zuid: '631830849',
				parent_department_id: '1901318000001424001',
			},
		});

		const result = await create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE);

		expect(result[0].json).toEqual({
			data: {
				id: '1901318000002280001',
				name: 'Engineering',
				lead_zuid: '631830849',
				parent_department_id: '1901318000001424001',
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/departments', {
			name: 'Engineering',
			lead_zuid: '631830849',
			parent_department_id: '1901318000001424001',
			user_ids: ['123456789', '987654321'],
		});
	});

	it('should create department successfully in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentDefinition: {
				name: 'Platform',
				lead_zuid: '9988776655',
				parent_department_id: 'dept_parent_1',
				user_ids: ['123456789'],
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ data: { id: 'DEPT_1', name: 'Platform' } });

		await create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/departments', {
			name: 'Platform',
			lead_zuid: '9988776655',
			parent_department_id: 'dept_parent_1',
			user_ids: ['123456789'],
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('department', 'create');

		let thrownError: unknown;
		try {
			await create.execute.call(context, items, '');
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

	it('should reject missing parent department id in structured mode', async () => {
		const context = createContext({
			parentDepartmentId: '   ',
		});

		await expect(create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE)).rejects.toThrow(
			'Parent Department ID is required',
		);
	});

	it('should reject unsupported raw payload fields', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentDefinition: {
				name: 'Engineering',
				lead_zuid: '631830849',
				parent_department_id: '1901318000001424001',
				description: 'unsupported',
			},
		});

		await expect(create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE)).rejects.toThrow(
			'contains unsupported field "description"',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			parentDepartmentId: '',
			continueOnFail: true,
		});

		const result = await create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'create',
				department_name: 'Engineering',
				lead_zuid: '631830849',
				reason: 'INVALID_PARENT_DEPARTMENT_ID',
				hint: 'Provide the exact parent department ID from Zoho Cliq.',
			}),
		);
	});

	it('should return a recoverable validation error for missing lead zuid in structured mode', async () => {
		const context = createContext({
			leadZuid: '',
			continueOnFail: true,
		});

		const result = await create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'create',
				department_name: 'Engineering',
				parent_department_id: '1901318000001424001',
				reason: 'INVALID_LEAD_ZUID',
			}),
		);
	});

	it('should return a recoverable validation error for raw payloads with non-string context fields', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentDefinition: {
				name: 12345,
				lead_zuid: 12345,
				parent_department_id: 67890,
			},
			continueOnFail: true,
		});

		const result = await create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'create',
				reason: 'INVALID_LEAD_ZUID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('department_name');
		expect(result[0].json).not.toHaveProperty('lead_zuid');
		expect(result[0].json).not.toHaveProperty('parent_department_id');
	});

	it('should short-circuit with a recoverable parent-department-not-found error before create', async () => {
		const context = createContext({
			continueOnFail: true,
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: [{ id: '631830849' }],
			})
			.mockResolvedValueOnce({
				data: [],
			});

		const result = await create.execute.call(
			context,
			items,
			`${SCOPES.DEPARTMENTS_CREATE},${SCOPES.DEPARTMENTS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'create',
				department_name: 'Engineering',
				lead_zuid: '631830849',
				parent_department_id: '1901318000001424001',
				reason: 'PARENT_DEPARTMENT_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should short-circuit with a recoverable users-not-found error before create', async () => {
		const context = createContext({
			userIds: 'missing_user',
			continueOnFail: true,
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: [{ id: '631830849' }],
			})
			.mockResolvedValueOnce({
				data: [{ id: '1901318000001424001' }],
			})
			.mockResolvedValueOnce({
				data: [{ id: 'known_user' }],
			});

		const result = await create.execute.call(
			context,
			items,
			`${SCOPES.DEPARTMENTS_CREATE},${SCOPES.DEPARTMENTS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'create',
				department_name: 'Engineering',
				lead_zuid: '631830849',
				parent_department_id: '1901318000001424001',
				user_ids: ['missing_user'],
				reason: 'USERS_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(3);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'department_lead_invalid',
		});

		const result = await create.execute.call(context, items, SCOPES.DEPARTMENTS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'create',
				department_name: 'Engineering',
				lead_zuid: '631830849',
				parent_department_id: '1901318000001424001',
				status_code: 400,
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(create.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'createDepartmentDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'createDepartmentAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
