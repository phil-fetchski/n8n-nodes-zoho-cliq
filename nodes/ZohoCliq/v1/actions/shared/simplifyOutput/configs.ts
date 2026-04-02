/**
 * Response shape configurations for the Simplify Output system.
 * Each config defines which fields to keep in simplified mode,
 * how to flatten nested objects, and what fields are selectable.
 */

import type { ISimplifyConfig } from './types';

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

const user: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: [
		'id',
		'email_id',
		'display_name',
		'first_name',
		'last_name',
		'status',
		'timezone',
		'country',
	],
	flattenMap: {
		'department.name': 'department_name',
		'designation.name': 'designation_name',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Email', value: 'email_id' },
		{ name: 'Display Name', value: 'display_name' },
		{ name: 'First Name', value: 'first_name' },
		{ name: 'Last Name', value: 'last_name' },
		{ name: 'Full Name', value: 'full_name' },
		{ name: 'Name', value: 'name' },
		{ name: 'Nick Name', value: 'nick_name' },
		{ name: 'Employee ID', value: 'employee_id' },
		{ name: 'Status', value: 'status' },
		{ name: 'Org Status', value: 'user_org_status' },
		{ name: 'Department', value: 'department' },
		{ name: 'Designation', value: 'designation' },
		{ name: 'Reporting To', value: 'reportingto' },
		{ name: 'Profile', value: 'profile' },
		{ name: 'Timezone', value: 'timezone' },
		{ name: 'Country', value: 'country' },
		{ name: 'Language', value: 'language' },
		{ name: 'Language Variant', value: 'language_variant' },
		{ name: 'Mobile', value: 'mobile' },
		{ name: 'Phone', value: 'phone' },
		{ name: 'Extension', value: 'extension' },
		{ name: 'Work Location', value: 'work_location' },
		{ name: 'User Type', value: 'user_type' },
		{ name: 'ZOID', value: 'zoid' },
		{ name: 'Organization ID', value: 'organization_id' },
		{ name: 'ZUID', value: 'zuid' },
		{ name: 'IAM UID', value: 'iamuid' },
		{ name: 'Time Offset', value: 'timeoffset' },
		{ name: 'Invited Time', value: 'invited_time' },
		{ name: 'Custom Attributes', value: 'custom_attributes' },
	],
};

// ---------------------------------------------------------------------------
// User Team
// ---------------------------------------------------------------------------

const userTeam: ISimplifyConfig = {
	idKey: 'team_id',
	simplifiedKeys: [
		'team_id',
		'name',
		'description',
		'is_active',
		'is_moderator',
		'joined',
		'participant_count',
		'creation_time',
	],
	selectableFields: [
		{ name: 'Team ID', value: 'team_id' },
		{ name: 'Name', value: 'name' },
		{ name: 'Description', value: 'description' },
		{ name: 'Creation Time', value: 'creation_time' },
		{ name: 'Organization ID', value: 'organization_id' },
		{ name: 'Is Active', value: 'is_active' },
		{ name: 'Is Moderator', value: 'is_moderator' },
		{ name: 'Joined', value: 'joined' },
		{ name: 'Participant Count', value: 'participant_count' },
	],
};

// ---------------------------------------------------------------------------
// User Field (single: userFields/create, get, update)
// ---------------------------------------------------------------------------

const userField: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: [
		'id',
		'unique_name',
		'name',
		'type',
		'label',
		'mandatory',
		'enabled',
		'system_defined',
		'creation_time',
		'last_modified_time',
	],
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Unique Name', value: 'unique_name' },
		{ name: 'Name', value: 'name' },
		{ name: 'Type', value: 'type' },
		{ name: 'Label', value: 'label' },
		{ name: 'Mandatory', value: 'mandatory' },
		{ name: 'Enabled', value: 'enabled' },
		{ name: 'System Defined', value: 'system_defined' },
		{ name: 'Is Searchable', value: 'is_searchable' },
		{ name: 'Encrypted', value: 'encrypted' },
		{ name: 'Edit Permission', value: 'edit_permission' },
		{ name: 'Creation Time', value: 'creation_time' },
		{ name: 'Last Modified Time', value: 'last_modified_time' },
		{ name: 'Organization ID', value: 'organization_id' },
		{ name: 'Default Value', value: 'default_value' },
		{ name: 'Options', value: 'options' },
	],
};

