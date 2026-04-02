import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import {
	checkRequiredScope,
	validateLimit,
	validateNextToken,
	validateToken,
} from '../../helpers/utils';
import { CALLS_MEETING_LIST_CALL_RECORDINGS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { buildCliqRecoverableErrorPayload } from '../shared/errorResponse';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	validateHistoryFilter,
	validateMediaSessionTypes,
	validateNumericId,
	validateNumericIdList,
	validateSearchTerm,
	validateTimestampParam,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		placeholder: 'Add Field',
		options: [
			{
				displayName: 'Filter',
				name: 'filter',
				type: 'options',
				default: 'live',
				options: [
					{ name: 'Dialled', value: 'dialled' },
					{ name: 'Live', value: 'live' },
					{ name: 'Missed', value: 'missed' },
					{ name: 'Received', value: 'received' },
					{ name: 'Scheduled', value: 'scheduled' },
					{ name: 'Viewed', value: 'viewed' },
				],
				description:
					'History filter option. `missed`, `received`, and `dialled` are valid only when Type is exactly `direct_call`.',
			},
			{
				displayName: 'From Time',
				name: 'from',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				description:
					'Lower-bound Unix timestamp in milliseconds (`from`). Only sessions on/after this value are returned.',
			},
			{
				displayName: 'Host ID',
				name: 'hostId',
				type: 'string',
				default: '',
				description: 'Host user ID filter (`host_id`). Digits only.',
			},
			{
				displayName: 'Last Modified Time',
				name: 'lastModified',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				description:
					'Unix timestamp in milliseconds for incremental sync (`last_modified`). Returns sessions modified after this time.',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: {
					minValue: 1,
					maxValue: 100,
				},
				description: 'Max number of results to return',
			},
			{
				displayName: 'Next Token',
				name: 'nextToken',
				type: 'string',
				default: '',
				typeOptions: { password: true },
				description:
					'Opaque pagination token (`next_token`) from a previous response. Must be used alone without other filters.',
			},
			{
				displayName: 'Recipient ID',
				name: 'recipientId',
				type: 'string',
				default: '',
				description: 'Recipient user ID filter (`recipient_id`). Digits only.',
			},
			{
				displayName: 'Recipient IDs',
				name: 'recipientIds',
				type: 'string',
				default: '',
				placeholder: 'e.g. 12345,67890',
				description:
					'Comma-separated recipient user IDs (`recipient_ids`). Digits only per ID; duplicates are removed.',
			},
			{
				displayName: 'Search',
				name: 'search',
				type: 'string',
				default: '',
				description: 'Case-insensitive call title search text (`search`)',
			},
			{
				displayName: 'Sync Token',
				name: 'syncToken',
				type: 'string',
				default: '',
				typeOptions: { password: true },
				description:
					'Opaque sync token (`sync_token`) from a previous response. Must be used alone without other filters.',
			},
			{
				displayName: 'To Time',
				name: 'to',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				description:
					'Upper-bound Unix timestamp in milliseconds (`to`). Only sessions on/before this value are returned.',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Assembly', value: 'assembly' },
					{ name: 'Audio Conference', value: 'audio_conference' },
					{ name: 'Direct Call', value: 'direct_call' },
					{ name: 'Handshake', value: 'handshake' },
					{ name: 'Video Conference', value: 'video_conference' },
				],
				description:
					'Media session types (`type`). `all` and `direct_call` cannot be combined with any other type.',
			},
		],
	},
	...getSimplifyParameters('callMeetingItem', 'callsMeeting', 'listCallRecordings'),
	{
		displayName:
			'List Call Recordings Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#AV_History" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.MediaSession.READ</code>',
		name: 'listCallRecordingsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq CallsMeeting/List Call Recordings as AI Tool Setup Guide: <a href="${CALLS_MEETING_LIST_CALL_RECORDINGS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listCallRecordingsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['callsMeeting'],
		operation: ['listCallRecordings'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('callsMeeting', 'listCallRecordings');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const qs: Record<string, string | number> = {};
			const filterValue = String(additionalFields.filter ?? '').trim();
			const hostIdValue = String(additionalFields.hostId ?? '').trim();
			const nextTokenValue = String(additionalFields.nextToken ?? '').trim();
			const recipientIdValue = String(additionalFields.recipientId ?? '').trim();
			const recipientIdsValue = String(additionalFields.recipientIds ?? '').trim();
			const searchValue = String(additionalFields.search ?? '').trim();
			const syncTokenValue = String(additionalFields.syncToken ?? '').trim();

			const selectedType = validateMediaSessionTypes(this, additionalFields.type, i);
			if (selectedType !== undefined) {
				qs.type = selectedType;
			}

			if (filterValue) {
				const selectedFilter = validateHistoryFilter(this, filterValue, i);
				if (selectedType === 'all') {
					throw new NodeOperationError(
						this.getNode(),
						'Filter cannot be used when Type is set to "All"',
						{ itemIndex: i },
					);
				}

				if (
					['missed', 'received', 'dialled'].includes(selectedFilter) &&
					selectedType !== 'direct_call'
				) {
					throw new NodeOperationError(
						this.getNode(),
						'Filter "Missed", "Received", and "Dialled" require Type to be only "Direct Call"',
						{ itemIndex: i },
					);
				}

				qs.filter = selectedFilter;
			}

			if (additionalFields.from !== undefined && additionalFields.from !== null) {
				const fromTimestamp = validateTimestampParam(this, additionalFields.from, 'From Time', i);
				if (fromTimestamp > 0) {
					qs.from = fromTimestamp;
				}
			}

			if (hostIdValue) {
				qs.host_id = validateNumericId(this, hostIdValue, 'Host ID', i);
			}

			if (additionalFields.lastModified !== undefined && additionalFields.lastModified !== null) {
				const lastModifiedTimestamp = validateTimestampParam(
					this,
					additionalFields.lastModified,
					'Last Modified Time',
					i,
				);
				if (lastModifiedTimestamp > 0) {
					qs.last_modified = lastModifiedTimestamp;
				}
			}

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				qs.limit = validateLimit(this, additionalFields.limit, i);
			}

			if (nextTokenValue) {
				qs.next_token = validateNextToken(this, nextTokenValue, i);
			}

			if (recipientIdValue) {
				qs.recipient_id = validateNumericId(this, recipientIdValue, 'Recipient ID', i);
			}

			if (recipientIdsValue) {
				qs.recipient_ids = validateNumericIdList(this, recipientIdsValue, 'Recipient IDs', i);
			}

			if (searchValue) {
				qs.search = validateSearchTerm(this, searchValue, i);
			}

			if (syncTokenValue) {
				qs.sync_token = validateToken(this, syncTokenValue, i, 'Sync Token');
			}

			if (additionalFields.to !== undefined && additionalFields.to !== null) {
				const toTimestamp = validateTimestampParam(this, additionalFields.to, 'To Time', i);
				if (toTimestamp > 0) {
					qs.to = toTimestamp;
				}
			}

			if (qs.from !== undefined && qs.to !== undefined && Number(qs.from) > Number(qs.to)) {
				throw new NodeOperationError(this.getNode(), 'From Time cannot be greater than To Time', {
					itemIndex: i,
				});
			}

			const hasTokenPagination = qs.next_token !== undefined || qs.sync_token !== undefined;
			if (hasTokenPagination) {
				const forbiddenParams = [
					'type',
					'search',
					'limit',
					'from',
					'to',
					'last_modified',
					'filter',
					'host_id',
					'recipient_id',
					'recipient_ids',
				];
				const hasForbiddenParam = forbiddenParams.some((param) => qs[param] !== undefined);
				if (hasForbiddenParam) {
					throw new NodeOperationError(
						this.getNode(),
						'Next Token and Sync Token cannot be combined with any other query parameter',
						{ itemIndex: i },
					);
				}
			}

			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/mediasessions',
				undefined,
				qs,
			);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('callMeetingItem');
			const listItems = applySimplifyModeToList(response, 'data', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (typeof this.continueOnFail === 'function' && this.continueOnFail()) {
				const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload;
				if (scopePayload && typeof scopePayload === 'object' && !Array.isArray(scopePayload)) {
					const executionData = this.helpers.constructExecutionMetaData(
						[{ json: { ...(scopePayload as IDataObject) } }],
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
					continue;
				}

				const errorPayload = buildCliqRecoverableErrorPayload(error, {
					resource: 'callsMeeting',
					operation: 'listCallRecordings',
				});
				const executionData = this.helpers.constructExecutionMetaData([{ json: errorPayload }], {
					itemData: { item: i },
				});
				returnData.push(...executionData);
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
