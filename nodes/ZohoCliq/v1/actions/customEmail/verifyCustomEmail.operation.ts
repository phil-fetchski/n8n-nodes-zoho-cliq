import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CUSTOM_EMAIL_VERIFY_CUSTOM_EMAIL_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { isCustomEmailAiErrorModeEnabled, pushCustomEmailRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('customEmail', 'verifyCustomEmail');

const properties: INodeProperties[] = [
	{
		displayName: `Verify Custom Email Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-mail-config" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'verifyCustomEmailDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Custom Email/Verify Custom Email as AI Tool Setup Guide: <a href="${CUSTOM_EMAIL_VERIFY_CUSTOM_EMAIL_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'verifyCustomEmailAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['customEmail'],
		operation: ['getOrganizationEmailConfiguration', 'verifyCustomEmail'],
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
			checkRequiredScope(this, grantedScopes, requiredScope, i, {
				scopeContext: {
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
				},
			});

			const response = await zohoCliqApiRequest.call(
				this,
				'GET',
				'/api/v2/mailconfigurations/global',
			);
			let responseJson = response as IDataObject;
			const data =
				response &&
				typeof response === 'object' &&
				!Array.isArray(response) &&
				typeof (response as IDataObject).data === 'object' &&
				(response as IDataObject).data !== null &&
				!Array.isArray((response as IDataObject).data)
					? ((response as IDataObject).data as IDataObject)
					: undefined;
			const hasEmptyConfiguration = data !== undefined && Object.keys(data).length === 0;

			if (hasEmptyConfiguration && isCustomEmailAiErrorModeEnabled(this, i)) {
				responseJson = {
					...(response as IDataObject),
					success: true,
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
					configured: false,
					message:
						'No Custom Email is currently configured for the authenticated Zoho Cliq account.',
				};
			}

			const executionData = this.helpers.constructExecutionMetaData([{ json: responseJson }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushCustomEmailRecoverableError(this, returnData, i, 'verifyCustomEmail', error, {
					fallbackMessage:
						'Failed to retrieve the current custom email verification details from Zoho Cliq.',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('organization admin') ||
								normalizedMessage.includes('org admin'),
							reason: 'ORG_ADMIN_REQUIRED',
							hint: 'Reconnect with a Zoho Cliq Organization Admin OAuth user before retrying this lookup.',
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