// userFieldListItem shares the same field set as userField
const userFieldListItem: ISimplifyConfig = { ...userField };

// ---------------------------------------------------------------------------
// Department (single: department/create, get, update)
// ---------------------------------------------------------------------------

const department: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: ['id', 'name', 'parent_department_id', 'is_default', 'members_count'],
	flattenMap: {
		'lead.id': 'lead_id',
		'lead.name': 'lead_name',
		'lead.email_id': 'lead_email',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Name', value: 'name' },
		{ name: 'Parent Department ID', value: 'parent_department_id' },
		{ name: 'Lead ZUID', value: 'lead_zuid' },
		{ name: 'Is Default', value: 'is_default' },
		{ name: 'Members Count', value: 'members_count' },
		{ name: 'Lead', value: 'lead' },
	],
};

// departmentListItem shares the same config as department
const departmentListItem: ISimplifyConfig = { ...department };

// ---------------------------------------------------------------------------
// Remote Work Status
// ---------------------------------------------------------------------------

const remoteWorkStatus: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: [
		'id',
		'display_name',
		'email_id',
		'checkin_status',
		'checkin_time',
		'checkin_status_text',
		'duration',
	],
	flattenMap: {
		'department.name': 'department_name',
		'designation.name': 'designation_name',
		'status.message': 'status_message',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Display Name', value: 'display_name' },
		{ name: 'Email', value: 'email_id' },
		{ name: 'First Name', value: 'first_name' },
		{ name: 'Last Name', value: 'last_name' },
		{ name: 'Full Name', value: 'full_name' },
		{ name: 'Name', value: 'name' },
		{ name: 'Employee ID', value: 'employee_id' },
		{ name: 'Check-In Status', value: 'checkin_status' },
		{ name: 'Check-In Time', value: 'checkin_time' },
		{ name: 'Check-In Status Text', value: 'checkin_status_text' },
		{ name: 'Check-In Allowed', value: 'checkin_allowed' },
		{ name: 'Duration', value: 'duration' },
		{ name: 'Location', value: 'location' },
		{ name: 'Live Feed Status', value: 'live_feed_status' },
		{ name: 'Status', value: 'status' },
		{ name: 'Department', value: 'department' },
		{ name: 'Designation', value: 'designation' },
		{ name: 'Reporting To', value: 'reportingto' },
		{ name: 'Recent Departments', value: 'recent_departments' },
		{ name: 'Timezone', value: 'timezone' },
		{ name: 'Country', value: 'country' },
		{ name: 'Language', value: 'language' },
		{ name: 'Mobile', value: 'mobile' },
		{ name: 'ZOID', value: 'zoid' },
		{ name: 'Organization ID', value: 'organization_id' },
		{ name: 'Image URL', value: 'image_url' },
		{ name: 'Work Location', value: 'work_location' },
		{ name: 'Type', value: 'type' },
		{ name: 'Time Offset', value: 'timeoffset' },
		{ name: 'ZUID', value: 'zuid' },
		{ name: 'IAM UID', value: 'iamuid' },
		{ name: 'Org Members Count', value: 'organisation_members_count' },
	],
};

// ---------------------------------------------------------------------------
// Remote Work Check In/Out
// ---------------------------------------------------------------------------

const remoteWorkCheck: ISimplifyConfig = {
	idKey: 'checkin_status',
	simplifiedKeys: [
		'checkin_status',
		'checkin_time',
		'checkin_status_text',
		'checkin_allowed',
		'duration',
		'location',
		'live_feed_status',
	],
	selectableFields: [
		{ name: 'Check-In Status', value: 'checkin_status' },
		{ name: 'Check-In Time', value: 'checkin_time' },
		{ name: 'Check-In Status Text', value: 'checkin_status_text' },
		{ name: 'Check-In Allowed', value: 'checkin_allowed' },
		{ name: 'Duration', value: 'duration' },
		{ name: 'Location', value: 'location' },
		{ name: 'Live Feed Status', value: 'live_feed_status' },
		{ name: 'User Status Preference', value: 'user_status_preference' },
	],
};

