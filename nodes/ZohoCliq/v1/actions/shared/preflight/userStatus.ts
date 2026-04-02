import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { asDataObject } from '../../../helpers/data';
import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { runPreflightGate } from './gate';
import { getFirstString } from './utils';

export const userStatusListLookupScopes =
	listAcceptedScopesForOperation('userStatus', 'list') ?? [];

export const USER_STATUS_NOT_FOUND_ERROR_CODE = 'STATUS_NOT_FOUND';
export const USER_STATUS_NOT_FOUND_MESSAGE =
	"Status not found. The status_id provided does not exist in the authenticated user's saved custom statuses.";
export const USER_STATUS_NOT_FOUND_HINT =
	'Use Retrieve All Statuses to retrieve a valid status_id before retrying.';

const USER_STATUS_PREFLIGHT_SCAN_FAILED_MESSAGE =
	'The user status preflight failed before Zoho Cliq could scan the saved statuses list.';
const USER_STATUS_PREFLIGHT_RESPONSE_ERROR_MESSAGE =
	'The user status preflight did not return a statuses collection that could be verified.';
const userStatusCatalogResponseCache = new WeakMap<IExecuteFunctions, Promise<unknown>>();

function normalizeUserStatusIdentifier(identifier: unknown): string {
	return getFirstString(identifier) ?? String(identifier ?? '').trim();
}

async function getCachedUserStatusCatalogResponse(context: IExecuteFunctions): Promise<unknown> {
	let cachedResponse = userStatusCatalogResponseCache.get(context);
	if (!cachedResponse) {
		cachedResponse = zohoCliqApiRequest.call(context, 'GET', '/api/v2/statuses').catch((error) => {
			userStatusCatalogResponseCache.delete(context);
			throw error;
		});
		userStatusCatalogResponseCache.set(context, cachedResponse);
	}

	return await cachedResponse;
}

export function invalidateUserStatusCatalogCache(context: IExecuteFunctions): void {
	userStatusCatalogResponseCache.delete(context);
}

function extractUserStatusEntries(response: unknown): IDataObject[] | undefined {
	const root = asDataObject(response);
	if (!root) {
		return undefined;
	}

	const nestedData = asDataObject(root.data);
	const candidates = [
		Array.isArray(root.data) ? root.data : undefined,
		root.statuses,
		root.list,
		nestedData?.statuses,
		nestedData?.list,
	];

	for (const candidate of candidates) {
		if (!Array.isArray(candidate)) {
			continue;
		}

		if (candidate.length === 0) {
			return [];
		}

		const filteredEntries = candidate.filter(
			(entry): entry is IDataObject =>
				Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
		);
		if (filteredEntries.length > 0) {
			return filteredEntries;
		}
	}

	return undefined;
}

function extractUserStatusIdentifiers(status: IDataObject): string[] {
	return Array.from(
		new Set(
			[
				normalizeUserStatusIdentifier(status.id),
				normalizeUserStatusIdentifier(status.status_id),
				normalizeUserStatusIdentifier(status.statusId),
			].filter((value): value is string => Boolean(value)),
		),
	);
}

export async function lookupUserStatusExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	const normalizedIdentifier = normalizeUserStatusIdentifier(config.identifier);
	let response: unknown;
	try {
		response = await getCachedUserStatusCatalogResponse(context);
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeOperationError(context.getNode(), USER_STATUS_PREFLIGHT_SCAN_FAILED_MESSAGE, {
			itemIndex,
		});
	}

	const statuses = extractUserStatusEntries(response);
	if (!statuses) {
		throw new NodeOperationError(context.getNode(), USER_STATUS_PREFLIGHT_RESPONSE_ERROR_MESSAGE, {
			itemIndex,
		});
	}

	for (const status of statuses) {
		if (extractUserStatusIdentifiers(status).includes(normalizedIdentifier)) {
			return {
				status: 'confirmed_exists',
				entity: status,
			};
		}
	}

	return {
		status: 'confirmed_missing',
		evidence: `Retrieve All Statuses did not return status_id "${config.identifier}" after exhaustively scanning the authenticated user's saved reusable statuses.`,
	};
}

export async function runUserStatusLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	statusId: string,
): Promise<PreflightGateResult<IDataObject>> {
	const normalizedStatusId = normalizeUserStatusIdentifier(statusId);

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'userStatus',
			identifier: normalizedStatusId,
			label: 'Status ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: userStatusListLookupScopes,
		},
		strategy: async () =>
			await lookupUserStatusExhaustively(context, itemIndex, {
				identifier: normalizedStatusId,
			}),
		errors: {
			missing: {
				code: USER_STATUS_NOT_FOUND_ERROR_CODE,
				message: USER_STATUS_NOT_FOUND_MESSAGE,
				hint: USER_STATUS_NOT_FOUND_HINT,
			},
		},
	});
}
