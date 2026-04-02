import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import { TEAM_NOT_FOUND_MESSAGE } from '../../../../../../nodes/ZohoCliq/v1/actions/team/common';
import * as getMembers from '../../../../../../nodes/ZohoCliq/v1/actions/team/getMembers.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - Get Members Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			teamId?: string;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const { teamId = 'team_123', enableAiErrorMode = false, continueOnFail = false } = values;

		return {
			getNodeParameter: jest.fn(
				(
					parameterName: string,
					_itemIndex?: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (parameterName === 'teamId' && options?.extractValue) {
						return teamId;
					}
					if (parameterName === 'teamId') {
						return { mode: 'id', value: teamId };
					}
					if (parameterName === 'resource') return 'team';
					if (parameterName === 'operation') return 'getMembers';
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
		mockZohoCliqApiRequest.mockReset();
	});

	it('should get team members successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			members: [{ user_id: '44344926', display_name: 'Olivia Palmer', is_moderator: false }],
		});

		const result = await getMembers.execute.call(context, items, SCOPES.TEAMS_READ);

		expect(result[0].json).toEqual({
			members: [{ user_id: '44344926', display_name: 'Olivia Palmer', is_moderator: false }],
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123/members');
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('team', 'getMembers');
		let thrownError: unknown;
		try {
			await getMembers.execute.call(context, items, '');
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

	it('should throw error for invalid team ID', async () => {
		const context = createContext({ teamId: 'invalid id' });

		await expect(getMembers.execute.call(context, items, SCOPES.TEAMS_READ)).rejects.toThrow(
			'Invalid Team ID format',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			teamId: 'bad id',
			continueOnFail: true,
		});

		const result = await getMembers.execute.call(context, items, SCOPES.TEAMS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'getMembers',
				team_id: 'bad id',
				reason: 'INVALID_TEAM_ID',
			}),
		);
	});

	it('should omit team_id from recoverable output when the submitted team ID is blank', async () => {
		const context = createContext({
			teamId: '   ',
			continueOnFail: true,
		});

		const result = await getMembers.execute.call(context, items, SCOPES.TEAMS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'getMembers',
				reason: 'INVALID_TEAM_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('team_id');
	});

	it('should return a recoverable team-not-found error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await getMembers.execute.call(context, items, SCOPES.TEAMS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'getMembers',
				team_id: 'team_123',
				message: TEAM_NOT_FOUND_MESSAGE,
				reason: 'TEAM_NOT_FOUND',
			}),
		);
	});

	it('should stop before the members endpoint when team preflight cannot find the team', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await getMembers.execute.call(context, items, SCOPES.TEAMS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'getMembers',
				team_id: 'team_123',
				message: TEAM_NOT_FOUND_MESSAGE,
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'GET',
			'/api/v2/teams/team_123/members',
		);
	});

	it('should surface the shared preflight failure when team lookup cannot be inspected conclusively', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('preflight temporarily unavailable'))
			.mockRejectedValueOnce({
				statusCode: 404,
				message: 'Not Found',
			});

		const result = await getMembers.execute.call(context, items, SCOPES.TEAMS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'getMembers',
				team_id: 'team_123',
				message: 'preflight temporarily unavailable',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/teams/team_123');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should normalize a generic 400 preflight lookup failure into TEAM_NOT_FOUND', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		const result = await getMembers.execute.call(context, items, SCOPES.TEAMS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'getMembers',
				team_id: 'team_123',
				message: TEAM_NOT_FOUND_MESSAGE,
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(getMembers.description.slice(-2)).toEqual([
			expect.objectContaining({ name: 'getTeamMembersDocsNotice', type: 'notice' }),
			expect.objectContaining({ name: 'getTeamMembersAiToolGuideNotice', type: 'notice' }),
		]);
	});
});
