import * as files from '../../../../../../nodes/ZohoCliq/v1/actions/files/Files.resource';

describe('ZohoCliq - Files Resource', () => {
	it('should expose getFile and shareFile operations', () => {
		const operationKeys = Object.keys(files)
			.filter((key) => key !== 'description')
			.sort();

		expect(operationKeys).toEqual(['getFile', 'shareFile']);
	});

	it('should define operation selector for files resource', () => {
		const operationProperty = files.description.find((property) => property.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['file']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('getFile');
	});
});
