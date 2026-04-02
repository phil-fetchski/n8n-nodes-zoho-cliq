import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { resourceMapping } from '../../../../nodes/ZohoCliq/v1/methods/resourceMapping';
import * as transport from '../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../nodes/ZohoCliq/v1/transport');

describe('ResourceMapping Methods', () => {
	let mockLoadOptionsFunctions: ILoadOptionsFunctions;

	beforeEach(() => {
		mockLoadOptionsFunctions = {
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			getCurrentNodeParameter: jest.fn(),
			helpers: {},
		} as unknown as ILoadOptionsFunctions;
	});

	it('should return fields inferred from record sample with limit 5', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue(
			'neightntestdatabase',
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			list: [{ text: 'Test', longtext: 'Long', bool: true, id: '5452022000003533003' }],
		});

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/neightntestdatabase/records',
			{},
			{ limit: 5 },
		);
		expect(result.fields.map((field) => ({ id: field.id, type: field.type }))).toEqual([
			{ id: 'bool', type: 'boolean' },
			{ id: 'longtext', type: 'string' },
			{ id: 'text', type: 'string' },
		]);
	});

	it('should return empty fields notice when database name is missing', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('');

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('Enter a Database Name');
	});

	it('should return empty fields notice when getCurrentNodeParameter is unavailable', async () => {
		const ctxWithoutGetter = {
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {},
		} as unknown as ILoadOptionsFunctions;

		const result = await resourceMapping.getDatabaseRecordMapperFields.call(ctxWithoutGetter);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('Enter a Database Name');
	});

	it('should trim and encode database name when requesting records', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue(
			'  db name/1  ',
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			list: [{ text: 'hello' }],
		});

		await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/db%20name%2F1/records',
			{},
			{ limit: 5 },
		);
	});

	it('should return no-record notice when endpoint returns no parsable records', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ list: [] });

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('No records found to infer fields');
	});

	it('should return no-record notice when response object has no supported record containers', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ foo: 'bar' });

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('No records found to infer fields');
	});

	it('should return no-record notice when response is a primitive', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue('not-an-object');

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('No records found to infer fields');
	});

	it('should parse records from "records" response shape and infer object type from json samples', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			records: [
				{
					id: '1',
					age: 25,
					is_active: true,
					meta: { nested: true },
					nullable_only: null,
					mixed: 'open',
				},
				{
					id: '2',
					age: 30,
					mixed: 99,
				},
			],
		});

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);
		const fieldsById = Object.fromEntries(result.fields.map((field) => [field.id, field.type]));

		expect(fieldsById).toEqual({
			age: 'number',
			is_active: 'boolean',
			meta: 'object',
			mixed: 'string',
			nullable_only: 'string',
		});
		expect(fieldsById).not.toHaveProperty('id');
	});

	it('should parse records from "data" array response shape', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: [{ status: 'open' }, 'skip-me', null],
		});

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: 'status', type: 'string' })]),
		);
	});

	it('should parse records from nested "data.records" response shape', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: { records: [{ flag: false }] },
		});

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: 'flag', type: 'boolean' })]),
		);
	});

	it('should resolve records from top-level array wrapper response', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue([
			'skip',
			{ data: { list: [{ score: 1 }] } },
		]);

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: 'score', type: 'number' })]),
		);
	});

	it('should return no-record notice for top-level arrays without parsable objects', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(['skip', null, 123, true]);

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('No records found to infer fields');
	});

	it('should continue scanning top-level array entries until parsable records are found', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue([
			{ data: { info: 'no record list yet' } },
			{ data: { records: [{ amount: 25 }] } },
		]);

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual(
			expect.arrayContaining([expect.objectContaining({ id: 'amount', type: 'number' })]),
		);
	});

	it('should return no-record notice when data object exists without list/records arrays', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			data: {
				meta: { page: 1 },
			},
		});

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('No records found to infer fields');
	});

	it('should return endpoint failure notice when api request throws', async () => {
		(mockLoadOptionsFunctions.getCurrentNodeParameter as jest.Mock).mockReturnValue('orders');
		(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(new Error('request failed'));

		const result =
			await resourceMapping.getDatabaseRecordMapperFields.call(mockLoadOptionsFunctions);

		expect(result.fields).toEqual([]);
		expect(result.emptyFieldsNotice).toContain('Unable to load fields');
	});
});
