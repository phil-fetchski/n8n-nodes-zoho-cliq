/**
 * List Chats operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHAT_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateLimit } from '../../helpers/utils';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import { pushChatRecoverableError } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

function resolveTimestampFilter(
	context: IExecuteFunctions,
	value: unknown,
	fieldDisplayName: string,
	itemIndex: number,
): number | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	const finalizeTimestamp = (timestamp: number): number | undefined => {
		if (!Number.isFinite(timestamp) || !Number.isSafeInteger(timestamp) || timestamp < 0) {
			throw new NodeOperationError(context.getNode(), `Invalid ${fieldDisplayName} timestamp`, {
				itemIndex,
			});
		}

		if (timestamp === 0) {
			return undefined;
		}

		return timestamp;
	};

	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return undefined;
		}

		if (/^[+-]?\d+(?:\.\d+)?$/.test(trimmed)) {
			return finalizeTimestamp(Number(trimmed));
		}

		const parsedTimestamp = Date.parse(trimmed);
		return finalizeTimestamp(parsedTimestamp);
	}

	if (value instanceof Date) {
		return finalizeTimestamp(value.getTime());
	}

	if (typeof value === 'number') {
		return finalizeTimestamp(value);
	}

	if (typeof value === 'object') {
		const candidate = value as { toISO?: () => string; toMillis?: () => number };

		if (typeof candidate.toISO === 'function') {
			const isoValue = String(candidate.toISO()).trim();
			if (!isoValue) {
				return undefined;
			}
			const parsedTimestamp = Date.parse(isoValue);
			return finalizeTimestamp(parsedTimestamp);
		}

		if (typeof candidate.toMillis === 'function') {
			return finalizeTimestamp(candidate.toMillis());
		}
	}

	throw new NodeOperationError(context.getNode(), `Invalid ${fieldDisplayName} timestamp`, {
		itemIndex,
	});
}

const properties: INodeProperties[] = [
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Filter or Pagination Option',
		options: [
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				description: 'Max number of results to return',
				typeOptions: { minValue: 1, maxValue: 100 },
			},
			{
				displayName: 'Modified After',
				name: 'modifiedAfter',
				type: 'number',
				default: 0,
				description:
					'Optional lower-bound last-modified filter (`modified_after`) as an epoch timestamp in milliseconds. Use `0` to omit this filter.',
				typeOptions: { minValue: 0 },
			},
			{
				displayName: 'Modified Before',
				name: 'modifiedBefore',
				type: 'number',
				default: 0,
				description:
					'Optional upper-bound last-modified filter (`modified_before`) as an epoch timestamp in milliseconds. Use `0` to omit this filter.',
				typeOptions: { minValue: 0 },
			},
			{
				displayName: 'Drafts',
				name: 'drafts',
				type: 'boolean',
				default: false,
				description:
					'Whether to return only chats that currently contain drafts. When disabled, the filter is omitted.',
			},
		],
	},
	...getSimplifyParameters('chatListItem', 'chat', 'list'),
	{
		displayName:
			'List Chats Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-chats" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Chats.READ</code>',
		name: 'listChatsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Chat/List Chats as AI Tool Setup Guide: <a href="${CHAT_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listChatsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['chat'],
		operation: ['list'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('chat', 'list');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const qs: Record<string, string | number | boolean> = {};
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			let requestedLimit: number | undefined;

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				requestedLimit = validateLimit(this, additionalFields.limit, i);
				qs.limit = requestedLimit;
			}

			const modifiedAfter = resolveTimestampFilter(
				this,
				additionalFields.modifiedAfter,
				'Modified After',
				i,
			);
			if (modifiedAfter !== undefined) {
				qs.modified_after = modifiedAfter;
			}

			const modifiedBefore = resolveTimestampFilter(
				this,
				additionalFields.modifiedBefore,
				'Modified Before',
				i,
			);
			if (modifiedBefore !== undefined) {
				qs.modified_before = modifiedBefore;
			}

			if (
				modifiedAfter !== undefined &&
				modifiedBefore !== undefined &&
				modifiedAfter > modifiedBefore
			) {
				throw new NodeOperationError(
					this.getNode(),
					'Modified After cannot be later than Modified Before',
					{
						itemIndex: i,
					},
				);
			}

			if (additionalFields.drafts === true) {
				qs.drafts = true;
			}

			const response = (await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/chats',
				{},
				qs,
			)) as IDataObject;
			const chats = Array.isArray(response.chats) ? response.chats : undefined;
			const responseForOutput =
				requestedLimit !== undefined && chats && chats.length > requestedLimit
					? { ...response, chats: chats.slice(0, requestedLimit) }
					: response;

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('chatListItem');
			const listItems = applySimplifyModeToList(
				responseForOutput,
				'chats',
				mode,
				config,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			if (pushChatRecoverableError(this, returnData, i, 'list', error)) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
