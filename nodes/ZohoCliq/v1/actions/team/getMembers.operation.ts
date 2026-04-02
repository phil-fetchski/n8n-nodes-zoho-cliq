/**
 * Get Team Members operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { TEAM_GET_MEMBERS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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

const requiredScope = getRequiredScopeForOperation('team', 'getMembers');

const properties: INodeProperties[] = [
	teamIdLocator,
	{
		displayName: `Get Team Members Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_Get_Members" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getTeamMembersDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/Get Team Members as AI Tool Setup Guide: <a href="${TEAM_GET_MEMBERS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getTeamMembersAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
		operation: ['getMembers'],
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
			requestedTeamId = typeof teamId === 'string' && teamId.trim() ? teamId.trim() : undefined;
			const sanitizedTeamId = validateTeamId(this, teamId, i);
			await runTeamLookupPreflightGate(this, i, grantedScopes, sanitizedTeamId);

			const endpoint = `/api/v2/teams/${encodeURIComponent(sanitizedTeamId)}/members`;
			const response = (await zohoCliqApiRequest.call(this, 'GET', endpoint)) as IDataObject;

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushTeamRecoverableError(this, returnData, i, 'getMembers', error, {
					contextFields: requestedTeamId ? { team_id: requestedTeamId } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team id is required') ||
								normalizedMessage.includes('team id is too long') ||
								normalizedMessage.includes('invalid team id format'),
							reason: 'INVALID_TEAM_ID',
							hint: 'Use the exact Zoho Cliq team ID for the team whose members you want to retrieve.',
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
