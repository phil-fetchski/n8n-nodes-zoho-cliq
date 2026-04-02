import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/team/delete.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			teamId?: string;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			teamId = 'team_123',
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
					if (parameterName === 'operation') return 'delete';
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

	it('should return enhanced output by default for delete', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await del.execute.call(context, items, SCOPES.TEAMS_DELETE);

		expect(result[0].json).toEqual({
			status: 'success',
			deleted: true,
			success: true,
			resource: 'team',
			operation: 'delete',
			team_id: 'team_123',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/teams/team_123');
	});

	it("should return Cliq's standard output when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, SCOPES.TEAMS_DELETE);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should throw error for missing OAuth scope', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('team', 'delete');
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

	it('should throw error for empty team ID', async () => {
		const context = createContext({ teamId: ' ' });

		await expect(del.execute.call(context, items, SCOPES.TEAMS_DELETE)).rejects.toThrow(
			'Team ID is required',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({
			teamId: 'bad id',
			continueOnFail: true,
		});

		const result = await del.execute.call(context, items, SCOPES.TEAMS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'delete',
				team_id: 'bad id',
				reason: 'INVALID_TEAM_ID',
			}),
		);
	});

	it('should fall back to generic NOT_FOUND in AI Error Mode when team-read scope is unavailable', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await del.execute.call(context, items, SCOPES.TEAMS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'delete',
				team_id: 'team_123',
				message: 'team_not_exist',
				reason: 'NOT_FOUND',
				status_code: 404,
			}),
		);
	});

	it('should stop before the delete request when team preflight cannot find the team', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'team_not_exist',
		});

		const result = await del.execute.call(
			context,
			items,
			`${SCOPES.TEAMS_DELETE},${SCOPES.TEAMS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'delete',
				team_id: 'team_123',
				reason: 'TEAM_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith('DELETE', '/api/v2/teams/team_123');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(del.description.slice(-2)).toEqual([
			expect.objectContaining({ name: 'deleteTeamDocsNotice', type: 'notice' }),
			expect.objectContaining({ name: 'deleteTeamAiToolGuideNotice', type: 'notice' }),
		]);
	});
});
