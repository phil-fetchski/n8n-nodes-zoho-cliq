import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	READ_ONLY_PERMISSION_ACTIONS,
	UNSUPPORTED_PERMISSION_MODULES,
} from './permissions.constants';

const optionValueDelimiter = '::';

export type PermissionGroupDefinition = {
	name: string;
	section: PermissionGroupSection;
	displayName: string;
	description: string;
	options: Array<{ name: string; value: string }>;
};

export type PermissionGroupSection = 'admin' | 'configuration' | 'mobile';

type PermissionConfigTemplate = {
	configName: string;
	configValue: unknown;
};

const permissionOption = (name: string, module: string, action: string) => ({
	name,
	value: `${module}${optionValueDelimiter}${action}`,
});

const permissionGroupDefinitionsRaw: PermissionGroupDefinition[] = [
	{
		name: 'adminUsersAndProfilesPermissions',
		section: 'admin',
		displayName: 'Users & Profiles',
		description: 'Admin Panel: Users, Teams, Departments, and Designations permissions',
		options: [
			permissionOption('Users: Get', 'users', 'get'),
			permissionOption('Users: Create', 'users', 'create'),
			permissionOption('Users: Edit', 'users', 'edit'),
			permissionOption('Users: Delete', 'users', 'delete'),
			permissionOption('Teams: Get', 'teams', 'get'),
			permissionOption('Teams: Create', 'teams', 'create'),
			permissionOption('Teams: Edit', 'teams', 'edit'),
			permissionOption('Teams: Delete', 'teams', 'delete'),
			permissionOption('Departments: Get', 'departments', 'get'),
			permissionOption('Departments: Create', 'departments', 'create'),
			permissionOption('Departments: Edit', 'departments', 'edit'),
			permissionOption('Departments: Delete', 'departments', 'delete'),
			permissionOption('Designations: Get', 'designations', 'get'),
			permissionOption('Designations: Create', 'designations', 'create'),
			permissionOption('Designations: Edit', 'designations', 'edit'),
			permissionOption('Designations: Delete', 'designations', 'delete'),
		],
	},
	{
		name: 'adminOrganizationPermissions',
		section: 'admin',
		displayName: 'Organization',
		description: 'Admin Panel: Organization and Configurations permissions',
		options: [
			permissionOption('Organization: Get', 'organisations', 'get'),
			permissionOption('Organization: Create', 'organisations', 'create'),
			permissionOption('Organization: Edit', 'organisations', 'edit'),
			permissionOption('Organization: Delete', 'organisations', 'delete'),
			permissionOption('Configurations: Get', 'modules', 'get'),
			permissionOption('Configurations: Edit', 'modules', 'edit'),
		],
	},
	{
		name: 'adminPermissionsPermissions',
		section: 'admin',
		displayName: 'Permissions',
		description: 'Admin Panel: Roles, Policies, and Allowed IP permissions',
		options: [
			permissionOption('Roles: Get', 'profiles', 'get'),
			permissionOption('Roles: Create', 'profiles', 'create'),
			permissionOption('Roles: Edit', 'profiles', 'edit'),
			permissionOption('Roles: Delete', 'profiles', 'delete'),
			permissionOption('Custom Admin: Get', 'custom_admin', 'get'),
			permissionOption('Custom Admin: Create', 'custom_admin', 'create'),
			permissionOption('Custom Admin: Edit', 'custom_admin', 'edit'),
			permissionOption('Custom Admin: Delete', 'custom_admin', 'delete'),
			permissionOption('Policies: Get', 'policies', 'get'),
			permissionOption('Policies: Edit', 'policies', 'edit'),
			permissionOption('Allowed IPs: Get', 'ip_restriction', 'get'),
			permissionOption('Allowed IPs: Create', 'ip_restriction', 'create'),
			permissionOption('Allowed IPs: Delete', 'ip_restriction', 'delete'),
		],
	},
	{
		name: 'adminResourceManagementPermissions',
		section: 'admin',
		displayName: 'Resource Management',
		description: 'Admin Panel: Resource management permissions',
		options: [
			permissionOption('Channels Management: Manage', 'channel_management', 'manage'),
			permissionOption('Smart Rooms: Manage', 'smart_rooms', 'manage'),
			permissionOption('Internal Apps: Manage', 'internal_apps', 'manage'),
			permissionOption('Extensions: Manage', 'extensions', 'manage'),
		],
	},
	{
		name: 'adminCustomizationPermissions',
		section: 'admin',
		displayName: 'Customization',
		description: 'Admin Panel: Customization permissions',
		options: [
			permissionOption('Custom Domain: Get', 'customdomain', 'get'),
			permissionOption('Custom Domain: Create', 'customdomain', 'create'),
			permissionOption('Custom Domain: Edit', 'customdomain', 'edit'),
			permissionOption('Custom Domain: Delete', 'customdomain', 'delete'),
			permissionOption('Emailers: Get', 'custom_emails', 'get'),
			permissionOption('Emailers: Create', 'custom_emails', 'create'),
			permissionOption('Emailers: Edit', 'custom_emails', 'edit'),
			permissionOption('Emailers: Delete', 'custom_emails', 'delete'),
			permissionOption('Themes: Get', 'themes', 'get'),
			permissionOption('Themes: Create', 'themes', 'create'),
			permissionOption('Themes: Edit', 'themes', 'edit'),
			permissionOption('Themes: Delete', 'themes', 'delete'),
			permissionOption('Assets: Get', 'assets', 'get'),
			permissionOption('Assets: Create', 'assets', 'create'),
			permissionOption('Assets: Edit', 'assets', 'edit'),
			permissionOption('Assets: Delete', 'assets', 'delete'),
			permissionOption('Meeting Branding: Create', 'meeting_branding', 'create'),
			permissionOption('Meeting Branding: Edit', 'meeting_branding', 'edit'),
			permissionOption('Meeting Branding: Delete', 'meeting_branding', 'delete'),
			permissionOption('Meeting Branding: Manage', 'meeting_branding', 'manage'),
			permissionOption('User Fields: Get', 'users_fields', 'get'),
			permissionOption('User Fields: Create', 'users_fields', 'create'),
			permissionOption('User Fields: Edit', 'users_fields', 'edit'),
			permissionOption('User Fields: Delete', 'users_fields', 'delete'),
		],
	},
	{
		name: 'adminIntegrationPermissions',
		section: 'admin',
		displayName: 'Integration',
		description: 'Admin Panel: Integration permissions',
		options: [
			permissionOption('Office 365: Edit', 'office365', 'edit'),
			permissionOption('SSO Services: Edit', 'sso', 'edit'),
			permissionOption('ShowTime: Edit', 'showtime_integrations', 'edit'),
			permissionOption('Zoho People: Edit', 'people_integrations', 'edit'),
			permissionOption('Zoho Projects: Edit', 'projects_integration', 'edit'),
			permissionOption('Zoho Telephony: Edit', 'telephony_integrations', 'edit'),
			permissionOption('Zoho Notebook: Edit', 'notebook_integration', 'edit'),
			permissionOption('Zoho Voice: Edit', 'voice_integration', 'edit'),
			permissionOption('Zia: Get', 'zia', 'get'),
		],
	},
	{
		name: 'adminReportsPermissions',
		section: 'admin',
		displayName: 'Reports',
		description: 'Admin Panel: Reports permissions',
		options: [
			permissionOption('Availability: Access', 'reports', 'access'),
			permissionOption('Probable Presence: Access', 'probable_presence', 'access'),
			permissionOption('Usage: Access', 'usage_reports', 'access'),
			permissionOption('Usage: Exports', 'usage_reports', 'export'),
		],
	},
	{
		name: 'adminDataAdministrationPermissions',
		section: 'admin',
		displayName: 'Data Administration',
		description: 'Admin Panel: Data administration permissions',
		options: [
			permissionOption('Export: Access', 'export', 'access'),
			permissionOption('Import Users: Access', 'cliq_user_import', 'access'),
			permissionOption('Import from Slack: Access', 'slack_migration', 'access'),
			permissionOption('Import from Meta Workplace: Access', 'fbmeta_migration', 'access'),
			permissionOption('Import from Google Chat: Access', 'google_migration', 'access'),
			permissionOption('Import from Microsoft Teams: Access', 'teams_migration', 'access'),
			permissionOption('Audit Logs: Access', 'audits', 'access'),
			permissionOption('eDiscovery: Access', 'ediscovery', 'access'),
			permissionOption('Data Loss Prevention: Manage', 'dlp', 'manage'),
			permissionOption('Import Users to Team: Access', 'cliq_team_import', 'access'),
			permissionOption('File Cleanup: Access', 'data_cleanup', 'access'),
		],
	},
	{
		name: 'configDirectConversationsPermissions',
		section: 'configuration',
		displayName: 'Direct Conversations',
		description: 'Configuration: Direct conversation permissions',
		options: [
			permissionOption('Only within department: Send Message', 'department_member', 'message'),
			permissionOption('Only within department: File Sharing', 'department_member', 'attachments'),
			permissionOption('Only within department: Download Files', 'department_member', 'download'),
			permissionOption('Only within department: Forward Files', 'department_member', 'forward'),
			permissionOption(
				'Only within department: Make Audio Calls',
				'department_member',
				'audio_call',
			),
			permissionOption(
				'Only within department: Make Video Calls',
				'department_member',
				'video_call',
			),
			permissionOption(
				'Only within department: Make Screenshare',
				'department_member',
				'screen_share_call',
			),
			permissionOption('Clients: Send Message', 'client_member', 'message'),
			permissionOption('Clients: File Sharing', 'client_member', 'attachments'),
			permissionOption('Clients: Download Files', 'client_member', 'download'),
			permissionOption('Clients: Forward Files', 'client_member', 'forward'),
			permissionOption('Clients: Make Audio Calls', 'client_member', 'audio_call'),
			permissionOption('Clients: Make Video Calls', 'client_member', 'video_call'),
			permissionOption('Clients: Make Screenshare', 'client_member', 'screen_share_call'),
			permissionOption('Other colleagues: Send Message', 'organisation_member', 'message'),
			permissionOption('Other colleagues: File Sharing', 'organisation_member', 'attachments'),
			permissionOption('Other colleagues: Download Files', 'organisation_member', 'download'),
			permissionOption('Other colleagues: Forward Files', 'organisation_member', 'forward'),
			permissionOption('Other colleagues: Make Audio Calls', 'organisation_member', 'audio_call'),
			permissionOption('Other colleagues: Make Video Calls', 'organisation_member', 'video_call'),
			permissionOption(
				'Other colleagues: Make Screenshare',
				'organisation_member',
				'screen_share_call',
			),
			permissionOption('External users: Send Message', 'external_member', 'message'),
			permissionOption('External users: File Sharing', 'external_member', 'attachments'),
			permissionOption('External users: Download Files', 'external_member', 'download'),
			permissionOption('External users: Forward Files', 'external_member', 'forward'),
			permissionOption('External users: Make Audio Calls', 'external_member', 'audio_call'),
			permissionOption('External users: Make Video Calls', 'external_member', 'video_call'),
			permissionOption('External users: Make Screenshare', 'external_member', 'screen_share_call'),
		],
	},
	{
		name: 'configConversationsPermissions',
		section: 'configuration',
		displayName: 'Conversations',
		description: 'Configuration: Channel and group chat permissions',
		options: [
			permissionOption('Team Channel: Use', 'team_channels', 'use'),
			permissionOption('Team Channel: Create', 'team_channels', 'create'),
			permissionOption('Team Channel: Edit', 'team_channels', 'edit'),
			permissionOption('Team Channel: Delete', 'team_channels', 'delete'),
			permissionOption('Team Channel: File Sharing', 'team_channels', 'attachments'),
			permissionOption('Team Channel: Download Files', 'team_channels', 'download'),
			permissionOption('Team Channel: Forward Files', 'team_channels', 'forward'),
			permissionOption('Organization Channel: Use', 'org_channels', 'use'),
			permissionOption('Organization Channel: Create', 'org_channels', 'create'),
			permissionOption('Organization Channel: Edit', 'org_channels', 'edit'),
			permissionOption('Organization Channel: Delete', 'org_channels', 'delete'),
			permissionOption('Organization Channel: File Sharing', 'org_channels', 'attachments'),
			permissionOption('Organization Channel: Download Files', 'org_channels', 'download'),
			permissionOption('Organization Channel: Forward Files', 'org_channels', 'forward'),
			permissionOption('External Channel: Use', 'external_channels', 'use'),
			permissionOption('External Channel: Create', 'external_channels', 'create'),
			permissionOption('External Channel: Edit', 'external_channels', 'edit'),
			permissionOption('External Channel: Delete', 'external_channels', 'delete'),
			permissionOption('External Channel: File Sharing', 'external_channels', 'attachments'),
			permissionOption('External Channel: Download Files', 'external_channels', 'download'),
			permissionOption('External Channel: Forward Files', 'external_channels', 'forward'),
			permissionOption('Personal Channel: Use', 'private_channels', 'use'),
			permissionOption('Personal Channel: Create', 'private_channels', 'create'),
			permissionOption('Personal Channel: Edit', 'private_channels', 'edit'),
			permissionOption('Personal Channel: Delete', 'private_channels', 'delete'),
			permissionOption('Personal Channel: File Sharing', 'private_channels', 'attachments'),
			permissionOption('Personal Channel: Download Files', 'private_channels', 'download'),
			permissionOption('Personal Channel: Forward Files', 'private_channels', 'forward'),
			permissionOption('Group Chats: Create', 'group_chat', 'create'),
			permissionOption('Group Chats: File Sharing', 'group_chat', 'attachments'),
			permissionOption('Group Chats: Download Files', 'group_chat', 'download'),
			permissionOption('Group Chats: Forward Files', 'group_chat', 'forward'),
		],
	},
	{
		name: 'configGuestChatPermissions',
		section: 'configuration',
		displayName: 'Guest Chat',
		description: 'Configuration: Guest chat permissions',
		options: [
			permissionOption('Guest Room: Create', 'guest_room', 'create'),
			permissionOption('Guest Room: Use', 'guest_room', 'use'),
		],
	},
	{
		name: 'configInternalToolsPermissions',
		section: 'configuration',
		displayName: 'Internal Tools',
		description: 'Configuration: Internal tools permissions',
		options: [
			permissionOption('Commands: Use', 'commands', 'use'),
			permissionOption('Commands: Create', 'commands', 'create'),
			permissionOption('Commands: Edit', 'commands', 'edit'),
			permissionOption('Commands: Delete', 'commands', 'delete'),
			permissionOption('Bots: Use', 'bots', 'use'),
			permissionOption('Bots: Create', 'bots', 'create'),
			permissionOption('Bots: Edit', 'bots', 'edit'),
			permissionOption('Bots: Delete', 'bots', 'delete'),
			permissionOption('Functions: Use', 'functions', 'use'),
			permissionOption('Functions: Create', 'functions', 'create'),
			permissionOption('Functions: Edit', 'functions', 'edit'),
			permissionOption('Functions: Delete', 'functions', 'delete'),
			permissionOption('Message Actions: Use', 'message_actions', 'use'),
			permissionOption('Message Actions: Create', 'message_actions', 'create'),
			permissionOption('Message Actions: Edit', 'message_actions', 'edit'),
			permissionOption('Message Actions: Delete', 'message_actions', 'delete'),
			permissionOption('Schedulers: Use', 'schedulers', 'use'),
			permissionOption('Schedulers: Create', 'schedulers', 'create'),
			permissionOption('Schedulers: Edit', 'schedulers', 'edit'),
			permissionOption('Schedulers: Delete', 'schedulers', 'delete'),
			permissionOption('Databases: Use', 'platform_storage', 'use'),
			permissionOption('Databases: Create', 'platform_storage', 'create'),
			permissionOption('Databases: Edit', 'platform_storage', 'edit'),
			permissionOption('Databases: Delete', 'platform_storage', 'delete'),
			permissionOption('Widgets: Use', 'applets', 'use'),
			permissionOption('Widgets: Create', 'applets', 'create'),
			permissionOption('Widgets: Edit', 'applets', 'edit'),
			permissionOption('Widgets: Delete', 'applets', 'delete'),
		],
	},
	{
		name: 'configIntegrationsPermissions',
		section: 'configuration',
		displayName: 'Integrations',
		description: 'Configuration: Integrations permissions',
		options: [
			permissionOption('Extensions: Use', 'applications', 'use'),
			permissionOption('Extensions: Create', 'applications', 'create'),
			permissionOption('Extensions: Edit', 'applications', 'edit'),
			permissionOption('Extensions: Install', 'applications', 'install'),
			permissionOption('Extensions: Delete', 'applications', 'delete'),
		],
	},
	{
		name: 'configLiveMediaPermissions',
		section: 'configuration',
		displayName: 'Live Media',
		description: 'Configuration: Audio and video meeting permissions',
		options: [
			permissionOption('Audio Calls: Start', 'audio_call', 'start'),
			permissionOption('Audio Calls: Download Recording', 'audio_call', 'download_recordings'),
			permissionOption('Audio Calls: Forward Recordings', 'audio_call', 'forward_recordings'),
			permissionOption('Audio Meetings: Start', 'group_audio_call', 'start'),
			permissionOption(
				'Audio Meetings: Download Recording',
				'group_audio_call',
				'download_recordings',
			),
			permissionOption(
				'Audio Meetings: Forward Recordings',
				'group_audio_call',
				'forward_recordings',
			),
			permissionOption('Video Meetings: Start', 'group_video_call', 'start'),
			permissionOption(
				'Video Meetings: Download Recording',
				'group_video_call',
				'download_recordings',
			),
			permissionOption(
				'Video Meetings: Forward Recordings',
				'group_video_call',
				'forward_recordings',
			),
			permissionOption('Video Calls: Start', 'video_call', 'start'),
			permissionOption('Video Calls: Download Recording', 'video_call', 'download_recordings'),
			permissionOption('Video Calls: Forward Recordings', 'video_call', 'forward_recordings'),
			permissionOption('Screen Sharing: Start', 'screen_sharing', 'start'),
			permissionOption('Presentation: Start', 'presentation', 'start'),
			permissionOption('Whiteboard in Calls: Start', 'whiteboard_in_calls', 'start'),
		],
	},
	{
		name: 'configRemoteWorkPermissions',
		section: 'configuration',
		displayName: 'Remote Work',
		description: 'Configuration: Remote work permissions',
		options: [
			permissionOption('Check In/Out: Allow', 'checkins', 'allow'),
			permissionOption('Live Feed: Allow', 'live_feed', 'allow'),
		],
	},
	{
		name: 'configMessagingPermissions',
		section: 'configuration',
		displayName: 'Messaging',
		description: 'Configuration: Messaging permissions',
		options: [
			permissionOption('Email Visibility: Allow', 'email_visibility', 'allow'),
			permissionOption('Signature Chat: Use', 'signature_chat', 'use'),
			permissionOption('Signature Chat: Create', 'signature_chat', 'create'),
			permissionOption('Custom Emojis: Use', 'custom_emojis', 'use'),
			permissionOption('Custom Emojis: Create', 'custom_emojis', 'create'),
			permissionOption('Custom Emojis: Delete', 'custom_emojis', 'delete'),
			permissionOption('Custom Emojis: Publish', 'custom_emojis', 'publish_to_org'),
			permissionOption('Custom Stickers: Use', 'stickers', 'use'),
			permissionOption('Custom Stickers: Create', 'stickers', 'create'),
			permissionOption('Custom Stickers: Delete', 'stickers', 'delete'),
			permissionOption('Custom Stickers: Publish', 'stickers', 'publish_to_org'),
		],
	},
	{
		name: 'configCliqAppsPermissions',
		section: 'configuration',
		displayName: 'Cliq Apps',
		description: 'Configuration: Client app access permissions',
		options: [
			permissionOption('Web Browsers: Access', 'web_app', 'access'),
			permissionOption('Android Devices: Access', 'android_app', 'access'),
			permissionOption('iOS Devices: Access', 'ios_app', 'access'),
			permissionOption('Desktop Applications: Access', 'desktop_app', 'access'),
		],
	},
	{
		name: 'mobileDataSecurityPermissions',
		section: 'mobile',
		displayName: 'Mobile Data Security',
		description: 'Mobile: Data security permissions',
		options: [
			permissionOption('Copy Message: Allow', 'mobile_data_protection', 'copy_data'),
			permissionOption('Download File: Allow', 'mobile_data_protection', 'file_download'),
			permissionOption('Share File: Allow', 'mobile_data_protection', 'screen_share'),
			permissionOption('Capture Screenshot: Allow', 'mobile_data_protection', 'screen_shot'),
			permissionOption('Passcode Enforcement: Allow', 'mobile_privacy', 'enforce_passcode'),
		],
	},
	{
		name: 'mobileMediaAndFileRestrictionPermissions',
		section: 'mobile',
		displayName: 'Mobile Media and File Restriction',
		description: 'Mobile: Media and file restriction permissions',
		options: [
			permissionOption(
				'Storage Access (gallery and files): Allow',
				'mobile_share_restriction',
				'storage_access',
			),
			permissionOption('Voice Message: Allow', 'mobile_share_restriction', 'voice_message'),
		],
	},
	{
		name: 'mobileDeviceRestrictionPermissions',
		section: 'mobile',
		displayName: 'Mobile Device Restriction',
		description: 'Mobile: Device restriction permissions',
		options: [
			permissionOption(
				'Access in unmanaged devices: Allow',
				'mobile_device_restriction',
				'access_unmanaged_device',
			),
			permissionOption(
				'Access in jailbroken/rooted devices: Allow',
				'mobile_device_restriction',
				'block_users_in_jail_broken_device',
			),
		],
	},
];

