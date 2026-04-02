import * as customDomain from '../../../../../../nodes/ZohoCliq/v1/actions/customDomain/CustomDomain.resource';

describe('ZohoCliq - CustomDomain Resource', () => {
	it('should expose all expected operations', () => {
		expect(customDomain).toHaveProperty('get');
		expect(customDomain).toHaveProperty('add');
		expect(customDomain).toHaveProperty('verify');
		expect(customDomain).toHaveProperty('delete');
	});

	it('should define operation selector for customDomain resource', () => {
		const operationProperty = customDomain.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['customDomain']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('get');
	});

	it('should include org-admin notice', () => {
		const noticeProperty = customDomain.description.find(
			(prop) => prop.name === 'customDomainOrgAdminNotice',
		);

		expect(noticeProperty).toBeDefined();
		expect(noticeProperty?.type).toBe('notice');
		expect(noticeProperty?.displayOptions?.show?.resource).toEqual(['customDomain']);
		expect(String(noticeProperty?.displayName)).toContain('Organization Admin');
		expect(String(noticeProperty?.displayName)).toContain('Org Admin (Organization APIs)');
	});
});
