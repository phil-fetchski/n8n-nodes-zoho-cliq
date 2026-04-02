/**
 * Change Channel Permission operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_CHANGE_PERMISSION_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId, validateChannelName } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	extractChannelIdFromLookupEntity,
	pushChannelRecoverableError,
	resolveChannelLocatorInput,
} from './shared';

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
const rolePermissionKeys = [
	'admin_permission',
	'moderator_permission',
	'member_permission',
] as const;
const rolePermissionDefaults = {
	admin_permission: {
		audio_conference: true,
		leave_channel: true,
		special_mentions: true,
		send_message: true,
		unarchive_channel: true,
		edit_channel_info: true,
		delete_others_message: true,
		sticky_message: true,
		close_thread: true,
		delete_channel: true,
		edit_my_msg: true,
		video_conference: true,
		delete_my_msg: true,
		mention_users: true,
		clear_all_messages: true,
		post_reply: true,
		archive_channel: true,
		add_participant: true,
		prime_time: true,
		remove_participant: true,
	},
	moderator_permission: {
		audio_conference: true,
		leave_channel: true,
		special_mentions: false,
		send_message: true,
		unarchive_channel: false,
		edit_channel_info: true,
		delete_others_message: false,
		sticky_message: true,
		close_thread: true,
		delete_channel: false,
		edit_my_msg: true,
		video_conference: true,
		delete_my_msg: true,
		mention_users: true,
		clear_all_messages: false,
		post_reply: true,
		archive_channel: false,
		add_participant: true,
		prime_time: true,
		remove_participant: true,
	},
	member_permission: {
		audio_conference: true,
		leave_channel: true,
		special_mentions: false,
		send_message: true,
		unarchive_channel: false,
		edit_channel_info: false,
		delete_others_message: false,
		sticky_message: false,
		close_thread: true,
		delete_channel: false,
		edit_my_msg: true,
		video_conference: true,
		delete_my_msg: true,
		mention_users: true,
		clear_all_messages: false,
		post_reply: true,
		archive_channel: false,
		add_participant: true,
		prime_time: false,
		remove_participant: false,
	},
} as const;
const allowedPermissionKeys = new Set(Object.keys(rolePermissionDefaults.admin_permission));
const adminPermissionJsonDefault = JSON.stringify(rolePermissionDefaults.admin_permission, null, 2);
const moderatorPermissionJsonDefault = JSON.stringify(
	rolePermissionDefaults.moderator_permission,
	null,
	2,
);
const memberPermissionJsonDefault = JSON.stringify(
	rolePermissionDefaults.member_permission,
	null,
	2,
);
type RolePermissionKey = keyof typeof rolePermissionDefaults;
const roleDisplayNameOverrides: Record<string, string> = {
	edit_my_msg: 'Edit My Msg',
	delete_my_msg: 'Delete My Msg',
};

function toPermissionDisplayName(permissionKey: string): string {
	return (
		roleDisplayNameOverrides[permissionKey] ??
		permissionKey
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ')
	);
}

function createRolePermissionFields(roleKey: RolePermissionKey): INodeProperties[] {
	/* eslint-disable n8n-nodes-base/node-param-default-wrong-for-boolean */
	return Object.entries(rolePermissionDefaults[roleKey]).map(([permissionKey, defaultValue]) => ({
		displayName: toPermissionDisplayName(permissionKey),
		name: permissionKey,
		type: 'boolean',
		default: defaultValue,
	}));
	/* eslint-enable n8n-nodes-base/node-param-default-wrong-for-boolean */
}

const adminPermissionFields = createRolePermissionFields('admin_permission');
const moderatorPermissionFields = createRolePermissionFields('moderator_permission');
const memberPermissionFields = createRolePermissionFields('member_permission');

function ensureSafeObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			throw new NodeOperationError(context.getNode(), `${path} cannot be empty`, {
				itemIndex,
			});
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a valid JSON object when provided as text`,
				{ itemIndex },
			);
		}

		return ensureSafeObject(context, parsed, itemIndex, path);
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, {
			itemIndex,
		});
	}

	const obj = value as IDataObject;

	for (const key of Object.keys(obj)) {
		if (blockedKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`Unsafe key "${key}" is not allowed in ${path}`,
				{
					itemIndex,
				},
			);
		}

		const child = obj[key];
		if (child && typeof child === 'object' && !Array.isArray(child)) {
			ensureSafeObject(context, child, itemIndex, `${path}.${key}`);
		}
	}

	return obj;
}

function objectHasKeys(value: IDataObject): boolean {
	return Object.keys(value).length > 0;
}

function validatePermissionObject(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): IDataObject {
	const permissionObject = ensureSafeObject(context, value, itemIndex, path);

	for (const key of Object.keys(permissionObject)) {
		if (!allowedPermissionKeys.has(key)) {
			throw new NodeOperationError(
				context.getNode(),
				`${path} contains unsupported permission "${key}"`,
				{ itemIndex },
			);
		}

		if (typeof permissionObject[key] !== 'boolean') {
			throw new NodeOperationError(context.getNode(), `${path}.${key} must be a boolean value`, {
				itemIndex,
			});
		}
	}

	return permissionObject;
}

function isUnmodifiedRolePermissionDefault(
	roleKey: RolePermissionKey,
	permissionObject: IDataObject,
): boolean {
	const defaultPermission = rolePermissionDefaults[roleKey] as Record<string, boolean>;
	const permissionKeys = Object.keys(permissionObject);
	const defaultKeys = Object.keys(defaultPermission);

	if (permissionKeys.length !== defaultKeys.length) {
		return false;
	}

	for (const key of defaultKeys) {
		if (permissionObject[key] !== defaultPermission[key]) {
			return false;
		}
	}

	return true;
}

const properties: INodeProperties[] = [
	channelRLC,
	{
		displayName: 'Admin Input Mode',
		name: 'adminInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Using Fields Below',
				value: 'structured',
			},
			{
				name: 'Using JSON',
				value: 'raw',
			},
		],
		default: 'structured',
		description:
			'Choose how admin permissions are provided: individual boolean fields or a JSON object containing allowed permission keys',
	},
	{
		displayName: 'Admin Permissions',
		name: 'adminPermission',
		type: 'collection',
		default: {},
		description:
			'Structured admin permission values. Include only keys you want to change for admin role behavior.',
		options: adminPermissionFields,
		displayOptions: {
			show: {
				resource: ['channel'],
				operation: ['changePermission'],
				adminInputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Admin Permission JSON',
		name: 'adminPermissionJson',
		type: 'json',
		default: adminPermissionJsonDefault,
		description:
			'Using JSON object for admin permissions. Keys must match supported permission names and values must be boolean.',
		displayOptions: {
			show: {
				resource: ['channel'],
				operation: ['changePermission'],
				adminInputMode: ['raw'],
			},
		},
	},
	{
		displayName: 'Moderator Input Mode',
		name: 'moderatorInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Using Fields Below',
				value: 'structured',
			},
			{
				name: 'Using JSON',
				value: 'raw',
			},
		],
		default: 'structured',
		description:
			'Choose how moderator permissions are provided: individual boolean fields or a JSON object containing allowed permission keys',
	},
	{
		displayName: 'Moderator Permissions',
		name: 'moderatorPermission',
		type: 'collection',
		default: {},
		description:
			'Structured moderator permission values. Include only keys you want to change for moderator role behavior.',
		options: moderatorPermissionFields,
		displayOptions: {
			show: {
				resource: ['channel'],
				operation: ['changePermission'],
				moderatorInputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Moderator Permission JSON',
		name: 'moderatorPermissionJson',
		type: 'json',
		default: moderatorPermissionJsonDefault,
		description:
			'Using JSON object for moderator permissions. Keys must match supported permission names and values must be boolean.',
		displayOptions: {
			show: {
				resource: ['channel'],
				operation: ['changePermission'],
				moderatorInputMode: ['raw'],
			},
		},
	},
	{
		displayName: 'Member Input Mode',
		name: 'memberInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Using Fields Below',
				value: 'structured',
			},
			{
				name: 'Using JSON',
				value: 'raw',
			},
		],
		default: 'structured',
		description:
			'Choose how member permissions are provided: individual boolean fields or a JSON object containing allowed permission keys',
	},
	{
		displayName: 'Member Permissions',
		name: 'memberPermission',
		type: 'collection',
		default: {},
		description:
			'Structured member permission values. Include only keys you want to change for member role behavior.',
		options: memberPermissionFields,
		displayOptions: {
			show: {
				resource: ['channel'],
				operation: ['changePermission'],
				memberInputMode: ['structured'],
			},
		},
	},
	{
		displayName: 'Member Permission JSON',
		name: 'memberPermissionJson',
		type: 'json',
		default: memberPermissionJsonDefault,
		description:
			'Using JSON object for member permissions. Keys must match supported permission names and values must be boolean.',
		displayOptions: {
			show: {
				resource: ['channel'],
				operation: ['changePermission'],
				memberInputMode: ['raw'],
			},
		},
	},
	...getSimplifyParameters('channel', 'channel', 'changePermission'),
	{
		displayName:
			'Change Channel Permission Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Change_Permission" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'changeChannelPermissionDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Change Channel Permission as AI Tool Setup Guide: <a href="${CHANNEL_CHANGE_PERMISSION_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'changeChannelPermissionAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['changePermission'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'changePermission');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		let channelLocatorMode: 'id' | 'name' = 'id';
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelLocator = resolveChannelLocatorInput(this, i);
			channelLocatorMode = channelLocator.mode;
			const channelIdValue = channelLocator.value;
			requestedChannelId = channelIdValue.trim();
			let resolvedChannelId: string | undefined;
			const sanitizedChannelLocator =
				channelLocatorMode === 'name'
					? validateChannelName(this, channelIdValue, i)
					: validateChannelId(this, channelIdValue, i);
			let sanitizedChannelId = sanitizedChannelLocator;
			if (channelLocatorMode === 'name') {
				const preflightResult = await runChannelUniqueNameLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedChannelLocator,
				);
				resolvedChannelId = extractChannelIdFromLookupEntity(
					preflightResult.status === 'validated' ? preflightResult.entity : undefined,
				);
				if (!resolvedChannelId) {
					const lookupResponse = await zohoCliqApiRequest.call(
						this,
						'GET',
						`/api/v2/channelsbyname/${encodeURIComponent(sanitizedChannelLocator)}`,
					);
					resolvedChannelId = extractChannelIdFromLookupEntity(lookupResponse);
				}
				if (!resolvedChannelId) {
					throw new NodeOperationError(
						this.getNode(),
						'Channel lookup by unique name did not return a usable channel_id. Change Permission requires a valid channel ID for this endpoint.',
						{
							itemIndex: i,
						},
					);
				}
				sanitizedChannelId = validateChannelId(this, resolvedChannelId, i);
			} else {
				await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedChannelId);
			}
			const body: IDataObject = {};
			for (const roleKey of rolePermissionKeys) {
				const roleLabel = roleKey.replace('_permission', '');
				const modeParamName = `${roleLabel}InputMode`;
				const structuredParamName = `${roleLabel}Permission`;
				const rawParamName = `${roleLabel}PermissionJson`;
				const roleDisplayName = `${roleLabel.charAt(0).toUpperCase()}${roleLabel.slice(1)} Permission`;
				const inputMode = this.getNodeParameter(modeParamName, i, 'structured') as
					| 'structured'
					| 'raw';
				if (!['structured', 'raw'].includes(inputMode)) {
					throw new NodeOperationError(
						this.getNode(),
						`Invalid ${modeParamName}. Allowed values: structured, raw`,
						{ itemIndex: i },
					);
				}
				const permissionValue =
					inputMode === 'structured'
						? this.getNodeParameter(structuredParamName, i, {})
						: this.getNodeParameter(rawParamName, i, {});

				const permissionObject = validatePermissionObject(
					this,
					permissionValue,
					i,
					roleDisplayName,
				);
				if (
					objectHasKeys(permissionObject) &&
					!(inputMode === 'raw' && isUnmodifiedRolePermissionDefault(roleKey, permissionObject))
				) {
					body[roleKey] = permissionObject;
				}
			}

			if (Object.keys(body).length === 0) {
				throw new NodeOperationError(
					this.getNode(),
					'At least one permission object must be provided',
					{ itemIndex: i },
				);
			}

			const response = await zohoCliqApiRequest.call(
				this,
				'PUT',
				`/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}`,
				body,
			);
			const outputChannelFields: IDataObject =
				channelLocatorMode === 'name'
					? { channel_unique_name: sanitizedChannelLocator }
					: { channel_id: sanitizedChannelId };
			if (channelLocatorMode === 'name' && resolvedChannelId) {
				outputChannelFields.channel_id = resolvedChannelId;
			}

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const config = getSimplifyConfig('channel');
			const simplified = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				config,
				selectedFields,
			);

			// In simplified mode, include only the permission keys that were
			// actually sent in the request body so the caller can verify exactly
			// what changed without wading through 60+ unchanged permission fields.
			if (mode === 'simplified') {
				for (const roleKey of rolePermissionKeys) {
					if (body[roleKey] !== undefined) {
						simplified[roleKey] = body[roleKey];
					}
				}
			}

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: {
							success: true,
							...outputChannelFields,
							...simplified,
						},
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'changePermission', error, {
					contextFields:
						requestedChannelId && requestedChannelId.length > 0
							? channelLocatorMode === 'name'
								? { channel_unique_name: requestedChannelId }
								: { channel_id: requestedChannelId }
							: undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('must be a valid json object when provided as text') ||
								normalizedMessage.includes('must be a json object'),
							reason: 'INVALID_PERMISSION_JSON',
							hint: 'Ensure the permission value is a valid JSON object, for example {"send_message": true}.',
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
