import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as removeMembers from '../../../../../../nodes/ZohoCliq/v1/actions/team/removeMembers.operation';
import { TEAM_NOT_FOUND_MESSAGE } from '../../../../../../nodes/ZohoCliq/v1/actions/team/common';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - Remove Members Operation', () => {
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
					if (parameterName === 'operation') return 'removeMembers';
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

	it('should remove team members successfully with enhanced output by default', async () => {
		const context = createContext();
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ status: 'first-delete' })
			.mockResolvedValueOnce({ status: 'second-delete' });

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/teams/team_123/members/54667722',
		);
		expect(result[0].json).toEqual({
			status: 'second-delete',
			deleted: true,
			success: true,
			resource: 'team',
			operation: 'removeMembers',
			team_id: 'team_123',
			removed_user_ids: ['44344926', '54667722'],
			count: 2,
			api_call_count: 2,
			single_user_endpoint_used: true,
			api_responses: [{ status: 'first-delete' }, { status: 'second-delete' }],
		});
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false, userIds: '44344926' });
		mockZohoCliqApiRequest.mockResolvedValue({ data: '' });

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();

		const requiredScope = getRequiredScopeForOperation('team', 'removeMembers');
		let thrownError: unknown;
		try {
			await removeMembers.execute.call(context, items, '');
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

	it('should throw error for empty user IDs', async () => {
		const context = createContext({ userIds: ' ' });

		await expect(removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE)).rejects.toThrow(
			'User IDs are required',
		);
	});

	it('should throw error when removing more than 100 members', async () => {
		const context = createContext({
			userIds: Array.from({ length: 101 }, (_, index) => `${100000000 + index}`).join(','),
		});

		await expect(removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE)).rejects.toThrow(
			'Cannot remove more than 100 members at once',
		);
	});

	it('should return a recoverable invalid-team-id payload when continueOnFail is enabled', async () => {
		const context = createContext({
			teamId: '   ',
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				reason: 'INVALID_TEAM_ID',
			}),
		);
		expect(result[0].json).not.toHaveProperty('team_id');
	});

	it('should return a recoverable invalid-user-ids payload when continueOnFail is enabled', async () => {
		const context = createContext({
			userIds: 123,
			continueOnFail: true,
		});

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				reason: 'INVALID_USER_IDS',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_ids');
	});

	it('should stop before delete calls when team preflight cannot find the team', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_UPDATE},${SCOPES.TEAMS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
	});

	it('should normalize a generic 400 team lookup failure before the delete loop starts', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_UPDATE},${SCOPES.TEAMS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				message: TEAM_NOT_FOUND_MESSAGE,
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(result[0].json).not.toHaveProperty('partial_success');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
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

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_UPDATE},${SCOPES.TEAMS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				invalid_user_ids: ['54667722'],
				reason: 'USER_IDS_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(3);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			3,
			'GET',
			'/api/v2/users',
			{},
			{
				limit: 100,
				fields: 'display_name',
				status: 'inactive',
			},
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
	});

	it('should validate inactive users via a second user preflight before deleting', async () => {
		const context = createContext({ userIds: 'inactive_54667722', enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockImplementation(async (method, endpoint, _body, query) => {
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123') {
				return { team_id: 'team_123', name: 'Engineering' };
			}
			if (method === 'GET' && endpoint === '/api/v2/users' && !query?.status) {
				return {
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					has_more: false,
				};
			}
			if (method === 'GET' && endpoint === '/api/v2/users' && query?.status === 'inactive') {
				return {
					users: [{ user_id: 'inactive_54667722', display_name: 'Former User' }],
					has_more: false,
				};
			}
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123/members') {
				return {
					members: [{ user_id: 'inactive_54667722', display_name: 'Former User' }],
				};
			}
			if (method === 'DELETE' && endpoint === '/api/v2/teams/team_123/members/inactive_54667722') {
				return { status: 'deleted' };
			}
			throw new Error(`Unexpected request: ${method} ${endpoint}`);
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_UPDATE},${SCOPES.TEAMS_READ},${SCOPES.USERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/teams/team_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/users',
			{},
			{
				limit: 100,
				fields: 'display_name',
			},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			3,
			'GET',
			'/api/v2/users',
			{},
			{
				limit: 100,
				fields: 'display_name',
				status: 'inactive',
			},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			4,
			'GET',
			'/api/v2/teams/team_123/members',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			5,
			'DELETE',
			'/api/v2/teams/team_123/members/inactive_54667722',
		);
		expect(result[0].json).toEqual({
			status: 'deleted',
			deleted: true,
			success: true,
			resource: 'team',
			operation: 'removeMembers',
			team_id: 'team_123',
			removed_user_ids: ['inactive_54667722'],
			count: 1,
			api_call_count: 1,
			single_user_endpoint_used: true,
			api_responses: [{ status: 'deleted' }],
		});
	});

	it('should stop before delete calls when one or more users are not members of the team', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockImplementation(async (method, endpoint, _body, query) => {
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123') {
				return { team_id: 'team_123', name: 'Engineering' };
			}
			if (method === 'GET' && endpoint === '/api/v2/users' && !query?.status) {
				return {
					users: [
						{ user_id: '44344926', display_name: 'Olivia Palmer' },
						{ user_id: '54667722', display_name: 'Quinn Rivers' },
					],
					has_more: false,
				};
			}
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123/members') {
				return {
					members: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
				};
			}
			throw new Error(`Unexpected request: ${method} ${endpoint}`);
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_UPDATE},${SCOPES.TEAMS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				non_member_user_ids: ['54667722'],
				reason: 'USER_IDS_NOT_TEAM_MEMBERS',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(3);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			3,
			'GET',
			'/api/v2/teams/team_123/members',
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
	});

	it('should stop before delete calls when the active team membership preflight gets a malformed roster payload', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockImplementation(async (method, endpoint, _body, query) => {
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123') {
				return { team_id: 'team_123', name: 'Engineering' };
			}
			if (method === 'GET' && endpoint === '/api/v2/users' && !query?.status) {
				return {
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					has_more: false,
				};
			}
			if (method === 'GET' && endpoint === '/api/v2/users' && query?.status === 'inactive') {
				return {
					users: [{ user_id: '54667722', display_name: 'Quinn Rivers' }],
					has_more: false,
				};
			}
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123/members') {
				return { data: { next_token: 'abc123' } };
			}
			throw new Error(`Unexpected request: ${method} ${endpoint}`);
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_UPDATE},${SCOPES.TEAMS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				message:
					'The team membership preflight did not return a members collection that could be verified.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(4);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
	});

	it('should stop before delete calls when the active team membership preflight request fails', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockImplementation(async (method, endpoint, _body, query) => {
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123') {
				return { team_id: 'team_123', name: 'Engineering' };
			}
			if (method === 'GET' && endpoint === '/api/v2/users' && !query?.status) {
				return {
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					has_more: false,
				};
			}
			if (method === 'GET' && endpoint === '/api/v2/users' && query?.status === 'inactive') {
				return {
					users: [{ user_id: '54667722', display_name: 'Quinn Rivers' }],
					has_more: false,
				};
			}
			if (method === 'GET' && endpoint === '/api/v2/teams/team_123/members') {
				throw new Error('lookup failed');
			}
			throw new Error(`Unexpected request: ${method} ${endpoint}`);
		});

		const result = await removeMembers.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_UPDATE},${SCOPES.TEAMS_READ},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926', '54667722'],
				message:
					'The team membership preflight failed before Zoho Cliq could verify the roster for team "team_123".',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(4);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
	});

	it('should handle empty remove members response payload safely', async () => {
		const context = createContext({ userIds: '44344926' });
		mockZohoCliqApiRequest.mockResolvedValue(undefined as unknown as Record<string, never>);

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'team',
			operation: 'removeMembers',
			team_id: 'team_123',
			removed_user_ids: ['44344926'],
			count: 1,
			api_call_count: 1,
			single_user_endpoint_used: true,
			api_responses: [],
		});
	});

	it('should deduplicate user IDs before issuing DELETE calls', async () => {
		const context = createContext({ userIds: '44344926,44344926,54667722' });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/teams/team_123/members/54667722',
		);
		expect(result[0].json).toMatchObject({
			removed_user_ids: ['44344926', '54667722'],
			count: 2,
			api_call_count: 2,
		});
	});

	it('should throw structured partial failure when a mid-loop delete fails', async () => {
		const context = createContext();
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ status: 'success' })
			.mockRejectedValueOnce(new Error('API error'));

		let thrownError: unknown;
		try {
			await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Failed to remove 1 team member(s)');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/teams/team_123/members/44344926',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/teams/team_123/members/54667722',
		);
		expect((thrownError as { zohoCliqPartialResult?: IDataObject }).zohoCliqPartialResult).toEqual(
			expect.objectContaining({
				partial_success: true,
				user_ids: ['44344926', '54667722'],
				removed_user_ids: ['44344926'],
				failed_user_ids: ['54667722'],
				failure_count: 1,
				api_call_count: 2,
				single_user_endpoint_used: true,
			}),
		);
	});

	it('should return a recoverable partial-failure payload when continueOnFail is enabled', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ status: 'success' })
			.mockRejectedValueOnce(new Error('API error'));

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'team',
			operation: 'removeMembers',
			partial_success: true,
			team_id: 'team_123',
			user_ids: ['44344926', '54667722'],
			removed_user_ids: ['44344926'],
			failed_user_ids: ['54667722'],
			failure_count: 1,
			reason: 'REMOVE_TEAM_MEMBERS_FAILED',
		});
	});

	it('should return a recoverable API error payload in AI Error Mode', async () => {
		const context = createContext({
			userIds: '44344926',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('api failed'));

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926'],
				failed_user_ids: ['44344926'],
				failure_count: 1,
				reason: 'REMOVE_TEAM_MEMBERS_FAILED',
				failures: [expect.objectContaining({ error: 'api failed', user_id: '44344926' })],
			}),
		);
	});

	it('should use fallback "An unexpected issue occurred" message for non-Error throwables in recoverable mode', async () => {
		const context = createContext({
			userIds: '44344926',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce('api failed');

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				user_ids: ['44344926'],
				failed_user_ids: ['44344926'],
				failure_count: 1,
				reason: 'REMOVE_TEAM_MEMBERS_FAILED',
				failures: [
					expect.objectContaining({ error: 'An unexpected issue occurred', user_id: '44344926' }),
				],
			}),
		);
	});

	it('should map outer-catch failed-to-remove errors in recoverable mode', async () => {
		const context = {
			getNodeParameter: jest.fn(
				(
					parameterName: string,
					_itemIndex?: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (parameterName === 'teamId' && options?.extractValue) {
						return 'team_123';
					}
					if (parameterName === 'teamId') {
						return { mode: 'id', value: 'team_123' };
					}
					if (parameterName === 'resource') return 'team';
					if (parameterName === 'operation') return 'removeMembers';
					if (parameterName === 'userIds') {
						throw new Error('Failed to remove upstream team member selection');
					}
					if (parameterName === 'enableAiErrorMode') return 'true';
					return fallback;
				},
			),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: 'true' },
			})),
		} as unknown as IExecuteFunctions;

		const result = await removeMembers.execute.call(context, items, SCOPES.TEAMS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'removeMembers',
				team_id: 'team_123',
				reason: 'REMOVE_TEAM_MEMBERS_FAILED',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(removeMembers.description.slice(-2)).toEqual([
			expect.objectContaining({ name: 'deleteTeamMembersDocsNotice', type: 'notice' }),
			expect.objectContaining({ name: 'deleteTeamMembersAiToolGuideNotice', type: 'notice' }),
		]);
	});
});
