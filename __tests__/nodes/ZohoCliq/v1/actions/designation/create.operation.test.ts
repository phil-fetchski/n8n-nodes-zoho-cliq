import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/designation/create.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Designation - Create Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			inputMode?: 'structured' | 'raw' | string;
			name?: string;
			userIds?: string;
			designationDefinition?: unknown;
			enableAiErrorMode?: unknown;
		} = {},
	): IExecuteFunctions => {
		const {
			inputMode = 'structured',
			name = 'Leadership',
			userIds = '',
			designationDefinition = {},
			enableAiErrorMode = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'name') return name;
					if (parameterName === 'userIds') return userIds;
					if (parameterName === 'designationDefinition') return designationDefinition;
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

	it('should create a designation successfully in structured mode', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			data: { id: 'designation_123', name: 'Leadership' },
		});

		const result = await create.execute.call(
			createContext({ userIds: '123,456' }),
			items,
			SCOPES.DESIGNATIONS_CREATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/designations', {
			name: 'Leadership',
			user_ids: ['123', '456'],
		});
		expect(result[0].json).toEqual({ data: { id: 'designation_123', name: 'Leadership' } });
	});

	it('should create a designation successfully in raw mode', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			data: { id: 'designation_123', name: 'Leadership' },
		});

		await create.execute.call(
			createContext({
				inputMode: 'raw',
				designationDefinition: '{"name":"Leadership","user_ids":["123"]}',
			}),
			items,
			SCOPES.DESIGNATIONS_CREATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/designations', {
			name: 'Leadership',
			user_ids: ['123'],
		});
	});

	it('should throw for invalid designation names', async () => {
		await expect(
			create.execute.call(createContext({ name: ' ' }), items, SCOPES.DESIGNATIONS_CREATE),
		).rejects.toThrow('Designation name is required');
	});

	it('should throw for missing OAuth scope', async () => {
		const requiredScope = getRequiredScopeForOperation('designation', 'create');
		let thrownError: unknown;
		try {
			await create.execute.call(createContext(), items, '');
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
		const result = await create.execute.call(
			createContext({ inputMode: 'xml', enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_CREATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'designation',
				operation: 'create',
				reason: 'INVALID_INPUT_MODE',
			}),
		);
	});

	it('should return recoverable payload and API mapping errors in AI Error Mode', async () => {
		const payloadResult = await create.execute.call(
			createContext({
				inputMode: 'raw',
				designationDefinition: '{"extra":true}',
				enableAiErrorMode: 'true',
			}),
			items,
			SCOPES.DESIGNATIONS_CREATE,
		);

		expect(payloadResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_DESIGNATION_PAYLOAD',
			}),
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: { data: { error_code: 'designation_already_exist' } },
		});
		const apiResult = await create.execute.call(
			createContext({ enableAiErrorMode: 'true' }),
			items,
			SCOPES.DESIGNATIONS_CREATE,
		);

		expect(apiResult[0].json).toEqual(
			expect.objectContaining({
				reason: 'DESIGNATION_ALREADY_EXISTS',
			}),
		);

		const userIdsResult = await create.execute.call(
			createContext({
				name: 'Leadership',
				userIds: 'bad/id',
				enableAiErrorMode: 'true',
			}),
			items,
			SCOPES.DESIGNATIONS_CREATE,
		);

		expect(userIdsResult[0].json).toEqual(
			expect.objectContaining({
				user_ids: 'bad/id',
				reason: 'INVALID_USER_IDS',
			}),
		);
	});

	it('should expose docs and AI guide notices', () => {
		expect(create.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'createDesignationDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'createDesignationAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
