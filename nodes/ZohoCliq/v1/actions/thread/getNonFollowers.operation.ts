/**
 * Get Thread Non Followers operation
 * Retrieves users in the parent channel who are not following a thread.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { THREAD_GET_NON_FOLLOWERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateThreadChatId } from '../../helpers/utils';
import { runThreadLookupPreflightGate } from '../shared/preflight';
import {
	hasThreadNotFoundCode,
	normalizeThreadResponseMessageIds,
	pushThreadRecoverableError,
	THREAD_NOT_FOUND_HINT,
	THREAD_NOT_FOUND_MESSAGE,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('thread', 'getNonFollowers');

const properties: INodeProperties[] = [
	{
		displayName: 'Thread Chat ID',
		name: 'threadChatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. CT_1234567890_1234567890-T-1234567890',
		description: 'The chat ID of the thread (format: CT_...-T-...)',
	},
	{
		displayName: `Get Non Followers Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get-non-followers" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getThreadNonFollowersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/Get Non Followers as AI Tool Setup Guide: <a href="${THREAD_GET_NON_FOLLOWERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getThreadNonFollowersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['getNonFollowers'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedThreadChatId = '';
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const threadChatId = this.getNodeParameter('threadChatId', i) as string;
			requestedThreadChatId = threadChatId.trim();
			const sanitizedThreadChatId = validateThreadChatId(this, requestedThreadChatId, i);
			await runThreadLookupPreflightGate(this, i, grantedScopes, sanitizedThreadChatId);

			const endpoint = `/api/v2/threads/${encodeURIComponent(sanitizedThreadChatId)}/nonfollowers`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: normalizeThreadResponseMessageIds(response) }],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushThreadRecoverableError(this, returnData, i, 'getNonFollowers', error, {
					contextFields: requestedThreadChatId
						? {
								thread_chat_id: requestedThreadChatId,
							}
						: undefined,
					fallbackMessage: 'Unable to get thread non-followers in Zoho Cliq.',
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								hasThreadNotFoundCode(mappedError),
							reason: 'THREAD_NOT_FOUND',
							messageOverride: THREAD_NOT_FOUND_MESSAGE,
							hint: THREAD_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_THREAD_CHAT_ID',
							hint: 'Use the exact thread chat ID returned by List Threads for Channel or Get Main Message before retrieving non-followers.',
						},
					],
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
