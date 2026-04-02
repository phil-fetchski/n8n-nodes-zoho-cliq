/**
 * Router for Zoho Cliq operations
 * Dispatches to appropriate resource and operation handlers
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { ZohoCliqType } from './node.type';
import type {
	MessageOperations,
	MessageComponentBuilderOperations,
	OAuthHelperOperations,
	ChannelOperations,
	BotOperations,
	ThreadOperations,
	ChatOperations,
	FilesOperations,
	ReactionOperations,
	UserOperations,
	TeamOperations,
	DepartmentOperations,
	RoleOperations,
	DesignationOperations,
	UserFieldsOperations,
	UserStatusOperations,
	EventsOperations,
	RemindersOperations,
	RemoteWorkOperations,
	CallsMeetingOperations,
	WidgetMapTickerOperations,
	CustomEmailOperations,
	DatabaseOperations,
	CustomDomainOperations,
	BulkActionOperations,
	IOperationHandler,
} from './types';
import * as channel from './channel/Channel.resource';
import * as bot from './bot/Bot.resource';
import * as message from './message/Message.resource';
import * as messageComponentBuilder from './messageComponentBuilder/MessageComponentBuilder.resource';
import * as oauthHelper from './oauthHelper/OAuthHelper.resource';
import * as thread from './thread/Thread.resource';
import * as chat from './chat/Chat.resource';
import * as files from './files/Files.resource';
import * as reaction from './reaction/Reaction.resource';
import * as user from './user/User.resource';
import * as team from './team/Team.resource';
import * as department from './department/Department.resource';
import * as role from './role/Role.resource';
import * as designation from './designation/Designation.resource';
import * as userFields from './userFields/UserFields.resource';
import * as userStatus from './userStatus/UserStatus.resource';
import * as events from './events/Events.resource';
import * as reminders from './reminders/Reminders.resource';
import * as remoteWork from './remoteWork/RemoteWork.resource';
import * as callsMeeting from './callsMeeting/CallsMeeting.resource';
import * as widgetMapTicker from './widgetMapTicker/WidgetMapTicker.resource';
import * as customEmail from './customEmail/CustomEmail.resource';
import * as database from './database/Database.resource';
import * as customDomain from './customDomain/CustomDomain.resource';
import * as bulkAction from './bulkAction/BulkAction.resource';
import { parseBooleanLikeTrue, validateCredentials } from '../helpers/utils';
import { isZohoCliqErrorResponse } from '../helpers/interfaces';

export async function router(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
	const items = this.getInputData();
	let returnData: INodeExecutionData[] = [];
	let continueOnFailWasOverridden = false;
	let originalContinueOnFail: (() => boolean) | undefined;

	// Validate credentials and get granted scopes once
	const grantedScopes = await validateCredentials(this);

	const resource = this.getNodeParameter('resource', 0) as ZohoCliqType;
	const operation = this.getNodeParameter('operation', 0) as string;
	const enableAiErrorModeRaw = this.getNodeParameter('enableAiErrorMode', 0, false);
	const enableAiErrorMode = parseBooleanLikeTrue(enableAiErrorModeRaw);

	if (enableAiErrorMode && typeof this.continueOnFail === 'function') {
		originalContinueOnFail = this.continueOnFail.bind(this);
		if (!originalContinueOnFail()) {
			(this as unknown as { continueOnFail: () => boolean }).continueOnFail = () => true;
			continueOnFailWasOverridden = true;
		}
	}

	// Type-safe operation maps
	const messageOperationMap: Record<MessageOperations, IOperationHandler> = message;
	const messageComponentBuilderOperationMap: Record<
		MessageComponentBuilderOperations,
		IOperationHandler
	> = messageComponentBuilder;
	const oauthHelperOperationMap: Record<OAuthHelperOperations, IOperationHandler> = oauthHelper;
	const channelOperationMap: Record<ChannelOperations, IOperationHandler> = channel;
	const botOperationMap: Record<BotOperations, IOperationHandler> = bot;
	const threadOperationMap: Record<ThreadOperations, IOperationHandler> = thread;
	const chatOperationMap: Record<ChatOperations, IOperationHandler> = chat;
	const filesOperationMap: Record<FilesOperations, IOperationHandler> = files;
	const reactionOperationMap: Record<ReactionOperations, IOperationHandler> = reaction;
	const userOperationMap: Record<UserOperations, IOperationHandler> = user;
	const teamOperationMap: Record<TeamOperations, IOperationHandler> = team;
	const departmentOperationMap: Record<DepartmentOperations, IOperationHandler> = department;
	const roleOperationMap: Record<RoleOperations, IOperationHandler> = role;
	const designationOperationMap: Record<DesignationOperations, IOperationHandler> = designation;
	const userFieldsOperationMap: Record<UserFieldsOperations, IOperationHandler> = userFields;
	const userStatusOperationMap: Record<UserStatusOperations, IOperationHandler> = userStatus;
	const eventsOperationMap: Record<EventsOperations, IOperationHandler> = events;
	const remindersOperationMap: Record<RemindersOperations, IOperationHandler> = reminders;
	const remoteWorkOperationMap: Record<RemoteWorkOperations, IOperationHandler> = remoteWork;
	const callsMeetingOperationMap: Record<CallsMeetingOperations, IOperationHandler> = callsMeeting;
	const widgetMapTickerOperationMap: Record<WidgetMapTickerOperations, IOperationHandler> =
		widgetMapTicker;
	const customEmailOperationMap: Record<CustomEmailOperations, IOperationHandler> = customEmail;
	const databaseOperationMap: Record<DatabaseOperations, IOperationHandler> = database;
	const customDomainOperationMap: Record<CustomDomainOperations, IOperationHandler> = customDomain;
	const bulkActionOperationMap: Record<BulkActionOperations, IOperationHandler> = bulkAction;

	try {
		switch (resource) {
			case 'message': {
				const messageOp = operation as MessageOperations;
				const handler = messageOperationMap[messageOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${messageOp}" for resource "message"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'messageComponentBuilder': {
				const messageComponentBuilderOp = operation as MessageComponentBuilderOperations;
				const handler = messageComponentBuilderOperationMap[messageComponentBuilderOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${messageComponentBuilderOp}" for resource "messageComponentBuilder"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'oauthHelper': {
				const oauthHelperOp = operation as OAuthHelperOperations;
				const handler = oauthHelperOperationMap[oauthHelperOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${oauthHelperOp}" for resource "oauthHelper"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'channel': {
				const channelOp = operation as ChannelOperations;
				const handler = channelOperationMap[channelOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${channelOp}" for resource "channel"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'bot': {
				const botOp = operation as BotOperations;
				const handler = botOperationMap[botOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${botOp}" for resource "bot"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'thread': {
				const threadOp = operation as ThreadOperations;
				const handler = threadOperationMap[threadOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${threadOp}" for resource "thread"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'chat': {
				const chatOp = operation as ChatOperations;
				const handler = chatOperationMap[chatOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${chatOp}" for resource "chat"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'file': {
				const filesOp = operation as FilesOperations;
				const handler = filesOperationMap[filesOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${filesOp}" for resource "file"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'reaction': {
				const reactionOp = operation as ReactionOperations;
				const handler = reactionOperationMap[reactionOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${reactionOp}" for resource "reaction"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'user': {
				const userOp = operation as UserOperations;
				const handler = userOperationMap[userOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${userOp}" for resource "user"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'team': {
				const teamOp = operation as TeamOperations;
				const handler = teamOperationMap[teamOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${teamOp}" for resource "team"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'department': {
				const departmentOp = operation as DepartmentOperations;
				const handler = departmentOperationMap[departmentOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${departmentOp}" for resource "department"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'role': {
				const roleOp = operation as RoleOperations;
				const handler = roleOperationMap[roleOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${roleOp}" for resource "role"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'designation': {
				const designationOp = operation as DesignationOperations;
				const handler = designationOperationMap[designationOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${designationOp}" for resource "designation"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'userField': {
				const userFieldsOp = operation as UserFieldsOperations;
				const handler = userFieldsOperationMap[userFieldsOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${userFieldsOp}" for resource "userField"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'userStatus': {
				const userStatusOp = operation as UserStatusOperations;
				const handler = userStatusOperationMap[userStatusOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${userStatusOp}" for resource "userStatus"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'event': {
				const eventsOp = operation as EventsOperations;
				const handler = eventsOperationMap[eventsOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${eventsOp}" for resource "event"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'reminder': {
				const remindersOp = operation as RemindersOperations;
				const handler = remindersOperationMap[remindersOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${remindersOp}" for resource "reminder"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'remoteWork': {
				const remoteWorkOp = operation as RemoteWorkOperations;
				const handler = remoteWorkOperationMap[remoteWorkOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${remoteWorkOp}" for resource "remoteWork"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'callsMeeting': {
				const callsMeetingOp = operation as CallsMeetingOperations;
				const handler = callsMeetingOperationMap[callsMeetingOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${callsMeetingOp}" for resource "callsMeeting"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'widgetMapTicker': {
				const widgetMapTickerOp = operation as WidgetMapTickerOperations;
				const handler = widgetMapTickerOperationMap[widgetMapTickerOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${widgetMapTickerOp}" for resource "widgetMapTicker"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'customEmail': {
				const customEmailOp = operation as CustomEmailOperations;
				const handler = customEmailOperationMap[customEmailOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${customEmailOp}" for resource "customEmail"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'database': {
				const databaseOp = operation as DatabaseOperations;
				const handler = databaseOperationMap[databaseOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${databaseOp}" for resource "database"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'customDomain': {
				const customDomainOp = operation as CustomDomainOperations;
				const handler = customDomainOperationMap[customDomainOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${customDomainOp}" for resource "customDomain"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			case 'bulkAction': {
				const bulkActionOp = operation as BulkActionOperations;
				const handler = bulkActionOperationMap[bulkActionOp];
				if (!handler) {
					throw new NodeOperationError(
						this.getNode(),
						`Unsupported operation "${bulkActionOp}" for resource "bulkAction"`,
					);
				}
				returnData = await handler.execute.call(this, items, grantedScopes);
				break;
			}
			default:
				throw new NodeOperationError(this.getNode(), `Unsupported resource: ${resource}`);
		}
	} catch (error: unknown) {
		const continueOnFailEnabled =
			typeof this.continueOnFail === 'function' && this.continueOnFail();
		if (continueOnFailEnabled || enableAiErrorMode) {
			const scopePayload = (error as IDataObject | undefined)?.zohoCliqScopeErrorPayload as
				| IDataObject
				| undefined;
			if (scopePayload) {
				returnData = items.map((_item, i) => ({
					json: { ...scopePayload },
					pairedItem: { item: i },
				}));
				return [returnData];
			}

			let errorMessage = 'An unexpected issue occurred';
			const sanitizedError: Record<string, unknown> = {};

			if (error instanceof Error) {
				errorMessage = error.message;
				// Sanitize error response - only include safe, non-sensitive fields
				if ('response' in error && error.response) {
					const response = error.response as { data?: unknown; status?: number };

					// Only include status code - no sensitive data
					if (response.status) {
						sanitizedError.statusCode = response.status;
					}

					// Use type guard to safely handle Zoho Cliq error responses
					if (isZohoCliqErrorResponse(response.data)) {
						// Whitelist only safe fields from error response
						if (response.data.message) {
							sanitizedError.message = response.data.message;
						}
						if (response.data.code) {
							sanitizedError.code = response.data.code;
						}
						if (response.data.error_code) {
							sanitizedError.error_code = response.data.error_code;
						}
						if (response.data.status) {
							sanitizedError.status = response.data.status;
						}
					}
				}
			}

			returnData = items.map((_item, i) => ({
				json: {
					error: errorMessage,
					details: sanitizedError,
				},
				pairedItem: { item: i },
			}));
		} else {
			throw error;
		}
	} finally {
		if (continueOnFailWasOverridden && originalContinueOnFail) {
			(this as unknown as { continueOnFail: () => boolean }).continueOnFail =
				originalContinueOnFail;
		}
	}

	return [returnData];
}
