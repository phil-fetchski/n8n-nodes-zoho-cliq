import * as designation from '../../../../../../nodes/ZohoCliq/v1/actions/designation/Designation.resource';

describe('ZohoCliq - Designation Resource', () => {
	it('should expose the expected operation options', () => {
		const operationProperty = designation.description.find(
			(property) => property.name === 'operation',
		);
		expect(operationProperty).toBeDefined();
		const options = operationProperty!.options ?? [];

		expect(options.some((option) => option.name === 'List Designations')).toBe(true);
		expect(options.some((option) => option.name === 'Get Designation')).toBe(true);
		expect(options.some((option) => option.name === 'Add Designation Members')).toBe(true);
	});

	it('should export handlers for all designation operations', () => {
		expect(designation.addMembers).toBeDefined();
		expect(designation.create).toBeDefined();
		expect(designation.delete).toBeDefined();
		expect(designation.get).toBeDefined();
		expect(designation.getMembers).toBeDefined();
		expect(designation.list).toBeDefined();
		expect(designation.removeMembers).toBeDefined();
		expect(designation.update).toBeDefined();
	});
});
