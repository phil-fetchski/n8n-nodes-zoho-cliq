import { createSlideCollectionValues } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload/slideCollectionValues';

describe('ZohoCliq - Shared - messagePayload - slideCollectionValues', () => {
	const properties = createSlideCollectionValues([], 1000);

	function findIndexByNameForType(name: string, type: string): number {
		return properties.findIndex((property) => {
			const show = property.displayOptions?.show as Record<string, unknown> | undefined;
			const types = Array.isArray(show?.type) ? (show?.type as string[]) : [];
			return property.name === name && types.includes(type);
		});
	}

	it('should order text component fields as title, include, content, buttons', () => {
		const titleIndex = findIndexByNameForType('title', 'text');
		const includeIndex = findIndexByNameForType('enabled', 'text');
		const contentIndex = findIndexByNameForType('textData', 'text');
		const buttonsIndex = findIndexByNameForType('textButtons', 'text');

		expect(titleIndex).toBeGreaterThan(-1);
		expect(includeIndex).toBeGreaterThan(titleIndex);
		expect(contentIndex).toBeGreaterThan(includeIndex);
		expect(buttonsIndex).toBeGreaterThan(contentIndex);
	});

	it('should order table component fields as title, include, columns, rows, buttons', () => {
		const titleIndex = findIndexByNameForType('title', 'table');
		const includeIndex = findIndexByNameForType('enabled', 'table');
		const columnsIndex = findIndexByNameForType('tableHeaders', 'table');
		const rowsIndex = findIndexByNameForType('tableRows', 'table');
		const buttonsIndex = findIndexByNameForType('tableButtons', 'table');

		expect(titleIndex).toBeGreaterThan(-1);
		expect(includeIndex).toBeGreaterThan(titleIndex);
		expect(columnsIndex).toBeGreaterThan(includeIndex);
		expect(rowsIndex).toBeGreaterThan(columnsIndex);
		expect(buttonsIndex).toBeGreaterThan(rowsIndex);
	});

	it('should order list component fields as title, include, items, buttons', () => {
		const titleIndex = findIndexByNameForType('title', 'list');
		const includeIndex = findIndexByNameForType('enabled', 'list');
		const itemsIndex = findIndexByNameForType('listItems', 'list');
		const buttonsIndex = findIndexByNameForType('listButtons', 'list');

		expect(titleIndex).toBeGreaterThan(-1);
		expect(includeIndex).toBeGreaterThan(titleIndex);
		expect(itemsIndex).toBeGreaterThan(includeIndex);
		expect(buttonsIndex).toBeGreaterThan(itemsIndex);
	});

	it('should include doc notice for each structured component type', () => {
		const docNoticeNames = new Set(
			properties.filter((property) => property.type === 'notice').map((property) => property.name),
		);

		expect(Array.from(docNoticeNames)).toEqual(
			expect.arrayContaining([
				'chartComponentDocsNotice',
				'graphComponentDocsNotice',
				'textComponentDocsNotice',
				'tableComponentDocsNotice',
				'listComponentDocsNotice',
				'labelComponentDocsNotice',
				'imagesComponentDocsNotice',
			]),
		);
	});

	it('should expose chart and graph in component type options', () => {
		const typeProperty = properties.find((property) => property.name === 'type');
		const optionValues = ((typeProperty?.options ?? []) as Array<{ value?: unknown }>)
			.map((option) => option.value)
			.filter((value): value is string => typeof value === 'string');

		expect(optionValues).toEqual(
			expect.arrayContaining([
				'percentage_chart',
				'graph',
				'images',
				'label',
				'list',
				'table',
				'text',
			]),
		);
	});

	it('should order chart fields as title, include, style, data, buttons', () => {
		const titleIndex = findIndexByNameForType('title', 'percentage_chart');
		const includeIndex = findIndexByNameForType('enabled', 'percentage_chart');
		const styleIndex = findIndexByNameForType('chartPreview', 'percentage_chart');
		const dataIndex = findIndexByNameForType('chartDataPoints', 'percentage_chart');
		const buttonsIndex = findIndexByNameForType('chartButtons', 'percentage_chart');

		expect(titleIndex).toBeGreaterThan(-1);
		expect(includeIndex).toBeGreaterThan(titleIndex);
		expect(styleIndex).toBeGreaterThan(includeIndex);
		expect(dataIndex).toBeGreaterThan(styleIndex);
		expect(buttonsIndex).toBeGreaterThan(dataIndex);
	});

	it('should order graph fields as title, include, style, axes, data, buttons', () => {
		const titleIndex = findIndexByNameForType('title', 'graph');
		const includeIndex = findIndexByNameForType('enabled', 'graph');
		const styleIndex = findIndexByNameForType('graphPreview', 'graph');
		const xAxisIndex = findIndexByNameForType('graphXAxisTitle', 'graph');
		const yAxisIndex = findIndexByNameForType('graphYAxisTitle', 'graph');
		const dataIndex = findIndexByNameForType('graphCategories', 'graph');
		const buttonsIndex = findIndexByNameForType('graphButtons', 'graph');

		expect(titleIndex).toBeGreaterThan(-1);
		expect(includeIndex).toBeGreaterThan(titleIndex);
		expect(styleIndex).toBeGreaterThan(includeIndex);
		expect(xAxisIndex).toBeGreaterThan(styleIndex);
		expect(yAxisIndex).toBeGreaterThan(xAxisIndex);
		expect(dataIndex).toBeGreaterThan(yAxisIndex);
		expect(buttonsIndex).toBeGreaterThan(dataIndex);
	});
});
