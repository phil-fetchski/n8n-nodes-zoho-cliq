import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { asDataObject } from '../../../helpers/data';
import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { runPreflightGate } from './gate';
import { copyLookupErrorMetadata, getFirstString, hasNotFoundSignal } from './utils';
import {
	extractCanonicalUserIdentifiers,
	normalizeCanonicalUserIdentifier,
	runUserIdentifiersPreflightGate,
	userListLookupScopes,
} from './users';

const teamGetLookupScopes = listAcceptedScopesForOperation('team', 'get') ?? [];
const teamGetMembersLookupScopes = listAcceptedScopesForOperation('team', 'getMembers') ?? [];

export const TEAM_NOT_FOUND_MESSAGE =
	'Team not found. The team ID provided does not exist in Zoho Cliq or is not accessible to the authenticated account.';
export const TEAM_NOT_FOUND_HINT = 'Use List Teams to retrieve valid team IDs and try again.';
const USER_IDS_NOT_FOUND_MESSAGE =
	'One or more user IDs were not found. The provided user IDs do not exist in this Zoho Cliq organization.';
const USER_IDS_NOT_FOUND_HINT =
	'Use Get User or List Users to retrieve valid user IDs and try again.';
export const USER_IDS_NOT_TEAM_MEMBERS_MESSAGE =
	'One or more user IDs are not members of this team. The provided user IDs are valid Zoho Cliq users but are not currently members of the specified team.';
export const USER_IDS_NOT_TEAM_MEMBERS_HINT =
	'Use Get Team Members to retrieve the current team roster and retry with only user IDs that are members of this team.';
export const TEAM_MEMBER_ROSTER_VERIFICATION_FAILED_MESSAGE =
	'The team membership preflight could not verify the roster because Zoho Cliq returned one or more team member rows without a usable user identifier.';

export interface IRunTeamUsersPreflightGateOptions {
	includeInactiveUsers?: boolean;
}

export const teamNotFoundFragments = [
	'team_not_exist',
	'team not found',
	'no team found',
	'not found',
	'does not exist',
	'team does not exist',
];

function extractTeamIdentifiers(team: IDataObject): string[] {
	return [
		getFirstString(team.id),
		getFirstString(team.team_id),
		getFirstString(team.teamId),
	].filter((value): value is string => Boolean(value));
}

function isAuthoritativeTeamNotFoundError(error: unknown): boolean {
	return hasNotFoundSignal(error, {
		messageFragments: teamNotFoundFragments,
	});
}

function extractTeamMemberItems(response: IDataObject): IDataObject[] | undefined {
	if (Array.isArray(response.members)) {
		return response.members as IDataObject[];
	}

	if (Array.isArray(response.data)) {
		return response.data as IDataObject[];
	}

	const nestedData = asDataObject(response.data);
	if (nestedData && Array.isArray(nestedData.members)) {
		return nestedData.members as IDataObject[];
	}

	return undefined;
}

export function normalizeTeamLookupNotFoundError(
	context: IExecuteFunctions,
	error: unknown,
	itemIndex: number,
): NodeOperationError | undefined {
	if (!isAuthoritativeTeamNotFoundError(error)) {
		return undefined;
	}

	const notFoundError = new NodeOperationError(context.getNode(), TEAM_NOT_FOUND_MESSAGE, {
		itemIndex,
	});
	copyLookupErrorMetadata(notFoundError, error);
	return notFoundError;
}

export async function lookupDirectTeamExhaustively(
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
			`/api/v2/teams/${encodeURIComponent(config.identifier)}`,
		);
		const team = asDataObject(response);
		if (!team) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Team returned a non-object response for "${config.identifier}".`,
			};
		}

		const knownIdentifiers = extractTeamIdentifiers(team);
		if (knownIdentifiers.length === 0 || knownIdentifiers.includes(config.identifier)) {
			return {
				status: 'confirmed_exists',
				entity: team,
			};
		}

		return {
			status: 'confirmed_missing',
			evidence: `Get Team returned a response, but it did not identify "${config.identifier}" as one of the canonical team identifiers.`,
		};
	} catch (error) {
		if (isAuthoritativeTeamNotFoundError(error)) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Team returned an authoritative not-found response for "${config.identifier}".`,
			};
		}

		throw error;
	}
}

