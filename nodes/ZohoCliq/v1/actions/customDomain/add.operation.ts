import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CUSTOM_DOMAIN_ADD_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { asDataObject } from '../../helpers/data';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushCustomDomainRecoverableError, validateDomainName } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('customDomain', 'add');

function getExistingCustomDomain(
	response: IDataObject,
): { name: string; status?: string } | undefined {
	const data = asDataObject(response.data);
	if (!data) {
		return undefined;
	}

	const name = String(data.name ?? '').trim();
	if (!name) {
		return undefined;
	}

	const status = String(data.status ?? '').trim() || undefined;
	return { name, status };
}

const properties: INodeProperties[] = [
	{
		displayName: 'Custom Domain',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. chat.example.com',
		description:
			'Custom domain to add for the organization, for example chat.example.com. Use a fully qualified domain name only; the node trims whitespace, lowercases it, and sends it as payload field "name".',
	},
	{
		displayName: `Add Custom Domain Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#add-custom-domain" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'addCustomDomainDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Custom Domain/Add Custom Domain as AI Tool Setup Guide: <a href="${CUSTOM_DOMAIN_ADD_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addCustomDomainAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['customDomain'],
		operation: ['add'],
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

			const customDomainName = this.getNodeParameter('name', i) as string;
			const name = validateDomainName(this, customDomainName, i);

			// Pre-check current custom domain configuration. If a domain already exists,
			// skip add and return a friendly non-error response for workflow continuity.
			try {
				const currentDomainResponse = await zohoCliqApiRequest.call(
					this,
					'GET',
					'/api/v2/customdomain',
				);
				const existing = getExistingCustomDomain(currentDomainResponse);

				if (existing) {
					const isSameDomain = existing.name.toLowerCase() === name.toLowerCase();
					const response: IDataObject = {
						skipped: true,
						action: 'addCustomDomain',
						reason: isSameDomain
							? 'The requested custom domain is already configured.'
							: 'A custom domain is already configured. Remove it before adding a different domain.',
						requestedName: name,
						existingCustomDomain: existing,
					};
					const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
						itemData: { item: i },
					});
					returnData.push(...executionData);
					continue;
				}
			} catch {
				// Ignore pre-check failures and proceed with add attempt.
			}

			const body = { name };

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/customdomain', body);
			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const rawName = this.getNodeParameter('name', i, '') as string;
			const trimmedName = rawName.trim().toLowerCase();
			if (
				pushCustomDomainRecoverableError(this, returnData, i, 'add', error, {
					contextFields: trimmedName ? { custom_domain_name: trimmedName } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('custom domain is required') ||
								normalizedMessage.includes('invalid custom domain format'),
							reason: 'INVALID_CUSTOM_DOMAIN',
							hint: 'Use a valid fully qualified domain name such as chat.example.com.',
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
