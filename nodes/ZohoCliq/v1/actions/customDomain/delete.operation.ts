import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CUSTOM_DOMAIN_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushCustomDomainRecoverableError, resolveCustomDomainEnhancedOutput } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('customDomain', 'delete');

const properties: INodeProperties[] = [
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal delete response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Delete Custom Domain Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-custom-domain" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteCustomDomainDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Custom Domain/Delete Custom Domain as AI Tool Setup Guide: <a href="${CUSTOM_DOMAIN_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteCustomDomainAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['customDomain'],
		operation: ['delete'],
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
				'/api/v2/customdomain',
			)) as IDataObject;
			const { includeEnhancedOutput, responseJson, rawResponse } =
				resolveCustomDomainEnhancedOutput(this, i, response);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									deleted: true,
									success: true,
									resource: 'customDomain',
									operation: 'delete',
									target: 'current_custom_domain',
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushCustomDomainRecoverableError(this, returnData, i, 'delete', error, {
					contextFields: {
						target: 'current_custom_domain',
					},
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
