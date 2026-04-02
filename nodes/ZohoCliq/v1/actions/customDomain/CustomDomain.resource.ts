import type { INodeProperties } from 'n8n-workflow';

import * as add from './add.operation';
import * as del from './delete.operation';
import * as get from './get.operation';
import * as verify from './verify.operation';

export { add, del as delete, get, verify };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: {
			show: {
				resource: ['customDomain'],
			},
		},
		options: [
			{
				name: 'Add',
				value: 'add',
				description: 'Add custom domain settings',
				action: 'Add custom domain settings',
			},
			{
				name: 'Delete',
				value: 'delete',
				description: 'Delete the current custom domain settings',
				action: 'Delete custom domain settings',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get custom domain settings',
				action: 'Get custom domain settings',
			},
			{
				name: 'Verify',
				value: 'verify',
				description: 'Verify custom domain and set status (active or inactive)',
				action: 'Verify custom domain and set status',
			},
		],
		default: 'get',
	},
	{
		displayName:
			'Important: Custom Domain APIs require a Zoho Organization Admin OAuth user and the "Org Admin (Organization APIs)" scope pack. Non-admin users will receive authorization failures.',
		name: 'customDomainOrgAdminNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['customDomain'],
			},
		},
	},
	{
		displayName:
			'Custom Domain Setup Guidance:' +
			'<ul>' +
			'<li>Add a custom domain such as <code>cliq.mydomain.com</code> to access your organization&apos;s Zoho Cliq instance.</li>' +
			'<li>In your DNS provider, create a CNAME record for your chosen subdomain (for example, <code>cliq</code>) pointing to <code>cliq.cs.zohohost.com</code>.</li>' +
			'<li>The <code>cliq.cs.zohohost.com</code> target is for US data centers only.</li>' +
			'<li>Check Zoho documentation for the correct CNAME target for your data center (EU/IN/AU, etc.).</li>' +
			'<li>DNS propagation may take up to 24 hours depending on your registrar.</li>' +
			'<li>Zoho Cliq supports only one custom domain per organization at a time.</li>' +
			'<li>To switch domains, delete the existing custom domain first, then add the new one.</li>' +
			'<li>After adding, use <strong>Verify</strong> and set status to <code>active</code> to complete activation.</li>' +
			'</ul>',
		name: 'customDomainGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				resource: ['customDomain'],
				operation: ['get', 'add', 'verify', 'delete'],
			},
		},
	},
	...add.description,
	...del.description,
	...get.description,
	...verify.description,
];
