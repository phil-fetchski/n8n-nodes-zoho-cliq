import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { resolveMessagePayload } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';
import { createContext } from './testUtils';

describe('ZohoCliq - Shared - messagePayload - rich core and slides', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = createContext({});
	});
	it('should resolve rich payload with text, card, slides, and buttons using raw action data mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				text: '  Rich text  ',
				cardTitle: '  Incident  ',
				cardThumbnail: ' https://example.com/thumb.png ',
				slides: {
					slide: [
						{
							type: 'label',
							title: 'Status',
							labelDataPairs: { pair: [{ key: 'state', value: 'open' }] },
						},
						{
							type: 'images',
							imageUrls: {
								imageUrl: [{ url: 'https://example.com/image.png' }],
							},
						},
					],
				},
				buttons: {
					button: [
						{
							label: 'Open',
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com' },
							hint: 'Open dashboard',
							type: '+',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.text).toBe('Rich text');
		expect(payload.card).toBe(
			JSON.stringify({
				title: 'Incident',
				thumbnail: 'https://example.com/thumb.png',
			}),
		);
		expect(payload.slides).toBe(
			JSON.stringify([
				{ type: 'label', title: 'Status', data: [{ state: 'open' }] },
				{ type: 'images', data: ['https://example.com/image.png'] },
			]),
		);
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'Open',
					action: { type: 'open.url', data: { web: 'https://example.com' } },
					hint: 'Open dashboard',
					type: '+',
				},
			]),
		);
	});

	it('should map n8n icon picker values to lucide URLs for card icon and thumbnail', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardTitle: 'Status',
				cardIconGroup: {
					cardIconInputMode: 'picker',
					cardIconPicker: { type: 'icon', value: 'alarm-clock' },
				},
				cardThumbnailGroup: {
					cardThumbnailInputMode: 'picker',
					cardThumbnailPicker: { type: 'icon', value: 'rocket' },
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.card).toBe(
			JSON.stringify({
				title: 'Status',
				thumbnail: 'https://api.iconify.design/lucide/rocket.svg',
				icon: 'https://api.iconify.design/lucide/alarm-clock.svg',
			}),
		);
	});

	it('should reject emoji picker values for card icon mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardTitle: 'Status',
				cardIconGroup: {
					cardIconInputMode: 'picker',
					cardIconPicker: { type: 'emoji', value: '😀' },
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'card.icon.cardIconPicker must be an icon selection (not emoji)',
		);
	});

	it('should safely ignore non-object icon groups and use fallback icon fields', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardTitle: 'Status',
				cardIconGroup: 'not-an-object',
				cardThumbnailGroup: 123,
				cardIcon: 'https://example.com/icon.png',
				cardThumbnail: 'https://example.com/thumbnail.png',
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.card).toBe(
			JSON.stringify({
				title: 'Status',
				thumbnail: 'https://example.com/thumbnail.png',
				icon: 'https://example.com/icon.png',
			}),
		);
	});

	it('should resolve type-specific structured component buttons', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				text: 'Rich text',
				slides: {
					slide: [
						{
							type: 'label',
							title: 'Status',
							labelDataPairs: { pair: [{ key: 'state', value: 'open' }] },
							labelButtons: {
								button: [
									{
										label: 'View',
										actionType: 'open.url',
										actionDataInputMode: 'raw',
										actionData: { web: 'https://example.com' },
									},
								],
							},
						},
					],
				},
				buttons: {},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.slides).toBe(
			JSON.stringify([
				{
					type: 'label',
					title: 'Status',
					data: [{ state: 'open' }],
					buttons: [
						{
							label: 'View',
							action: { type: 'open.url', data: { web: 'https://example.com' } },
						},
					],
				},
			]),
		);
	});

	it('should resolve rich payload with raw card, slide, and button definitions', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardInputMode: 'raw',
				richPayloadJson: {
					card: { title: 'Raw Card', icon: 'https://example.com/icon.png' },
					slides: [{ type: 'label', title: 'Raw Slide' }],
					buttons: [
						{
							label: 'Raw Button',
							action: { type: 'open.url', data: { web: 'https://example.com' } },
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.card).toBe(
			JSON.stringify({ title: 'Raw Card', icon: 'https://example.com/icon.png' }),
		);
		expect(payload.slides).toBe(JSON.stringify([{ type: 'label', title: 'Raw Slide' }]));
		expect(payload.buttons).toBe(
			JSON.stringify([
				{ label: 'Raw Button', action: { type: 'open.url', data: { web: 'https://example.com' } } },
			]),
		);
	});

	it('should include bot identity in structured rich payload when postAsBot is enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				postAsBot: true,
				botDisplayName: 'GDC Ads Bot',
				botImage: 'https://fetchski.com/assets/GDC_Ads_Bot.png',
				cardTitle: 'Card title',
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.bot).toEqual({
			name: 'GDC Ads Bot',
			image: 'https://fetchski.com/assets/GDC_Ads_Bot.png',
		});
	});

	it('should include bot identity in raw rich payload when postAsBot is enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				postAsBot: true,
				botDisplayName: 'Raw Bot',
				botImage: 'https://example.com/raw-bot.png',
				cardInputMode: 'raw',
				richPayloadJson: {
					text: 'hello',
					card: { title: 'Raw card' },
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.bot).toEqual({
			name: 'Raw Bot',
			image: 'https://example.com/raw-bot.png',
		});
	});

	it('should reject structured rich payload with only bot metadata when content is required', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				postAsBot: true,
				botDisplayName: 'Only Bot',
				botImage: 'https://example.com/only-bot.png',
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Rich Message must include at least one of: text, card, slides, or buttons',
		);
	});

	it('should reject raw rich payload with only bot metadata when content is required', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				postAsBot: true,
				botDisplayName: 'Only Raw Bot',
				cardInputMode: 'raw',
				richPayloadJson: {
					bot: {
						name: 'Existing Bot',
					},
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Rich Message must include at least one of: text, card, slides, or buttons',
		);
	});

	it('should omit bot object when postAsBot is enabled without optional bot identity fields', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				postAsBot: true,
				cardTitle: 'Card title',
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.bot).toBeUndefined();
	});

	it('should support IF-style include expressions via enabled toggles', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				text: 'Base',
				slides: {
					slide: [
						{
							enabled: false,
							type: 'label',
							title: 'Skip Me',
							labelDataPairs: { pair: [{ key: 'x', value: '1' }] },
						},
						{
							enabled: true,
							type: 'label',
							title: 'Use Me',
							labelDataPairs: { pair: [{ key: 'y', value: '2' }] },
						},
					],
				},
				buttons: {
					button: [
						{
							enabled: false,
							label: 'Skip',
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com' },
						},
						{
							enabled: true,
							label: 'Use',
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com' },
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.slides).toBe(
			JSON.stringify([{ type: 'label', title: 'Use Me', data: [{ y: '2' }] }]),
		);
		expect(payload.buttons).toBe(
			JSON.stringify([
				{ label: 'Use', action: { type: 'open.url', data: { web: 'https://example.com' } } },
			]),
		);
	});

	it('should throw when rich payload has no usable content', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Rich Message must include at least one of: text, card, slides, or buttons',
		);
	});

	it('should throw when slide entry is not an object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: ['bad-slide'],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Each slide must be a JSON object',
		);
	});

	it('should throw when label slide has no structured data', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'label' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "label" requires data',
		);
	});

	it('should throw when button label is missing', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com' },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Label is required',
		);
	});

	it('should throw when button action type is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Run',
							actionType: 'bad.action',
							actionDataInputMode: 'raw',
							actionData: {},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Action Type must be one of: invoke.function, open.url, system.api, copy, preview.url',
		);
	});

	it('should throw when button action data is not an object in raw mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Run',
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: 'not-object',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'buttons.button[0].actionData must be valid JSON',
		);
	});

	it('should throw when button type is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Run',
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com' },
							type: 'neutral',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Type must be "+", "-", or empty for neutral',
		);
	});

	it('should throw when structured open.url action is missing URL fields', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Open',
							actionType: 'open.url',
							actionDataInputMode: 'structured',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'requires at least one of: url, web, android, ios',
		);
	});

	it('should throw when card input mode is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardInputMode: 'invalid',
				text: 'Fallback text',
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Card Input Mode must be one of: structured, raw',
		);
	});

	it('should include all optional structured card fields', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardTitle: 'Card',
				cardTheme: 'modern-inline',
				cardIcon: 'https://example.com/icon.png',
				cardThumbnail: 'https://example.com/thumb.png',
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.card as string)).toEqual({
			title: 'Card',
			theme: 'modern-inline',
			icon: 'https://example.com/icon.png',
			thumbnail: 'https://example.com/thumb.png',
		});
	});

	it('should throw when slide include is not boolean', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ enabled: 'yes', type: 'label' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].enabled must resolve to a boolean',
		);
	});

	it('should throw when slide input mode is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ slideInputMode: 'bad', type: 'label' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide Input Mode at index 0 must be one of: structured, raw',
		);
	});

	it('should build structured label data from key value fields', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'label',
							title: 'Environment',
							labelDataPairs: {
								pair: [
									{ key: 'service', value: 'billing' },
									{ key: 'status', value: 'degraded' },
								],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.slides).toBe(
			JSON.stringify([
				{
					type: 'label',
					title: 'Environment',
					data: [{ service: 'billing' }, { status: 'degraded' }],
				},
			]),
		);
	});

	it('should support raw table shorthand payload in raw slide mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							title: 'Raw Table',
							slideInputMode: 'raw',
							rawSlide: {
								headers: ['Header 0', 'Header 1'],
								rows: [
									{ 'Header 0': 'A0', 'Header 1': 'A1' },
									{ 'Header 0': 'B0', 'Header 1': 'B1' },
								],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'table',
				title: 'Raw Table',
				data: {
					headers: ['Header 0', 'Header 1'],
					rows: [
						{ 'Header 0': 'A0', 'Header 1': 'A1' },
						{ 'Header 0': 'B0', 'Header 1': 'B1' },
					],
				},
			},
		]);
	});

	it('should normalize label raw shorthand payload object to array form', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'label',
							title: 'Raw Label',
							slideInputMode: 'raw',
							rawSlide: {
								region: 'us-east-1',
								status: 'ok',
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'label',
				title: 'Raw Label',
				data: [{ region: 'us-east-1' }, { status: 'ok' }],
			},
		]);
	});

	it('should normalize explicit raw label data object to array form', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'label',
								title: 'Explicit Raw Label',
								data: {
									env: 'prod',
								},
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.slides).toBe(
			JSON.stringify([
				{
					type: 'label',
					title: 'Explicit Raw Label',
					data: [{ env: 'prod' }],
				},
			]),
		);
	});

	it('should build structured table data from columns and rows', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							title: 'Deployment Summary',
							tableHeaders: {
								header: [{ name: 'Region' }, { name: 'Version' }],
							},
							tableRows: {
								row: [
									{
										values: {
											entry: [
												{ key: 'Region', value: 'us-east-1' },
												{ key: 'Version', value: 'v1.2.0' },
											],
										},
									},
									{
										values: {
											entry: [
												{ key: 'Region', value: 'eu-west-1' },
												{ key: 'Version', value: 'v1.2.1' },
											],
										},
									},
								],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.slides).toBe(
			JSON.stringify([
				{
					type: 'table',
					title: 'Deployment Summary',
					data: {
						headers: ['Region', 'Version'],
						rows: [
							{ Region: 'us-east-1', Version: 'v1.2.0' },
							{ Region: 'eu-west-1', Version: 'v1.2.1' },
						],
					},
				},
			]),
		);
	});

	it('should build structured list data from list items', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'list',
							title: 'Checklist',
							listItems: {
								item: [{ value: 'Item 1' }, { value: 'Item 2' }],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.slides).toBe(
			JSON.stringify([{ type: 'list', title: 'Checklist', data: ['Item 1', 'Item 2'] }]),
		);
	});

	it('should build structured text slide data when textData is provided', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'text',
							title: 'Summary',
							textData: 'Deployment complete',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'text',
				title: 'Summary',
				data: 'Deployment complete',
			},
		]);
	});

	it('should throw when list item entry is not an object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'list',
							listItems: {
								item: ['bad'],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].listItems.item[0] must be a JSON object',
		);
	});

	it('should throw when list item value is missing', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'list',
							listItems: {
								item: [{ value: '' }],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].listItems.item[0].value is required',
		);
	});

	it('should throw when label key is missing in structured label data', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'label',
							labelDataPairs: {
								pair: [{ key: '', value: 'x' }],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].labelDataPairs.pair[0].key is required',
		);
	});

	it('should throw when table header name is missing', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: {
								header: [{ name: '' }],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableHeaders.header[0].name is required',
		);
	});

	it('should throw when table row values entry key is missing', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableRows: {
								row: [
									{
										values: {
											entry: [{ key: '', value: 'x' }],
										},
									},
								],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableRows.row[0].values.entry[0].key is required',
		);
	});

	it('should throw when structured slide type is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'bad-type' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide type at index 0 must be one of: table, list, images, text, label, percentage_chart, graph',
		);
	});
});
