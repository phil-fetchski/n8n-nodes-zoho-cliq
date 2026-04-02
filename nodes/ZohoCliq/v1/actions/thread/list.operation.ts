/**
 * List Threads operation
 * Retrieves a list of threads in a channel with optional filters
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { THREAD_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import { applyDisplayOptions, channelIdOnlyRLC } from '../common.descriptions';
import {
	checkRequiredScope,
	validateChannelId,
	validateLimit,
	validateNextToken,
	validateToken,
	validateThreadStateFilter,
	validateThreadTypeFilter,
} from '../../helpers/utils';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE,
	CHANNEL_NOT_FOUND_HINT,
	runChannelIdLookupPreflightGate,
} from '../shared/preflight';
import { normalizeThreadResponseMessageIds, pushThreadRecoverableError } from './common';

const requiredScope = getRequiredScopeForOperation('thread', 'list');

function isChannelLookupNotFoundError(error: unknown): boolean {
	return (
		error instanceof NodeOperationError &&
		(error as NodeOperationError & { code?: string }).code === CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE
	);
}

const properties: INodeProperties[] = [
	{
		...channelIdOnlyRLC,
		description: 'The channel to list threads from',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				default: 50,
				description: 'Max number of results to return',
			},
			{
				displayName: 'Next Token',
				name: 'nextToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Pagination token from previous response',
			},
			{
				displayName: 'State',
				name: 'state',
				type: 'options',
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Followed', value: 'followed' },
					{ name: 'Not Followed', value: 'not_followed' },
				],
				default: 'all',
				description: 'Filter by follow status',
			},
			{
				displayName: 'Sync Token',
				name: 'syncToken',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description:
					'Opaque sync cursor from a previous response. Use this alone, without Next Token, to fetch changes since the last sync point.',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'None', value: '' },
					{ name: 'Open', value: 'open' },
					{ name: 'Closed', value: 'closed' },
				],
				default: '',
				description: 'Filter threads by current status',
			},
		],
	},
	...getSimplifyParameters('threadListItem', 'thread', 'list'),
	{
		displayName: `List Threads for Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get-thread" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'listThreadsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/List Threads for Channel as AI Tool Setup Guide: <a href="${THREAD_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listThreadsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['list'],
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
		let sanitizedChannelId = '';
		let state: string | undefined;
		let type: string | undefined;
		let limit: number | undefined;
		let nextToken: string | undefined;
		let syncToken: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelId = this.getNodeParameter('channelId', i, '', {
				extractValue: true,
			}) as string;
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

			// Validate channel ID
			sanitizedChannelId = validateChannelId(this, channelId, i);
			await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedChannelId);

			// Build query parameters (camelCase → snake_case)
			const qs: Record<string, string | number | boolean> = {};
			const body: Record<string, string | number> = {};

			if (additionalFields.state) {
				state = validateThreadStateFilter(this, additionalFields.state as string, i);
				qs.state = state;
			}

			if (additionalFields.type) {
				type = validateThreadTypeFilter(this, additionalFields.type as string, i);
				qs.type = type;
			}

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				const limitInput =
					typeof additionalFields.limit === 'string'
						? additionalFields.limit.trim()
						: additionalFields.limit;
				if (limitInput !== '') {
					limit = validateLimit(this, limitInput, i);
				}
			}
			if (limit !== undefined) {
				body.limit = limit;
				qs.limit = limit;
			}

			if (additionalFields.nextToken !== undefined && additionalFields.nextToken !== null) {
				const nextTokenInput = String(additionalFields.nextToken).trim();
				if (nextTokenInput) {
					nextToken = validateNextToken(this, nextTokenInput, i);
				}
			}
			if (nextToken) {
				body.next_token = nextToken;
				qs.next_token = nextToken;
			}

			if (additionalFields.syncToken !== undefined && additionalFields.syncToken !== null) {
				const syncTokenInput = String(additionalFields.syncToken).trim();
				if (syncTokenInput) {
					syncToken = validateToken(this, syncTokenInput, i, 'Sync Token');
				}
			}
			if (nextToken && syncToken) {
				throw new NodeOperationError(
					this.getNode(),
					'Next Token and Sync Token cannot be used together. Provide only one token per request.',
					{ itemIndex: i },
				);
			}
			if (syncToken) {
				body.sync_token = syncToken;
				qs.sync_token = syncToken;
			}

			const endpoint = `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}/threads`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint, body, qs);

			const normalized = normalizeThreadResponseMessageIds(response) as IDataObject;

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('threadListItem');
			const listItems = applySimplifyModeToList(normalized, 'data', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{
					itemData: { item: i },
				},
			);

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushThreadRecoverableError(this, returnData, i, 'list', error, {
					contextFields: {
						channel_id: sanitizedChannelId,
						state,
						type,
						limit,
						next_token: nextToken,
						sync_token: syncToken,
					},
					fallbackMessage: 'Unable to list threads for the channel in Zoho Cliq.',
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								isChannelLookupNotFoundError(mappedError),
							reason: 'CHANNEL_NOT_FOUND',
							hint: CHANNEL_NOT_FOUND_HINT,
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
