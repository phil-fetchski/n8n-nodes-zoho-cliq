import type { IDataObject } from 'n8n-workflow';

export function asDataObject(value: unknown): IDataObject | undefined {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return undefined;
	}

	return value as IDataObject;
}
