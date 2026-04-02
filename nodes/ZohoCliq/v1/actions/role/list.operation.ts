/**
 * List Roles operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { ROLE_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushRoleRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('role', 'list');

const properties: INodeProperties[] = [
	{
		displayName: `Get Roles Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get-roles" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getRolesDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Role/List Roles as AI Tool Setup Guide: <a href="${ROLE_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listRolesAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
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

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/profiles');

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (pushRoleRecoverableError(this, returnData, i, 'list', error)) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
