/**
 * Delete Completed Reminders operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { REMINDERS_CLEAR_COMPLETED_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	pushRemindersRecoverableError,
	resolveRemindersEnhancedOutput,
	validateCompletedReminderCategory,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('reminders', 'clearCompleted');

const properties: INodeProperties[] = [
	{
		displayName: 'Category',
		name: 'category',
		type: 'options',
		default: 'mine-completed',
		options: [
			{ name: 'Mine Completed', value: 'mine-completed' },
			{ name: 'Others Completed', value: 'others-completed' },
		],
		description:
			'Category of completed reminders to clear. Expressions should resolve to mine-completed or others-completed. Friendly variants like "Mine Completed" and "others completed" are also accepted.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal clear-completed response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Clear Completed Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#clear_completed_reminders" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'clearCompletedRemindersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Reminders/Clear Completed as AI Tool Setup Guide: <a href="${REMINDERS_CLEAR_COMPLETED_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'clearCompletedRemindersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['reminder'],
		operation: ['clearCompleted'],
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
		let category: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			category = validateCompletedReminderCategory(this, this.getNodeParameter('category', i), i);
			const body: IDataObject = {
				category,
			};

			const response = await zohoCliqApiRequest.call(
				this,
				'DELETE',
				'/api/v2/reminders/clearcompleted',
				body,
			);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveRemindersEnhancedOutput(
				this,
				i,
				response,
				true,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									success: true,
									resource: 'reminders',
									operation: 'clearCompleted',
									category,
								}
							: rawResponse,
					},
				],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemindersRecoverableError(this, returnData, i, 'clearCompleted', error, {
					contextFields: category ? { category } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('invalid category'),
							reason: 'INVALID_CATEGORY',
							hint: 'Use mine-completed or others-completed. Expression values like "Mine Completed" are also accepted.',
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
