import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/userFields/list.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserFields - List Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should list user fields successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'simplify') {
				return false;
			}
			if (name === 'simplifyMode') {
				return 'simplified';
			}
			if (name === 'simplifyFields') {
				return [];
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ list: [{ id: 'UF_1' }, { id: 'UF_2' }] });

		const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ list: [{ id: 'UF_1' }, { id: 'UF_2' }] });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/userfields');
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('userFields', 'list');
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

	it('should return item error payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue(new Error('API failed'));

		const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'list',
			}),
		);
	});

	it('should return recoverable payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {
				enableAiErrorMode: true,
			},
		});
		mockZohoCliqApiRequest.mockRejectedValue(new Error('API failed'));

		const result = await list.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'list',
				message: 'API failed',
			}),
		);
	});

	it('should keep description property displayOptions merged on each field', () => {
		for (const property of list.description) {
			expect(property.displayOptions).toBeDefined();
			const show = property.displayOptions?.show;
			// Properties with their own displayOptions (e.g. simplifyFields) may override the base show
			const hasBaseDisplayOptions = show?.resource !== undefined && show?.operation !== undefined;
			const hasOwnDisplayOptions = show !== undefined && Object.keys(show).length > 0;
			expect(hasBaseDisplayOptions || hasOwnDisplayOptions).toBe(true);
			if (hasBaseDisplayOptions) {
				expect(show).toMatchObject({
					resource: ['userField'],
					operation: ['list'],
				});
			}
		}
	});
});