export function isSupportedPermissionOptionValue(optionValue: string): boolean {
	const parts = optionValue.split(optionValueDelimiter);
	if (parts.length !== 2) {
		return false;
	}

	const [module, action] = parts;
	if (!module || !action) {
		return false;
	}

	if (UNSUPPORTED_PERMISSION_MODULES.has(module)) {
		return false;
	}

	if (READ_ONLY_PERMISSION_ACTIONS.has(action)) {
		return false;
	}

	return true;
}

export const permissionGroupDefinitions: PermissionGroupDefinition[] =
	permissionGroupDefinitionsRaw.map((group) => ({
		...group,
		options: group.options.filter((option) => isSupportedPermissionOptionValue(option.value)),
	}));

export const toPermissionGroupProperty = (group: PermissionGroupDefinition): INodeProperties => ({
	displayName: group.displayName,
	name: group.name,
	type: 'multiOptions',
	default: [],
	description: group.description,
	options: group.options,
});

function getPermissionGroupSection(group: PermissionGroupDefinition): PermissionGroupSection {
	const section = (group as Partial<PermissionGroupDefinition>).section;
	if (section === 'admin' || section === 'configuration' || section === 'mobile') {
		return section;
	}

	throw new Error(`Unknown permission group section for "${group.name}"`);
}

