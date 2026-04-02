import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CUSTOM_DOMAIN_VERIFY_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	parseCustomDomainPayloadInput,
	pushCustomDomainRecoverableError,
	validateCustomDomainStatus,
	validateCustomDomainInputMode,
	validateCustomDomainVerifyPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('customDomain', 'verify');

const properties: INodeProperties[] = [
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Choose whether to set the verification status with the field below or provide the entire request body as JSON',
	},
	{
		displayName: 'Status',
		name: 'status',
		type: 'options',
		required: true,
		options: [
			{ name: 'Active', value: 'active' },
			{ name: 'Inactive', value: 'inactive' },
		],
		default: 'active',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Verification status to apply to the configured custom domain',
	},
	{
		displayName: 'Custom Domain Payload (JSON)',
		name: 'customDomainPayload',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload for the verify request. Supports either a literal JSON object or stringified JSON text. Allowed field: status. Example: { "status": "active" }',
	},
	{
		displayName: `Verify Custom Domain Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#verify-custom-domain" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'verifyCustomDomainDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Custom Domain/Verify Custom Domain as AI Tool Setup Guide: <a href="${CUSTOM_DOMAIN_VERIFY_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'verifyCustomDomainAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['customDomain'],
		operation: ['verify'],
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

			const inputMode = validateCustomDomainInputMode(
				this,
				this.getNodeParameter('inputMode', i),
				i,
			);
			let body: IDataObject;

			if (inputMode === 'structured') {
				const status = this.getNodeParameter('status', i) as string;
				body = {
					status: validateCustomDomainStatus(this, status, i),
				};
			} else {
				const customDomainPayload = this.getNodeParameter('customDomainPayload', i, {}) as unknown;
				body = parseCustomDomainPayloadInput(this, customDomainPayload, i, 'Custom Domain Payload');
				body = validateCustomDomainVerifyPayload(this, body, i);
			}

			const response = await zohoCliqApiRequest.call(this, 'PUT', '/api/v2/customdomain', body);
			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushCustomDomainRecoverableError(this, returnData, i, 'verify', error, {
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('status must be either "active" or "inactive"'),
							reason: 'INVALID_STATUS',
							hint: 'Use exactly one of these values for status: active or inactive.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('input mode must be either "structured" or "raw"'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Set Input Mode to Using Fields Below or Using JSON.',
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
