/**
 * Core simplify/filter/flatten logic for the Simplify Output system.
 */

import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import type { IResolvedSimplifyMode, ISimplifyConfig, SimplifyMode } from './types';

/**
 * Reads the `simplify` (boolean toggle) and `simplifyMode` / `simplifyFields`
 * parameters from the node context and resolves the effective SimplifyMode.
 *
 * - simplify=false → mode='raw', selectedFields=[]
 * - simplify=true  → reads simplifyMode ('simplified' | 'raw' | 'selectedFields')
 *                     and simplifyFields when mode is 'selectedFields'
 */
export function resolveSimplifyMode(
	context: IExecuteFunctions,
	itemIndex: number,
): IResolvedSimplifyMode {
	const simplifyEnabled = context.getNodeParameter('simplify', itemIndex, true) as boolean;

	if (!simplifyEnabled) {
		return { mode: 'raw', selectedFields: [] };
	}

	const mode = context.getNodeParameter(
		'simplifyMode',
		itemIndex,
		'simplified',
	) as string as SimplifyMode;

	let selectedFields: string[] = [];
	if (mode === 'selectedFields') {
		const raw = context.getNodeParameter('simplifyFields', itemIndex, []) as string[] | string;
		if (Array.isArray(raw)) {
			selectedFields = raw;
		} else {
			const trimmed = String(raw).trim();
			// Accept stringified JSON arrays: '["id","email_id"]'
			if (trimmed.startsWith('[')) {
				try {
					const parsed = JSON.parse(trimmed) as string[];
					selectedFields = parsed.map((v) => String(v).trim()).filter((v) => v.length > 0);
				} catch {
					selectedFields = [];
				}
			} else {
				// Accept CSV: 'id, email_id, display_name'
				selectedFields = trimmed
					.split(',')
					.map((f) => f.trim())
					.filter((f) => f.length > 0);
			}
		}
	}

	return { mode, selectedFields };
}

/**
 * Resolves a nested dot-path value from an object.
 * E.g., getNestedValue(obj, 'department.name') returns obj.department.name
 */
function getNestedValue(obj: IDataObject, dotPath: string): unknown {
	const parts = dotPath.split('.');
	let current: unknown = obj;
	for (const part of parts) {
		if (current === null || current === undefined || typeof current !== 'object') {
			return undefined;
		}
		current = (current as IDataObject)[part];
	}
	return current;
}

/**
 * Applies simplify mode to a single response object.
 *
 * When `unwrapKey` is provided (e.g., `'data'`), simplified and selectedFields
 * modes operate on the nested object at that key, while raw mode returns the
 * full wrapper as-is. This handles APIs that wrap single objects in a `data` key.
 */
export function applySimplifyMode(
	response: IDataObject,
	mode: SimplifyMode,
	config: ISimplifyConfig,
	selectedFields?: string[],
	unwrapKey?: string,
): IDataObject {
	if (mode === 'raw') {
		return response;
	}

	// Unwrap single-object wrappers (e.g., { data: { id: "1", ... } } → { id: "1", ... })
	let target = response;
	if (unwrapKey) {
		const nested = response[unwrapKey];
		if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
			target = nested as IDataObject;
		}
	}

	if (mode === 'selectedFields') {
		const fields = selectedFields ?? [];
		const result: IDataObject = {};

		// Build allow-list from config's selectableFields
		const allowedFields = new Set(config.selectableFields.map((f) => f.value));

		// Always include the ID key
		if (config.idKey && target[config.idKey] !== undefined) {
			result[config.idKey] = target[config.idKey];
		}

		for (const field of fields) {
			if (allowedFields.has(field) && target[field] !== undefined) {
				result[field] = target[field];
			}
		}

		return result;
	}

	// mode === 'simplified'
	const result: IDataObject = {};

	// Pick simplified keys
	for (const key of config.simplifiedKeys) {
		if (target[key] !== undefined) {
			result[key] = target[key];
		}
	}

	// Flatten nested paths
	if (config.flattenMap) {
		for (const [dotPath, outputKey] of Object.entries(config.flattenMap)) {
			const value = getNestedValue(target, dotPath);
			if (value !== undefined) {
				result[outputKey] = value as IDataObject[string];
			}
		}
	}

	return result;
}

/** Well-known pagination wrapper keys. */
const PAGINATION_KEYS = ['next_token', 'has_more', 'sync_token'];

/**
 * Applies simplify mode to a list response.
 *
 * - **Raw mode**: Returns the full API response wrapper as a single item,
 *   consistent with all operations that do not have Simplify.
 * - **Simplified / Selected Fields**: Extracts items from the arrayKey,
 *   simplifies each individually, and prepends a dedicated `_pagination`
 *   item as the first element when pagination keys are present on the wrapper.
 */
export function applySimplifyModeToList(
	response: IDataObject,
	arrayKey: string,
	mode: SimplifyMode,
	config: ISimplifyConfig,
	selectedFields?: string[],
): IDataObject[] {
	// Raw mode: return the full API response as a single item
	if (mode === 'raw') {
		return [response];
	}

	const items = response[arrayKey];
	if (!Array.isArray(items)) {
		return [applySimplifyMode(response, mode, config, selectedFields)];
	}

	const simplified = items.map((item) =>
		applySimplifyMode(item as IDataObject, mode, config, selectedFields),
	);

	// Collect pagination keys into a dedicated _pagination item (first element)
	const paginationData: IDataObject = {};
	for (const key of PAGINATION_KEYS) {
		if (response[key] !== undefined) {
			paginationData[key] = response[key];
		}
	}
	if (Object.keys(paginationData).length > 0) {
		return [{ _pagination: paginationData }, ...simplified];
	}

	return simplified;
}
