/**
 * Create Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_CREATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, parseEmailList, validateUserIdArray } from '../../helpers/utils';
import type { IChannelBody } from '../types';
import { coerceApiResponseToObject } from '../shared/responseOutput';
import {
	applySimplifyMode,
	getSimplifyConfig,
	getSimplifyParameters,
	resolveSimplifyMode,
} from '../shared/simplifyOutput';
import {
	channelConfigJsonExample,
	channelStructuredConfigFields,
	CHANNEL_LEVEL_OPTIONS,
	channelConfigKeys,
	parseChannelStringArray,
	parseRawChannelConfig,
	pushChannelRecoverableError,
	validateChannelConfigValue,
	validateChannelImageData,
	validateChannelLevel,
} from './shared';
import { applyDisplayOptions } from '../common.descriptions';

const properties: INodeProperties[] = [
	{
		displayName: 'Channel Name',
		name: 'channelName',
		type: 'string',
		default: '',
		required: true,
		description:
			'Display name for the new channel. Runtime trims whitespace and enforces a maximum length of 50 characters.',
	},
	{
		displayName: 'Level',
		name: 'channelLevel',
		type: 'options',
		options: CHANNEL_LEVEL_OPTIONS,
		default: 'private',
		required: true,
		description:
			'Visibility level for the channel. organization = org-wide public channel, team = channel tied to one or more teams, private = invite-only participant channel, external = includes outside participants. Allowed values: organization, team, private, external.',
	},
	{
		displayName: 'Config Input Mode',
		name: 'configInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'None', value: 'none' },
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'none',
		description: 'How to provide optional channel config values. Use None to skip config entirely.',
	},
	...channelStructuredConfigFields,
	{
		displayName: 'Config JSON',
		name: 'configJson',
		type: 'json',
		default: '{}',
		description:
			'Raw config object. Allowed keys: reply_mode (normal_reply, threads, both), leave_join_info (enable, disable), add_remove_info (enable, disable), meeting_chat_type (channel, thread, host_choice). Do not set individual keys to empty strings or null; omit those keys entirely.',
		displayOptions: {
			show: {
				configInputMode: ['raw'],
			},
		},
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Add Participants',
				name: 'email_ids',
				type: 'string',
				default: '',
				description:
					'Optional comma-separated member email list to add during channel creation. You may provide this together with Add Participants by User ID; the node forwards both arrays if both are supplied, and Zoho does not document any precedence. Prefer one identifier type when possible. Blank values are treated as omitted.',
				placeholder: 'e.g. user1@example.com,user2@example.com',
			},
			{
				displayName: 'Add Participants by User ID',
				name: 'user_ids',
				type: 'string',
				default: '',
				description:
					'Optional comma-separated Zoho user IDs to add during channel creation. You may provide this together with Add Participants; the node forwards both arrays if both are supplied, and Zoho does not document any precedence. Prefer one identifier type when possible. Blank values are treated as omitted.',
				placeholder: 'e.g. 100100,120001',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description:
					'Optional channel description. Blank values are treated as omitted. Maximum length is 10500 characters.',
			},
			{
				displayName: 'Image Data (Base64)',
				name: 'image_data',
				type: 'string',
				default: '',
				description:
					'Optional base64-encoded image content for the channel display picture. Provide Base64 from the original image file bytes, not a normal image URL or arbitrary Base64 text. Common supported image formats include PNG, JPEG, GIF, WebP, AVIF, BMP, TIFF, ICO, and SVG. A data URL is accepted only when it contains base64 image data. Blank values are treated as omitted.',
				placeholder: 'e.g. iVBORw0KGgoAAAANSUhEUgAA...',
			},
			{
				displayName: 'Invite Only',
				name: 'invite_only',
				type: 'boolean',
				default: false,
				description:
					'Whether to require invite-only access for this channel. Supported only for organization and team channels. If set to true for private or external channels, the node rejects the request instead of sending a no-op value. Defaults to false when not set.',
			},
			{
				displayName: 'Team IDs',
				name: 'team_ids',
				type: 'string',
				default: '',
				description:
					'Comma-separated team IDs to associate when level is team. Zoho documents this field as mandatory for team channels. Leave blank only for non-team channel levels.',
				placeholder: 'e.g. 2323334,2328533',
			},
		],
	},
	...getSimplifyParameters('channel', 'channel', 'create'),
	{
		displayName:
			'Create Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Create_a_channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.CREATE</code>',
		name: 'createChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Create Channel as AI Tool Setup Guide: <a href="${CHANNEL_CREATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'createChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['create'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'create');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelName: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelName = this.getNodeParameter('channelName', i) as string;
			const channelLevel = validateChannelLevel(this, this.getNodeParameter('channelLevel', i), i);
			requestedChannelName = channelName.trim();

			if (!requestedChannelName) {
				throw new NodeOperationError(this.getNode(), 'Channel name is required', {
					itemIndex: i,
				});
			}

			if (requestedChannelName.length > 50) {
				throw new NodeOperationError(
					this.getNode(),
					'Channel name is too long (max 50 characters)',
					{ itemIndex: i },
				);
			}

			const body: IChannelBody = {
				name: requestedChannelName,
				level: channelLevel,
			};

			const configInputModeRaw = String(
				this.getNodeParameter('configInputMode', i, 'none'),
			).trim() as 'none' | 'structured' | 'raw';
			if (!['none', 'structured', 'raw'].includes(configInputModeRaw)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid configInputMode. Allowed values: none, structured, raw',
					{ itemIndex: i },
				);
			}

			const additionalFields = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
			const description = String(additionalFields.description ?? '').trim();
			const memberEmailsRaw = String(additionalFields.email_ids ?? '').trim();
			const memberUserIdsRaw = String(additionalFields.user_ids ?? '').trim();
			const teamIdsRaw = String(additionalFields.team_ids ?? '').trim();

			if (description) {
				if (description.length > 10500) {
					throw new NodeOperationError(
						this.getNode(),
						'Description is too long (max 10500 characters)',
						{ itemIndex: i },
					);
				}
				body.description = description;
			}

			if (additionalFields.invite_only !== undefined) {
				if (
					Boolean(additionalFields.invite_only) &&
					!['organization', 'team'].includes(channelLevel)
				) {
					throw new NodeOperationError(
						this.getNode(),
						'Invite Only is supported only for organization and team level channels',
						{ itemIndex: i },
					);
				}
				body.invite_only = additionalFields.invite_only as boolean;
			}

			if (memberEmailsRaw) {
				const memberEmails = parseEmailList(this, memberEmailsRaw, i);
				if (memberEmails.length > 0) {
					body.email_ids = memberEmails;
				}
			}

			if (memberUserIdsRaw) {
				body.user_ids = validateUserIdArray(this, memberUserIdsRaw, i);
			}

			const teamIds = teamIdsRaw
				? parseChannelStringArray(this, teamIdsRaw, i, 'team_ids')
				: undefined;
			if (channelLevel === 'team' && (!teamIds || teamIds.length === 0)) {
				throw new NodeOperationError(
					this.getNode(),
					'Team IDs are required when level is set to team',
					{ itemIndex: i },
				);
			}

			if (channelLevel === 'team' && teamIds) {
				body.team_ids = teamIds;
			}

			const imageData = validateChannelImageData(this, additionalFields.image_data, i);
			if (imageData) {
				body.image_data = imageData;
			}

			const config: IDataObject = {};
			if (configInputModeRaw === 'structured') {
				for (const configKey of channelConfigKeys) {
					const configValue = this.getNodeParameter(configKey, i, undefined);
					if (configValue !== undefined) {
						config[configKey] = validateChannelConfigValue(this, configKey, configValue, i);
					}
				}
			}

			if (configInputModeRaw === 'raw') {
				const rawConfigValue = this.getNodeParameter('configJson', i, '{}');
				const parsedConfig = parseRawChannelConfig(this, rawConfigValue, i);
				if (parsedConfig) {
					Object.assign(config, parsedConfig);
				}
			}

			if (Object.keys(config).length > 0) {
				body.config = config;
			}

			const response = await zohoCliqApiRequest.call(this, 'POST', '/api/v2/channels', body);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const simplifyConfig = getSimplifyConfig('channel');
			const json = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				simplifyConfig,
				selectedFields,
			);

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'create', error, {
					contextFields:
						requestedChannelName && requestedChannelName.length > 0
							? { channel_name: requestedChannelName }
							: undefined,
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('config json') ||
								normalizedMessage.includes('unsupported config key') ||
								normalizedMessage.includes('invalid value for "reply_mode"') ||
								normalizedMessage.includes('invalid value for "leave_join_info"') ||
								normalizedMessage.includes('invalid value for "add_remove_info"') ||
								normalizedMessage.includes('invalid value for "meeting_chat_type"'),
							reason: 'INVALID_CONFIG_JSON',
							hint: `Use a JSON object with only reply_mode, leave_join_info, add_remove_info, and meeting_chat_type. Example: ${channelConfigJsonExample}`,
						},
						{
							match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
							reason: 'BAD_REQUEST',
							hint: 'Verify the create-channel inputs and retry. Start with the required fields only, then add optional fields incrementally to isolate the invalid value.',
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
