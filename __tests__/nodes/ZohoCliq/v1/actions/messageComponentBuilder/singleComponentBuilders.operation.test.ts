import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import * as buildChartComponent from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildChartComponent.operation';
import * as buildGraphComponent from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildGraphComponent.operation';
import * as buildImageComponent from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildImageComponent.operation';
import * as buildLabelComponent from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildLabelComponent.operation';
import * as buildListComponent from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildListComponent.operation';
import * as buildTableComponent from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildTableComponent.operation';
import { createTestExecutionContext } from './testExecutionContext';

type BuilderOperation = {
	execute: (
		this: IExecuteFunctions,
		items: INodeExecutionData[],
		grantedScopes: string,
	) => Promise<INodeExecutionData[]>;
	description: Array<{ name: string; displayOptions?: { show?: Record<string, unknown> } }>;
};

const mockItems: INodeExecutionData[] = [{ json: {} }];

function createRawSlide(type: string, data: unknown) {
	return {
		slide: [
			{
				enabled: true,
				slideInputMode: 'raw',
				type,
				rawSlide: {
					type,
					data,
				},
			},
		],
	};
}

const operationCases: Array<{
	name: string;
	op: BuilderOperation;
	operation: string;
	componentType: string;
	data: unknown;
}> = [
	{
		name: 'table',
		op: buildTableComponent,
		operation: 'buildTableComponent',
		componentType: 'table',
		data: { headers: ['Name'], rows: [['Ava']] },
	},
	{
		name: 'list',
		op: buildListComponent,
		operation: 'buildListComponent',
		componentType: 'list',
		data: ['Line 1', 'Line 2'],
	},
	{
		name: 'image',
		op: buildImageComponent,
		operation: 'buildImageComponent',
		componentType: 'images',
		data: ['https://example.com/image.png'],
	},
	{
		name: 'label',
		op: buildLabelComponent,
		operation: 'buildLabelComponent',
		componentType: 'label',
		data: [{ key: 'Status', value: 'Open' }],
	},
	{
		name: 'graph',
		op: buildGraphComponent,
		operation: 'buildGraphComponent',
		componentType: 'graph',
		data: [{ title: 'Q1', data: [10, 20, 30] }],
	},
	{
		name: 'chart',
		op: buildChartComponent,
		operation: 'buildChartComponent',
		componentType: 'percentage_chart',
		data: [{ value: 'Pass', percentage: 85 }],
	},
];

describe('Message Component Builder - Single Component Operations', () => {
	test.each(operationCases)(
		'should build $name component payload',
		async ({ op, componentType, data }) => {
			const context = createTestExecutionContext({
				params: {
					slides: createRawSlide(componentType, data),
					includeSlidesWrapper: false,
				},
			});

			const result = await op.execute.call(context, mockItems, '');

			expect(result).toHaveLength(1);
			expect(result[0].json).toMatchObject({
				componentType,
				componentJsonPretty: {
					type: componentType,
				},
			});
			expect((result[0].json as Record<string, unknown>).componentPayload).toEqual(
				expect.any(String),
			);
			expect((result[0].json as Record<string, unknown>).wrapperPrefixPayload).toBeUndefined();
		},
	);

	test.each(operationCases)(
		'should apply resource/operation displayOptions for $name builder',
		({ op, operation }) => {
			const slidesField = op.description.find((property) => property.name === 'slides');
			expect(slidesField?.displayOptions?.show).toMatchObject({
				resource: ['messageComponentBuilder'],
				operation: [operation],
			});
		},
	);

	it('should include wrapped slides payload when includeSlidesWrapper is enabled', async () => {
		const context = createTestExecutionContext({
			params: {
				slides: createRawSlide('percentage_chart', [{ value: 'Pass', percentage: 85 }]),
				includeSlidesWrapper: true,
			},
		});

		const result = await buildChartComponent.execute.call(context, mockItems, '');
		expect(result[0].json).toHaveProperty('wrapperPrefixPayload');
		expect(String((result[0].json as Record<string, unknown>).wrapperPrefixPayload)).toContain(
			'"slides":',
		);
	});

	it('should throw when more than one component is provided', async () => {
		const context = createTestExecutionContext({
			params: {
				slides: {
					slide: [
						{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
						{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
					],
				},
				includeSlidesWrapper: false,
			},
		});

		await expect(buildTableComponent.execute.call(context, mockItems, '')).rejects.toThrow(
			'Exactly one component is required',
		);
	});

	it('should throw when component type does not match builder type', async () => {
		const context = createTestExecutionContext({
			params: {
				slides: createRawSlide('list', ['Line 1']),
				includeSlidesWrapper: false,
			},
		});

		await expect(buildTableComponent.execute.call(context, mockItems, '')).rejects.toThrow(
			'Component type must be "table" for this builder operation',
		);
	});

	it('should return per-item errors on continueOnFail', async () => {
		const context = createTestExecutionContext({
			params: {
				slides: {
					slide: [
						{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
						{ enabled: true, slideInputMode: 'raw', type: 'table', rawSlide: { type: 'table' } },
					],
				},
				includeSlidesWrapper: false,
			},
			continueOnFail: true,
		});

		const result = await buildTableComponent.execute.call(context, mockItems, '');
		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			error: 'Exactly one component is required',
			resource: 'messageComponentBuilder',
			operation: 'buildTableComponent',
		});
		expect(String((result[0].json as Record<string, unknown>).hint)).toContain(
			'componentJsonPretty',
		);
	});

	it('should validate includeSlidesWrapper boolean type', async () => {
		const context = createTestExecutionContext({
			params: {
				slides: createRawSlide('table', { headers: ['Name'], rows: [['Ava']] }),
				includeSlidesWrapper: 'true',
			},
		});

		await expect(buildTableComponent.execute.call(context, mockItems, '')).rejects.toThrow(
			'includeSlidesWrapper must be a boolean',
		);
	});

	it('should default null includeSlidesWrapper to false in single-component builders', async () => {
		const context = createTestExecutionContext({
			params: {
				slides: createRawSlide('table', { headers: ['Name'], rows: [['Ava']] }),
				includeSlidesWrapper: null,
			},
		});

		const result = await buildTableComponent.execute.call(context, mockItems, '');
		expect((result[0].json as Record<string, unknown>).wrapperPrefixPayload).toBeUndefined();
	});
});
