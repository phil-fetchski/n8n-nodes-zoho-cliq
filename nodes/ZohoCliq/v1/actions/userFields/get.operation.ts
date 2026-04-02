/**
 * Get User Field operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { USER_FIELDS_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
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
import {
	isAuthoritativeUserFieldLookupNotFoundError,
	normalizeUserFieldLookupNotFoundError,
	USER_FIELD_NOT_FOUND_ERROR_CODE,
	USER_FIELD_NOT_FOUND_HINT,
	USER_FIELD_NOT_FOUND_MESSAGE,
} from '../shared/preflight';
import {
	INVALID_USER_FIELD_ID,
	pushUserFieldRecoverableError,
	userFieldIdLocator,
	validateUserFieldId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('userFields', 'get');

const properties: INodeProperties[] = [
	userFieldIdLocator,
	...getSimplifyParameters('userField', 'userField', 'get'),
	{
		displayName: `Retrieve User Field Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#userfields-read-one" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>. Retrieves a user-field schema definition by field ID, not user profile values.`,
		name: 'getUserFieldDocsNotice',
		type: 'notice',
		default: '',
		hint: 'This reads field-definition metadata/configuration only. Use User resource operations to read actual user profile data.',
	},
	{
		displayName: `Zoho Cliq User Field/Retrieve User Field as AI Tool Setup Guide: <a href="${USER_FIELDS_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getUserFieldAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['userField'],
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
		let sanitizedFieldId: string | undefined;
		let userFieldRequestAttempted = false;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const fieldId = this.getNodeParameter('fieldId', i, '', {
				extractValue: true,
			}) as string;
			sanitizedFieldId = validateUserFieldId(this, fieldId, i);

			const endpoint = `/api/v2/userfields/${encodeURIComponent(sanitizedFieldId)}`;
			userFieldRequestAttempted = true;
			const response = await zohoCliqApiRequest.call(this, 'GET', endpoint);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('userField');
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
			const effectiveError =
				userFieldRequestAttempted &&
				sanitizedFieldId &&
				isAuthoritativeUserFieldLookupNotFoundError(error)
					? normalizeUserFieldLookupNotFoundError(this, error, i, {
							fieldId: sanitizedFieldId,
						})
					: error;

			const contextFields: IDataObject | undefined = sanitizedFieldId
				? { field_id: sanitizedFieldId }
				: undefined;

			if (
				pushUserFieldRecoverableError(this, returnData, i, 'get', effectiveError, {
					contextFields,
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
							hint: 'Use the exact field_id returned by Retrieve All User Fields or Retrieve User Field.',
						},
					],
				})
			) {
				continue;
			}

			throw effectiveError;
		}
	}

	return returnData;
}
