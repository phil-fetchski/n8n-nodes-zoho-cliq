import {
	buildScopeMissingPayload,
	getConditionalScopeRequirement,
	getOperationScopePolicy,
	getRequiredScopeForOperation,
	getRequiredScopesForOperation,
	getRequiredScopesForOperationOrThrow,
	getWildcardAlternative,
	listAcceptedScopesForConditionalRequirement,
	listAcceptedScopesForOperation,
	listOperationsForScopeResource,
	listScopeRegistryResources,
	OPERATION_SCOPE_REGISTRY,
} from '../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

const EXPECTED_OPERATION_SCOPE_REGISTRY = {
	bot: {
		getSubscribers: ['ZohoCliq.Bots.READ'],
		triggerCalls: ['ZohoCliq.Webhooks.CREATE'],
	},
	bulkAction: {
		exportChannels: ['ZohoCliq.OrganizationChannels.READ'],
		exportConversationMembers: ['ZohoCliq.OrganizationChats.READ'],
		exportConversations: ['ZohoCliq.OrganizationChats.READ'],
		exportMessages: ['ZohoCliq.OrganizationMessages.READ'],
	},
	callsMeeting: {
		getRecordingDetails: ['ZohoCliq.MediaSession.READ'],
		listCallRecordings: ['ZohoCliq.MediaSession.READ'],
	},
	channel: {
		addBot: ['ZohoCliq.Channels.UPDATE'],
		addMembers: ['ZohoCliq.Channels.UPDATE'],
		approve: ['ZohoCliq.Channels.UPDATE'],
		archive: ['ZohoCliq.Channels.UPDATE'],
		changePermission: ['ZohoCliq.Channels.UPDATE'],
		changeRole: ['ZohoCliq.Channels.UPDATE'],
		create: ['ZohoCliq.Channels.CREATE'],
		delete: ['ZohoCliq.Channels.DELETE'],
		get: ['ZohoCliq.Channels.READ'],
		getMembers: ['ZohoCliq.Channels.READ'],
		join: ['ZohoCliq.Channels.UPDATE'],
		leave: ['ZohoCliq.Channels.UPDATE'],
		list: ['ZohoCliq.Channels.READ'],
		reject: ['ZohoCliq.Channels.UPDATE'],
		removeBot: ['ZohoCliq.Channels.UPDATE'],
		removeMember: ['ZohoCliq.Channels.UPDATE'],
		removeMembers: ['ZohoCliq.Channels.UPDATE'],
		unarchive: ['ZohoCliq.Channels.UPDATE'],
		update: ['ZohoCliq.Channels.UPDATE'],
	},
	chat: {
		getMembers: ['ZohoCliq.Chats.READ'],
		getPinnedStickyMessage: ['ZohoCliq.Chats.READ'],
		leave: ['ZohoCliq.Chats.UPDATE'],
		list: ['ZohoCliq.Chats.READ'],
		mute: ['ZohoCliq.Chats.UPDATE'],
		pinStickyMessage: ['ZohoCliq.Chats.CREATE'],
		unmute: ['ZohoCliq.Chats.UPDATE'],
		unpinStickyMessage: ['ZohoCliq.Chats.DELETE'],
	},
	customDomain: {
		add: ['ZohoCliq.Organisation.CREATE'],
		delete: ['ZohoCliq.Organisation.UPDATE'],
		get: ['ZohoCliq.Organisation.READ'],
		verify: ['ZohoCliq.Organisation.UPDATE'],
	},
	customEmail: {
		addCustomEmail: ['ZohoCliq.Organisation.UPDATE'],
		getOrganizationEmailConfiguration: ['ZohoCliq.Organisation.READ'],
		updateMailConfiguration: ['ZohoCliq.Organisation.UPDATE'],
		updateOrganizationEmailConfiguration: ['ZohoCliq.Organisation.UPDATE'],
		verifyCustomEmail: ['ZohoCliq.Organisation.READ'],
	},
	database: {
		create: ['ZohoCliq.StorageData.CREATE'],
		delete: ['ZohoCliq.StorageData.DELETE'],
		get: ['ZohoCliq.StorageData.READ'],
		list: ['ZohoCliq.StorageData.READ'],
		update: ['ZohoCliq.StorageData.UPDATE'],
	},
	department: {
		addMembers: ['ZohoCliq.Departments.UPDATE'],
		create: ['ZohoCliq.Departments.CREATE'],
		delete: ['ZohoCliq.Departments.DELETE'],
		get: ['ZohoCliq.Departments.READ'],
		getMembers: ['ZohoCliq.Departments.READ'],
		list: ['ZohoCliq.Departments.READ'],
		removeMembers: ['ZohoCliq.Departments.UPDATE'],
		update: ['ZohoCliq.Departments.UPDATE'],
	},
	designation: {
		addMembers: ['ZohoCliq.Designations.UPDATE'],
		create: ['ZohoCliq.Designations.CREATE'],
		delete: ['ZohoCliq.Designations.DELETE'],
		get: ['ZohoCliq.Designations.READ'],
		getMembers: ['ZohoCliq.Designations.READ'],
		list: ['ZohoCliq.Designations.READ'],
		removeMembers: ['ZohoCliq.Designations.DELETE'],
		update: ['ZohoCliq.Designations.UPDATE'],
	},
	events: {
		create: ['ZohoCliq.CalendarEvents.ALL', 'ZohoCalendar.calendar.ALL', 'ZohoCalendar.event.ALL'],
		delete: ['ZohoCliq.CalendarEvents.ALL', 'ZohoCalendar.calendar.ALL', 'ZohoCalendar.event.ALL'],
		get: ['ZohoCliq.CalendarEvents.ALL', 'ZohoCalendar.calendar.ALL', 'ZohoCalendar.event.ALL'],
		getCalendars: ['ZohoCliq.CalendarEvents.ALL'],
		list: [
			'ZohoCliq.CalendarEvents.ALL',
			'ZohoCalendar.calendar.ALL',
			'ZohoCalendar.event.ALL',
			'ZohoCalendar.search.READ',
		],
		update: ['ZohoCliq.CalendarEvents.ALL', 'ZohoCalendar.calendar.ALL', 'ZohoCalendar.event.ALL'],
		updateStatus: [
			'ZohoCliq.CalendarEvents.ALL',
			'ZohoCalendar.calendar.ALL',
			'ZohoCalendar.event.ALL',
		],
		uploadAttachment: [
			'ZohoCliq.CalendarEvents.ALL',
			'ZohoCalendar.calendar.ALL',
			'ZohoCalendar.event.ALL',
		],
	},
	files: {
		getFile: ['ZohoCliq.Attachments.READ'],
		shareFile: ['ZohoCliq.Webhooks.CREATE'],
	},
	message: {
		delete: ['ZohoCliq.Messages.DELETE'],
		edit: ['ZohoCliq.Messages.UPDATE'],
		get: ['ZohoCliq.Messages.READ'],
		post: ['ZohoCliq.Webhooks.CREATE'],
		retrieve: ['ZohoCliq.Messages.READ'],
		scheduleMessage: ['ZohoCliq.messages.CREATE'],
	},
	messageComponentBuilder: {
		buildButtons: [],
		buildCardPayload: [],
		buildChartComponent: [],
		buildComponents: [],
		buildGraphComponent: [],
		buildImageComponent: [],
		buildLabelComponent: [],
		buildListComponent: [],
		buildTableComponent: [],
	},
	oauthHelper: {
		getGrantedScopes: [],
		listScopePacks: [],
		checkScopePack: [],
	},
	reaction: {
		add: ['ZohoCliq.messageactions.CREATE'],
		get: ['ZohoCliq.messageactions.READ'],
		remove: ['ZohoCliq.messageactions.DELETE'],
	},
	reminders: {
		assign: ['ZohoCliq.Reminders.UPDATE'],
		clearCompleted: ['ZohoCliq.Reminders.DELETE'],
		create: ['ZohoCliq.Reminders.CREATE'],
		delete: ['ZohoCliq.Reminders.DELETE'],
		deleteBatch: ['ZohoCliq.Reminders.DELETE'],
		dismissSnooze: ['ZohoCliq.Reminders.UPDATE'],
		get: ['ZohoCliq.Reminders.READ'],
		list: ['ZohoCliq.Reminders.READ'],
		markComplete: ['ZohoCliq.Reminders.UPDATE'],
		markIncomplete: ['ZohoCliq.Reminders.UPDATE'],
		remindAssignee: ['ZohoCliq.Reminders.UPDATE'],
		remindAssignees: ['ZohoCliq.Reminders.UPDATE'],
		removeAssignees: ['ZohoCliq.Reminders.UPDATE'],
		snooze: ['ZohoCliq.Reminders.UPDATE'],
		update: ['ZohoCliq.Reminders.UPDATE'],
	},
	remoteWork: {
		getStatus: ['ZohoCliq.Profile.READ'],
		checkIn: ['ZohoCliq.Profile.UPDATE'],
		checkOut: ['ZohoCliq.Profile.UPDATE'],
	},
	role: {
		addPermissions: ['ZohoCliq.Organisation.UPDATE'],
		addUsers: ['ZohoCliq.Organisation.UPDATE'],
		buildPermissionsJsonPayload: [],
		create: ['ZohoCliq.Organisation.CREATE'],
		delete: ['ZohoCliq.Organisation.UPDATE', 'ZohoCliq.Organisation.DELETE'],
		get: ['ZohoCliq.Organisation.READ'],
		getPermissions: ['ZohoCliq.Organisation.READ'],
		getUsers: ['ZohoCliq.Organisation.READ'],
		list: ['ZohoCliq.Organisation.READ'],
		removePermissions: ['ZohoCliq.Organisation.UPDATE'],
		removeUsers: ['ZohoCliq.Organisation.UPDATE', 'ZohoCliq.Organisation.DELETE'],
		update: ['ZohoCliq.Organisation.UPDATE'],
		updatePermissions: ['ZohoCliq.Organisation.UPDATE'],
	},
	shared: {
		scheduleMessage: ['ZohoCliq.messages.CREATE'],
	},
	team: {
		addMembers: ['ZohoCliq.Teams.CREATE'],
		create: ['ZohoCliq.Teams.CREATE'],
		delete: ['ZohoCliq.Teams.DELETE'],
		get: ['ZohoCliq.Teams.READ'],
		getMembers: ['ZohoCliq.Teams.READ'],
		list: ['ZohoCliq.Teams.READ'],
		removeMembers: ['ZohoCliq.Teams.UPDATE'],
		update: ['ZohoCliq.Teams.UPDATE'],
	},
	thread: {
		addFollowers: ['ZohoCliq.Chats.UPDATE'],
		autoFollow: ['ZohoCliq.Channels.UPDATE'],
		create: ['ZohoCliq.Webhooks.CREATE'],
		follow: ['ZohoCliq.Chats.UPDATE'],
		getFollowers: ['ZohoCliq.Chats.READ'],
		getMainMessage: ['ZohoCliq.Messages.READ'],
		getNonFollowers: ['ZohoCliq.Chats.READ'],
		list: ['ZohoCliq.Chats.READ'],
		post: ['ZohoCliq.Webhooks.CREATE'],
		removeFollowers: ['ZohoCliq.Chats.DELETE'],
		scheduleMessage: ['ZohoCliq.messages.CREATE'],
		unfollow: ['ZohoCliq.Chats.UPDATE'],
		updateState: ['ZohoCliq.Chats.UPDATE'],
	},
	user: {
		create: ['ZohoCliq.Users.CREATE'],
		get: ['ZohoCliq.Users.READ'],
		getTeams: ['ZohoCliq.Users.READ'],
		list: ['ZohoCliq.Users.READ'],
		listLayouts: ['ZohoCliq.Users.READ'],
		update: ['ZohoCliq.Users.UPDATE'],
	},
	userFields: {
		create: ['ZohoCliq.UserFields.CREATE'],
		delete: ['ZohoCliq.UserFields.DELETE'],
		get: ['ZohoCliq.Users.READ'],
		list: ['ZohoCliq.Users.READ'],
		update: ['ZohoCliq.UserFields.UPDATE'],
	},
	userStatus: {
		clearMyStatus: ['ZohoCliq.Profile.DELETE'],
		create: ['ZohoCliq.Profile.CREATE'],
		createTransient: ['ZohoCliq.Profile.UPDATE'],
		delete: ['ZohoCliq.Profile.DELETE'],
		getCurrent: ['ZohoCliq.Profile.READ'],
		getUserStatus: ['ZohoCliq.Users.READ'],
		list: ['ZohoCliq.Profile.READ'],
		setCurrent: ['ZohoCliq.Profile.UPDATE'],
	},
	widgetMapTicker: {
		addOrUpdateTicker: ['ZohoCliq.Applications.UPDATE'],
		deleteTicker: ['ZohoCliq.Applications.UPDATE'],
	},
} as const;