// ---------------------------------------------------------------------------
// Chat List Item
// ---------------------------------------------------------------------------

const chatListItem: ISimplifyConfig = {
	idKey: 'chat_id',
	simplifiedKeys: [
		'chat_id',
		'name',
		'chat_type',
		'participant_count',
		'creation_time',
		'last_modified_time',
		'creator_id',
		'pinned',
		'removed',
	],
	flattenMap: {
		'last_message_info.text': 'last_message_text',
	},
	selectableFields: [
		{ name: 'Chat ID', value: 'chat_id' },
		{ name: 'Name', value: 'name' },
		{ name: 'Chat Type', value: 'chat_type' },
		{ name: 'Participant Count', value: 'participant_count' },
		{ name: 'Creation Time', value: 'creation_time' },
		{ name: 'Last Modified Time', value: 'last_modified_time' },
		{ name: 'Creator ID', value: 'creator_id' },
		{ name: 'Pinned', value: 'pinned' },
		{ name: 'Removed', value: 'removed' },
		{ name: 'Recipients Summary', value: 'recipients_summary' },
		{ name: 'Last Message Info', value: 'last_message_info' },
	],
};

// ---------------------------------------------------------------------------
// Channel (single: channel/create, get, update, changePermission, join)
// ---------------------------------------------------------------------------

const channel: ISimplifyConfig = {
	idKey: 'channel_id',
	simplifiedKeys: [
		'channel_id',
		'name',
		'unique_name',
		'description',
		'level',
		'status',
		'participant_count',
		'creation_time',
		'creator_name',
		'current_user_role',
	],
	selectableFields: [
		{ name: 'Channel ID', value: 'channel_id' },
		{ name: 'Name', value: 'name' },
		{ name: 'Unique Name', value: 'unique_name' },
		{ name: 'Description', value: 'description' },
		{ name: 'Level', value: 'level' },
		{ name: 'Status', value: 'status' },
		{ name: 'Participant Count', value: 'participant_count' },
		{ name: 'Creation Time', value: 'creation_time' },
		{ name: 'Last Modified Time', value: 'last_modified_time' },
		{ name: 'Creator ID', value: 'creator_id' },
		{ name: 'Creator Name', value: 'creator_name' },
		{ name: 'Current User Role', value: 'current_user_role' },
		{ name: 'Organization ID', value: 'organization_id' },
		{ name: 'Invite Only', value: 'invite_only' },
		{ name: 'Joined', value: 'joined' },
		{ name: 'Pinned', value: 'pinned' },
		{ name: 'Chat ID', value: 'chat_id' },
		{ name: 'Image URL', value: 'image_url' },
		{ name: 'Total Message Count', value: 'total_message_count' },
		{ name: 'Unread Message Count', value: 'unread_message_count' },
		{ name: 'Unread Time', value: 'unread_time' },
		{ name: 'Teams', value: 'teams' },
		{ name: 'Last Message Info', value: 'last_message_info' },
		{ name: 'Admin Permission', value: 'admin_permission' },
		{ name: 'Moderator Permission', value: 'moderator_permission' },
		{ name: 'Member Permission', value: 'member_permission' },
	],
};

// channelListItem shares the same config as channel
const channelListItem: ISimplifyConfig = { ...channel };

// ---------------------------------------------------------------------------
// Thread List Item
// ---------------------------------------------------------------------------

