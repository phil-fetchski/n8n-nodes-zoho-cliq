import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export const DEFAULT_CLIQ_SCOPES = [
	'ZohoCliq.Bots.READ',
	'ZohoCliq.Channels.ALL',
	'ZohoCliq.Chats.ALL',
	'ZohoCliq.Messages.READ',
	'ZohoCliq.Messages.UPDATE',
	'ZohoCliq.Messages.DELETE',
	'ZohoCliq.messages.CREATE',
	'ZohoCliq.Profile.READ',
	'ZohoCliq.Reminders.ALL',
	'ZohoCliq.StorageData.ALL',
	'ZohoCliq.Teams.ALL',
	'ZohoCliq.Webhooks.CREATE',
	'ZohoCliq.Profile.CREATE',
	'ZohoCliq.Profile.DELETE',
	'ZohoCliq.Users.CREATE',
	'ZohoCliq.Users.READ',
	'ZohoCliq.Users.UPDATE',
	'Profile.orguserphoto.UPDATE',
	'ZohoCliq.UserFields.CREATE',
	'ZohoCliq.UserFields.UPDATE',
	'ZohoCliq.UserFields.DELETE',
	'ZohoCliq.Profile.UPDATE',
	'ZohoCliq.Attachments.READ',
	'ZohoCliq.Departments.ALL',
	'ZohoCliq.Organisation.READ',
	'ZohoCliq.Organisation.CREATE',
	'ZohoCliq.Organisation.UPDATE',
	'ZohoCliq.Organisation.DELETE',
	'ZohoCliq.OrganizationChannels.READ',
	'ZohoCliq.OrganizationChats.READ',
	'ZohoCliq.OrganizationMessages.READ',
	'ZohoCliq.Applications.update',
	'ZohoCliq.CalendarEvents.ALL',
	'ZohoCalendar.calendar.ALL',
	'ZohoCalendar.event.ALL',
	'ZohoCalendar.search.READ',
	'ZohoCliq.Designations.ALL',
	'ZohoCliq.MediaSession.READ',
	'ZohoCliq.messageactions.READ',
	'ZohoCliq.messageactions.CREATE',
	'ZohoCliq.messageactions.DELETE',
] as const;

export const ZOHO_PEOPLE_REMOTE_WORK_SCOPES = [
	'ZohoPeople.forms.READ',
	'ZohoPeople.employee.READ',
	'ZohoPeople.attendance.READ',
	'ZohoPeople.attendance.UPDATE',
] as const;

export const ALL_SCOPES = [...DEFAULT_CLIQ_SCOPES, ...ZOHO_PEOPLE_REMOTE_WORK_SCOPES] as const;
export const ALL_SCOPES_CSV = ALL_SCOPES.join(',');
export const DEFAULT_CLIQ_SCOPES_CSV = DEFAULT_CLIQ_SCOPES.join(',');

