import {
	getRequiredScopeForOperation,
	getRequiredScopesForOperationOrThrow,
	getWildcardAlternative,
} from '../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

const joinScopes = (resource: string, operation: string): string =>
	getRequiredScopesForOperationOrThrow(resource, operation).join(',');

const getWildcardScopeFor = (resource: string, operation: string): string => {
	const requiredScope = getRequiredScopeForOperation(resource, operation);
	const wildcardScope = getWildcardAlternative(requiredScope);

	if (!wildcardScope) {
		throw new Error(`No wildcard scope alternative found for ${resource}.${operation}`);
	}

	return wildcardScope;
};

export const SCOPES = {
	REMINDERS_CREATE: getRequiredScopeForOperation('reminders', 'create'),
	REMINDERS_READ: getRequiredScopeForOperation('reminders', 'get'),
	REMINDERS_UPDATE: getRequiredScopeForOperation('reminders', 'update'),
	REMINDERS_DELETE: getRequiredScopeForOperation('reminders', 'delete'),
	CHATS_READ: getRequiredScopeForOperation('chat', 'list'),
	CHATS_CREATE: getRequiredScopeForOperation('chat', 'pinStickyMessage'),
	CHATS_CREATE_WITH_READ: [
		getRequiredScopeForOperation('chat', 'pinStickyMessage'),
		getRequiredScopeForOperation('chat', 'list'),
	].join(','),
	CHATS_UPDATE: getRequiredScopeForOperation('chat', 'mute'),
	CHATS_UPDATE_WITH_READ: [
		getRequiredScopeForOperation('chat', 'mute'),
		getRequiredScopeForOperation('chat', 'list'),
	].join(','),
	CHATS_STICKY_DELETE: getRequiredScopeForOperation('chat', 'unpinStickyMessage'),
	CHATS_STICKY_DELETE_WITH_READ: [
		getRequiredScopeForOperation('chat', 'unpinStickyMessage'),
		getRequiredScopeForOperation('chat', 'list'),
	].join(','),
	CHATS_DELETE: getRequiredScopeForOperation('thread', 'removeFollowers'),
	THREAD_MESSAGES_CREATE: getRequiredScopeForOperation('thread', 'post'),
	WEBHOOKS_CREATE: getRequiredScopeForOperation('message', 'post'),
	MESSAGES_READ: getRequiredScopeForOperation('message', 'get'),
	MESSAGES_READ_WITH_CHAT_LOOKUP: [
		getRequiredScopeForOperation('message', 'get'),
		getRequiredScopeForOperation('chat', 'list'),
	].join(','),
	MESSAGES_UPDATE: getRequiredScopeForOperation('message', 'edit'),
	MESSAGES_DELETE: getRequiredScopeForOperation('message', 'delete'),
	USERS_CREATE: getRequiredScopeForOperation('user', 'create'),
	USERS_READ: getRequiredScopeForOperation('user', 'get'),
	USERS_UPDATE: getRequiredScopeForOperation('user', 'update'),
	TEAMS_CREATE: getRequiredScopeForOperation('team', 'create'),
	TEAMS_READ: getRequiredScopeForOperation('team', 'get'),
	TEAMS_UPDATE: getRequiredScopeForOperation('team', 'update'),
	TEAMS_DELETE: getRequiredScopeForOperation('team', 'delete'),
	DEPARTMENTS_CREATE: getRequiredScopeForOperation('department', 'create'),
	DEPARTMENTS_READ: getRequiredScopeForOperation('department', 'get'),
	DEPARTMENTS_UPDATE: getRequiredScopeForOperation('department', 'update'),
	DEPARTMENTS_DELETE: getRequiredScopeForOperation('department', 'delete'),
	DEPARTMENT_LIST: getRequiredScopeForOperation('department', 'list'),
	DEPARTMENT_REMOVE_MEMBERS: getRequiredScopeForOperation('department', 'removeMembers'),
	DESIGNATIONS_CREATE: getRequiredScopeForOperation('designation', 'create'),
	DESIGNATIONS_READ: getRequiredScopeForOperation('designation', 'get'),
	DESIGNATIONS_UPDATE: getRequiredScopeForOperation('designation', 'update'),
	DESIGNATIONS_DELETE: getRequiredScopeForOperation('designation', 'delete'),
	USER_FIELDS_CREATE: getRequiredScopeForOperation('userFields', 'create'),
	USER_FIELDS_UPDATE: getRequiredScopeForOperation('userFields', 'update'),
	USER_FIELDS_DELETE: getRequiredScopeForOperation('userFields', 'delete'),
	REACTION_CREATE: getRequiredScopeForOperation('reaction', 'add'),
	REACTION_READ: getRequiredScopeForOperation('reaction', 'get'),
	REACTION_DELETE: getRequiredScopeForOperation('reaction', 'remove'),
	REMOTE_WORK_READ: getRequiredScopeForOperation('remoteWork', 'getStatus'),
	REMOTE_WORK_UPDATE: getRequiredScopeForOperation('remoteWork', 'checkIn'),
	DATABASE_CREATE: getRequiredScopeForOperation('database', 'create'),
	DATABASE_READ: getRequiredScopeForOperation('database', 'get'),
	DATABASE_UPDATE: getRequiredScopeForOperation('database', 'update'),
	DATABASE_DELETE: getRequiredScopeForOperation('database', 'delete'),
	CHANNELS_CREATE: getRequiredScopeForOperation('channel', 'create'),
	CHANNELS_READ: getRequiredScopeForOperation('channel', 'get'),
	CHANNELS_UPDATE: getRequiredScopeForOperation('channel', 'update'),
	CHANNELS_DELETE: getRequiredScopeForOperation('channel', 'delete'),
	BOTS_READ: getRequiredScopeForOperation('bot', 'getSubscribers'),
	ATTACHMENTS_READ: getRequiredScopeForOperation('files', 'getFile'),
	MEDIA_SESSION_READ: getRequiredScopeForOperation('callsMeeting', 'getRecordingDetails'),
	APPLICATIONS_UPDATE: getRequiredScopeForOperation('widgetMapTicker', 'addOrUpdateTicker'),
	APPLICATIONS_DELETE: getRequiredScopeForOperation('widgetMapTicker', 'deleteTicker'),
	PROFILE_CREATE: getRequiredScopeForOperation('userStatus', 'create'),
	PROFILE_READ: getRequiredScopeForOperation('userStatus', 'getCurrent'),
	PROFILE_UPDATE: getRequiredScopeForOperation('userStatus', 'setCurrent'),
	PROFILE_DELETE: getRequiredScopeForOperation('userStatus', 'delete'),
	ORGANISATION_CREATE: getRequiredScopeForOperation('role', 'create'),
	ORGANISATION_READ: getRequiredScopeForOperation('role', 'get'),
	ORGANISATION_UPDATE: getRequiredScopeForOperation('role', 'update'),
	ORGANISATION_DELETE: getRequiredScopeForOperation('customDomain', 'delete'),
	CUSTOM_DOMAIN_READ: getRequiredScopeForOperation('customDomain', 'get'),
	ORGANIZATION_CHANNELS_READ: getRequiredScopeForOperation('bulkAction', 'exportChannels'),
	ORGANIZATION_CONVERSATION_MEMBERS_READ: getRequiredScopeForOperation(
		'bulkAction',
		'exportConversationMembers',
	),
	ORGANIZATION_CONVERSATION_MEMBERS_READ_WITH_CHAT_LOOKUP: [
		getRequiredScopeForOperation('bulkAction', 'exportConversationMembers'),
		getRequiredScopeForOperation('chat', 'list'),
	].join(','),
	ORGANIZATION_CHATS_READ: getRequiredScopeForOperation('bulkAction', 'exportConversations'),
	ORGANIZATION_MESSAGES_READ: getRequiredScopeForOperation('bulkAction', 'exportMessages'),
	ORGANIZATION_MESSAGES_READ_WITH_CHAT_LOOKUP: [
		getRequiredScopeForOperation('bulkAction', 'exportMessages'),
		getRequiredScopeForOperation('chat', 'list'),
	].join(','),
	EVENTS_CORE: joinScopes('events', 'get'),
	EVENTS_UPDATE: joinScopes('events', 'update'),
	EVENTS_UPDATE_STATUS: joinScopes('events', 'updateStatus'),
	EVENTS_UPLOAD_ATTACHMENT: joinScopes('events', 'uploadAttachment'),
	EVENTS_GET_CALENDARS: joinScopes('events', 'getCalendars'),
	EVENTS_LIST: joinScopes('events', 'list'),
	SCHEDULE_MESSAGES_CREATE: getRequiredScopeForOperation('shared', 'scheduleMessage'),
	SCHEDULE_MESSAGES_CREATE_WITH_CHAT_LOOKUP: [
		getRequiredScopeForOperation('shared', 'scheduleMessage'),
		getRequiredScopeForOperation('chat', 'list'),
	].join(','),
	MESSAGES_ALL: getWildcardScopeFor('message', 'get'),
	SCHEDULE_MESSAGES_CREATE_WRONG_CASE: getRequiredScopeForOperation(
		'shared',
		'scheduleMessage',
	).replace('.messages.', '.Messages.'),
	SCHEDULE_MESSAGES_ALL_DISALLOWED: getRequiredScopeForOperation(
		'shared',
		'scheduleMessage',
	).replace('.CREATE', '.ALL'),
} as const;
