/**
 * List Users operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { USER_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateLimit, validateNextToken } from '../../helpers/utils';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import {
	pushUserRecoverableError,
	USER_ALLOWED_FIELDS,
	USER_ALLOWED_PLAN_TYPES,
	USER_ALLOWED_SORT_BY,
	USER_ALLOWED_STATUSES,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('user', 'list');

const properties: INodeProperties[] = [
	{
		displayName: 'Search',
		name: 'search',
		type: 'string',
		default: '',
		description: 'Search users by name or email',
	},
	{
		displayName:
			'Search Behavior: Optionally search users by name or email only for Cliq. If your account is integrated with Zoho People and you grant Zoho People scopes, search can include all Zoho People user fields.',
		name: 'searchBehaviorNotice',
		type: 'notice',
		default: '',
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
				default: 50,
				description: 'Max number of results to return',
				typeOptions: { minValue: 1, maxValue: 100 },
			},
			{
				displayName: 'Modified After',
				name: 'modifiedAfter',
				type: 'dateTime',
				default: '',
				description:
					'Fetch users modified after this timestamp. Accepts date-time input or expression values (including Unix timestamp strings). Changes are synced only for Department, Designation, Employee ID, Extension, Reporting To, and Work Location.',
			},
			{
				displayName: 'Next Token',
				name: 'nextToken',
				type: 'string',
				default: '',
				description: 'Continue from where a previous users listing stopped',
				typeOptions: { password: true },
			},
			{
				displayName: 'Plan Type',
				name: 'planType',
				type: 'options',
				default: '',
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Free', value: 'free' },
					{ name: 'Paid', value: 'paid' },
				],
				description:
					'Filter users by plan type. Some Zoho account types may reject this query parameter even when documented.',
			},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				default: '',
				options: [
					{ name: 'Any', value: '' },
					{ name: 'Usage', value: 'usage' },
				],
				description: 'Sort users by usage',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'options',
				default: '',
				options: [
					{ name: 'Active', value: 'active' },
					{ name: 'Any', value: '' },
					{ name: 'Imported Active', value: 'imported_active' },
					{ name: 'Imported Inactive', value: 'imported_inactive' },
					{ name: 'Inactive', value: 'inactive' },
					{ name: 'Pending', value: 'pending' },
				],
				description: 'Filter users by current status',
			},
		],
	},
	...getSimplifyParameters('user', 'user', 'list'),
	{
		displayName: `Retrieve All Users Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-user" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a><ul><li>Required Zoho Cliq Scope: <code>${requiredScope}</code></li><li>Optional Zoho People Scopes: <code>ZohoPeople.forms.READ</code>, <code>ZohoPeople.employee.READ</code>, <code>ZohoPeople.attendance.READ</code></li></ul>`,
		name: 'listUsersDocsNotice',
		type: 'notice',
		default: '',
		hint: 'OpenAPI documents date-time input for modified_after. This node also accepts Unix-millisecond timestamp strings and normalizes ISO date-time values before request dispatch.',
	},
	{
		displayName: `Zoho Cliq User/List Users as AI Tool Setup Guide: <a href="${USER_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listUsersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['user'],
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
		let requestedLimit: unknown;
		let requestedNextToken: string | undefined;
		let requestedPlanType: string | undefined;
		let requestedStatus: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const qs: Record<string, string | number> = {
				fields: ['all', ...USER_ALLOWED_FIELDS].join(','),
			};
			const search = String(this.getNodeParameter('search', i, '') ?? '').trim();
			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

			if (search) {
				qs.search = search;
			}

			if (additionalFields.limit !== undefined && additionalFields.limit !== null) {
				requestedLimit = additionalFields.limit;
				qs.limit = validateLimit(this, additionalFields.limit, i);
			}

			if (additionalFields.nextToken) {
				requestedNextToken = String(additionalFields.nextToken).trim() || undefined;
				qs.next_token = validateNextToken(this, additionalFields.nextToken, i);
			}

			const status = String(additionalFields.status ?? '').trim();
			if (status) {
				requestedStatus = status;
				if (!USER_ALLOWED_STATUSES.includes(status as (typeof USER_ALLOWED_STATUSES)[number])) {
					throw new NodeOperationError(this.getNode(), `Invalid status value "${status}"`, {
						itemIndex: i,
					});
				}
				qs.status = status;
			}

			const planType = String(additionalFields.planType ?? '').trim();
			if (planType) {
				requestedPlanType = planType;
				if (
					!USER_ALLOWED_PLAN_TYPES.includes(planType as (typeof USER_ALLOWED_PLAN_TYPES)[number])
				) {
					throw new NodeOperationError(this.getNode(), `Invalid plan_type value "${planType}"`, {
						itemIndex: i,
					});
				}
				qs.plan_type = planType;
			}

			const sortBy = String(additionalFields.sortBy ?? '').trim();
			if (sortBy) {
				if (!USER_ALLOWED_SORT_BY.includes(sortBy as (typeof USER_ALLOWED_SORT_BY)[number])) {
					throw new NodeOperationError(this.getNode(), `Invalid sort_by value "${sortBy}"`, {
						itemIndex: i,
					});
				}
				qs.sort_by = sortBy;
			}

			const modifiedAfterRaw = additionalFields.modifiedAfter;
			if (modifiedAfterRaw !== undefined && modifiedAfterRaw !== null) {
				const modifiedAfter = String(modifiedAfterRaw).trim();
				if (!modifiedAfter) {
					// no-op
				} else if (/^-?\d+$/.test(modifiedAfter)) {
					qs.modified_after = modifiedAfter;
				} else {
					const parsedTimestamp = Date.parse(modifiedAfter);
					if (!Number.isNaN(parsedTimestamp)) {
						qs.modified_after = String(parsedTimestamp);
					} else {
						throw new NodeOperationError(
							this.getNode(),
							'Modified After must be a valid date-time string or Unix timestamp',
							{ itemIndex: i },
						);
					}
				}
			}

			const response = (await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/users',
				{},
				qs,
			)) as IDataObject;

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('user');
			const userItems = applySimplifyModeToList(response, 'data', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				userItems.map((item) => ({ json: item })),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserRecoverableError(this, returnData, i, 'list', error, {
					contextFields: {
						...(requestedLimit !== undefined ? { limit: requestedLimit } : {}),
						...(requestedNextToken ? { next_token: requestedNextToken } : {}),
						...(requestedPlanType ? { plan_type: requestedPlanType } : {}),
						...(requestedStatus ? { status: requestedStatus } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('invalid status value'),
							reason: 'INVALID_STATUS',
							hint: `Use one of: ${USER_ALLOWED_STATUSES.join(', ')}.`,
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('invalid plan_type value'),
							reason: 'INVALID_PLAN_TYPE',
							hint: `Use one of: ${USER_ALLOWED_PLAN_TYPES.join(', ')}.`,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('limit must be a whole number between 1 and 100') ||
								normalizedMessage.includes('limit must be between 1 and 100') ||
								normalizedMessage.includes('invalid limit'),
							reason: 'INVALID_LIMIT',
							hint: 'Use a whole-number limit from 1 to 100.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('next token cannot be empty') ||
								normalizedMessage.includes('next token is too long') ||
								normalizedMessage.includes('next_token') ||
								normalizedMessage.includes('next token'),
							reason: 'INVALID_PAGINATION_TOKEN',
							messageOverride: 'The pagination token is invalid or expired.',
							hint: 'Discard the token and restart pagination from the beginning by calling List Users without a next_token.',
						},
						{
							match: (normalizedMessage) =>
								Boolean(requestedNextToken) &&
								(normalizedMessage.includes(
									"couldn't process your request due to a technical error",
								) ||
									normalizedMessage.includes('technical error')),
							reason: 'INVALID_PAGINATION_TOKEN',
							messageOverride: 'The pagination token is invalid or expired.',
							hint: 'Discard the token and restart pagination from the beginning by calling List Users without a next_token.',
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
