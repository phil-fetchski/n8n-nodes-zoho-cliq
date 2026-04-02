import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as getCurrent from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/getCurrent.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserStatus - Get Current Operation', () => {
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

	it('should expose docs and AI guide notices', () => {
		expect(getCurrent.description.map((property) => property.name)).toEqual([
			'getCurrentStatusDocsNotice',
			'getCurrentStatusAiToolGuideNotice',
		]);
		expect(getCurrent.description[1]?.displayName).toContain('AI Tool Setup Guide');
	});

	it('should get current status successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_READ;

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'busy', text: 'In meeting' });

		await getCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/statuses/current');
	});

	it('should throw error for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'userStatus';
			if (name === 'operation') return 'getCurrent';
			return undefined;
		});

		const requiredScope = getRequiredScopeForOperation('userStatus', 'getCurrent');
		let thrownError: unknown;
		try {
			await getCurrent.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'userStatus',
			operation: 'getCurrent',
			requiredScopes: [requiredScope],
			missingScopes: [requiredScope],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should return per-item error when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Retrieve current failed'));

		const result = await getCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'userStatus',
					operation: 'getCurrent',
					message: 'Retrieve current failed',
				}),
			},
		]);
	});

	it('should return per-item error when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue(new Error('AI current failure'));

		const result = await getCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'userStatus',
					operation: 'getCurrent',
					message: 'AI current failure',
				}),
			},
		]);
	});

	it('should rethrow when continueOnFail is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Current hard failure'));

		await expect(
			getCurrent.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Current hard failure');
	});
});
