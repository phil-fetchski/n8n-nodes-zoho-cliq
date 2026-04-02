import * as events from '../../../../../../nodes/ZohoCliq/v1/actions/events/Events.resource';

describe('ZohoCliq - Events.resource', () => {
	it('should expose a single operation field with list operation available', () => {
		const operationFields = events.description.filter((field) => field.name === 'operation');
		expect(operationFields).toHaveLength(1);

		const operationField = operationFields[0];
		expect(operationField?.type).toBe('options');
		const optionValues = ((operationField?.options ?? []) as Array<{ value: string }>)
			.map((option) => option.value)
			.sort();
		expect(optionValues).toEqual([
			'create',
			'delete',
			'get',
			'getCalendars',
			'list',
			'update',
			'updateStatus',
			'uploadAttachment',
		]);
	});

	it('should not expose a user-facing enableGetEventsSearch toggle', () => {
		const toggleField = events.description.find((field) => field.name === 'enableGetEventsSearch');
		expect(toggleField).toBeUndefined();
	});
});
