import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { asDataObject } from '../../../helpers/data';
import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type {
	ExhaustiveLookupOutcome,
	IPreflightMissingErrorConfig,
	PreflightGateResult,
} from './contracts';
import { runPreflightGate } from './gate';
import { getFirstString, hasNotFoundSignal } from './utils';

const databaseGetLookupScopes = listAcceptedScopesForOperation('database', 'get') ?? [];
const databaseRecordNotFoundFragments = [
	'record not found',
	'invalid record id',
	'request url is invalid',
];

export const DATABASE_RECORD_LOOKUP_NOT_FOUND_ERROR_CODE = 'DATABASE_RECORD_NOT_FOUND';
export const DATABASE_RECORD_LOOKUP_NOT_FOUND_HINT =
	'Use Get Record or List Records to confirm the database_name and record_id pair before retrying.';

export function extractDatabaseRecordDetailsFromLookupResponse(
	response: unknown,
): IDataObject | undefined {
	const root = asDataObject(response);
	if (!root) {
		return undefined;
	}

	const objectRecord = asDataObject(root.object);
	if (objectRecord) {
		return objectRecord;
	}

	const dataRecord = asDataObject(root.data);
	if (dataRecord) {
		return dataRecord;
	}

	if (getFirstString([root.id, root.record_id, root.recordId])) {
		return root;
	}

	return undefined;
}

function extractDatabaseRecordIdentifiers(details: IDataObject): string[] {
	return Array.from(
		new Set(
			[
				getFirstString(details.id),
				getFirstString(details.record_id),
				getFirstString(details.recordId),
			].filter((value): value is string => Boolean(value)),
		),
	);
}

function isAuthoritativeDatabaseRecordNotFoundError(error: unknown): boolean {
	return hasNotFoundSignal(error, {
		messageFragments: databaseRecordNotFoundFragments,
	});
}

export async function lookupDatabaseRecordExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		tableName: string;
		recordId: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	try {
		const response = await zohoCliqApiRequest.call(
			context,
			'GET',
			`/api/v2/storages/${encodeURIComponent(config.tableName)}/records/${encodeURIComponent(config.recordId)}`,
		);
		const recordResponse = asDataObject(response);
		if (!recordResponse) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Record returned a non-object response for Record ID "${config.recordId}" in Database Name "${config.tableName}".`,
			};
		}

		const details = extractDatabaseRecordDetailsFromLookupResponse(recordResponse);
		if (!details) {
			return {
				status: 'confirmed_exists',
				entity: recordResponse,
			};
		}

		const knownIdentifiers = extractDatabaseRecordIdentifiers(details);
		if (knownIdentifiers.includes(config.recordId)) {
			return {
				status: 'confirmed_exists',
				entity: recordResponse,
			};
		}

		if (!knownIdentifiers.length) {
			return {
				status: 'confirmed_exists',
				entity: recordResponse,
			};
		}

		return {
			status: 'confirmed_missing',
			evidence: `Get Record returned a response, but it did not identify "${config.recordId}" as one of the canonical record identifiers in Database Name "${config.tableName}".`,
		};
	} catch (error) {
		if (isAuthoritativeDatabaseRecordNotFoundError(error)) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Record returned an authoritative not-found response for Record ID "${config.recordId}" in Database Name "${config.tableName}".`,
			};
		}

		throw error;
	}
}

export async function runDatabaseRecordLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	tableName: string,
	recordId: string,
	options: {
		fieldLabel?: string;
		missing?: IPreflightMissingErrorConfig;
	} = {},
): Promise<PreflightGateResult<IDataObject>> {
	const fieldLabel = options.fieldLabel ?? 'Record ID';

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'database',
			identifier: recordId,
			label: fieldLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: databaseGetLookupScopes,
		},
		strategy: async () =>
			await lookupDatabaseRecordExhaustively(context, itemIndex, {
				tableName,
				recordId,
			}),
		errors: {
			missing: options.missing ?? {
				code: DATABASE_RECORD_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: `No database record found for ${fieldLabel} "${recordId}" in Database Name "${tableName}".`,
				hint: DATABASE_RECORD_LOOKUP_NOT_FOUND_HINT,
			},
		},
	});
}
