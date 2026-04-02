/**
 * Unfollow Thread operation
 * Makes the current user unfollow a thread
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { THREAD_UNFOLLOW_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateThreadChatId } from '../../helpers/utils';
import { runThreadLookupPreflightGate } from '../shared/preflight';
import {
	pushThreadRecoverableError,
	resolveThreadEnhancedOutput,
	THREAD_NOT_FOUND_HINT,
	THREAD_NOT_FOUND_MESSAGE,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('thread', 'unfollow');

const properties: INodeProperties[] = [
	{
		displayName: 'Thread Chat ID',
		name: 'threadChatId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. CT_1234567890_1234567890-T-1234567890',
		description: 'The chat ID of the thread to unfollow (format: CT_...-T-...)',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal unfollow response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Unfollow Thread Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-followers" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'unfollowThreadDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/Unfollow Thread as AI Tool Setup Guide: <a href="${THREAD_UNFOLLOW_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'unfollowThreadAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['unfollow'],
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

			const threadChatId = String(this.getNodeParameter('threadChatId', i));
			requestedThreadChatId = threadChatId.trim();

			const sanitizedThreadChatId = validateThreadChatId(this, requestedThreadChatId, i);
			await runThreadLookupPreflightGate(this, i, grantedScopes, sanitizedThreadChatId);

			const endpoint = `/api/v2/threads/${encodeURIComponent(sanitizedThreadChatId)}/unfollow`;
			const response = await zohoCliqApiRequest.call(this, 'POST', endpoint);
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
									operation: 'unfollow',
									thread_chat_id: sanitizedThreadChatId,
									following: false,
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
			if (
				pushThreadRecoverableError(this, returnData, i, 'unfollow', error, {
					contextFields: requestedThreadChatId
						? {
								thread_chat_id: requestedThreadChatId,
							}
						: undefined,
					fallbackMessage: 'Unable to unfollow the thread in Zoho Cliq.',
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
								normalizedMessage.includes('chat id is required') ||
								normalizedMessage.includes('invalid chat id format') ||
								normalizedMessage.includes('chat id is too long'),
							reason: 'INVALID_THREAD_CHAT_ID',
							hint: 'Use the exact thread chat ID returned by List Threads for Channel or Get Main Message before unfollowing the thread.',
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
