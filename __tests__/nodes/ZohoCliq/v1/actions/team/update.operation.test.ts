import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/team/update.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - Update Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const requiredScope = getRequiredScopeForOperation('team', 'update');

	const createContext = (
		values: {
			teamId?: unknown;
			inputMode?: unknown;
			name?: unknown;
			description?: unknown;
			teamUpdates?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			teamId = 'team_123',
			inputMode = 'structured',
			name = '',
			description = '',
			teamUpdates = {},
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'team';
					if (parameterName === 'operation') return 'update';
					if (parameterName === 'teamId') return teamId;
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'name') return name;
					if (parameterName === 'description') return description;
					if (parameterName === 'teamUpdates') return teamUpdates;
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

	it('should update team successfully', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'structured',
			description: 'Platform engineering',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_UPDATE;

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/teams/team_123', {
			description: 'Platform engineering',
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const mockExecuteFunctions = createContext();
		const items: INodeExecutionData[] = [{ json: {} }];

		let thrownError: unknown;
		try {
			await update.execute.call(mockExecuteFunctions, items, '');
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
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw error for empty update payload', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'structured',
			name: '',
			description: '',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_UPDATE;

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Team Updates cannot be empty',
		);
	});

	it('should reject unsupported fields in raw mode', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'raw',
			teamUpdates: { joined: true },
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_UPDATE;

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Team Updates contains unsupported field "joined"',
		);
	});

	it('should update team name via structured fields', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'structured',
			name: '  New Team Name  ',
			description: '',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_UPDATE;

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/teams/team_123', {
			name: 'New Team Name',
		});
	});

	it('should error when structured fields are blank', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'structured',
			name: '   ',
			description: '   ',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_UPDATE;

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Team Updates cannot be empty',
		);
	});

	it('should return a recoverable validation payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'structured',
			name: '',
			description: '',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'team_123',
				input_mode: 'structured',
				reason: 'EMPTY_TEAM_UPDATE',
			}),
		);
	});

	it('should return a recoverable invalid input mode payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'xml',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'team_123',
				input_mode: 'xml',
				reason: 'INVALID_INPUT_MODE',
			}),
		);
	});

	it('should return a recoverable invalid team name payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'structured',
			name: 'a'.repeat(31),
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'team_123',
				input_mode: 'structured',
				reason: 'INVALID_TEAM_NAME',
			}),
		);
	});

	it('should preserve the attempted team ID in recoverable invalid team ID payloads', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'invalid id',
			inputMode: 'raw',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'invalid id',
				reason: 'INVALID_TEAM_ID',
			}),
		);
	});

	it('should omit team_id context when the attempted team ID is blank in recoverable invalid team ID payloads', async () => {
		const mockExecuteFunctions = createContext({
			teamId: '   ',
			inputMode: 'raw',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				input_mode: 'raw',
				reason: 'INVALID_TEAM_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('team_id');
	});

	it('should return a recoverable unsupported field payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'raw',
			teamUpdates: { joined: true },
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'team_123',
				reason: 'UNSUPPORTED_TEAM_FIELD',
			}),
		);
	});

	it('should return a recoverable invalid JSON payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_123',
			inputMode: 'raw',
			teamUpdates: '{bad',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'team_123',
				reason: 'INVALID_TEAM_JSON',
			}),
		);
	});

	it('should fall back to generic NOT_FOUND when continueOnFail is enabled but team-read scope is unavailable', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_404',
			inputMode: 'structured',
			description: 'Updated description',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValue({ statusCode: 404, message: 'Not Found' });

		const result = await update.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'team_404',
				reason: 'NOT_FOUND',
				status_code: 404,
			}),
		);
	});

	it('should stop before the update request when team preflight cannot find the team', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_404',
			inputMode: 'structured',
			description: 'Updated description',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await update.execute.call(
			mockExecuteFunctions,
			items,
			`${requiredScope},${SCOPES.TEAMS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'update',
				team_id: 'team_404',
				input_mode: 'structured',
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_404');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'PUT',
			'/api/v2/teams/team_404',
			expect.anything(),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		const docsNoticeIndex = update.description.findIndex(
			(property) => property.name === 'updateTeamDocsNotice',
		);
		const aiGuideNoticeIndex = update.description.findIndex(
			(property) => property.name === 'updateTeamAiToolGuideNotice',
		);

		expect(docsNoticeIndex).toBeGreaterThanOrEqual(0);
		expect(aiGuideNoticeIndex).toBeGreaterThanOrEqual(0);
		expect(update.description[docsNoticeIndex]).toEqual(
			expect.objectContaining({ name: 'updateTeamDocsNotice', type: 'notice' }),
		);
		expect(update.description[aiGuideNoticeIndex]).toEqual(
			expect.objectContaining({ name: 'updateTeamAiToolGuideNotice', type: 'notice' }),
		);
		expect(docsNoticeIndex).toBe(update.description.length - 2);
		expect(aiGuideNoticeIndex).toBe(update.description.length - 1);
	});
});
