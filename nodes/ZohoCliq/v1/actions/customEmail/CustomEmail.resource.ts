import type { INodeProperties } from 'n8n-workflow';

import * as updateMailConfiguration from './updateMailConfiguration.operation';
import * as verifyCustomEmail from './verifyCustomEmail.operation';

export const updateOrganizationEmailConfiguration = updateMailConfiguration;
export const getOrganizationEmailConfiguration = verifyCustomEmail;

export { updateMailConfiguration, verifyCustomEmail };
export const addCustomEmail = updateMailConfiguration;

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['customEmail'],
			},
		},
		options: [
			{
				name: 'Update Mail Configuration',
				value: 'updateOrganizationEmailConfiguration',
				description:
					'Update the single organization-level custom sender name, email address, and CNAME status used for account notification emails',
				action: 'Update mail configuration',
			},
			{
				name: 'Verify Custom Email',
				value: 'getOrganizationEmailConfiguration',
				description:
					'Retrieve the single organization-level custom email configuration and verification state from Zoho Cliq',
				action: 'Verify custom email',
			},
		],
		default: 'getOrganizationEmailConfiguration',
	},
	{
		displayName:
			'Important: Custom Email APIs manage the single account-level notification sender for the whole Zoho Cliq organization. They require a Zoho Organization Admin OAuth user and the "Org Admin (Organization APIs)" scope pack. Non-admin users will receive authorization failures.',
		name: 'customEmailOrgAdminNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['customEmail'],
			},
		},
	},
	...updateMailConfiguration.description,
	...verifyCustomEmail.description,
];
