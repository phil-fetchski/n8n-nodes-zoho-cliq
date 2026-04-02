import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { runPreflightGate } from './gate';
import { lookupChatExhaustively } from './chat';
import { runUserIdentifiersPreflightGate, userListLookupScopes } from './users';

const threadLookupScopes = listAcceptedScopesForOperation('chat', 'getMembers') ?? [];

export const THREAD_NOT_FOUND_MESSAGE =
	'The supplied thread chat ID could not be found in Zoho Cliq.';
export const THREAD_NOT_FOUND_HINT =
	'Use List Threads for Channel or Get Main Message to discover a valid thread chat ID in the authenticated account before retrying.';
const USER_IDS_NOT_FOUND_MESSAGE = 'One or more supplied user IDs could not be found in Zoho Cliq.';
const USER_IDS_NOT_FOUND_HINT =
	'Use Get Followers, Get Non Followers, or List Users to source valid Zoho Cliq user IDs before retrying.';
const THREAD_NOT_FOUND_EVIDENCE =
	'Zoho Cliq did not confirm the supplied thread chat ID as an existing thread in the authenticated account during the available verification checks.';

export async function lookupThreadExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	void grantedScopes;

	let outcome: ExhaustiveLookupOutcome<void>;
	try {
		outcome = await lookupChatExhaustively(context, itemIndex, {
			identifier: config.identifier,
		});
	} catch {
		throw new NodeOperationError(
			context.getNode(),
			'The thread preflight failed before Zoho Cliq could verify the supplied thread chat ID.',
			{ itemIndex },
		);
	}

	if (outcome.status === 'confirmed_missing') {
		return {
			status: 'confirmed_missing',
			evidence: THREAD_NOT_FOUND_EVIDENCE,
		};
	}

	return { status: 'confirmed_exists', entity: outcome.entity };
}

export async function runThreadLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	threadChatId: string,
): Promise<PreflightGateResult<void>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'thread',
			identifier: threadChatId,
			label: 'Thread Chat ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: threadLookupScopes,
		},
		strategy: async () =>
			await lookupThreadExhaustively(context, itemIndex, grantedScopes, {
				identifier: threadChatId,
			}),
		errors: {
			missing: {
				code: 'THREAD_NOT_FOUND',
				message: ({ subject }) =>
					`${THREAD_NOT_FOUND_MESSAGE} No thread was found for thread_chat_id "${subject.identifier}".`,
				hint: THREAD_NOT_FOUND_HINT,
			},
		},
	});
}

export async function runThreadUsersPreflightGate(
	context: IExecuteFunctions,
	userIds: string[],
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	await runUserIdentifiersPreflightGate(context, itemIndex, grantedScopes, {
		identifiers: userIds,
		subjectLabel: 'Thread Follower User IDs',
		acceptedScopes: userListLookupScopes,
		missing: {
			code: 'USER_IDS_NOT_FOUND',
			message: ({ missingIdentifiers }) =>
				`${USER_IDS_NOT_FOUND_MESSAGE} Missing user IDs: ${JSON.stringify(missingIdentifiers)}.`,
			hint: USER_IDS_NOT_FOUND_HINT,
		},
	});
}
