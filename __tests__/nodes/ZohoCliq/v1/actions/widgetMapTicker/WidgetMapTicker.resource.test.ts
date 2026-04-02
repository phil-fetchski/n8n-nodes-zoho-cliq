import * as WidgetMapTickerResource from '../../../../../../nodes/ZohoCliq/v1/actions/widgetMapTicker/WidgetMapTicker.resource';

describe('ZohoCliq - WidgetMapTicker - WidgetMapTicker.resource', () => {
	it('should expose supported operations', () => {
		expect(WidgetMapTickerResource).toHaveProperty('addOrUpdateTicker');
		expect(WidgetMapTickerResource).toHaveProperty('deleteTicker');
	});

	it('should define operation selector with expected options', () => {
		const operationProperty = WidgetMapTickerResource.description.find(
			(property) => property.name === 'operation',
		);

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('addOrUpdateTicker');
		expect(operationProperty?.noDataExpression).toBe(true);

		const optionValues = ((operationProperty?.options ?? []) as Array<{ value: string }>).map(
			(option) => option.value,
		);
		expect(optionValues).toEqual(['addOrUpdateTicker', 'deleteTicker']);
	});

	it('should include operation-specific properties for both operations', () => {
		const addInputMode = WidgetMapTickerResource.description.find(
			(property) =>
				property.name === 'inputMode' &&
				property.displayOptions?.show?.operation?.includes('addOrUpdateTicker'),
		);
		const deleteInputMode = WidgetMapTickerResource.description.find(
			(property) =>
				property.name === 'inputMode' &&
				property.displayOptions?.show?.operation?.includes('deleteTicker'),
		);

		expect(addInputMode).toBeDefined();
		expect(deleteInputMode).toBeDefined();
	});
});
