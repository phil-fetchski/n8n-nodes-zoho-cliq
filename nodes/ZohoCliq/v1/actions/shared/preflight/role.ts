import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { asDataObject } from '../../../helpers/data';
import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { runPreflightGate } from './gate';
import { getFirstString } from './utils';
import { runUserIdentifiersPreflightGate, userListLookupScopes } from './users';

const roleListLookupScopes = listAcceptedScopesForOperation('role', 'list') ?? [];

export const ROLE_NOT_FOUND_MESSAGE =
	'Role not found. The role ID provided does not exist in this organization.';
export const ROLE_NOT_FOUND_HINT = 'Use List Roles to retrieve valid role IDs and try again.';
export const CLONE_ROLE_NOT_FOUND_MESSAGE =
	'Clone source role not found. The clone_role_id provided does not exist.';
export const CLONE_ROLE_NOT_FOUND_HINT =
	'Use List Roles to retrieve a valid role ID to clone from.';
const USER_IDS_NOT_FOUND_MESSAGE =
	'One or more user IDs were not found. The provided user IDs do not exist in this organization.';
const USER_IDS_NOT_FOUND_HINT =
	'Use Get User or List Users to retrieve valid user IDs and try again.';

function extractRolesFromListResponse(response: unknown): IDataObject[] {
	if (Array.isArray(response)) {
		return response.filter(
			(entry): entry is IDataObject =>
				Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
		);
	}

	const root = asDataObject(response);
	if (!root) {
		throw new Error('Zoho Cliq returned a non-object role roster response.');
	}

	const nestedData = asDataObject(root.data);
	const candidateLists = [
		root.profiles,
		root.roles,
		root.list,
		Array.isArray(root.data) ? root.data : undefined,
		nestedData?.profiles,
		nestedData?.roles,
		nestedData?.list,
	];

	for (const candidate of candidateLists) {
		if (!Array.isArray(candidate)) {
			continue;
		}

		return candidate.filter(
			(entry): entry is IDataObject =>
				Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
		);
	}

	throw new Error('Zoho Cliq returned a role roster response without a profiles array.');
}

function extractRoleIdentity(role: IDataObject): string | undefined {
	return (
		getFirstString(role.id) ?? getFirstString(role.profile_id) ?? getFirstString(role.profileId)
	);
}

export async function lookupRoleExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	try {
		const listResponse = await zohoCliqApiRequest.call(context, 'GET', '/api/v2/profiles', {}, {});
		const roles = extractRolesFromListResponse(listResponse);
		const matchedRole = roles.find((role) => extractRoleIdentity(role) === config.identifier);

		if (matchedRole) {
			return {
				status: 'confirmed_exists',
				entity: matchedRole,
			};
		}

		return {
			status: 'confirmed_missing',
			evidence: `The requested role ID "${config.identifier}" was not present in the role roster.`,
		};
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeOperationError(
			context.getNode(),
			'The role roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			{ itemIndex },
		);
	}
}

export async function runRoleLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	roleId: string,
	options: {
		label?: string;
		message?: string;
		hint?: string;
	} = {},
): Promise<PreflightGateResult<IDataObject>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'role',
			identifier: roleId,
			label: options.label ?? 'Role ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: roleListLookupScopes,
		},
		strategy: async () =>
			await lookupRoleExhaustively(context, itemIndex, {
				identifier: roleId,
			}),
		errors: {
			missing: {
				code: 'ROLE_NOT_FOUND',
				message: options.message ?? ROLE_NOT_FOUND_MESSAGE,
				hint: options.hint ?? ROLE_NOT_FOUND_HINT,
			},
		},
	});
}

export async function runRoleUsersPreflightGate(
	context: IExecuteFunctions,
	userIds: string[],
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	const normalizedUserIds = Array.isArray(userIds)
		? userIds.filter((userId): userId is string => typeof userId === 'string' && userId.length > 0)
		: [];

	await runUserIdentifiersPreflightGate(context, itemIndex, grantedScopes, {
		identifiers: normalizedUserIds,
		subjectLabel: 'Role User IDs',
		acceptedScopes: userListLookupScopes,
		missing: {
			code: 'USER_IDS_NOT_FOUND',
			message: ({ missingIdentifiers }) =>
				`${USER_IDS_NOT_FOUND_MESSAGE} Missing user IDs: ${JSON.stringify(missingIdentifiers)}.`,
			hint: USER_IDS_NOT_FOUND_HINT,
		},
	});
}
