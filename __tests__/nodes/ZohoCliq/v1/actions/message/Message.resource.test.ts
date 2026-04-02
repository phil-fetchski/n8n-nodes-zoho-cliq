import * as message from '../../../../../../nodes/ZohoCliq/v1/actions/message/Message.resource';

describe('ZohoCliq - Message Resource', () => {
	it('should expose all expected operations', () => {
		expect(message).toHaveProperty('delete');
		expect(message).toHaveProperty('edit');
		expect(message).toHaveProperty('get');
		expect(message).toHaveProperty('post');
		expect(message).toHaveProperty('retrieve');
		expect(message).toHaveProperty('scheduleMessage');
	});

	it('should define operation selector for message resource', () => {
		const operationProperty = message.description.find((property) => property.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['message']);
		expect(operationProperty?.default).toBe('post');

		const optionValues = ((operationProperty?.options ?? []) as Array<{ value: string }>).map(
			(option) => option.value,
		);
		expect(optionValues).toEqual(['delete', 'edit', 'get', 'post', 'retrieve', 'scheduleMessage']);
	});
});