export function getPermissionGroupsBySection(
	section: PermissionGroupSection,
): PermissionGroupDefinition[] {
	return permissionGroupDefinitions.filter((group) => getPermissionGroupSection(group) === section);
}

export function summarizePermissionList(
	list: IDataObject[],
): Array<{ module: string; action: string; status: string }> {
	return list.map((entry) => ({
		module: String(entry.module ?? '').trim(),
		action: String(entry.action ?? '').trim(),
		status: String(entry.status ?? '').trim(),
	}));
}

export function collectSelectedPermissions(
	context: IExecuteFunctions,
	itemIndex: number,
	status: 'enabled' | 'disabled',
): IDataObject[] {
	const selectedPermissions = new Set<string>();
	for (const groupDefinition of permissionGroupDefinitions) {
		const selectedGroupPermissions = context.getNodeParameter(
			groupDefinition.name,
			itemIndex,
			[],
		) as string[];

		for (const selectedPermission of selectedGroupPermissions) {
			selectedPermissions.add(String(selectedPermission));
		}
	}

	const list: IDataObject[] = [];
	for (const selectedPermission of selectedPermissions) {
		const [module, action, extra] = selectedPermission.split(optionValueDelimiter);
		if (extra !== undefined) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid structured permission selection "${selectedPermission}"`,
				{ itemIndex },
			);
		}
		if (!module) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid structured permission selection "${selectedPermission}"`,
				{ itemIndex },
			);
		}
		if (!action) {
			throw new NodeOperationError(
				context.getNode(),
				`Invalid structured permission selection "${selectedPermission}"`,
				{ itemIndex },
			);
		}

		if (!isSupportedPermissionOptionValue(`${module}${optionValueDelimiter}${action}`)) {
			continue;
		}

		list.push({
			module,
			action,
			status,
		});
	}

	return list;
}

