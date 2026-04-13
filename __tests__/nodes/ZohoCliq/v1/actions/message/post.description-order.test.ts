describe('Post Message Description Ordering', () => {
	afterEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
	});

	it('moves plainTextMarkdownNotice after text when payload description starts with notice', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Notice',
						name: 'plainTextMarkdownNotice',
						type: 'notice',
						default: '',
					},
					{
						displayName: 'Text',
						name: 'text',
						type: 'string',
						default: '',
					},
				],
				resolveBotUniqueNameQueryParam: jest.fn(),
				resolveMessagePayload: jest.fn(),
			}));

			const postOperation =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
			const names = postOperation.description.map((property: { name: string }) => property.name);
			expect(names.indexOf('plainTextMarkdownNotice')).toBeGreaterThan(names.indexOf('text'));
		});
	});

	it('keeps order unchanged when plainTextMarkdownNotice is already after text', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Text',
						name: 'text',
						type: 'string',
						default: '',
					},
					{
						displayName: 'Notice',
						name: 'plainTextMarkdownNotice',
						type: 'notice',
						default: '',
					},
				],
				resolveBotUniqueNameQueryParam: jest.fn(),
				resolveMessagePayload: jest.fn(),
			}));

			const postOperation =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
			const names = postOperation.description.map((property: { name: string }) => property.name);
			expect(names.indexOf('text')).toBeLessThan(names.indexOf('plainTextMarkdownNotice'));
		});
	});

	it('blocks expressions for the Attach Component Payloads toggle', async () => {
		const postOperation =
			await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
		const attachToggle = postOperation.description.find(
			(property: { name: string }) => property.name === 'attachComponentPayloads',
		);

		expect(attachToggle?.noDataExpression).toBe(true);
	});

	it('shows Text only for messageType text and JSON only for messageType json', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.dontMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload');

			const postOperation =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
			const textField = postOperation.description.find(
				(property: { name: string }) => property.name === 'text',
			);
			const jsonField = postOperation.description.find(
				(property: { name: string }) => property.name === 'jsonBody',
			);

			expect(textField).toBeDefined();
			expect(jsonField).toBeDefined();
			expect(textField?.required).toBe(false);
			expect(textField?.displayOptions?.show?.messageType).toEqual(['text']);
			expect(jsonField?.displayOptions?.show?.messageType).toEqual(['json']);
		});
	});

	it('exposes a single fixed-path Bot Unique Name field across channel, bot, and chat targets', async () => {
		const postOperation =
			await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
		const botField = postOperation.description.find(
			(property: { name: string }) => property.name === 'botUniqueName',
		);

		expect(botField).toBeDefined();
		expect(botField?.displayName).toBe('Bot Unique Name');
		expect(botField?.displayOptions?.show?.target).toEqual(['channel', 'bot', 'chat']);
	});

	it('exposes a single agent-choice Bot Unique Name field under Agent Choice controls', async () => {
		const postOperation =
			await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
		const botField = postOperation.description.find(
			(property: { name: string }) => property.name === 'agentBotUniqueName',
		);

		expect(botField).toBeDefined();
		expect(botField?.displayName).toBe('Bot Unique Name');
		expect(botField?.displayOptions?.show?.target).toEqual(['agentChoice']);
	});
});
