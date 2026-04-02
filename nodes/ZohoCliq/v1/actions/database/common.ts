import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	ResourceMapperValue,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { parseBooleanLikeTrue } from '../../helpers/utils';
import {
	buildCliqRecoverableErrorPayload,
	type ICliqErrorMessageMapping,
} from '../shared/errorResponse';
import { coerceApiResponseToObject } from '../shared/responseOutput';

const blockedObjectKeys = new Set(['__proto__', 'constructor', 'prototype']);
const fieldNamePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const recordIdPattern = /^[a-zA-Z0-9_:.-]{1,200}$/;
const databaseInputModeValues = new Set(['structured', 'raw']);
const databaseListQueryParameterKeys = [
	'criteria',
	'from_index',
	'limit',
	'order_by',
	'start_token',
];

export interface IDatabaseRecoverableErrorOptions {
	contextFields?: IDataObject;
	fallbackMessage?: string;
	messageMappings?: ICliqErrorMessageMapping[];
}

export function validateTableName(
	context: IExecuteFunctions,
	tableName: string,
	itemIndex: number,
): string {
	const sanitized = tableName?.trim();

	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Database Name is required', { itemIndex });
	}

	if (sanitized.length > 200) {
		throw new NodeOperationError(
			context.getNode(),
			'Database Name is too long. Maximum length is 200 characters.',
			{ itemIndex },
		);
	}

	if (sanitized.includes('/')) {
		throw new NodeOperationError(context.getNode(), 'Database Name cannot include "/" characters', {
			itemIndex,
		});
	}

	return sanitized;
}

export function validateRecordId(
	context: IExecuteFunctions,
	recordId: string,
	itemIndex: number,
): string {
	const sanitized = recordId?.trim();

	if (!sanitized) {
		throw new NodeOperationError(context.getNode(), 'Record ID is required', { itemIndex });
	}

	if (!recordIdPattern.test(sanitized)) {
		throw new NodeOperationError(context.getNode(), 'Invalid Record ID format', { itemIndex });
	}

	return sanitized;
}

function ensureSafeObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): void {
	if (typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	for (const key of Object.keys(value as IDataObject)) {
		if (blockedObjectKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{ itemIndex },
			);
		}

		const child = (value as IDataObject)[key];
		if (!child || typeof child !== 'object') {
			continue;
		}

		if (Array.isArray(child)) {
			for (let idx = 0; idx < child.length; idx++) {
				const arrayValue = child[idx];
				if (arrayValue && typeof arrayValue === 'object') {
					ensureSafeObject(context, arrayValue, itemIndex, `${path}.${key}[${idx}]`);
				}
			}
			continue;
		}

		ensureSafeObject(context, child, itemIndex, `${path}.${key}`);
	}
}

export function validateJsonObject(
	context: IExecuteFunctions,
	value: IDataObject,
	itemIndex: number,
	path: string,
	options: { allowEmpty?: boolean } = {},
): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	ensureSafeObject(context, value, itemIndex, path);

	if (!options.allowEmpty && Object.keys(value).length === 0) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	return value;
}

export function parseJsonObjectInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	options: { allowEmpty?: boolean } = {},
): IDataObject {
	if (value === null || value === undefined) {
		throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
			itemIndex,
		});
	}

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
				itemIndex,
			});
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a valid JSON object when provided as text`,
				{ itemIndex },
			);
		}

		return validateJsonObject(context, parsed as IDataObject, itemIndex, path, options);
	}

	return validateJsonObject(context, value as IDataObject, itemIndex, path, options);
}

export function parseRecordValuesFromResourceMapper(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	sourceItemJson?: IDataObject,
): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
	}

	const mapperValue = value as ResourceMapperValue;
	if (mapperValue.mappingMode === 'autoMapInputData') {
		if (!sourceItemJson || typeof sourceItemJson !== 'object' || Array.isArray(sourceItemJson)) {
			throw new NodeOperationError(
				context.getNode(),
				'Auto mapping requires an input item JSON object',
				{
					itemIndex,
				},
			);
		}

		const schema = Array.isArray(mapperValue.schema) ? mapperValue.schema : [];
		const mapped: IDataObject = {};

		for (const field of schema) {
			const fieldId = typeof field?.id === 'string' ? field.id : '';
			if (!fieldId) {
				continue;
			}

			const fieldValue = sourceItemJson[fieldId];
			if (fieldValue !== undefined) {
				mapped[fieldId] = fieldValue;
			}
		}

		if (Object.keys(mapped).length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				'Auto mapping found no matching input fields for this database schema',
				{ itemIndex },
			);
		}

		return validateJsonObject(context, mapped, itemIndex, path);
	}

	if (
		!mapperValue.value ||
		typeof mapperValue.value !== 'object' ||
		Array.isArray(mapperValue.value)
	) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must include at least one mapped field`,
			{
				itemIndex,
			},
		);
	}

	return validateJsonObject(context, mapperValue.value as IDataObject, itemIndex, path);
}

