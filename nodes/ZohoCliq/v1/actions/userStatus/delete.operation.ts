/**
 * Delete User Status operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_STATUS_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	invalidateUserStatusCatalogCache,
	runUserStatusLookupPreflightGate,
} from '../shared/preflight';
import {
	handleContinueOnFailError,
	resolveUserStatusEnhancedOutput,
	statusIdLocator,
	validateStatusId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userStatus', 'delete');

const properties: INodeProperties[] = [
	{
		...statusIdLocator,
		description:
			'Reusable status ID to delete from your saved custom statuses. This does not clear transient statuses.',
	},
	{
		displayName: 'Include Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		noDataExpression: true,
		description:
			"Whether to return workflow-friendly success metadata for this minimal delete response. Disable to return Cliq's standard success response.",
	},
	{
		displayName: `Delete Status Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#delete-status" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code> CURRENT USER ONLY: Deletes one reusable saved status owned by the authenticated OAuth user`,
		name: 'deleteUserStatusDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User Status/Delete Status as AI Tool Setup Guide: <a href="${USER_STATUS_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteUserStatusAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userStatus'],
		operation: ['delete'],
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
		let statusIdInput: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			statusIdInput = this.getNodeParameter('statusId', i, '', {
				extractValue: true,
			}) as string;
			const statusId = validateStatusId(this, statusIdInput, i);
			await runUserStatusLookupPreflightGate(this, i, grantedScopes, statusId);

			const response = await zohoCliqApiRequest.call(
				this,
				'DELETE',
				`/api/v2/statuses/${encodeURIComponent(statusId)}`,
			);
			invalidateUserStatusCatalogCache(this);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveUserStatusEnhancedOutput(
				this,
				i,
				response as IDataObject,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									deleted: true,
									success: true,
									resource: 'userStatus',
									operation: 'delete',
									status_id: statusId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				handleContinueOnFailError(this, returnData, error, i, 'delete', {
					...(typeof statusIdInput === 'string' && statusIdInput.trim()
						? { status_id: statusIdInput.trim() }
						: {}),
				})
			) {
				continue;
			}
			throw error;
		}
	}

	return returnData;
}
