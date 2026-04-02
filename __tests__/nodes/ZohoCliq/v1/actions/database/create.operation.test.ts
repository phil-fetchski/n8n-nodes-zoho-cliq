import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/database/create.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Database - Create Operation', () => {
	const items: INodeExecutionData[] = [{ json: { text: 'Testy', bool: true } }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			tableName?: string;
			createInputMode?: unknown;
			createRecordValuesMapper?: unknown;
			createRecordValuesRaw?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			tableName = 'orders',
			createInputMode = 'raw',
			createRecordValuesMapper = {
				mappingMode: 'defineBelow',
				value: { order_id: 'A-1', status: 'open' },
				matchingColumns: [],
				schema: [],
				attemptToConvertTypes: false,
				convertFieldsToString: false,
			},
			createRecordValuesRaw = { order_id: 'A-1', status: 'open' },
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'tableName') return tableName;
				if (name === 'createInputMode') return createInputMode;
				if (name === 'createRecordValuesMapper') return createRecordValuesMapper;
				if (name === 'createRecordValuesRaw') return createRecordValuesRaw;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
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
	});

	it('should create a database record from raw JSON', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'REC_1', status: 'open' });

		const result = await create.execute.call(context, items, SCOPES.DATABASE_CREATE);

		expect(result[0].json).toEqual({ id: 'REC_1', status: 'open' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/storages/orders/records', {
			values: {
				order_id: 'A-1',
				status: 'open',
			},
		});
	});

	it('should create a database record with structured mapper values', async () => {
		const context = createContext({ createInputMode: 'structured' });
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'REC_1' });

		await create.execute.call(context, items, SCOPES.DATABASE_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/storages/orders/records', {
			values: { order_id: 'A-1', status: 'open' },
		});
	});

	it('should create a database record with structured auto-mapped values', async () => {
		const context = createContext({
			createInputMode: 'structured',
			createRecordValuesMapper: {
				mappingMode: 'autoMapInputData',
				value: null,
				schema: [
					{ id: 'text', displayName: 'text' },
					{ id: 'bool', displayName: 'bool' },
				],
				matchingColumns: [],
				attemptToConvertTypes: false,
				convertFieldsToString: false,
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'REC_2' });

		await create.execute.call(context, items, SCOPES.DATABASE_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/storages/orders/records', {
			values: { text: 'Testy', bool: true },
		});
	});

	it('should throw for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('database', 'create');

		let thrownError: unknown;
		try {
			await create.execute.call(context, items, '');
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

	it('should reject invalid input mode', async () => {
		const context = createContext({ createInputMode: 'legacy' });

		await expect(create.execute.call(context, items, SCOPES.DATABASE_CREATE)).rejects.toThrow(
			'Input Mode must be either "structured" or "raw"',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			createRecordValuesRaw: { constructor: 'bad' },
			continueOnFail: true,
		});

		const result = await create.execute.call(context, items, SCOPES.DATABASE_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'create',
				database_name: 'orders',
				reason: 'INVALID_RECORD_VALUES',
				hint: 'Provide at least one safe JSON field value, either from the mapper or as a JSON object.',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 429,
			message: 'Too many requests',
		});

		const result = await create.execute.call(context, items, SCOPES.DATABASE_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'create',
				database_name: 'orders',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(create.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'createDatabaseRecordDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'createDatabaseRecordAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
