/**
 * Reusable Simplify parameter definitions.
 *
 * The Simplify system uses a two-step UI pattern per n8n UX standards:
 *   1. A boolean toggle (`simplify`) — ON by default, returns simplified output.
 *      When OFF, the full raw API response is returned.
 *   2. A mode selector (`simplifyMode`) — shown only when the toggle is ON.
 *      Offers Simplified (default), Raw, and Selected Fields modes.
 *   3. An Output Fields multi-select (`simplifyFields`) — shown only when
 *      the mode is Selected Fields.
 */

import type { INodeProperties } from 'n8n-workflow';

import type { SimplifyConfigKey } from './configs';
import { getSimplifyConfig } from './configs';

/**
 * The Simplify boolean toggle. When OFF the full raw API response is returned.
 * When ON the Simplify Mode selector appears.
 * No displayOptions — inherits from the operation's description mapping.
 */
export const simplifyParameter: INodeProperties = {
	displayName: 'Simplify',
	name: 'simplify',
	type: 'boolean',
	default: true,
	description: 'Whether to return a simplified version of the response instead of the raw data',
};

/**
 * The Simplify Mode selector. Shown only when `simplify` = true via
 * displayOptions. `getSimplifyParameters()` overrides the displayOptions
 * to also scope by resource and operation.
 */
export const simplifyModeParameter: INodeProperties = {
	displayName: 'Simplify Mode',
	name: 'simplifyMode',
	type: 'options',
	options: [
		{ name: 'Simplified', value: 'simplified' },
		{ name: 'Raw', value: 'raw' },
		{ name: 'Selected Fields', value: 'selectedFields' },
	],
	default: 'simplified',
	description:
		'Simplified and Selected Fields reduce output size and unwrap the response so each record is its own output item, making results more workflow-friendly',
	displayOptions: {
		show: {
			simplify: [true],
		},
	},
};

/**
 * Builds the per-operation Selected Fields multiOptions parameter.
 * The available fields come from the config's selectableFields.
 */
export function buildSelectedFieldsParameter(configKey: SimplifyConfigKey): INodeProperties {
	const config = getSimplifyConfig(configKey);
	return {
		displayName: 'Output Fields',
		name: 'simplifyFields',
		type: 'multiOptions',
		options: config.selectableFields,
		default: [config.idKey],
		description: 'The fields to include in the output. The record ID is always included.',
		displayOptions: {
			show: {
				simplify: [true],
				simplifyMode: ['selectedFields'],
			},
		},
	};
}

/**
 * Returns all three Simplify parameters with fully pre-configured displayOptions.
 * The Simplify Mode and Output Fields parameters include the resource/operation
 * scope so they do not depend on the operation's description mapping to merge
 * show keys.
 */
export function getSimplifyParameters(
	configKey: SimplifyConfigKey,
	resource: string,
	operation: string,
): INodeProperties[] {
	const selectedFieldsParam = buildSelectedFieldsParameter(configKey);
	return [
		{ ...simplifyParameter },
		{
			...simplifyModeParameter,
			displayOptions: {
				show: {
					resource: [resource],
					operation: [operation],
					simplify: [true],
				},
			},
		},
		{
			...selectedFieldsParam,
			displayOptions: {
				show: {
					resource: [resource],
					operation: [operation],
					simplify: [true],
					simplifyMode: ['selectedFields'],
				},
			},
		},
	];
}
