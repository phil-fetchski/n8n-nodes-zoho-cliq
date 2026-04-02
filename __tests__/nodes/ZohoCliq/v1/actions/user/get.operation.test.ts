import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/user/get.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - User - Get Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const requiredScope = getRequiredScopeForOperation('user', 'get');

	const createContext = (
		values: {
			userId?: unknown;
			simplify?: unknown;
			simplifyMode?: unknown;
			simplifyFields?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			userId = 'user@example.com',
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'user';
					if (parameterName === 'operation') return 'get';
					if (parameterName === 'userId') return userId;
					if (parameterName === 'simplify') return simplify;
					if (parameterName === 'simplifyMode') return simplifyMode;
					if (parameterName === 'simplifyFields') return simplifyFields;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
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

	it('should get user successfully with all fields', async () => {
		const mockExecuteFunctions = createContext({
			userId: 'user@example.com',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({ id: '123', email: 'user@example.com' });

		const result = await get.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users/user%40example.com',
			{},
			{ fields: 'all,display_name,mobile,department,designation' },
		);
	});

	it('should succeed in AI Error Mode when email lookup preflight returns a nested data user record', async () => {
		const mockExecuteFunctions = createContext({
			userId: 'user@example.com',
			enableAiErrorMode: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: {
					id: '123',
					email_id: 'user@example.com',
				},
			})
			.mockResolvedValueOnce({
				data: {
					id: '123',
					email_id: 'user@example.com',
					display_name: 'User Example',
				},
			});

		const result = await get.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			data: {
				id: '123',
				email_id: 'user@example.com',
				display_name: 'User Example',
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/users/user%40example.com',
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/users/user%40example.com',
			{},
			{ fields: 'all,display_name,mobile,department,designation' },
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const mockExecuteFunctions = createContext({
			userId: 'user@example.com',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		let thrownError: unknown;
		try {
			await get.execute.call(mockExecuteFunctions, items, '');
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
			userId: 'invalid user id!',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await get.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({
				json: expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'get',
					user_id: 'invalid user id!',
					reason: 'USER_NOT_FOUND',
					message: 'No Zoho Cliq user found for User ID / Email / ZUID "invalid user id!".',
				}),
			}),
		);
	});

	it('should return USER_NOT_FOUND in recoverable mode when shared user preflight confirms no user', async () => {
		const mockExecuteFunctions = createContext({
			userId: 'missing.user@example.com',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const result = await get.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'get',
				user_id: 'missing.user@example.com',
				reason: 'USER_NOT_FOUND',
			}),
		);
		expect(String(result[0].json.message)).toContain('No Zoho Cliq user found');
		expect(String(result[0].json.hint)).toContain('List_users_in_Zoho_Cliq');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should recover a blank user identifier without adding user_id context', async () => {
		const mockExecuteFunctions = createContext({
			userId: '   ',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await get.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'get',
				message: 'User ID is required',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_id');
	});

	it('should recover an undefined user identifier without adding user_id context', async () => {
		const mockExecuteFunctions = {
			...createContext({ continueOnFail: true }),
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'user';
					if (parameterName === 'operation') return 'get';
					if (parameterName === 'userId') return undefined;
					return fallback;
				},
			),
		} as unknown as IExecuteFunctions;
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await get.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'get',
				message: 'User ID is required',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_id');
	});

	it('should preserve the original lookup error when userId retrieval throws', async () => {
		const mockExecuteFunctions = {
			...createContext({ continueOnFail: true }),
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'user';
					if (parameterName === 'operation') return 'get';
					if (parameterName === 'userId') throw new Error('lookup exploded');
					return fallback;
				},
			),
		} as unknown as IExecuteFunctions;
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await get.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'get',
				message: 'lookup exploded',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_id');
	});

	it('should return a recoverable scope payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			userId: 'user@example.com',
			enableAiErrorMode: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await get.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'get',
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
				user_id: 'user@example.com',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices at the bottom with required and optional scopes', () => {
		const docsNotice = get.description.find((property) => property.name === 'getUserDocsNotice');
		const aiGuideNotice = get.description.find(
			(property) => property.name === 'getUserAiToolGuideNotice',
		);
		expect(docsNotice).toBeDefined();
		expect(aiGuideNotice).toBeDefined();
		expect(String(docsNotice?.displayName)).toContain('REQUIRED SCOPES:');
		expect(String(docsNotice?.displayName)).toContain('OPTIONAL ZOHO PEOPLE SCOPES:');
		expect(get.description[get.description.length - 2]?.name).toBe('getUserDocsNotice');
		expect(get.description[get.description.length - 1]?.name).toBe('getUserAiToolGuideNotice');
	});

	it('should configure user selector as resource locator', () => {
		const userField = get.description.find((property) => property.name === 'userId');
		expect(userField?.type).toBe('resourceLocator');
		expect(userField?.default).toEqual({ mode: 'list', value: '' });

		const modes = (userField?.modes ?? []) as Array<{ name: string; type: string }>;
		expect(modes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'list', type: 'list' }),
				expect.objectContaining({ name: 'id', type: 'string' }),
			]),
		);
	});
});
