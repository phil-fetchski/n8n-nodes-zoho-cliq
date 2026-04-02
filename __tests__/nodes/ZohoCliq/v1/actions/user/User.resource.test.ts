import * as user from '../../../../../../nodes/ZohoCliq/v1/actions/user/User.resource';

describe('ZohoCliq - User Resource', () => {
	it('should expose all expected user operations', () => {
		expect(user).toHaveProperty('create');
		expect(user).toHaveProperty('get');
		expect(user).toHaveProperty('getTeams');
		expect(user).toHaveProperty('list');
		expect(user).toHaveProperty('listLayouts');
		expect(user).toHaveProperty('update');
	});

	it('should define operation selector for user resource', () => {
		const operationProperty = user.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['user']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('list');
	});
});
