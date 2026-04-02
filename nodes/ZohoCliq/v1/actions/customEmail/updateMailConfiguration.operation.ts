import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { CUSTOM_EMAIL_UPDATE_MAIL_CONFIGURATION_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	appendCustomEmailWarningsToResponse,
	extractCustomEmailIdFromResponse,
	pushCustomEmailRecoverableError,
	validateCustomEmailPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('customEmail', 'updateMailConfiguration');

const properties: INodeProperties[] = [
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		description:
			'Required account-level custom sender name for the single Zoho Cliq organization Custom Email configuration. If Verify Custom Email is available, call it first to retrieve the current value. Do not fabricate or assume this value. Sent as API field "name". Maximum length: 120 characters.',
	},
	{
		displayName: 'Email ID',
		name: 'emailId',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. support@example.com',
		description:
			'Required account-level custom sender email address for outgoing Zoho Cliq organization notification emails. If Verify Custom Email is available, call it first to retrieve the current value. Do not fabricate or assume this value. Sent as API field "email_id". Note: Zoho Cliq will not replace an already-configured custom email address through this API; an administrator must remove the existing one in the Cliq Admin Panel first.',
	},
	{
		displayName: 'CNAME Status',
		name: 'cnameStatus',
		type: 'options',
		options: [
			{
				name: 'Verified',
				value: 'verified',
			},
			{
				name: 'Not Verified',
				value: 'not_verified',
			},
		],
		default: 'not_verified',
		required: true,
		description:
			'Required DNS CNAME verification status for the single account-level Custom Email configuration. If Verify Custom Email is available, call it first to retrieve the current value. Do not fabricate or assume this value. ENUM: ["verified", "not_verified"]. Use "verified" only after the DNS record is confirmed.',
	},
	{
		displayName: `Update Mail Configuration Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-mail-config" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateMailConfigurationDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Custom Email/Update Mail Configuration as AI Tool Setup Guide: <a href="${CUSTOM_EMAIL_UPDATE_MAIL_CONFIGURATION_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateMailConfigurationAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['customEmail'],
		operation: [
			'updateOrganizationEmailConfiguration',
			'updateMailConfiguration',
			'addCustomEmail',
		],
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
		let customEmailName: string | undefined;
		let customEmailId: string | undefined;
		try {
			customEmailName = String(this.getNodeParameter('name', i) ?? '').trim();
			customEmailId = String(this.getNodeParameter('emailId', i) ?? '').trim();

			checkRequiredScope(this, grantedScopes, requiredScope, i, {
				scopeContext: {
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
				},
			});

			const customEmailPayload: IDataObject = {
				name: customEmailName,
				email_id: customEmailId,
				cname_status: this.getNodeParameter('cnameStatus', i) as string,
			};
			const body = validateCustomEmailPayload(this, customEmailPayload, i);

			const response = await zohoCliqApiRequest.call(
				this,
				'PUT',
				'/api/v2/mailconfigurations/global',
				body,
			);
			const requestedEmailId = String(body.email_id ?? '').trim();
			let responseWithWarnings: IDataObject | unknown = response;
			let currentConfiguration: unknown;
			let hasVerificationSnapshot = false;

			try {
				currentConfiguration = await zohoCliqApiRequest.call(
					this,
					'GET',
					'/api/v2/mailconfigurations/global',
				);
				hasVerificationSnapshot = true;
			} catch {
				hasVerificationSnapshot = false;
			}

			if (hasVerificationSnapshot) {
				const existingEmailId = extractCustomEmailIdFromResponse(currentConfiguration);
				const emailChangeAttempted =
					typeof existingEmailId === 'string' &&
					existingEmailId.trim() !== '' &&
					existingEmailId.toLowerCase() !== requestedEmailId.toLowerCase();

				if (emailChangeAttempted) {
					responseWithWarnings = appendCustomEmailWarningsToResponse(response, [
						{
							field: 'custom_email_configuration',
							reason:
								'Zoho Cliq accepted the update request but left the existing account-level Custom Email configuration unchanged because a Custom Email is already configured for this organization.',
							action:
								'A Cliq Administrator must first remove the existing Custom Email in the Cliq Admin Panel. The API cannot replace an already-configured Custom Email, so none of the submitted fields are updated until the existing configuration is removed. Only one Custom Email can exist per organization at a time.',
							existing_email_id: existingEmailId,
							requested_email_id: requestedEmailId,
						},
					]);
				}
			}
			const responseJson =
				responseWithWarnings &&
				typeof responseWithWarnings === 'object' &&
				!Array.isArray(responseWithWarnings)
					? (responseWithWarnings as IDataObject)
					: ({ data: responseWithWarnings as never } as IDataObject);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: { ...responseJson, updated: true } }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushCustomEmailRecoverableError(this, returnData, i, 'updateMailConfiguration', error, {
					contextFields: {
						...(customEmailName ? { name: customEmailName } : {}),
						...(customEmailId ? { email_id: customEmailId } : {}),
					},
					fallbackMessage: 'Failed to update custom email configuration in Zoho Cliq.',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('custom email name is required') ||
								normalizedMessage.includes('custom email name is too long'),
							reason: 'INVALID_NAME',
							hint: 'Provide a Custom Email Name between 1 and 120 characters.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('custom email email_id is required') ||
								(normalizedMessage.includes('email') &&
									(normalizedMessage.includes('invalid') ||
										normalizedMessage.includes('valid email'))),
							reason: 'INVALID_EMAIL',
							hint: 'Provide a valid sender email address such as support@example.com.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('custom email cname_status is required') ||
								normalizedMessage.includes('custom email cname_status must be one of'),
							reason: 'INVALID_CNAME_STATUS',
							hint: 'Use exactly one of these values for CNAME Status: verified or not_verified.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('organization admin') ||
								normalizedMessage.includes('org admin'),
							reason: 'ORG_ADMIN_REQUIRED',
							hint: 'Reconnect with a Zoho Cliq Organization Admin OAuth user before retrying this update.',
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
