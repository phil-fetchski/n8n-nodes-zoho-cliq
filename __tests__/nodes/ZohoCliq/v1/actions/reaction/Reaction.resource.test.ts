import * as reaction from '../../../../../../nodes/ZohoCliq/v1/actions/reaction/Reaction.resource';

describe('ZohoCliq - Reaction resource', () => {
	it('should expose the reaction operations', () => {
		expect(reaction.get).toBeDefined();
		expect(reaction.add).toBeDefined();
		expect(reaction.remove).toBeDefined();

		const operationProperty = reaction.description.find(
			(property) => property.name === 'operation',
		);
		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['reaction']);
	});
});
