/**
 * Clear My Status operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_STATUS_CLEAR_MY_STATUS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { handleContinueOnFailError, resolveUserStatusEnhancedOutput } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userStatus', 'clearMyStatus');

const properties: INodeProperties[] = [
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal transient-status delete response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Delete Transient Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-transient-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code> CURRENT USER ONLY: Clears the authenticated OAuth user's transient status`,
		name: 'clearMyStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Status/Delete Transient Status as AI Tool Setup Guide: <a href="${USER_STATUS_CLEAR_MY_STATUS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'clearMyStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userStatus'],
		operation: ['clearMyStatus'],
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
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const response = (await zohoCliqApiRequest.call(
				this,
				'DELETE',
				'/api/v2/statuses/ephemeral',
			)) as IDataObject;
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveUserStatusEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									success: true,
									resource: 'userStatus',
									operation: 'clearMyStatus',
									target: 'current_transient_status',
									cleared: true,
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
				handleContinueOnFailError(this, returnData, error, i, 'clearMyStatus', {
					target: 'current_transient_status',
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
