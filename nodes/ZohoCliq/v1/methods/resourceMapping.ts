import type {
	FieldType,
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	ResourceMapperField,
	ResourceMapperFields,
} from 'n8n-workflow';

import { zohoCliqApiRequest } from '../transport';
import { asDataObject } from '../helpers/data';

function resolveRecordList(response: unknown): IDataObject[] {
	if (Array.isArray(response)) {
		for (const entry of response) {
			const obj = asDataObject(entry);
			if (!obj) {
				continue;
			}
			const nested = resolveRecordList(obj);
			if (nested.length > 0) {
				return nested;
			}
		}
		return [];
	}

	const obj = asDataObject(response);
	if (!obj) {
		return [];
	}

	if (Array.isArray(obj.list)) {
		return obj.list.filter((item): item is IDataObject => !!asDataObject(item));
	}

	if (Array.isArray(obj.records)) {
		return obj.records.filter((item): item is IDataObject => !!asDataObject(item));
	}

	if (Array.isArray(obj.data)) {
		return obj.data.filter((item): item is IDataObject => !!asDataObject(item));
	}

	const dataObj = asDataObject(obj.data);
	if (dataObj) {
		if (Array.isArray(dataObj.list)) {
			return dataObj.list.filter((item): item is IDataObject => !!asDataObject(item));
		}
		if (Array.isArray(dataObj.records)) {
			return dataObj.records.filter((item): item is IDataObject => !!asDataObject(item));
		}
	}

	return [];
}

function inferSampleType(value: unknown): 'string' | 'number' | 'boolean' | 'null' | 'json' {
	if (value === null) {
		return 'null';
	}
	if (typeof value === 'number') {
		return 'number';
	}
	if (typeof value === 'boolean') {
		return 'boolean';
	}
	if (typeof value === 'object') {
		return 'json';
	}
	return 'string';
}

function resolveFieldType(types: Set<string>): FieldType {
	const normalizedTypes = Array.from(types);
	const nonNullTypes = normalizedTypes.filter((type) => type !== 'null');
	if (nonNullTypes.length === 1) {
		const type = nonNullTypes[0];
		return type === 'json' ? 'object' : (type as FieldType);
	}

	return 'string';
}

export const resourceMapping = {
	async getDatabaseRecordMapperFields(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
		const getParam = (this as unknown as { getCurrentNodeParameter?: (name: string) => unknown })
			.getCurrentNodeParameter;
		const tableNameRaw = getParam?.call(this, 'tableName');
		const tableName = typeof tableNameRaw === 'string' ? tableNameRaw.trim() : '';

		if (!tableName) {
			return {
				fields: [],
				emptyFieldsNotice: 'Enter a Database Name to load mappable fields.',
			};
		}

		try {
			const response = await zohoCliqApiRequest.call(
				this as unknown as IExecuteFunctions,
				'GET',
				`/api/v2/storages/${encodeURIComponent(tableName)}/records`,
				{},
				{ limit: 5 },
			);

			const records = resolveRecordList(response);
			if (records.length === 0) {
				return {
					fields: [],
					emptyFieldsNotice:
						'No records found to infer fields. Create one record first or switch to Using JSON mode.',
				};
			}

			const fieldTypeMap: Record<string, Set<string>> = {};
			for (const record of records) {
				for (const key of Object.keys(record)) {
					if (key === 'id') {
						continue;
					}
					if (!fieldTypeMap[key]) {
						fieldTypeMap[key] = new Set<string>();
					}
					fieldTypeMap[key].add(inferSampleType(record[key]));
				}
			}

			const fields: ResourceMapperField[] = Object.keys(fieldTypeMap)
				.sort((a, b) => a.localeCompare(b))
				.map((fieldName) => ({
					id: fieldName,
					displayName: fieldName,
					defaultMatch: true,
					canBeUsedToMatch: false,
					required: false,
					display: true,
					type: resolveFieldType(fieldTypeMap[fieldName]),
				}));

			return { fields };
		} catch {
			return {
				fields: [],
				emptyFieldsNotice: 'Unable to load fields from the database records endpoint.',
			};
		}
	},
};
