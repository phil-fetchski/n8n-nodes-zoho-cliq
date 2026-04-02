import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/designation/delete.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			designationId?: string;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const {
			designationId = 'designation_123',
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
					if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
					if (name === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data, metadata) =>
					data.map((item: INodeExecutionData) => ({
						...item,
						pairedItem: metadata?.itemData,
					})),
				),
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

	it('should delete a designation successfully with enhanced output', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({});

		const result = await del.execute.call(createContext(), items, SCOPES.DESIGNATIONS_DELETE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/designations/designation_123',
		);
		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'designation',
			operation: 'delete',
			designation_id: 'designation_123',
		});
	});

	it('should return raw API output when enhanced output is disabled', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await del.execute.call(
			createContext({ includeEnhancedOutput: false }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(result[0].json).toEqual({ deleted: true, status: 'ok' });
	});

	it('should throw for invalid designation IDs', async () => {
		await expect(
			del.execute.call(
				createContext({ designationId: 'bad/id' }),
				items,
				SCOPES.DESIGNATIONS_DELETE,
			),
		).rejects.toThrow('Designation ID has an invalid format');
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'delete');
		let thrownError: unknown;
		try {
			await del.execute.call(createContext(), items, '');
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
		// Zoho Cliq delete-designation failures sometimes come back with department-prefixed
		// codes (`department_not_exist`) instead of designation-prefixed codes
		// (`designation_not_exist`), and delete-permission failures may also reuse
		// `department_base_dept_delete_not_allowed`, so this test intentionally covers both variants.
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { data: { error_code: 'department_not_exist' } },
		});

		const result = await del.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'delete',
				reason: 'DESIGNATION_NOT_FOUND',
			}),
		);
	});

	it('should keep generic 400 API failures generic in AI Error Mode when lookup preflight is skipped', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { status: 400 },
			message: 'Request failed with status code 400',
		});

		const result = await del.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'BAD_REQUEST',
				hint: 'Check required parameters, field formats, and request constraints.',
			}),
		);
	});

	it('should map delete permission errors in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { data: { error_code: 'operation_not_allowed' } },
		});

		const result = await del.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_DELETE_NOT_ALLOWED',
			}),
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: { data: { error_code: 'department_base_dept_delete_not_allowed' } },
		});
		const baseDeleteResult = await del.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_DELETE,
		);

		expect(baseDeleteResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_DELETE_NOT_ALLOWED',
			}),
		);
	});

	it('should expose docs and AI guide notices', () => {
		expect(del.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'deleteDesignationDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'deleteDesignationAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
