import * as role from '../../../../../../nodes/ZohoCliq/v1/actions/role/Role.resource';

describe('ZohoCliq - Role Resource', () => {
	it('should expose all expected operations', () => {
		expect(role).toHaveProperty('addPermissions');
		expect(role).toHaveProperty('addUsers');
		expect(role).toHaveProperty('buildPermissionsJsonPayload');
		expect(role).toHaveProperty('create');
		expect(role).toHaveProperty('delete');
		expect(role).toHaveProperty('get');
		expect(role).toHaveProperty('getPermissions');
		expect(role).toHaveProperty('getUsers');
		expect(role).toHaveProperty('list');
		expect(role).toHaveProperty('removePermissions');
		expect(role).toHaveProperty('removeUsers');
		expect(role).toHaveProperty('update');
		expect(role).toHaveProperty('updatePermissions');
	});

	it('should define operation selector for role resource', () => {
		const operationProperty = role.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['role']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('list');
	});

	it('should include org-admin hint on the operation selector', () => {
		const operationProperty = role.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(String(operationProperty?.hint)).toContain('Organization Admin');
		expect(String(operationProperty?.hint)).toContain('Org Admin (Organization APIs)');
	});
});
