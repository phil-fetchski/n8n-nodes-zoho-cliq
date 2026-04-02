import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { resolveMessagePayload } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';
import { createContext } from './testUtils';

describe('ZohoCliq - Shared - messagePayload - slides and actions', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = createContext({});
	});
	it('should throw when structured text slide exceeds max length', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'text', textData: 'a'.repeat(1001) }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Text slide at index 0 exceeds 1000 characters',
		);
	});

	it('should apply selected type and title to explicit raw slide shape', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							type: 'list',
							title: 'Raw List',
							rawSlide: { data: ['A', 'B'] },
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'list',
				title: 'Raw List',
				data: ['A', 'B'],
			},
		]);
	});

	it('should apply selected title when using raw shorthand slide payload', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							type: 'list',
							title: 'Shorthand List',
							rawSlide: { items: ['A', 'B'] },
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'list',
				title: 'Shorthand List',
				data: { items: ['A', 'B'] },
			},
		]);
	});

	it('should build raw shorthand slide payload without title when title is not provided', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							type: 'list',
							rawSlide: { items: ['A', 'B'] },
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'list',
				data: { items: ['A', 'B'] },
			},
		]);
	});

	it('should normalize raw label data array and reject invalid array entries', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'label',
								data: [{ a: 1 }],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)[0].data).toEqual([{ a: 1 }]);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'label',
								data: ['bad'],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].rawSlide.data[0] must be an object',
		);
	});

	it('should reject raw label data primitive', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'label',
								data: 'bad',
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].rawSlide.data must be an object or array',
		);
	});

	it('should use per-type component buttons for images/list/table/text', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'images',
							imageUrls: { imageUrl: [{ url: 'https://example.com/a.png' }] },
							imagesButtons: {
								button: [
									{
										label: 'Img',
										actionType: 'open.url',
										actionDataInputMode: 'raw',
										actionData: { web: 'https://example.com' },
									},
								],
							},
						},
						{
							type: 'list',
							listItems: { item: [{ value: 'A' }] },
							listButtons: {
								button: [
									{
										label: 'List',
										actionType: 'open.url',
										actionDataInputMode: 'raw',
										actionData: { web: 'https://example.com' },
									},
								],
							},
						},
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'K' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'K', value: 'V' }] } }] },
							tableButtons: {
								button: [
									{
										label: 'Table',
										actionType: 'open.url',
										actionDataInputMode: 'raw',
										actionData: { web: 'https://example.com' },
									},
								],
							},
						},
						{
							type: 'text',
							textData: 'Hello',
							textButtons: {
								button: [
									{
										label: 'Text',
										actionType: 'open.url',
										actionDataInputMode: 'raw',
										actionData: { web: 'https://example.com' },
									},
								],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		const slides = JSON.parse(payload.slides as string) as Array<Record<string, unknown>>;
		expect(slides.every((slide) => Array.isArray(slide.buttons))).toBe(true);
	});

	it('should throw for malformed image URL entries', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'images',
							imageUrls: { imageUrl: ['bad'] },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].imageUrls.imageUrl[0] must be a JSON object',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'images',
							imageUrls: { imageUrl: [{ url: '' }] },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].imageUrls.imageUrl[0].url is required',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'images',
							imageUrls: { imageUrl: [{ url: 'http://example.com/image.png' }] },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].imageUrls.imageUrl[0].url must start with "https://"',
		);
	});

	it('should enforce HTTPS image URLs in raw images slides', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'images',
								data: ['http://example.com/image.png'],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].data[0] must start with "https://"',
		);
	});

	it('should require raw images slide data to be an array', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'images',
								data: { url: 'https://example.com/image.png' },
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].data must be an array of image URLs',
		);
	});

	it('should allow valid HTTPS image URLs in raw images slides', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							rawSlide: {
								type: 'images',
								data: ['https://example.com/image.png'],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'images',
				data: ['https://example.com/image.png'],
			},
		]);
	});

	it('should throw for malformed table header and row entry objects', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'table', tableHeaders: { header: ['bad'] } }],
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableHeaders.header[0] must be a JSON object',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'table', tableRows: { row: ['bad'] } }],
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableRows.row[0] must be a JSON object',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableRows: {
								row: [{ values: { entry: ['bad'] } }],
							},
						},
					],
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableRows.row[0].values.entry[0] must be a JSON object',
		);
	});

	it('should include table styles when style options are enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'Name' }, { name: 'Value' }] },
							tableRows: {
								row: [
									{
										values: {
											entry: [
												{ key: 'Name', value: 'State' },
												{ key: 'Value', value: 'Healthy' },
											],
										},
									},
								],
							},
							tableAdjustStyles: true,
							tableStyleWidths: '30, 70',
							tableStickyRows: 1,
							tableStickyColumns: 1,
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'table',
				data: {
					headers: ['Name', 'Value'],
					rows: [{ Name: 'State', Value: 'Healthy' }],
					styles: {
						width: [30, 70],
						sticky: { rows: 1, columns: 1 },
					},
				},
			},
		]);
	});

	it('should throw when table style widths CSV contains non-whole-number values', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'Name' }, { name: 'Value' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'Name', value: 'State' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: '30, bad',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableStyleWidths must be a comma-separated list of whole numbers',
		);
	});

	it('should throw when table style width count does not match header count', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'Name' }, { name: 'Value' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'Name', value: 'State' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: { width: [{ value: 100 }] },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableStyleWidths width count must match table column count',
		);
	});

	it('should throw when table style widths do not add to 100', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'Name' }, { name: 'Value' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'Name', value: 'State' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: { width: [{ value: 50 }, { value: 30 }] },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].tableStyleWidths values must add up to 100',
		);
	});

	it('should include list styles when style selection is enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'list',
							listItems: { item: [{ value: 'One' }, { value: 'Two' }] },
							listChangeItemStyle: true,
							listStyleType: 'circle',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'list',
				data: ['One', 'Two'],
				styles: { type: 'circle' },
			},
		]);
	});

	it('should throw when list style type is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'list',
							listItems: { item: [{ value: 'One' }] },
							listChangeItemStyle: true,
							listStyleType: 'invalid',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].listStyleType must be one of: circle, decimal, disc, lower-alpha, upper-alpha, square, lower-roman, upper-roman',
		);
	});

	it('should resolve percentage chart slide with styles and buttons', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'percentage_chart',
							title: 'Spend Mix',
							chartPreview: 'doughnut',
							chartDataPoints: {
								point: [
									{ label: 'Social', value: 40 },
									{ label: 'SEO', value: 15 },
									{ label: 'Print', value: 45 },
								],
							},
							chartButtons: {
								button: [
									{
										label: 'Open',
										actionType: 'open.url',
										actionDataInputMode: 'raw',
										actionData: { web: 'https://example.com' },
									},
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
				type: 'percentage_chart',
				title: 'Spend Mix',
				styles: { preview: 'doughnut' },
				data: [
					{ label: 'Social', value: 40 },
					{ label: 'SEO', value: 15 },
					{ label: 'Print', value: 45 },
				],
				buttons: [
					{
						label: 'Open',
						action: { type: 'open.url', data: { web: 'https://example.com' } },
					},
				],
			},
		]);
	});

	it('should reject percentage chart values that do not total 100', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'percentage_chart',
							chartDataPoints: {
								point: [
									{ label: 'Social', value: 40 },
									{ label: 'SEO', value: 15 },
									{ label: 'Print', value: 35 },
								],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].chartDataPoints values must add up to 100',
		);
	});

	it('should resolve graph slide with styles and nested values', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphPreview: 'trend',
							graphXAxisTitle: 'Month',
							graphYAxisTitle: 'Usage',
							graphCategories: {
								category: [
									{
										category: 'Asana',
										values: {
											value: [
												{ label: 'Jan', value: 9 },
												{ label: 'Feb', value: 6 },
												{ label: 'Mar', value: 3 },
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
		expect(JSON.parse(payload.slides as string)).toEqual([
			{
				type: 'graph',
				styles: {
					preview: 'trend',
					x_axis: { title: 'Month' },
					y_axis: { title: 'Usage' },
				},
				data: [
					{
						category: 'Asana',
						values: [
							{ label: 'Jan', value: 9 },
							{ label: 'Feb', value: 6 },
							{ label: 'Mar', value: 3 },
						],
					},
				],
			},
		]);
	});

	it('should resolve graph styles when only y-axis title is provided', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphYAxisTitle: 'Usage',
							graphCategories: {
								category: [
									{
										category: 'Asana',
										values: { value: [{ label: 'Jan', value: 9 }] },
									},
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
				type: 'graph',
				styles: { y_axis: { title: 'Usage' } },
				data: [{ category: 'Asana', values: [{ label: 'Jan', value: 9 }] }],
			},
		]);
	});

	it('should resolve graph styles when only preview is provided', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphPreview: 'vertical_bar',
							graphCategories: {
								category: [
									{
										category: 'Asana',
										values: { value: [{ label: 'Jan', value: 9 }] },
									},
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
				type: 'graph',
				styles: { preview: 'vertical_bar' },
				data: [{ category: 'Asana', values: [{ label: 'Jan', value: 9 }] }],
			},
		]);
	});

	it('should reject graph category values over supported max size', () => {
		const maxExceededValues = Array.from({ length: 21 }, (_, index) => ({
			label: `L${index}`,
			value: index + 1,
		}));

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: {
								category: [
									{
										category: 'Asana',
										values: { value: maxExceededValues },
									},
								],
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].graphCategories.category[0].values supports a maximum of 20 items',
		);
	});

	it('should resolve graph slide buttons with no graph styles provided', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: {
								category: [
									{
										category: 'Asana',
										values: { value: [{ label: 'Jan', value: 9 }] },
									},
								],
							},
							graphButtons: {
								button: [
									{
										label: 'Open',
										actionType: 'open.url',
										actionDataInputMode: 'raw',
										actionData: { web: 'https://example.com' },
									},
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
				type: 'graph',
				data: [{ category: 'Asana', values: [{ label: 'Jan', value: 9 }] }],
				buttons: [
					{ label: 'Open', action: { type: 'open.url', data: { web: 'https://example.com' } } },
				],
			},
		]);
	});

	it.each([
		{
			input: { slides: { slide: [{ type: 'percentage_chart', chartDataPoints: 'bad' }] } },
			expectedMessage: 'Slide at index 0 with type "percentage_chart" requires data',
		},
		{
			input: {
				slides: { slide: [{ type: 'percentage_chart', chartDataPoints: { point: 'bad' } }] },
			},
			expectedMessage: 'Slide at index 0 with type "percentage_chart" requires data',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'percentage_chart',
							chartDataPoints: {
								point: Array.from({ length: 6 }, (_, i) => ({ label: `L${i}`, value: 1 })),
							},
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].chartDataPoints supports a maximum of 5 items',
		},
		{
			input: {
				slides: { slide: [{ type: 'percentage_chart', chartDataPoints: { point: ['bad'] } }] },
			},
			expectedMessage: 'slides.slide[0].chartDataPoints.point[0] must be a JSON object',
		},
		{
			input: {
				slides: {
					slide: [
						{ type: 'percentage_chart', chartDataPoints: { point: [{ label: '', value: 100 }] } },
					],
				},
			},
			expectedMessage: 'slides.slide[0].chartDataPoints.point[0].label is required',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'percentage_chart',
							chartDataPoints: { point: [{ label: 'a'.repeat(21), value: 100 }] },
						},
					],
				},
			},
			expectedMessage:
				'slides.slide[0].chartDataPoints.point[0].label must be at most 20 characters',
		},
		{
			input: {
				slides: {
					slide: [
						{ type: 'percentage_chart', chartDataPoints: { point: [{ label: 'A', value: 'x' }] } },
					],
				},
			},
			expectedMessage: 'slides.slide[0].chartDataPoints.point[0].value must be a number',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'percentage_chart',
							chartPreview: 'invalid',
							chartDataPoints: {
								point: [
									{ label: 'A', value: 50 },
									{ label: 'B', value: 50 },
								],
							},
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].chartPreview must be one of: pie, doughnut, semi_doughnut',
		},
	])('should validate chart branch edge case: $expectedMessage', ({ input, expectedMessage }) => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: input,
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(expectedMessage);
	});

	it.each([
		{
			input: { slides: { slide: [{ type: 'graph', graphCategories: 'bad' }] } },
			expectedMessage: 'Slide at index 0 with type "graph" requires data',
		},
		{
			input: { slides: { slide: [{ type: 'graph', graphCategories: { category: 'bad' } }] } },
			expectedMessage: 'Slide at index 0 with type "graph" requires data',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: {
								category: Array.from({ length: 6 }, (_, i) => ({
									category: `C${i}`,
									values: { value: [{ label: 'L', value: 1 }] },
								})),
							},
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].graphCategories supports a maximum of 5 items',
		},
		{
			input: { slides: { slide: [{ type: 'graph', graphCategories: { category: ['bad'] } }] } },
			expectedMessage: 'slides.slide[0].graphCategories.category[0] must be a JSON object',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: {
								category: [{ category: '', values: { value: [{ label: 'A', value: 1 }] } }],
							},
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].graphCategories.category[0].category is required',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: {
								category: [
									{ category: 'a'.repeat(21), values: { value: [{ label: 'A', value: 1 }] } },
								],
							},
						},
					],
				},
			},
			expectedMessage:
				'slides.slide[0].graphCategories.category[0].category must be at most 20 characters',
		},
		{
			input: {
				slides: {
					slide: [
						{ type: 'graph', graphCategories: { category: [{ category: 'A', values: 'bad' }] } },
					],
				},
			},
			expectedMessage:
				'slides.slide[0].graphCategories.category[0] requires at least one value point',
		},
		{
			input: {
				slides: {
					slide: [
						{ type: 'graph', graphCategories: { category: [{ category: 'A', values: {} }] } },
					],
				},
			},
			expectedMessage:
				'slides.slide[0].graphCategories.category[0] requires at least one value point',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphPreview: 'bad',
							graphCategories: {
								category: [{ category: 'A', values: { value: [{ label: 'L', value: 1 }] } }],
							},
						},
					],
				},
			},
			expectedMessage:
				'slides.slide[0].graphPreview must be one of: vertical_bar, vertical_stacked_bar, trend',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphXAxisTitle: 'x'.repeat(21),
							graphCategories: {
								category: [{ category: 'A', values: { value: [{ label: 'L', value: 1 }] } }],
							},
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].graphXAxisTitle must be at most 20 characters',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphYAxisTitle: 'y'.repeat(21),
							graphCategories: {
								category: [{ category: 'A', values: { value: [{ label: 'L', value: 1 }] } }],
							},
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].graphYAxisTitle must be at most 20 characters',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: { category: [{ category: 'A', values: { value: ['bad'] } }] },
						},
					],
				},
			},
			expectedMessage:
				'slides.slide[0].graphCategories.category[0].values.value[0] must be a JSON object',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: {
								category: [{ category: 'A', values: { value: [{ label: '', value: 1 }] } }],
							},
						},
					],
				},
			},
			expectedMessage:
				'slides.slide[0].graphCategories.category[0].values.value[0].label is required',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'graph',
							graphCategories: {
								category: [
									{ category: 'A', values: { value: [{ label: 'a'.repeat(21), value: 1 }] } },
								],
							},
						},
					],
				},
			},
			expectedMessage:
				'slides.slide[0].graphCategories.category[0].values.value[0].label must be at most 20 characters',
		},
	])('should validate graph branch edge case: $expectedMessage', ({ input, expectedMessage }) => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: input,
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(expectedMessage);
	});

	it.each([
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: '   ',
							tableStickyRows: 0,
							tableStickyColumns: 0,
						},
					],
				},
			},
			expectedStyles: undefined,
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: '',
							tableStickyRows: 1,
							tableStickyColumns: 0,
						},
					],
				},
			},
			expectedStyles: { sticky: { rows: 1 } },
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: '',
							tableStickyRows: 0,
							tableStickyColumns: 1,
						},
					],
				},
			},
			expectedStyles: { sticky: { columns: 1 } },
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: 123,
							tableStickyRows: 0,
							tableStickyColumns: 0,
						},
					],
				},
			},
			expectedStyles: undefined,
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: {},
							tableStickyRows: 0,
							tableStickyColumns: 0,
						},
					],
				},
			},
			expectedStyles: undefined,
		},
	])('should resolve table style width edge case', ({ input, expectedStyles }) => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: input,
		});
		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(JSON.parse(payload.slides as string)[0].data.styles).toEqual(expectedStyles);
	});

	it.each([
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: { width: ['bad'] },
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].tableStyleWidths.width[0] must be a JSON object',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: { width: [{ value: 0 }] },
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].tableStyleWidths.width[0].value must be between 1 and 100',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: { width: [{ value: 100 }] },
							tableStickyRows: 1.5,
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].tableStickyRows must be a whole number',
		},
		{
			input: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: [{ name: 'A' }] },
							tableRows: { row: [{ values: { entry: [{ key: 'A', value: '1' }] } }] },
							tableAdjustStyles: true,
							tableStyleWidths: { width: [{ value: 100 }] },
							tableStickyRows: 0,
							tableStickyColumns: 3,
						},
					],
				},
			},
			expectedMessage: 'slides.slide[0].tableStickyColumns must be between 0 and 2',
		},
	])(
		'should throw for table style width edge case: $expectedMessage',
		({ input, expectedMessage }) => {
			mockExecuteFunctions = createContext({
				messageType: 'rich',
				richMessage: input,
			});
			expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(expectedMessage);
		},
	);

	it('should throw when structured slide is empty', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ slideInputMode: 'structured' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 is empty. Add type/title/data or disable Include.',
		);
	});

	it('should require data when structured text slide text is empty', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'text', textData: '   ' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "text" requires data',
		);
	});

	it('should throw when button entry is not an object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: ['bad-button'],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Each button must be a JSON object',
		);
	});

	it('should throw when button input mode is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [{ label: 'X', actionType: 'open.url', buttonInputMode: 'bad' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Input Mode at index 0 must be one of: structured, raw',
		);
	});

	it('should throw when action data input mode is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'X',
							actionType: 'open.url',
							actionDataInputMode: 'bad',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Action Data Input Mode at button index 0 must be one of: structured, raw',
		);
	});

	it('should validate invoke.function action data requires name', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Run',
							actionType: 'invoke.function',
							actionDataInputMode: 'structured',
							invokeFunctionId: 'fn_999',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'requires action data field "name"',
		);
	});

	it('should resolve structured invoke.function action data', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Run',
							actionType: 'invoke.function',
							actionDataInputMode: 'structured',
							invokeFunctionName: 'runWorkflow',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'Run',
					action: {
						type: 'invoke.function',
						data: { name: 'runWorkflow' },
					},
				},
			]),
		);
	});

	it('should resolve structured invoke.function action data without optional id', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Run',
							actionType: 'invoke.function',
							actionDataInputMode: 'structured',
							invokeFunctionName: 'runWorkflow',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'Run',
					action: {
						type: 'invoke.function',
						data: { name: 'runWorkflow' },
					},
				},
			]),
		);
	});

	it('should resolve structured system.api and preview.url action data', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'System',
							actionType: 'system.api',
							actionDataInputMode: 'structured',
							systemApiAction: 'startchat',
							systemApiUserId: '123456789',
						},
						{
							label: 'Preview',
							actionType: 'preview.url',
							actionDataInputMode: 'raw',
							actionData: { url: 'https://example.com/preview' },
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'System',
					action: { type: 'system.api', data: { api: 'startchat/123456789' } },
				},
				{
					label: 'Preview',
					action: {
						type: 'preview.url',
						data: { url: 'https://example.com/preview' },
					},
				},
			]),
		);
	});

	it('should allow structured system.api locationpermission and copy raw action', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'System Minimal',
							actionType: 'system.api',
							actionDataInputMode: 'structured',
							systemApiAction: 'locationpermission',
						},
						{
							label: 'Copy Minimal',
							actionType: 'copy',
							actionDataInputMode: 'raw',
							actionData: { value: 'Copy this' },
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'System Minimal',
					action: { type: 'system.api', data: { api: 'locationpermission' } },
				},
				{
					label: 'Copy Minimal',
					action: { type: 'copy', data: { value: 'Copy this' } },
				},
			]),
		);
	});

	it('should resolve structured copy and preview.url action data', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Copy Structured',
							actionType: 'copy',
							actionDataInputMode: 'structured',
							copyText: 'Copy me',
						},
						{
							label: 'Preview Structured',
							actionType: 'preview.url',
							actionDataInputMode: 'structured',
							previewUrl: 'https://example.com/preview',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'Copy Structured',
					action: { type: 'copy', data: { text: 'Copy me' } },
				},
				{
					label: 'Preview Structured',
					action: { type: 'preview.url', data: { url: 'https://example.com/preview' } },
				},
			]),
		);
	});

	it('should validate structured system.api when api mapping is missing', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'System Missing Name',
							actionType: 'system.api',
							actionDataInputMode: 'structured',
							systemApiAction: 'startchat',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button at index 0 with action type system.api requires action data field "api"',
		);
	});

	it('should reject removed open.dialog action type in structured mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Dialog Missing Name',
							actionType: 'open.dialog',
							actionDataInputMode: 'structured',
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Action Type must be one of: invoke.function, open.url, system.api, copy, preview.url',
		);
	});

	it('should reject removed open.dialog action type in raw action mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Dialog No Title',
							actionType: 'open.dialog',
							actionDataInputMode: 'raw',
							actionData: { name: 'approval_dialog' },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Action Type must be one of: invoke.function, open.url, system.api, copy, preview.url',
		);
	});

	it('should validate raw button shape requirements', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: { action: { type: 'open.url', data: { web: 'https://example.com' } } },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Raw button at index 0 is missing required field "label"',
		);
	});

	it('should throw when raw card JSON is not an object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardInputMode: 'raw',
				richPayloadJson: [],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'richPayloadJson must be a JSON object',
		);
	});

	it('should throw when raw card JSON is empty', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardInputMode: 'raw',
				richPayloadJson: {},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'richPayloadJson cannot be an empty object',
		);
	});

	it('should throw when raw slide JSON value is invalid type', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ slideInputMode: 'raw', rawSlide: true }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].rawSlide must be a JSON object, JSON array, or JSON string',
		);
	});

	it('should ignore slides when slide collection is not an array', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				text: 'Only text',
				slides: { slide: { bad: true } },
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload).toEqual({ text: 'Only text' });
	});

	it('should ignore buttons when button collection is not an array', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				text: 'Only text',
				buttons: { button: { bad: true } },
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload).toEqual({ text: 'Only text' });
	});

	it('should build structured open.url action data including web/android/ios', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Open',
							actionType: 'open.url',
							actionDataInputMode: 'structured',
							openUrlWeb: 'https://example.com/web',
							openUrlAndroid: 'app://android',
							openUrlIos: 'app://ios',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'Open',
					action: {
						type: 'open.url',
						data: {
							web: 'https://example.com/web',
							android: 'app://android',
							ios: 'app://ios',
						},
					},
				},
			]),
		);
	});

	it('should validate system.api action data requires api', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'System',
							actionType: 'system.api',
							actionDataInputMode: 'raw',
							actionData: { payload: { x: 1 } },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button at index 0 with action type system.api requires action data field "api"',
		);
	});

	it('should validate copy action data requires text or value', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Copy',
							actionType: 'copy',
							actionDataInputMode: 'raw',
							actionData: { payload: { x: 1 } },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button at index 0 with action type copy requires action data field "text" or "value"',
		);
	});

	it('should validate preview.url action data requires valid absolute HTTPS URL', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Preview',
							actionType: 'preview.url',
							actionDataInputMode: 'raw',
							actionData: { url: 'not-a-url' },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button at index 0 with action type preview.url requires a valid absolute HTTPS URL in action data field "url"',
		);
	});

	it.each([
		{
			name: 'images slide with object imageUrls',
			slide: { type: 'images', imageUrls: {} },
			error: 'Slide at index 0 with type "images" requires data',
		},
		{
			name: 'list slide with string listItems',
			slide: { type: 'list', listItems: 'bad-list-items' },
			error: 'Slide at index 0 with type "list" requires data',
		},
		{
			name: 'list slide with object listItems',
			slide: { type: 'list', listItems: {} },
			error: 'Slide at index 0 with type "list" requires data',
		},
		{
			name: 'label slide with object labelDataPairs',
			slide: { type: 'label', labelDataPairs: {} },
			error: 'Slide at index 0 with type "label" requires data',
		},
	])('should fail invalid slide shape: $name', ({ slide, error }) => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [slide],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(error);
	});

	it('should keep table slide when only headers exist and ignore non-array key-value entries', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							title: 'Headers Only',
							tableHeaders: { header: [{ name: 'Region' }] },
						},
						{
							type: 'table',
							title: 'Rows With Empty Values',
							tableHeaders: { header: [{ name: 'Key' }] },
							tableRows: {
								row: [{ values: {} }],
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
				title: 'Headers Only',
				data: { headers: ['Region'] },
			},
			{
				type: 'table',
				title: 'Rows With Empty Values',
				data: { headers: ['Key'] },
			},
		]);
	});
});