describe('scopeRegistry', () => {
	it('should match full expected operation registry coverage exactly', () => {
		expect(OPERATION_SCOPE_REGISTRY).toEqual(EXPECTED_OPERATION_SCOPE_REGISTRY);
	});

	it('should list all configured resources', () => {
		expect(new Set(listScopeRegistryResources())).toEqual(
			new Set(Object.keys(OPERATION_SCOPE_REGISTRY)),
		);
	});

	it('should include all expected resources', () => {
		expect(new Set(listScopeRegistryResources())).toEqual(
			new Set([
				'bot',
				'bulkAction',
				'callsMeeting',
				'channel',
				'chat',
				'customDomain',
				'customEmail',
				'database',
				'department',
				'designation',
				'events',
				'files',
				'message',
				'messageComponentBuilder',
				'oauthHelper',
				'reaction',
				'reminders',
				'remoteWork',
				'role',
				'shared',
				'team',
				'thread',
				'user',
				'userFields',
				'userStatus',
				'widgetMapTicker',
			]),
		);
	});

	it('should list operations for known resource', () => {
		expect(listOperationsForScopeResource('remoteWork')).toEqual([
			'getStatus',
			'checkIn',
			'checkOut',
		]);
		expect(listOperationsForScopeResource('customDomain')).toEqual([
			'add',
			'delete',
			'get',
			'verify',
		]);
	});

	it('should return required scope for known single-scope operation', () => {
		expect(getRequiredScopesForOperation('role', 'list')).toEqual(['ZohoCliq.Organisation.READ']);
		expect(getRequiredScopeForOperation('role', 'list')).toBe('ZohoCliq.Organisation.READ');
	});

	it('should return required scopes for events operations that need Cliq + ZohoCalendar grants', () => {
		expect(getRequiredScopesForOperation('events', 'getCalendars')).toEqual([
			'ZohoCliq.CalendarEvents.ALL',
		]);
		expect(getRequiredScopesForOperation('events', 'list')).toEqual([
			'ZohoCliq.CalendarEvents.ALL',
			'ZohoCalendar.calendar.ALL',
			'ZohoCalendar.event.ALL',
			'ZohoCalendar.search.READ',
		]);
	});

	it('should return rich operation scope policy metadata', () => {
		const eventsListPolicy = getOperationScopePolicy('events', 'list');
		expect(eventsListPolicy).toBeDefined();
		expect(eventsListPolicy?.requiredScopes).toEqual([
			'ZohoCliq.CalendarEvents.ALL',
			'ZohoCalendar.calendar.ALL',
			'ZohoCalendar.event.ALL',
			'ZohoCalendar.search.READ',
		]);
		expect(eventsListPolicy?.matchMode).toBe('all');
		expect(eventsListPolicy?.optionalScopes).toEqual(['ZohoCalendar.search.ALL']);
		expect(eventsListPolicy?.conditionalRequirements).toEqual([
			{
				id: 'searchParamPresent',
				when: 'Search query parameter is provided',
				requiredScopes: ['ZohoCalendar.search.READ'],
			},
		]);
		expect(eventsListPolicy?.acceptedAlternatives['ZohoCliq.CalendarEvents.ALL']).toEqual([
			'ZohoCliq.CalendarEvents.ALL',
		]);
		expect(eventsListPolicy?.acceptedAlternatives['ZohoCalendar.search.READ']).toEqual([
			'ZohoCalendar.search.READ',
			'ZohoCalendar.search.ALL',
		]);
		expect(eventsListPolicy?.disallowedScopes).toEqual([]);

		const schedulePolicy = getOperationScopePolicy('shared', 'scheduleMessage');
		expect(schedulePolicy?.requiredScopes).toEqual(['ZohoCliq.messages.CREATE']);
		expect(schedulePolicy?.disallowedScopes).toEqual(['ZohoCliq.messages.ALL']);
		expect(schedulePolicy?.acceptedAlternatives['ZohoCliq.messages.CREATE']).toEqual([
			'ZohoCliq.messages.CREATE',
			'ZohoCliq.Webhooks.CREATE',
		]);

		const userGetPolicy = getOperationScopePolicy('user', 'get');
		expect(userGetPolicy?.optionalScopes).toEqual([
			'ZohoPeople.forms.READ',
			'ZohoPeople.employee.READ',
			'ZohoPeople.attendance.READ',
		]);

		const userUpdatePolicy = getOperationScopePolicy('user', 'update');
		expect(userUpdatePolicy?.conditionalRequirements).toEqual([
			{
				id: 'imageDataProvided',
				when: 'image_data/profile photo is included in the update payload',
				requiredScopes: ['Profile.orguserphoto.UPDATE'],
			},
		]);

		const messageDeletePolicy = getOperationScopePolicy('message', 'delete');
		expect(messageDeletePolicy?.conditionalRequirements).toEqual([
			{
				id: 'messageLookupPreflight',
				when: 'Delete Message verifies the supplied Message ID before calling the delete endpoint',
				requiredScopes: ['ZohoCliq.Messages.READ'],
			},
		]);

		const messagePostPolicy = getOperationScopePolicy('message', 'post');
		expect(messagePostPolicy?.conditionalRequirements).toEqual([
			{
				id: 'directMessageUserPreflight',
				when: 'Post Message with Target = User verifies the supplied Email ID / ZUID before posting',
				requiredScopes: ['ZohoCliq.Users.READ'],
			},
		]);
	});

	it('should list accepted scopes for an operation including wildcard alternatives', () => {
		expect(listAcceptedScopesForOperation('message', 'retrieve')).toEqual([
			'ZohoCliq.Messages.READ',
			'ZohoCliq.Messages.ALL',
		]);
	});

	it('should return undefined when accepted scopes are requested for an unknown operation', () => {
		expect(listAcceptedScopesForOperation('message', 'missingOperation')).toBeUndefined();
	});

	it('should keep no-scope operations explicitly represented as empty arrays', () => {
		expect(getRequiredScopesForOperation('oauthHelper', 'getGrantedScopes')).toEqual([]);
		expect(getRequiredScopesForOperation('oauthHelper', 'listScopePacks')).toEqual([]);
		expect(getRequiredScopesForOperation('oauthHelper', 'checkScopePack')).toEqual([]);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildButtons')).toEqual([]);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildCardPayload')).toEqual(
			[],
		);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildChartComponent')).toEqual(
			[],
		);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildComponents')).toEqual([]);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildGraphComponent')).toEqual(
			[],
		);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildImageComponent')).toEqual(
			[],
		);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildLabelComponent')).toEqual(
			[],
		);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildListComponent')).toEqual(
			[],
		);
		expect(getRequiredScopesForOperation('messageComponentBuilder', 'buildTableComponent')).toEqual(
			[],
		);
	});

	it('should return undefined for unknown resource', () => {
		expect(getRequiredScopesForOperation('unknownResource', 'getStatus')).toBeUndefined();
	});

	it('should return undefined for unknown operation in known resource', () => {
		expect(getRequiredScopesForOperation('remoteWork', 'unknownOperation')).toBeUndefined();
	});

	it('should throw when getting single scope for unknown or multi-scope operation', () => {
		expect(() => getRequiredScopeForOperation('unknownResource', 'x')).toThrow(
			'No scope registry entry found',
		);
		expect(() => getRequiredScopeForOperation('oauthHelper', 'getGrantedScopes')).toThrow(
			'must resolve to exactly one required scope',
		);
	});

	it('should throw when required scopes (array) entry is missing', () => {
		expect(() => getRequiredScopesForOperationOrThrow('unknownResource', 'x')).toThrow(
			'No scope registry entry found',
		);
	});

	it('should return required scopes (array) for known operation', () => {
		expect(getRequiredScopesForOperationOrThrow('events', 'getCalendars')).toEqual([
			'ZohoCliq.CalendarEvents.ALL',
		]);
	});

	it('should return undefined policy for unknown operation', () => {
		expect(getOperationScopePolicy('unknownResource', 'x')).toBeUndefined();
	});

	it('should return default policy fields when no override exists', () => {
		const policy = getOperationScopePolicy('role', 'list');
		expect(policy?.matchMode).toBe('all');
		expect(policy?.optionalScopes).toEqual([]);
		expect(policy?.disallowedScopes).toEqual([]);
		expect(policy?.conditionalRequirements).toEqual([]);
		expect(policy?.acceptedAlternatives['ZohoCliq.Organisation.READ']).toEqual([
			'ZohoCliq.Organisation.READ',
			'ZohoCliq.Organisation.ALL',
		]);
	});

	it('should return any-match scope policy for destructive role operations', () => {
		const deletePolicy = getOperationScopePolicy('role', 'delete');
		const removeUsersPolicy = getOperationScopePolicy('role', 'removeUsers');

		expect(deletePolicy?.requiredScopes).toEqual([
			'ZohoCliq.Organisation.UPDATE',
			'ZohoCliq.Organisation.DELETE',
		]);
		expect(deletePolicy?.matchMode).toBe('any');
		expect(removeUsersPolicy?.requiredScopes).toEqual([
			'ZohoCliq.Organisation.UPDATE',
			'ZohoCliq.Organisation.DELETE',
		]);
		expect(removeUsersPolicy?.matchMode).toBe('any');
	});

	it('should resolve conditional scope requirements and return undefined when not present', () => {
		expect(getConditionalScopeRequirement('events', 'list', 'searchParamPresent')).toEqual({
			id: 'searchParamPresent',
			when: 'Search query parameter is provided',
			requiredScopes: ['ZohoCalendar.search.READ'],
		});
		expect(
			getConditionalScopeRequirement('shared', 'scheduleMessage', 'searchParamPresent'),
		).toBeUndefined();
		expect(getConditionalScopeRequirement('user', 'update', 'imageDataProvided')).toEqual({
			id: 'imageDataProvided',
			when: 'image_data/profile photo is included in the update payload',
			requiredScopes: ['Profile.orguserphoto.UPDATE'],
		});
		expect(getConditionalScopeRequirement('unknownResource', 'x', 'y')).toBeUndefined();
	});

	it('should list accepted scopes for conditional requirements including wildcard alternatives', () => {
		expect(
			listAcceptedScopesForConditionalRequirement('message', 'delete', 'messageLookupPreflight'),
		).toEqual(['ZohoCliq.Messages.READ', 'ZohoCliq.Messages.ALL']);
		expect(
			listAcceptedScopesForConditionalRequirement('message', 'post', 'directMessageUserPreflight'),
		).toEqual(['ZohoCliq.Users.READ', 'ZohoCliq.Users.ALL']);
		expect(
			listAcceptedScopesForConditionalRequirement('message', 'delete', 'missingCondition'),
		).toBeUndefined();
	});

	it('should include wildcard alternatives for conditional requirements when available', () => {
		expect(
			listAcceptedScopesForConditionalRequirement('user', 'update', 'imageDataProvided'),
		).toEqual(['Profile.orguserphoto.UPDATE', 'Profile.orguserphoto.ALL']);
	});

	it('should build wildcard alternatives only for resource.operation scopes', () => {
		expect(getWildcardAlternative('ZohoCliq.Channels.UPDATE')).toBe('ZohoCliq.Channels.ALL');
		expect(getWildcardAlternative('ZohoCliq.CalendarEvents.ALL')).toBeUndefined();
		expect(getWildcardAlternative('invalidscope')).toBeUndefined();
	});

	it('should build standardized scope missing payload', () => {
		expect(
			buildScopeMissingPayload({
				resource: 'remoteWork',
				operation: 'checkIn',
				requiredScopes: ['ZohoCliq.Profile.UPDATE'],
				missingScopes: ['ZohoCliq.Profile.UPDATE'],
			}),
		).toEqual({
			success: false,
			resource: 'remoteWork',
			operation: 'checkIn',
			requiredScopes: ['ZohoCliq.Profile.UPDATE'],
			missingScopes: ['ZohoCliq.Profile.UPDATE'],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});
});
