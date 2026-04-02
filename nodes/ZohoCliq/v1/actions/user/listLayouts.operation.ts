/**
 * List User Layouts operation
 */

import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { USER_LIST_LAYOUTS_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { pushUserRecoverableError, USER_ALLOWED_LAYOUT_UNIQUE_NAMES } from './common';
import { applyDisplayOptions } from '../common.descriptions';

const allowedLayoutNames = [...USER_ALLOWED_LAYOUT_UNIQUE_NAMES];
const requiredScope = getRequiredScopeForOperation('user', 'listLayouts');
const uniqueNameOptions = [
	{ name: 'All', value: '' },
	...allowedLayoutNames.map((value) => ({
		name: value
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' '),
		value,
	})),
];

const properties: INodeProperties[] = [
	{
		displayName: 'Unique Name',
		name: 'uniqueName',
		type: 'options',
		default: '',
		options: uniqueNameOptions,
		description: 'Filter layouts by unique name. Select All to return every layout.',
	},
	{
		displayName: `List Layouts Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#list-lay-outs" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'listUserLayoutsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq User/List User Layouts as AI Tool Setup Guide: <a href="${USER_LIST_LAYOUTS_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'listUserLayoutsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['user'],
		operation: ['listLayouts'],
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
		let attemptedUniqueName: string | undefined;
		try {
			attemptedUniqueName = String(this.getNodeParameter('uniqueName', i, '') ?? '').trim();
			attemptedUniqueName = attemptedUniqueName || undefined;
		} catch {
			attemptedUniqueName = undefined;
		}

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const uniqueNameRaw = this.getNodeParameter('uniqueName', i, '') as string;
			const qs: Record<string, string | number | boolean> = {};

			const uniqueName = String(uniqueNameRaw ?? '').trim();
			if (
				uniqueName &&
				!allowedLayoutNames.includes(
					uniqueName as (typeof USER_ALLOWED_LAYOUT_UNIQUE_NAMES)[number],
				)
			) {
				throw new NodeOperationError(
					this.getNode(),
					`Invalid layout unique name "${uniqueName}". Must be one of: ${allowedLayoutNames.join(', ')}`,
					{ itemIndex: i },
				);
			}
			if (uniqueName) {
				qs.unique_name = uniqueName;
			}

			const response = await zohoCliqApiRequest.call(this, 'GET', '/api/v2/users/layout', {}, qs);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserRecoverableError(this, returnData, i, 'listLayouts', error, {
					contextFields: attemptedUniqueName ? { unique_name: attemptedUniqueName } : undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('invalid layout unique name'),
							reason: 'INVALID_LAYOUT_NAME',
							hint: `Use one of: ${allowedLayoutNames.join(', ')}.`,
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
