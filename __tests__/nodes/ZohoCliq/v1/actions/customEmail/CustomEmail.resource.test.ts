import * as customEmail from '../../../../../../nodes/ZohoCliq/v1/actions/customEmail/CustomEmail.resource';

describe('ZohoCliq - CustomEmail Resource', () => {
	it('should expose all expected operations', () => {
		expect(customEmail).toHaveProperty('updateOrganizationEmailConfiguration');
		expect(customEmail).toHaveProperty('getOrganizationEmailConfiguration');
		expect(customEmail).toHaveProperty('updateMailConfiguration');
		expect(customEmail).toHaveProperty('verifyCustomEmail');
		expect(customEmail).toHaveProperty('addCustomEmail');
	});

	it('should define operation selector for customEmail resource', () => {
		const operationProperty = customEmail.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['customEmail']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('getOrganizationEmailConfiguration');
		expect(operationProperty?.options).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Update Mail Configuration',
					value: 'updateOrganizationEmailConfiguration',
					description:
						'Update the single organization-level custom sender name, email address, and CNAME status used for account notification emails',
					action: 'Update mail configuration',
				}),
				expect.objectContaining({
					name: 'Verify Custom Email',
					value: 'getOrganizationEmailConfiguration',
					description:
						'Retrieve the single organization-level custom email configuration and verification state from Zoho Cliq',
					action: 'Verify custom email',
				}),
			]),
		);
	});

	it('should include org-admin notice', () => {
		const noticeProperty = customEmail.description.find(
			(prop) => prop.name === 'customEmailOrgAdminNotice',
		);

		expect(noticeProperty).toBeDefined();
		expect(noticeProperty?.type).toBe('notice');
		expect(noticeProperty?.displayOptions?.show?.resource).toEqual(['customEmail']);
		expect(String(noticeProperty?.displayName)).toContain(
			'single account-level notification sender',
		);
		expect(String(noticeProperty?.displayName)).toContain('Organization Admin');
		expect(String(noticeProperty?.displayName)).toContain('Org Admin (Organization APIs)');
	});
});
