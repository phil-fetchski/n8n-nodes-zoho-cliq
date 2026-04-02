describe('Post Message Description channelRLC fallback', () => {
	afterEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
	});

	it('should build channel displayOptions when channelRLC has no displayOptions', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions', () => ({
				...jest.requireActual('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions'),
				channelRLC: {
					displayName: 'Channel',
					name: 'channelId',
					type: 'resourceLocator',
					default: { mode: 'list', value: '' },
					required: true,
					modes: [{ displayName: 'By ID', name: 'id', type: 'string' }],
				},
			}));

			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{ displayName: 'Text', name: 'text', type: 'string', default: '' },
				],
				resolveBotUniqueNameQueryParam: jest.fn(),
				resolveMessagePayload: jest.fn(),
			}));

			const postOperation =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
			const channelProperty = postOperation.description.find(
				(property) => property.name === 'channelId',
			);

			expect(channelProperty).toBeDefined();
			expect(channelProperty?.displayOptions?.show).toMatchObject({
				resource: ['message'],
				operation: ['post'],
				target: ['channel'],
			});
		});
	});

	it('should build channel displayOptions when channelRLC has displayOptions without show', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions', () => ({
				...jest.requireActual('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions'),
				channelRLC: {
					displayName: 'Channel',
					name: 'channelId',
					type: 'resourceLocator',
					default: { mode: 'list', value: '' },
					required: true,
					displayOptions: {},
					modes: [{ displayName: 'By ID', name: 'id', type: 'string' }],
				},
			}));

			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{ displayName: 'Text', name: 'text', type: 'string', default: '' },
				],
				resolveBotUniqueNameQueryParam: jest.fn(),
				resolveMessagePayload: jest.fn(),
			}));

			const postOperation =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
			const channelProperty = postOperation.description.find(
				(property) => property.name === 'channelId',
			);

			expect(channelProperty).toBeDefined();
			expect(channelProperty?.displayOptions?.show).toMatchObject({
				resource: ['message'],
				operation: ['post'],
				target: ['channel'],
			});
		});
	});

	it('should build channel displayOptions when channelRLC show is null', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions', () => ({
				...jest.requireActual('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions'),
				channelRLC: {
					displayName: 'Channel',
					name: 'channelId',
					type: 'resourceLocator',
					default: { mode: 'list', value: '' },
					required: true,
					displayOptions: { show: null },
					modes: [{ displayName: 'By ID', name: 'id', type: 'string' }],
				},
			}));

			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{ displayName: 'Text', name: 'text', type: 'string', default: '' },
				],
				resolveBotUniqueNameQueryParam: jest.fn(),
				resolveMessagePayload: jest.fn(),
			}));

			const postOperation =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/message/post.operation');
			const channelProperty = postOperation.description.find(
				(property) => property.name === 'channelId',
			);

			expect(channelProperty).toBeDefined();
			expect(channelProperty?.displayOptions?.show).toMatchObject({
				resource: ['message'],
				operation: ['post'],
				target: ['channel'],
			});
		});
	});
});
