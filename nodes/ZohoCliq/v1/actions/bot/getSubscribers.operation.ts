/**
 * Retrieve Bot Subscribers operation
 */

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
import { BOT_GET_SUBSCRIBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { buildExecutionItemsFromApiResponse } from '../shared/responseOutput';
import { pushBotRecoverableError, validateBotUniqueName } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Bot Unique Name',
		name: 'botUniqueName',
		type: 'string',
		default: '',
		required: true,
		description:
			'Unique bot identifier from Cliq (string path parameter). Use the bot unique name, not bot display name or bot ID. Allowed characters: lowercase letters only (a-z).',
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'App Key',
				name: 'appkey',
				type: 'string',
				default: '',
				description:
					'Extension app key string. Required only when the selected bot belongs to an extension app; leave empty for regular bots.',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				description: 'Max number of results to return',
				hint: 'Optional page size (`limit`). Use a whole number from 1 to 100.',
				typeOptions: { minValue: 1, maxValue: 100, numberPrecision: 0 },
			},
			{
				displayName: 'Next Token',
				name: 'nextToken',
				type: 'string',
				default: '',
				description:
					'Opaque pagination token from a previous subscribers response (`next_token`). Use for standard pagination and provide exactly as returned. Do not combine with Sync Token.',
				typeOptions: { password: true },
			},
			{
				displayName: 'Sync Token',
				name: 'syncToken',
				type: 'string',
				default: '',
				description:
					'Opaque sync token from a previous subscribers response (`sync_token`) to fetch only newly subscribed users since the last sync point. Use this token alone (without Next Token).',
				typeOptions: { password: true },
			},
		],
	},
	{
		displayName:
			'Retrieve Bot Subscribers Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Retrieve_Bot_Subscribers" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Bots.READ</code>',
		name: 'retrieveBotSubscribersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Bot/Retrieve Bot Subscribers as AI Tool Setup Guide: <a href="${BOT_GET_SUBSCRIBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'retrieveBotSubscribersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['bot'],
		operation: ['getSubscribers'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('bot', 'getSubscribers');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedBotUniqueName: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const botUniqueName = this.getNodeParameter('botUniqueName', i) as string;
			requestedBotUniqueName = botUniqueName;
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const sanitizedBotUniqueName = validateBotUniqueName(this, botUniqueName, i);
			const nextTokenValue = String(additionalFields.nextToken ?? '').trim();
			const syncTokenValue = String(additionalFields.syncToken ?? '').trim();
			const hasNextToken = nextTokenValue.length > 0;
			const hasSyncToken = syncTokenValue.length > 0;

			if (hasNextToken && hasSyncToken) {
				throw new NodeOperationError(
					this.getNode(),
					'Next Token and Sync Token cannot be used together. Provide only one token per request.',
					{ itemIndex: i },
				);
			}

			const qs: Record<string, string | number> = {};

			if (additionalFields.appkey !== undefined && additionalFields.appkey !== null) {
				const appkey = String(additionalFields.appkey).trim();
				if (appkey) {
					if (appkey.length > 300) {
						throw new NodeOperationError(this.getNode(), 'App Key is too long', {
							itemIndex: i,
						});
					}
					qs.appkey = appkey;
				}
			}

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				qs.limit = validateLimit(this, additionalFields.limit, i);
			}

			if (hasNextToken) {
				qs.next_token = validateNextToken(this, nextTokenValue, i);
			}

			if (hasSyncToken) {
				qs.sync_token = validateToken(this, syncTokenValue, i, 'Sync Token');
			}

			const endpoint = `/api/v2/bots/${encodeURIComponent(sanitizedBotUniqueName)}/subscribers`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint, undefined, qs);

			const executionData = this.helpers.constructExecutionMetaData(
				buildExecutionItemsFromApiResponse(response, {
					arrayKey: 'subscribers',
				}),
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushBotRecoverableError(
					this,
					returnData,
					i,
					error,
					requestedBotUniqueName,
					'getSubscribers',
				)
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
