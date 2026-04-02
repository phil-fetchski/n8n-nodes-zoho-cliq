/**
 * List Reminders operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { REMINDERS_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateLimit, validateNextToken } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushRemindersRecoverableError, validateReminderCategory } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'list');

const properties: INodeProperties[] = [
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Category',
				name: 'category',
				type: 'options',
				default: 'mine',
				options: [
					{ name: 'Mine', value: 'mine' },
					{ name: 'Mine Completed', value: 'mine-completed' },
					{ name: 'Others', value: 'others' },
					{ name: 'Others Completed', value: 'others-completed' },
				],
				description:
					'Optional reminder category to list. Allowed values: mine, mine-completed, others, others-completed.',
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
				displayName: 'Next Set Token',
				name: 'nextSetToken',
				type: 'string',
				default: '',
				description:
					'Optional pagination token from a previous reminders list response. Blank values are allowed and omitted.',
				typeOptions: { password: true },
			},
		],
	},
	{
		displayName: `List Reminders Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#list_all_reminders" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'listRemindersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/List Reminders as AI Tool Setup Guide: <a href="${REMINDERS_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listRemindersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
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
		let rawNextSetToken: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const qs: Record<string, string | number> = {};
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

			const rawCategory = String(additionalFields.category ?? '').trim();
			if (rawCategory) {
				qs.category = validateReminderCategory(this, rawCategory, i);
			}

			if (
				additionalFields.limit !== undefined &&
				additionalFields.limit !== null &&
				String(additionalFields.limit).trim() !== ''
			) {
				qs.limit = validateLimit(this, additionalFields.limit, i);
			}

			rawNextSetToken = String(additionalFields.nextSetToken ?? '').trim();
			if (rawNextSetToken) {
				qs.next_set_token = validateNextToken(this, rawNextSetToken, i);
			}

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/reminders', {}, qs);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'list', error, {
					contextFields: rawNextSetToken ? { next_set_token: rawNextSetToken } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('invalid category'),
							reason: 'INVALID_CATEGORY',
							hint: 'Use one of: mine, mine-completed, others, others-completed.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('limit'),
							reason: 'INVALID_LIMIT',
							hint: 'Use a whole-number limit from 1 to 100.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('next set token') ||
								normalizedMessage.includes('next_set_token') ||
								normalizedMessage.includes('next token'),
							reason: 'INVALID_PAGINATION_TOKEN',
							hint: 'Use the exact next_set_token returned by a previous reminders list response, or leave it blank.',
						},
						{
							match: (normalizedMessage) =>
								(normalizedMessage.includes(
									"couldn't process your request due to a technical error",
								) ||
									normalizedMessage.includes('technical error')) &&
								Boolean(rawNextSetToken),
							reason: 'INVALID_PAGINATION_TOKEN',
							hint: 'The next_set_token may be expired or malformed. Re-list from the beginning without a token.',
							messageOverride:
								'Zoho Cliq could not continue this reminder list request with the supplied next_set_token. The pagination token may be expired, malformed, or no longer valid for this query.',
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
