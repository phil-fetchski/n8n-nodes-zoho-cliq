import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as addMembers from '../../../../../../nodes/ZohoCliq/v1/actions/department/addMembers.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Department - Add Members Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			departmentId?: string;
			memberIdentifiers?: unknown;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			departmentId = 'dept_123',
			memberIdentifiers = '123456789,987654321',
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
					if (parameterName === 'userIds') return memberIdentifiers;
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
		mockZohoCliqApiRequest.mockResolvedValue({ data: '' });
	});

	it('should add department members successfully with user ids', async () => {
		const context = createContext();

		const result = await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			resource: 'department',
			operation: 'addMembers',
			department_id: 'dept_123',
			identifier_type: 'user_ids',
			member_identifiers: ['123456789', '987654321'],
			added_count: 2,
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/departments/dept_123/members',
			{
				user_ids: ['123456789', '987654321'],
			},
		);
	});

	it('should add department members successfully with email ids', async () => {
		const context = createContext({
			memberIdentifiers: 'amy@example.com,ben@example.com',
		});

		await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/departments/dept_123/members',
			{
				email_ids: ['amy@example.com', 'ben@example.com'],
			},
		);
	});

	it('should add department members successfully with a literal user-id array', async () => {
		const context = createContext({
			memberIdentifiers: ['123456789', '987654321'],
		});

		await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/departments/dept_123/members',
			{
				user_ids: ['123456789', '987654321'],
			},
		);
	});

	it('should add department members successfully with a JSON email-id array string', async () => {
		const context = createContext({
			memberIdentifiers: '["amy@example.com","ben@example.com"]',
		});

		await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/departments/dept_123/members',
			{
				email_ids: ['amy@example.com', 'ben@example.com'],
			},
		);
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });

		const result = await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('department', 'addMembers');

		let thrownError: unknown;
		try {
			await addMembers.execute.call(context, items, '');
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

	it('should reject mixed member identifier types', async () => {
		const context = createContext({
			memberIdentifiers: 'amy@example.com,123456789',
		});

		await expect(
			addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE),
		).rejects.toThrow('Mixed identifier types are not supported');
	});

	it('should reject more than 100 member identifiers', async () => {
		const context = createContext({
			memberIdentifiers: Array.from({ length: 101 }, (_, index) => `${100000000 + index}`).join(
				',',
			),
		});

		await expect(
			addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE),
		).rejects.toThrow('Cannot add more than 100 members at once');
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			memberIdentifiers: 'amy@example.com,123456789',
			continueOnFail: true,
		});

		const result = await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'addMembers',
				department_id: 'dept_123',
				reason: 'INVALID_MEMBER_IDENTIFIERS',
			}),
		);
	});

	it('should return a recoverable validation error for unsupported identifier input types', async () => {
		const context = createContext({
			memberIdentifiers: 42,
			continueOnFail: true,
		});

		const result = await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'addMembers',
				department_id: 'dept_123',
				reason: 'INVALID_MEMBER_IDENTIFIERS',
			}),
		);
	});

	it('should short-circuit with a recoverable email-not-found error before the add-members request', async () => {
		const context = createContext({
			memberIdentifiers: '["missing@example.com"]',
			continueOnFail: true,
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'dept_123' }] })
			.mockResolvedValueOnce({ data: [{ email_id: 'user@example.com' }] });

		const result = await addMembers.execute.call(
			context,
			items,
			`${SCOPES.DEPARTMENTS_UPDATE},${SCOPES.DEPARTMENTS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'addMembers',
				department_id: 'dept_123',
				identifier_type: 'email_ids',
				member_identifiers: ['missing@example.com'],
				reason: 'EMAILS_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'department_not_exist',
		});

		const result = await addMembers.execute.call(context, items, SCOPES.DEPARTMENTS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'department',
				operation: 'addMembers',
				department_id: 'dept_123',
				status_code: 400,
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(addMembers.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'addDepartmentMembersDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'addDepartmentMembersAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
