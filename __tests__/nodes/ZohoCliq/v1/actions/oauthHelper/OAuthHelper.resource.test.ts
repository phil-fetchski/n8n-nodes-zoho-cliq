import * as oauthHelper from '../../../../../../nodes/ZohoCliq/v1/actions/oauthHelper/OAuthHelper.resource';

describe('ZohoCliq - OAuthHelper Resource', () => {
	it('should expose all expected operations', () => {
		expect(oauthHelper).toHaveProperty('getGrantedScopes');
		expect(oauthHelper).toHaveProperty('listScopePacks');
		expect(oauthHelper).toHaveProperty('checkScopePack');
	});

	it('should define operation selector for oauthHelper resource', () => {
		const operationProperty = oauthHelper.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['oauthHelper']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('getGrantedScopes');
		const options = operationProperty?.options as Array<{ value: string }>;
		expect(options.map((option) => option.value)).toEqual([
			'getGrantedScopes',
			'listScopePacks',
			'checkScopePack',
		]);
	});

	it('should describe oauth helper operations as scope-diagnostic helpers', () => {
		const operationProperty = oauthHelper.description.find((prop) => prop.name === 'operation');
		const options = operationProperty?.options as Array<{ value: string; description: string }>;

		const getGrantedScopesOption = options.find((option) => option.value === 'getGrantedScopes');
		const listScopePacksOption = options.find((option) => option.value === 'listScopePacks');
		const checkScopePackOption = options.find((option) => option.value === 'checkScopePack');

		expect(getGrantedScopesOption?.description).toContain('missing-scope');
		expect(listScopePacksOption?.description).toContain('scope packs');
		expect(checkScopePackOption?.description).toContain('current token');
	});
});
