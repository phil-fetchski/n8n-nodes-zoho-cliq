/**
 * List Teams operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { TEAM_LIST_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushTeamRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('team', 'list');

const properties: INodeProperties[] = [
	{
		displayName: 'Only Joined Teams',
		name: 'joined',
		type: 'boolean',
		default: false,
		description:
			'Whether to return only teams the authenticated user has joined. When disabled, the node omits the joined query filter and requests all visible teams.',
	},
	{
		displayName: `List Teams Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Teams_List_all_Team" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'listTeamsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Team/List Teams as AI Tool Setup Guide: <a href="${TEAM_LIST_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listTeamsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['team'],
		operation: ['list'],
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
		let joined = false;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const qs: Record<string, string | number | boolean> = {};
			joined = this.getNodeParameter('joined', i, false) as boolean;
			if (joined) {
				qs.joined = true;
			}

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/teams', {}, qs);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const contextFields: IDataObject | undefined = joined ? { joined: true } : undefined;
			if (pushTeamRecoverableError(this, returnData, i, 'list', error, { contextFields })) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