export const SCOPE_PACKS = {
	coreMessaging: {
		displayName: 'Core Messaging',
		description: 'Messages, threads, chats, channels, reactions, and webhooks basics.',
		scopes: [
			'ZohoCliq.Channels.ALL',
			'ZohoCliq.Chats.ALL',
			'ZohoCliq.Messages.READ',
			'ZohoCliq.Messages.UPDATE',
			'ZohoCliq.Messages.DELETE',
			'ZohoCliq.messages.CREATE',
			'ZohoCliq.Webhooks.CREATE',
			'ZohoCliq.messageactions.READ',
			'ZohoCliq.messageactions.CREATE',
			'ZohoCliq.messageactions.DELETE',
		],
	},
	corePeopleProfile: {
		displayName: 'Core People & Profile',
		description: 'Profile/status and user-read/write basics.',
		scopes: [
			'ZohoCliq.Profile.READ',
			'ZohoCliq.Profile.CREATE',
			'ZohoCliq.Profile.UPDATE',
			'ZohoCliq.Profile.DELETE',
			'ZohoCliq.Users.CREATE',
			'ZohoCliq.Users.READ',
			'ZohoCliq.Users.UPDATE',
			'Profile.orguserphoto.UPDATE',
		],
	},
	coreTeamsOrgStructure: {
		displayName: 'Core Teams & Org Structure',
		description: 'Teams, departments, designations, and user fields.',
		scopes: [
			'ZohoCliq.Teams.ALL',
			'ZohoCliq.Departments.ALL',
			'ZohoCliq.Designations.ALL',
			'ZohoCliq.UserFields.CREATE',
			'ZohoCliq.UserFields.UPDATE',
			'ZohoCliq.UserFields.DELETE',
		],
	},
	eventsCalendar: {
		displayName: 'Events & Calendar',
		description: 'Cliq events and Zoho Calendar scopes.',
		scopes: [
			'ZohoCliq.CalendarEvents.ALL',
			'ZohoCalendar.calendar.ALL',
			'ZohoCalendar.event.ALL',
			'ZohoCalendar.search.READ',
		],
	},
	remindersTasks: {
		displayName: 'Reminders & Tasks',
		description: 'Reminder lifecycle APIs.',
		scopes: ['ZohoCliq.Reminders.ALL'],
	},
	filesStorage: {
		displayName: 'Files & Storage',
		description: 'Attachment and storage-related operations.',
		scopes: ['ZohoCliq.Attachments.READ', 'ZohoCliq.StorageData.ALL', 'ZohoCliq.MediaSession.READ'],
	},
	orgAdmin: {
		displayName: 'Org Admin (Organization APIs)',
		description:
			'Organization-wide admin operations including bulk exports, custom domain, custom email, and role management. Only available to Zoho Organization Admin users.',
		scopes: [
			'ZohoCliq.Organisation.READ',
			'ZohoCliq.Organisation.CREATE',
			'ZohoCliq.Organisation.UPDATE',
			'ZohoCliq.Organisation.DELETE',
			'ZohoCliq.OrganizationChannels.READ',
			'ZohoCliq.OrganizationChats.READ',
			'ZohoCliq.OrganizationMessages.READ',
		],
	},
	remoteWorkZohoPeople: {
		displayName: 'Remote Work + Zoho People',
		description: 'Enhances remote work operations with Zoho People data.',
		scopes: [...ZOHO_PEOPLE_REMOTE_WORK_SCOPES],
	},
	botAndWebhooks: {
		displayName: 'Bot & Webhooks',
		description: 'Bot/webhook/app integration scopes.',
		scopes: ['ZohoCliq.Bots.READ', 'ZohoCliq.Applications.update'],
	},
} as const;

export type ScopePackName = keyof typeof SCOPE_PACKS;
export type ScopeMode = 'allScopes' | 'scopePacks' | 'rawCsv';

export const DEFAULT_SCOPE_PACK_SELECTION: ScopePackName[] = [
	'coreMessaging',
	'corePeopleProfile',
	'coreTeamsOrgStructure',
	'eventsCalendar',
	'remindersTasks',
	'filesStorage',
	'orgAdmin',
	'botAndWebhooks',
];

const SCOPE_PACK_ORDER = Object.keys(SCOPE_PACKS) as ScopePackName[];
const SCOPE_PACK_CSV = {
	coreMessaging: SCOPE_PACKS.coreMessaging.scopes.join(','),
	corePeopleProfile: SCOPE_PACKS.corePeopleProfile.scopes.join(','),
	coreTeamsOrgStructure: SCOPE_PACKS.coreTeamsOrgStructure.scopes.join(','),
	eventsCalendar: SCOPE_PACKS.eventsCalendar.scopes.join(','),
	remindersTasks: SCOPE_PACKS.remindersTasks.scopes.join(','),
	filesStorage: SCOPE_PACKS.filesStorage.scopes.join(','),
	orgAdmin: SCOPE_PACKS.orgAdmin.scopes.join(','),
	remoteWorkZohoPeople: SCOPE_PACKS.remoteWorkZohoPeople.scopes.join(','),
	botAndWebhooks: SCOPE_PACKS.botAndWebhooks.scopes.join(','),
} as const;
const SCOPE_PACK_CSV_TO_NAME = new Map<string, ScopePackName>(
	SCOPE_PACK_ORDER.map((packName) => [SCOPE_PACK_CSV[packName], packName]),
);
const SCOPE_PACK_OPTIONS = SCOPE_PACK_ORDER.filter(
	(packName) => SCOPE_PACKS[packName].scopes.length > 0,
).map((packName) => ({
	name: SCOPE_PACKS[packName].displayName,
	value: SCOPE_PACK_CSV[packName],
	description: SCOPE_PACKS[packName].description,
}));

