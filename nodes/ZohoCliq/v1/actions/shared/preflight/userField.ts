import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { isAuthoritativeNotFoundError } from './direct';
import { runPreflightGate } from './gate';
import { resolvePreflightActivation } from './scopePolicy';
import { copyLookupErrorMetadata } from './utils';

const userFieldGetLookupScopes = listAcceptedScopesForOperation('userFields', 'get') ?? [];
const userFieldListLookupScopes = listAcceptedScopesForOperation('userFields', 'list') ?? [];
const userFieldNotFoundMessageFragments = [
	'request url is invalid',
	'our processor went cold',
	'try again in a few minutes to view all user fields',
	'user field not found',
	'no user field found',
];

export const USER_FIELD_NOT_FOUND_ERROR_CODE = 'USER_FIELD_NOT_FOUND';
export const USER_FIELD_NOT_FOUND_MESSAGE =
	'User field not found. The field_id provided does not exist in Zoho Cliq.';
export const USER_FIELD_NOT_FOUND_HINT =
	'Use Retrieve All User Fields to retrieve a valid field_id before retrying.';
export const USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE = 'FIELD_MAX_CUSTOM_FIELD_LIMIT_REACHED';
export const USER_FIELD_CUSTOM_LIMIT_REACHED_MESSAGE =
	'The maximum of 10 custom user fields has been reached. Delete an existing custom field before creating a new one.';
export const USER_FIELD_CUSTOM_LIMIT_REACHED_HINT =
	'Zoho Cliq supports up to 10 custom user fields per organization.';

export function isAuthoritativeUserFieldLookupNotFoundError(error: unknown): boolean {
	return isAuthoritativeNotFoundError(error, userFieldNotFoundMessageFragments);
}

export async function lookupDirectUserFieldExhaustively(
	context: IExecuteFunctions,
	_itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	try {
		const response = await zohoCliqApiRequest.call(
			context,
			'GET',
			`/api/v2/userfields/${encodeURIComponent(config.identifier)}`,
		);

		return {
			status: 'confirmed_exists',
			entity:
				response && typeof response === 'object' && !Array.isArray(response)
					? (response as IDataObject)
					: undefined,
		};
	} catch (error) {
		if (isAuthoritativeUserFieldLookupNotFoundError(error)) {
			return {
				status: 'confirmed_missing',
				evidence: `Retrieve User Field returned an authoritative invalid-target response for field_id "${config.identifier}".`,
			};
		}

		throw error;
	}
}

export async function runUserFieldLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	fieldId: string,
): Promise<PreflightGateResult<IDataObject>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'userField',
			identifier: fieldId,
			label: 'User Field ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: userFieldGetLookupScopes,
		},
		strategy: async () =>
			await lookupDirectUserFieldExhaustively(context, itemIndex, {
				identifier: fieldId,
			}),
		errors: {
			missing: {
				code: USER_FIELD_NOT_FOUND_ERROR_CODE,
				message: USER_FIELD_NOT_FOUND_MESSAGE,
				hint: USER_FIELD_NOT_FOUND_HINT,
			},
		},
	});
}

function extractUserFieldListEntries(response: unknown): IDataObject[] {
	if (!response || typeof response !== 'object' || Array.isArray(response)) {
		return [];
	}

	const root = response as IDataObject;
	for (const candidate of [root.list, root.userfields, root.data]) {
		if (Array.isArray(candidate)) {
			return candidate.filter(
				(entry): entry is IDataObject =>
					Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
			);
		}
	}

	return [];
}

export async function runUserFieldCreateLimitPreflight(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
): Promise<
	| { status: 'skipped'; reason: 'recoverable_mode_disabled' | 'scope_unavailable' }
	| { status: 'validated'; customFieldCount: number }
> {
	const activation = resolvePreflightActivation(context, itemIndex, grantedScopes, {
		requiresRecoverableMode: true,
		acceptedScopes: userFieldListLookupScopes,
	});

	if (activation.status === 'skipped') {
		return {
			status: 'skipped',
			reason: activation.reason ?? 'scope_unavailable',
		};
	}

	const response = await zohoCliqApiRequest.call(context, 'GET', '/api/v2/userfields');
	const entries = extractUserFieldListEntries(response);
	const customFieldCount = entries.filter((entry) => entry.system_defined === false).length;

	if (customFieldCount >= 10) {
		const error = new NodeOperationError(
			context.getNode(),
			USER_FIELD_CUSTOM_LIMIT_REACHED_MESSAGE,
			{
				itemIndex,
				description: USER_FIELD_CUSTOM_LIMIT_REACHED_HINT,
			},
		);
		(error as NodeOperationError & { code?: string }).code =
			USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE;
		throw error;
	}

	return {
		status: 'validated',
		customFieldCount,
	};
}

export function normalizeUserFieldLookupNotFoundError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
	options?: {
		fieldId?: string;
	},
): NodeOperationError {
	const notFoundError = new NodeOperationError(context.getNode(), USER_FIELD_NOT_FOUND_MESSAGE, {
		itemIndex,
		description: USER_FIELD_NOT_FOUND_HINT,
	});

	(notFoundError as NodeOperationError & { code?: string }).code = USER_FIELD_NOT_FOUND_ERROR_CODE;

	Object.assign(notFoundError as unknown as Record<string, unknown>, {
		zohoCliqInvalidUserFieldId: options?.fieldId,
	});

	copyLookupErrorMetadata(notFoundError, error);
	return notFoundError;
}
