/**
 * Create Team operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { TEAM_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runTeamUsersPreflightGate } from '../shared/preflight';
import {
	parseDelimitedIds,
	parseTeamPayloadInput,
	pushTeamRecoverableError,
	TEAM_NAME_MAX_LENGTH,
	USER_IDS_NOT_FOUND_HINT,
	USER_IDS_NOT_FOUND_MESSAGE,
	validateTeamInputMode,
	validateTeamPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('team', 'create');

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
			'Choose Using Fields Below to enter team values separately or Using JSON to send one team object payload',
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
		description: `Team name. The node trims whitespace, requires a non-empty value, and enforces a maximum length of ${TEAM_NAME_MAX_LENGTH} characters.`,
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Optional team description. Blank values are omitted.',
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
		placeholder: 'e.g. 44344926,54667722',
		description:
			'Optional comma-separated Zoho Cliq user IDs to include as team members. Blank values are omitted.',
	},
	{
		displayName: 'Team Definition (JSON)',
		name: 'teamDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON team object. Supports a literal JSON object or stringified JSON object with name, description, and optional user_ids.',
	},
	{
		displayName: `Create Team Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_Create_a_Team" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createTeamDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/Create Team as AI Tool Setup Guide: <a href="${TEAM_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createTeamAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
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
		let rawInputMode: unknown;
		let requestedName: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			rawInputMode = this.getNodeParameter('inputMode', i);
			inputMode = validateTeamInputMode(this, rawInputMode, i);
			let body: IDataObject;

			if (inputMode === 'structured') {
				const name = (this.getNodeParameter('name', i) as string).trim();
				const description = (this.getNodeParameter('description', i) as string).trim();
				const userIds = (this.getNodeParameter('userIds', i) as string).trim();

				body = { name };
				if (description) {
					body.description = description;
				}
				if (userIds) {
					body.user_ids = parseDelimitedIds(this, userIds, i, 'User IDs');
				}
			} else {
				const teamDefinition = this.getNodeParameter('teamDefinition', i, {}) as unknown;
				body = parseTeamPayloadInput(this, teamDefinition, i, 'Team Definition');
			}

			body = validateTeamPayload(this, body, i, 'Team Definition', {
				requireName: true,
			});
			requestedName = body.name as string;
			await runTeamUsersPreflightGate(
				this,
				Array.isArray(body.user_ids) ? (body.user_ids as string[]) : [],
				i,
				grantedScopes,
			);

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/teams', body);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const missingUserIds =
				error &&
				typeof error === 'object' &&
				!Array.isArray(error) &&
				Array.isArray((error as IDataObject).zohoCliqMissingUserIds)
					? ((error as IDataObject).zohoCliqMissingUserIds as string[])
					: undefined;
			const contextFields: IDataObject = {};
			if (inputMode) {
				contextFields.input_mode = inputMode;
			} else if (typeof rawInputMode === 'string' && rawInputMode.trim()) {
				contextFields.input_mode = rawInputMode.trim();
			}
			if (requestedName) {
				contextFields.name = requestedName;
			}
			if (missingUserIds?.length) {
				contextFields.invalid_user_ids = missingUserIds;
			}

			if (
				pushTeamRecoverableError(this, returnData, i, 'create', error, {
					contextFields: Object.keys(contextFields).length > 0 ? contextFields : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be either'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use "Using Fields Below" for field-by-field entry or "Using JSON" for a single JSON team object.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team name is required') ||
								normalizedMessage.includes('team name is too long'),
							reason: 'INVALID_TEAM_NAME',
							hint: `Provide a non-empty team name up to ${TEAM_NAME_MAX_LENGTH} characters.`,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team definition cannot be empty'),
							reason: 'EMPTY_TEAM_PAYLOAD',
							hint: 'Provide a team object with at least a valid name.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('unsafe key "') ||
								normalizedMessage.includes('must be a valid json object'),
							reason: 'INVALID_TEAM_JSON',
							hint: 'Provide a safe JSON object and avoid __proto__, constructor, or prototype keys.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(USER_IDS_NOT_FOUND_MESSAGE.toLowerCase()) ||
								normalizedMessage.includes('missing user ids:'),
							reason: 'USER_IDS_NOT_FOUND',
							messageOverride: USER_IDS_NOT_FOUND_MESSAGE,
							hint: USER_IDS_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user_ids must be an array') ||
								normalizedMessage.includes('user_ids cannot be empty') ||
								normalizedMessage.includes('user_ids['),
							reason: 'INVALID_USER_IDS',
							hint: 'Provide user_ids as valid Zoho Cliq user IDs. In structured mode, use a comma-separated list of IDs only.',
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