function normalizeScopePackSelections(selectedPacks: string[]): ScopePackName[] {
	const normalized: ScopePackName[] = [];
	const seen = new Set<ScopePackName>();

	for (const selectedPack of selectedPacks) {
		let packName: ScopePackName | undefined;

		if (
			Object.prototype.hasOwnProperty.call(SCOPE_PACKS, selectedPack) &&
			selectedPack in SCOPE_PACKS
		) {
			packName = selectedPack as ScopePackName;
		} else {
			packName = SCOPE_PACK_CSV_TO_NAME.get(selectedPack);
		}

		if (!packName || seen.has(packName)) {
			continue;
		}

		seen.add(packName);
		normalized.push(packName);
	}

	return normalized;
}

function splitScopeCsv(scopeCsv: string): string[] {
	return scopeCsv
		.split(',')
		.map((scope) => scope.trim())
		.filter((scope) => scope.length > 0);
}

function dedupeScopes(scopes: string[]): string[] {
	const seen = new Set<string>();
	const deduped: string[] = [];

	for (const scope of scopes) {
		if (seen.has(scope)) {
			continue;
		}
		seen.add(scope);
		deduped.push(scope);
	}

	return deduped;
}

export function getScopesForPackSelection(selectedPacks: string[]): string[] {
	const normalizedSelectedPacks = normalizeScopePackSelections(selectedPacks);
	const selectedSet = new Set(normalizedSelectedPacks);
	const scopes: string[] = [];

	for (const packName of SCOPE_PACK_ORDER) {
		if (!selectedSet.has(packName)) {
			continue;
		}
		scopes.push(...SCOPE_PACKS[packName].scopes);
	}

	const dedupedScopes = dedupeScopes(scopes);
	const canonicalOrder = new Map<string, number>(ALL_SCOPES.map((scope, index) => [scope, index]));

	return dedupedScopes.sort((a, b) => {
		const aOrder = canonicalOrder.get(a);
		const bOrder = canonicalOrder.get(b);
		const aRank = aOrder ?? Number.MAX_SAFE_INTEGER;
		const bRank = bOrder ?? Number.MAX_SAFE_INTEGER;
		return aRank - bRank;
	});
}

export function buildScopeCsvFromMode(input: {
	scopeMode?: ScopeMode;
	selectedScopePacks?: string[];
	rawScopeCsv?: string;
	includeZohoPeopleScopePack?: boolean;
}): string {
	const scopeMode = input.scopeMode ?? 'scopePacks';

	if (scopeMode === 'rawCsv') {
		return dedupeScopes(splitScopeCsv(input.rawScopeCsv ?? '')).join(',');
	}

	if (scopeMode === 'allScopes') {
		return ALL_SCOPES_CSV;
	}

	const selectedScopePacks = Array.isArray(input.selectedScopePacks)
		? input.selectedScopePacks
		: DEFAULT_SCOPE_PACK_SELECTION;
	const normalizedSelectedPacks = new Set(normalizeScopePackSelections(selectedScopePacks));

	if (input.includeZohoPeopleScopePack) {
		normalizedSelectedPacks.add('remoteWorkZohoPeople');
	}

	return getScopesForPackSelection(Array.from(normalizedSelectedPacks)).join(',');
}

export class ZohoCliqOAuth2Api implements ICredentialType {
	name = 'zohoCliqOAuth2Api';
	displayName = 'Zoho Cliq OAuth2 API';
	extends = ['oAuth2Api'];
	documentationUrl =
		'https://github.com/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/documentation/CREDENTIALS.md';
	icon: Icon = {
		light: 'file:ZohoCliqCredentialsIconLight.svg',
		dark: 'file:ZohoCliqCredentialsIconDark.svg',
	};

