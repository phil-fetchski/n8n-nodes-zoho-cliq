/**
 * Get Department operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { DEPARTMENT_GET_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import { zohoCliqApiRequest } from '../../transport';
import { DEPARTMENT_NOT_FOUND_HINT, runDepartmentLookupPreflightGate } from '../shared/preflight';
import {
	departmentIdLocator,
	pushDepartmentRecoverableError,
	validateDepartmentId,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('department', 'get');

const properties: INodeProperties[] = [
	{
		...departmentIdLocator,
		description: 'The unique department ID to retrieve.',
	},
	...getSimplifyParameters('department', 'department', 'get'),
	{
		displayName: `Get Department Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#retrieve-department-info" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'getDepartmentDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Department/Get Department as AI Tool Setup Guide: <a href="${DEPARTMENT_GET_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'getDepartmentAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['department'],
		operation: ['get'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function resolveStatusCode(error: unknown): number | undefined {
	if (!error || typeof error !== 'object' || Array.isArray(error)) {
		return undefined;
	}

	const root = error as IDataObject;
	const directStatusCode = root.statusCode;
	if (typeof directStatusCode === 'number' && Number.isInteger(directStatusCode)) {
		return directStatusCode;
	}

	const response =
		root.response && typeof root.response === 'object' && !Array.isArray(root.response)
			? (root.response as IDataObject)
			: undefined;
	if (!response) {
		return undefined;
	}

	const responseStatusCode = response.statusCode;
	if (typeof responseStatusCode === 'number' && Number.isInteger(responseStatusCode)) {
		return responseStatusCode;
	}

	const responseStatus = response.status;
	if (typeof responseStatus === 'number' && Number.isInteger(responseStatus)) {
		return responseStatus;
	}

	return undefined;
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedDepartmentId: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const departmentId = this.getNodeParameter('departmentId', i, '', {
				extractValue: true,
			}) as string;
			requestedDepartmentId = departmentId.trim();
			const sanitizedDepartmentId = validateDepartmentId(this, departmentId, i);
			await runDepartmentLookupPreflightGate(this, i, grantedScopes, sanitizedDepartmentId);

			const endpoint = `/api/v2/departments/${encodeURIComponent(sanitizedDepartmentId)}`;
			let response: IDataObject;
			try {
				response = (await zohoCliqApiRequest.call(this, 'GET', endpoint)) as IDataObject;
			} catch (error) {
				if (resolveStatusCode(error) === 404) {
					const departmentNotFoundError = new NodeOperationError(
						this.getNode(),
						`No department found for Department ID "${sanitizedDepartmentId}".`,
						{
							itemIndex: i,
							description: DEPARTMENT_NOT_FOUND_HINT,
						},
					);
					(
						departmentNotFoundError as NodeOperationError & {
							code?: string;
						}
					).code = 'DEPARTMENT_NOT_FOUND';
					throw departmentNotFoundError;
				}

				throw error;
			}

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('department');
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
				pushDepartmentRecoverableError(this, returnData, i, 'get', error, {
					contextFields: requestedDepartmentId
						? { department_id: requestedDepartmentId }
						: undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('department id is required') ||
								normalizedMessage.includes('invalid department id format') ||
								normalizedMessage.includes('department id is too long') ||
								normalizedMessage.includes(
									'sorry, we are unable to display your departments now. please try again later',
								),
							reason: 'INVALID_DEPARTMENT_ID',
							hint: 'Use the exact Zoho Cliq department ID for the department you want to retrieve.',
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