const threadListItem: ISimplifyConfig = {
	idKey: 'chat_id',
	simplifiedKeys: [
		'chat_id',
		'title',
		'thread_state',
		'thread_message_id',
		'parent_chat_id',
		'parent_message_sender',
		'is_follower',
		'follower_count',
	],
	flattenMap: {
		'last_message_information.text': 'last_message_text',
		'last_message_information.time': 'last_message_time',
	},
	selectableFields: [
		{ name: 'Chat ID', value: 'chat_id' },
		{ name: 'Title', value: 'title' },
		{ name: 'Thread State', value: 'thread_state' },
		{ name: 'Thread Message ID', value: 'thread_message_id' },
		{ name: 'Parent Chat ID', value: 'parent_chat_id' },
		{ name: 'Parent Message Sender', value: 'parent_message_sender' },
		{ name: 'Is Follower', value: 'is_follower' },
		{ name: 'Follower Count', value: 'follower_count' },
		{ name: 'Last Message Information', value: 'last_message_information' },
	],
};

// ---------------------------------------------------------------------------
// Thread Main Message
// ---------------------------------------------------------------------------

const threadMainMessage: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: ['id', 'time', 'type', 'is_read'],
	flattenMap: {
		'content.text': 'content_text',
		'sender.name': 'sender_name',
		'sender.id': 'sender_id',
		'thread_state_info.thread_state': 'thread_state',
		'thread_information.title': 'thread_title',
		'thread_information.message_count': 'thread_message_count',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Time', value: 'time' },
		{ name: 'Type', value: 'type' },
		{ name: 'Content', value: 'content' },
		{ name: 'Sender', value: 'sender' },
		{ name: 'Is Read', value: 'is_read' },
		{ name: 'Revision', value: 'revision' },
		{ name: 'Ack Key', value: 'ack_key' },
		{ name: 'Parent Resource ID', value: 'parent_resource_id' },
		{ name: 'Thread State Info', value: 'thread_state_info' },
		{ name: 'Thread Message', value: 'thread_message' },
		{ name: 'Thread Information', value: 'thread_information' },
	],
};

// ---------------------------------------------------------------------------
// Message List Item
// ---------------------------------------------------------------------------

const messageListItem: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: ['id', 'time', 'type'],
	flattenMap: {
		'sender.name': 'sender_name',
		'sender.id': 'sender_id',
		'content.text': 'content_text',
		'content.file.name': 'content_file_name',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Time', value: 'time' },
		{ name: 'Type', value: 'type' },
		{ name: 'Sender', value: 'sender' },
		{ name: 'Content', value: 'content' },
	],
};

// ---------------------------------------------------------------------------
// Scheduled Message
// ---------------------------------------------------------------------------

const scheduledMessage: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: ['id', 'time', 'time_string', 'creator', 'created_time', 'timezone'],
	flattenMap: {
		'message.msg': 'message_text',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Time', value: 'time' },
		{ name: 'Time String', value: 'time_string' },
		{ name: 'Creator', value: 'creator' },
		{ name: 'Created Time', value: 'created_time' },
		{ name: 'Timezone', value: 'timezone' },
		{ name: 'Message', value: 'message' },
	],
};

// ---------------------------------------------------------------------------
// Call/Meeting Item
// ---------------------------------------------------------------------------

const callMeetingItem: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: [
		'id',
		'session_id',
		'type',
		'title',
		'scope',
		'start_time',
		'end_time',
		'participant_count',
		'recording',
	],
	flattenMap: {
		'host.name': 'host_name',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Session ID', value: 'session_id' },
		{ name: 'Type', value: 'type' },
		{ name: 'Title', value: 'title' },
		{ name: 'Scope', value: 'scope' },
		{ name: 'Start Time', value: 'start_time' },
		{ name: 'End Time', value: 'end_time' },
		{ name: 'Host', value: 'host' },
		{ name: 'Participant Count', value: 'participant_count' },
		{ name: 'Recording', value: 'recording' },
		{ name: 'Notes', value: 'notes' },
		{ name: 'Is Partial', value: 'is_partial' },
		{ name: 'NRS ID', value: 'nrs_id' },
		{ name: 'Chat ID', value: 'chat_id' },
		{ name: 'Chat', value: 'chat' },
	],
};

// ---------------------------------------------------------------------------
// Event Calendar
// ---------------------------------------------------------------------------

