import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import {
	SCOPE_PACKS,
	hasRequiredScope,
} from '../../../../../credentials/ZohoCliqOAuth2Api.credentials';
import { OAUTH_HELPER_LIST_SCOPE_PACKS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { parseScopes } from '../../helpers/utils';
import { appendExecutionData, appendOperationError, applyResourceDisplayOptions } from './common';

const operationName = 'listScopePacks';

const properties: INodeProperties[] = [
	{
		displayName:
			'List Scope Packs Notice: Use this helper to see the named scope-pack catalog used by the node and compare each pack against the scopes currently granted on the token.',
		name: 'listScopePacksNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'AI Tool Recommendation: Most agent workflows will not need this helper. Expose it only when the agent may need to inspect the scope-pack catalog or explain which scope groups are missing for later Zoho Cliq operations.',
		name: 'listScopePacksAiToolNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Optional AI Tool Guide for Zoho Cliq OAuth Helper/List Scope Packs: <a href="${OAUTH_HELPER_LIST_SCOPE_PACKS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listScopePacksAiGuideNotice',
		type: 'notice',
		default: '',
	},
];

export const description: INodeProperties[] = applyResourceDisplayOptions(
	properties,
	operationName,
);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	const grantedScopeList = parseScopes(grantedScopes);
	const normalizedGrantedScopes = grantedScopeList.join(',');
	const packEntries = Object.entries(SCOPE_PACKS).map(([packName, packConfig]) => {
		const scopes = [...packConfig.scopes];
		const missingScopes = scopes.filter(
			(scope) => !hasRequiredScope(normalizedGrantedScopes, scope),
		);
		return {
			packName,
			displayName: packConfig.displayName,
			description: packConfig.description,
			scopes,
			scopeCount: scopes.length,
			hasAllRequiredScopes: missingScopes.length === 0,
			missingScopes,
			grantedScopeCount: scopes.length - missingScopes.length,
		};
	});

	for (let i = 0; i < items.length; i++) {
		try {
			appendExecutionData(this, returnData, i, {
				operation: operationName,
				totalPacks: packEntries.length,
				packs: packEntries,
			});
		} catch (error) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage: 'Unable to list Zoho Cliq scope packs.',
				operation: operationName,
			});
		}
	}

	return returnData;
}
