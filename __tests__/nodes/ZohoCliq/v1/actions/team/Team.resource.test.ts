import * as TeamResource from '../../../../../../nodes/ZohoCliq/v1/actions/team/Team.resource';

describe('ZohoCliq - Team - Team.resource', () => {
	it('should expose all team operations in defined order', () => {
		const operationProperty = TeamResource.description.find(
			(property) => property.name === 'operation',
		);

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('list');

		const optionValues = ((operationProperty?.options ?? []) as Array<{ value: string }>).map(
			(option) => option.value,
		);
		expect(optionValues).toEqual([
			'addMembers',
			'create',
			'delete',
			'removeMembers',
			'get',
			'getMembers',
			'list',
			'update',
		]);
	});
});
