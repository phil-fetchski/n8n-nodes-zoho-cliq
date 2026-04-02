import { __testHelpers as descriptionsTestHelpers } from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions';

describe('Message Component Builder - descriptions helpers', () => {
	afterEach(() => {
		jest.resetModules();
		jest.clearAllMocks();
	});

	it('should throw when shared message payload property cannot be found', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');

			expect(() => descriptions.createButtonsProperty()).toThrow(
				'Unable to find shared message payload property: buttons',
			);
		});
	});

	it('should throw when shared slides property does not expose collection values', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Slides',
						name: 'slides',
						type: 'fixedCollection',
						default: {},
						options: [{ name: 'slide', displayName: 'Slide' }],
					},
				],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');

			expect(() => descriptions.createSingleComponentSlidesProperty('table', 'Table')).toThrow(
				'Shared slides property does not contain slide collection values',
			);
		});
	});

	it('should keep properties without displayOptions untouched while still cloning', async () => {
		await jest.isolateModulesAsync(async () => {
			const source = {
				displayName: 'Buttons',
				name: 'buttons',
				type: 'fixedCollection',
				default: {},
				options: [
					{
						name: 'button',
						displayName: 'Button',
						values: [],
					},
				],
			};
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [source],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');
			const result = descriptions.createButtonsProperty();
			expect(result.displayOptions).toBeUndefined();
			expect(result).not.toBe(source);
		});
	});

	it('should remove displayOptions when only message-specific show keys exist', async () => {
		await jest.isolateModulesAsync(async () => {
			const source = {
				displayName: 'Buttons',
				name: 'buttons',
				type: 'fixedCollection',
				default: {},
				displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
				options: [
					{
						name: 'button',
						displayName: 'Button',
						values: [],
					},
				],
			};
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [source],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');
			const result = descriptions.createButtonsProperty();
			expect(result.displayOptions).toBeUndefined();
		});
	});

	it('should preserve non-message displayOptions keys after stripping', async () => {
		await jest.isolateModulesAsync(async () => {
			const source = {
				displayName: 'Buttons',
				name: 'buttons',
				type: 'fixedCollection',
				default: {},
				displayOptions: {
					show: { messageType: ['rich'], cardInputMode: ['structured'], target: ['channel'] },
				},
				options: [
					{
						name: 'button',
						displayName: 'Button',
						values: [],
					},
				],
			};
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [source],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');
			const result = descriptions.createButtonsProperty();
			expect(result.displayOptions?.show).toEqual({ target: ['channel'] });
		});
	});

	it('should throw when slides property has no options collection', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Slides',
						name: 'slides',
						type: 'fixedCollection',
						default: {},
					},
				],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');

			expect(() => descriptions.createSingleComponentSlidesProperty('table', 'Table')).toThrow(
				'Shared slides property does not contain slide collection values',
			);
		});
	});

	it('should handle slide option entries where values are null', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Slides',
						name: 'slides',
						type: 'fixedCollection',
						default: {},
						options: [{ name: 'slide', displayName: 'Slide', values: null }],
					},
				],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');
			const result = descriptions.createSingleComponentSlidesProperty('table', 'Table');
			expect(result.name).toBe('slides');
			expect(result.displayName).toBe('Table Component');
			expect(Array.isArray(result.options)).toBe(true);
		});
	});

	it('should handle slide option arrays with non-slide entries before slide', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Slides',
						name: 'slides',
						type: 'fixedCollection',
						default: {},
						options: [
							{ name: 'notSlide', displayName: 'Other', values: [] },
							{
								name: 'slide',
								displayName: 'Slide',
								values: [
									{
										displayName: 'Component Type',
										name: 'type',
										type: 'options',
										options: [{ name: 'Text', value: 'text' }],
										default: 'text',
									},
								],
							},
						],
					},
				],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');
			const result = descriptions.createSingleComponentSlidesProperty('table', 'Table');
			expect(result.name).toBe('slides');
		});
	});

	it('should map slide values when the source values array exists', async () => {
		await jest.isolateModulesAsync(async () => {
			jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
				messagePayloadDescription: [
					{
						displayName: 'Slides',
						name: 'slides',
						type: 'fixedCollection',
						default: {},
						options: [
							{
								name: 'slide',
								displayName: 'Slide',
								values: [
									{
										displayName: 'Component Type',
										name: 'type',
										type: 'options',
										options: [{ name: 'Text', value: 'text' }],
										default: 'text',
									},
								],
							},
						],
					},
				],
			}));

			const descriptions =
				await import('../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/descriptions');
			const result = descriptions.createSingleComponentSlidesProperty('table', 'Table');
			const slideOption = (result.options ?? []).find((entry) => entry.name === 'slide') as {
				values?: Array<{ name?: string; default?: unknown }>;
			};
			const typeField = (slideOption.values ?? []).find((entry) => entry.name === 'type');
			expect(typeField?.default).toBe('table');
		});
	});

	it('should directly cover strip helper branch when non-message show keys remain', () => {
		const stripped = descriptionsTestHelpers.stripMessageBuilderIncompatibleDisplayOptions({
			displayName: 'Buttons',
			name: 'buttons',
			type: 'fixedCollection',
			default: {},
			displayOptions: {
				show: {
					messageType: ['rich'],
					cardInputMode: ['structured'],
					target: ['channel'],
				},
			},
		});

		expect(stripped.displayOptions?.show).toEqual({ target: ['channel'] });
	});

	it('should directly cover constrain helper optional and nullish paths', () => {
		expect(() =>
			descriptionsTestHelpers.constrainSlideTypeOptions(
				{
					displayName: 'Slides',
					name: 'slides',
					type: 'fixedCollection',
					default: {},
				},
				'table',
				'Table',
			),
		).toThrow('Shared slides property does not contain slide collection values');

		const constrainedNullValues = descriptionsTestHelpers.constrainSlideTypeOptions(
			{
				displayName: 'Slides',
				name: 'slides',
				type: 'fixedCollection',
				default: {},
				options: [
					{ name: 'notSlide', displayName: 'Other', values: [] },
					{ name: 'slide', displayName: 'Slide', values: null },
				],
			} as unknown as Parameters<typeof descriptionsTestHelpers.constrainSlideTypeOptions>[0],
			'table',
			'Table',
		);
		expect(constrainedNullValues.name).toBe('slides');

		const constrainedWithValues = descriptionsTestHelpers.constrainSlideTypeOptions(
			{
				displayName: 'Slides',
				name: 'slides',
				type: 'fixedCollection',
				default: {},
				options: [
					{
						name: 'slide',
						displayName: 'Slide',
						values: [
							{
								displayName: 'Component Type',
								name: 'type',
								type: 'options',
								options: [{ name: 'Text', value: 'text' }],
								default: 'text',
							},
						],
					},
				],
			},
			'table',
			'Table',
		);
		const slideOption = (constrainedWithValues.options ?? []).find(
			(entry) => entry.name === 'slide',
		) as { values?: Array<{ name?: string; default?: unknown }> };
		const typeField = (slideOption.values ?? []).find((entry) => entry.name === 'type');
		expect(typeField?.default).toBe('table');
	});
});
