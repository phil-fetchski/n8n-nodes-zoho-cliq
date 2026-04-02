import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { hasRequiredScope } from '../../../../../../credentials/ZohoCliqOAuth2Api.credentials';
import { parseBooleanLikeTrue } from '../../../helpers/utils';

import type { IPreflightActivationResult, IPreflightShouldRunConfig } from './contracts';

function isAiErrorModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
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

export function isRecoverableModeEnabled(context: IExecuteFunctions, itemIndex: number): boolean {
	const continueOnFailEnabled =
		typeof context.continueOnFail === 'function' && context.continueOnFail();
	return continueOnFailEnabled || isAiErrorModeEnabled(context, itemIndex);
}

export function hasAnyAcceptedScope(grantedScopes: string, acceptedScopes: string[]): boolean {
	return acceptedScopes.some((scope) => hasRequiredScope(grantedScopes, scope));
}

export function resolvePreflightActivation(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	config: IPreflightShouldRunConfig,
): IPreflightActivationResult {
	if (config.requiresRecoverableMode && !isRecoverableModeEnabled(context, itemIndex)) {
		return { status: 'skipped', reason: 'recoverable_mode_disabled' };
	}

	if (!hasAnyAcceptedScope(grantedScopes, config.acceptedScopes)) {
		return { status: 'skipped', reason: 'scope_unavailable' };
	}

	return { status: 'active' };
}
