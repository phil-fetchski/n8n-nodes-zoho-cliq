/**
 * Get Current Status operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { USER_STATUS_GET_CURRENT_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { handleContinueOnFailError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userStatus', 'getCurrent');

const properties: INodeProperties[] = [
	{
		displayName: `Retrieve Current Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-current-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code> CURRENT USER ONLY: Returns the status of the authenticated OAuth user`,
		name: 'getCurrentStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Status/Retrieve Current Status as AI Tool Setup Guide: <a href="${USER_STATUS_GET_CURRENT_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getCurrentStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userStatus'],
		operation: ['getCurrent'],
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

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/statuses/current');

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (handleContinueOnFailError(this, returnData, error, i, 'getCurrent')) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
