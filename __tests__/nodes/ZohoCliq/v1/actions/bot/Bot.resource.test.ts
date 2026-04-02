import * as bot from '../../../../../../nodes/ZohoCliq/v1/actions/bot/Bot.resource';

describe('ZohoCliq - Bot.resource', () => {
	it('should expose expected operations in operation options', () => {
		const operationField = bot.description.find((field) => field.name === 'operation');
		expect(operationField).toBeDefined();
		expect(operationField?.type).toBe('options');
		expect(operationField?.displayOptions?.show?.resource).toEqual(['bot']);

		const optionValues = ((operationField?.options ?? []) as Array<{ value: string }>)
			.map((option) => option.value)
			.sort();
		expect(optionValues).toEqual(['getSubscribers', 'triggerCalls']);
	});
});
