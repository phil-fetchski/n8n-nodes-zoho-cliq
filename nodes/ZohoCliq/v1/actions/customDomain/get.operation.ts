import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { asDataObject } from '../../helpers/data';
import { CUSTOM_DOMAIN_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { isCustomDomainAiErrorModeEnabled, pushCustomDomainRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('customDomain', 'get');

const properties: INodeProperties[] = [
	{
		displayName: `Get Custom Domain Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-custom-domain" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getCustomDomainDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Custom Domain/Get Custom Domain as AI Tool Setup Guide: <a href="${CUSTOM_DOMAIN_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getCustomDomainAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['customDomain'],
		operation: ['get'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function isUnconfiguredCustomDomainResponse(response: IDataObject): boolean {
	const data = asDataObject(response.data);
	if (!data) {
		return false;
	}

	return Object.keys(data).length === 0;
}

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
				'/api/v2/customdomain',
			)) as IDataObject;
			const responseJson =
				isCustomDomainAiErrorModeEnabled(this, i) && isUnconfiguredCustomDomainResponse(response)
					? {
							...response,
							success: true,
							resource: 'customDomain',
							operation: 'get',
							configured: false,
							message:
								'No Custom Domain is currently configured for the authenticated Zoho Cliq account.',
						}
					: response;
			const executionData = this.helpers.constructExecutionMetaData([{ json: responseJson }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (pushCustomDomainRecoverableError(this, returnData, i, 'get', error)) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
