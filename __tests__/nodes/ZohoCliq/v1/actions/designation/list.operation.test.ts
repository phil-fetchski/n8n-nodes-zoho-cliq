import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/designation/list.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - List Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			additionalFields?: Record<string, unknown>;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const { additionalFields = {}, enableAiErrorMode = false } = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'additionalFields') return additionalFields;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
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

	it('should list designations successfully', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		const result = await list.execute.call(
			createContext({ additionalFields: { limit: 25, search: 'leader' } }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/designations',
			{},
			{ limit: 25, search: 'leader' },
		);
		expect(result[0].json).toEqual({ data: [] });
	});

	it('should omit blank optional values', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(
			createContext({ additionalFields: { search: '   ' } }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/designations', {}, {});
	});

	it('should throw for invalid search values', async () => {
		await expect(
			list.execute.call(
				createContext({ additionalFields: { search: 'a'.repeat(121) } }),
				items,
				SCOPES.DESIGNATIONS_READ,
			),
		).rejects.toThrow('Search is too long. Maximum length is 120 characters.');
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'list');
		let thrownError: unknown;
		try {
			await list.execute.call(createContext(), items, '');
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
		const result = await list.execute.call(
			createContext({
				additionalFields: { limit: 101 },
				enableAiErrorMode: 'true',
			}),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'list',
				reason: 'INVALID_LIMIT',
			}),
		);
	});

	it('should map list permission errors in AI Error Mode', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: { data: { error_code: 'operation_not_allowed' } },
		});

		const result = await list.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_READ,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_LIST_NOT_ALLOWED',
			}),
		);
	});

	it('should expose docs and AI guide notices', () => {
		expect(list.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'additionalFields',
					type: 'collection',
					placeholder: 'Add Additional Fields',
				}),
				expect.objectContaining({ name: 'listDesignationsDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'listDesignationsAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
