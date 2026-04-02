import type { IDataObject, INodeExecutionData } from 'n8n-workflow';

export interface ICoerceApiResponseToObjectOptions {
	arrayKey?: string;
	primitiveKey?: string;
}

export function coerceApiResponseToObject(response: unknown): IDataObject {
	return coerceApiResponseToObjectWithOptions(response);
}

export function coerceApiResponseToObjectWithOptions(
	response: unknown,
	options: ICoerceApiResponseToObjectOptions = {},
): IDataObject {
	const arrayKey = options.arrayKey ?? 'data';
	const primitiveKey = options.primitiveKey ?? 'data';

	if (response && typeof response === 'object' && !Array.isArray(response)) {
		return response as IDataObject;
	}

	if (Array.isArray(response)) {
		return { [arrayKey]: response } as IDataObject;
	}

	if (response === undefined || response === null) {
		return {};
	}

	return { [primitiveKey]: response } as IDataObject;
}

export function buildExecutionItemsFromApiResponse(
	response: unknown,
	options: ICoerceApiResponseToObjectOptions = {},
): INodeExecutionData[] {
	return [
		{
			json: coerceApiResponseToObjectWithOptions(response, options),
		},
	];
}
