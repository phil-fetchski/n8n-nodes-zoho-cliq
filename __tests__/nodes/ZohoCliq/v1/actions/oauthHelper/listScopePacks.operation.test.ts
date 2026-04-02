import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPE_PACKS } from '../../../../../../credentials/ZohoCliqOAuth2Api.credentials';

import * as listScopePacks from '../../../../../../nodes/ZohoCliq/v1/actions/oauthHelper/listScopePacks.operation';

describe('ZohoCliq - OAuthHelper - ListScopePacks Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			continueOnFail: jest.fn().mockReturnValue(false),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	it('should return configured scope pack catalog', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await listScopePacks.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Reminders.ALL,ZohoCliq.Organisation.READ',
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			operation: 'listScopePacks',
		});
		expect(result[0].json).not.toHaveProperty('grantedScopes');
		expect(result[0].json).toHaveProperty('totalPacks');
		expect(result[0].json).toHaveProperty('packs');
		expect(Array.isArray(result[0].json.packs)).toBe(true);
		for (const pack of result[0].json.packs as Array<Record<string, unknown>>) {
			expect(pack).toEqual(expect.any(Object));
			expect(typeof pack.packName).toBe('string');
			expect(typeof pack.displayName).toBe('string');
			expect(typeof pack.description).toBe('string');
			expect(Array.isArray(pack.scopes)).toBe(true);
			expect(typeof pack.scopeCount).toBe('number');
			expect(typeof pack.hasAllRequiredScopes).toBe('boolean');
			expect(Array.isArray(pack.missingScopes)).toBe(true);
			expect(typeof pack.grantedScopeCount).toBe('number');
			for (const scope of pack.scopes as unknown[]) {
				expect(typeof scope).toBe('string');
			}
			for (const scope of pack.missingScopes as unknown[]) {
				expect(typeof scope).toBe('string');
			}
		}

		const remindersPack = (result[0].json.packs as Array<Record<string, unknown>>).find(
			(pack) => pack.packName === 'remindersTasks',
		);
		expect(remindersPack?.hasAllRequiredScopes).toBe(true);
		expect(result[0].json.totalPacks).toBe(Object.keys(SCOPE_PACKS).length);
	});

	it('should report accurate orgAdmin pack diagnostics for partial grants', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await listScopePacks.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Organisation.READ,ZohoCliq.OrganizationChannels.READ',
		);

		const orgAdminPack = (result[0].json.packs as Array<Record<string, unknown>>).find(
			(pack) => pack.packName === 'orgAdmin',
		);

		expect(orgAdminPack).toBeDefined();
		expect(orgAdminPack?.hasAllRequiredScopes).toBe(false);
		expect(orgAdminPack?.grantedScopeCount).toBe(2);
		expect(orgAdminPack?.missingScopes).toEqual(
			expect.arrayContaining([
				'ZohoCliq.Organisation.CREATE',
				'ZohoCliq.Organisation.UPDATE',
				'ZohoCliq.Organisation.DELETE',
				'ZohoCliq.OrganizationChats.READ',
				'ZohoCliq.OrganizationMessages.READ',
			]),
		);
		expect(orgAdminPack?.missingScopes).toHaveLength(5);
	});

	it('should expose AI guide notices for scope-pack diagnostics', () => {
		const notice = listScopePacks.description.find(
			(property) => property.name === 'listScopePacksNotice',
		);
		const aiNotice = listScopePacks.description.find(
			(property) => property.name === 'listScopePacksAiToolNotice',
		);
		const guideNotice = listScopePacks.description.find(
			(property) => property.name === 'listScopePacksAiGuideNotice',
		);

		expect(String(notice?.displayName ?? '')).toContain('scope-pack catalog');
		expect(String(aiNotice?.displayName ?? '')).toContain(
			'Most agent workflows will not need this helper',
		);
		expect(String(aiNotice?.displayName ?? '')).toContain('scope groups are missing');
		expect(String(guideNotice?.displayName ?? '')).toContain('Optional AI Tool Guide');
		expect(String(guideNotice?.displayName ?? '')).toContain('Open Tool Setup Guide');
	});

	it('should return recoverable errors when output construction fails and continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.helpers.constructExecutionMetaData as jest.Mock)
			.mockImplementationOnce(() => {
				throw new Error('meta failure');
			})
			.mockImplementation((data) => data);
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const result = await listScopePacks.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Reminders.ALL',
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'oauthHelper',
			operation: 'listScopePacks',
			reason: 'meta failure',
		});
	});
});
