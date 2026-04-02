/**
 * Get Team operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { TEAM_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runTeamLookupPreflightGate } from '../shared/preflight';
import {
	pushTeamRecoverableError,
	teamIdLocator,
	TEAM_NOT_FOUND_HINT,
	TEAM_NOT_FOUND_MESSAGE,
	validateTeamId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('team', 'get');

const properties: INodeProperties[] = [
	teamIdLocator,
	{
		displayName: `Get Team Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_Retrieve_a_Team" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getTeamDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/Get Team as AI Tool Setup Guide: <a href="${TEAM_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getTeamAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
		operation: ['get'],
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
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const teamId = this.getNodeParameter('teamId', i, '', {
				extractValue: true,
			}) as string;
			const sanitizedTeamId = validateTeamId(this, teamId, i);
			requestedTeamId = sanitizedTeamId;
			await runTeamLookupPreflightGate(this, i, grantedScopes, sanitizedTeamId);

			const endpoint = `/api/v2/teams/${encodeURIComponent(sanitizedTeamId)}`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const contextFields: IDataObject | undefined = requestedTeamId
				? { team_id: requestedTeamId }
				: undefined;
			if (
				pushTeamRecoverableError(this, returnData, i, 'get', error, {
					contextFields,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team id is required') ||
								normalizedMessage.includes('team id is too long') ||
								normalizedMessage.includes('invalid team id format'),
							reason: 'INVALID_TEAM_ID',
							hint: 'Use the exact Zoho Cliq team ID. Do not pass a team name or other identifier.',
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
