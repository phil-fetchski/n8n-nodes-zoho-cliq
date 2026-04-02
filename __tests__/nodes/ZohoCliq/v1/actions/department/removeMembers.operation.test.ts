import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as removeMembers from '../../../../../../nodes/ZohoCliq/v1/actions/department/removeMembers.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - Remove Members Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			departmentId?: string;
			userIds?: unknown;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			departmentId = 'dept_123',
			userIds = '123456789,987654321',
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
					if (parameterName === 'departmentId' && options?.extractValue) return departmentId;
					if (parameterName === 'departmentId') return { mode: 'id', value: departmentId };
					if (parameterName === 'userIds') return userIds;
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

	it('should remove department members successfully with enhanced output', async () => {
		const context = createContext();

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual({
			data: '',
			deleted: true,
			success: true,
			resource: 'department',
			operation: 'removeMembers',
			department_id: 'dept_123',
			removed_user_ids: ['123456789', '987654321'],
			removed_count: 2,
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/departments/dept_123/members',
			{
				user_ids: ['123456789', '987654321'],
			},
		);
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should accept a literal user_ids array input', async () => {
		const context = createContext({ userIds: ['123456789', '987654321'] });

		await removeMembers.execute.call(context, items, SCOPES.DEPARTMENT_REMOVE_MEMBERS);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/departments/dept_123/members',
			{
				user_ids: ['123456789', '987654321'],
			},
		);
	});

	it('should accept a JSON array string for user_ids input', async () => {
		const context = createContext({ userIds: '["123456789","987654321"]' });

		await removeMembers.execute.call(context, items, SCOPES.DEPARTMENT_REMOVE_MEMBERS);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/departments/dept_123/members',
			{
				user_ids: ['123456789', '987654321'],
			},
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('department', 'removeMembers');

		let thrownError: unknown;
		try {
			await removeMembers.execute.call(context, items, '');
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

	it('should reject blank user ids', async () => {
		const context = createContext({ userIds: '   ' });

		await expect(
			removeMembers.execute.call(context, items, SCOPES.DEPARTMENT_REMOVE_MEMBERS),
		).rejects.toThrow('User IDs must contain at least one ID');
	});

	it('should reject more than 100 user ids', async () => {
		const context = createContext({
			userIds: Array.from({ length: 101 }, (_, index) => `${100000000 + index}`).join(','),
		});

		await expect(
			removeMembers.execute.call(context, items, SCOPES.DEPARTMENT_REMOVE_MEMBERS),
		).rejects.toThrow('Cannot remove more than 100 members at once');
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			userIds: Array.from({ length: 101 }, (_, index) => `${100000000 + index}`).join(','),
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				department_id: 'dept_123',
				user_ids: Array.from({ length: 101 }, (_, index) => `${100000000 + index}`),
				reason: 'INVALID_USER_IDS',
			}),
		);
	});

	it('should omit user_ids from recoverable output when the submitted list is blank', async () => {
		const context = createContext({
			userIds: '   ',
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				reason: 'INVALID_USER_IDS',
			}),
		);
		expect(result[0].json).not.toHaveProperty('department_id');
		expect(result[0].json).not.toHaveProperty('user_ids');
	});

	it('should omit user_ids from recoverable output when the submitted value is not a string or array', async () => {
		const context = createContext({
			userIds: 42,
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				reason: 'INVALID_USER_IDS',
			}),
		);
		expect(result[0].json).not.toHaveProperty('department_id');
		expect(result[0].json).not.toHaveProperty('user_ids');
	});

	it('should preserve array-form user_ids in recoverable output when department_id is missing', async () => {
		const context = createContext({
			departmentId: '   ',
			userIds: ['123456789', '987654321'],
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				user_ids: ['123456789', '987654321'],
				reason: 'INVALID_DEPARTMENT_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('department_id');
	});

	it('should keep user_ids in recoverable output even when department_id is missing', async () => {
		const context = createContext({
			departmentId: '   ',
			userIds: '123456789,987654321',
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				user_ids: ['123456789', '987654321'],
				reason: 'INVALID_DEPARTMENT_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('department_id');
	});

	it('should preserve the caller submitted trimmed department_id in recoverable output', async () => {
		const context = createContext({
			departmentId: '  bad/id  ',
			userIds: '123456789,987654321',
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				department_id: 'bad/id',
				user_ids: ['123456789', '987654321'],
				reason: 'INVALID_DEPARTMENT_ID',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'department_not_exist',
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			SCOPES.DEPARTMENT_REMOVE_MEMBERS,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				department_id: 'dept_123',
				user_ids: ['123456789', '987654321'],
				status_code: 400,
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should short-circuit with a recoverable users-not-found error before the remove-members request', async () => {
		const context = createContext({
			userIds: ['missing_user'],
			continueOnFail: true,
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockResolvedValueOnce({ data: [{ id: 'known_user' }] });

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.DEPARTMENT_REMOVE_MEMBERS},${SCOPES.DEPARTMENTS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'removeMembers',
				department_id: 'dept_123',
				user_ids: ['missing_user'],
				reason: 'USERS_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(removeMembers.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'removeDepartmentMembersDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'removeDepartmentMembersAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
