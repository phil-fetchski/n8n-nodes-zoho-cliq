import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { BULK_ACTION_EXPORT_CHANNELS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopesForOperationOrThrow } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	getOptionalMaintenanceNextToken,
	getMaintenanceRequestHeaders,
	getMaintenanceResponseData,
	pushBulkActionRecoverableError,
	validateChannelExportFields,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScopes = getRequiredScopesForOperationOrThrow('bulkAction', 'exportChannels');
const requiredScopesText = requiredScopes.map((scope) => `<code>${scope}</code>`).join(', ');

const properties: INodeProperties[] = [
	{
		displayName: 'Channel Fields',
		name: 'channelFields',
		type: 'multiOptions',
		default: ['name', 'channel_id', 'participant_count'],
		required: true,
		description:
			'Choose one or more channel fields to include as columns in the organization-wide export',
		options: [
			{ name: 'Channel ID', value: 'channel_id' },
			{ name: 'Creation Time', value: 'creation_time' },
			{ name: 'Creator ID', value: 'creator_id' },
			{ name: 'Description', value: 'description' },
			{ name: 'Last Modified Time', value: 'last_modified_time' },
			{ name: 'Name', value: 'name' },
			{ name: 'Participant Count', value: 'participant_count' },
			{ name: 'Status', value: 'status' },
			{ name: 'Total Message Count', value: 'total_message_count' },
		],
	},
	{
		displayName: 'Next Token',
		name: 'nextToken',
		type: 'string',
		default: '',
		typeOptions: { password: true },
		description:
			'Optional. Opaque pagination cursor returned by a previous bulk export response as next_token. Reuse exactly as returned to fetch the next page. Blank values are allowed and omitted.',
	},
	{
		displayName: `Export Channels Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#export-channels" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: ${requiredScopesText}`,
		name: 'exportChannelsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq BulkAction/Export Channels as AI Tool Setup Guide: <a href="${BULK_ACTION_EXPORT_CHANNELS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'exportChannelsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['bulkAction'],
		operation: ['exportChannels'],
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
		let fields: string | undefined;
		let nextTokenRaw: string | undefined;
		let nextToken: string | undefined;

		try {
			for (const requiredScope of requiredScopes) {
				checkRequiredScope(this, grantedScopes, requiredScope, i);
			}

			const channelFields = this.getNodeParameter('channelFields', i, []) as string[];
			fields = validateChannelExportFields(this, channelFields, i);
			nextTokenRaw = String(this.getNodeParameter('nextToken', i, '') ?? '').trim();
			nextToken = getOptionalMaintenanceNextToken(this, nextTokenRaw, i);
			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				'/maintenanceapi/v2/channels',
				undefined,
				{
					fields,
					...(nextToken ? { next_token: nextToken } : {}),
				},
				{
					headers: getMaintenanceRequestHeaders(),
					json: false,
				},
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: getMaintenanceResponseData(this, response, i) }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushBulkActionRecoverableError(this, returnData, i, 'exportChannels', error, {
					contextFields: {
						...(fields ? ({ fields } as IDataObject) : {}),
						...(nextTokenRaw ? { next_token: '[REDACTED]' } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('channel fields'),
							reason: 'INVALID_CHANNEL_FIELDS',
							hint: 'Choose one or more unique channel fields from ["name", "channel_id", "creation_time", "last_modified_time", "creator_id", "description", "participant_count", "total_message_count", "status"].',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('next token'),
							reason: 'INVALID_NEXT_TOKEN',
							hint: 'Use the exact next_token value returned by the previous bulk export response.',
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
