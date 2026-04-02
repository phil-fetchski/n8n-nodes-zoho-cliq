import type { IDataObject } from 'n8n-workflow';

export type ScopeRegistryEntry = Record<string, readonly string[]>;
export type ScopeMatchMode = 'all' | 'any';

export interface IConditionalScopeRequirement {
	id: string;
	when: string;
	requiredScopes: readonly string[];
	matchMode?: ScopeMatchMode;
}

export interface IOperationScopePolicy {
	requiredScopes: readonly string[];
	matchMode: ScopeMatchMode;
	optionalScopes: readonly string[];
	disallowedScopes: readonly string[];
	conditionalRequirements: readonly IConditionalScopeRequirement[];
	acceptedAlternatives: Readonly<Record<string, readonly string[]>>;
}

interface IOperationScopePolicyOverride {
	matchMode?: ScopeMatchMode;
	optionalScopes?: readonly string[];
	disallowedScopes?: readonly string[];
	conditionalRequirements?: readonly IConditionalScopeRequirement[];
	acceptedAlternatives?: Readonly<Record<string, readonly string[]>>;
}

export const OPERATION_SCOPE_REGISTRY = {
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
} as const satisfies Record<string, ScopeRegistryEntry>;

export type ScopeRegistryResource = keyof typeof OPERATION_SCOPE_REGISTRY;

const OPERATION_SCOPE_POLICY_OVERRIDES = {
	events: {
		list: {
			matchMode: 'all',
			optionalScopes: ['ZohoCalendar.search.ALL'],
			conditionalRequirements: [
				{
					id: 'searchParamPresent',
					when: 'Search query parameter is provided',
					requiredScopes: ['ZohoCalendar.search.READ'],
				},
			],
		},
	},
	bulkAction: {
		exportConversationMembers: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Export Members in a Conversation validates the supplied chat ID through Get Chat Members before calling the maintenance export endpoint',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
		exportMessages: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Export Messages validates the supplied chat ID through Get Chat Members before calling the maintenance export endpoint',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
	},
	chat: {
		leave: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Leave Group Chat validates the supplied chat ID through Get Chat Members before leaving the conversation',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
		mute: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Mute Chat validates the supplied chat ID through Get Chat Members before muting',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
		pinStickyMessage: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Pin Message validates the supplied chat ID through Get Chat Members before pinning a message',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
		unmute: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Unmute Chat validates the supplied chat ID through Get Chat Members before unmuting',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
		unpinStickyMessage: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Unpin Message validates the supplied chat ID through Get Chat Members before unpinning the current pinned message',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
	},
	message: {
		delete: {
			conditionalRequirements: [
				{
					id: 'messageLookupPreflight',
					when: 'Delete Message verifies the supplied Message ID before calling the delete endpoint',
					requiredScopes: ['ZohoCliq.Messages.READ'],
				},
			],
		},
		get: {
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Get Messages validates the supplied chat ID through Get Chat Members before retrieving messages',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
		},
		post: {
			conditionalRequirements: [
				{
					id: 'directMessageUserPreflight',
					when: 'Post Message with Target = User verifies the supplied Email ID / ZUID before posting',
					requiredScopes: ['ZohoCliq.Users.READ'],
				},
			],
		},
	},
	role: {
		delete: {
			matchMode: 'any',
		},
		removeUsers: {
			matchMode: 'any',
		},
	},
	shared: {
		scheduleMessage: {
			disallowedScopes: ['ZohoCliq.messages.ALL'],
			conditionalRequirements: [
				{
					id: 'chatLookupPreflight',
					when: 'Schedule Message validates the supplied chat ID through Get Chat Members before scheduling delivery',
					requiredScopes: ['ZohoCliq.Chats.READ'],
				},
			],
			acceptedAlternatives: {
				'ZohoCliq.messages.CREATE': ['ZohoCliq.Webhooks.CREATE', 'ZohoCliq.messages.ALL'],
			},
		},
	},
	user: {
		get: {
			optionalScopes: [
				'ZohoPeople.forms.READ',
				'ZohoPeople.employee.READ',
				'ZohoPeople.attendance.READ',
			],
		},
		list: {
			optionalScopes: [
				'ZohoPeople.forms.READ',
				'ZohoPeople.employee.READ',
				'ZohoPeople.attendance.READ',
			],
		},
		update: {
			conditionalRequirements: [
				{
					id: 'imageDataProvided',
					when: 'image_data/profile photo is included in the update payload',
					requiredScopes: ['Profile.orguserphoto.UPDATE'],
				},
			],
		},
	},
} as const satisfies Readonly<
	Record<string, Readonly<Record<string, IOperationScopePolicyOverride>>>
>;

export function listScopeRegistryResources(): ScopeRegistryResource[] {
	return Object.keys(OPERATION_SCOPE_REGISTRY) as ScopeRegistryResource[];
}

export function listOperationsForScopeResource(resource: ScopeRegistryResource): string[] {
	return Object.keys(OPERATION_SCOPE_REGISTRY[resource]);
}

