describe('ZohoCliq - Shared - Schedule Message Description Branches', () => {
	afterEach(() => {
		jest.resetModules();
		jest.dontMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload');
	});

	it('should handle bot field mapping when source field has no displayOptions.show', () => {
		jest.resetModules();
		jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
			messagePayloadDescription: [
				{
					displayName: 'Message Type',
					name: 'messageType',
					type: 'options',
					default: 'text',
					options: [{ name: 'Text', value: 'text' }],
				},
				{
					displayName: 'Text',
					name: 'text',
					type: 'string',
					default: '',
				},
				{
					displayName: 'Post As Bot',
					name: 'postAsBot',
					type: 'boolean',
					default: false,
				},
				{
					displayName: 'Bot Unique Name',
					name: 'botUniqueName',
					type: 'string',
					default: '',
				},
			],
			resolveBotUniqueNameQueryParam: jest.fn(),
			resolveMessagePayload: jest.fn(),
		}));

		return import('../../../../../../nodes/ZohoCliq/v1/actions/shared/scheduleMessage.operation').then(
			(moduleUnderTest) => {
				const botUniqueName = moduleUnderTest.description.find(
					(p: { name: string; displayOptions?: { show?: Record<string, unknown> } }) =>
						p.name === 'botUniqueName',
				);

				expect(botUniqueName).toBeDefined();
				if (!botUniqueName?.displayOptions?.show) {
					throw new Error('Expected botUniqueName field to include displayOptions.show');
				}
				expect(botUniqueName.displayOptions.show).toMatchObject({
					scheduleMode: ['time'],
				});
			},
		);
	});
});