const eventCalendar: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: [
		'id',
		'name',
		'timezone',
		'isdefault',
		'category',
		'caltype',
		'status',
		'visibility',
		'color',
		'owner',
	],
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Name', value: 'name' },
		{ name: 'Timezone', value: 'timezone' },
		{ name: 'Is Default', value: 'isdefault' },
		{ name: 'Category', value: 'category' },
		{ name: 'Calendar Type', value: 'caltype' },
		{ name: 'Status', value: 'status' },
		{ name: 'Visibility', value: 'visibility' },
		{ name: 'Color', value: 'color' },
		{ name: 'Text Color', value: 'textcolor' },
		{ name: 'Description', value: 'description' },
		{ name: 'Privilege', value: 'privilege' },
		{ name: 'Type', value: 'type' },
		{ name: 'UID', value: 'uid' },
		{ name: 'Can Send Mail', value: 'canSendMail' },
		{ name: 'Modified Time', value: 'modifiedtime' },
		{ name: 'Calendar Modified Time', value: 'calendar_modifiedtime' },
		{ name: 'Order', value: 'order' },
		{ name: 'Last Modified Time', value: 'lastmodifiedtime' },
		{ name: 'Owner', value: 'owner' },
		{ name: 'Include in Free/Busy', value: 'include_infreebusy' },
		{ name: 'Created Time', value: 'createdtime' },
		{ name: 'Calendar Created Time', value: 'calendar_createdtime' },
		{ name: 'CTag', value: 'ctag' },
		{ name: 'Calendar Emptied Time', value: 'calemptiedtime' },
		{ name: 'Alarm', value: 'alarm' },
		{ name: 'Reminders', value: 'reminders' },
	],
};

// ---------------------------------------------------------------------------
// Event (events/get, events/list, events/create, events/update)
// ---------------------------------------------------------------------------

const event: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: ['id', 'title', 'type', 'start_time', 'end_time', 'timezone', 'isallday', 'role'],
	flattenMap: {
		'organizer.name': 'organizer_name',
		'organizer.email': 'organizer_email',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Title', value: 'title' },
		{ name: 'Type', value: 'type' },
		{ name: 'Start Time', value: 'start_time' },
		{ name: 'End Time', value: 'end_time' },
		{ name: 'Start Date', value: 'start_date' },
		{ name: 'End Date', value: 'end_date' },
		{ name: 'Timezone', value: 'timezone' },
		{ name: 'Location', value: 'location' },
		{ name: 'Description', value: 'description' },
		{ name: 'Is All Day', value: 'isallday' },
		{ name: 'Is Status Break', value: 'is_status_break' },
		{ name: 'Entity ID', value: 'entity_id' },
		{ name: 'Is Big Chat Event', value: 'is_big_chat_event' },
		{ name: 'Entity Type', value: 'entity_type' },
		{ name: 'Creator', value: 'creator' },
		{ name: 'Attendees', value: 'attendees' },
		{ name: 'Edit Tag', value: 'edit_tag' },
		{ name: 'Calendar ID', value: 'calendar_id' },
		{ name: 'Organizer', value: 'organizer' },
		{ name: 'Role', value: 'role' },
		{ name: 'Meeting Link', value: 'meeting_link' },
		{ name: 'Meeting Details', value: 'meeting_details' },
		{ name: 'Recurrence ID', value: 'recurrence_id' },
		{ name: 'Recurrence Rule', value: 'recurrence_rule' },
		{ name: 'Chat ID', value: 'chat_id' },
	],
};

// ---------------------------------------------------------------------------
// Config registry
// ---------------------------------------------------------------------------

const SIMPLIFY_CONFIGS = {
	user,
	userTeam,
	userField,
	userFieldListItem,
	department,
	departmentListItem,
	remoteWorkStatus,
	remoteWorkCheck,
	chatListItem,
	channel,
	channelListItem,
	threadListItem,
	threadMainMessage,
	messageListItem,
	scheduledMessage,
	callMeetingItem,
	eventCalendar,
	event,
} as const;

export type SimplifyConfigKey = keyof typeof SIMPLIFY_CONFIGS;

export function getSimplifyConfig(key: SimplifyConfigKey): ISimplifyConfig {
	return SIMPLIFY_CONFIGS[key];
}
