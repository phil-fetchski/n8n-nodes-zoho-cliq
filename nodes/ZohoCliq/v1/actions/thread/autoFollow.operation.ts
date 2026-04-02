/**
 * Auto Follow operation
 * Enables or disables auto-follow for all threads in a channel.
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { THREAD_AUTO_FOLLOW_AGENT_DETAILS_LINK } from '../../helpers/linkConstants';
import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../transport';
import { checkRequiredScope, validateChannelId } from '../../helpers/utils';
import { applyDisplayOptions, channelIdOnlyRLC } from '../common.descriptions';
import {
	CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE,
	CHANNEL_NOT_FOUND_HINT,
	runChannelIdLookupPreflightGate,
} from '../shared/preflight';
import { normalizeThreadResponseMessageIds, pushThreadRecoverableError } from './common';

const requiredScope = getRequiredScopeForOperation('thread', 'autoFollow');

function isChannelLookupNotFoundError(error: unknown): boolean {
	return (
		error instanceof NodeOperationError &&
		(error as NodeOperationError & { code?: string }).code === CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE
	);
}

const properties: INodeProperties[] = [
	{
		...channelIdOnlyRLC,
		description: 'The channel where auto-follow settings should be updated',
	},
	{
		displayName: 'Auto Follow Threads',
		name: 'autoFollowThreads',
		type: 'options',
		options: [
			{
				name: 'Enable',
				value: 'enable',
			},
			{
				name: 'Disable',
				value: 'disable',
			},
		],
		default: 'enable',
		required: true,
	},
	{
		displayName: `Auto Follow Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#auto-follow" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES: <code>${requiredScope}</code>`,
		name: 'autoFollowThreadsDocsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: `Zoho Cliq Thread/Auto Follow as AI Tool Setup Guide: <a href="${THREAD_AUTO_FOLLOW_AGENT_DETAILS_LINK}" target="_blank" rel="noopener noreferrer">Open Tool Setup Guide</a>`,
		name: 'autoFollowThreadsAiToolGuideNotice',
		type: 'notice',
		default: '',
	},
];

const displayOptions = {
	show: {
		resource: ['thread'],
		operation: ['autoFollow'],
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
		let requestedChannelId = '';
		let requestedAutoFollowThreads: string | boolean | undefined;
		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			const channelId = this.getNodeParameter('channelId', i, '', {
				extractValue: true,
			}) as string;
			const autoFollowThreadsRaw = this.getNodeParameter('autoFollowThreads', i) as unknown;
			requestedChannelId = channelId.trim();
			if (typeof autoFollowThreadsRaw === 'string' || typeof autoFollowThreadsRaw === 'boolean') {
				requestedAutoFollowThreads =
					typeof autoFollowThreadsRaw === 'string'
						? autoFollowThreadsRaw.trim()
						: autoFollowThreadsRaw;
			}

			const sanitizedChannelId = validateChannelId(this, requestedChannelId, i);
			const autoFollowThreads = normalizeAutoFollowThreads(this, autoFollowThreadsRaw, i);
			await runChannelIdLookupPreflightGate(this, i, grantedScopes, sanitizedChannelId);
			const body: IDataObject = {
				auto_follow_threads: autoFollowThreads,
			};

			const endpoint = `/api/v2/channels/${encodeURIComponent(sanitizedChannelId)}`;
			const response = await zohoCliqApiRequest.call(this, 'PUT', endpoint, body);

			const executionData = this.helpers.constructExecutionMetaData(
				[{ json: normalizeThreadResponseMessageIds(response) }],
				{
					itemData: { item: i },
				},
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushThreadRecoverableError(this, returnData, i, 'autoFollow', error, {
					contextFields: {
						...(requestedChannelId ? { channel_id: requestedChannelId } : {}),
						...(requestedAutoFollowThreads !== undefined
							? { auto_follow_threads: requestedAutoFollowThreads }
							: {}),
					},
					fallbackMessage: 'Unable to update thread auto-follow settings in Zoho Cliq.',
					messageMappings: [
						{
							match: (_normalizedMessage, _message, mappedError) =>
								isChannelLookupNotFoundError(mappedError),
							reason: 'CHANNEL_NOT_FOUND',
							hint: CHANNEL_NOT_FOUND_HINT,
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('channel id is required') ||
								normalizedMessage.includes('invalid channel id format') ||
								normalizedMessage.includes('channel id is too long'),
							reason: 'INVALID_CHANNEL_ID',
							hint: 'Use the exact Zoho Cliq channel ID before changing the auto-follow setting.',
						},
						{
							match: (normalizedMessage) =>
								normalizedMessage.includes('auto follow threads must be one of'),
							reason: 'INVALID_AUTO_FOLLOW_VALUE',
							hint: 'Use `enable` or `disable`. The runtime also normalizes boolean `true` to `enable` and `false` to `disable`.',
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

function normalizeAutoFollowThreads(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): 'enable' | 'disable' {
	if (typeof value === 'boolean') {
		return value ? 'enable' : 'disable';
	}

	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		if (normalized === 'enable' || normalized === 'true') {
			return 'enable';
		}
		if (normalized === 'disable' || normalized === 'false') {
			return 'disable';
		}
	}

	throw new NodeOperationError(
		context.getNode(),
		'Auto Follow Threads must be one of: enable, disable, true, false',
		{ itemIndex },
	);
}
