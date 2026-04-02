/**
 * List User Fields operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_FIELDS_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';

import { pushUserFieldRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userFields', 'list');

const properties: INodeProperties[] = [
	...getSimplifyParameters('userFieldListItem', 'userField', 'list'),
	{
		displayName: `Retrieve All User Fields Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#userfields-read-all" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>. Lists user-field schema definitions (field metadata/configuration), not user records.`,
		name: 'listUserFieldsDocsNotice',
		type: 'notice',
		default: '',
		hint: 'This operation returns the catalog of user-profile field definitions configured in Cliq, not user profile row data.',
	},
	{
		displayName: `Zoho Cliq User Field/Retrieve All User Fields as AI Tool Setup Guide: <a href="${USER_FIELDS_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listUserFieldsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userField'],
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
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const response = (await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/userfields',
			)) as IDataObject;

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('userFieldListItem');
			const listItems = applySimplifyModeToList(response, 'list', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				listItems.map((item) => ({ json: item })),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (pushUserFieldRecoverableError(this, returnData, i, 'list', error)) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
