/**
 * Type definitions for the Simplify Output system.
 */

export type SimplifyMode = 'simplified' | 'raw' | 'selectedFields';

/** Configuration for one response shape */
export interface ISimplifyConfig {
	/** Keys to keep in simplified mode (order = output order) */
	simplifiedKeys: string[];

	/** Nested keys to flatten in simplified mode: source dot-path -> output key */
	flattenMap?: Record<string, string>;

	/** The record's primary ID key (always included in selectedFields mode) */
	idKey: string;

	/** All selectable field options for the Selected Fields multiOptions */
	selectableFields: Array<{ name: string; value: string; description?: string }>;
}

/** Resolved simplify parameters from the node */
export interface IResolvedSimplifyMode {
	mode: SimplifyMode;
	selectedFields: string[];
}
