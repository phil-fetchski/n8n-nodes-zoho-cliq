/**
 * Delete User Field operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_FIELDS_DELETE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import {
	runUserFieldLookupPreflightGate,
	USER_FIELD_NOT_FOUND_ERROR_CODE,
	USER_FIELD_NOT_FOUND_HINT,
	USER_FIELD_NOT_FOUND_MESSAGE,
} from '../shared/preflight';
import {
	INVALID_USER_FIELD_ID,
	SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED,
	buildSystemUserFieldDeleteNotAllowedError,
	pushUserFieldRecoverableError,
	resolveUserFieldEnhancedOutput,
	userFieldIdLocator,
	validateUserFieldId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userFields', 'delete');

const properties: INodeProperties[] = [
	userFieldIdLocator,
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
		displayName: `Delete User Field Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#userfields-delete" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>. Deletes a user-field schema definition, not user profile values.`,
		name: 'deleteUserFieldDocsNotice',
		type: 'notice',
		default: '',
		hint: 'This removes a field-definition schema entry from Cliq. It is not deleting a user account or user profile record. System-defined fields cannot be deleted, so check `system_defined` with List/Get first.',
	},
	{
		displayName: `Zoho Cliq User Field/Delete User Field as AI Tool Setup Guide: <a href="${USER_FIELDS_DELETE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'deleteUserFieldAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userField'],
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
		let sanitizedFieldId: string | undefined;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const fieldId = this.getNodeParameter('fieldId', i, '', {
				extractValue: true,
			}) as string;
			sanitizedFieldId = validateUserFieldId(this, fieldId, i);
			const preflightResult = await runUserFieldLookupPreflightGate(
				this,
				i,
				grantedScopes,
				sanitizedFieldId,
			);
			const preflightEntity =
				preflightResult.status === 'validated' ? preflightResult.entity : undefined;
			const isSystemDefined =
				preflightEntity?.system_defined === true ||
				(preflightEntity?.data &&
					typeof preflightEntity.data === 'object' &&
					!Array.isArray(preflightEntity.data) &&
					(preflightEntity.data as { system_defined?: boolean }).system_defined === true);
			if (isSystemDefined) {
				throw buildSystemUserFieldDeleteNotAllowedError(this, i);
			}

			const endpoint = `/api/v2/userfields/${encodeURIComponent(sanitizedFieldId)}`;
			const response = await zohoCliqApiRequest.call(this, 'DELETE', endpoint);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveUserFieldEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									...responseJson,
									deleted: true,
									success: true,
									resource: 'userFields',
									operation: 'delete',
									field_id: sanitizedFieldId,
								}
							: { ...(rawResponse as IDataObject), deleted: true },
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushUserFieldRecoverableError(this, returnData, i, 'delete', error, {
					contextFields: {
						...(sanitizedFieldId ? { field_id: sanitizedFieldId } : {}),
					},
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === USER_FIELD_NOT_FOUND_ERROR_CODE,
							reason: USER_FIELD_NOT_FOUND_ERROR_CODE,
							messageOverride: USER_FIELD_NOT_FOUND_MESSAGE,
							hint: USER_FIELD_NOT_FOUND_HINT,
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code === INVALID_USER_FIELD_ID,
							reason: INVALID_USER_FIELD_ID,
							hint: 'Use the exact field_id for the user field you want to delete.',
						},
						{
							match: (_normalizedMessage, _message, mappedError) =>
								mappedError instanceof Error &&
								(mappedError as Error & { code?: string }).code ===
									SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED,
							reason: SYSTEM_USER_FIELD_DELETE_NOT_ALLOWED,
							messageOverride: 'System-defined user fields cannot be deleted.',
							hint: 'Delete is only supported for custom user fields where system_defined is false.',
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
