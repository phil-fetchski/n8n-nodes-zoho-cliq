import * as resource from '../../../../../../nodes/ZohoCliq/v1/actions/channel/Channel.resource';

describe('ZohoCliq - Channel resource definition', () => {
	it('should expose all channel operation handlers', () => {
		expect(resource.addBot).toBeDefined();
		expect(resource.addMembers).toBeDefined();
		expect(resource.approve).toBeDefined();
		expect(resource.archive).toBeDefined();
		expect(resource.changePermission).toBeDefined();
		expect(resource.changeRole).toBeDefined();
		expect(resource.create).toBeDefined();
		expect(resource.delete).toBeDefined();
		expect(resource.get).toBeDefined();
		expect(resource.getMembers).toBeDefined();
		expect(resource.join).toBeDefined();
		expect(resource.leave).toBeDefined();
		expect(resource.list).toBeDefined();
		expect(resource.reject).toBeDefined();
		expect(resource.removeBot).toBeDefined();
		expect(resource.removeMember).toBeDefined();
		expect(resource.removeMembers).toBeDefined();
		expect(resource.unarchive).toBeDefined();
		expect(resource.update).toBeDefined();
	});

	it('should include channel operation selector with expected operations', () => {
		const operationField = resource.description.find(
			(field) => field.name === 'operation' && field.type === 'options',
		);
		expect(operationField).toBeDefined();
		const options = ((operationField?.options ?? []) as Array<{ value?: string }>).map(
			(option) => option.value,
		);
		expect(options).toStrictEqual([
			'addBot',
			'addMembers',
			'approve',
			'archive',
			'changeRole',
			'changePermission',
			'create',
			'delete',
			'get',
			'getMembers',
			'join',
			'leave',
			'list',
			'reject',
			'removeBot',
			'removeMembers',
			'removeMember',
			'unarchive',
			'update',
		]);
	});
});
