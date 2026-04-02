/**
 * Get User Teams operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_GET_TEAMS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateUserId } from '../../helpers/utils';
import { runDirectUserLookupPreflightGate } from '../shared/preflight';
import {
	applySimplifyModeToList,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import {
	getUserIdentifierRecoverableMessageMappings,
	pushUserRecoverableError,
	userIdLocator,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('user', 'getTeams');

const properties: INodeProperties[] = [
	{
		...userIdLocator,
		description:
			'The user ID, email, or ZUID to fetch teams for. Use List Users first when you need to discover a canonical identifier.',
	},
	...getSimplifyParameters('userTeam', 'user', 'getTeams'),
	{
		displayName: `Fetch User Teams Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#fetch-user-teams" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getUserTeamsDocsNotice',
		type: 'notice',
		default: '',
		hint: 'Zoho documents a USER_ID path, but this node also accepts email addresses and ZUID values in the same locator for the team-membership lookup.',
	},
	{
		displayName: `Zoho Cliq User/Get User Teams as AI Tool Setup Guide: <a href="${USER_GET_TEAMS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getUserTeamsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['user'],
		operation: ['getTeams'],
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
		let attemptedUserId: string | undefined;
		try {
			attemptedUserId = String(
				this.getNodeParameter('userId', i, '', { extractValue: true }) ?? '',
			).trim();
			attemptedUserId = attemptedUserId || undefined;
		} catch {
			attemptedUserId = undefined;
		}

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const userId = this.getNodeParameter('userId', i, '', { extractValue: true }) as string;
			const sanitizedUserId = validateUserId(this, userId, i);
			await runDirectUserLookupPreflightGate(this, i, grantedScopes, sanitizedUserId, {
				subjectLabel: 'User',
			});

			const endpoint = `/api/v2/users/${encodeURIComponent(sanitizedUserId)}/teams`;
			const response = (await zohoCliqApiRequest.call(this, 'GET', endpoint)) as IDataObject;

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('userTeam');
			const teamItems = applySimplifyModeToList(response, 'data', mode, config, selectedFields);

			const executionData = this.helpers.constructExecutionMetaData(
				teamItems.map((item) => ({ json: item })),
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserRecoverableError(this, returnData, i, 'getTeams', error, {
					contextFields: attemptedUserId ? { user_id: attemptedUserId } : undefined,
					messageMappings: getUserIdentifierRecoverableMessageMappings({
						identifier: attemptedUserId,
						treatInvalidFormatAsNotFound: true,
					}),
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
