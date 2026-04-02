/**
 * Update Team operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { TEAM_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runTeamLookupPreflightGate } from '../shared/preflight';
import {
	parseTeamPayloadInput,
	pushTeamRecoverableError,
	TEAM_NAME_MAX_LENGTH,
	teamIdLocator,
	TEAM_NOT_FOUND_HINT,
	TEAM_NOT_FOUND_MESSAGE,
	validateTeamId,
	validateTeamInputMode,
	validateTeamPayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('team', 'update');

const properties: INodeProperties[] = [
	teamIdLocator,
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
			'Choose Using Fields Below to enter team updates separately or Using JSON to send one team update object',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: `Optional updated team name. Blank values are omitted. When provided, the node enforces a maximum length of ${TEAM_NAME_MAX_LENGTH} characters.`,
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Optional updated team description. Blank values are omitted.',
	},
	{
		displayName: 'Team Updates (JSON)',
		name: 'teamUpdates',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON team update object. Supports a literal JSON object or stringified JSON object with name and/or description.',
	},
	{
		displayName: `Update Team Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_Update_a_Team" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'updateTeamDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/Update Team as AI Tool Setup Guide: <a href="${TEAM_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateTeamAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
		operation: ['update'],
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
		let requestedTeamId: string | undefined;
		let inputMode: 'structured' | 'raw' | undefined;
		let rawInputMode: unknown;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const teamId = this.getNodeParameter('teamId', i, '', {
				extractValue: true,
			}) as string;
			requestedTeamId = typeof teamId === 'string' && teamId.trim() ? teamId.trim() : undefined;
			rawInputMode = this.getNodeParameter('inputMode', i);
			const sanitizedTeamId = validateTeamId(this, teamId, i);
			requestedTeamId = sanitizedTeamId;
			await runTeamLookupPreflightGate(this, i, grantedScopes, sanitizedTeamId);
			inputMode = validateTeamInputMode(this, rawInputMode, i);
			let body: IDataObject;

			if (inputMode === 'structured') {
				const name = (this.getNodeParameter('name', i, '') as string).trim();
				const description = (this.getNodeParameter('description', i, '') as string).trim();
				body = {};
				if (name) {
					body.name = name;
				}
				if (description) {
					body.description = description;
				}
			} else {
				const teamUpdates = this.getNodeParameter('teamUpdates', i, {}) as unknown;
				body = parseTeamPayloadInput(this, teamUpdates, i, 'Team Updates');
			}

			const sanitizedBody = validateTeamPayload(this, body, i, 'Team Updates', {
				allowedFields: ['name', 'description'],
			});

			const endpoint = `/api/v2/teams/${encodeURIComponent(sanitizedTeamId)}`;
			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, sanitizedBody);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: { ...(response as IDataObject), updated: true } }],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			const contextFields: IDataObject = {};
			if (requestedTeamId) {
				contextFields.team_id = requestedTeamId;
			}
			if (inputMode) {
				contextFields.input_mode = inputMode;
			} else if (typeof rawInputMode === 'string' && rawInputMode.trim()) {
				contextFields.input_mode = rawInputMode.trim();
			}

			if (
				pushTeamRecoverableError(this, returnData, i, 'update', error, {
					contextFields: Object.keys(contextFields).length > 0 ? contextFields : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team id is required') ||
								normalizedMessage.includes('team id is too long') ||
								normalizedMessage.includes('invalid team id format'),
							reason: 'INVALID_TEAM_ID',
							hint: 'Use the exact Zoho Cliq team ID for the team you want to update.',
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be either'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use "Using Fields Below" for field-by-field entry or "Using JSON" for a single JSON team update object.',
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
								normalizedMessage.includes('team updates cannot be empty'),
							reason: 'EMPTY_TEAM_UPDATE',
							hint: 'Provide at least one supported field to update: name and/or description.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team updates contains unsupported field'),
							reason: 'UNSUPPORTED_TEAM_FIELD',
							hint: 'Only name and description are supported in Team Updates.',
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
								normalizedMessage.includes(TEAM_NOT_FOUND_MESSAGE.toLowerCase()),
							reason: 'TEAM_NOT_FOUND',
							messageOverride: TEAM_NOT_FOUND_MESSAGE,
							hint: TEAM_NOT_FOUND_HINT,
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