const configTemplateByModule: Record<string, PermissionConfigTemplate[]> = {
	direct_message: [{ configName: 'profile_based_restricted_reply_time_frame', configValue: '' }],
	organisation_member: [{ configName: 'custom_rule', configValue: { enabled: [], disabled: [] } }],
};

function cloneValue<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function isMeaningfulValue(value: unknown): boolean {
	if (value === null || value === undefined) {
		return false;
	}

	if (typeof value === 'string') {
		return value.trim().length > 0;
	}

	if (typeof value === 'number' || typeof value === 'boolean') {
		return true;
	}

	if (Array.isArray(value)) {
		return value.some((entry) => isMeaningfulValue(entry));
	}

	if (typeof value === 'object') {
		return Object.values(value as IDataObject).some((entry) => isMeaningfulValue(entry));
	}

	return false;
}

function extractMeaningfulConfigs(configs: unknown): IDataObject[] | undefined {
	if (!Array.isArray(configs)) {
		return undefined;
	}

	const meaningfulConfigs: IDataObject[] = [];
	for (const config of configs) {
		if (!config || typeof config !== 'object' || Array.isArray(config)) {
			continue;
		}

		const typedConfig = config as IDataObject;
		const configName = String(typedConfig.name ?? '').trim();
		if (!configName) {
			continue;
		}

		if (!isMeaningfulValue(typedConfig.value)) {
			continue;
		}

		meaningfulConfigs.push({
			name: configName,
			value: cloneValue(typedConfig.value),
		});
	}

	return meaningfulConfigs.length > 0 ? meaningfulConfigs : undefined;
}

