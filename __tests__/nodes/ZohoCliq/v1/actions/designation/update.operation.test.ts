import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/designation/update.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - Update Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			designationId?: string;
			name?: string;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const {
			designationId = 'designation_123',
			name = 'Leadership Staff',
			enableAiErrorMode = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(
					parameterName: string,
					_itemIndex?: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (parameterName === 'designationId' && options?.extractValue) return designationId;
					if (parameterName === 'name') return name;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
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

	it('should update a designation successfully', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			data: { id: 'designation_123', name: 'Leadership Staff' },
		});

		const result = await update.execute.call(createContext(), items, SCOPES.DESIGNATIONS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/designations/designation_123',
			{ name: 'Leadership Staff' },
		);
		expect(result[0].json).toEqual({
			updated: true,
			data: { id: 'designation_123', name: 'Leadership Staff' },
		});
	});

	it('should throw for invalid designation names', async () => {
		await expect(
			update.execute.call(createContext({ name: ' ' }), items, SCOPES.DESIGNATIONS_UPDATE),
		).rejects.toThrow('Designation name is required');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'update');
		let thrownError: unknown;
		try {
			await update.execute.call(createContext(), items, '');
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
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { data: { error_code: 'designation_already_exist' } },
		});

		const result = await update.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'update',
				reason: 'DESIGNATION_ALREADY_EXISTS',
			}),
		);
	});

	it('should keep generic 400 API failures generic in AI Error Mode when lookup preflight is skipped', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { status: 400 },
			message: 'Request failed with status code 400',
		});

		const result = await update.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'BAD_REQUEST',
				hint: 'Check required parameters, field formats, and request constraints.',
			}),
		);
	});

	it('should map not-found errors in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { data: { error_code: 'designation_not_exist' } },
		});

		const result = await update.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_NOT_FOUND',
			}),
		);
	});

	it('should map operation_not_allowed errors in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'operation_not_allowed',
		});

		const result = await update.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'OPERATION_NOT_ALLOWED',
				hint: 'Ensure the API user has organization admin privileges or the operation is permitted for this account.',
			}),
		);
	});

	it('should map not_an_organization_admin errors in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'not_an_organization_admin',
		});

		const result = await update.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_UPDATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'PERMISSION_DENIED',
				hint: 'Ensure the API user has organization admin privileges or the operation is permitted for this account.',
			}),
		);
	});

	it('should expose docs and AI guide notices', () => {
		expect(update.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'updateDesignationDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'updateDesignationAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
