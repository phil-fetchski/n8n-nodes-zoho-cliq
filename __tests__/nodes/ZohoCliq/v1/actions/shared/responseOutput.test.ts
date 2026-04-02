import {
	buildExecutionItemsFromApiResponse,
	coerceApiResponseToObject,
	coerceApiResponseToObjectWithOptions,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/responseOutput';

describe('ZohoCliq - Shared response object helper', () => {
	it('should preserve array data when coercing API responses into objects', () => {
		expect(coerceApiResponseToObject({ success: true })).toEqual({ success: true });
		expect(coerceApiResponseToObject([{ success: true }])).toEqual({
			data: [{ success: true }],
		});
		expect(coerceApiResponseToObject(undefined)).toEqual({});
		expect(coerceApiResponseToObject(null)).toEqual({});
	});

	it('should build execution items with a wrapped array payload', () => {
		expect(
			buildExecutionItemsFromApiResponse([{ id: '1' }], {
				arrayKey: 'subscribers',
			}),
		).toEqual([
			{
				json: {
					subscribers: [{ id: '1' }],
				},
			},
		]);
	});

	it('should build execution items with default options when none are provided', () => {
		expect(buildExecutionItemsFromApiResponse({ ok: true })).toEqual([
			{
				json: {
					ok: true,
				},
			},
		]);
	});

	it('should wrap primitive responses under the configured key', () => {
		expect(
			coerceApiResponseToObjectWithOptions('ok', {
				primitiveKey: 'status',
			}),
		).toEqual({
			status: 'ok',
		});
	});

	it('should preserve arrays without changing their shape', () => {
		expect(
			coerceApiResponseToObjectWithOptions([{ id: '1' }], {
				arrayKey: 'items',
			}),
		).toEqual({
			items: [{ id: '1' }],
		});

		expect(
			coerceApiResponseToObjectWithOptions([{ id: '1' }, { id: '2' }], {
				arrayKey: 'items',
			}),
		).toEqual({
			items: [{ id: '1' }, { id: '2' }],
		});

		expect(
			coerceApiResponseToObjectWithOptions(['one'], {
				arrayKey: 'items',
			}),
		).toEqual({
			items: ['one'],
		});
	});
});