	properties: INodeProperties[] = [
		{
			displayName: 'Data Center',
			name: 'dc',
			type: 'options',
			default: 'us',
			required: true,
			options: [
				{ name: 'US', value: 'us' },
				{ name: 'EU', value: 'eu' },
				{ name: 'IN', value: 'in' },
				{ name: 'AU', value: 'au' },
				{ name: 'JP', value: 'jp' },
				{ name: 'CN', value: 'cn' },
				{ name: 'SA', value: 'sa' },
				{ name: 'UK', value: 'uk' },
				{ name: 'CA', value: 'ca' },
			],
			description:
				'Select your Zoho data center. This determines the API endpoint and authentication server. Only valid data centers are accepted.',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default:
				'={{$self["dc"] === "eu" ? "https://accounts.zoho.eu/oauth/v2/auth" : $self["dc"] === "in" ? "https://accounts.zoho.in/oauth/v2/auth" : $self["dc"] === "au" ? "https://accounts.zoho.com.au/oauth/v2/auth" : $self["dc"] === "jp" ? "https://accounts.zoho.jp/oauth/v2/auth" : $self["dc"] === "cn" ? "https://accounts.zoho.com.cn/oauth/v2/auth" : $self["dc"] === "sa" ? "https://accounts.zoho.sa/oauth/v2/auth" : $self["dc"] === "uk" ? "https://accounts.zoho.uk/oauth/v2/auth" : $self["dc"] === "ca" ? "https://accounts.zohocloud.ca/oauth/v2/auth" : "https://accounts.zoho.com/oauth/v2/auth"}}',
			description: 'Automatically set based on the selected Data Center. No action needed.',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default:
				'={{$self["dc"] === "eu" ? "https://accounts.zoho.eu/oauth/v2/token" : $self["dc"] === "in" ? "https://accounts.zoho.in/oauth/v2/token" : $self["dc"] === "au" ? "https://accounts.zoho.com.au/oauth/v2/token" : $self["dc"] === "jp" ? "https://accounts.zoho.jp/oauth/v2/token" : $self["dc"] === "cn" ? "https://accounts.zoho.com.cn/oauth/v2/token" : $self["dc"] === "sa" ? "https://accounts.zoho.sa/oauth/v2/token" : $self["dc"] === "uk" ? "https://accounts.zoho.uk/oauth/v2/token" : $self["dc"] === "ca" ? "https://accounts.zohocloud.ca/oauth/v2/token" : "https://accounts.zoho.com/oauth/v2/token"}}',
			description: 'Automatically set based on the selected Data Center. No action needed.',
		},
		{
			displayName: 'Scope Mode',
			name: 'scopeMode',
			type: 'options',
			default: 'scopePacks',
			options: [
				{
					name: 'Include All Scopes',
					value: 'allScopes',
					description: 'Requests the canonical full scope set.',
				},
				{
					name: 'Select Scope Packs',
					value: 'scopePacks',
					description: 'Requests scopes from selected logical packs.',
				},
				{
					name: 'Raw Scope Input (CSV)',
					value: 'rawCsv',
					description: 'Advanced mode: enter comma-separated scopes directly.',
				},
			],
			description:
				'Choose how OAuth scopes are requested. Reconnect is required after any scope change.',
		},
		{
			displayName: 'Selected Scope Packs',
			name: 'selectedScopePacks',
			type: 'multiOptions',
			default: ['coreMessaging', 'botAndWebhooks'],
			displayOptions: {
				show: {
					scopeMode: ['scopePacks'],
				},
			},
			options: SCOPE_PACK_OPTIONS,
			description:
				'Select one or more scope packs. Scopes are combined into a single OAuth scope string for authorization. Note: The "Org Admin (Organization APIs)" scope pack is available only to Zoho Organization Admin users.',
		},
		{
			displayName: 'Raw Scope CSV',
			name: 'rawScopeCsv',
			type: 'string',
			typeOptions: {
				rows: 4,
			},
			default: '',
			placeholder: `e.g. ${ALL_SCOPES_CSV}`,
			displayOptions: {
				show: {
					scopeMode: ['rawCsv'],
				},
			},
			description:
				'Comma-separated scopes. Prefilled with canonical all-scope values so you can remove scopes as needed.',
		},
		{
			displayName: 'All Scopes Value',
			name: 'allScopesValue',
			type: 'hidden',
			default: ALL_SCOPES_CSV,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default:
				'={{$self["scopeMode"] === "rawCsv" ? ($self["rawScopeCsv"] || "") : $self["scopeMode"] === "scopePacks" ? (($self["selectedScopePacks"] || []).join(",")) : ($self["allScopesValue"] || "")}}',
			required: true,
			description:
				'<strong>OAuth scopes are generated from Scope Mode.</strong><br><br>' +
				'Use Include All Scopes for fastest onboarding, Scope Packs for least-privilege setup, or Raw Scope CSV for advanced control.<br><br>' +
				'<strong>Security:</strong> You can revoke access anytime in your <a href="https://accounts.zoho.com/home#sessions/userconnectedapps" target="_blank">Zoho Account Settings</a>.<br><br>' +
				'<a href="https://www.zoho.com/cliq/help/restapi/v2/" target="_blank">Learn more about Zoho Cliq API →</a>',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: 'access_type=offline&prompt=consent',
			description:
				'Request offline access and force consent during interactive authorization to ensure refresh token issuance',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
			description: 'Send credentials in request body (OAuth2 standard)',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.oauthTokenData.access_token}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL:
				'={{$credentials?.dc === "eu" ? "https://cliq.zoho.eu" : $credentials?.dc === "in" ? "https://cliq.zoho.in" : $credentials?.dc === "au" ? "https://cliq.zoho.com.au" : $credentials?.dc === "jp" ? "https://cliq.zoho.jp" : $credentials?.dc === "cn" ? "https://cliq.zoho.com.cn" : $credentials?.dc === "sa" ? "https://cliq.zoho.sa" : $credentials?.dc === "uk" ? "https://cliq.zoho.uk" : $credentials?.dc === "ca" ? "https://cliq.zohocloud.ca" : "https://cliq.zoho.com"}}',
			url: '/api/v2/statuses/current',
			// Add timeout for credential test
			timeout: 10000,
		},
	};
}

