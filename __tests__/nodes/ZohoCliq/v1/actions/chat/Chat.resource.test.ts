import * as resource from '../../../../../../nodes/ZohoCliq/v1/actions/chat/Chat.resource';

describe('ZohoCliq - Chat resource definition', () => {
	it('should expose all chat operation handlers', () => {
		expect(resource.getMembers).toBeDefined();
		expect(resource.getPinnedStickyMessage).toBeDefined();
		expect(resource.leave).toBeDefined();
		expect(resource.list).toBeDefined();
		expect(resource.mute).toBeDefined();
		expect(resource.pinStickyMessage).toBeDefined();
		expect(resource.unmute).toBeDefined();
		expect(resource.unpinStickyMessage).toBeDefined();
	});

	it('should include chat operation selector with expected operations', () => {
		const operationField = resource.description.find(
			(field) => field.name === 'operation' && field.type === 'options',
		);
		expect(operationField).toBeDefined();
		const options = ((operationField?.options ?? []) as Array<{ value?: string }>).map(
			(option) => option.value,
		);
		expect(options).toStrictEqual([
			'getMembers',
			'getPinnedStickyMessage',
			'leave',
			'list',
			'mute',
			'pinStickyMessage',
			'unmute',
			'unpinStickyMessage',
		]);
	});

	it('should describe the list operation as listing all chat types', () => {
		const operationField = resource.description.find(
			(field) => field.name === 'operation' && field.type === 'options',
		) as
			| {
					options?: Array<{
						value?: string;
						description?: string;
						action?: string;
					}>;
			  }
			| undefined;

		const listOption = operationField?.options?.find((option) => option.value === 'list');

		expect(listOption).toEqual(
			expect.objectContaining({
				description:
					'Get a list of chats across multiple chat types (dm, bot, chat, entity_chat) with optional filters',
				action: 'List all chats',
			}),
		);
	});
});
