/**
 * Get User operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { USER_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateUserId } from '../../helpers/utils';
import { runDirectUserLookupPreflightGate } from '../shared/preflight';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { zohoCliqApiRequest } from '../../transport';
import {
	getUserIdentifierRecoverableMessageMappings,
	pushUserRecoverableError,
	USER_ALLOWED_FIELDS,
	userIdLocator,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('user', 'get');

const properties: INodeProperties[] = [
	{
		...userIdLocator,
		description:
			'The user ID, email, or ZUID of the user to retrieve. Use List Users first when you need to discover a canonical identifier.',
	},
	...getSimplifyParameters('user', 'user', 'get'),
	{
		displayName: `Retrieve a Particular User Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-particular-user" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code> OPTIONAL ZOHO PEOPLE SCOPES: ZohoPeople.forms.READ, ZohoPeople.employee.READ, ZohoPeople.attendance.READ`,
		name: 'getUserDocsNotice',
		type: 'notice',
		default: '',
		hint: 'Zoho documents a USER_ID path, but this node also accepts email addresses and ZUID values in the same locator for the lookup request.',
	},
	{
		displayName: `Zoho Cliq User/Get User as AI Tool Setup Guide: <a href="${USER_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getUserAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['user'],
		operation: ['get'],
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
			const qs: Record<string, string | number | boolean> = {
				fields: ['all', ...USER_ALLOWED_FIELDS].join(','),
			};

			const endpoint = `/api/v2/users/${encodeURIComponent(sanitizedUserId)}`;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint, {}, qs);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('user');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
				'data',
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserRecoverableError(this, returnData, i, 'get', error, {
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
