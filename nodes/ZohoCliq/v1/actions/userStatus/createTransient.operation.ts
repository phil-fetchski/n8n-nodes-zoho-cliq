/**
 * Create Transient Status operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_STATUS_CREATE_TRANSIENT_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	handleContinueOnFailError,
	parseDateTimeOrUnixMs,
	parseStatusPayloadInput,
	resolveUserStatusEnhancedOutput,
	USER_STATUS_INVALID_EXPIRY_HINT,
	USER_STATUS_INVALID_EXPIRY_REASON,
	validateTransientStatusPayload,
	validateUserStatusInputMode,
} from './common';
import type { ICliqErrorMessageMapping } from '../shared/errorResponse';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userStatus', 'createTransient');

const transientExpiryRecoverableMessageMappings: ICliqErrorMessageMapping[] = [
	{
		match: (normalizedMessage) =>
			normalizedMessage.includes('the time you have entered is invalid') ||
			normalizedMessage.includes('enter a future time') ||
			normalizedMessage.includes(
				'expiry must be a valid date-time value or unix timestamp in milliseconds',
			) ||
			normalizedMessage.includes(
				'expiry must resolve to a positive unix timestamp in milliseconds',
			) ||
			normalizedMessage.includes('transient status definition.expiry is required') ||
			normalizedMessage.includes('expiry is required'),
		reason: USER_STATUS_INVALID_EXPIRY_REASON,
		hint: USER_STATUS_INVALID_EXPIRY_HINT,
	},
];

function getRecoverableExpiryValue(value: unknown): string | number | undefined {
	if (typeof value === 'string') {
		return value;
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	return undefined;
}

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
			'Presence code for the temporary status. "available" = online, "busy" = do not disturb, "invisible" = hidden presence.',
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
		description:
			'Custom transient status text shown in Cliq. This maps directly to the API field `message`.',
		placeholder: 'e.g. Out for lunch',
	},
	{
		displayName: 'Expiry',
		name: 'expiryDateTime',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description:
			'When the transient status should expire. Supports ISO date-time values, Unix milliseconds, or expression values that resolve to Unix milliseconds.',
	},
	{
		displayName: 'Transient Status Definition (JSON)',
		name: 'transientStatusDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON body for PUT /statuses/ephemeral. Accepts a literal JSON object or a stringified JSON object. Required fields: `code`, `message`, `expiry`. `expiry` may be a positive Unix timestamp in milliseconds or an ISO date-time string.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal transient-status response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Add a Transient Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#add-transient-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code> CURRENT USER ONLY: Sets one transient status for the authenticated OAuth user`,
		name: 'createTransientStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Status/Add a Transient Status as AI Tool Setup Guide: <a href="${USER_STATUS_CREATE_TRANSIENT_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createTransientStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userStatus'],
		operation: ['createTransient'],
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
		let transientCode: string | undefined;
		let transientMessage: string | undefined;
		let transientExpiry: number | undefined;
		let attemptedTransientExpiry: string | number | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			inputMode = validateUserStatusInputMode(this, this.getNodeParameter('inputMode', i), i);
			let body: IDataObject;
			if (inputMode === 'structured') {
				const expiryInput = this.getNodeParameter('expiryDateTime', i) as unknown;
				attemptedTransientExpiry = getRecoverableExpiryValue(expiryInput);
				body = {
					code: this.getNodeParameter('code', i) as string,
					message: this.getNodeParameter('message', i) as string,
					expiry: parseDateTimeOrUnixMs(this, expiryInput, i, 'Expiry'),
				};
			} else {
				const transientStatusDefinition = this.getNodeParameter(
					'transientStatusDefinition',
					i,
					{},
				) as unknown;
				body = parseStatusPayloadInput(
					this,
					transientStatusDefinition,
					i,
					'Transient Status Definition',
				);
				attemptedTransientExpiry = getRecoverableExpiryValue(body.expiry);
			}
			body = validateTransientStatusPayload(this, body, i, 'Transient Status Definition');
			transientCode = body.code as string;
			transientMessage = body.message as string;
			transientExpiry = body.expiry as number;

			const response = await zohoCliqApiRequest.call(
				this,
				'PUT',
				'/api/v2/statuses/ephemeral',
				body,
			);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveUserStatusEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									success: true,
									resource: 'userStatus',
									operation: 'createTransient',
									code: transientCode,
									message: transientMessage,
									expiry: transientExpiry,
								}
							: rawResponse,
					},
				],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				handleContinueOnFailError(
					this,
					returnData,
					error,
					i,
					'createTransient',
					{
						...(inputMode ? { input_mode: inputMode } : {}),
						...(transientCode ? { presence_code: transientCode } : {}),
						...(transientMessage ? { status_message: transientMessage } : {}),
						...(transientExpiry !== undefined
							? { expiry: transientExpiry }
							: attemptedTransientExpiry !== undefined
								? { expiry: attemptedTransientExpiry }
								: {}),
					},
					{
						messageMappings: transientExpiryRecoverableMessageMappings,
					},
				)
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
