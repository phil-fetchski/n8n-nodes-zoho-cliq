/**
 * Create Designation operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { DESIGNATION_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	parseDelimitedIds,
	parseDesignationPayloadInput,
	pushDesignationRecoverableError,
	rethrowDesignationApiError,
	validateDesignationInputMode,
	validateDesignationPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('designation', 'create');
const allowedCreateFields = ['name', 'user_ids'];

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
			'Choose whether to build the payload with individual fields or provide JSON directly',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Required designation name. Maximum length: 30 characters.',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		placeholder: 'e.g. 123456789,987654321',
		description:
			'Optional comma-separated Zoho Cliq user IDs to assign to the designation when it is created. Blank values are allowed and omitted.',
	},
	{
		displayName: 'Designation Definition (JSON)',
		name: 'designationDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload to create a designation. Supports a literal JSON object or stringified JSON object. Allowed keys: name, user_ids.',
	},
	{
		displayName: `Create Designation Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-designation" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createDesignationDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Designation/Create Designation as AI Tool Setup Guide: <a href="${DESIGNATION_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createDesignationAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['designation'],
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
		let requestedName: string | undefined;
		let requestedUserIds: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const inputMode = validateDesignationInputMode(
				this,
				this.getNodeParameter('inputMode', i),
				i,
			);
			let body: IDataObject;

			if (inputMode === 'structured') {
				requestedName = (this.getNodeParameter('name', i) as string).trim();
				requestedUserIds = (this.getNodeParameter('userIds', i, '') as string).trim();

				body = {
					name: requestedName,
				};
				if (requestedUserIds) {
					body.user_ids = parseDelimitedIds(this, requestedUserIds, i, 'User IDs');
				}
			} else {
				const designationDefinition = this.getNodeParameter(
					'designationDefinition',
					i,
					{},
				) as unknown;
				body = parseDesignationPayloadInput(
					this,
					designationDefinition,
					i,
					'Designation Definition',
				);
				requestedName = typeof body.name === 'string' ? body.name.trim() : undefined;
			}

			body = validateDesignationPayload(this, body, i, 'Designation Definition', {
				requireName: true,
				allowedFields: allowedCreateFields,
			});

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/designations', body);
			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushDesignationRecoverableError(this, returnData, i, 'create', error, {
					contextFields: {
						...(requestedName ? { designation_name: requestedName } : {}),
						...(requestedUserIds ? { user_ids: requestedUserIds } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be either'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use "Using Fields Below" or "Using JSON" for the create request.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation name is required') ||
								normalizedMessage.includes('designation name is too long'),
							reason: 'INVALID_DESIGNATION_NAME',
							hint: 'Provide a non-empty designation name up to 30 characters.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('designation definition must be a valid json object') ||
								normalizedMessage.includes('designation definition cannot be empty') ||
								normalizedMessage.includes('unsafe key "') ||
								normalizedMessage.includes('unsupported field'),
							reason: 'INVALID_DESIGNATION_PAYLOAD',
							hint: 'Use only the documented keys for the designation create payload and provide a valid JSON object in raw mode.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user ids must contain at least one id') ||
								normalizedMessage.includes('user ids[') ||
								normalizedMessage.includes('user_ids must be an array of strings') ||
								normalizedMessage.includes('user_ids cannot be empty'),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide comma-separated Zoho Cliq user IDs only when you want to assign initial designation members.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('designation_already_exist'),
							reason: 'DESIGNATION_ALREADY_EXISTS',
							hint: 'Use a different designation name or retrieve the existing designation first.',
						},
					],
				})
			) {
				continue;
			}

			rethrowDesignationApiError(this, error, i, 'Create designation');
		}
	}

	return returnData;
}
