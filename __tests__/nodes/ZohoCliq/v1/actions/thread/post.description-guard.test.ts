describe('ZohoCliq - Thread - Post Description Guard', () => {
	afterEach(() => {
		jest.resetModules();
		jest.dontMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload');
	});

	it('should build description when plain text notice is not present in shared payload fields', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
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

			const postModule =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/thread/post.operation');
			expect(Array.isArray(postModule.description)).toBe(true);
			expect(postModule.description).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: 'text',
						type: 'string',
					}),
				]),
			);
		});
	});

	it('moves plainTextMarkdownNotice after text when shared payload starts with notice', async () => {
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

			const postModule =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/thread/post.operation');
			const names = postModule.description.map((property: { name: string }) => property.name);
			expect(names.indexOf('plainTextMarkdownNotice')).toBeGreaterThan(names.indexOf('text'));
		});
	});

	it('keeps order when plainTextMarkdownNotice is already after text', async () => {
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

			const postModule =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/thread/post.operation');
			const names = postModule.description.map((property: { name: string }) => property.name);
			expect(names.indexOf('text')).toBeLessThan(names.indexOf('plainTextMarkdownNotice'));
		});
	});
});
