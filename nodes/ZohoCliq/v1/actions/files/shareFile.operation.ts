import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope } from '../../helpers/utils';
import { zohoCliqApiMultipartRequest } from '../../transport';
import { pushFilesRecoverableError, resolveFilesEnhancedOutput } from './common';
import { description } from './shareFile.description';
import {
	buildBinaryPropertiesAndComments,
	buildMultipartBody,
	getBinaryHandleIds,
	isChannelTarget,
	parseBotSubscriberUserIds,
	parseMappedFileEntries,
	parseRawFileEntries,
	resolveConfiguredShareTarget,
	validateConfiguredBotUniqueName,
	validateFileInputMode,
	validateOptionalBotDisplayName,
	validateOptionalImageUrl,
	validateShareTargetSelection,
	type FileInputMode,
	type IFileEntry,
	type ShareTarget,
	type ShareTargetSelection,
} from './shareFile.helpers';

export { description };

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const requiredScope = getRequiredScopeForOperation('files', 'shareFile');
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		let shareTargetSelection: ShareTargetSelection | undefined;
		let shareTarget: ShareTarget | undefined;
		let agentSelectedShareTarget: ShareTarget | undefined;
		let fileInputMode: FileInputMode | undefined;
		let markAsRead: boolean | undefined;
		let postAsBot: boolean | undefined;
		let targetIdentifier: string | undefined;
		let fileEntries: IFileEntry[] = [];
		let binaryProperties: string[] = [];
		let binaryHandleIds: string[] = [];
		let botSubscriberUserIds: string[] | undefined;
		let postAsBotUniqueName: string | undefined;
		let isChannelShareTarget = false;

		try {
			checkRequiredScope(this, grantedScopes, requiredScope, i);

			shareTargetSelection = validateShareTargetSelection(
				this,
				this.getNodeParameter('shareTarget', i) as string,
				i,
			);
			if (shareTargetSelection === 'agentChoice') {
				const agentSelectedShareTargetInput = (
					this.getNodeParameter('agentSelectedShareTarget', i, '') as string
				).trim();
				agentSelectedShareTarget = agentSelectedShareTargetInput
					? (agentSelectedShareTargetInput as ShareTarget)
					: undefined;
			}
			const resolvedShareTarget = resolveConfiguredShareTarget(this, i, shareTargetSelection);
			shareTarget = resolvedShareTarget.shareTarget;
			isChannelShareTarget = isChannelTarget(shareTarget);
			fileInputMode = validateFileInputMode(
				this,
				this.getNodeParameter('fileInputMode', i, 'mapped'),
				i,
			);
			markAsRead = this.getNodeParameter('markAsRead', i, false) as boolean;
			postAsBot = isChannelShareTarget
				? ((shareTargetSelection === 'agentChoice'
						? this.getNodeParameter('agentPostAsBot', i, false)
						: this.getNodeParameter('postAsBot', i, false)) as boolean)
				: false;

			fileEntries =
				fileInputMode === 'mapped'
					? parseMappedFileEntries(
							this,
							this.getNodeParameter('fileEntries', i, {}) as IDataObject,
							i,
						)
					: parseRawFileEntries(this, this.getNodeParameter('fileEntriesRaw', i, '[]'), i);

			const builtBinaryProperties = buildBinaryPropertiesAndComments(fileEntries);
			binaryProperties = builtBinaryProperties.binaryProperties;
			binaryHandleIds = getBinaryHandleIds(fileEntries);
			const endpoint = resolvedShareTarget.endpoint;
			targetIdentifier = resolvedShareTarget.targetIdentifier;

			const botDisplayName = isChannelShareTarget
				? validateOptionalBotDisplayName(
						this,
						(shareTargetSelection === 'agentChoice'
							? this.getNodeParameter('agentBotDisplayName', i, '')
							: this.getNodeParameter('botDisplayName', i, '')) as string,
						i,
					)
				: undefined;
			const botImageUrl = isChannelShareTarget
				? validateOptionalImageUrl(
						this,
						(shareTargetSelection === 'agentChoice'
							? this.getNodeParameter('agentBotImageUrl', i, '')
							: this.getNodeParameter('botImageUrl', i, '')) as string,
						i,
					)
				: undefined;
			botSubscriberUserIds =
				shareTarget === 'bot'
					? parseBotSubscriberUserIds(this, this.getNodeParameter('botSubscriberUserIds', i, {}), i)
					: undefined;

			if (postAsBot) {
				postAsBotUniqueName = validateConfiguredBotUniqueName(
					this,
					i,
					'Bot Unique Name',
					shareTargetSelection === 'agentChoice' ? 'agentBotUniqueName' : 'botUniqueName',
				);
			}

			const subscriberIdsForRequests =
				shareTarget === 'bot' && botSubscriberUserIds && botSubscriberUserIds.length > 0
					? botSubscriberUserIds
					: [undefined];
			const responses: IDataObject[] = [];

			for (const subscriberId of subscriberIdsForRequests) {
				const multipart = await buildMultipartBody(
					this,
					items[i],
					i,
					fileEntries,
					markAsRead,
					shareTarget,
					botDisplayName,
					botImageUrl,
					postAsBotUniqueName,
					subscriberId,
				);

				const response = await zohoCliqApiMultipartRequest.call(
					this,
					'POST',
					endpoint,
					multipart.body,
					`multipart/form-data; boundary=${multipart.boundary}`,
					postAsBotUniqueName ? { bot_unique_name: postAsBotUniqueName } : undefined,
				);
				responses.push(response);
			}

			const response =
				responses.length === 1
					? responses[0]
					: ({
							request_count: responses.length,
							user_ids: subscriberIdsForRequests.filter(
								(value): value is string => typeof value === 'string',
							),
							results: responses,
						} as IDataObject);
			const { includeEnhancedOutput, rawResponse, responseJson } = resolveFilesEnhancedOutput(
				this,
				i,
				response,
			);

			const executionData = this.helpers.constructExecutionMetaData(
				[
					{
						json: includeEnhancedOutput
							? ({
									...responseJson,
									success: true,
									resource: 'files',
									operation: 'shareFile',
									share_target: shareTarget,
									target_identifier: targetIdentifier,
									file_count: fileEntries.length,
									...(binaryProperties.length > 0 ? { binary_properties: binaryProperties } : {}),
									...(binaryHandleIds.length > 0 ? { binary_handle_ids: binaryHandleIds } : {}),
									...(typeof markAsRead === 'boolean' && shareTarget !== 'bot'
										? { mark_as_read: markAsRead }
										: {}),
									...(postAsBot ? { post_as_bot: true } : {}),
									...(postAsBotUniqueName ? { bot_unique_name: postAsBotUniqueName } : {}),
									...(botSubscriberUserIds?.length
										? { subscriber_user_ids: botSubscriberUserIds }
										: {}),
								} as IDataObject)
							: rawResponse,
					},
				],
				{ itemData: { item: i } },
			);
			returnData.push(...executionData);
		} catch (error) {
			if (
				pushFilesRecoverableError(this, returnData, i, 'shareFile', error, {
					contextFields: {
						...(shareTargetSelection ? { share_target_selection: shareTargetSelection } : {}),
						...(agentSelectedShareTarget
							? { agent_selected_share_target: agentSelectedShareTarget }
							: {}),
						...(shareTarget ? { share_target: shareTarget } : {}),
						...(targetIdentifier ? { target_identifier: targetIdentifier } : {}),
						...(fileInputMode ? { file_input_mode: fileInputMode } : {}),
						...(binaryProperties.length > 0 ? { binary_properties: binaryProperties } : {}),
						...(binaryHandleIds.length > 0 ? { binary_handle_ids: binaryHandleIds } : {}),
						...(typeof markAsRead === 'boolean' ? { mark_as_read: markAsRead } : {}),
						...(typeof postAsBot === 'boolean' ? { post_as_bot: postAsBot } : {}),
						...(postAsBotUniqueName ? { bot_unique_name: postAsBotUniqueName } : {}),
						...(botSubscriberUserIds?.length ? { subscriber_user_ids: botSubscriberUserIds } : {}),
					},
					fallbackMessage: 'Failed to share file(s) in Zoho Cliq.',
				})
			) {
				continue;
			}

			throw error;
		}
	}

	return returnData;
}
