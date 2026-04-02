/**
 * Build Permissions JSON Payload operation (No API call)
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import {
	ensureSafeObject,
	parseRolePayloadInput,
	pushRoleRecoverableError,
	ROLE_HELPER_OPERATION_NOT_RECOMMENDED_AS_AI_TOOL_NOTICE,
} from './common';
import { buildFilteredTemplateList, defaultPermissionsTemplatePayload } from './permissionsUi';

const properties: INodeProperties[] = [
	{
		displayName:
			'No API call operation: this operation only builds an update payload. Map {{$json.updatePermissionsPayload}} into Update Role Permissions > Permissions Updates (JSON).',
		name: 'buildRolePermissionsPayloadNoApiNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'Template guidance: for rows with empty status values, set status to either "enabled" or "disabled" to include that row in filtered output.',
		name: 'buildRolePermissionsPayloadStatusGuidanceNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Output Full Template Payload',
		name: 'outputFullTemplatePayload',
		type: 'boolean',
		default: false,
		description:
			'Whether to output the full template (including empty rows) for advanced conditional manipulation in other n8n nodes before applying updates',
	},
	{
		displayName: 'Permissions Template (JSON)',
		name: 'permissionsTemplate',
		type: 'json',
		default: defaultPermissionsTemplatePayload,
		required: true,
		description:
			'Role permissions template in update list format. Filtered output includes only entries with status and/or meaningful config values.',
	},
	{
		displayName:
			'Build Permissions JSON Payload Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#update-role" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>None (local helper only)</code>',
		name: 'buildRolePermissionsPayloadDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: ROLE_HELPER_OPERATION_NOT_RECOMMENDED_AS_AI_TOOL_NOTICE,
		name: 'buildRolePermissionsPayloadAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['buildPermissionsJsonPayload'],
	},
};

export function applyBuildPermissionsDisplayOptions(property: INodeProperties): INodeProperties {
	const propertyShowOptions = property.displayOptions?.show;

	return {
		...property,
		displayOptions: {
			...displayOptions,
			...property.displayOptions,
			show: propertyShowOptions
				? {
						...displayOptions.show,
						...propertyShowOptions,
					}
				: displayOptions.show,
		},
	};
}

export const description: INodeProperties[] = properties.map(applyBuildPermissionsDisplayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	void grantedScopes;
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const outputFullTemplatePayload = this.getNodeParameter(
				'outputFullTemplatePayload',
				i,
				false,
			) as boolean;
			const rawTemplatePayload = this.getNodeParameter('permissionsTemplate', i, {}) as unknown;

			const parsedPayload = parseRolePayloadInput(
				this,
				rawTemplatePayload,
				i,
				'Permissions Template (JSON)',
			);
			ensureSafeObject(this, parsedPayload, i, 'Permissions Template (JSON)');

			const filteredList = buildFilteredTemplateList(this, i, parsedPayload.list);
			const updatePermissionsPayload = outputFullTemplatePayload
				? parsedPayload
				: ({ list: filteredList } as IDataObject);

			const outputJson: IDataObject = {
				success: true,
				resource: 'role',
				operation: 'buildPermissionsJsonPayload',
				noApiCall: true,
				operationIntent: 'buildPermissionsJsonPayload',
				outputFullTemplatePayload,
				includedPermissionCount: filteredList.length,
				updatePermissionsPayload,
				usageHint:
					'Map {{$json.updatePermissionsPayload}} into Update Role Permissions > Permissions Updates (JSON).',
			};

			const executionData = this.helpers.constructExecutionMetaData([{ json: outputJson }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushRoleRecoverableError(this, returnData, i, 'buildPermissionsJsonPayload', error, {
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('unsafe key') ||
								normalizedMessage.includes('json object'),
							reason: 'UNSAFE_PERMISSIONS_TEMPLATE',
							hint: 'Use a plain JSON object and remove unsafe keys such as __proto__, constructor, and prototype.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('permissions template (json)'),
							reason: 'INVALID_PERMISSIONS_TEMPLATE',
							hint: 'Provide a JSON object with a non-empty top-level list array and only meaningful status/config values.',
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
