import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/team/list.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Team - List Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const requiredScope = getRequiredScopeForOperation('team', 'list');

	const createContext = (
		values: {
			joined?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const { joined = false, enableAiErrorMode = false, continueOnFail = false } = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'team';
					if (parameterName === 'operation') return 'list';
					if (parameterName === 'joined') return joined;
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

	it('should list teams successfully', async () => {
		const mockExecuteFunctions = createContext({ joined: true });
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_READ;

		mockZohoCliqApiRequest.mockResolvedValue({ teams: [] });

		const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/teams',
			{},
			{ joined: true },
		);
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
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should omit joined query when disabled', async () => {
		const mockExecuteFunctions = createContext({ joined: false });
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.TEAMS_READ;

		mockZohoCliqApiRequest.mockResolvedValue({ teams: [] });

		await list.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams', {}, {});
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const mockExecuteFunctions = createContext({ continueOnFail: true, joined: true });
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockRejectedValue({ statusCode: 429, message: 'Too Many Requests' });

		const result = await list.execute.call(mockExecuteFunctions, items, requiredScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'team',
				operation: 'list',
				status_code: 429,
				reason: 'RATE_LIMITED',
				joined: true,
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
				resource: 'team',
				operation: 'list',
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(list.description[list.description.length - 2]?.name).toBe('listTeamsDocsNotice');
		expect(list.description[list.description.length - 1]?.name).toBe('listTeamsAiToolGuideNotice');
	});
});
