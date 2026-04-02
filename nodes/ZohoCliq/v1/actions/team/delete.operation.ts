/**
 * Delete Team operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { TEAM_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runTeamLookupPreflightGate } from '../shared/preflight';
import {
	pushTeamRecoverableError,
	resolveTeamEnhancedOutput,
	teamIdLocator,
	TEAM_NOT_FOUND_HINT,
	TEAM_NOT_FOUND_MESSAGE,
	validateTeamId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('team', 'delete');

const properties: INodeProperties[] = [
	teamIdLocator,
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal delete response. Disable to return Cliq's standard response.",
	},
	{
		displayName: `Delete Team Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_Delete_a_Team" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'deleteTeamDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/Delete Team as AI Tool Setup Guide: <a href="${TEAM_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteTeamAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
		operation: ['delete'],
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

			const endpoint = `/api/v2/teams/${encodeURIComponent(sanitizedTeamId)}`;
			const response = (await zohoCliqApiRequest.call(this, 'DELETE', endpoint)) as
				| IDataObject
				| undefined
				| null;
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveTeamEnhancedOutput(
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
									deleted: true,
									success: true,
									resource: 'team',
									operation: 'delete',
									team_id: sanitizedTeamId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushTeamRecoverableError(this, returnData, i, 'delete', error, {
					contextFields: requestedTeamId ? { team_id: requestedTeamId } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('team id is required') ||
								normalizedMessage.includes('team id is too long') ||
								normalizedMessage.includes('invalid team id format'),
							reason: 'INVALID_TEAM_ID',
							hint: 'Use the exact Zoho Cliq team ID for the team you want to delete.',
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
