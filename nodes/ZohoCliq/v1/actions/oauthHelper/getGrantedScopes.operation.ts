/**
 * Get Granted Scopes operation
 * Utility operation that inspects OAuth scope information from credentials
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { ALL_SCOPES } from '../../../../../credentials/ZohoCliqOAuth2Api.credentials';
import { OAUTH_HELPER_GET_GRANTED_SCOPES_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { parseScopes } from '../../helpers/utils';
import { appendExecutionData, appendOperationError, applyResourceDisplayOptions } from './common';

const properties: INodeProperties[] = [
	{
		displayName:
			'OAuth Helper Notice: Use this helper to inspect the scopes stored on the currently connected Zoho Cliq token. It is useful when an agent needs to explain why a later operation may fail because a required scope is missing.',
		name: 'oauthHelperScopesNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'AI Tool Recommendation: Most agent workflows will not need this helper. Expose it only when the agent may need to inspect the current token scopes or explain why another Zoho Cliq operation is missing required scopes.',
		name: 'getGrantedScopesAiToolNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Optional AI Tool Guide for Zoho Cliq OAuth Helper/Get Granted Scopes: <a href="${OAUTH_HELPER_GET_GRANTED_SCOPES_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getGrantedScopesAiGuideNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Include All Supported Node Scopes',
		name: 'includeAllSupportedNodeScopes',
		type: 'boolean',
		default: false,
		description:
			'Whether to include the full scope catalog supported by this node so the output can compare the current token against everything the node knows how to request',
	},
];

const operationName = 'getGrantedScopes';

export const description: INodeProperties[] = applyResourceDisplayOptions(
	properties,
	operationName,
);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	_grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];
	void _grantedScopes;

	let credentials: IDataObject | undefined;
	try {
		credentials = (await this.getCredentials('zohoCliqOAuth2Api')) as IDataObject | undefined;
		if (!credentials) {
			throw new NodeOperationError(
				this.getNode(),
				'No credentials configured. Please set up Zoho Cliq OAuth2 credentials.',
			);
		}
	} catch (error) {
		for (let i = 0; i < items.length; i++) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage: 'Unable to inspect granted scopes from Zoho Cliq OAuth2 credentials.',
				operation: operationName,
			});
		}

		return returnData;
	}

	const oauthTokenData = (credentials.oauthTokenData as IDataObject | undefined) ?? {};
	const tokenScopes = parseScopes(oauthTokenData.scope);
	const scopeSource = 'oauthTokenData.scope';
	const hasTokenScope = tokenScopes.length > 0;
	const hasRefreshToken =
		typeof oauthTokenData.refresh_token === 'string' && oauthTokenData.refresh_token.length > 0;

	for (let i = 0; i < items.length; i++) {
		try {
			const includeAllSupportedNodeScopes = this.getNodeParameter(
				'includeAllSupportedNodeScopes',
				i,
				false,
			) as boolean;
			const output: IDataObject = {
				operation: operationName,
				scopeSource,
				hasTokenScope,
				hasRefreshToken,
				grantedScopesOnCurrentToken: [...tokenScopes],
				counts: {
					grantedOnCurrentToken: tokenScopes.length,
				},
			};
			if (includeAllSupportedNodeScopes) {
				output.allSupportedNodeScopes = [...ALL_SCOPES];
				(output.counts as IDataObject).allSupportedNodeScopes = ALL_SCOPES.length;
			}

			appendExecutionData(this, returnData, i, output);
		} catch (error) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage: 'Unable to build granted-scope diagnostics output.',
				operation: operationName,
			});
		}
	}

	return returnData;
}
