/**
 * Create Role operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { ROLE_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { runRoleLookupPreflightGate, runRoleUsersPreflightGate } from '../shared/preflight';
import {
	CLONE_ROLE_NOT_FOUND_HINT,
	CLONE_ROLE_NOT_FOUND_MESSAGE,
	parseDelimitedUserIds,
	parseRolePayloadInput,
	pushRoleRecoverableError,
	roleIdLocator,
	USER_IDS_NOT_FOUND_HINT,
	USER_IDS_NOT_FOUND_MESSAGE,
	validateRoleInputMode,
	validateRolePayload,
} from './common';
import { applyDisplayOptions } from '../common.descriptions';

const requiredScope = getRequiredScopeForOperation('role', 'create');

const properties: INodeProperties[] = [
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		description:
			'Choose whether to build the payload with individual fields or provide JSON directly',
	},
	{
		displayName: 'Name',
		name: 'name',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Name of the role to create',
	},
	{
		displayName: 'Profile Type',
		name: 'profileType',
		type: 'options',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		options: [
			{ name: 'Members', value: 'Members' },
			{ name: 'Cliq Admin', value: 'Cliq Admin' },
			{ name: 'Admin', value: 'Admin' },
		],
		default: 'Members',
		description: 'Role type as defined by Zoho Cliq',
	},
	{
		...roleIdLocator,
		displayName: 'Clone Permissions from Role',
		name: 'cloneId',
		default: { mode: 'list', value: '' },
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		required: false,
		description: 'Optional role to copy permissions from when creating the new role',
	},
	{
		displayName: 'Description',
		name: 'description',
		type: 'string',
		typeOptions: {
			rows: 3,
		},
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		description: 'Optional role description',
	},
	{
		displayName: 'User IDs',
		name: 'userIds',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				inputMode: ['structured'],
			},
		},
		placeholder: 'e.g. 62913657,63569660,67580202',
		description: 'Optional comma-separated user IDs to assign to the role',
	},
	{
		displayName: 'Role Definition (JSON)',
		name: 'roleDefinition',
		type: 'json',
		default: '{}',
		required: true,
		displayOptions: {
			show: {
				inputMode: ['raw'],
			},
		},
		description:
			'Using JSON payload to create a role. Supports a literal JSON object or stringified JSON object. Allowed keys: name, profile_type, user_ids, description, clone_id.',
	},
	{
		displayName: `Create a Role Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#create-role" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'createRoleDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Role/Create Role as AI Tool Setup Guide: <a href="${ROLE_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createRoleAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['role'],
		operation: ['create'],
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
		let requestedName: string | undefined;
		let requestedProfileType: string | undefined;
		let requestedCloneId: string | undefined;
		let requestedUserIds: string | undefined;
		let parsedUserIds: string[] | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const inputMode = validateRoleInputMode(this, this.getNodeParameter('inputMode', i), i);

			let body: IDataObject;
			if (inputMode === 'structured') {
				const name = (this.getNodeParameter('name', i) as string).trim();
				const profileType = this.getNodeParameter('profileType', i) as string;
				const description = (this.getNodeParameter('description', i, '') as string).trim();
				const cloneIdRaw = this.getNodeParameter('cloneId', i, '', {
					extractValue: true,
				}) as string;
				const cloneId = cloneIdRaw.trim();
				const userIds = (this.getNodeParameter('userIds', i, '') as string).trim();
				requestedName = name;
				requestedProfileType = profileType.trim();
				requestedCloneId = cloneId;
				requestedUserIds = userIds;

				body = {
					name,
					profile_type: profileType,
				};

				if (description) {
					body.description = description;
				}

				if (cloneId) {
					body.clone_id = cloneId;
				}

				if (userIds) {
					body.user_ids = parseDelimitedUserIds(this, userIds, i, 'User IDs');
				}
			} else {
				const roleDefinition = this.getNodeParameter('roleDefinition', i, {}) as unknown;
				body = parseRolePayloadInput(this, roleDefinition, i, 'Role Definition');
				requestedName = typeof body.name === 'string' ? body.name.trim() : undefined;
				requestedProfileType =
					typeof body.profile_type === 'string' ? body.profile_type.trim() : undefined;
				requestedCloneId = typeof body.clone_id === 'string' ? body.clone_id.trim() : undefined;
				if (Array.isArray(body.user_ids)) {
					requestedUserIds = body.user_ids.map((value) => String(value).trim()).join(',');
				}
			}

			body = validateRolePayload(this, body, i, 'Role Definition', {
				requireName: true,
				requireProfileType: true,
				allowedFields: ['name', 'profile_type', 'user_ids', 'description', 'clone_id'],
			});
			parsedUserIds = Array.isArray(body.user_ids) ? (body.user_ids as string[]) : undefined;

			if (typeof body.clone_id === 'string' && body.clone_id.trim()) {
				await runRoleLookupPreflightGate(this, i, grantedScopes, body.clone_id, {
					message: CLONE_ROLE_NOT_FOUND_MESSAGE,
					hint: CLONE_ROLE_NOT_FOUND_HINT,
				});
			}
			if (parsedUserIds?.length) {
				await runRoleUsersPreflightGate(this, parsedUserIds, i, grantedScopes);
			}

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/profiles', body);

			const executionData = this.helpers.constructExecutionMetaData([{ json: response }], {
				itemData: { item: i },
			});
			returnData.push(...executionData);
		} catch (error) {
			const missingUserIds =
				error &&
				typeof error === 'object' &&
				!Array.isArray(error) &&
				Array.isArray((error as IDataObject).zohoCliqMissingUserIds)
					? ((error as IDataObject).zohoCliqMissingUserIds as string[])
					: undefined;
			if (
				pushRoleRecoverableError(this, returnData, i, 'create', error, {
					contextFields: {
						...(requestedName ? { role_name: requestedName } : {}),
						...(requestedProfileType ? { profile_type: requestedProfileType } : {}),
						...(requestedCloneId ? { clone_id: requestedCloneId } : {}),
						...(parsedUserIds
							? { user_ids: parsedUserIds }
							: requestedUserIds
								? { user_ids: requestedUserIds }
								: {}),
						...(missingUserIds?.length ? { invalid_user_ids: missingUserIds } : {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) => normalizedMessage.includes('input mode must be either'),
							reason: 'INVALID_INPUT_MODE',
							hint: 'Use either Using Fields Below or Using JSON for the role create request.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('role name is required') ||
								normalizedMessage.includes('role name is too long'),
							reason: 'INVALID_ROLE_NAME',
							hint: 'Provide a non-empty role name up to 120 characters.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('profile type is required') ||
								normalizedMessage.includes('profile type must be one of'),
							reason: 'INVALID_PROFILE_TYPE',
							hint: 'Use one of these profile types exactly: Members, Cliq Admin, Admin.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(CLONE_ROLE_NOT_FOUND_MESSAGE.toLowerCase()) ||
								normalizedMessage.includes('clone source role not found'),
							reason: 'CLONE_ROLE_NOT_FOUND',
							messageOverride: CLONE_ROLE_NOT_FOUND_MESSAGE,
							hint: CLONE_ROLE_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes(USER_IDS_NOT_FOUND_MESSAGE.toLowerCase()) ||
								normalizedMessage.includes('missing user ids:'),
							reason: 'USER_IDS_NOT_FOUND',
							messageOverride: USER_IDS_NOT_FOUND_MESSAGE,
							hint: USER_IDS_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('role definition must be') ||
								normalizedMessage.includes('role definition cannot be empty') ||
								normalizedMessage.includes('unsafe key "') ||
								normalizedMessage.includes('unsupported field'),
							reason: 'INVALID_ROLE_PAYLOAD',
							hint: 'Provide a valid JSON object using only the supported create keys: name, profile_type, user_ids, description, clone_id.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('user ids') ||
								normalizedMessage.includes('clone id') ||
								normalizedMessage.includes('invalid role id format'),
							reason: 'INVALID_ROLE_RELATION_INPUT',
							hint: 'Use canonical Zoho Cliq role IDs and user IDs only.',
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
