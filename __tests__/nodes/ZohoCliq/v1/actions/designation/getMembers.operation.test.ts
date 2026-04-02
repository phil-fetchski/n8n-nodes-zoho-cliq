import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as getMembers from '../../../../../../nodes/ZohoCliq/v1/actions/designation/getMembers.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - Get Members Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			designationId?: string;
			limit?: number;
			nextToken?: string;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const {
			designationId = 'designation_123',
			limit = 50,
			nextToken = '',
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
					if (name === 'limit') return limit;
					if (name === 'nextToken') return nextToken;
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

	it('should get designation members successfully', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ data: [], next_token: 'token_2' });

		const result = await getMembers.execute.call(
			createContext({ limit: 25, nextToken: 'token_1' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/designations/designation_123/members',
			{},
			{ limit: 25, next_token: 'token_1' },
		);
		expect(result[0].json).toEqual({ data: [], next_token: 'token_2' });
	});

	it('should omit blank next tokens', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await getMembers.execute.call(createContext(), items, SCOPES.DESIGNATIONS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/designations/designation_123/members',
			{},
			{ limit: 50 },
		);
	});

	it('should throw for invalid limits', async () => {
		await expect(
			getMembers.execute.call(createContext({ limit: 0 }), items, SCOPES.DESIGNATIONS_READ),
		).rejects.toThrow('Limit must be a whole number between 1 and 100');
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'getMembers');
		let thrownError: unknown;
		try {
			await getMembers.execute.call(createContext(), items, '');
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

	it('should return a recoverable validation error in AI Error Mode', async () => {
		const result = await getMembers.execute.call(
			createContext({ limit: 101, enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'getMembers',
				reason: 'INVALID_LIMIT',
			}),
		);
	});

	it('should return recoverable next-token and not-found errors in AI Error Mode', async () => {
		const nextTokenResult = await getMembers.execute.call(
			createContext({ nextToken: 'a'.repeat(1025), enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(nextTokenResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_NEXT_TOKEN',
				next_token: '[REDACTED]',
			}),
		);

		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });
		const invalidIdResult = await getMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(invalidIdResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_NOT_FOUND',
				hint: 'Use List Designations to discover valid IDs before retrying.',
			}),
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'designation_123' }] })
			.mockRejectedValueOnce({
				response: { data: { error_code: 'designation_not_exist' } },
			});
		const apiResult = await getMembers.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(apiResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_NOT_FOUND',
			}),
		);
	});

	it('should expose docs and AI guide notices', () => {
		expect(getMembers.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'getDesignationMembersDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'getDesignationMembersAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
