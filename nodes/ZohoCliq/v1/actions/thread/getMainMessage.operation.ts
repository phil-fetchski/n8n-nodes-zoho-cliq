/**
 * Get Thread Main Message operation
 * Retrieves the parent message from which a thread was created.
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { THREAD_GET_MAIN_MESSAGE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateThreadChatId } from '../../helpers/utils';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { runThreadLookupPreflightGate } from '../shared/preflight';
import {
	hasThreadNotFoundCode,
	normalizeThreadResponseMessageIds,
	pushThreadRecoverableError,
	THREAD_NOT_FOUND_HINT,
	THREAD_NOT_FOUND_MESSAGE,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('thread', 'getMainMessage');

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
	...getSimplifyParameters('threadMainMessage', 'thread', 'getMainMessage'),
	{
		displayName: `Get Main Message Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get-main-message" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getThreadMainMessageDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/Get Main Message as AI Tool Setup Guide: <a href="${THREAD_GET_MAIN_MESSAGE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getThreadMainMessageAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['getMainMessage'],
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
		let sanitizedThreadChatId = '';
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const threadChatId = this.getNodeParameter('threadChatId', i) as string;
			sanitizedThreadChatId = validateThreadChatId(this, threadChatId, i);
			await runThreadLookupPreflightGate(this, i, grantedScopes, sanitizedThreadChatId);

			const endpoint = `/api/v2/threads/${encodeURIComponent(sanitizedThreadChatId)}/messages/main`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);

			const normalized = normalizeThreadResponseMessageIds(response);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('threadMainMessage');
			const json = applySimplifyMode(
				coerceApiResponseToObject(normalized),
				mode,
				config,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushThreadRecoverableError(this, returnData, i, 'getMainMessage', error, {
					contextFields: {
						thread_chat_id: sanitizedThreadChatId,
					},
					fallbackMessage: 'Unable to get the thread main message in Zoho Cliq.',
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								hasThreadNotFoundCode(mappedError),
							reason: 'THREAD_NOT_FOUND',
							messageOverride: THREAD_NOT_FOUND_MESSAGE,
							hint: THREAD_NOT_FOUND_HINT,
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
