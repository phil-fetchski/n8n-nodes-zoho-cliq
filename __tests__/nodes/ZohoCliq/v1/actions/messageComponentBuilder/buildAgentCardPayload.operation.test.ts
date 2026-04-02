import type { IDataObject } from 'n8n-workflow';

import * as buildAgentCardPayload from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildAgentCardPayload.operation';
import { createTestExecutionContext } from './testExecutionContext';

describe('Message Component Builder - Agent Card Payload Builder Operation', () => {
	const items = [{ json: {} }];
	const invalidSlidesJsonCases: Array<{
		name: string;
		slidesJson: unknown;
		expectedMessage: string;
	}> = [
		{
			name: 'reject percentage_chart slides when values do not sum to 100',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [
						{ label: 'A', value: 40 },
						{ label: 'B', value: 30 },
						{ label: 'C', value: 20 },
					],
				},
			],
			expectedMessage: 'Slides JSON[0].data values must add up to 100. Received 90',
		},
		{
			name: 'reject percentage_chart slides when styles is not an object',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [
						{ label: 'A', value: 50 },
						{ label: 'B', value: 50 },
					],
					styles: 'pie',
				},
			],
			expectedMessage: 'Slides JSON[0].styles must be a JSON object',
		},
		{
			name: 'reject percentage_chart slides with negative values',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [
						{ label: 'A', value: -20 },
						{ label: 'B', value: 120 },
					],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].value must be greater than or equal to 0',
		},
		{
			name: 'reject percentage_chart slides when data is not an array',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: 'bad-data',
				},
			],
			expectedMessage: 'Slides JSON[0].data must be an array of percentage chart data points',
		},
		{
			name: 'reject percentage_chart slides with non-numeric values',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [
						{ label: 'A', value: 'fifty' },
						{ label: 'B', value: 'fifty' },
					],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].value is required and must be a number',
		},
		{
			name: 'reject empty percentage_chart data arrays',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [],
					styles: { preview: 'pie' },
				},
			],
			expectedMessage: 'Slides JSON[0].data must contain at least 1 percentage chart data point',
		},
		{
			name: 'reject percentage_chart slides with non-object data items',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: ['bad-entry'],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0] must be a JSON object',
		},
		{
			name: 'reject percentage_chart data items missing labels',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [{ value: 60 }, { value: 40 }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].label is required and must be a non-empty string',
		},
		{
			name: 'reject percentage_chart data items missing values',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [{ label: 'A' }, { label: 'B' }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].value is required and must be a number',
		},
		{
			name: 'reject invalid percentage_chart preview styles',
			slidesJson: [
				{
					type: 'percentage_chart',
					data: [
						{ label: 'A', value: 50 },
						{ label: 'B', value: 50 },
					],
					styles: { preview: 'bar_chart' },
				},
			],
			expectedMessage: 'Slides JSON[0].styles.preview must be one of: pie, doughnut, semi_doughnut',
		},
		{
			name: 'reject graph slides when styles is not an object',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana', values: [{ label: 'Jan', value: 10 }] }],
					styles: 'trend',
				},
			],
			expectedMessage: 'Slides JSON[0].styles must be a JSON object',
		},
		{
			name: 'reject empty graph data arrays',
			slidesJson: [
				{
					type: 'graph',
					title: 'Empty',
					data: [],
					styles: { preview: 'trend' },
				},
			],
			expectedMessage: 'Slides JSON[0].data must contain at least 1 graph category',
		},
		{
			name: 'reject graph slides when data is not an array',
			slidesJson: [
				{
					type: 'graph',
					data: 'bad-data',
				},
			],
			expectedMessage: 'Slides JSON[0].data must be an array of graph category objects',
		},
		{
			name: 'reject graph slides with non-object category entries',
			slidesJson: [
				{
					type: 'graph',
					data: ['bad-entry'],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0] must be a JSON object',
		},
		{
			name: 'reject graph slides with non-numeric category values',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana', values: [{ label: 'Jan', value: 'high' }] }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].values[0].value is required and must be a number',
		},
		{
			name: 'reject graph slides with empty category value arrays',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana', values: [] }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].values must contain at least 1 data point',
		},
		{
			name: 'reject graph slides missing category keys',
			slidesJson: [
				{
					type: 'graph',
					data: [{ values: [{ label: 'Jan', value: 10 }] }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].category is required and must be a non-empty string',
		},
		{
			name: 'reject graph slides missing category values arrays',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana' }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].values must be an array of graph value objects',
		},
		{
			name: 'reject invalid graph preview styles',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana', values: [{ label: 'Jan', value: 10 }] }],
					styles: { preview: 'horizontal_bar' },
				},
			],
			expectedMessage:
				'Slides JSON[0].styles.preview must be one of: vertical_bar, vertical_stacked_bar, trend',
		},
		{
			name: 'reject graph slides with overly long category keys',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'a'.repeat(21), values: [{ label: 'Jan', value: 10 }] }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].category must be at most 20 characters',
		},
		{
			name: 'reject graph slides with non-object values entries',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana', values: ['bad-value'] }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].values[0] must be a JSON object',
		},
		{
			name: 'reject graph slides missing value labels',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana', values: [{ value: 10 }] }],
				},
			],
			expectedMessage:
				'Slides JSON[0].data[0].values[0].label is required and must be a non-empty string',
		},
		{
			name: 'reject graph slides with overly long value labels',
			slidesJson: [
				{
					type: 'graph',
					data: [{ category: 'Asana', values: [{ label: 'a'.repeat(21), value: 10 }] }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].values[0].label must be at most 20 characters',
		},
		{
			name: 'reject table slides when rows is not an array',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: 'bad-rows',
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.rows must be an array',
		},
		{
			name: 'reject table slides when a row is not an object',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: ['bad-row'],
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.rows[0] must be a JSON object',
		},
		{
			name: 'reject table slides when a row is missing a header key',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B', 'C'],
						rows: [{ A: '1', B: '2' }],
					},
				},
			],
			expectedMessage:
				'Slides JSON[0].data.rows[0] must include values for every header. Missing keys: C',
		},
		{
			name: 'reject table slides when a row contains unknown keys',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2', C: '3' }],
					},
				},
			],
			expectedMessage:
				'Slides JSON[0].data.rows[0] contains unknown key "C". Row keys must match the headers array',
		},
		{
			name: 'reject table slides missing headers',
			slidesJson: [
				{
					type: 'table',
					data: {
						rows: [{ A: '1', B: '2' }],
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.headers must be an array',
		},
		{
			name: 'reject table slides with empty headers',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: [],
						rows: [{ A: '1', B: '2' }],
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.headers must contain at least 1 column name',
		},
		{
			name: 'reject table slides with duplicate headers',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'A'],
						rows: [{ A: '1' }],
					},
				},
			],
			expectedMessage:
				'Slides JSON[0].data.headers contains duplicate header "A". Header names must be unique',
		},
		{
			name: 'reject table slides when data.styles is not an object',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: 'bad-styles',
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.styles must be a JSON object',
		},
		{
			name: 'reject table slides when data.styles.width is not an array',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: { width: 'bad-width' },
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.styles.width must be an array of numbers',
		},
		{
			name: 'reject table slides when data.styles.width count does not match headers',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: { width: [100] },
					},
				},
			],
			expectedMessage:
				'Slides JSON[0].data.styles.width must contain exactly 2 entries to match the headers array',
		},
		{
			name: 'reject table slides when data.styles.width does not add up to 100',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: { width: [20, 30] },
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.styles.width values must add up to 100. Received 50',
		},
		{
			name: 'reject table slides when data.styles.width contains non-positive values',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: { width: [0, 100] },
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.styles.width[0] must be a positive number',
		},
		{
			name: 'reject table slides when data.styles.sticky is not an object',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: { sticky: 'bad-sticky' },
					},
				},
			],
			expectedMessage: 'Slides JSON[0].data.styles.sticky must be a JSON object',
		},
		{
			name: 'reject table slides when data.styles.sticky.rows is out of bounds',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: { sticky: { rows: 3 } },
					},
				},
			],
			expectedMessage:
				'Slides JSON[0].data.styles.sticky.rows must be a whole number between 0 and 2',
		},
		{
			name: 'reject table slides when data.styles.sticky.columns is out of bounds',
			slidesJson: [
				{
					type: 'table',
					data: {
						headers: ['A', 'B'],
						rows: [{ A: '1', B: '2' }],
						styles: { sticky: { columns: 3 } },
					},
				},
			],
			expectedMessage:
				'Slides JSON[0].data.styles.sticky.columns must be a whole number between 0 and 2',
		},
		{
			name: 'reject table slides when data is the wrong type',
			slidesJson: [
				{
					type: 'table',
					data: 'just a string',
				},
			],
			expectedMessage: 'Slides JSON[0].data must be an object with headers and rows',
		},
		{
			name: 'reject list slides when data is not an array',
			slidesJson: [
				{
					type: 'list',
					data: 'bad-data',
				},
			],
			expectedMessage: 'Slides JSON[0].data must be an array of strings for list slides',
		},
		{
			name: 'reject empty list data arrays',
			slidesJson: [
				{
					type: 'list',
					data: [],
				},
			],
			expectedMessage: 'Slides JSON[0].data must contain at least 1 list item',
		},
		{
			name: 'reject list slides with non-string items',
			slidesJson: [
				{
					type: 'list',
					data: [{ step: 'one' }, { step: 'two' }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0] is required and must be a non-empty string',
		},
		{
			name: 'reject label slides when data is not an array',
			slidesJson: [
				{
					type: 'label',
					data: 'bad-data',
				},
			],
			expectedMessage: 'Slides JSON[0].data must be an array of label objects',
		},
		{
			name: 'reject empty label data arrays',
			slidesJson: [
				{
					type: 'label',
					data: [],
				},
			],
			expectedMessage: 'Slides JSON[0].data must contain at least 1 label entry',
		},
		{
			name: 'reject label slides with non-object data items',
			slidesJson: [
				{
					type: 'label',
					data: ['bad-entry'],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0] must be a JSON object',
		},
		{
			name: 'reject label slides missing keys',
			slidesJson: [
				{
					type: 'label',
					data: [{ value: 'Open' }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].key is required and must be a non-empty string',
		},
		{
			name: 'reject label slides missing values',
			slidesJson: [
				{
					type: 'label',
					data: [{ key: 'Status' }],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0].value is required and must be a non-empty string',
		},
		{
			name: 'reject images slides when data is not an array',
			slidesJson: [
				{
					type: 'images',
					data: 'bad-data',
				},
			],
			expectedMessage: 'Slides JSON[0].data must be an array of image URLs',
		},
		{
			name: 'reject empty images data arrays',
			slidesJson: [
				{
					type: 'images',
					data: [],
				},
			],
			expectedMessage: 'Slides JSON[0].data must contain at least 1 image URL',
		},
		{
			name: 'reject image slide URLs that are not valid absolute HTTPS URLs',
			slidesJson: [
				{
					type: 'images',
					data: ['https://', 'https:// '],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0] must be a valid absolute HTTPS URL',
		},
		{
			name: 'reject image slide URLs when an entry is blank after trimming',
			slidesJson: [
				{
					type: 'images',
					data: ['   '],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0] must be a valid absolute HTTPS URL',
		},
		{
			name: 'reject image slide URLs when the protocol is not HTTPS',
			slidesJson: [
				{
					type: 'images',
					data: ['http://example.com/image.png'],
				},
			],
			expectedMessage: 'Slides JSON[0].data[0] must be a valid absolute HTTPS URL',
		},
		{
			name: 'reject text slides when data is a number',
			slidesJson: [
				{
					type: 'text',
					data: 12345,
				},
			],
			expectedMessage: 'Slides JSON[0].data must be a non-empty string for text slides',
		},
		{
			name: 'reject text slides when data is a boolean',
			slidesJson: [
				{
					type: 'text',
					data: true,
				},
			],
			expectedMessage: 'Slides JSON[0].data must be a non-empty string for text slides',
		},
		{
			name: 'reject text slides when data is an array',
			slidesJson: [
				{
					type: 'text',
					data: ['one', 'two'],
				},
			],
			expectedMessage: 'Slides JSON[0].data must be a non-empty string for text slides',
		},
		{
			name: 'reject slides with non-string titles',
			slidesJson: [
				{
					type: 'text',
					title: 999,
					data: 'Valid text.',
				},
			],
			expectedMessage: 'Slides JSON[0].title must be a string',
		},
	];

	it('should build a minimal validated payload object with only required text', async () => {
		const context = createTestExecutionContext({
			params: {
				text: '  Daily status update  ',
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			text: 'Daily status update',
		});
	});

	it('should build card, slides, and buttons into one validated payload object', async () => {
		const context = createTestExecutionContext({
			params: {
				theme: 'modern-inline',
				title: 'System Status',
				text: 'All systems operational',
				iconUrl: 'https://example.com/icon.svg',
				thumbnailUrl: 'https://example.com/thumb.png',
				slidesJson: [
					{
						type: 'text',
						title: 'Summary',
						data: 'Everything is healthy.',
					},
				],
				buttonsJson: [
					{
						label: 'Open Dashboard',
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com/dashboard',
							},
						},
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			text: 'All systems operational',
			card: {
				title: 'System Status',
				theme: 'modern-inline',
				icon: 'https://example.com/icon.svg',
				thumbnail: 'https://example.com/thumb.png',
			},
			slides: [
				{
					type: 'text',
					title: 'Summary',
					data: 'Everything is healthy.',
				},
			],
		});
		expect((result[0].json as Record<string, unknown>).buttons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					label: 'Open Dashboard',
					key: expect.any(String),
				}),
			]),
		);
		expect((result[0].json as Record<string, unknown>).messagePayload).toBeUndefined();
		expect((result[0].json as Record<string, unknown>).cardPayload).toBeUndefined();
	});

	it('should keep valid advanced slide types with preview styles in the final payload', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Advanced payload',
				slidesJson: [
					{
						type: 'percentage_chart',
						title: 'Traffic Split',
						data: [
							{ label: 'API', value: 65 },
							{ label: 'Worker', value: 35 },
						],
						styles: { preview: 'doughnut' },
					},
					{
						type: 'graph',
						title: 'Weekly Volume',
						data: [
							{
								category: 'Asana',
								values: [
									{ label: 'Jan', value: 12 },
									{ label: 'Feb', value: 20 },
									{ label: 'Mar', value: 28 },
								],
							},
						],
						styles: { preview: 'vertical_bar' },
					},
					{
						type: 'table',
						title: 'Deployments',
						data: {
							headers: ['Service', 'Status'],
							rows: [{ Service: 'API', Status: 'Healthy' }],
							styles: {
								width: [60, 40],
								sticky: { rows: 1, columns: 1 },
							},
						},
					},
					{
						type: 'list',
						title: 'Next Steps',
						data: ['Validate config', 'Deploy workflow'],
					},
					{
						type: 'label',
						title: 'Metadata',
						data: [{ key: 'Status', value: 'Open' }],
					},
					{
						type: 'images',
						title: 'Screenshots',
						data: ['https://example.com/one.png'],
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');

		expect(result[0].json).toMatchObject({
			text: 'Advanced payload',
			slides: [
				{
					type: 'percentage_chart',
					title: 'Traffic Split',
					styles: { preview: 'doughnut' },
				},
				{
					type: 'graph',
					title: 'Weekly Volume',
					styles: { preview: 'vertical_bar' },
				},
				{
					type: 'table',
					title: 'Deployments',
					data: {
						headers: ['Service', 'Status'],
						rows: [{ Service: 'API', Status: 'Healthy' }],
						styles: {
							width: [60, 40],
							sticky: { rows: 1, columns: 1 },
						},
					},
				},
				{
					type: 'list',
					title: 'Next Steps',
					data: ['Validate config', 'Deploy workflow'],
				},
				{
					type: 'label',
					title: 'Metadata',
					data: [{ key: 'Status', value: 'Open' }],
				},
				{
					type: 'images',
					title: 'Screenshots',
					data: ['https://example.com/one.png'],
				},
			],
		});
	});

	it('should accept advanced slide types without optional styles or rows wrappers', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Minimal advanced payload',
				slidesJson: [
					{
						type: 'percentage_chart',
						data: [
							{ label: 'API', value: 50 },
							{ label: 'Worker', value: 50 },
						],
					},
					{
						type: 'graph',
						data: [
							{
								category: 'Asana',
								values: [{ label: 'Jan', value: 12 }],
							},
						],
					},
					{
						type: 'table',
						data: {
							headers: ['Service', 'Status'],
						},
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');

		expect(result[0].json).toMatchObject({
			text: 'Minimal advanced payload',
			slides: [
				{
					type: 'percentage_chart',
					data: [
						{ label: 'API', value: 50 },
						{ label: 'Worker', value: 50 },
					],
				},
				{
					type: 'graph',
					data: [
						{
							category: 'Asana',
							values: [{ label: 'Jan', value: 12 }],
						},
					],
				},
				{
					type: 'table',
					data: {
						headers: ['Service', 'Status'],
					},
				},
			],
		});
	});

	it('should allow table slide styles with sticky rows-only and columns-only variants', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Table styles',
				slidesJson: [
					{
						type: 'table',
						title: 'Rows Sticky',
						data: {
							headers: ['Name', 'Team'],
							rows: [{ Name: 'Paula Rojas', Team: 'Sales' }],
							styles: {
								width: [50, 50],
								sticky: { rows: 1 },
							},
						},
					},
					{
						type: 'table',
						title: 'Columns Sticky',
						data: {
							headers: ['Name', 'Team'],
							rows: [{ Name: 'Quinn Rivers', Team: 'Marketing' }],
							styles: {
								width: [50, 50],
								sticky: { columns: 1 },
							},
						},
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			text: 'Table styles',
			slides: [
				{
					type: 'table',
					title: 'Rows Sticky',
					data: {
						headers: ['Name', 'Team'],
						rows: [{ Name: 'Paula Rojas', Team: 'Sales' }],
						styles: {
							width: [50, 50],
							sticky: { rows: 1 },
						},
					},
				},
				{
					type: 'table',
					title: 'Columns Sticky',
					data: {
						headers: ['Name', 'Team'],
						rows: [{ Name: 'Quinn Rivers', Team: 'Marketing' }],
						styles: {
							width: [50, 50],
							sticky: { columns: 1 },
						},
					},
				},
			],
		});
	});

	it('should allow table slide styles with width only and no sticky block', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Width only table',
				slidesJson: [
					{
						type: 'table',
						title: 'Width Only',
						data: {
							headers: ['Name', 'Team'],
							rows: [{ Name: 'Paula Rojas', Team: 'Sales' }],
							styles: {
								width: [55, 45],
							},
						},
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			text: 'Width only table',
			slides: [
				{
					type: 'table',
					title: 'Width Only',
					data: {
						headers: ['Name', 'Team'],
						rows: [{ Name: 'Paula Rojas', Team: 'Sales' }],
						styles: {
							width: [55, 45],
						},
					},
				},
			],
		});
	});

	it('should trim blank slide titles away instead of keeping empty title fields', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [
					{
						type: 'text',
						title: '   ',
						data: 'Valid text.',
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			slides: [
				{
					type: 'text',
					data: 'Valid text.',
				},
			],
		});
		expect(
			((result[0].json as Record<string, unknown>).slides as Array<Record<string, unknown>>)[0],
		).not.toHaveProperty('title');
	});

	it('should allow percentage_chart slides with a zero-value segment when the total is still 100', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Zero share is allowed',
				slidesJson: [
					{
						type: 'percentage_chart',
						data: [
							{ label: 'A', value: 0 },
							{ label: 'B', value: 100 },
						],
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');

		expect(result[0].json).toMatchObject({
			text: 'Zero share is allowed',
			slides: [
				{
					type: 'percentage_chart',
					data: [
						{ label: 'A', value: 0 },
						{ label: 'B', value: 100 },
					],
				},
			],
		});
	});

	it('should reject Slides JSON when it is not a JSON array', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: {
					type: 'text',
					data: 'No array wrapper',
				},
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Slides JSON must be a JSON array of objects',
		);
	});

	it('should treat null Slides JSON and null Buttons JSON as omitted', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: null,
				buttonsJson: null,
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toEqual({ text: 'Hello world' });
	});

	it('should reject non-string optional card fields', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				theme: 123,
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Theme must be a string',
		);
	});

	it('should reject non-string Card Text values', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 123,
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Text must be a string',
		);
	});

	it('should reject blank Card Text values', async () => {
		const context = createTestExecutionContext({
			params: {
				text: '   ',
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Text is required',
		);
	});

	it('should reject Card Text longer than the shared rich text limit', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'a'.repeat(4097),
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Text exceeds 4096 characters',
		);
	});

	it('should reject invalid card theme enum values', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				theme: 'neon',
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Theme must be one of: modern-inline, basic, poll, prompt',
		);
	});

	it('should return actionable recoverable errors when continueOnFail is enabled', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: {
					label: 'Bad shape',
				},
			},
			continueOnFail: true,
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'messageComponentBuilder',
			operation: 'buildAgentCardPayload',
		});
		expect((result[0].json as Record<string, unknown>).hint).toEqual(
			expect.stringContaining('Buttons JSON'),
		);
	});

	it('should validate direct image URL fields strictly', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				iconUrl: 'http://example.com/icon.jpg',
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Icon URL must start with "https://"',
		);
	});

	it('should reject invalid absolute icon URLs', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				iconUrl: 'not-a-url',
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Icon URL must be a valid absolute URL',
		);
	});

	it('should reject thumbnail URLs that are not direct png/svg files', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				thumbnailUrl: 'https://example.com/thumb.jpg',
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Card Thumbnail URL must point to a direct .png or .svg image URL',
		);
	});

	it('should reject Slides JSON entries that are not objects', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: ['bad entry'],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Slides JSON[0] must be a JSON object',
		);
	});

	it('should reject slides without a type', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [{}],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Slides JSON[0].type is required',
		);
	});

	it('should reject unsupported slide types', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [{ type: 'carousel', data: [] }],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Slides JSON[0].type must be one of: table, list, images, text, label, percentage_chart, graph',
		);
	});

	it('should reject text slides with blank data', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [{ type: 'text', data: '   ' }],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Slides JSON[0].data must be a non-empty string for text slides',
		);
	});

	it('should reject text slides that exceed the slide text limit', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [{ type: 'text', data: 'a'.repeat(1001) }],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Slides JSON[0].data exceeds 1000 characters for text slides',
		);
	});

	it('should trim outer whitespace before enforcing the text slide length limit', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [{ type: 'text', data: `  ${'a'.repeat(1000)}  ` }],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			slides: [
				{
					type: 'text',
					data: 'a'.repeat(1000),
				},
			],
		});
	});

	it('should reject slide-level buttons when buttons is not an array', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [{ type: 'text', data: 'Slide', buttons: {} }],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Slides JSON[0].buttons must be a JSON array of button objects',
		);
	});

	it('should allow slide-level buttons and normalize them through shared button validation', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [
					{
						type: 'text',
						data: 'Slide',
						title: 'Slide title',
						buttons: [
							{
								label: 'Open',
								action: {
									type: 'open.url',
									data: {
										url: 'https://example.com/slide',
									},
								},
							},
						],
					},
				],
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			slides: [
				{
					type: 'text',
					data: 'Slide',
					title: 'Slide title',
					buttons: [
						expect.objectContaining({
							label: 'Open',
							key: expect.any(String),
						}),
					],
				},
			],
		});
	});

	it('should reject Buttons JSON entries that are not objects', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: ['bad entry'],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Buttons JSON[0] must be a JSON object',
		);
	});

	it('should reject top-level buttons with blank labels', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: [
					{
						label: '',
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com',
							},
						},
					},
				],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Buttons JSON[0].label must be a non-empty string',
		);
	});

	it('should reject top-level buttons with non-string labels', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: [
					{
						label: 123,
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com',
							},
						},
					},
				],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Buttons JSON[0].label must be a string',
		);
	});

	it('should reject duplicate explicit button keys within the same top-level button array', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: [
					{
						label: 'Open A',
						key: 'same_key',
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com/a',
							},
						},
					},
					{
						label: 'Open B',
						key: 'same_key',
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com/b',
							},
						},
					},
				],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Duplicate button key "same_key" found in Buttons JSON[0].key and Buttons JSON[1].key',
		);
	});

	it('should reject explicit non-string button keys instead of silently auto-generating replacements', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: [
					{
						label: 'Click',
						key: 123,
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com',
							},
						},
					},
				],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Buttons JSON[0].key must be a string',
		);
	});

	it('should reject duplicate explicit button keys shared between top-level and slide-level buttons', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: [
					{
						label: 'Top Button',
						key: 'shared_key',
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com/top',
							},
						},
					},
				],
				slidesJson: [
					{
						type: 'text',
						data: 'Slide',
						buttons: [
							{
								label: 'Slide Button',
								key: 'shared_key',
								action: {
									type: 'open.url',
									data: {
										url: 'https://example.com/slide',
									},
								},
							},
						],
					},
				],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Duplicate button key "shared_key" found in Buttons JSON[0].key and Slides JSON[0].buttons[0].key',
		);
	});

	it('should reject duplicate auto-generated button keys across top-level and slide-level buttons', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				buttonsJson: [
					{
						label: 'Open',
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com/top',
							},
						},
					},
				],
				slidesJson: [
					{
						type: 'text',
						data: 'Slide',
						buttons: [
							{
								label: 'Open',
								action: {
									type: 'open.url',
									data: {
										url: 'https://example.com/slide',
									},
								},
							},
						],
					},
				],
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			/Duplicate button key .*Buttons JSON\[0\]\.key and Slides JSON\[0\]\.buttons\[0\]\.key/,
		);
	});

	test.each(invalidSlidesJsonCases)('$name', async ({ slidesJson, expectedMessage }) => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson,
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			expectedMessage,
		);
	});

	it('should accept JSON string inputs for slides and buttons', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: '[{"type":"text","data":"Inline string slide"}]',
				buttonsJson:
					'[{"label":"Open","action":{"type":"open.url","data":{"url":"https://example.com"}}}]',
			},
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			text: 'Hello world',
			slides: [
				{
					type: 'text',
					data: 'Inline string slide',
				},
			],
			buttons: [
				expect.objectContaining({
					label: 'Open',
				}),
			],
		});
	});

	it('should return Slides JSON-specific recoverable guidance in continueOnFail mode', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: [{ type: 'carousel', data: [] }],
			},
			continueOnFail: true,
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			success: false,
			reason:
				'Slides JSON[0].type must be one of: table, list, images, text, label, percentage_chart, graph',
		});
		expect((result[0].json as Record<string, unknown>).hint).toEqual(
			expect.stringContaining('Slides JSON'),
		);
	});

	it('should return Card Text-specific recoverable guidance in continueOnFail mode', async () => {
		const context = createTestExecutionContext({
			params: {
				text: '   ',
			},
			continueOnFail: true,
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect((result[0].json as Record<string, unknown>).hint).toEqual(
			expect.stringContaining('4096'),
		);
	});

	it('should return image URL-specific recoverable guidance in continueOnFail mode', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				thumbnailUrl: 'ftp://example.com/thumb.png',
			},
			continueOnFail: true,
		});

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect((result[0].json as Record<string, unknown>).hint).toEqual(
			expect.stringContaining('.png or .svg'),
		);
	});

	it('should reject payloads that exceed the shared rich payload size limit', async () => {
		const hugeSlides = Array.from({ length: 10 }, (_, index) => ({
			type: 'text',
			title: `Slide ${index + 1}`,
			data: 'x'.repeat(1000),
		}));
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
				slidesJson: hugeSlides,
			},
		});

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Agent card payload exceeds 10000 characters',
		);
	});

	it('should wrap non-Error failures in a NodeOperationError when continueOnFail is disabled', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
			},
		});
		(context.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'text') {
					throw 'boom';
				}
				return fallback;
			},
		);

		await expect(buildAgentCardPayload.execute.call(context, items, '')).rejects.toThrow(
			'Unable to build agent card payload',
		);
	});

	it('should return a generic recoverable payload for non-Error failures in continueOnFail mode', async () => {
		const context = createTestExecutionContext({
			params: {
				text: 'Hello world',
			},
			continueOnFail: true,
		});
		(context.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'text') {
					throw 'boom';
				}
				return fallback;
			},
		);

		const result = await buildAgentCardPayload.execute.call(context, items, '');
		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'Unable to build agent card payload',
		});
	});

	it('should scope description fields to messageComponentBuilder/buildAgentCardPayload', () => {
		const textField = buildAgentCardPayload.description.find(
			(property) => property.name === 'text',
		);
		const themeField = buildAgentCardPayload.description.find(
			(property) => property.name === 'theme',
		);
		const notice = buildAgentCardPayload.description.find(
			(property) => property.name === 'agentCardPayloadBuilderAiToolNotice',
		);
		const guideNotice = buildAgentCardPayload.description.find(
			(property) => property.name === 'agentCardPayloadBuilderAiGuideNotice',
		);

		expect(textField?.displayOptions?.show).toMatchObject({
			resource: ['messageComponentBuilder'],
			operation: ['buildAgentCardPayload'],
		});
		expect(themeField?.type).toBe('string');
		expect(String(themeField?.description ?? '')).toContain(
			'ENUM: ["modern-inline", "basic", "poll", "prompt"]',
		);
		expect(String(notice?.displayName ?? '')).toContain('Recommendation');
		expect(String(notice?.displayName ?? '')).toContain('Agent Card Payload Builder');
		expect(String(guideNotice?.displayName ?? '')).toContain('Open Tool Setup Guide');
	});
});

