/**
 * TypeScript interfaces for Zoho Cliq operations
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

// Operation type unions
export type MessageOperations = 'delete' | 'edit' | 'get' | 'post' | 'retrieve' | 'scheduleMessage';
export type MessageComponentBuilderOperations =
	| 'buildAgentCardPayload'
	| 'buildCardPayload'
	| 'buildFireAckMessage'
	| 'buildTableComponent'
	| 'buildListComponent'
	| 'buildImageComponent'
	| 'buildLabelComponent'
	| 'buildGraphComponent'
	| 'buildChartComponent'
	| 'buildComponents'
	| 'buildButtons';
export type OAuthHelperOperations = 'getGrantedScopes' | 'listScopePacks' | 'checkScopePack';

export type ChannelOperations =
	| 'list'
	| 'get'
	| 'create'
	| 'update'
	| 'changePermission'
	| 'delete'
	| 'archive'
	| 'unarchive'
	| 'approve'
	| 'reject'
	| 'getMembers'
	| 'addMembers'
	| 'addBot'
	| 'removeBot'
	| 'removeMembers'
	| 'removeMember'
	| 'changeRole'
	| 'join'
	| 'leave';
export type BotOperations = 'getSubscribers' | 'triggerCalls';

export type ThreadOperations =
	| 'create'
	| 'post'
	| 'list'
	| 'autoFollow'
	| 'getFollowers'
	| 'getNonFollowers'
	| 'addFollowers'
	| 'removeFollowers'
	| 'follow'
	| 'unfollow'
	| 'updateState'
	| 'getMainMessage'
	| 'scheduleMessage';

export type ChatOperations =
	| 'list'
	| 'getMembers'
	| 'mute'
	| 'unmute'
	| 'pinStickyMessage'
	| 'unpinStickyMessage'
	| 'getPinnedStickyMessage'
	| 'leave';

export type FilesOperations = 'getFile' | 'shareFile';

export type ReactionOperations = 'get' | 'add' | 'remove';
export type UserOperations = 'list' | 'get' | 'create' | 'getTeams' | 'update' | 'listLayouts';
export type TeamOperations =
	| 'list'
	| 'create'
	| 'get'
	| 'update'
	| 'delete'
	| 'getMembers'
	| 'addMembers'
	| 'removeMembers';
export type DepartmentOperations =
	| 'list'
	| 'create'
	| 'get'
	| 'update'
	| 'delete'
	| 'getMembers'
	| 'addMembers'
	| 'removeMembers';
export type RoleOperations =
	| 'list'
	| 'create'
	| 'get'
	| 'update'
	| 'delete'
	| 'getPermissions'
	| 'buildPermissionsJsonPayload'
	| 'addPermissions'
	| 'removePermissions'
	| 'updatePermissions'
	| 'getUsers'
	| 'addUsers'
	| 'removeUsers';
export type DesignationOperations =
	| 'list'
	| 'create'
	| 'get'
	| 'update'
	| 'delete'
	| 'getMembers'
	| 'addMembers'
	| 'removeMembers';
export type UserFieldsOperations = 'list' | 'create' | 'get' | 'update' | 'delete';
export type UserStatusOperations =
	| 'list'
	| 'create'
	| 'setCurrent'
	| 'delete'
	| 'getCurrent'
	| 'getUserStatus'
	| 'createTransient'
	| 'clearMyStatus';
export type EventsOperations =
	| 'getCalendars'
	| 'list'
	| 'get'
	| 'create'
	| 'update'
	| 'updateStatus'
	| 'delete'
	| 'uploadAttachment';
export type RemindersOperations =
	| 'list'
	| 'create'
	| 'get'
	| 'update'
	| 'delete'
	| 'deleteBatch'
	| 'clearCompleted'
	| 'markComplete'
	| 'markIncomplete'
	| 'snooze'
	| 'dismissSnooze'
	| 'assign'
	| 'removeAssignees'
	| 'remindAssignee'
	| 'remindAssignees';
export type RemoteWorkOperations = 'getStatus' | 'checkIn' | 'checkOut';
export type CallsMeetingOperations = 'listCallRecordings' | 'getRecordingDetails';
export type WidgetMapTickerOperations = 'addOrUpdateTicker' | 'deleteTicker';
export type CustomEmailOperations =
	| 'updateOrganizationEmailConfiguration'
	| 'getOrganizationEmailConfiguration'
	| 'updateMailConfiguration'
	| 'addCustomEmail'
	| 'verifyCustomEmail';
export type DatabaseOperations = 'list' | 'create' | 'get' | 'update' | 'delete';
export type CustomDomainOperations = 'get' | 'add' | 'verify' | 'delete';
export type BulkActionOperations =
	| 'exportConversations'
	| 'exportChannels'
	| 'exportConversationMembers'
	| 'exportMessages';

// Operation handler interface
export interface IOperationHandler {
	execute: (
		this: IExecuteFunctions,
		items: INodeExecutionData[],
		grantedScopes: string,
	) => Promise<INodeExecutionData[]>;
}

/**
 * Button structure for message cards
 */
