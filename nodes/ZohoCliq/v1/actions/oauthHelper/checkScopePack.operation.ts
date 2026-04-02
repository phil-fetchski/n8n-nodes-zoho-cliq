import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	SCOPE_PACKS,
	type ScopePackName,
	hasRequiredScope,
} from '../../../../../credentials/ZohoCliqOAuth2Api.credentials';
import { OAUTH_HELPER_CHECK_SCOPE_PACK_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { parseScopes } from '../../helpers/utils';
import { appendExecutionData, appendOperationError, applyResourceDisplayOptions } from './common';

const packOptions = Object.entries(SCOPE_PACKS).map(([packName, packConfig]) => ({
	name: packConfig.displayName,
	value: packName,
	description: packConfig.description,
}));
const scopePackKeys = Object.keys(SCOPE_PACKS) as ScopePackName[];
const scopePackEnumText = JSON.stringify(scopePackKeys);
const operationName = 'checkScopePack';

const properties: INodeProperties[] = [
	{
		displayName:
			'Check Scope Pack Notice: Use this helper when you already know which capability pack matters and want a direct yes/no answer plus the exact missing scopes.',
		name: 'checkScopePackNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'AI Tool Recommendation: Most agent workflows will not need this helper. Expose it only when the agent may need to confirm whether one scope pack is satisfied or explain which required scopes are blocking a later Zoho Cliq operation.',
		name: 'checkScopePackAiToolNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Optional AI Tool Guide for Zoho Cliq OAuth Helper/Check Scope Pack: <a href="${OAUTH_HELPER_CHECK_SCOPE_PACK_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'checkScopePackAiGuideNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Pack Name',
		name: 'packName',
		type: 'options',
		noDataExpression: false,
		default: 'coreMessaging',
		options: packOptions,
		description: `Return one scope pack key string to compare against the currently granted token scopes. Valid ENUM values: ${scopePackEnumText}. Use the key, not the human label. The output reports whether the full pack is satisfied and lists any missing scopes.`,
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

	for (let i = 0; i < items.length; i++) {
		try {
			const packName = this.getNodeParameter('packName', i) as keyof typeof SCOPE_PACKS;
			const selectedPack = SCOPE_PACKS[packName];

			if (!selectedPack) {
				throw new NodeOperationError(
					this.getNode(),
					`Unknown scope pack "${packName}". Valid values: ${scopePackEnumText}`,
					{
						itemIndex: i,
					},
				);
			}

			const packScopes = [...selectedPack.scopes];
			const missingScopes = packScopes.filter(
				(scope) => !hasRequiredScope(normalizedGrantedScopes, scope),
			);

			appendExecutionData(this, returnData, i, {
				operation: operationName,
				packName,
				packDisplayName: selectedPack.displayName,
				packScopes,
				hasAllRequiredScopes: missingScopes.length === 0,
				missingScopes,
			});
		} catch (error) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage: 'Unable to evaluate the selected Zoho Cliq scope pack.',
				operation: operationName,
			});
		}
	}

	return returnData;
}
