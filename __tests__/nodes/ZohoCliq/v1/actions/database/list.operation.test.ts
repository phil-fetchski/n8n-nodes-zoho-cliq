import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/database/list.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Database - List Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			tableName?: string;
			additionalFields?: Record<string, unknown>;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			tableName = 'orders',
			additionalFields = { fromIndex: 0, limit: 20, queryParameters: {} },
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'tableName') return tableName;
				if (name === 'additionalFields') return additionalFields;
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

	it('should list database records successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ list: [] });

		const result = await list.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(result[0].json).toEqual({ list: [] });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records',
			{},
			{
				from_index: 0,
				limit: 20,
			},
		);
	});

	it('should merge raw documented query parameters with explicit fields', async () => {
		const context = createContext({
			additionalFields: {
				queryParameters: {
					criteria: ' status==open ',
					from_index: '5',
					limit: '10',
					order_by: '+created_at',
					start_token: ' token-123 ',
				},
				criteria: ' priority==high ',
				limit: 25,
				orderBy: '-updated_at',
				startToken: 'next-456',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ list: [] });

		await list.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records',
			{},
			{
				criteria: 'priority==high',
				from_index: 5,
				limit: 25,
				order_by: '-updated_at',
				start_token: 'next-456',
			},
		);
	});

	it('should omit blank optional string filters after trimming', async () => {
		const context = createContext({
			additionalFields: {
				queryParameters: {
					criteria: '   ',
					order_by: '   ',
					start_token: '   ',
				},
				criteria: '   ',
				orderBy: '   ',
				startToken: '   ',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ list: [] });

		await list.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records',
			{},
			{},
		);
	});

	it('should default raw query parameters to an empty object when not provided', async () => {
		const context = createContext({
			additionalFields: {},
		});
		mockZohoCliqApiRequest.mockResolvedValue({ list: [] });

		await list.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records',
			{},
			{},
		);
	});

	it('should throw for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('database', 'list');

		let thrownError: unknown;
		try {
			await list.execute.call(context, items, '');
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

	it('should reject unsupported raw query parameter keys', async () => {
		const context = createContext({
			additionalFields: {
				queryParameters: { include_meta: true },
			},
		});

		await expect(list.execute.call(context, items, SCOPES.DATABASE_READ)).rejects.toThrow(
			'Unsupported query parameter "include_meta"',
		);
	});

	it('should reject limit values above the OpenAPI-aligned maximum', async () => {
		const context = createContext({
			additionalFields: {
				limit: 101,
				queryParameters: {},
			},
		});

		await expect(list.execute.call(context, items, SCOPES.DATABASE_READ)).rejects.toThrow(
			'Limit must be a whole number between 1 and 100',
		);
	});

	it('should reject invalid orderBy format', async () => {
		const context = createContext({
			additionalFields: {
				orderBy: 'created_at',
				queryParameters: {},
			},
		});

		await expect(list.execute.call(context, items, SCOPES.DATABASE_READ)).rejects.toThrow(
			'Order By must be in the format +column_name or -column_name',
		);
	});

	it('should reject invalid fromIndex values', async () => {
		const context = createContext({
			additionalFields: {
				fromIndex: -1,
				queryParameters: {},
			},
		});

		await expect(list.execute.call(context, items, SCOPES.DATABASE_READ)).rejects.toThrow(
			'From Index must be a whole number greater than or equal to 0',
		);
	});

	it('should reject overly long start tokens', async () => {
		const context = createContext({
			additionalFields: {
				startToken: 'a'.repeat(1025),
				queryParameters: {},
			},
		});

		await expect(list.execute.call(context, items, SCOPES.DATABASE_READ)).rejects.toThrow(
			'Start Token is too long',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			additionalFields: {
				queryParameters: { limit: 0 },
			},
			continueOnFail: true,
		});

		const result = await list.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'list',
				database_name: 'orders',
				reason: 'INVALID_QUERY_PARAMETERS',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 401,
			message: 'Unauthorized',
		});

		const result = await list.execute.call(context, items, SCOPES.DATABASE_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'database',
				operation: 'list',
				database_name: 'orders',
				status_code: 401,
				reason: 'UNAUTHORIZED',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(list.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'listDatabaseRecordsDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'listDatabaseRecordsAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
	});
});
