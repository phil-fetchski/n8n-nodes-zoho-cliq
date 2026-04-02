describe('scheduleMessage Description Branches', () => {
	afterEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
	});

	it('merges existing bot field show options with scheduleMode time', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
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
						displayOptions: {
							show: {
								target: ['channel'],
							},
						},
					},
				],
				resolveBotUniqueNameQueryParam: jest.fn(),
				resolveMessagePayload: jest.fn(() => ({ text: 'mock' })),
			}));

			const scheduleMessage =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/shared/scheduleMessage.operation');
			const botUniqueNameField = scheduleMessage.description.find(
				(p) => p.name === 'botUniqueName',
			);
			expect(botUniqueNameField?.displayOptions?.show).toMatchObject({
				target: ['channel'],
				scheduleMode: ['time'],
			});
		});
	});

	it('omits removed bot identity fields from the schedule description', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Bot Image',
						name: 'botImage',
						type: 'string',
						default: '',
					},
				],
				resolveBotUniqueNameQueryParam: jest.fn(),
				resolveMessagePayload: jest.fn(() => ({ text: 'mock' })),
			}));

			const scheduleMessage =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/shared/scheduleMessage.operation');
			const botImageField = scheduleMessage.description.find((p) => p.name === 'botImage');
			expect(botImageField).toBeUndefined();
		});
	});
});
