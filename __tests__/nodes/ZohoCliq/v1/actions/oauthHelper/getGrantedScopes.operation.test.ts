import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ALL_SCOPES } from '../../../../../../credentials/ZohoCliqOAuth2Api.credentials';
import * as getGrantedScopes from '../../../../../../nodes/ZohoCliq/v1/actions/oauthHelper/getGrantedScopes.operation';

describe('ZohoCliq - OAuthHelper - GetGrantedScopes Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			getCredentials: jest.fn(),
			getNodeParameter: jest.fn().mockReturnValue(false),
		} as unknown as IExecuteFunctions;
	});

	it('should return token scopes when oauthTokenData.scope exists', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
			scope: 'ZohoCliq.Users.READ, ZohoCliq.Messages.CREATE',
			oauthTokenData: {
				scope: 'ZohoCliq.Users.READ ZohoCliq.Profile.READ,ZohoCliq.Users.READ',
				refresh_token: 'refresh-token-value',
			},
		});

		const result = await getGrantedScopes.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			scopeSource: 'oauthTokenData.scope',
			hasTokenScope: true,
			hasRefreshToken: true,
			grantedScopesOnCurrentToken: ['ZohoCliq.Users.READ', 'ZohoCliq.Profile.READ'],
			counts: { grantedOnCurrentToken: 2 },
		});
	});

	it('should return empty granted scopes when token scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
			scope: 'ZohoCliq.Users.READ,ZohoCliq.Messages.CREATE',
			oauthTokenData: {
				access_token: 'token',
			},
		});

		const result = await getGrantedScopes.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toMatchObject({
			scopeSource: 'oauthTokenData.scope',
			hasTokenScope: false,
			hasRefreshToken: false,
			grantedScopesOnCurrentToken: [],
		});
	});

	it('should handle credentials without oauthTokenData object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
			scope: 'ZohoCliq.Users.READ,ZohoCliq.Messages.CREATE',
		});

		const result = await getGrantedScopes.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Users.READ',
		);

		expect(result[0].json).toMatchObject({
			hasTokenScope: false,
			hasRefreshToken: false,
			grantedScopesOnCurrentToken: [],
			counts: { grantedOnCurrentToken: 0 },
		});
	});

	it('should optionally include all supported node scopes', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
			scope: 'ZohoCliq.Users.READ',
			oauthTokenData: {
				scope: 'ZohoCliq.Users.READ',
			},
		});

		const result = await getGrantedScopes.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toMatchObject({
			hasRefreshToken: false,
			grantedScopesOnCurrentToken: ['ZohoCliq.Users.READ'],
			allSupportedNodeScopes: [...ALL_SCOPES],
			counts: { grantedOnCurrentToken: 1, allSupportedNodeScopes: ALL_SCOPES.length },
		});
	});

	it('should parse token scopes when oauthTokenData.scope is an array', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
			oauthTokenData: {
				scope: [
					'ZohoCliq.Users.READ',
					'ZohoCliq.Messages.CREATE ZohoCliq.Profile.READ',
					42,
					null,
					'ZohoCliq.Users.READ',
				],
			},
		});

		const result = await getGrantedScopes.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toMatchObject({
			hasTokenScope: true,
			hasRefreshToken: false,
			grantedScopesOnCurrentToken: [
				'ZohoCliq.Users.READ',
				'ZohoCliq.Messages.CREATE',
				'ZohoCliq.Profile.READ',
			],
			counts: { grantedOnCurrentToken: 3 },
		});
	});

	it('should throw when credentials are unavailable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue(undefined);

		await expect(getGrantedScopes.execute.call(mockExecuteFunctions, items, '')).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should return recoverable per-item errors when credentials are unavailable and continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue(undefined);
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const result = await getGrantedScopes.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'oauthHelper',
			operation: 'getGrantedScopes',
		});
		expect(result[0].json.reason).toContain('No credentials configured');
	});

	it('should expose AI tool setup notices for guide-driven configuration', () => {
		const aiNotice = getGrantedScopes.description.find(
			(property) => property.name === 'getGrantedScopesAiToolNotice',
		);
		const guideNotice = getGrantedScopes.description.find(
			(property) => property.name === 'getGrantedScopesAiGuideNotice',
		);

		expect(String(aiNotice?.displayName ?? '')).toContain(
			'Most agent workflows will not need this helper',
		);
		expect(String(aiNotice?.displayName ?? '')).toContain('missing required scopes');
		expect(String(guideNotice?.displayName ?? '')).toContain('Optional AI Tool Guide');
		expect(String(guideNotice?.displayName ?? '')).toContain('Open Tool Setup Guide');
	});

	it('should return recoverable item errors when parameter resolution fails and continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
			oauthTokenData: {
				scope: 'ZohoCliq.Users.READ',
			},
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('parameter failure');
		});
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const result = await getGrantedScopes.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'oauthHelper',
			operation: 'getGrantedScopes',
			reason: 'parameter failure',
		});
	});
});