export function validateDatabaseInputMode(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldLabel = 'Input Mode',
): 'structured' | 'raw' {
	if (typeof value !== 'string' || !databaseInputModeValues.has(value)) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} must be either "structured" or "raw"`,
			{ itemIndex },
		);
	}

	return value as 'structured' | 'raw';
}

function validateRecordFieldName(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
	}

	const fieldName = value.trim();
	if (!fieldNamePattern.test(fieldName)) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} has an invalid format. Use letters, numbers, and underscores, and start with a letter.`,
			{ itemIndex },
		);
	}

	return fieldName;
}

function resolveRecordFieldName(
	context: IExecuteFunctions,
	recordField: IDataObject,
	itemIndex: number,
	fieldIndex: number,
): { fieldName: string; inferredValueType?: string } {
	const fieldNameMode =
		typeof recordField.fieldNameMode === 'string' ? recordField.fieldNameMode : 'manual';

	if (fieldNameMode === 'fromList') {
		const rawSelection = String(recordField.nameFromList ?? '').trim();
		const [candidateName, candidateType] = rawSelection.split(':');
		const fieldName = validateRecordFieldName(
			context,
			candidateName,
			itemIndex,
			`Record Fields.field[${fieldIndex}].nameFromList`,
		);

		if (candidateType && ['string', 'number', 'boolean', 'null', 'json'].includes(candidateType)) {
			return { fieldName, inferredValueType: candidateType };
		}

		return { fieldName };
	}

	return {
		fieldName: validateRecordFieldName(
			context,
			recordField.name,
			itemIndex,
			`Record Fields.field[${fieldIndex}].name`,
		),
	};
}

export function buildRecordValuesFromCollection(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): IDataObject {
	const recordFields = (value as IDataObject)?.field;
	if (!Array.isArray(recordFields) || recordFields.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'Record Fields must contain at least one field',
			{ itemIndex },
		);
	}

	const recordValues: IDataObject = {};

	for (let fieldIndex = 0; fieldIndex < recordFields.length; fieldIndex++) {
		const recordField = recordFields[fieldIndex];
		if (!recordField || typeof recordField !== 'object' || Array.isArray(recordField)) {
			throw new NodeOperationError(
				context.getNode(),
				`Record Fields.field[${fieldIndex}] must be a JSON object`,
				{ itemIndex },
			);
		}

		const { fieldName, inferredValueType } = resolveRecordFieldName(
			context,
			recordField as IDataObject,
			itemIndex,
			fieldIndex,
		);

		recordValues[fieldName] = resolveRecordFieldValue(
			context,
			recordField as IDataObject,
			itemIndex,
			fieldIndex,
			inferredValueType,
		) as IDataObject[string];
	}

	return validateJsonObject(context, recordValues, itemIndex, 'Record Values');
}

function resolveRecordFieldValue(
	context: IExecuteFunctions,
	recordField: IDataObject,
	itemIndex: number,
	fieldIndex: number,
	inferredValueType?: string,
): unknown {
	type RecordFieldValueType = 'string' | 'number' | 'boolean' | 'null' | 'json';
	const configuredValueTypeRaw =
		typeof recordField.valueType === 'string' ? recordField.valueType : '';
	const configuredValueType: RecordFieldValueType = [
		'string',
		'number',
		'boolean',
		'null',
		'json',
	].includes(configuredValueTypeRaw)
		? (configuredValueTypeRaw as RecordFieldValueType)
		: 'string';
	const useInferredValueType = Boolean(recordField.useInferredValueType);
	const valueType: RecordFieldValueType =
		useInferredValueType && inferredValueType
			? (inferredValueType as RecordFieldValueType)
			: configuredValueType;
	const pathPrefix = `Record Fields.field[${fieldIndex}]`;

	switch (valueType) {
		case 'string':
			return String(recordField.stringValue ?? '');
		case 'number': {
			const raw = Number(recordField.numberValue);
			if (!Number.isFinite(raw)) {
				throw new NodeOperationError(
					context.getNode(),
					`${pathPrefix}.numberValue must be a valid number`,
					{ itemIndex },
				);
			}
			return raw;
		}
		case 'boolean':
			return Boolean(recordField.booleanValue);
		case 'null':
			return null;
		case 'json':
			return parseJsonObjectInput(
				context,
				recordField.jsonValue as unknown,
				itemIndex,
				`${pathPrefix}.jsonValue`,
				{ allowEmpty: true },
			);
	}
}

