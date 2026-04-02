/**
 * Check In operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { REMOTE_WORK_CHECK_IN_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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

const checkInScope = getRequiredScopeForOperation('remoteWork', 'checkIn');

const properties: INodeProperties[] = [
	...getSimplifyParameters('remoteWorkCheck', 'remoteWork', 'checkIn'),
	{
		displayName: `Check In Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#check-in" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${checkInScope}</code>`,
		name: 'checkInDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq RemoteWork/Check In as AI Tool Setup Guide: <a href="${REMOTE_WORK_CHECK_IN_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'checkInAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['remoteWork'],
		operation: ['checkIn'],
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
			checkRequiredScope(this, grantedScopes, checkInScope, i);

			const response = await zohoCliqApiRequest.call(this, 'PUT', '/api/v2/me/checkin');

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
				operation: 'checkIn',
				...simplified,
			};

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRemoteWorkRecoverableError(this, returnData, i, 'checkIn', error, {
					fallbackMessage: 'Unable to check in to remote work.',
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('already checked in') ||
								normalizedMessage.includes('already checked-in') ||
								normalizedMessage.includes('already checkin'),
							reason: 'ALREADY_CHECKED_IN',
							hint: 'Use Get Remote Work Status to confirm the current remote attendance state before retrying check-in.',
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
