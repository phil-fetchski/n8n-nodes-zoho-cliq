import * as database from '../../../../../../nodes/ZohoCliq/v1/actions/database/Database.resource';

describe('ZohoCliq - Database Resource', () => {
	it('should expose all expected operations', () => {
		expect(database).toHaveProperty('list');
		expect(database).toHaveProperty('create');
		expect(database).toHaveProperty('get');
		expect(database).toHaveProperty('update');
		expect(database).toHaveProperty('delete');
	});

	it('should define operation selector for database resource', () => {
		const operationProperty = database.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['database']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('list');

		const options = (operationProperty?.options ?? []) as Array<{ value?: string }>;
		const optionValues = options.map((opt) => opt.value);
		expect(optionValues).toEqual(
			expect.arrayContaining(['list', 'create', 'get', 'update', 'delete']),
		);
	});
});
