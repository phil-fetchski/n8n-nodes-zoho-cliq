/**
 * Update Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_UPDATE_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { zohoCliqApiRequest } from '../../transport';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId, validateChannelName } from '../../helpers/utils';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
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
	channelConfigKeys,
	channelStructuredConfigFieldsByName,
	extractChannelIdFromLookupEntity,
	parseRawChannelConfig,
	pushChannelRecoverableError,
	resolveChannelLocatorInput,
	resolveRawChannelConfigInput,
	validateChannelConfigValue,
	validateChannelImageData,
} from './shared';

const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
function assertAllowedUpdateFieldKey(
	context: IExecuteFunctions,
	key: string,
	itemIndex: number,
	path: string,
): void {
	if (blockedKeys.has(key)) {
		throw new NodeOperationError(context.getNode(), `Invalid key "${key}" in ${path}`, {
			itemIndex,
		});
	}
}

const properties: INodeProperties[] = [
	{
		displayName:
			'Updating "Name" changes only the channel display name. It does not change the channel unique name.',
		name: 'updateChannelDisplayNameNotice',
		type: 'notice',
		default: '',
	},
	channelRLC,
	{
		displayName: 'Update Fields',
		name: 'additionalFields',
		type: 'collection',
		default: {},
		options: [
			channelStructuredConfigFieldsByName.add_remove_info,
			{
				displayName: 'Config Input Mode',
				name: 'configInputMode',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'None',
						value: 'none',
					},
					{
						name: 'Using Fields Below',
						value: 'structured',
					},
					{
						name: 'Using JSON',
						value: 'raw',
					},
				],
				default: 'none',
				description:
					'How to provide channel config updates. Keep Using Fields Below for normal workflows. For AI Tool setup, choose Using JSON manually in the UI and do not expose this selector to the model.',
			},
			{
				displayName: 'Config JSON',
				name: 'configJson',
				type: 'json',
				default: '{}',
				description:
					'Optional raw config object. Before using this field, manually set Config Input Mode to Using JSON. Allowed keys and values: reply_mode (normal_reply, threads, both), leave_join_info (enable, disable), add_remove_info (enable, disable), meeting_chat_type (channel, thread, host_choice). Blank/empty means the entire field is omitted, an empty string, or an empty object {}. Do not set individual keys to empty strings or null; omit those keys entirely.',
				displayOptions: {
					show: {
						configInputMode: ['raw'],
					},
				},
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				description:
					'Optional new channel description. Runtime trims whitespace and omits blank values. Maximum length is 10500 characters.',
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
			channelStructuredConfigFieldsByName.leave_join_info,
			channelStructuredConfigFieldsByName.meeting_chat_type,
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				description:
					'Optional new channel display name. Runtime trims whitespace and omits blank values. Maximum length is 50 characters.',
			},
			channelStructuredConfigFieldsByName.reply_mode,
		],
	},
	...getSimplifyParameters('channel', 'channel', 'update'),
	{
		displayName:
			'Update Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Update_a_channel" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'updateChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Update Channel as AI Tool Setup Guide: <a href="${CHANNEL_UPDATE_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'updateChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['update'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'update');
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

			let sanitizedId =
				channelLocatorMode === 'name'
					? validateChannelName(this, channelIdValue, i)
					: validateChannelId(this, channelIdValue, i);

			const additionalFields =
				(this.getNodeParameter('additionalFields', i, undefined) as IDataObject | undefined) ??
				(this.getNodeParameter('updateFields', i, {}) as IDataObject);
			const allowedFields = [
				'name',
				'description',
				'image_data',
				'configInputMode',
				...channelConfigKeys,
				'configJson',
			];
			const body: Partial<IChannelBody> = {};
			const config: IDataObject = {};

			for (const key of Object.keys(additionalFields)) {
				assertAllowedUpdateFieldKey(this, key, i, 'Update Fields');

				if (!allowedFields.includes(key)) {
					continue;
				}

				const value = additionalFields[key];

				if (key === 'name') {
					const name = String(value ?? '').trim();
					if (name) {
						if (name.length > 50) {
							throw new NodeOperationError(
								this.getNode(),
								'Channel name is too long (max 50 characters)',
								{ itemIndex: i },
							);
						}
						body.name = name;
					}
				}

				if (key === 'description') {
					const desc = String(value ?? '').trim();
					if (desc) {
						if (desc.length > 10500) {
							throw new NodeOperationError(
								this.getNode(),
								'Description is too long (max 10500 characters)',
								{ itemIndex: i },
							);
						}
						body.description = desc;
					}
				}

				if (key === 'image_data') {
					const imageData = validateChannelImageData(this, value, i);
					if (imageData) {
						body.image_data = imageData;
					}
				}
			}

			const nestedConfigInputMode = this.getNodeParameter(
				'additionalFields.configInputMode',
				i,
				undefined,
			);
			const legacyNestedConfigInputMode =
				nestedConfigInputMode === undefined
					? this.getNodeParameter('updateFields.configInputMode', i, undefined)
					: undefined;
			const configInputModeRaw = String(
				additionalFields.configInputMode ??
					nestedConfigInputMode ??
					legacyNestedConfigInputMode ??
					'none',
			).trim() as 'none' | 'structured' | 'raw';
			if (!['none', 'structured', 'raw'].includes(configInputModeRaw)) {
				throw new NodeOperationError(
					this.getNode(),
					'Invalid configInputMode. Allowed values: none, structured, raw',
					{ itemIndex: i },
				);
			}

			const nestedRawConfigValue = this.getNodeParameter(
				'additionalFields.configJson',
				i,
				undefined,
			);
			const legacyNestedRawConfigValue =
				nestedRawConfigValue === undefined
					? this.getNodeParameter('updateFields.configJson', i, undefined)
					: undefined;
			const rawConfigValue = resolveRawChannelConfigInput(
				nestedRawConfigValue,
				legacyNestedRawConfigValue,
				additionalFields.configJson,
			);
			const configInputMode =
				configInputModeRaw === 'none' && rawConfigValue !== undefined ? 'raw' : configInputModeRaw;

			if (configInputMode === 'structured') {
				for (const configKey of channelConfigKeys) {
					if (additionalFields[configKey] !== undefined) {
						config[configKey] = validateChannelConfigValue(
							this,
							configKey,
							additionalFields[configKey],
							i,
						);
					}
				}
			}

			if (configInputMode === 'raw') {
				const parsedConfig = parseRawChannelConfig(this, rawConfigValue, i);
				if (parsedConfig) {
					Object.assign(config, parsedConfig);
				}
			}

			if (Object.keys(config).length > 0) {
				body.config = config;
			}

			if (Object.keys(body).length === 0) {
				throw new NodeOperationError(this.getNode(), 'At least one field must be updated', {
					itemIndex: i,
				});
			}

			if (channelLocatorMode === 'name') {
				const preflightResult = await runChannelUniqueNameLookupPreflightGate(
					this,
					i,
					grantedScopes,
					sanitizedId,
				);
				sanitizedId =
					extractChannelIdFromLookupEntity(
						preflightResult.status === 'validated' ? preflightResult.entity : undefined,
					) ?? sanitizedId;
			} else {
				await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedId);
			}

			const response = await zohoCliqApiRequest.call(
				this,
				'PUT',
				`/api/v2/channels/${encodeURIComponent(sanitizedId)}`,
				body,
			);

			const { mode, selectedFields } = resolveSimplifyMode(this, i);
			const simplifyConfig = getSimplifyConfig('channel');
			const simplified = applySimplifyMode(
				coerceApiResponseToObject(response),
				mode,
				simplifyConfig,
				selectedFields,
			);
			const json = { updated: true, ...simplified };

			const executionData = this.helpers.constructExecutionMetaData([{ json }], {
				itemData: { item: i },
			});

			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'update', error, {
					contextFields:
						requestedChannelId && requestedChannelId.length > 0
							? channelLocatorMode === 'name'
								? { channel_unique_name: requestedChannelId }
								: { channel_id: requestedChannelId }
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