/**
 * Validates OAuth scopes for required operations
 * Ensures scopes follow Zoho Cliq naming conventions
 *
 * @param scope - Comma-separated OAuth scopes
 * @returns Array of validation errors (empty if valid)
 */
export function validateZohoCliqScopes(scope: string): string[] {
	const errors: string[] = [];

	if (!scope || scope.trim() === '') {
		errors.push('OAuth scope is required and cannot be empty');
		return errors;
	}

	// Split scopes and trim whitespace
	const scopes = scope
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	if (scopes.length === 0) {
		errors.push('At least one OAuth scope must be specified');
		return errors;
	}

	// Valid Zoho Cliq, ZohoCalendar, and ZohoPeople scope prefixes and operations
	const validPrefixes = ['ZohoCliq.', 'ZohoCalendar.', 'ZohoPeople.', 'Profile.'];
	const validResources = [
		'Applications',
		'Attachments',
		'Bots',
		'CalendarEvents',
		'Channels',
		'Chats',
		'Departments',
		'Designations',
		'MediaSession',
		'Messages',
		'Organisation',
		'Organization',
		'OrganizationChannels',
		'OrganizationChats',
		'OrganizationMessages',
		'Profile',
		'Reminders',
		'StorageData',
		'Statuses',
		'Teams',
		'UserFields',
		'Users',
		'Webhooks',
		'messageactions',
		'messages',
		'calendar',
		'event',
		'search',
		'forms',
		'employee',
		'attendance',
		'orguserphoto',
	];
	const validOperations = [
		'CREATE',
		'READ',
		'UPDATE',
		'DELETE',
		'ALL',
		'create',
		'read',
		'update',
		'delete',
	];

	for (const scopeItem of scopes) {
		// Check if scope starts with valid prefix
		if (!validPrefixes.some((prefix) => scopeItem.startsWith(prefix))) {
			errors.push(
				`Invalid scope "${scopeItem}": Must start with one of: ${validPrefixes.join(', ')}`,
			);
			continue;
		}

		// Parse scope format: ZohoCliq.Resource.OPERATION, ZohoCalendar.Resource.OPERATION, or ZohoPeople.Resource.OPERATION
		const parts = scopeItem.split('.');
		if (parts.length !== 3) {
			errors.push(
				`Invalid scope format "${scopeItem}": Expected format <Prefix>.<Resource>.<OPERATION> where Prefix is one of: ${validPrefixes.join(', ')}`,
			);
			continue;
		}

		const [, resource, operation] = parts;

		// Validate resource
		if (!validResources.includes(resource)) {
			errors.push(
				`Invalid resource in scope "${scopeItem}": Resource must be one of ${validResources.join(', ')}`,
			);
		}

		// Validate operation
		if (!validOperations.includes(operation)) {
			errors.push(
				`Invalid operation in scope "${scopeItem}": Operation must be one of ${validOperations.join(', ')}`,
			);
		}
	}

	return errors;
}

