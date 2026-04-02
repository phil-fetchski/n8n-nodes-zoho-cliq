/**
 * Get User Status operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_STATUS_GET_USER_STATUS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runDirectUserLookupPreflightGate } from '../shared/preflight';
import { handleContinueOnFailError, validateUserId } from './common';
import { userIdLocator } from '../user/common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userStatus', 'getUserStatus');

const properties: INodeProperties[] = [
	{
		...userIdLocator,
		description:
			'User to retrieve status for. Uses the users resource locator with ID/email/ZUID fallback',
	},
	{
		displayName: `Retrieve a User's Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-user-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getUserStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Status/Retrieve a User's Status as AI Tool Setup Guide: <a href="${USER_STATUS_GET_USER_STATUS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getUserStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userStatus'],
		operation: ['getUserStatus'],
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

			const userIdInput =
				attemptedUserId ??
				(this.getNodeParameter('userId', i, '', {
					extractValue: true,
				}) as string);
			const userId = validateUserId(this, userIdInput, i);
			await runDirectUserLookupPreflightGate(this, i, grantedScopes, userId, {
				subjectLabel: 'User',
			});

			const response = (await zohoCliqApiRequest.call(
				this,
				'GET',
				`/api/v2/users/${encodeURIComponent(userId)}`,
				{},
				{ fields: 'chat_status' },
			)) as IDataObject;

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				handleContinueOnFailError(this, returnData, error, i, 'getUserStatus', {
					...(attemptedUserId ? { user_id: attemptedUserId } : {}),
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
