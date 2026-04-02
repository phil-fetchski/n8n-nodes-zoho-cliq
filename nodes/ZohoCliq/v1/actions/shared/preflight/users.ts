import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { asDataObject } from '../../../helpers/data';
import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type {
	ExhaustiveLookupOutcome,
	IPaginatedLookupPage,
	IPreflightMissingErrorConfig,
} from './contracts';
import { isAuthoritativeNotFoundError } from './direct';
import { runPreflightGate } from './gate';
import { runPaginatedLookupExhaustively } from './pagination';

const USER_LIST_PAGE_LIMIT = 100;
export const userListLookupScopes = listAcceptedScopesForOperation('user', 'list') ?? [];
export const directUserLookupScopes = listAcceptedScopesForOperation('user', 'get') ?? [];
export const USER_LOOKUP_NOT_FOUND_ERROR_CODE = 'USER_NOT_FOUND';
export const USER_LOOKUP_NOT_FOUND_HINT =
	'Use List_users_in_Zoho_Cliq to discover valid user IDs, email addresses, or ZUIDs before retrying.';

function getFirstString(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}

	if (typeof value === 'number' || typeof value === 'bigint') {
		return String(value);
	}

	return undefined;
}

export function normalizeCanonicalUserIdentifier(identifier: string): string {
	return identifier.includes('@') ? identifier.toLowerCase() : identifier;
}

function asUserPage(response: unknown): IPaginatedLookupPage<IDataObject> {
	if (Array.isArray(response)) {
		return {
			items: response.filter(
				(entry): entry is IDataObject =>
					Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
			),
			hasMore: false,
		};
	}

	const root = asDataObject(response);
	if (!root) {
		throw new Error('Zoho Cliq returned a non-object users list response.');
	}

	const nestedData = asDataObject(root.data);
	const candidates = [
		root.users,
		root.list,
		Array.isArray(root.data) ? root.data : undefined,
		nestedData?.users,
		nestedData?.list,
	];

	let items: IDataObject[] | undefined;
	for (const candidate of candidates) {
		if (!Array.isArray(candidate)) {
			continue;
		}

		items = candidate.filter(
			(entry): entry is IDataObject =>
				Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
		);
		break;
	}

	if (!items) {
		throw new Error('Zoho Cliq returned a users list response without a users array.');
	}

	const nextToken =
		getFirstString(root.next_token) ??
		getFirstString(root.nextToken) ??
		getFirstString(nestedData?.next_token) ??
		getFirstString(nestedData?.nextToken);

	const hasMoreCandidates = [
		root.has_more,
		root.hasMore,
		nestedData?.has_more,
		nestedData?.hasMore,
	];
	const hasMore = hasMoreCandidates.find(
		(candidate): candidate is boolean => typeof candidate === 'boolean',
	);

	return {
		items,
		nextToken,
		hasMore,
	};
}

export function extractCanonicalUserIdentifiers(user: IDataObject): string[] {
	return Array.from(
		new Set(
			[user.user_id, user.id, user.zuid, user.email_id, user.email]
				.map((value) => getFirstString(value))
				.map((value) => (value ? normalizeCanonicalUserIdentifier(value) : value))
				.filter((value): value is string => Boolean(value)),
		),
	);
}

function extractDirectUserRecord(response: unknown): IDataObject | undefined {
	const root = asDataObject(response);
	if (!root) {
		return undefined;
	}

	const nestedData = asDataObject(root.data);
	const rootIdentifiers = extractCanonicalUserIdentifiers(root);
	if (rootIdentifiers.length > 0) {
		return root;
	}

	if (nestedData && extractCanonicalUserIdentifiers(nestedData).length > 0) {
		return nestedData;
	}

	return nestedData ?? root;
}

async function scanUserRosterExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	unresolvedIdentifiers: Set<string>,
	status?: 'inactive',
): Promise<void> {
	try {
		await runPaginatedLookupExhaustively(context, itemIndex, {
			entityLabel: status === 'inactive' ? 'inactive user roster' : 'user roster',
			pageSize: USER_LIST_PAGE_LIMIT,
			requestPage: async (nextToken?: string) =>
				await zohoCliqApiRequest.call(
					context,
					'GET',
					'/api/v2/users',
					{},
					{
						limit: USER_LIST_PAGE_LIMIT,
						fields: 'display_name',
						...(status ? { status } : {}),
						...(nextToken ? { next_token: nextToken } : {}),
					},
				),
			extractPage: (response) => asUserPage(response),
			onItems: (items) => {
				for (const user of items) {
					for (const identifier of extractCanonicalUserIdentifiers(user)) {
						unresolvedIdentifiers.delete(identifier);
					}
				}
			},
			shouldStop: () => unresolvedIdentifiers.size === 0,
		});
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeOperationError(
			context.getNode(),
			`The ${status === 'inactive' ? 'inactive ' : ''}user roster preflight failed before Zoho Cliq could be scanned exhaustively.`,
			{ itemIndex },
		);
	}
}