/**
 * Checks if required scope is present for a specific operation
 *
 * @param grantedScopes - Comma-separated granted OAuth scopes
 * @param requiredScope - Required scope (e.g., 'ZohoCliq.Channels.CREATE')
 * @returns true if scope is granted, false otherwise
 */
export function hasRequiredScope(
	grantedScopes: string,
	requiredScope: string,
	options?: {
		caseInsensitive?: boolean;
	},
): boolean {
	if (!grantedScopes || !requiredScope) {
		return false;
	}

	const caseInsensitive = options?.caseInsensitive === true;
	const normalize = (value: string) => (caseInsensitive ? value.toLowerCase() : value);
	const scopes = grantedScopes.split(',').map((s) => s.trim());
	const normalizedScopeSet = new Set(scopes.map(normalize));
	const scopeAliases: Record<string, string[]> = {
		'ZohoCliq.Messages.CREATE': ['ZohoCliq.messages.CREATE', 'ZohoCliq.Webhooks.CREATE'],
		'ZohoCliq.messages.CREATE': ['ZohoCliq.Messages.CREATE', 'ZohoCliq.Webhooks.CREATE'],
		'ZohoCliq.Webhooks.CREATE': [
			'ZohoCliq.Messages.CREATE',
			'ZohoCliq.messages.CREATE',
			'ZohoCliq.Messages.ALL',
		],
		'ZohoCliq.Applications.UPDATE': ['ZohoCliq.Applications.update'],
		'ZohoCliq.Applications.update': ['ZohoCliq.Applications.UPDATE'],
		'ZohoCliq.Attachments.READ': ['ZohoCliq.Files.READ'],
		'ZohoCliq.Files.READ': ['ZohoCliq.Attachments.READ'],
		'ZohoCliq.Profile.CREATE': ['ZohoCliq.Statuses.CREATE'],
		'ZohoCliq.Profile.READ': ['ZohoCliq.Statuses.READ'],
		'ZohoCliq.Profile.UPDATE': ['ZohoCliq.Statuses.UPDATE'],
		'ZohoCliq.Profile.DELETE': ['ZohoCliq.Statuses.DELETE'],
		'ZohoCliq.Statuses.CREATE': ['ZohoCliq.Profile.CREATE'],
		'ZohoCliq.Statuses.READ': ['ZohoCliq.Profile.READ'],
		'ZohoCliq.Statuses.UPDATE': ['ZohoCliq.Profile.UPDATE'],
		'ZohoCliq.Statuses.DELETE': ['ZohoCliq.Profile.DELETE'],
	};

	// Check for exact match
	if (normalizedScopeSet.has(normalize(requiredScope))) {
		return true;
	}

	const aliases = [...(scopeAliases[requiredScope] ?? [])];
	if (caseInsensitive && aliases.length === 0) {
		const matchingAliasEntry = Object.entries(scopeAliases).find(
			([scope]) => scope.toLowerCase() === requiredScope.toLowerCase(),
		);
		if (matchingAliasEntry) {
			aliases.push(...matchingAliasEntry[1]);
		}
	}
	if (aliases.some((alias) => normalizedScopeSet.has(normalize(alias)))) {
		return true;
	}

	// Check for wildcard permission (e.g., ZohoCliq.Channels.ALL)
	const [provider, resource] = requiredScope.split('.');
	if (!provider || !resource) {
		return false;
	}
	const wildcardScope = `${provider}.${resource}.ALL`;

	return normalizedScopeSet.has(normalize(wildcardScope));
}