export function getRequiredScopesForOperation(
	resource: string,
	operation: string,
): string[] | undefined {
	if (!Object.prototype.hasOwnProperty.call(OPERATION_SCOPE_REGISTRY, resource)) {
		return undefined;
	}

	const resourceRegistry = OPERATION_SCOPE_REGISTRY[
		resource as ScopeRegistryResource
	] as ScopeRegistryEntry;
	if (!Object.prototype.hasOwnProperty.call(resourceRegistry, operation)) {
		return undefined;
	}

	return [...resourceRegistry[operation]];
}

export function getRequiredScopeForOperation(resource: string, operation: string): string {
	const scopes = getRequiredScopesForOperation(resource, operation);
	if (!scopes) {
		throw new Error(`No scope registry entry found for "${resource}.${operation}".`);
	}

	if (scopes.length !== 1) {
		throw new Error(
			`Operation "${resource}.${operation}" must resolve to exactly one required scope.`,
		);
	}

	return scopes[0];
}

export function getRequiredScopesForOperationOrThrow(
	resource: string,
	operation: string,
): string[] {
	const scopes = getRequiredScopesForOperation(resource, operation);
	if (!scopes) {
		throw new Error(`No scope registry entry found for "${resource}.${operation}".`);
	}

	return scopes;
}

export function getWildcardAlternative(scope: string): string | undefined {
	const parts = scope.split('.');
	if (parts.length !== 3) {
		return undefined;
	}

	const [provider, resource, action] = parts;
	const actionUpper = action.toUpperCase();
	if (!['READ', 'CREATE', 'UPDATE', 'DELETE'].includes(actionUpper)) {
		return undefined;
	}

	return `${provider}.${resource}.ALL`;
}

function buildAcceptedAlternatives(
	requiredScopes: readonly string[],
	overrideAlternatives: Readonly<Record<string, readonly string[]>> | undefined,
	disallowedScopes: readonly string[],
): Readonly<Record<string, readonly string[]>> {
	const disallowedSet = new Set(disallowedScopes);
	const result: Record<string, readonly string[]> = {};

	for (const requiredScope of requiredScopes) {
		const alternatives = new Set<string>([requiredScope]);
		const wildcardAlternative = getWildcardAlternative(requiredScope);
		if (wildcardAlternative && !disallowedSet.has(wildcardAlternative)) {
			alternatives.add(wildcardAlternative);
		}

		for (const overrideValue of overrideAlternatives?.[requiredScope] ?? []) {
			if (!disallowedSet.has(overrideValue)) {
				alternatives.add(overrideValue);
			}
		}

		result[requiredScope] = [...alternatives];
	}

	return result;
}

export function getOperationScopePolicy(
	resource: string,
	operation: string,
): IOperationScopePolicy | undefined {
	const requiredScopes = getRequiredScopesForOperation(resource, operation);
	if (!requiredScopes) {
		return undefined;
	}

	const policyOverrides = OPERATION_SCOPE_POLICY_OVERRIDES as Readonly<
		Record<string, Readonly<Record<string, IOperationScopePolicyOverride>>>
	>;
	const overrides = policyOverrides[resource]?.[operation];
	const disallowedScopes = [...(overrides?.disallowedScopes ?? [])];
	const acceptedAlternatives = buildAcceptedAlternatives(
		requiredScopes,
		overrides?.acceptedAlternatives,
		disallowedScopes,
	);

	return {
		requiredScopes,
		matchMode: overrides?.matchMode ?? 'all',
		optionalScopes: [...(overrides?.optionalScopes ?? [])],
		disallowedScopes,
		conditionalRequirements: [...(overrides?.conditionalRequirements ?? [])],
		acceptedAlternatives,
	};
}

export function listAcceptedScopesForOperation(
	resource: string,
	operation: string,
): string[] | undefined {
	const policy = getOperationScopePolicy(resource, operation);
	if (!policy) {
		return undefined;
	}

	const acceptedScopes = new Set<string>();
	for (const acceptedScopesForRequirement of Object.values(policy.acceptedAlternatives)) {
		for (const acceptedScope of acceptedScopesForRequirement) {
			acceptedScopes.add(acceptedScope);
		}
	}

	return [...acceptedScopes];
}

export function getConditionalScopeRequirement(
	resource: string,
	operation: string,
	conditionId: string,
): IConditionalScopeRequirement | undefined {
	const policy = getOperationScopePolicy(resource, operation);
	if (!policy) {
		return undefined;
	}

	return policy.conditionalRequirements.find((condition) => condition.id === conditionId);
}

export function listAcceptedScopesForConditionalRequirement(
	resource: string,
	operation: string,
	conditionId: string,
): string[] | undefined {
	const condition = getConditionalScopeRequirement(resource, operation, conditionId);
	if (!condition) {
		return undefined;
	}

	const acceptedScopes = new Set<string>();
	for (const requiredScope of condition.requiredScopes) {
		acceptedScopes.add(requiredScope);
		[getWildcardAlternative(requiredScope)]
			.filter((scope): scope is string => typeof scope === 'string')
			.forEach((scope) => {
				acceptedScopes.add(scope);
			});
	}

	return [...acceptedScopes];
}

export function buildScopeMissingPayload(input: {
	resource: string;
	operation: string;
	requiredScopes: string[];
	missingScopes: string[];
}): IDataObject {
	return {
		success: false,
		resource: input.resource,
		operation: input.operation,
		requiredScopes: input.requiredScopes,
		missingScopes: input.missingScopes,
		hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
	};
}
