import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/database/delete.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Database - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			tableName?: string;
			recordId?: string;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			tableName = 'orders',
			recordId = 'REC_1',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'tableName') return tableName;
				if (name === 'recordId') return recordId;
				if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
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
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);
	});

	it('should return enhanced output by default for delete', async () => {
		const context = createContext();

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			operation: 'delete',
			database_name: 'orders',
			record_id: 'REC_1',
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/storages/orders/records/REC_1',
		);
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should throw for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('database', 'delete');

		let thrownError: unknown;
		try {
			await del.execute.call(context, items, '');
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

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ recordId: 'bad/id', continueOnFail: true });

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'delete',
				database_name: 'orders',
				reason: 'INVALID_RECORD_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 500,
			message: 'Service unavailable',
		});

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'delete',
				database_name: 'orders',
				record_id: 'REC_1',
				status_code: 500,
				reason: 'SERVER_ERROR',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a shared preflight record-not-found error when recoverable mode also has database read scope', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Record not found',
		});

		const result = await del.execute.call(
			context,
			items,
			`${SCOPES.DATABASE_DELETE},${SCOPES.DATABASE_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'delete',
				database_name: 'orders',
				record_id: 'REC_1',
				reason: 'DATABASE_RECORD_NOT_FOUND',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records/REC_1',
		);
	});

	it('should keep downstream delete failures generic when recoverable mode lacks database read scope', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Record not found',
		});

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'delete',
				database_name: 'orders',
				record_id: 'REC_1',
				status_code: 404,
				reason: 'NOT_FOUND',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/storages/orders/records/REC_1',
		);
	});

	it('should preserve the original record id in recoverable not-found messages', async () => {
		const context = createContext({
			recordId: '0000000000000000001',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Record not found for id 1',
			response: {
				body: {
					message: 'Record not found for id 1',
				},
			},
		});

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'delete',
				database_name: 'orders',
				record_id: '0000000000000000001',
				status_code: 404,
				reason: 'NOT_FOUND',
				message: expect.stringContaining('id 0000000000000000001'),
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json.message).not.toContain('id 1');
	});

	it('should preserve error instance fields while rewriting zero-padded record ids', async () => {
		const context = createContext({
			recordId: '0000000000000000001',
			enableAiErrorMode: 'true',
		});
		const error = new Error('Record not found for id 1');
		error.stack = `Error: Record not found for id 1\n    at delete-test:1:1`;
		mockZohoCliqApiRequest.mockRejectedValue(error);

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'delete',
				database_name: 'orders',
				record_id: '0000000000000000001',
				message: expect.stringContaining('id 0000000000000000001'),
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json.message).not.toContain('id 1');
		expect(error.stack).toContain('id 1');
	});

	it('should rethrow cloned error instances with rewritten stack and custom fields', async () => {
		const context = createContext({
			recordId: '0000000000000000001',
		});
		const error = new Error('Record not found for id 1') as Error & { details?: string };
		Object.defineProperty(error, 'stack', {
			value: 'Error: Record not found for id 1\n    at delete-test:1:1',
			configurable: true,
			writable: true,
		});
		error.details = 'record_id: 1';
		mockZohoCliqApiRequest.mockRejectedValue(error);

		let thrownError: unknown;
		try {
			await del.execute.call(context, items, SCOPES.DATABASE_DELETE);
		} catch (caughtError) {
			thrownError = caughtError;
		}

		expect(thrownError).toBeInstanceOf(Error);
		expect((thrownError as Error).message).toContain('id 0000000000000000001');
		expect((thrownError as Error).stack).toContain('id 0000000000000000001');
		expect((thrownError as { details?: string }).details).toBe('record_id: 0000000000000000001');
		expect(error.stack).toContain('id 1');
		expect(error.details).toBe('record_id: 1');
	});

	it('should handle error instances without an own message descriptor', async () => {
		const context = createContext({
			recordId: '0000000000000000001',
		});
		const error = Object.create(Error.prototype) as Error & { details?: string; name: string };
		error.name = 'Error';
		Object.defineProperty(error, 'stack', {
			value: 'Error: Record not found for id 1\n    at delete-test:1:1',
			configurable: true,
			writable: true,
		});
		error.details = 'record_id: 1';
		mockZohoCliqApiRequest.mockRejectedValue(error);

		let thrownError: unknown;
		try {
			await del.execute.call(context, items, SCOPES.DATABASE_DELETE);
		} catch (caughtError) {
			thrownError = caughtError;
		}

		expect(thrownError).toBeInstanceOf(Error);
		expect((thrownError as Error).message).toBe('');
		expect((thrownError as Error).stack).toContain('id 0000000000000000001');
		expect((thrownError as { details?: string }).details).toBe('record_id: 0000000000000000001');
	});

	it('should handle error instances with an undefined own message value', async () => {
		const context = createContext({
			recordId: '0000000000000000001',
		});
		const error = new Error('placeholder') as Error & { details?: string };
		Object.defineProperty(error, 'message', {
			value: undefined,
			configurable: true,
			writable: true,
		});
		error.details = 'record_id: 1';
		mockZohoCliqApiRequest.mockRejectedValue(error);

		let thrownError: unknown;
		try {
			await del.execute.call(context, items, SCOPES.DATABASE_DELETE);
		} catch (caughtError) {
			thrownError = caughtError;
		}

		expect(thrownError).toBeInstanceOf(Error);
		expect((thrownError as Error).message).toBe('');
		expect((thrownError as { details?: string }).details).toBe('record_id: 0000000000000000001');
	});

	it('should rewrite zero-padded record ids inside thrown array errors', async () => {
		const context = createContext({
			recordId: '0000000000000000001',
		});
		mockZohoCliqApiRequest.mockRejectedValue([
			'Record not found for id 1',
			{ details: 'record_id: 1' },
		]);

		await expect(del.execute.call(context, items, SCOPES.DATABASE_DELETE)).rejects.toEqual([
			'Record not found for id 0000000000000000001',
			{ details: 'record_id: 0000000000000000001' },
		]);
	});

	it('should preserve all-zero record ids in recoverable not-found messages', async () => {
		const context = createContext({
			recordId: '000',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Record not found for id 0',
		});

		const result = await del.execute.call(context, items, SCOPES.DATABASE_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'delete',
				record_id: '000',
				status_code: 404,
				reason: 'NOT_FOUND',
				message: expect.stringContaining('id 000'),
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json.message).toBe('Record not found for id 000');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(del.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'deleteDatabaseRecordDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'deleteDatabaseRecordAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
