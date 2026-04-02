import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

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

const reminderGetLookupScopes = listAcceptedScopesForOperation('reminders', 'get') ?? [];

export const REMINDER_LOOKUP_NOT_FOUND_ERROR_CODE = 'REMINDER_NOT_FOUND';
export const REMINDER_IDS_LOOKUP_NOT_FOUND_ERROR_CODE = 'REMINDER_IDS_NOT_FOUND';
export const REMINDER_TYPE_NOT_ASSIGNABLE_ERROR_CODE = 'REMINDER_TYPE_NOT_ASSIGNABLE';
export const LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED_ERROR_CODE = 'LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED';

export const REMINDER_LOOKUP_NOT_FOUND_HINT =
	'Use List Reminders to discover valid reminder IDs before retrying.';
export const REMINDER_IDS_LOOKUP_NOT_FOUND_HINT =
	'Use List Reminders to discover valid reminder IDs before retrying the batch request.';
export const REMINDER_TYPE_NOT_ASSIGNABLE_HINT =
	'User assignment is supported only for users-type reminders in the Others category. Chat-targeted reminders do not support assignee updates.';
export const LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED_HINT =
	'A users-type reminder must keep at least one assignee. Remove fewer users, or use Delete Reminder if the reminder should be removed entirely.';

const reminderNotFoundFragments = [
	'reminder not found',
	'invalid reminder id',
	'request url is invalid',
];

function getReminderAssignedUserIds(reminder: IDataObject): string[] {
	const reminderUsers = Array.isArray(reminder.users) ? reminder.users : [];

	return reminderUsers
		.map((user) =>
			user && typeof user === 'object' && !Array.isArray(user)
				? getFirstString([
						(user as IDataObject).id,
						(user as IDataObject).user_id,
						(user as IDataObject).zuid,
					])
				: undefined,
		)
		.filter((userId): userId is string => typeof userId === 'string' && userId.length > 0);
}

function isMessageReminder(reminder: IDataObject): boolean {
	return Boolean(
		reminder.message && typeof reminder.message === 'object' && !Array.isArray(reminder.message),
	);
}

function extractReminderIdentifiers(reminder: IDataObject): string[] {
	return Array.from(
		new Set(
			[getFirstString(reminder.id), getFirstString(reminder.reminder_id)].filter(
				(value): value is string => Boolean(value),
			),
		),
	);
}

function isAuthoritativeReminderNotFoundError(error: unknown): boolean {
	return hasNotFoundSignal(error, {
		messageFragments: reminderNotFoundFragments,
	});
}

async function getReminderForPreflight(
	context: IExecuteFunctions,
	itemIndex: number,
	reminderId: string,
): Promise<IDataObject> {
	const response = await zohoCliqApiRequest.call(
		context,
		'GET',
		`/api/v2/reminders/${encodeURIComponent(reminderId)}`,
	);
	const reminder = asDataObject(response);

	if (!reminder) {
		throw new NodeOperationError(
			context.getNode(),
			'The reminder preflight did not return an object response.',
			{ itemIndex },
		);
	}

	return reminder;
}

export async function lookupReminderExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	try {
		const reminder = await getReminderForPreflight(context, itemIndex, config.identifier);
		const knownIdentifiers = extractReminderIdentifiers(reminder);

		if (knownIdentifiers.includes(config.identifier)) {
			return {
				status: 'confirmed_exists',
				entity: reminder,
			};
		}

		if (knownIdentifiers.length === 0) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Reminder returned an object for "${config.identifier}", but the reminder did not include any canonical reminder identifiers.`,
			};
		}

		return {
			status: 'confirmed_missing',
			evidence: `Get Reminder returned a response, but it did not identify "${config.identifier}" as one of the canonical reminder identifiers.`,
		};
	} catch (error) {
		if (isAuthoritativeReminderNotFoundError(error)) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Reminder returned an authoritative not-found response for "${config.identifier}".`,
			};
		}

		throw error;
	}
}

export async function lookupReminderIdentifiersExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifiers: string[];
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	const normalizedIdentifiers = Array.from(
		new Set(
			config.identifiers.filter(
				(identifier): identifier is string =>
					typeof identifier === 'string' && identifier.length > 0,
			),
		),
	);

	if (!normalizedIdentifiers.length) {
		return { status: 'confirmed_exists' };
	}

	const missingIdentifiers: string[] = [];

	for (const identifier of normalizedIdentifiers) {
		const outcome = await lookupReminderExhaustively(context, itemIndex, {
			identifier,
		});

		if (outcome.status === 'confirmed_missing') {
			missingIdentifiers.push(identifier);
		}
	}

	if (!missingIdentifiers.length) {
		return { status: 'confirmed_exists' };
	}

	return {
		status: 'confirmed_missing',
		evidence: `One or more supplied reminder IDs could not be confirmed by the shared reminder lookup preflight. Missing reminder IDs: ${JSON.stringify(
			missingIdentifiers,
		)}.`,
		missingIdentifiers,
	};
}

