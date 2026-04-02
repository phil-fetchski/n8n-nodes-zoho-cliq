import type { IExecuteFunctions } from 'n8n-workflow';

import type { IPreflightGateConfig, PreflightGateResult } from './contracts';
import { buildPreflightMissingError } from './errors';
import { resolvePreflightActivation } from './scopePolicy';

export async function runPreflightGate<TEntity>(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	config: IPreflightGateConfig<TEntity>,
): Promise<PreflightGateResult<TEntity>> {
	const activation = resolvePreflightActivation(
		context,
		itemIndex,
		grantedScopes,
		config.shouldRun,
	);

	if (activation.status === 'skipped') {
		return {
			status: 'skipped',
			reason: activation.reason ?? 'scope_unavailable',
		};
	}

	const outcome = await config.strategy();
	if (outcome.status === 'confirmed_exists') {
		return {
			status: 'validated',
			entity: outcome.entity,
		};
	}

	throw buildPreflightMissingError({
		context,
		itemIndex,
		subject: config.subject,
		missing: config.errors.missing,
		evidence: outcome.evidence,
		missingIdentifiers: outcome.missingIdentifiers,
	});
}
