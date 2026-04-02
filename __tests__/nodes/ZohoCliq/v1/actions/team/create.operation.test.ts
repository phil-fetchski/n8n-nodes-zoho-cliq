import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/team/create.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - Create Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const requiredScope = getRequiredScopeForOperation('team', 'create');

	const createContext = (
		values: {
			inputMode?: unknown;
			name?: unknown;
			description?: unknown;
			userIds?: unknown;
			teamDefinition?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			inputMode = 'structured',
			name = '',
			description = '',
			userIds = '',
			teamDefinition = {},
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'team';
					if (parameterName === 'operation') return 'create';
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'name') return name;
					if (parameterName === 'description') return description;
					if (parameterName === 'userIds') return userIds;
					if (parameterName === 'teamDefinition') return teamDefinition;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
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
		mockZohoCliqApiRequest.mockClear();
	});

	it('should create team successfully', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'structured',
			name: 'Engineering',
			description: 'Core platform team',
			userIds: '',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_CREATE;

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success', id: 'TEAM123' });

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/teams', {
			name: 'Engineering',
			description: 'Core platform team',
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const mockExecuteFunctions = createContext();
		const items: INodeExecutionData[] = [{ json: {} }];

		let thrownError: unknown;
		try {
			await create.execute.call(mockExecuteFunctions, items, '');
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
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should throw error when team name is missing', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'structured',
			name: '   ',
			description: 'Only description',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_CREATE;

		await expect(create.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Team name is required',
		);
	});

	it('should throw error for unsafe keys in payload', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'raw',
			teamDefinition: {
				name: 'Engineering',
				constructor: 'bad',
			},
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_CREATE;

		await expect(create.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Unsafe key',
		);
	});

	it('should create team with structured user IDs', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'structured',
			name: 'Engineering',
			description: '',
			userIds: '44344926,54667722',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_CREATE;

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/teams', {
			name: 'Engineering',
			user_ids: ['44344926', '54667722'],
		});
	});

	it('should return a recoverable validation payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'xml',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await create.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				reason: 'INVALID_INPUT_MODE',
				input_mode: 'xml',
			}),
		);
	});

	it('should include the requested team name in recoverable API errors', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'structured',
			name: 'Engineering',
			description: 'Core platform team',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValue({ statusCode: 429, message: 'Too Many Requests' });

		const result = await create.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				name: 'Engineering',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
	});

	it('should return a recoverable invalid team name payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'structured',
			name: '   ',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await create.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				reason: 'INVALID_TEAM_NAME',
			}),
		);
	});

	it('should return a recoverable too-long team name payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'structured',
			name: 'a'.repeat(31),
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await create.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				reason: 'INVALID_TEAM_NAME',
			}),
		);
	});

	it('should return a recoverable empty payload error in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'raw',
			teamDefinition: '   ',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await create.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				reason: 'EMPTY_TEAM_PAYLOAD',
			}),
		);
	});

	it('should return a recoverable invalid JSON payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'raw',
			teamDefinition: '{bad',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await create.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				reason: 'INVALID_TEAM_JSON',
			}),
		);
	});

	it('should return a recoverable invalid user_ids payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'raw',
			teamDefinition: { name: 'Engineering', user_ids: [] },
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await create.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				reason: 'INVALID_USER_IDS',
			}),
		);
	});

	it('should recover missing user IDs via user preflight in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			inputMode: 'raw',
			teamDefinition: { name: 'Engineering', user_ids: ['44344926', '54667722'] },
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockResolvedValue({
			users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
			has_more: false,
		});

		const result = await create.execute.call(
			mockExecuteFunctions,
			items,
			`${requiredScope},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'create',
				name: 'Engineering',
				invalid_user_ids: ['54667722'],
				reason: 'USER_IDS_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'POST',
			'/api/v2/teams',
			expect.anything(),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(create.description.find((property) => property.name === 'createTeamDocsNotice')).toEqual(
			expect.objectContaining({ name: 'createTeamDocsNotice', type: 'notice' }),
		);
		expect(
			create.description.find((property) => property.name === 'createTeamAiToolGuideNotice'),
		).toEqual(expect.objectContaining({ name: 'createTeamAiToolGuideNotice', type: 'notice' }));
	});
});
