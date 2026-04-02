import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/team/get.operation';
import { TEAM_NOT_FOUND_MESSAGE } from '../../../../../../nodes/ZohoCliq/v1/actions/team/common';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - Get Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const requiredScope = getRequiredScopeForOperation('team', 'get');

	const createContext = (
		values: {
			teamId?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const { teamId = 'team_123', enableAiErrorMode = false, continueOnFail = false } = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'team';
					if (parameterName === 'operation') return 'get';
					if (parameterName === 'teamId') return teamId;
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

	it('should get team successfully', async () => {
		const mockExecuteFunctions = createContext({ teamId: 'team_123' });
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_READ;

		mockZohoCliqApiRequest.mockResolvedValue({ id: 'team_123', name: 'Engineering' });

		const result = await get.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
	});

	it('should throw error for missing OAuth scope', async () => {
		const mockExecuteFunctions = createContext();
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
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should throw error for invalid team ID', async () => {
		const mockExecuteFunctions = createContext({ teamId: 'invalid id' });
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_READ;

		await expect(get.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Invalid Team ID format',
		);
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_404',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValue({ statusCode: 404, message: 'Not Found' });

		const result = await get.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'get',
				team_id: 'team_404',
				reason: 'TEAM_NOT_FOUND',
			}),
		);
	});

	it('should normalize a generic 400 team lookup failure into TEAM_NOT_FOUND in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({
			teamId: 'team_404',
			continueOnFail: true,
			enableAiErrorMode: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		const result = await get.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'get',
				team_id: 'team_404',
				message: TEAM_NOT_FOUND_MESSAGE,
				reason: 'TEAM_NOT_FOUND',
			}),
		);
	});

	it('should surface the raw lookup error outside recoverable mode when shared preflight is inactive', async () => {
		const mockExecuteFunctions = createContext({ teamId: 'team_missing' });
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 400,
				body: { message: 'This team does not exist' },
			},
		});

		let thrownError: unknown;
		try {
			await get.execute.call(mockExecuteFunctions, items, requiredScope);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toEqual(
			expect.objectContaining({
				response: expect.objectContaining({
					status: 400,
					body: expect.objectContaining({
						message: 'This team does not exist',
					}),
				}),
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(get.description[get.description.length - 2]?.name).toBe('getTeamDocsNotice');
		expect(get.description[get.description.length - 1]?.name).toBe('getTeamAiToolGuideNotice');
	});
});
