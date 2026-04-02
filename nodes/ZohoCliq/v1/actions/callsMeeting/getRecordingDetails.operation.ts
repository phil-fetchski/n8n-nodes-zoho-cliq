import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateLimit, validateNextToken } from '../../helpers/utils';
import { CALLS_MEETING_GET_RECORDING_DETAILS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { buildCliqRecoverableErrorPayload } from '../shared/errorResponse';
import { buildExecutionItemsFromApiResponse } from '../shared/responseOutput';
import {
	validateMediaSessionId,
	validateParticipantsFilter,
	validateTimestampParam,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Media Session ID',
		name: 'mediaSessionId',
		type: 'string',
		default: '',
		required: true,
		description:
			'Media session identifier (`CALL_ID`) from call history, typically `nrs_id`. Use this value exactly to fetch participant details.',
	},
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
					{ name: 'Live', value: 'live' },
					{ name: 'Invited', value: 'invited' },
					{ name: 'Joined', value: 'joined' },
				],
				description:
					'Participant state filter: `live` (currently connected), `invited` (not joined), `joined` (joined and left)',
			},
			{
				displayName: 'From Time',
				name: 'from',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				description: 'Lower-bound Unix timestamp in milliseconds (`from`) for participant activity',
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
				description: 'Opaque pagination token (`next_token`) from a previous participants response',
			},
			{
				displayName: 'To Time',
				name: 'to',
				type: 'number',
				default: 0,
				typeOptions: {
					minValue: 0,
				},
				description: 'Upper-bound Unix timestamp in milliseconds (`to`) for participant activity',
			},
		],
	},
	{
		displayName:
			'Get Recording Participants & Details Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Participants" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.MediaSession.READ</code>',
		name: 'getRecordingParticipantsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq CallsMeeting/Get Recording Participants & Details as AI Tool Setup Guide: <a href="${CALLS_MEETING_GET_RECORDING_DETAILS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getRecordingParticipantsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['callsMeeting'],
		operation: ['getRecordingDetails'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('callsMeeting', 'getRecordingDetails');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedMediaSessionId: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const mediaSessionId = this.getNodeParameter('mediaSessionId', i) as string;
			requestedMediaSessionId = mediaSessionId.trim();
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const sanitizedMediaSessionId = validateMediaSessionId(this, requestedMediaSessionId, i);
			const filterValue = String(additionalFields.filter ?? '').trim();
			const nextTokenValue = String(additionalFields.nextToken ?? '').trim();

			const qs: Record<string, string | number> = {};

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				qs.limit = validateLimit(this, additionalFields.limit, i);
			}

			if (nextTokenValue) {
				qs.next_token = validateNextToken(this, nextTokenValue, i);
			}

			if (filterValue) {
				qs.filter = validateParticipantsFilter(this, filterValue, i);
			}

			if (additionalFields.from !== undefined && additionalFields.from !== null) {
				const fromTimestamp = validateTimestampParam(this, additionalFields.from, 'From Time', i);
				if (fromTimestamp > 0) {
					qs.from = fromTimestamp;
				}
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

			const endpoint = `/api/v2/mediasessions/${encodeURIComponent(sanitizedMediaSessionId)}/participants`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint, undefined, qs, {
				headers: {
					'X-API-VERSION': '1',
				},
			});

			const executionData = this.helpers.constructExecutionMetaData(
				buildExecutionItemsFromApiResponse(response, {
					arrayKey: 'participants',
				}),
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

				const errorPayload = buildCliqRecoverableErrorPayload(
					error,
					{
						resource: 'callsMeeting',
						operation: 'getRecordingDetails',
					},
					{
						contextFields:
							requestedMediaSessionId && requestedMediaSessionId.length > 0
								? {
										media_session_id: requestedMediaSessionId,
									}
								: undefined,
					},
				);
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
