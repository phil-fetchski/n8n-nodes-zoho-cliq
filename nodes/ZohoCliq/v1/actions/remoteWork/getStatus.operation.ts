/**
 * Get Remote Work Status operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { REMOTE_WORK_GET_STATUS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import { pushRemoteWorkRecoverableError } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const getStatusScope = getRequiredScopeForOperation('remoteWork', 'getStatus');

const properties: INodeProperties[] = [
	...getSimplifyParameters('remoteWorkStatus', 'remoteWork', 'getStatus'),
	{
		displayName: `Get Remote Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#get-remote-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${getStatusScope}</code>`,
		name: 'getRemoteStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq RemoteWork/Get Remote Work Status as AI Tool Setup Guide: <a href="${REMOTE_WORK_GET_STATUS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getRemoteStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['remoteWork'],
		operation: ['getStatus'],
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
		try {
			checkRequiredScope(this, grantedScopes, getStatusScope, i);

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/me', undefined, {
				source: 'remote_tools',
			});

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('remoteWorkStatus');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemoteWorkRecoverableError(this, returnData, i, 'getStatus', error, {
					fallbackMessage: 'Unable to retrieve remote work status.',
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