export interface IMessageButton extends IDataObject {
	label: string;
	hint?: string;
	type?: '+' | '-';
	action: {
		type: 'open.url' | 'invoke.function' | 'system.api' | 'open.dialog';
		data: IDataObject;
	};
}

/**
 * Slide structure for message cards
 */
export interface IMessageSlide extends IDataObject {
	type?: string;
	title?: string;
	data?: IDataObject[];
	buttons?: IMessageButton[];
}

/**
 * Card structure for messages
 */
export interface IMessageCard extends IDataObject {
	title?: string;
	thumbnail?: string;
	theme?: string;
	icon?: string;
	slides?: IMessageSlide[];
	buttons?: IMessageButton[];
}

// Message operation types
export interface IMessageBody extends IDataObject {
	text?: string;
	card?: IMessageCard;
	slides?: IMessageSlide[];
	buttons?: IMessageButton[];
	bot_name?: string;
	thread_id?: string;
	broadcast?: boolean;
	temporary?: boolean;
}

export interface IMessageResponse extends IDataObject {
	message_id?: string;
	message?: string;
	thread_id?: string;
	timestamp?: number;
	from?: IDataObject;
	to?: IDataObject;
}

/**
 * Channel member interface
 */
export interface IChannelMember extends IDataObject {
	user_id: string;
	email?: string;
	name?: string;
	first_name?: string;
	last_name?: string;
	role?: 'super_admin' | 'admin' | 'moderator' | 'member';
	status?: string;
	added_time?: number;
}

/**
 * Channel creator information
 */
export interface IChannelCreator extends IDataObject {
	user_id?: string;
	email?: string;
	name?: string;
}

/**
 * Channel permissions interface
 */
export interface IChannelPermissions extends IDataObject {
	post_message?: boolean;
	invite_members?: boolean;
	remove_members?: boolean;
	edit_channel?: boolean;
	delete_channel?: boolean;
}

// Channel operation types
export interface IChannel extends IDataObject {
	channel_id: string;
	name: string;
	unique_name?: string;
	description?: string;
	level?: 'organization' | 'team' | 'private' | 'external';
	status?: 'created' | 'archived' | 'pending';
	is_archived?: boolean;
	invite_only?: boolean;
	created_time?: number;
	modified_time?: number;
	created_by?: IChannelCreator;
	members_count?: number;
	members?: IChannelMember[];
	permissions?: IChannelPermissions;
	team_id?: string;
	chat_id?: string;
	is_pinned?: boolean;
	is_joined?: boolean;
}

/**
 * Pagination metadata for list responses
 */
export interface IPaginationMeta extends IDataObject {
	has_more: boolean;
	next_token: string | null;
	sync_token: string | null;
}

export interface IChannelListResponse extends IDataObject {
	channels?: IChannel[];
	has_more?: boolean;
	next_token?: string;
	sync_token?: string;
}

export interface IChannelBody extends IDataObject {
	name: string;
	description?: string;
	image_data?: string;
	level?: 'organization' | 'team' | 'private' | 'external';
	invite_only?: boolean;
	members?: string[];
	email_ids?: string[];
	config?: IDataObject;
	permissions?: IChannelPermissions;
}

export interface IChannelMembersBody extends IDataObject {
	user_ids?: string[];
	email_ids?: string[];
}

// Additional fields type
export interface IAdditionalFields extends IDataObject {
	thread_id?: string;
}
