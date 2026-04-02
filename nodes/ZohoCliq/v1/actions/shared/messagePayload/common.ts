import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { blockedObjectKeys } from './constants';

export function parseJsonObjectInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	options: { allowEmptyObject: boolean },
): IDataObject {
	if (value === undefined || value === null || value === '') {
		if (options.allowEmptyObject) {
			return {};
		}
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, { itemIndex });
	}

	const parsed = parseJsonInput(context, value, itemIndex, path);
	if (!isDataObject(parsed)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
	}

	if (!options.allowEmptyObject && Object.keys(parsed).length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be an empty object`, {
			itemIndex,
		});
	}

	return parsed;
}

export function parseJsonInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject | IDataObject[] {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return {};
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new NodeOperationError(context.getNode(), `${path} must be valid JSON`, { itemIndex });
		}

		if (parsed === null) {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a non-null JSON object/array`,
				{
					itemIndex,
				},
			);
		}

		ensureSafeObject(context, parsed, itemIndex, path);
		return parsed as IDataObject | IDataObject[];
	}

	if (Array.isArray(value) || isDataObject(value)) {
		ensureSafeObject(context, value, itemIndex, path);
		return value;
	}

	throw new NodeOperationError(
		context.getNode(),
		`${path} must be a JSON object, JSON array, or JSON string`,
		{
			itemIndex,
		},
	);
}

export function ensureSafeObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (value === null || value === undefined) {
		return;
	}

	if (typeof value !== 'object') {
		throw new NodeOperationError(context.getNode(), `${path} must be an object`, { itemIndex });
	}

	if (Array.isArray(value)) {
		value.forEach((entry, index) => {
			if (entry && typeof entry === 'object') {
				ensureSafeObject(context, entry, itemIndex, `${path}[${index}]`);
			}
		});
		return;
	}

	for (const key of Object.keys(value as IDataObject)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{
					itemIndex,
				},
			);
		}

		const child = (value as IDataObject)[key];
		if (child && typeof child === 'object') {
			ensureSafeObject(context, child, itemIndex, `${path}.${key}`);
		}
	}
}

export function getOptionalString(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function getOptionalBoolean(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	defaultValue: boolean,
): boolean {
	if (value === undefined || value === null) {
		return defaultValue;
	}

	if (typeof value !== 'boolean') {
		throw new NodeOperationError(context.getNode(), `${path} must resolve to a boolean`, {
			itemIndex,
		});
	}

	return value;
}

export function isDataObject(value: unknown): value is IDataObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function serializeRichPayloadFields(payload: IDataObject): IDataObject {
	const serialized: IDataObject = { ...payload };
	const richKeys: Array<'card' | 'slides' | 'buttons'> = ['card', 'slides', 'buttons'];

	for (const key of richKeys) {
		const value = serialized[key];
		if (value !== undefined && value !== null && typeof value !== 'string') {
			serialized[key] = JSON.stringify(value);
		}
	}

	return serialized;
}
