/**
 * Simplify Output system — public API.
 */

export type { ISimplifyConfig, IResolvedSimplifyMode, SimplifyMode } from './types';
export type { SimplifyConfigKey } from './configs';
export { getSimplifyConfig } from './configs';
export { applySimplifyMode, applySimplifyModeToList, resolveSimplifyMode } from './simplify';
export {
	simplifyParameter,
	simplifyModeParameter,
	buildSelectedFieldsParameter,
	getSimplifyParameters,
} from './parameters';
