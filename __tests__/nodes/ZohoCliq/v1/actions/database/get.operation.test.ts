import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/database/get.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Database - Get Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			tableName?: string;
			recordId?: string;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			tableName = 'orders',
			recordId = 'REC_1',
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'tableName') return tableName;
				if (name === 'recordId') return recordId;
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

	it('should get one database record successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			status: 'SUCCESS',
			url: '/api/v2/storages/orders/records/REC_1',
			object: { id: 'REC_1', status: 'open' },
		});

		const result = await get.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(result[0].json).toEqual({
			status: 'SUCCESS',
			url: '/api/v2/storages/orders/records/REC_1',
			object: { id: 'REC_1', status: 'open' },
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records/REC_1',
		);
	});

	it('should reuse the validated shared preflight lookup response in recoverable mode', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			status: 'SUCCESS',
			object: { id: 'REC_1', status: 'open' },
		});

		const result = await get.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(result[0].json).toEqual({
			status: 'SUCCESS',
			object: { id: 'REC_1', status: 'open' },
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records/REC_1',
		);
	});

	it('should throw for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('database', 'get');

		let thrownError: unknown;
		try {
			await get.execute.call(context, items, '');
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

	it('should reject invalid record IDs', async () => {
		const context = createContext({ recordId: 'bad/id' });

		await expect(get.execute.call(context, items, SCOPES.DATABASE_READ)).rejects.toThrow(
			'Invalid Record ID format',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ recordId: 'bad/id', continueOnFail: true });

		const result = await get.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'get',
				database_name: 'orders',
				reason: 'INVALID_RECORD_ID',
				hint: 'Use the exact Zoho Cliq record ID from the database response.',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Record not found',
		});

		const result = await get.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'get',
				database_name: 'orders',
				record_id: 'REC_1',
				message: 'No database record found for Record ID "REC_1" in Database Name "orders".',
				hint: 'Use Get Record or List Records to confirm the database_name and record_id pair before retrying.',
				reason: 'DATABASE_RECORD_NOT_FOUND',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(get.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'getDatabaseRecordDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'getDatabaseRecordAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});
});