export async function runTeamLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	teamId: string,
): Promise<PreflightGateResult<IDataObject>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'team',
			identifier: teamId,
			label: 'Team ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: teamGetLookupScopes,
		},
		strategy: async () =>
			await lookupDirectTeamExhaustively(context, itemIndex, {
				identifier: teamId,
			}),
		errors: {
			missing: {
				code: 'TEAM_NOT_FOUND',
				message: TEAM_NOT_FOUND_MESSAGE,
				hint: TEAM_NOT_FOUND_HINT,
			},
		},
	});
}

export async function runTeamUsersPreflightGate(
	context: IExecuteFunctions,
	userIds: string[],
	itemIndex: number,
	grantedScopes: string,
	options: IRunTeamUsersPreflightGateOptions = {},
): Promise<void> {
	await runUserIdentifiersPreflightGate(context, itemIndex, grantedScopes, {
		identifiers: userIds,
		subjectLabel: 'Team Member User IDs',
		includeInactiveUsers: options.includeInactiveUsers,
		acceptedScopes: userListLookupScopes,
		missing: {
			code: 'USER_IDS_NOT_FOUND',
			message: USER_IDS_NOT_FOUND_MESSAGE,
			hint: USER_IDS_NOT_FOUND_HINT,
		},
	});
}

export async function lookupTeamMembershipExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		teamId: string;
		userIds: string[];
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	if (!config.userIds.length) {
		return { status: 'confirmed_exists' };
	}

	let response: unknown;
	try {
		response = await zohoCliqApiRequest.call(
			context,
			'GET',
			`/api/v2/teams/${encodeURIComponent(config.teamId)}/members`,
		);
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeOperationError(
			context.getNode(),
			`The team membership preflight failed before Zoho Cliq could verify the roster for team "${config.teamId}".`,
			{ itemIndex },
		);
	}

	const responseObject = asDataObject(response);
	if (!responseObject) {
		throw new NodeOperationError(
			context.getNode(),
			'The team membership preflight did not return an object response.',
			{ itemIndex },
		);
	}

	const members = extractTeamMemberItems(responseObject);
	if (!members) {
		throw new NodeOperationError(
			context.getNode(),
			'The team membership preflight did not return a members collection that could be verified.',
			{ itemIndex },
		);
	}

	const normalizedRequestedUserIds = config.userIds.map((userId) =>
		normalizeCanonicalUserIdentifier(userId),
	);
	const knownMemberIds = new Set<string>();
	for (const member of members) {
		const canonicalMemberIds = extractCanonicalUserIdentifiers(member);
		if (canonicalMemberIds.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				TEAM_MEMBER_ROSTER_VERIFICATION_FAILED_MESSAGE,
				{ itemIndex },
			);
		}

		for (const candidateId of canonicalMemberIds) {
			knownMemberIds.add(candidateId);
		}
	}

	const nonMemberUserIds = normalizedRequestedUserIds.filter(
		(userId) => !knownMemberIds.has(userId),
	);
	if (nonMemberUserIds.length === 0) {
		return { status: 'confirmed_exists' };
	}

	return {
		status: 'confirmed_missing',
		evidence: `The requested user IDs are valid Zoho Cliq users but are not current members of team "${config.teamId}". Non-member user IDs: ${JSON.stringify(
			nonMemberUserIds,
		)}.`,
		missingIdentifiers: nonMemberUserIds,
	};
}

export async function runTeamMembershipPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	teamId: string,
	userIds: string[],
): Promise<PreflightGateResult<void>> {
	if (!userIds.length) {
		return { status: 'validated' };
	}

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'team_membership',
			identifier: `${teamId}:${userIds.join(',')}`,
			label: 'Team Member User IDs',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: teamGetMembersLookupScopes,
		},
		strategy: async () =>
			await lookupTeamMembershipExhaustively(context, itemIndex, {
				teamId,
				userIds,
			}),
		errors: {
			missing: {
				code: 'USER_IDS_NOT_TEAM_MEMBERS',
				message: USER_IDS_NOT_TEAM_MEMBERS_MESSAGE,
				hint: USER_IDS_NOT_TEAM_MEMBERS_HINT,
				attachmentKey: 'zohoCliqNonMemberUserIds',
			},
		},
	});
}
