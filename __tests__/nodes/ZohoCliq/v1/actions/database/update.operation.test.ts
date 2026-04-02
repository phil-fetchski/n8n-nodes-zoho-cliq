import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/database/update.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Database - Update Operation', () => {
	const items: INodeExecutionData[] = [{ json: { text: 'Updated', bool: false } }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			tableName?: string;
			recordId?: string;
			inputMode?: unknown;
			updateRecordValuesMapper?: unknown;
			updateDataRaw?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			tableName = 'orders',
			recordId = 'REC_1',
			inputMode = 'raw',
			updateRecordValuesMapper = {
				mappingMode: 'defineBelow',
				value: { status: 'closed' },
				matchingColumns: [],
				schema: [],
				attemptToConvertTypes: false,
				convertFieldsToString: false,
			},
			updateDataRaw = { status: 'closed' },
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'tableName') return tableName;
				if (name === 'recordId') return recordId;
				if (name === 'inputMode') return inputMode;
				if (name === 'updateRecordValuesMapper') return updateRecordValuesMapper;
				if (name === 'updateDataRaw') return updateDataRaw;
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

	it('should update a database record from raw JSON', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'REC_1', status: 'closed' });

		const result = await update.execute.call(context, items, SCOPES.DATABASE_UPDATE);

		expect(result[0].json).toEqual({ updated: true, id: 'REC_1', status: 'closed' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/storages/orders/records/REC_1',
			{
				values: {
					status: 'closed',
				},
			},
		);
	});

	it('should update a database record with structured mapper values', async () => {
		const context = createContext({ inputMode: 'structured' });
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'REC_1' });

		await update.execute.call(context, items, SCOPES.DATABASE_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/storages/orders/records/REC_1',
			{ values: { status: 'closed' } },
		);
	});

	it('should update a database record with structured auto-mapped values', async () => {
		const context = createContext({
			inputMode: 'structured',
			updateRecordValuesMapper: {
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
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'REC_1' });

		await update.execute.call(context, items, SCOPES.DATABASE_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/storages/orders/records/REC_1',
			{ values: { text: 'Updated', bool: false } },
		);
	});

	it('should throw for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('database', 'update');

		let thrownError: unknown;
		try {
			await update.execute.call(context, items, '');
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
		const context = createContext({ inputMode: 'legacy' });

		await expect(update.execute.call(context, items, SCOPES.DATABASE_UPDATE)).rejects.toThrow(
			'Input Mode must be either "structured" or "raw"',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			updateDataRaw: {},
			continueOnFail: true,
		});

		const result = await update.execute.call(context, items, SCOPES.DATABASE_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'update',
				database_name: 'orders',
				record_id: 'REC_1',
				reason: 'INVALID_RECORD_VALUES',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Invalid data',
		});

		const result = await update.execute.call(context, items, SCOPES.DATABASE_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'update',
				database_name: 'orders',
				record_id: 'REC_1',
				status_code: 400,
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should return a shared preflight record-not-found error when recoverable mode also has database read scope', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Record not found',
		});

		const result = await update.execute.call(
			context,
			items,
			`${SCOPES.DATABASE_UPDATE},${SCOPES.DATABASE_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'update',
				database_name: 'orders',
				record_id: 'REC_1',
				reason: 'DATABASE_RECORD_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records/REC_1',
		);
	});

	it('should keep downstream update failures generic when recoverable mode lacks database read scope', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Record not found',
		});

		const result = await update.execute.call(context, items, SCOPES.DATABASE_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'update',
				database_name: 'orders',
				record_id: 'REC_1',
				status_code: 404,
				reason: 'NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/storages/orders/records/REC_1',
			{
				values: {
					status: 'closed',
				},
			},
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(update.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'updateDatabaseRecordDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'updateDatabaseRecordAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