export async function runReminderLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	reminderId: string,
	options: {
		fieldLabel?: string;
		missing?: IPreflightMissingErrorConfig;
	} = {},
): Promise<PreflightGateResult<IDataObject>> {
	const fieldLabel = options.fieldLabel ?? 'Reminder ID';

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'reminder',
			identifier: reminderId,
			label: fieldLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: reminderGetLookupScopes,
		},
		strategy: async () =>
			await lookupReminderExhaustively(context, itemIndex, {
				identifier: reminderId,
			}),
		errors: {
			missing: options.missing ?? {
				code: REMINDER_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: `No reminder found for ${fieldLabel} "${reminderId}".`,
				hint: REMINDER_LOOKUP_NOT_FOUND_HINT,
			},
		},
	});
}

export async function runReminderIdentifiersPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	reminderIds: string[],
	options: {
		fieldLabel?: string;
		missing?: IPreflightMissingErrorConfig;
	} = {},
): Promise<void> {
	const normalizedIdentifiers = Array.isArray(reminderIds)
		? reminderIds.filter(
				(identifier): identifier is string =>
					typeof identifier === 'string' && identifier.length > 0,
			)
		: [];

	if (!normalizedIdentifiers.length) {
		return;
	}

	const fieldLabel = options.fieldLabel ?? 'Reminder IDs';

	await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'reminder',
			identifier: normalizedIdentifiers.join(','),
			label: fieldLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: reminderGetLookupScopes,
		},
		strategy: async () =>
			await lookupReminderIdentifiersExhaustively(context, itemIndex, {
				identifiers: normalizedIdentifiers,
			}),
		errors: {
			missing: options.missing ?? {
				code: REMINDER_IDS_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: ({ missingIdentifiers }) =>
					`One or more reminder IDs were not found. Missing reminder IDs: ${JSON.stringify(
						missingIdentifiers ?? normalizedIdentifiers,
					)}.`,
				hint: REMINDER_IDS_LOOKUP_NOT_FOUND_HINT,
				attachmentKey: 'zohoCliqMissingReminderIds',
			},
		},
	});
}

export async function lookupAssignableReminderTypeExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
		reminder?: IDataObject;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	const reminder =
		config.reminder ?? (await getReminderForPreflight(context, itemIndex, config.identifier));
	const chats = Array.isArray(reminder.chats) ? reminder.chats : [];

	if (chats.length > 0) {
		return {
			status: 'confirmed_missing',
			evidence: `Get Reminder returned a chat-targeted reminder for "${config.identifier}", so assignee user updates are not supported for that reminder type.`,
		};
	}

	return {
		status: 'confirmed_exists',
	};
}

export async function lookupReminderLastAssigneeRemovalExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
		reminder?: IDataObject;
		userIdsToRemove: string[];
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	const reminder =
		config.reminder ?? (await getReminderForPreflight(context, itemIndex, config.identifier));
	const chats = Array.isArray(reminder.chats) ? reminder.chats : [];

	if (chats.length > 0 || isMessageReminder(reminder)) {
		return {
			status: 'confirmed_exists',
		};
	}

	const assignedUserIds = getReminderAssignedUserIds(reminder);
	if (!assignedUserIds.length) {
		return {
			status: 'confirmed_exists',
		};
	}

	const removalSet = new Set(config.userIdsToRemove);
	const removingKnownAssignedUser = assignedUserIds.some((userId) => removalSet.has(userId));
	if (!removingKnownAssignedUser) {
		return {
			status: 'confirmed_exists',
		};
	}

	const remainingAssignedUserIds = assignedUserIds.filter((userId) => !removalSet.has(userId));
	if (remainingAssignedUserIds.length > 0) {
		return {
			status: 'confirmed_exists',
		};
	}

	return {
		status: 'confirmed_missing',
		evidence: `Removing ${JSON.stringify(config.userIdsToRemove)} from reminder "${config.identifier}" would leave a users-type reminder with zero assignees.`,
	};
}

export async function runReminderAssignableTypePreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	reminderId: string,
	options: {
		reminder?: IDataObject;
	} = {},
): Promise<PreflightGateResult<void>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'reminder',
			identifier: reminderId,
			label: 'Reminder ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: reminderGetLookupScopes,
		},
		strategy: async () =>
			await lookupAssignableReminderTypeExhaustively(context, itemIndex, {
				identifier: reminderId,
				reminder: options.reminder,
			}),
		errors: {
			missing: {
				code: REMINDER_TYPE_NOT_ASSIGNABLE_ERROR_CODE,
				message:
					'Assign users is supported only for users-type reminders in the Others category. Chat-targeted reminders do not support user assignment.',
				hint: REMINDER_TYPE_NOT_ASSIGNABLE_HINT,
			},
		},
	});
}

export async function runReminderLastAssigneeRemovalPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	reminderId: string,
	userIdsToRemove: string[],
	options: {
		reminder?: IDataObject;
	} = {},
): Promise<PreflightGateResult<void>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'reminder',
			identifier: reminderId,
			label: 'Reminder ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: reminderGetLookupScopes,
		},
		strategy: async () =>
			await lookupReminderLastAssigneeRemovalExhaustively(context, itemIndex, {
				identifier: reminderId,
				reminder: options.reminder,
				userIdsToRemove,
			}),
		errors: {
			missing: {
				code: LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED_ERROR_CODE,
				message:
					'Cannot remove the last remaining assignee from a users-type reminder. Delete the reminder instead if it should no longer exist.',
				hint: LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED_HINT,
			},
		},
	});
}
