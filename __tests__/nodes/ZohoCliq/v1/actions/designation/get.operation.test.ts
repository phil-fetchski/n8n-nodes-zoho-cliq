import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/designation/get.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - Get Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { designationId?: string; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { designationId = 'designation_123', enableAiErrorMode = false } = values;

		return {
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex?: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'designationId' && options?.extractValue) return designationId;
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

	it('should get a designation successfully', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ data: { id: 'designation_123', name: 'Admin' } });

		const result = await get.execute.call(createContext(), items, SCOPES.DESIGNATIONS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/designations/designation_123',
		);
		expect(result[0].json).toEqual({ data: { id: 'designation_123', name: 'Admin' } });
	});

	it('should throw for invalid designation IDs', async () => {
		await expect(
			get.execute.call(createContext({ designationId: 'bad/id' }), items, SCOPES.DESIGNATIONS_READ),
		).rejects.toThrow('Designation ID has an invalid format');
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'get');
		let thrownError: unknown;
		try {
			await get.execute.call(createContext(), items, '');
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
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

		const missingDesignationResult = await get.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(missingDesignationResult[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'get',
				reason: 'DESIGNATION_NOT_FOUND',
				hint: 'Use List Designations to discover valid IDs before retrying.',
			}),
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: [{ id: 'designation_123', name: 'Admin' }] })
			.mockRejectedValueOnce({
				response: { data: { error_code: 'designation_not_exist' } },
			});

		const result = await get.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'get',
				reason: 'DESIGNATION_NOT_FOUND',
			}),
		);
	});

	it('should keep generic 400 API errors generic in AI Error Mode when preflight is non-exhaustive', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: {
					next_token: 'designation_page_2',
				},
			})
			.mockRejectedValueOnce(new Error('designation list lookup failed'))
			.mockRejectedValueOnce({
				response: { status: 400 },
				message: 'Request failed with status code 400',
			});

		const result = await get.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'get',
				message:
					'The designation roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			}),
		);
	});

	it('should expose docs and AI guide notices', () => {
		expect(get.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'getDesignationDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'getDesignationAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
