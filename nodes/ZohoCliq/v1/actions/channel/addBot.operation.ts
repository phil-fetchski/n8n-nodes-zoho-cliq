/**
 * Add Bot to Channel operation
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { CHANNEL_ADD_BOT_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, validateChannelId, validateChannelName } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { extractCliqErrorSearchText } from '../shared/errorResponse';
import { applyDisplayOptions, channelRLC } from '../common.descriptions';
import { validateBotUniqueName as validateSharedBotUniqueName } from '../bot/common';
import {
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../shared/preflight';
import {
	extractChannelUniqueNameFromLookupEntity,
	pushChannelRecoverableError,
	resolveChannelEnhancedOutput,
	resolveChannelLocatorInput,
} from './shared';

const properties: INodeProperties[] = [
	{
		displayName: 'Bot Unique Name',
		name: 'botUniqueName',
		type: 'string',
		default: '',
		required: true,
		description:
			'Unique bot identifier to associate with the selected channel. Use the bot unique name (not display name), containing lowercase letters only (a-z), maximum 100 characters.',
		placeholder: 'e.g. statusbot',
	},
	channelRLC,
	{
		displayName: 'Enable Enhanced Output',
		name: 'includeEnhancedOutput',
		type: 'boolean',
		default: true,
		description:
			"Whether to return workflow-friendly success metadata. Disable to return Cliq's standard response (typically empty for success).",
	},
	{
		displayName:
			'Add Bot to Channel Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Channels_Add_Bot" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>ZohoCliq.Channels.UPDATE</code>',
		name: 'addBotToChannelDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Channel/Add Bot to Channel as AI Tool Setup Guide: <a href="${CHANNEL_ADD_BOT_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'addBotToChannelAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['channel'],
		operation: ['addBot'],
	},
};

export const description: INodeProperties[] = applyDisplayOptions(properties, displayOptions);

function isAlreadyAssociatedError(error: unknown): boolean {
	const messageParts = extractCliqErrorSearchText(error).toLowerCase();

	return (
		messageParts.includes('already') &&
		(messageParts.includes('member') ||
			messageParts.includes('associated') ||
			messageParts.includes('association') ||
			messageParts.includes('exists'))
	);
}

async function resolveChannelUniqueName(
	context: IExecuteFunctions,
	grantedScopes: string,
	channelLocator: { mode: 'id' | 'name'; value: string },
	itemIndex: number,
): Promise<string> {
	const locatorMode = channelLocator.mode;
	const channelLocatorValue = channelLocator.value;

	if (locatorMode === 'name') {
		const sanitizedChannelUniqueName = validateChannelName(context, channelLocatorValue, itemIndex);
		await runChannelUniqueNameLookupPreflightGate(
			context,
			itemIndex,
			grantedScopes,
			sanitizedChannelUniqueName,
		);
		return sanitizedChannelUniqueName;
	}

	const sanitizedChannelId = validateChannelId(context, channelLocatorValue, itemIndex);
	const preflightResult = await runChannelIdLookupPreflightGate(
		context,
		itemIndex,
		grantedScopes,
		sanitizedChannelId,
	);

	const uniqueNameFromPreflight =
		preflightResult.status === 'validated'
			? extractChannelUniqueNameFromLookupEntity(preflightResult.entity)
			: undefined;
	if (uniqueNameFromPreflight) {
		return validateChannelName(context, uniqueNameFromPreflight, itemIndex);
	}

	const response = await zohoCliqApiRequest.call(
		context,
		'GET',
		`/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}`,
	);

	const uniqueName = extractChannelUniqueNameFromLookupEntity(response);
	if (!uniqueName) {
		throw new NodeOperationError(
			context.getNode(),
			'Could not resolve channel unique name from selected channel. Use "By Unique Name" mode.',
			{ itemIndex },
		);
	}

	return validateChannelName(context, uniqueName, itemIndex);
}

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('channel', 'addBot');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let requestedChannelId: string | undefined;
		let requestedBotUniqueName: string | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const botUniqueName = this.getNodeParameter('botUniqueName', i) as string;
			requestedBotUniqueName = botUniqueName.trim();
			const channelLocator = resolveChannelLocatorInput(this, i);
			requestedChannelId = channelLocator.value.trim();

			const sanitizedBotUniqueName = validateSharedBotUniqueName(this, botUniqueName, i);
			const sanitizedChannelUniqueName = await resolveChannelUniqueName(
				this,
				grantedScopes,
				channelLocator,
				i,
			);

			let response: IDataObject;
			try {
				response = await zohoCliqApiRequest.call(
					this,
					'POST',
					`/api/v2/bots/${encodeURIComponent(sanitizedBotUniqueName)}/associate`,
					{
						channel_unique_name: sanitizedChannelUniqueName,
					},
				);
			} catch (error) {
				if (isAlreadyAssociatedError(error)) {
					response = {
						status: 'skipped',
						message: 'Bot association skipped because it is already in the selected channel.',
						already_associated: true,
					};
				} else {
					throw error;
				}
			}

			const { includeEnhancedOutput, responseJson, rawResponse } = resolveChannelEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? {
									success: true,
									operation: 'add_bot_to_channel',
									bot_unique_name: sanitizedBotUniqueName,
									channel_locator: requestedChannelId,
									channel_unique_name: sanitizedChannelUniqueName,
									...responseJson,
								}
							: (rawResponse as IDataObject),
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushChannelRecoverableError(this, returnData, i, 'addBot', error, {
					contextFields: {
						...(requestedChannelId && requestedChannelId.length > 0
							? { channel_locator: requestedChannelId }
							: {}),
						...(requestedBotUniqueName && requestedBotUniqueName.length > 0
							? { bot_unique_name: requestedBotUniqueName }
							: {}),
					},
					messageMappings: [
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('status code 400') ||
								normalizedMessage.includes('bad request'),
							reason: 'BOT_ASSOCIATION_BAD_REQUEST',
							hint: 'Confirm bot unique name exists, channel resolves to a valid unique name, and check Get Channel Members to verify whether the bot is already present.',
							messageOverride:
								'Zoho Cliq rejected this add-bot request with a 400 error. Check bot/channel identifiers and whether the bot is already a channel member.',
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
