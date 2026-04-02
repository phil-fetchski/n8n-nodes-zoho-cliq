/**
 * Add Thread Followers operation
 * Adds users as followers to a thread
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { THREAD_ADD_FOLLOWERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateThreadChatId, validateUserIdArray } from '../../helpers/utils';
import { runThreadLookupPreflightGate, runThreadUsersPreflightGate } from '../shared/preflight';
import {
	extractThreadUserIdsForContext,
	pushThreadRecoverableError,
	resolveThreadEnhancedOutput,
	THREAD_NOT_FOUND_HINT,
	THREAD_NOT_FOUND_MESSAGE,
	USER_IDS_NOT_FOUND_HINT,
	USER_IDS_NOT_FOUND_MESSAGE,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('thread', 'addFollowers');

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
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. 123456789,987654321',
		description:
			'Comma-separated list of user IDs to add as followers. Whitespace around commas is ignored.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal add-followers response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Add Followers Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-followers" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'addThreadFollowersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/Add Followers as AI Tool Setup Guide: <a href="${THREAD_ADD_FOLLOWERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addThreadFollowersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['addFollowers'],
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
		let requestedUserIds: string[] | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const threadChatId = this.getNodeParameter('threadChatId', i) as string;
			const userIds = this.getNodeParameter('userIds', i) as unknown;
			requestedThreadChatId = threadChatId.trim();
			requestedUserIds = extractThreadUserIdsForContext(userIds);

			const sanitizedThreadChatId = validateThreadChatId(this, requestedThreadChatId, i);
			const userIdArray = validateUserIdArray(this, userIds as string | string[], i);
			requestedUserIds = userIdArray;
			await runThreadLookupPreflightGate(this, i, grantedScopes, sanitizedThreadChatId);
			await runThreadUsersPreflightGate(this, userIdArray, i, grantedScopes);

			const endpoint = `/api/v2/threads/${encodeURIComponent(sanitizedThreadChatId)}/followers`;
			const response = await zohoCliqApiRequest.call(this, 'POST', endpoint, {
				user_ids: userIdArray,
			});
			const { includeEnhancedOutput, responseJson, rawResponse } = resolveThreadEnhancedOutput(
				this,
				i,
				response,
				true,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									success: true,
									resource: 'thread',
									operation: 'addFollowers',
									thread_chat_id: sanitizedThreadChatId,
									user_ids: userIdArray,
									added_count: userIdArray.length,
								}
							: rawResponse,
					},
				],
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			const missingUserIds =
				error &&
				typeof error === 'object' &&
				!Array.isArray(error) &&
				Array.isArray((error as Record<string, unknown>).zohoCliqMissingUserIds)
					? ((error as Record<string, unknown>).zohoCliqMissingUserIds as string[])
					: undefined;
			if (
				pushThreadRecoverableError(this, returnData, i, 'addFollowers', error, {
					contextFields: {
						...(requestedThreadChatId ? { thread_chat_id: requestedThreadChatId } : {}),
						...(requestedUserIds ? { user_ids: requestedUserIds } : {}),
						...(missingUserIds?.length ? { invalid_user_ids: missingUserIds } : {}),
					},
					fallbackMessage: 'Unable to add followers to the thread in Zoho Cliq.',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(THREAD_NOT_FOUND_MESSAGE.toLowerCase()),
							reason: 'THREAD_NOT_FOUND',
							messageOverride: THREAD_NOT_FOUND_MESSAGE,
							hint: THREAD_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(USER_IDS_NOT_FOUND_MESSAGE.toLowerCase()) ||
								normalizedMessage.includes('missing user ids:'),
							reason: 'USER_IDS_NOT_FOUND',
							messageOverride: USER_IDS_NOT_FOUND_MESSAGE,
							hint: USER_IDS_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_THREAD_CHAT_ID',
							hint: 'Use the exact thread chat ID returned by List Threads for Channel or Get Main Message before adding followers.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('at least one user id is required') ||
								normalizedMessage.includes('user ids must be a string or array') ||
								normalizedMessage.includes('invalid user id format'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide one or more thread follower user IDs as a comma-separated string. Reuse `data[].user_id` from Get Non Followers for the safest retry.',
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