export async function lookupUsersExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifiers: string[];
		includeInactiveUsers?: boolean;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	const normalizedIdentifiers = config.identifiers.map((identifier) =>
		normalizeCanonicalUserIdentifier(identifier),
	);
	const unresolvedIdentifiers = new Set(normalizedIdentifiers);
	if (unresolvedIdentifiers.size === 0) {
		return { status: 'confirmed_exists' };
	}

	await scanUserRosterExhaustively(context, itemIndex, unresolvedIdentifiers);
	if (unresolvedIdentifiers.size === 0) {
		return { status: 'confirmed_exists' };
	}

	if (config.includeInactiveUsers === true) {
		await scanUserRosterExhaustively(context, itemIndex, unresolvedIdentifiers, 'inactive');
		if (unresolvedIdentifiers.size === 0) {
			return { status: 'confirmed_exists' };
		}
	}

	const missingIdentifiers = normalizedIdentifiers.filter((identifier) =>
		unresolvedIdentifiers.has(identifier),
	);

	return {
		status: 'confirmed_missing',
		evidence: `The requested identifiers were not present after exhaustively scanning the configured user rosters. Missing identifiers: ${JSON.stringify(
			missingIdentifiers,
		)}.`,
		missingIdentifiers,
	};
}

export async function lookupDirectUserExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	const normalizedIdentifier = normalizeCanonicalUserIdentifier(config.identifier);

	try {
		const response = await zohoCliqApiRequest.call(
			context,
			'GET',
			`/api/v2/users/${encodeURIComponent(normalizedIdentifier)}`,
			{},
		);
		const user = extractDirectUserRecord(response);
		if (!user) {
			throw new NodeOperationError(
				context.getNode(),
				'The Get User preflight did not return an object response.',
				{ itemIndex },
			);
		}

		if (extractCanonicalUserIdentifiers(user).includes(normalizedIdentifier)) {
			return { status: 'confirmed_exists', entity: user };
		}

		return {
			status: 'confirmed_missing',
			evidence: `Get User returned a response, but it did not identify "${normalizedIdentifier}" as one of the canonical user identifiers.`,
		};
	} catch (error) {
		if (
			isAuthoritativeNotFoundError(error, [
				'request url is invalid',
				'no user found',
				'user not found',
			])
		) {
			return {
				status: 'confirmed_missing',
				evidence: `Get User returned an authoritative not-found response for "${normalizedIdentifier}".`,
			};
		}

		throw error;
	}
}

export async function runUserIdentifiersPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	config: {
		identifiers: string[];
		subjectLabel: string;
		includeInactiveUsers?: boolean;
		acceptedScopes: string[];
		missing: IPreflightMissingErrorConfig;
	},
): Promise<void> {
	const normalizedIdentifiers = Array.isArray(config.identifiers)
		? config.identifiers.filter(
				(identifier): identifier is string =>
					typeof identifier === 'string' && identifier.length > 0,
			)
		: [];
	if (!normalizedIdentifiers.length) {
		return;
	}

	await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'user',
			identifier: normalizedIdentifiers.join(','),
			label: config.subjectLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: config.acceptedScopes,
		},
		strategy: async () =>
			await lookupUsersExhaustively(context, itemIndex, {
				identifiers: normalizedIdentifiers,
				includeInactiveUsers: config.includeInactiveUsers ?? false,
			}),
		errors: {
			missing: config.missing,
		},
	});
}

export async function runDirectUserLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	identifier: string,
	config: {
		subjectLabel?: string;
		acceptedScopes?: string[];
		missing?: IPreflightMissingErrorConfig;
	} = {},
) {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'user',
			identifier,
			label: config.subjectLabel ?? 'User',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: config.acceptedScopes ?? directUserLookupScopes,
		},
		strategy: async () =>
			await lookupDirectUserExhaustively(context, itemIndex, {
				identifier,
			}),
		errors: {
			missing: config.missing ?? {
				code: USER_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: `No Zoho Cliq user found for User ID / Email / ZUID "${identifier}". Verify the user exists before retrying.`,
				hint: USER_LOOKUP_NOT_FOUND_HINT,
			},
		},
	});
}
