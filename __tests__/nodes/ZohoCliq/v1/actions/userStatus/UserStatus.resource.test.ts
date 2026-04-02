import * as userStatus from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/UserStatus.resource';

describe('ZohoCliq - UserStatus Resource', () => {
	it('should expose operation options for all user status operations', () => {
		const operationProperty = userStatus.description.find((p) => p.name === 'operation');
		expect(operationProperty).toBeDefined();
		expect(operationProperty?.type).toBe('options');

		const options = (operationProperty?.options ?? []) as Array<{ name?: string; value?: string }>;
		expect(options.some((option) => option.name === 'Add a New Status')).toBe(true);
		expect(options.some((option) => option.name === 'Add a Transient Status')).toBe(true);
		expect(options.some((option) => option.name === 'Delete Status')).toBe(true);
		expect(options.some((option) => option.name === 'Delete Transient Status')).toBe(true);
		expect(options.some((option) => option.name === "Retrieve a User's Status")).toBe(true);
		expect(options.some((option) => option.name === 'Retrieve All Statuses')).toBe(true);
		expect(options.some((option) => option.name === 'Retrieve Current Status')).toBe(true);
		expect(options.some((option) => option.name === 'Update Current Status')).toBe(true);
		expect(options.some((option) => option.value === 'create')).toBe(true);
		expect(options.some((option) => option.value === 'createTransient')).toBe(true);
		expect(options.some((option) => option.value === 'delete')).toBe(true);
		expect(options.some((option) => option.value === 'clearMyStatus')).toBe(true);
		expect(options.some((option) => option.value === 'getUserStatus')).toBe(true);
		expect(options.some((option) => option.value === 'list')).toBe(true);
		expect(options.some((option) => option.value === 'getCurrent')).toBe(true);
		expect(options.some((option) => option.value === 'setCurrent')).toBe(true);
	});

	it('should export handlers for all user status operations', () => {
		expect(userStatus.create).toBeDefined();
		expect(userStatus.createTransient).toBeDefined();
		expect(userStatus.delete).toBeDefined();
		expect(userStatus.clearMyStatus).toBeDefined();
		expect(userStatus.getUserStatus).toBeDefined();
		expect(userStatus.list).toBeDefined();
		expect(userStatus.getCurrent).toBeDefined();
		expect(userStatus.setCurrent).toBeDefined();
	});
});