export function validateQueryParameters(
	context: IExecuteFunctions,
	value: IDataObject,
	itemIndex: number,
): Record<string, string | number> {
	const sanitized = validateJsonObject(context, value, itemIndex, 'Query Parameters', {
		allowEmpty: true,
	});

	const query: Record<string, string | number> = {};

	for (const [key, raw] of Object.entries(sanitized)) {
		if (raw === undefined || raw === null) {
			continue;
		}

		if (!databaseListQueryParameterKeys.includes(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsupported query parameter "${key}". Supported keys: ${databaseListQueryParameterKeys.join(', ')}`,
				{ itemIndex },
			);
		}

		switch (key) {
			case 'criteria':
			case 'start_token': {
				if (typeof raw !== 'string') {
					throw new NodeOperationError(
						context.getNode(),
						`Query parameter "${key}" must be a string`,
						{ itemIndex },
					);
				}

				const trimmed = raw.trim();
				if (trimmed.length > 0) {
					query[key] = trimmed;
				}
				break;
			}
			case 'order_by': {
				if (typeof raw !== 'string') {
					throw new NodeOperationError(
						context.getNode(),
						'Query parameter "order_by" must be a string',
						{ itemIndex },
					);
				}

				const trimmed = raw.trim();
				if (!trimmed) {
					break;
				}
				if (!/^(\+|-)[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
					throw new NodeOperationError(
						context.getNode(),
						'Order By must be in the format +column_name or -column_name',
						{ itemIndex },
					);
				}
				query[key] = trimmed;
				break;
			}
			case 'from_index': {
				const numericValue =
					typeof raw === 'number'
						? raw
						: typeof raw === 'string' && raw.trim()
							? Number(raw.trim())
							: NaN;

				if (!Number.isInteger(numericValue) || numericValue < 0) {
					throw new NodeOperationError(
						context.getNode(),
						'From Index must be a whole number greater than or equal to 0',
						{ itemIndex },
					);
				}

				query[key] = numericValue;
				break;
			}
			case 'limit': {
				const numericValue =
					typeof raw === 'number'
						? raw
						: typeof raw === 'string' && raw.trim()
							? Number(raw.trim())
							: NaN;

				if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 100) {
					throw new NodeOperationError(
						context.getNode(),
						'Limit must be a whole number between 1 and 100',
						{ itemIndex },
					);
				}

				query[key] = numericValue;
				break;
			}
		}
	}

	return query;
}

export function isDatabaseAiErrorModeEnabled(
	context: IExecuteFunctions,
	itemIndex: number,
): boolean {
	let rawFromParameter: unknown;
	try {
		rawFromParameter = context.getNodeParameter('enableAiErrorMode', itemIndex, false);
	} catch {
		rawFromParameter = undefined;
	}
	if (parseBooleanLikeTrue(rawFromParameter)) {
		return true;
	}

	try {
		if (typeof context.getNode !== 'function') {
			return false;
		}
		const node = context.getNode() as { parameters?: IDataObject };
		const parameters = node?.parameters;
		if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
			return false;
		}
		return parseBooleanLikeTrue(parameters.enableAiErrorMode);
	} catch {
		return false;
	}
}

export function pushDatabaseRecoverableError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	operation: string,
	error: unknown,
	options: IDatabaseRecoverableErrorOptions = {},
): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	const aiErrorModeEnabled = isDatabaseAiErrorModeEnabled(context, itemIndex);
	if (!continueOnFailEnabled && !aiErrorModeEnabled) {
		return false;
	}

	const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
	if (Array.isArray(scopePayload)) {
		// Ignore invalid array scope payloads and fall through to the generic payload.
	} else if (scopePayload && typeof scopePayload === 'object') {
		const executionData = context.helpers.constructExecutionMetaData(
			[{ json: { ...(scopePayload as IDataObject) } }],
			{ itemData: { item: itemIndex } },
		);
		returnData.push(...executionData);
		return true;
	}

	const errorPayload = buildCliqRecoverableErrorPayload(
		error,
		{
			resource: 'database',
			operation,
		},
		{
			contextFields: options.contextFields,
			fallbackMessage: options.fallbackMessage,
			messageMappings: options.messageMappings,
		},
	);

	const executionData = context.helpers.constructExecutionMetaData([{ json: errorPayload }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
	return true;
}

export function resolveDatabaseEnhancedOutput(
	context: IExecuteFunctions,
	itemIndex: number,
	response: unknown,
): {
	includeEnhancedOutput: boolean;
	rawResponse: IDataObject;
	responseJson: IDataObject;
} {
	const includeEnhancedOutput = Boolean(
		context.getNodeParameter('includeEnhancedOutput', itemIndex, true),
	);
	const rawResponse = coerceApiResponseToObject(response);

	return {
		includeEnhancedOutput,
		rawResponse,
		responseJson: rawResponse,
	};
}