describe('Message Component Builder - Agent Card Payload Builder test helpers', () => {
	it('should return null for optional string parameters that trim to empty', () => {
		const context = createTestExecutionContext({
			params: {
				title: '   ',
			},
		});

		expect(
			buildAgentCardPayload.__testHelpers.getOptionalTrimmedStringParameter(
				context,
				'title',
				0,
				'Card Title',
			),
		).toBeNull();
	});

	it('should return the trimmed value for optional string parameters with content', () => {
		const context = createTestExecutionContext({
			params: {
				title: '  Status Board  ',
			},
		});

		expect(
			buildAgentCardPayload.__testHelpers.getOptionalTrimmedStringParameter(
				context,
				'title',
				0,
				'Card Title',
			),
		).toBe('Status Board');
	});

	it('should map normalized slides into the internal raw collection shape', () => {
		expect(
			buildAgentCardPayload.__testHelpers.toSlidesCollection([
				{ type: 'text', title: 'Title' } as IDataObject,
			]),
		).toEqual({
			slide: [
				{
					enabled: true,
					slideInputMode: 'raw',
					type: 'text',
					title: 'Title',
					rawSlide: { type: 'text', title: 'Title' },
				},
			],
		});
	});

	it('should allow valid non-text slide types without text-slide validation', () => {
		const context = createTestExecutionContext();

		expect(
			buildAgentCardPayload.__testHelpers.normalizeSlidesInput(
				context,
				0,
				[
					{
						type: 'table',
						title: 'Deployments',
						data: {
							headers: ['Service', 'Status'],
							rows: [{ Service: 'API', Status: 'Healthy' }],
						},
					},
				],
				new Map(),
			),
		).toEqual([
			{
				type: 'table',
				title: 'Deployments',
				data: {
					headers: ['Service', 'Status'],
					rows: [{ Service: 'API', Status: 'Healthy' }],
				},
			},
		]);
	});

	it('should validate absolute HTTPS URLs through the helper', () => {
		const context = createTestExecutionContext();

		expect(
			buildAgentCardPayload.__testHelpers.validateAbsoluteHttpsUrl(
				context,
				0,
				'Slides JSON[0].data[0]',
				'https://example.com/image.png',
			),
		).toBe('https://example.com/image.png');

		expect(() =>
			buildAgentCardPayload.__testHelpers.validateAbsoluteHttpsUrl(
				context,
				0,
				'Slides JSON[0].data[0]',
				'   ',
			),
		).toThrow('Slides JSON[0].data[0] must be a valid absolute HTTPS URL');

		expect(() =>
			buildAgentCardPayload.__testHelpers.validateAbsoluteHttpsUrl(
				context,
				0,
				'Slides JSON[0].data[0]',
				'http://example.com/image.png',
			),
		).toThrow('Slides JSON[0].data[0] must be a valid absolute HTTPS URL');
	});

	it('should reject malformed raw button arrays through the helper', () => {
		const context = createTestExecutionContext();

		expect(() =>
			buildAgentCardPayload.__testHelpers.validateRawButtonArrayInput(
				context,
				0,
				['bad-entry'],
				'Buttons JSON',
				new Map(),
			),
		).toThrow('Buttons JSON[0] must be a JSON object');

		expect(() =>
			buildAgentCardPayload.__testHelpers.validateRawButtonArrayInput(
				context,
				0,
				[
					{
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com',
							},
						},
					},
				],
				'Buttons JSON',
				new Map(),
			),
		).toThrow('Buttons JSON[0].label is required');

		expect(() =>
			buildAgentCardPayload.__testHelpers.validateRawButtonArrayInput(
				context,
				0,
				[
					{
						label: 'Click',
						key: '   ',
						action: {
							type: 'open.url',
							data: {
								url: 'https://example.com',
							},
						},
					},
				],
				'Buttons JSON',
				new Map(),
			),
		).toThrow('Buttons JSON[0].key must be a non-empty string when provided');
	});

	it('should skip payload button uniqueness checks for malformed helper-only payload entries', () => {
		const context = createTestExecutionContext();

		expect(() =>
			buildAgentCardPayload.__testHelpers.validatePayloadButtonKeyUniqueness(context, 0, {
				buttons: [{ label: 'No key' }],
				slides: ['bad-slide'],
			}),
		).not.toThrow();
	});
});