export function buildPermissionsTemplateList(): IDataObject[] {
	const moduleActions = new Map<string, string[]>();

	for (const groupDefinition of permissionGroupDefinitions) {
		for (const option of groupDefinition.options) {
			const [module, action, extra] = option.value.split(optionValueDelimiter);
			if (extra !== undefined || !module || !action) {
				continue;
			}

			if (!moduleActions.has(module)) {
				moduleActions.set(module, []);
			}

			const actions = moduleActions.get(module)!;
			if (!actions.includes(action)) {
				actions.push(action);
			}
		}
	}

	for (const module of Object.keys(configTemplateByModule)) {
		if (!moduleActions.has(module)) {
			moduleActions.set(module, []);
		}
	}

	const list: IDataObject[] = [];
	for (const [module, actions] of moduleActions.entries()) {
		list.push({
			module,
			status: '',
		});

		for (const action of actions) {
			list.push({
				module,
				action,
				status: '',
			});
		}

		const moduleConfigs = configTemplateByModule[module];
		if (moduleConfigs) {
			list.push({
				module,
				status: '',
				configs: moduleConfigs.map((config) => ({
					name: config.configName,
					value: cloneValue(config.configValue),
				})),
			});
		}
	}

	return list;
}

export const defaultPermissionsTemplatePayload = JSON.stringify(
	{ list: buildPermissionsTemplateList() },
	null,
	2,
);

