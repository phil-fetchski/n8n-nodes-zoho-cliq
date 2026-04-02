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

const eventGetLookupScopes = listAcceptedScopesForOperation('events', 'get') ?? [];
const eventNotFoundStatusCodes = new Set([404]);
const eventNotFoundFragments = [
	'request url is invalid',
	'event not found',
	'invalid event id',
	'not available',
	'has been deleted',
];

export const EVENT_LOOKUP_NOT_FOUND_ERROR_CODE = 'EVENT_NOT_FOUND';
export const EVENT_NOT_FOUND_HINT =
	'Use Get Calendars or List Events to confirm the event_id and calendar_id pair before retrying.';

function buildEventLookupQuery(config: {
	calendarId: string;
	recurrenceId?: string;
}): Record<string, string> {
	const query: Record<string, string> = {
		calendar_id: config.calendarId,
	};

	if (config.recurrenceId) {
		query.recurrence_id = config.recurrenceId;
	}

	return query;
}

export function extractEventDetailsFromLookupResponse(response: unknown): IDataObject | undefined {
	const root = asDataObject(response);
	if (!root) {
		return undefined;
	}

	const data = root.data;
	if (data && typeof data === 'object' && !Array.isArray(data)) {
		return data as IDataObject;
	}

	if (
		Array.isArray(data) &&
		data.length > 0 &&
		data[0] &&
		typeof data[0] === 'object' &&
		!Array.isArray(data[0])
	) {
		return data[0] as IDataObject;
	}

	return undefined;
}

function extractEventIdentifiers(details: IDataObject): string[] {
	return [
		getFirstString(details.id),
		getFirstString(details.event_id),
		getFirstString(details.eventId),
	].filter((value): value is string => Boolean(value));
}

function isAuthoritativeEventNotFoundError(error: unknown): boolean {
	return hasNotFoundSignal(error, {
		messageFragments: eventNotFoundFragments,
		statusCodes: eventNotFoundStatusCodes,
	});
}

export async function lookupEventExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		eventId: string;
		calendarId: string;
		recurrenceId?: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	try {
		const response = await zohoCliqApiRequest.call(
			context,
			'GET',
			`/api/v2/events/${encodeURIComponent(config.eventId)}`,
			undefined,
			buildEventLookupQuery(config),
		);
		const eventResponse = asDataObject(response);
		if (!eventResponse) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Event Details returned a non-object response for "${config.eventId}" in calendar "${config.calendarId}".`,
			};
		}

		const details = extractEventDetailsFromLookupResponse(eventResponse);
		if (!details) {
			return {
				status: 'confirmed_exists',
				entity: eventResponse,
			};
		}

		const knownIdentifiers = extractEventIdentifiers(details);
		if (knownIdentifiers.includes(config.eventId)) {
			return {
				status: 'confirmed_exists',
				entity: eventResponse,
			};
		}

		if (!knownIdentifiers.length) {
			return {
				status: 'confirmed_exists',
				entity: eventResponse,
			};
		}

		return {
			status: 'confirmed_missing',
			evidence: `Get Event Details returned a response, but it did not identify "${config.eventId}" as one of the canonical event identifiers for calendar "${config.calendarId}".`,
		};
	} catch (error) {
		if (isAuthoritativeEventNotFoundError(error)) {
			return {
				status: 'confirmed_missing',
				evidence: `Get Event Details returned an authoritative not-found response for "${config.eventId}" in calendar "${config.calendarId}".`,
			};
		}

		throw error;
	}
}

export async function runEventLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	eventId: string,
	calendarId: string,
	options: {
		fieldLabel?: string;
		recurrenceId?: string;
		missing?: IPreflightMissingErrorConfig;
	} = {},
): Promise<PreflightGateResult<IDataObject>> {
	const fieldLabel = options.fieldLabel ?? 'Event ID';

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'event',
			identifier: eventId,
			label: fieldLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: eventGetLookupScopes,
		},
		strategy: async () =>
			await lookupEventExhaustively(context, itemIndex, {
				eventId,
				calendarId,
				recurrenceId: options.recurrenceId,
			}),
		errors: {
			missing: options.missing ?? {
				code: EVENT_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: `No event found for ${fieldLabel} "${eventId}" in Calendar ID "${calendarId}".`,
				hint: EVENT_NOT_FOUND_HINT,
			},
		},
	});
}
