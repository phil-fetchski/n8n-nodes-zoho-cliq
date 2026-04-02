import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/department/update.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - Update Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			departmentId?: string;
			departmentLocator?: IDataObject;
			inputMode?: unknown;
			prefillDepartmentName?: boolean;
			name?: string;
			updateFields?: IDataObject;
			departmentUpdates?: unknown;
			simplify?: unknown;
			simplifyMode?: unknown;
			simplifyFields?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			departmentId = 'dept_123',
			departmentLocator = { mode: 'id', value: departmentId },
			inputMode = 'structured',
			prefillDepartmentName = false,
			name = 'Platform Engineering',
			updateFields = {},
			departmentUpdates,
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
					if (parameterName === 'departmentId' && options?.extractValue) return departmentId;
					if (parameterName === 'departmentId') return departmentLocator;
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'prefillDepartmentName') return prefillDepartmentName;
					if (parameterName === 'name') return name;
					if (parameterName === 'updateFields') return updateFields;
					if (parameterName === 'departmentUpdates') return departmentUpdates ?? fallback;
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

	it('should update department successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual({ updated: true, status: 'success' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/departments/dept_123', {
			name: 'Platform Engineering',
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('department', 'update');

		let thrownError: unknown;
		try {
			await update.execute.call(context, items, '');
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

	it('should auto-prefetch name when it is missing in structured mode', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: ' ',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ name: 'Prefetched Department' })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/departments/dept_123',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/departments/dept_123',
			{
				name: 'Prefetched Department',
			},
		);
	});

	it('should fetch the live department name instead of using locator cachedResultName when prefill is enabled', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: '',
			departmentLocator: {
				mode: 'list',
				value: 'dept_123',
				cachedResultName: 'Cached Department Name',
			},
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ name: 'Live Department Name' })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/departments/dept_123',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/departments/dept_123',
			{
				name: 'Live Department Name',
			},
		);
	});

	it('should prefill name from array candidate after skipping non-object items', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: '',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: ['skip', null, { name: 'Array Candidate Department' }] })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/departments/dept_123',
			{
				name: 'Array Candidate Department',
			},
		);
	});

	it('should prefill name from nested department object response', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: '',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ department: { name: 'Nested Department Name' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/departments/dept_123',
			{
				name: 'Nested Department Name',
			},
		);
	});

	it('should skip blank nested object names and continue to later nested candidates', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: '',
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				department: { name: '   ' },
				result: { name: 'Recovered Result Name' },
			})
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/departments/dept_123',
			{
				name: 'Recovered Result Name',
			},
		);
	});

	it('should throw error when name prefetch fails', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: ' ',
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Not allowed'));

		await expect(update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE)).rejects.toThrow(
			'Auto-prefetch failed',
		);
	});

	it('should throw when prefill cannot resolve name from response', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: '',
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] });

		await expect(update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE)).rejects.toThrow(
			'could not determine the current department name',
		);
	});

	it('should throw when prefill response is non-object', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: '',
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce('invalid-shape' as unknown as IDataObject);

		await expect(update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE)).rejects.toThrow(
			'could not determine the current department name',
		);
	});

	it('should throw when prefill is disabled and name is missing', async () => {
		const context = createContext({
			prefillDepartmentName: false,
			name: ' ',
		});

		await expect(update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE)).rejects.toThrow(
			'Prefill Department Name',
		);
	});

	it('should accept valid raw stringified JSON payload for update', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentUpdates: '{"name":"Platform Engineering","lead_zuid":"123456789"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/departments/dept_123', {
			name: 'Platform Engineering',
			lead_zuid: '123456789',
		});
	});

	it('should auto-prefetch name when it is omitted in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentUpdates: {
				lead_zuid: '123456789',
			},
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { id: 'dept_123', name: 'Platform Engineering' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/departments/dept_123',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/departments/dept_123',
			{
				name: 'Platform Engineering',
				lead_zuid: '123456789',
			},
		);
	});

	it('should accept parent_department_id in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentUpdates: {
				name: 'Platform Engineering',
				parent_department_id: 'parent_dept_1',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/departments/dept_123', {
			name: 'Platform Engineering',
			parent_department_id: 'parent_dept_1',
		});
	});

	it('should accept parent_department_id', async () => {
		const context = createContext({
			updateFields: { parentDepartmentId: 'parent_dept_1' },
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/departments/dept_123', {
			name: 'Platform Engineering',
			parent_department_id: 'parent_dept_1',
		});
	});

	it('should accept leadZuid and non-empty userIds in structured mode', async () => {
		const context = createContext({
			updateFields: { leadZuid: '123456789', userIds: '111,222' },
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/departments/dept_123', {
			name: 'Platform Engineering',
			lead_zuid: '123456789',
			user_ids: ['111', '222'],
		});
	});

	it('should omit blank optional structured fields instead of erroring', async () => {
		const context = createContext({
			updateFields: {
				leadZuid: '   ',
				parentDepartmentId: '   ',
				userIds: '   ',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/departments/dept_123', {
			name: 'Platform Engineering',
		});
	});

	it('should omit undefined optional structured fields instead of erroring', async () => {
		const context = createContext({
			updateFields: {
				leadZuid: undefined,
				parentDepartmentId: undefined,
				userIds: undefined,
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/departments/dept_123', {
			name: 'Platform Engineering',
		});
	});

	it('should reject unsupported update fields in raw payload', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentUpdates: '{"name":"Platform Engineering","description":"not allowed"}',
		});

		await expect(update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE)).rejects.toThrow(
			'contains unsupported field "description"',
		);
	});

	it('should reject invalid input modes', async () => {
		const context = createContext({
			inputMode: 'invalid',
		});

		await expect(update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE)).rejects.toThrow(
			'Input Mode must be either "structured" or "raw"',
		);
	});

	it('should short-circuit with a recoverable users-not-found error before update', async () => {
		const context = createContext({
			updateFields: { userIds: 'missing_user' },
			continueOnFail: true,
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: [{ id: 'dept_123' }],
			})
			.mockResolvedValueOnce({
				data: [{ id: 'known_user' }],
			});

		const result = await update.execute.call(
			context,
			items,
			`${SCOPES.DEPARTMENTS_UPDATE},${SCOPES.DEPARTMENTS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'update',
				department_id: 'dept_123',
				department_name: 'Platform Engineering',
				user_ids: ['missing_user'],
				reason: 'USERS_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it.each([
		{
			name: 'department-not-found',
			updateFields: { userIds: '123456789' },
			mockResponses: [{ data: [] }],
			expectedFields: {},
			expectedReason: 'DEPARTMENT_NOT_FOUND',
			expectedCallCount: 1,
			expectDepartmentName: false,
		},
		{
			name: 'lead-user-not-found',
			updateFields: { leadZuid: 'missing_lead' },
			mockResponses: [{ data: [{ id: 'dept_123' }] }, { data: [{ id: 'known_user' }] }],
			expectedFields: { lead_zuid: 'missing_lead' },
			expectedReason: 'LEAD_USER_NOT_FOUND',
			expectedCallCount: 2,
			expectDepartmentName: true,
		},
		{
			name: 'parent-department-not-found',
			updateFields: { parentDepartmentId: 'missing_parent' },
			mockResponses: [{ data: [{ id: 'dept_123' }] }, { data: [] }],
			expectedFields: { parent_department_id: 'missing_parent' },
			expectedReason: 'PARENT_DEPARTMENT_NOT_FOUND',
			expectedCallCount: 2,
			expectDepartmentName: true,
		},
	])(
		'should short-circuit with a recoverable $name error before update',
		async ({
			updateFields,
			mockResponses,
			expectedFields,
			expectedReason,
			expectedCallCount,
			expectDepartmentName,
		}) => {
			const context = createContext({
				updateFields,
				continueOnFail: true,
			});

			for (const response of mockResponses) {
				mockZohoCliqApiRequest.mockResolvedValueOnce(response);
			}

			const result = await update.execute.call(
				context,
				items,
				`${SCOPES.DEPARTMENTS_UPDATE},${SCOPES.DEPARTMENTS_READ},${SCOPES.USERS_READ}`,
			);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'department',
					operation: 'update',
					department_id: 'dept_123',
					...(expectDepartmentName ? { department_name: 'Platform Engineering' } : {}),
					reason: expectedReason,
					...expectedFields,
				}),
			);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(expectedCallCount);
		},
	);

	it('should ignore non-object locator values and fall back to API prefill', async () => {
		const context = createContext({
			prefillDepartmentName: true,
			name: '',
			departmentLocator: 'dept_123' as unknown as IDataObject,
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ result: { name: 'Fallback API Name' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/departments/dept_123',
			{
				name: 'Fallback API Name',
			},
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			prefillDepartmentName: false,
			name: '',
			continueOnFail: true,
		});

		const result = await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'update',
				department_id: 'dept_123',
				reason: 'INVALID_DEPARTMENT_NAME',
			}),
		);
	});

	it('should return a recoverable prefill error for raw payloads when omitted name cannot be auto-filled', async () => {
		const context = createContext({
			inputMode: 'raw',
			departmentUpdates: {
				lead_zuid: '123456789',
			},
			continueOnFail: true,
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Not allowed'));

		const result = await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'update',
				department_id: 'dept_123',
				lead_zuid: '123456789',
				reason: 'DEPARTMENT_NAME_PREFILL_FAILED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('department_name');
		expect(result[0].json).not.toHaveProperty('parent_department_id');
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({
			enableAiErrorMode: 'true',
			updateFields: { parentDepartmentId: 'parent_dept_1' },
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'department_cyclic_loop',
		});

		const result = await update.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'update',
				department_id: 'dept_123',
				department_name: 'Platform Engineering',
				parent_department_id: 'parent_dept_1',
				status_code: 400,
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(update.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'updateDepartmentDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'updateDepartmentAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});

	it('should define prefill toggle and conditional name field in UI description', () => {
		const prefillProperty = update.description.find(
			(prop) => prop.name === 'prefillDepartmentName',
		);
		const nameProperty = update.description.find((prop) => prop.name === 'name');

		expect(prefillProperty).toBeDefined();
		expect(prefillProperty?.type).toBe('boolean');
		expect(prefillProperty?.default).toBe(true);
		expect(prefillProperty?.displayOptions?.show?.inputMode).toEqual(['structured']);

		expect(nameProperty).toBeDefined();
		expect(nameProperty?.displayOptions?.show?.inputMode).toEqual(['structured']);
		expect(nameProperty?.displayOptions?.show?.prefillDepartmentName).toEqual([false]);
	});
});
