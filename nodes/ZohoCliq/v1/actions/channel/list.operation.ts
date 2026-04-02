/**
 * List Channels operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { zohoCliqApiRequest } from '../../transport';
import { CHANNEL_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateNextToken, validateToken } from '../../helpers/utils';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { pushChannelRecoverableError } from './shared';
import { applyDisplayOptions } from '../common.descriptions';

const LIST_CHANNEL_ID_EXAMPLE = 'P5452022000000451001';

function validateDelimitedIds(
	context: IExecuteFunctions,
	value: string,
	itemIndex: number,
	field: 'channel_ids' | 'chat_ids' | 'team_ids',
): string {
	const parts = value.split(',').map((part) => part.trim());

	if (parts.every((part) => part.length === 0)) {
		throw new NodeOperationError(context.getNode(), `${field} cannot be empty`, {
			itemIndex,
		});
	}

	if (parts.some((part) => part.length === 0)) {
		throw new NodeOperationError(
			context.getNode(),
			`${field} contains an empty segment. Remove extra commas and provide comma-separated IDs only.`,
			{
				itemIndex,
			},
		);
	}

	const validators: Record<typeof field, { pattern: RegExp; message: string }> = {
		channel_ids: {
			pattern: /^P[a-zA-Z0-9_-]{5,}$/,
			message: `channel_ids must be valid Zoho Cliq channel ID values in comma-separated format. Example: ${LIST_CHANNEL_ID_EXAMPLE}`,
		},
		chat_ids: {
			pattern: /^CT[a-zA-Z0-9_-]{4,}$/,
			message:
				'chat_ids must be valid Zoho Cliq chat ID values in comma-separated format. Example: CT1234567890',
		},
		team_ids: {
			pattern: /^T[a-zA-Z0-9_-]{4,}$/,
			message:
				'team_ids must be valid Zoho Cliq team ID values in comma-separated format. Example: T1234567890',
		},
	};

	const validator = validators[field];
	for (const part of parts) {
		if (!validator.pattern.test(part)) {
			throw new NodeOperationError(context.getNode(), validator.message, {
				itemIndex,
			});
		}
	}

	return parts.join(',');
}

const properties: INodeProperties[] = [
	{
		displayName: 'Level',
		name: 'level',
		type: 'options',
		options: [
			{ name: 'All Levels', value: '' },
			{ name: 'External', value: 'external' },
			{ name: 'Organization', value: 'organization' },
			{ name: 'Private', value: 'private' },
			{ name: 'Team', value: 'team' },
		],
		default: '',
		description:
			'Show only channels at this level. This does not exclude archived channels by itself; combine with Status = Created when you want active channels only.',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		options: [
			{ name: 'All Statuses', value: '' },
			{ name: 'Archived', value: 'archived' },
			{ name: 'Created', value: 'created' },
			{ name: 'Pending', value: 'pending' },
		],
		default: '',
		description: 'Show only channels with this status',
	},
	{
		displayName: 'Joined',
		name: 'joined',
		type: 'options',
		options: [
			{ name: 'All Channels', value: '' },
			{ name: 'Joined Only', value: 'true' },
			{ name: 'Not Joined Only', value: 'false' },
		],
		default: '',
		description:
			'Filter by membership state. Use Joined Only for channels you have joined, Not Joined Only for channels you have not joined, or leave unset for all channels.',
	},
	{
		displayName: 'Pinned Only',
		name: 'pinned',
		type: 'boolean',
		default: false,
		description: 'Whether to return only pinned channels',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		options: [
			{
				displayName: 'Channel IDs',
				name: 'channel_ids',
				type: 'string',
				default: '',
				description:
					'Optional comma-separated Zoho Cliq channel IDs. Example: P5452022000000451001,P5452022000000451002.',
				placeholder: 'e.g. P5452022000000451001,P5452022000000451002',
			},
			{
				displayName: 'Channel Name',
				name: 'name',
				type: 'string',
				default: '',
				description:
					'Server-side display-name filter. Supports substring matching, so partial names, prefixes, and suffixes all work. The # prefix is not required. This filters the channel display name only, not the unique name. Blank values are treated as omitted.',
				placeholder: 'e.g. Engineering Updates',
			},
			{
				displayName: 'Chat IDs',
				name: 'chat_ids',
				type: 'string',
				default: '',
				description: 'Show only channels with these chat IDs',
				placeholder: 'e.g. CT1234567890,CT0987654321',
			},
			{
				displayName: 'Created After',
				name: 'created_after',
				type: 'dateTime',
				default: '',
				description: 'Find channels created after this date',
			},
			{
				displayName: 'Created Before',
				name: 'created_before',
				type: 'dateTime',
				default: '',
				description: 'Find channels created before this date',
			},
			{
				displayName: 'Created By',
				name: 'created_by',
				type: 'string',
				default: '',
				description: 'Show only channels created by this person',
				placeholder: 'e.g. user@example.com',
			},
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
				name: 'modified_after',
				type: 'dateTime',
				default: '',
				description: 'Find channels updated after this date',
			},
			{
				displayName: 'Modified Before',
				name: 'modified_before',
				type: 'dateTime',
				default: '',
				description: 'Find channels updated before this date',
			},
			{
				displayName: 'Next Token',
				name: 'next_token',
				type: 'string',
				default: '',
				description:
					'Opaque pagination cursor from the previous response. Reuse exactly as returned to fetch the next page. Do not combine with Sync Token, which is a separate delta-sync cursor from an earlier response.',
				typeOptions: { password: true },
			},
			{
				displayName: 'Order By',
				name: 'order_by',
				type: 'options',
				options: [
					{ name: 'Created (Ascending)', value: '+creation_time' },
					{ name: 'Created (Descending)', value: '-creation_time' },
					{ name: 'Last Modified (Ascending)', value: '+last_modified_time' },
					{ name: 'Last Modified (Descending)', value: '-last_modified_time' },
				],
				default: '-last_modified_time',
				description:
					'How to sort the channels. Example: -last_modified_time returns most recently updated channels first.',
			},
			{
				displayName: 'Sync Token',
				name: 'sync_token',
				type: 'string',
				default: '',
				description:
					'Opaque delta-sync cursor from a previous response. Use this by itself, without Next Token, to fetch channels changed since that sync point. Do not combine with Next Token.',
				typeOptions: { password: true },
			},
			{
				displayName: 'Team IDs',
				name: 'team_ids',
				type: 'string',
				default: '',
				description:
					'Optional comma-separated team IDs. Zoho documents this as a server-side filter, but live behavior may ignore it and still return channels outside those teams. Validate the returned teams data before assuming the filter was enforced.',
				placeholder: 'e.g. T1234567890,T0987654321',
			},
		],
	},
	...getSimplifyParameters('channelListItem', 'channel', 'list'),
	{
		displayName:
			'List Channels Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_List_all_channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.READ</code>',
		name: 'listChannelsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/List Channels as AI Tool Setup Guide: <a href="${CHANNEL_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listChannelsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['list'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'list');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let usedNextToken = false;
		let usedSyncToken = false;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const qs: Record<string, string | number | boolean> = {};

			const level = this.getNodeParameter('level', i) as string;
			const status = this.getNodeParameter('status', i) as string;
			const joinedRaw = this.getNodeParameter('joined', i, '') as string | boolean;
			const pinned = this.getNodeParameter('pinned', i) as boolean;

			if (level) {
				const validLevels = ['organization', 'team', 'private', 'external'];
				if (!validLevels.includes(level)) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid level: "${level}". Must be one of: ${validLevels.join(', ')}`,
						{ itemIndex: i },
					);
				}
				qs.level = level;
			}

			if (status) {
				const validStatuses = ['created', 'pending', 'archived'];
				if (!validStatuses.includes(status)) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid status: "${status}". Must be one of: ${validStatuses.join(', ')}`,
						{ itemIndex: i },
					);
				}
				qs.status = status;
			}

			const joined = typeof joinedRaw === 'boolean' ? String(joinedRaw) : String(joinedRaw).trim();
			if (joined) {
				if (!['true', 'false'].includes(joined)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid joined filter. Allowed values: true, false',
						{ itemIndex: i },
					);
				}
				qs.joined = joined === 'true';
			}
			if (pinned) qs.pinned = true;

			const additionalFieldsRaw = this.getNodeParameter('additionalFields', i, {}) as
				| IDataObject
				| undefined;
			const additionalFields = additionalFieldsRaw ?? {};

			const name = String(additionalFields.name ?? '').trim();
			if (name) {
				if (name.length > 255) {
					throw new NodeOperationError(this.getNode(), 'name is too long', {
						itemIndex: i,
					});
				}
				qs.name = name;
			}

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				const limit = Number(additionalFields.limit);
				if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
					throw new NodeOperationError(this.getNode(), 'Limit must be between 1 and 100', {
						itemIndex: i,
					});
				}
				qs.limit = limit;
			}

			const timestampFields = [
				'modified_after',
				'modified_before',
				'created_after',
				'created_before',
			];
			for (const field of timestampFields) {
				const rawTimestamp = String(additionalFields[field] ?? '').trim();
				if (!rawTimestamp) {
					continue;
				}
				const timestamp = /^\d+$/.test(rawTimestamp)
					? Number(rawTimestamp)
					: new Date(rawTimestamp).getTime();
				if (!Number.isFinite(timestamp)) {
					throw new NodeOperationError(this.getNode(), `Invalid ${field} timestamp`, {
						itemIndex: i,
					});
				}
				qs[field] = timestamp;
			}

			const idFields = ['channel_ids', 'chat_ids', 'team_ids'];
			for (const field of idFields) {
				const ids = String(additionalFields[field] ?? '').trim();
				if (!ids) {
					continue;
				}
				qs[field] = validateDelimitedIds(
					this,
					ids,
					i,
					field as 'channel_ids' | 'chat_ids' | 'team_ids',
				);
			}

			const creator = String(additionalFields.created_by ?? '').trim();
			if (creator) {
				if (creator.length > 255 || /\s/.test(creator)) {
					throw new NodeOperationError(
						this.getNode(),
						'Invalid created_by format. Use a non-whitespace email or user ID value',
						{ itemIndex: i },
					);
				}
				qs.created_by = creator;
			}

			const orderBy = String(additionalFields.order_by ?? '').trim();
			if (orderBy) {
				const validOrderBy = [
					'+last_modified_time',
					'-last_modified_time',
					'+creation_time',
					'-creation_time',
				];
				if (!validOrderBy.includes(orderBy)) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid order_by: "${orderBy}". Must be one of: ${validOrderBy.join(', ')}`,
						{ itemIndex: i },
					);
				}
				qs.order_by = orderBy;
			}

			const nextTokenRaw = String(additionalFields.next_token ?? '').trim();
			const syncTokenRaw = String(additionalFields.sync_token ?? '').trim();
			if (nextTokenRaw && syncTokenRaw) {
				throw new NodeOperationError(
					this.getNode(),
					'Next Token and Sync Token cannot be used together. Provide only one token per request.',
					{ itemIndex: i },
				);
			}

			if (nextTokenRaw) {
				qs.next_token = validateNextToken(this, nextTokenRaw, i);
				usedNextToken = true;
			}

			if (syncTokenRaw) {
				qs.sync_token = validateToken(this, syncTokenRaw, i, 'Sync Token');
				usedSyncToken = true;
			}

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/channels', {}, qs);

			// Apply pinned post-filter before simplification
			let responseForOutput = coerceApiResponseToObject(response);
			if (
				pinned &&
				responseForOutput &&
				typeof responseForOutput === 'object' &&
				!Array.isArray(responseForOutput)
			) {
				const channels = responseForOutput.channels;
				if (Array.isArray(channels)) {
					responseForOutput = {
						...responseForOutput,
						channels: channels.filter(
							(channel) =>
								channel && typeof channel === 'object' && (channel as IDataObject).pinned === true,
						),
					};
				}
			}

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('channelListItem');
			const listItems = applySimplifyModeToList(
				responseForOutput,
				'channels',
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
			if (
				pushChannelRecoverableError(this, returnData, i, 'list', error, {
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
							reason: 'BAD_REQUEST',
							hint: 'Retry with minimal filters first (for example only limit), then add filters incrementally to isolate the invalid input.',
						},
						{
							match: (normalizedMessage) =>
								(usedNextToken || usedSyncToken) &&
								(normalizedMessage.includes(
									"couldn't process your request due to a technical error",
								) ||
									normalizedMessage.includes('technical error') ||
									normalizedMessage.includes('try again later')),
							reason: 'BAD_REQUEST',
							hint: usedNextToken
								? 'Next Token appears invalid or expired. Re-run the first page without Next Token and reuse the new next_token exactly as returned.'
								: 'Sync Token appears invalid or expired. Start a fresh sync without Sync Token and reuse the new sync_token exactly as returned.',
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
