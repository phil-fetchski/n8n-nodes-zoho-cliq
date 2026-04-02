import * as userFields from '../../../../../../nodes/ZohoCliq/v1/actions/userFields/UserFields.resource';

describe('ZohoCliq - UserFields Resource', () => {
	it('should expose operation options for all user field operations', () => {
		const operationProperty = userFields.description.find((p) => p.name === 'operation');
		expect(operationProperty).toBeDefined();
		expect(operationProperty?.type).toBe('options');

		const options = (operationProperty?.options ?? []) as Array<{ name?: string; value?: string }>;
		expect(options.some((option) => option.name === 'Add a User Field')).toBe(true);
		expect(options.some((option) => option.name === 'Retrieve All User Fields')).toBe(true);
		expect(options.some((option) => option.value === 'create')).toBe(true);
		expect(options.some((option) => option.value === 'get')).toBe(true);
		expect(options.some((option) => option.value === 'update')).toBe(true);
		expect(options.some((option) => option.value === 'delete')).toBe(true);
	});

	it('should export handlers for all user field operations', () => {
		expect(userFields.create).toBeDefined();
		expect(userFields.get).toBeDefined();
		expect(userFields.list).toBeDefined();
		expect(userFields.update).toBeDefined();
		expect(userFields.delete).toBeDefined();
	});
});
