import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as removeMembers from '../../../../../../nodes/ZohoCliq/v1/actions/designation/removeMembers.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - Remove Members Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			designationId?: string;
			userIds?: unknown;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const {
			designationId = 'designation_123',
			userIds = '123,456',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex?: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'designationId' && options?.extractValue) return designationId;
					if (name === 'userIds') return userIds;
					if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
					if (name === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
			continueOnFail: jest.fn(() => false),
			helpers: { constructExecutionMetaData: jest.fn((data) => data) },
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

	it('should remove members successfully with enhanced output enabled', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({});

		const result = await removeMembers.execute.call(
			createContext(),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/designations/designation_123/members',
			{ user_ids: ['123', '456'] },
		);
		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'designation',
			operation: 'removeMembers',
			designation_id: 'designation_123',
			removed_user_ids: ['123', '456'],
			removed_count: 2,
		});
	});

	it('should accept JSON array user IDs input', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({});

		await removeMembers.execute.call(
			createContext({ userIds: '["123","456"]' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/designations/designation_123/members',
			{ user_ids: ['123', '456'] },
		);
	});

	it('should return raw API output when enhanced output is disabled', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await removeMembers.execute.call(
			createContext({ includeEnhancedOutput: false }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(result[0].json).toEqual({ deleted: true, status: 'ok' });
	});

	it('should throw for invalid user IDs', async () => {
		await expect(
			removeMembers.execute.call(
				createContext({ userIds: '123,bad/id' }),
				items,
				SCOPES.DESIGNATIONS_DELETE,
			),
		).rejects.toThrow('User IDs[1] has an invalid format');
	});

	it('should throw for invalid JSON array user ID input', async () => {
		await expect(
			removeMembers.execute.call(
				createContext({ userIds: '["123","bad/id"]' }),
				items,
				SCOPES.DESIGNATIONS_DELETE,
			),
		).rejects.toThrow('User IDs[1] has an invalid format');
	});

	it('should throw for invalid literal array user ID input', async () => {
		await expect(
			removeMembers.execute.call(
				createContext({ userIds: ['123', 'bad/id'] }),
				items,
				SCOPES.DESIGNATIONS_DELETE,
			),
		).rejects.toThrow('User IDs[1] has an invalid format');
	});

	it('should reject oversized member removals before running any preflight lookups', async () => {
		const tooManyUserIds = Array.from({ length: 101 }, (_, index) => String(index + 1)).join(',');

		const result = await removeMembers.execute.call(
			createContext({ userIds: tooManyUserIds, enableAiErrorMode: true }),
			items,
			`${SCOPES.DESIGNATIONS_DELETE},${SCOPES.DESIGNATIONS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_USER_IDS',
			message: 'Cannot remove more than 100 members at once',
		});
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw oversized member removals before running any preflight lookups when AI mode is disabled', async () => {
		const tooManyUserIds = Array.from({ length: 101 }, (_, index) => String(index + 1)).join(',');

		await expect(
			removeMembers.execute.call(
				createContext({ userIds: tooManyUserIds }),
				items,
				`${SCOPES.DESIGNATIONS_DELETE},${SCOPES.DESIGNATIONS_READ},${SCOPES.USERS_READ}`,
			),
		).rejects.toThrow('Cannot remove more than 100 members at once');

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'removeMembers');
		let thrownError: unknown;
		try {
			await removeMembers.execute.call(createContext(), items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
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

	it('should return a recoverable API error in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { data: { error_code: 'designation_not_exist' } },
		});

		const result = await removeMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'removeMembers',
				reason: 'DESIGNATION_NOT_FOUND',
			}),
		);
	});

	it('should return recoverable validation and permission errors in AI Error Mode', async () => {
		const tooManyUserIds = Array.from({ length: 101 }, (_, index) => `${index + 1}`).join(',');
		const validationResult = await removeMembers.execute.call(
			createContext({ userIds: tooManyUserIds, enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(validationResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_USER_IDS',
			}),
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: { data: { error_code: 'operation_not_allowed' } },
		});
		const permissionResult = await removeMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(permissionResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_REMOVE_NOT_ALLOWED',
			}),
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: { data: { error_code: 'not_an_organization_admin' } },
		});
		const adminResult = await removeMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(adminResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_REMOVE_NOT_ALLOWED',
			}),
		);
	});

	it('should validate user IDs against current users when user-read scope is available', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ id: '123' }],
		});

		const result = await removeMembers.execute.call(
			createContext({ userIds: '123,missing_user', enableAiErrorMode: 'true' }),
			items,
			`${SCOPES.DESIGNATIONS_DELETE},ZohoCliq.Users.READ`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_USER_IDS',
				hint: 'Provide one or more canonical Zoho Cliq user IDs as a JSON array of strings. If an ID cannot be resolved, retrieve valid users before retrying.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should expose docs and AI guide notices', () => {
		expect(removeMembers.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'removeDesignationMembersDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'removeDesignationMembersAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
