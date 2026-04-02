import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';

import { SCOPE_PACKS } from '../../../../../../credentials/ZohoCliqOAuth2Api.credentials';
import * as checkScopePack from '../../../../../../nodes/ZohoCliq/v1/actions/oauthHelper/checkScopePack.operation';

describe('ZohoCliq - OAuthHelper - CheckScopePack Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			continueOnFail: jest.fn().mockReturnValue(false),
			getNodeParameter: jest.fn(),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	it('should report pack as fully granted when all scopes are present', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue('remindersTasks');

		const result = await checkScopePack.execute.call(
			mockExecuteFunctions,
			items,
			'ZohoCliq.Reminders.ALL',
		);

		expect(result[0].json).toMatchObject({
			operation: 'checkScopePack',
			packName: 'remindersTasks',
			hasAllRequiredScopes: true,
			missingScopes: [],
		});
		expect(result[0].json).not.toHaveProperty('grantedScopes');
	});

	it('should report missing scopes for selected pack', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue('filesStorage');

		const result = await checkScopePack.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ATTACHMENTS_READ,
		);

		expect(result[0].json).toMatchObject({
			packName: 'filesStorage',
			hasAllRequiredScopes: false,
		});
		expect((result[0].json.missingScopes as string[]).length).toBeGreaterThan(0);
		expect(result[0].json).not.toHaveProperty('grantedScopes');
	});

	it('should evaluate diagnostics for every configured scope pack', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const packEntries = Object.entries(SCOPE_PACKS) as Array<
			[keyof typeof SCOPE_PACKS, (typeof SCOPE_PACKS)[keyof typeof SCOPE_PACKS]]
		>;

		for (const [packName, packConfig] of packEntries) {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(packName);

			const fullyGranted = await checkScopePack.execute.call(
				mockExecuteFunctions,
				items,
				packConfig.scopes.join(','),
			);
			expect(fullyGranted[0].json).toMatchObject({
				packName,
				hasAllRequiredScopes: true,
				missingScopes: [],
			});
			expect(fullyGranted[0].json.packScopes).toEqual([...packConfig.scopes]);

			const missingAll = await checkScopePack.execute.call(mockExecuteFunctions, items, '');
			expect(missingAll[0].json).toMatchObject({
				packName,
				hasAllRequiredScopes: false,
				missingScopes: [...packConfig.scopes],
			});
		}
	});

	it('should throw for unknown pack name', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue('unknownPack');

		await expect(
			checkScopePack.execute.call(mockExecuteFunctions, items, SCOPES.PROFILE_READ),
		).rejects.toThrow(NodeOperationError);
		await expect(
			checkScopePack.execute.call(mockExecuteFunctions, items, SCOPES.PROFILE_READ),
		).rejects.toThrow('"coreMessaging"');
	});

	it('should return recoverable errors for unknown pack names when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue('unknownPack');
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const result = await checkScopePack.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.PROFILE_READ,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'oauthHelper',
			operation: 'checkScopePack',
		});
		expect(result[0].json.reason).toContain('Unknown scope pack');
		expect(result[0].json.reason).toContain('"coreMessaging"');
	});

	it('should use pack display names for options', () => {
		const packNameProperty = checkScopePack.description.find(
			(property) => property.name === 'packName',
		);
		const options = (packNameProperty?.options ?? []) as Array<{ name: string }>;
		const validDisplayNames = new Set<string>(
			Object.values(SCOPE_PACKS).map((pack) => pack.displayName),
		);

		for (const option of options) {
			expect(validDisplayNames.has(option.name)).toBe(true);
		}
	});

	it('should expose AI setup notices and pack guidance in the description', () => {
		const notice = checkScopePack.description.find(
			(property) => property.name === 'checkScopePackNotice',
		);
		const aiNotice = checkScopePack.description.find(
			(property) => property.name === 'checkScopePackAiToolNotice',
		);
		const guideNotice = checkScopePack.description.find(
			(property) => property.name === 'checkScopePackAiGuideNotice',
		);
		const packNameProperty = checkScopePack.description.find(
			(property) => property.name === 'packName',
		);

		expect(String(notice?.displayName ?? '')).toContain('direct yes/no answer');
		expect(String(aiNotice?.displayName ?? '')).toContain(
			'Most agent workflows will not need this helper',
		);
		expect(String(aiNotice?.displayName ?? '')).toContain('blocking a later Zoho Cliq operation');
		expect(String(guideNotice?.displayName ?? '')).toContain('Optional AI Tool Guide');
		expect(String(guideNotice?.displayName ?? '')).toContain('Open Tool Setup Guide');
		expect(String(packNameProperty?.description ?? '')).toContain('missing scopes');
		expect(String(packNameProperty?.description ?? '')).toContain('"coreMessaging"');
		expect(packNameProperty?.noDataExpression).toBe(false);
	});
});