export function buildIntentListFromTemplate(
	context: IExecuteFunctions,
	itemIndex: number,
	rawList: unknown,
	intentStatus: 'enabled' | 'disabled',
): IDataObject[] {
	if (!Array.isArray(rawList) || rawList.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'Permissions Template (JSON) must include a non-empty "list" array',
			{
				itemIndex,
			},
		);
	}

	const list: IDataObject[] = [];
	for (let idx = 0; idx < rawList.length; idx++) {
		const entry = rawList[idx];
		const entryPath = `Permissions Template (JSON).list[${idx}]`;
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			throw new NodeOperationError(context.getNode(), `${entryPath} must be an object`, {
				itemIndex,
			});
		}

		const typedEntry = entry as IDataObject;
		const module = String(typedEntry.module ?? '').trim();
		const action = String(typedEntry.action ?? '').trim();
		const statusMarker = String(typedEntry.status ?? '').trim();
		const meaningfulConfigs = extractMeaningfulConfigs(typedEntry.configs);
		const shouldInclude = statusMarker.length > 0 || meaningfulConfigs !== undefined;

		if (!shouldInclude) {
			continue;
		}

		if (!module) {
			throw new NodeOperationError(context.getNode(), `${entryPath}.module is required`, {
				itemIndex,
			});
		}

		const normalizedEntry: IDataObject = {
			module,
			status: intentStatus,
		};

		if (action) {
			normalizedEntry.action = action;
		}

		if (meaningfulConfigs) {
			normalizedEntry.configs = meaningfulConfigs;
		}

		list.push(normalizedEntry);
	}

	return list;
}

