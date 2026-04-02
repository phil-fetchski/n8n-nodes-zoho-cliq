/**
 * Create User Status operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_STATUS_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	handleContinueOnFailError,
	parseStatusPayloadInput,
	validateStatusPayload,
	validateUserStatusInputMode,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userStatus', 'create');

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
			'Choose "Using Fields Below" for guided inputs or "Using JSON" to send the exact API body',
	},
	{
		displayName: 'Code',
		name: 'code',
		type: 'options',
		required: true,
		options: [
			{ name: 'Available', value: 'available' },
			{ name: 'Busy', value: 'busy' },
			{ name: 'Invisible', value: 'invisible' },
		],
		default: 'available',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'Presence code for the status. "available" = online, "busy" = do not disturb, "invisible" = hidden presence.',
	},
	{
		displayName: 'Message',
		name: 'message',
		type: 'string',
		typeOptions: {
			rows: 2,
		},
		required: true,
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Custom status text shown in Cliq. This maps directly to the API field `message`.',
		placeholder: 'e.g. In a meeting, will respond soon!',
	},
	{
		displayName: 'Status Definition (JSON)',
		name: 'statusDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON body for POST /statuses. Accepts a literal JSON object or a stringified JSON object. Required fields: `code`, `message`. Example: {"code":"busy","message":"In a meeting"}',
	},
	{
		displayName: `Add a New Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#add-user-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code> CURRENT USER ONLY: Creates one reusable custom status for the authenticated OAuth user`,
		name: 'createUserStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Status/Add a New Status as AI Tool Setup Guide: <a href="${USER_STATUS_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createUserStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userStatus'],
		operation: ['create'],
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
		let inputMode: 'structured' | 'raw' | undefined;
		let requestBody: IDataObject | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			inputMode = validateUserStatusInputMode(this, this.getNodeParameter('inputMode', i), i);
			let body: IDataObject;
			if (inputMode === 'structured') {
				body = {
					code: this.getNodeParameter('code', i) as string,
					message: this.getNodeParameter('message', i) as string,
				};
			} else {
				const statusDefinition = this.getNodeParameter('statusDefinition', i, {}) as unknown;
				body = parseStatusPayloadInput(this, statusDefinition, i, 'Status Definition');
			}

			body = validateStatusPayload(this, body, i, 'Status Definition');
			requestBody = { ...body };

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/statuses', body);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const recoverableContext = inputMode
				? {
						input_mode: inputMode,
						...(requestBody ? { body: requestBody } : {}),
					}
				: undefined;
			if (handleContinueOnFailError(this, returnData, error, i, 'create', recoverableContext)) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
