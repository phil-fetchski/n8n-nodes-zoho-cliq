import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/user/list.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - User - List Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const requiredScope = getRequiredScopeForOperation('user', 'list');

	const createContext = (
		values: {
			search?: unknown;
			additionalFields?: Record<string, unknown>;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
			simplify?: unknown;
			simplifyMode?: unknown;
			simplifyFields?: unknown;
		} = {},
	): IExecuteFunctions => {
		const {
			search = '',
			additionalFields = {},
			enableAiErrorMode = false,
			continueOnFail = false,
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'user';
					if (parameterName === 'operation') return 'list';
					if (parameterName === 'search') return search;
					if (parameterName === 'additionalFields') return additionalFields;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					if (parameterName === 'simplify') return simplify;
					if (parameterName === 'simplifyMode') return simplifyMode;
					if (parameterName === 'simplifyFields') return simplifyFields;
					return fallback;
				},
			),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
			continueOnFail: jest.fn(() => continueOnFail),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockClear();
	});

	it('should list users successfully with full query options', async () => {
		const mockExecuteFunctions = createContext({
			search: 'scott',
			additionalFields: {
				limit: 50,
				nextToken: 'next-page-token',
				status: 'active',
				planType: 'paid',
				sortBy: 'usage',
				modifiedAfter: '2025-06-01T10:00:00Z',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockResolvedValue({
			data: [{ id: '123' }, { id: '456' }],
			has_more: true,
		});

		const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ data: [{ id: '123' }, { id: '456' }], has_more: true });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			expect.objectContaining({
				fields: 'all,display_name,mobile,department,designation',
				search: 'scott',
				limit: 50,
				next_token: 'next-page-token',
				status: 'active',
				plan_type: 'paid',
				sort_by: 'usage',
				modified_after: String(Date.parse('2025-06-01T10:00:00Z')),
			}),
		);
	});

	it('should always send all fields in query', async () => {
		const mockExecuteFunctions = createContext({ search: '', additionalFields: {} });
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			expect.objectContaining({ fields: 'all,display_name,mobile,department,designation' }),
		);
	});

	it('should throw error for invalid status', async () => {
		const mockExecuteFunctions = createContext({
			search: '',
			additionalFields: {
				status: 'unknown',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		await expect(list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ)).rejects.toThrow(
			'Invalid status value',
		);
	});

	it('should throw error for invalid plan_type', async () => {
		const mockExecuteFunctions = createContext({
			search: '',
			additionalFields: {
				planType: 'enterprise',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		await expect(list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ)).rejects.toThrow(
			'Invalid plan_type value',
		);
	});

	it('should throw error for invalid sort_by', async () => {
		const mockExecuteFunctions = createContext({
			search: '',
			additionalFields: {
				sortBy: 'name',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		await expect(list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ)).rejects.toThrow(
			'Invalid sort_by value',
		);
	});

	it('should accept unix timestamp string in modified_after', async () => {
		const mockExecuteFunctions = createContext({
			search: '',
			additionalFields: {
				modifiedAfter: '1730428800000',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			expect.objectContaining({ modified_after: '1730428800000' }),
		);
	});

	it('should throw error for invalid modified_after', async () => {
		const mockExecuteFunctions = createContext({
			search: '',
			additionalFields: {
				modifiedAfter: 'invalid-date',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		await expect(list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ)).rejects.toThrow(
			'Modified After must be a valid date-time string or Unix timestamp',
		);
	});

	it('should ignore nullish search and blank modified_after', async () => {
		const mockExecuteFunctions = createContext({
			search: null,
			additionalFields: {
				modifiedAfter: '   ',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			expect.objectContaining({ fields: 'all,display_name,mobile,department,designation' }),
		);
		const query = mockZohoCliqApiRequest.mock.calls[0][3] as Record<string, unknown>;
		expect(query.search).toBeUndefined();
		expect(query.modified_after).toBeUndefined();
	});

	it('should throw error for missing OAuth scope', async () => {
		const mockExecuteFunctions = createContext();
		const items: INodeExecutionData[] = [{ json: {} }];

		let thrownError: unknown;
		try {
			await list.execute.call(mockExecuteFunctions, items, '');
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
			}),
		);
	});

	it('should continueOnFail with paired item error', async () => {
		const mockExecuteFunctions = createContext({
			search: '',
			additionalFields: {
				limit: 0,
			},
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({
				json: expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'list',
					reason: 'INVALID_LIMIT',
					limit: 0,
					message: 'Limit must be a whole number between 1 and 100',
				}),
			}),
		);
	});

	it('should return INVALID_STATUS in recoverable mode for invalid status values', async () => {
		const mockExecuteFunctions = createContext({
			additionalFields: { status: 'unknown' },
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'list',
				reason: 'INVALID_STATUS',
				status: 'unknown',
				hint: expect.stringContaining('active'),
			}),
		);
	});

	it('should return INVALID_PLAN_TYPE in recoverable mode for invalid plan_type values', async () => {
		const mockExecuteFunctions = createContext({
			additionalFields: { planType: 'enterprise' },
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'list',
				reason: 'INVALID_PLAN_TYPE',
				plan_type: 'enterprise',
				hint: expect.stringContaining('paid'),
			}),
		);
	});

	it('should convert technical next_token failures into INVALID_PAGINATION_TOKEN', async () => {
		const mockExecuteFunctions = createContext({
			additionalFields: { nextToken: 'expired-token' },
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockRejectedValue({
			message: "Couldn't process your request due to a technical error.",
			response: { statusCode: 500 },
		});

		const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'list',
				reason: 'INVALID_PAGINATION_TOKEN',
				next_token: 'expired-token',
				message: 'The pagination token is invalid or expired.',
			}),
		);
		expect(String(result[0].json.hint)).toContain('restart pagination');
	});

	it('should return INVALID_PAGINATION_TOKEN when nextToken is whitespace only in recoverable mode', async () => {
		const mockExecuteFunctions = createContext({
			additionalFields: { nextToken: '   ' },
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'list',
				reason: 'INVALID_PAGINATION_TOKEN',
				message: 'The pagination token is invalid or expired.',
			}),
		);
	});

	it('should convert plain technical-error next_token failures into INVALID_PAGINATION_TOKEN', async () => {
		const mockExecuteFunctions = createContext({
			additionalFields: { nextToken: 'expired-token-2' },
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Technical error',
			response: { statusCode: 500 },
		});

		const result = await list.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'list',
				reason: 'INVALID_PAGINATION_TOKEN',
				next_token: 'expired-token-2',
				message: 'The pagination token is invalid or expired.',
			}),
		);
	});

	it('should return a recoverable scope payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({ enableAiErrorMode: 'true' });
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await list.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'list',
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs, search, and AI guide notices at the bottom of the operation fields', () => {
		const docsNotice = list.description.find((property) => property.name === 'listUsersDocsNotice');
		const aiGuideNotice = list.description.find(
			(property) => property.name === 'listUsersAiToolGuideNotice',
		);
		const searchNotice = list.description.find(
			(property) => property.name === 'searchBehaviorNotice',
		);
		expect(docsNotice).toBeDefined();
		expect(aiGuideNotice).toBeDefined();
		expect(searchNotice).toBeDefined();
		expect(String(docsNotice?.displayName)).toContain('Required Zoho Cliq Scope:');
		expect(String(docsNotice?.displayName)).toContain('Optional Zoho People Scopes:');
		expect(String(searchNotice?.displayName)).toContain('Search Behavior:');
		expect(list.description[list.description.length - 2]?.name).toBe('listUsersDocsNotice');
		expect(list.description[list.description.length - 1]?.name).toBe('listUsersAiToolGuideNotice');
	});
});
