/**
 * Check Out operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { REMOTE_WORK_CHECK_OUT_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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

const checkOutScope = getRequiredScopeForOperation('remoteWork', 'checkOut');

const properties: INodeProperties[] = [
	...getSimplifyParameters('remoteWorkCheck', 'remoteWork', 'checkOut'),
	{
		displayName: `Check Out Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#check-out" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${checkOutScope}</code>`,
		name: 'checkOutDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq RemoteWork/Check Out as AI Tool Setup Guide: <a href="${REMOTE_WORK_CHECK_OUT_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'checkOutAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['remoteWork'],
		operation: ['checkOut'],
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
			checkRequiredScope(this, grantedScopes, checkOutScope, i);

			const response = await zohoCliqApiRequest.call(this, 'PUT', '/api/v2/me/checkout');

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('remoteWorkCheck');
			const simplified = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
			);

			const json = {
				success: true,
				operation: 'checkOut',
				...simplified,
			};

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemoteWorkRecoverableError(this, returnData, i, 'checkOut', error, {
					fallbackMessage: 'Unable to check out from remote work.',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('already checked out') ||
								normalizedMessage.includes('already checked-out') ||
								normalizedMessage.includes('already checkout'),
							reason: 'ALREADY_CHECKED_OUT',
							hint: 'Use Get Remote Work Status to confirm whether the account is already checked out before retrying.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('not checked in') ||
								normalizedMessage.includes('not checked-in') ||
								normalizedMessage.includes('no checkin'),
							reason: 'NOT_CHECKED_IN',
							hint: 'Use Get Remote Work Status first, then only call Check Out after a successful remote check-in.',
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