export function buildFilteredTemplateList(
	context: IExecuteFunctions,
	itemIndex: number,
	rawList: unknown,
): IDataObject[] {
	if (!Array.isArray(rawList) || rawList.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'Permissions Template (JSON) must include a non-empty "list" array',
			{
				itemIndex,
			},
		);
	}

	const list: IDataObject[] = [];
	for (let idx = 0; idx < rawList.length; idx++) {
		const entry = rawList[idx];
		const entryPath = `Permissions Template (JSON).list[${idx}]`;
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
			throw new NodeOperationError(context.getNode(), `${entryPath} must be an object`, {
				itemIndex,
			});
		}

		const typedEntry = entry as IDataObject;
		const module = String(typedEntry.module ?? '').trim();
		const action = String(typedEntry.action ?? '').trim();
		const status = String(typedEntry.status ?? '').trim();
		const meaningfulConfigs = extractMeaningfulConfigs(typedEntry.configs);
		const shouldInclude = status.length > 0 || meaningfulConfigs !== undefined;

		if (!shouldInclude) {
			continue;
		}

		if (!module) {
			throw new NodeOperationError(context.getNode(), `${entryPath}.module is required`, {
				itemIndex,
			});
		}

		if (status && status !== 'enabled' && status !== 'disabled') {
			throw new NodeOperationError(
				context.getNode(),
				`${entryPath}.status must be either "enabled" or "disabled" when provided`,
				{
					itemIndex,
				},
			);
		}

		const normalizedEntry: IDataObject = { module };
		if (action) {
			normalizedEntry.action = action;
		}
		if (status) {
			normalizedEntry.status = status;
		}
		if (meaningfulConfigs) {
			normalizedEntry.configs = meaningfulConfigs;
		}

		list.push(normalizedEntry);
	}

	return list;
}
