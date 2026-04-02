import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as addMembers from '../../../../../../nodes/ZohoCliq/v1/actions/designation/addMembers.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - Add Members Operation', () => {
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

	it('should add members successfully with enhanced output enabled', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({});

		const result = await addMembers.execute.call(context, items, SCOPES.DESIGNATIONS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/designations/designation_123/members',
			{ user_ids: ['123', '456'] },
		);
		expect(result[0].json).toEqual({
			success: true,
			resource: 'designation',
			operation: 'addMembers',
			designation_id: 'designation_123',
			added_user_ids: ['123', '456'],
			added_count: 2,
		});
	});

	it('should accept JSON array user IDs input', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({});

		await addMembers.execute.call(
			createContext({ userIds: '["123","456"]' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/designations/designation_123/members',
			{ user_ids: ['123', '456'] },
		);
	});

	it('should accept literal array user IDs input', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({});

		await addMembers.execute.call(
			createContext({ userIds: ['123', '456'] }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/designations/designation_123/members',
			{ user_ids: ['123', '456'] },
		);
	});

	it('should return raw API output when enhanced output is disabled', async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await addMembers.execute.call(context, items, SCOPES.DESIGNATIONS_UPDATE);

		expect(result[0].json).toEqual({ status: 'ok' });
	});

	it('should throw for invalid user IDs', async () => {
		await expect(
			addMembers.execute.call(
				createContext({ userIds: '123,bad/id' }),
				items,
				SCOPES.DESIGNATIONS_UPDATE,
			),
		).rejects.toThrow('User IDs[1] has an invalid format');
	});

	it('should throw for invalid JSON array user ID input', async () => {
		await expect(
			addMembers.execute.call(
				createContext({ userIds: '["123","bad/id"]' }),
				items,
				SCOPES.DESIGNATIONS_UPDATE,
			),
		).rejects.toThrow('User IDs[1] has an invalid format');
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'addMembers');

		let thrownError: unknown;
		try {
			await addMembers.execute.call(createContext(), items, '');
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

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { data: { error_code: 'designation_not_exist' } },
		});

		const result = await addMembers.execute.call(context, items, SCOPES.DESIGNATIONS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'addMembers',
				designation_id: 'designation_123',
				reason: 'DESIGNATION_NOT_FOUND',
			}),
		);
	});

	it('should preserve shared designation preflight misses in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const result = await addMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			`${SCOPES.DESIGNATIONS_UPDATE},${SCOPES.DESIGNATIONS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'addMembers',
				designation_id: 'designation_123',
				reason: 'DESIGNATION_NOT_FOUND',
				hint: 'Use List Designations to discover valid IDs before retrying.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/designations',
			{},
			{ limit: 100 },
		);
	});

	it('should return recoverable validation and permission errors in AI Error Mode', async () => {
		const tooManyUserIds = Array.from({ length: 101 }, (_, index) => `${index + 1}`).join(',');
		const validationResult = await addMembers.execute.call(
			createContext({ userIds: tooManyUserIds, enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(validationResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_USER_IDS',
			}),
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: { data: { error_code: 'operation_not_allowed' } },
		});
		const permissionResult = await addMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(permissionResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_UPDATE_NOT_ALLOWED',
			}),
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: { data: { error_code: 'not_an_organization_admin' } },
		});
		const adminResult = await addMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(adminResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_UPDATE_NOT_ALLOWED',
			}),
		);
	});

	it('should validate user IDs against current users when user-read scope is available', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ id: '123' }],
		});

		const result = await addMembers.execute.call(
			createContext({ userIds: '123,missing_user', enableAiErrorMode: 'true' }),
			items,
			`${SCOPES.DESIGNATIONS_UPDATE},ZohoCliq.Users.READ`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_USER_IDS',
				hint: 'Provide one or more canonical Zoho Cliq user IDs as a JSON array of strings. If an ID cannot be resolved, retrieve valid users before retrying.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should reject oversized user ID batches before user validation lookups', async () => {
		const tooManyUserIds = Array.from({ length: 101 }, (_, index) => `${index + 1}`).join(',');

		const result = await addMembers.execute.call(
			createContext({ userIds: tooManyUserIds, enableAiErrorMode: 'true' }),
			items,
			`${SCOPES.DESIGNATIONS_UPDATE},ZohoCliq.Users.READ`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_USER_IDS',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices', () => {
		expect(addMembers.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'addDesignationMembersDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'addDesignationMembersAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
