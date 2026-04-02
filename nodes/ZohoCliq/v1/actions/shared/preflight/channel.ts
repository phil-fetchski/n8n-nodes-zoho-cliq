import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type { ExhaustiveLookupOutcome, PreflightGateResult } from './contracts';
import { isAuthoritativeNotFoundError } from './direct';
import { runPreflightGate } from './gate';

const channelLookupScopes = listAcceptedScopesForOperation('channel', 'get') ?? [];

export const CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE = 'CHANNEL_NOT_FOUND';
export const CHANNEL_NOT_FOUND_HINT =
	'Use Get Channel or List Channels to confirm the exact channel ID or channel unique name before retrying.';

function isAuthoritativeChannelLookupNotFoundError(error: unknown): boolean {
	return isAuthoritativeNotFoundError(error, [
		'request url is invalid',
		'channel not found',
		'no channel found',
		'invalid channel id',
		'invalid channel unique name',
	]);
}

async function lookupChannelExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
		endpoint: string;
	},
): Promise<ExhaustiveLookupOutcome<IDataObject>> {
	try {
		const response = (await zohoCliqApiRequest.call(
			context,
			'GET',
			config.endpoint,
		)) as IDataObject;
		return { status: 'confirmed_exists', entity: response };
	} catch (error) {
		if (isAuthoritativeChannelLookupNotFoundError(error)) {
			return {
				status: 'confirmed_missing',
				evidence: `Zoho Cliq returned an authoritative channel-not-found response for "${config.identifier}".`,
			};
		}

		throw error;
	}
}

export async function runChannelIdLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	channelId: string,
): Promise<PreflightGateResult<IDataObject>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'channel',
			identifier: channelId,
			label: 'Channel ID',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: channelLookupScopes,
		},
		strategy: async () =>
			await lookupChannelExhaustively(context, itemIndex, {
				identifier: channelId,
				endpoint: `/api/v2/channels/${encodeURIComponent(channelId)}`,
			}),
		errors: {
			missing: {
				code: CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: ({ subject }) => `No channel found for ${subject.label} "${subject.identifier}".`,
				hint: CHANNEL_NOT_FOUND_HINT,
			},
		},
	});
}

export async function runChannelUniqueNameLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	channelUniqueName: string,
): Promise<PreflightGateResult<IDataObject>> {
	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'channel',
			identifier: channelUniqueName,
			label: 'Channel Unique Name',
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: channelLookupScopes,
		},
		strategy: async () =>
			await lookupChannelExhaustively(context, itemIndex, {
				identifier: channelUniqueName,
				endpoint: `/api/v2/channelsbyname/${encodeURIComponent(channelUniqueName)}`,
			}),
		errors: {
			missing: {
				code: CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE,
				message: ({ subject }) => `No channel found for ${subject.label} "${subject.identifier}".`,
				hint: CHANNEL_NOT_FOUND_HINT,
			},
		},
	});
}
