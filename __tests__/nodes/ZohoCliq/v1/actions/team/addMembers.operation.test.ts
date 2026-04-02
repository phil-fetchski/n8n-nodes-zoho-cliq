import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as addMembers from '../../../../../../nodes/ZohoCliq/v1/actions/team/addMembers.operation';
import { TEAM_NOT_FOUND_MESSAGE } from '../../../../../../nodes/ZohoCliq/v1/actions/team/common';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - Add Members Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			teamId?: string;
			userIds?: unknown;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			teamId = 'team_123',
			userIds = '44344926,54667722',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

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
					if (parameterName === 'operation') return 'addMembers';
					if (parameterName === 'userIds') return userIds;
					if (parameterName === 'includeEnhancedOutput') return includeEnhancedOutput;
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

	it('should add team members successfully with enhanced output by default', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			members: [{ user_id: '44344926' }, { user_id: '54667722' }],
		});

		const result = await addMembers.execute.call(context, items, SCOPES.TEAMS_CREATE);

		expect(result[0].json).toEqual({
			members: [{ user_id: '44344926' }, { user_id: '54667722' }],
			success: true,
			resource: 'team',
			operation: 'addMembers',
			team_id: 'team_123',
			added_user_ids: ['44344926', '54667722'],
			count: 2,
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/teams/team_123/members', {
			user_ids: ['44344926', '54667722'],
		});
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue({ members: [{ user_id: '44344926' }] });

		const result = await addMembers.execute.call(context, items, SCOPES.TEAMS_CREATE);

		expect(result[0].json).toEqual({ members: [{ user_id: '44344926' }] });
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('team', 'addMembers');
		let thrownError: unknown;
		try {
			await addMembers.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				resource: 'team',
				operation: 'addMembers',
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	});

	it('should throw error for empty user IDs', async () => {
		const context = createContext({ userIds: ' ' });

		await expect(addMembers.execute.call(context, items, SCOPES.TEAMS_CREATE)).rejects.toThrow(
			'User IDs are required',
		);
	});

	it('should throw error when adding more than 100 members', async () => {
		const context = createContext({
			userIds: Array.from({ length: 101 }, (_, index) => `${100000000 + index}`).join(','),
		});

		await expect(addMembers.execute.call(context, items, SCOPES.TEAMS_CREATE)).rejects.toThrow(
			'Cannot add more than 100 members at once',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			userIds: 123,
			continueOnFail: true,
		});

		const result = await addMembers.execute.call(context, items, SCOPES.TEAMS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'addMembers',
				team_id: 'team_123',
				reason: 'INVALID_USER_IDS',
			}),
		);
	});

	it('should omit team_id from recoverable output when the submitted team ID is blank', async () => {
		const context = createContext({
			teamId: '   ',
			continueOnFail: true,
		});

		const result = await addMembers.execute.call(context, items, SCOPES.TEAMS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'addMembers',
				reason: 'INVALID_TEAM_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('team_id');
	});

	it('should fall back to generic NOT_FOUND in AI Error Mode when team-read scope is unavailable', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await addMembers.execute.call(context, items, SCOPES.TEAMS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'addMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				reason: 'NOT_FOUND',
				status_code: 404,
			}),
		);
	});

	it('should stop before the add-members API call when team preflight cannot find the team', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await addMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_CREATE},${SCOPES.TEAMS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'addMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'POST',
			'/api/v2/teams/team_123/members',
			expect.anything(),
		);
	});

	it('should normalize a does-not-exist team lookup response into TEAM_NOT_FOUND', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 400,
				body: { message: 'This team does not exist' },
			},
		});

		const result = await addMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_CREATE},${SCOPES.TEAMS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'addMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				message: TEAM_NOT_FOUND_MESSAGE,
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
	});

	it('should recover missing user IDs via user preflight in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockImplementation(async (method, endpoint) => {
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123') {
				return { team_id: 'team_123', name: 'Engineering' };
			}
			if (method === 'GET' && endpoint === '/api/v2/users') {
				return {
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					has_more: false,
				};
			}
			throw new Error(`Unexpected request: ${method} ${endpoint}`);
		});

		const result = await addMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_CREATE},${SCOPES.TEAMS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'addMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				invalid_user_ids: ['54667722'],
				reason: 'USER_IDS_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'POST',
			'/api/v2/teams/team_123/members',
			expect.anything(),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(addMembers.description.slice(-2)).toEqual([
			expect.objectContaining({ name: 'addTeamMembersDocsNotice', type: 'notice' }),
			expect.objectContaining({ name: 'addTeamMembersAiToolGuideNotice', type: 'notice' }),
		]);
	});
});
