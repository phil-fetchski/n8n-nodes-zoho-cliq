/**
 * Simplify Output tests for Channel operations:
 *   create, get, update, changePermission, list, join
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/channel/create.operation';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/channel/get.operation';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/channel/update.operation';
import * as changePermission from '../../../../../../nodes/ZohoCliq/v1/actions/channel/changePermission.operation';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/channel/list.operation';
import * as join from '../../../../../../nodes/ZohoCliq/v1/actions/channel/join.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_CHANNEL_RESPONSE = {
	channel_id: 'P1234567890123456789',
	name: '#Engineering',
	unique_name: 'engineering',
	description: 'Engineering team channel',
	level: 'private',
	status: 'created',
	participant_count: 12,
	creation_time: '2026-03-06T12:00:00-05:00',
	last_modified_time: '2026-03-06T12:15:00-05:00',
	creator_id: '123456789',
	creator_name: 'Example User',
	current_user_role: 'super_admin',
	organization_id: 'org_123',
	invite_only: false,
	joined: true,
	pinned: false,
	chat_id: 'CT_1234567890123456789_123456789',
	image_url: 'https://cliq.zoho.com/channel/photo.do',
	total_message_count: '48',
	unread_message_count: '0',
	unread_time: '0',
	teams: { '4435961': 'SALES' },
	last_message_info: { text: 'Hello' },
	admin_permission: { send_message: true, delete_channel: true },
	moderator_permission: { send_message: true, delete_channel: false },
	member_permission: { send_message: true, delete_channel: false },
};

const SIMPLIFIED_CHANNEL = {
	channel_id: 'P1234567890123456789',
	name: '#Engineering',
	unique_name: 'engineering',
	description: 'Engineering team channel',
	level: 'private',
	status: 'created',
	participant_count: 12,
	creation_time: '2026-03-06T12:00:00-05:00',
	creator_name: 'Example User',
	current_user_role: 'super_admin',
};

const MOCK_LIST_RESPONSE = {
	channels: [MOCK_CHANNEL_RESPONSE],
	has_more: true,
	next_token: 'next-page-token',
	sync_token: 'sync-token',
};

const items: INodeExecutionData[] = [{ json: {} }];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createGetContext(
	values: {
		channelId?: string;
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const {
		channelId = 'P1234567890123456789',
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
	} = values;
	return {
		getNodeParameter: jest.fn(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				if (name === 'simplify') return simplify;
				if (name === 'simplifyMode') return simplifyMode;
				if (name === 'simplifyFields') return simplifyFields;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			},
		),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createCreateContext(
	values: {
		channelName?: string;
		channelLevel?: string;
		configInputMode?: string;
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const {
		channelName = 'Engineering',
		channelLevel = 'private',
		configInputMode = 'none',
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
	} = values;
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'channelName') return channelName;
			if (name === 'channelLevel') return channelLevel;
			if (name === 'configInputMode') return configInputMode;
			if (name === 'additionalFields') return {};
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return false;
			return fallback;
		}),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createUpdateContext(
	values: {
		channelId?: string;
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const {
		channelId = 'P1234567890123456789',
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
	} = values;
	return {
		getNodeParameter: jest.fn(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				if (name === 'additionalFields') return { name: 'Updated Name' };
				if (name === 'updateFields') return { name: 'Updated Name' };
				if (name === 'additionalFields.configInputMode') return undefined;
				if (name === 'updateFields.configInputMode') return undefined;
				if (name === 'additionalFields.configJson') return undefined;
				if (name === 'updateFields.configJson') return undefined;
				if (name === 'simplify') return simplify;
				if (name === 'simplifyMode') return simplifyMode;
				if (name === 'simplifyFields') return simplifyFields;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			},
		),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createChangePermissionContext(
	values: {
		channelId?: string;
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const {
		channelId = 'P1234567890123456789',
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
	} = values;
	return {
		getNodeParameter: jest.fn(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				if (name === 'adminInputMode') return 'structured';
				if (name === 'adminPermission') return { send_message: false };
				if (name === 'adminPermissionJson') return fallback;
				if (name === 'moderatorInputMode') return 'structured';
				if (name === 'moderatorPermission') return {};
				if (name === 'moderatorPermissionJson') return fallback;
				if (name === 'memberInputMode') return 'structured';
				if (name === 'memberPermission') return {};
				if (name === 'memberPermissionJson') return fallback;
				if (name === 'simplify') return simplify;
				if (name === 'simplifyMode') return simplifyMode;
				if (name === 'simplifyFields') return simplifyFields;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			},
		),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createListContext(
	values: {
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const { simplify = false, simplifyMode = 'simplified', simplifyFields = [] } = values;
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'level') return '';
			if (name === 'status') return '';
			if (name === 'joined') return '';
			if (name === 'pinned') return false;
			if (name === 'additionalFields') return {};
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return false;
			return fallback;
		}),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

function createJoinContext(
	values: {
		channelId?: string;
		simplify?: unknown;
		simplifyMode?: unknown;
		simplifyFields?: unknown;
	} = {},
): IExecuteFunctions {
	const {
		channelId = 'P1234567890123456789',
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
	} = values;
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'channelId') return channelId;
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'enableAiErrorMode') return false;
			return fallback;
		}),
		continueOnFail: jest.fn(() => false),
		helpers: { constructExecutionMetaData: jest.fn((data) => data) },
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {},
		})),
	} as unknown as IExecuteFunctions;
}

// ---------------------------------------------------------------------------
// Description tests
// ---------------------------------------------------------------------------

describe('Channel Simplify — description parameters', () => {
	const simplifyParamNames = ['simplify', 'simplifyMode', 'simplifyFields'];

	it.each([
		['create', create.description],
		['get', get.description],
		['update', update.description],
		['changePermission', changePermission.description],
		['list', list.description],
		['join', join.description],
	])('%s should expose simplify, simplifyMode, simplifyFields', (_op, desc) => {
		const names = desc.map((d) => d.name);
		for (const param of simplifyParamNames) {
			expect(names).toContain(param);
		}
	});

	it('join should NOT have includeEnhancedOutput in its description', () => {
		const names = join.description.map((d) => d.name);
		expect(names).not.toContain('includeEnhancedOutput');
	});
});

// ---------------------------------------------------------------------------
// create.operation — Simplify
// ---------------------------------------------------------------------------

describe('Channel create — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(MOCK_CHANNEL_RESPONSE);
	});

	it('should return full response in raw mode (simplify=false)', async () => {
		const ctx = createCreateContext({ simplify: false });
		const result = await create.execute.call(ctx, items, SCOPES.CHANNELS_CREATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(MOCK_CHANNEL_RESPONSE);
	});

	it('should return only simplified keys when simplified mode is active', async () => {
		const ctx = createCreateContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await create.execute.call(ctx, items, SCOPES.CHANNELS_CREATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(SIMPLIFIED_CHANNEL);
	});

	it('should return channel_id + selected fields in selectedFields mode', async () => {
		const ctx = createCreateContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['name', 'level'],
		});
		const result = await create.execute.call(ctx, items, SCOPES.CHANNELS_CREATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			channel_id: 'P1234567890123456789',
			name: '#Engineering',
			level: 'private',
		});
	});
});

// ---------------------------------------------------------------------------
// get.operation — Simplify
// ---------------------------------------------------------------------------

describe('Channel get — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(MOCK_CHANNEL_RESPONSE);
	});

	it('should return full response in raw mode (simplify=false)', async () => {
		const ctx = createGetContext({ simplify: false });
		const result = await get.execute.call(ctx, items, SCOPES.CHANNELS_READ);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(MOCK_CHANNEL_RESPONSE);
	});

	it('should return only simplified keys when simplified mode is active', async () => {
		const ctx = createGetContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await get.execute.call(ctx, items, SCOPES.CHANNELS_READ);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(SIMPLIFIED_CHANNEL);
	});

	it('should return channel_id + selected fields in selectedFields mode', async () => {
		const ctx = createGetContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['name', 'status'],
		});
		const result = await get.execute.call(ctx, items, SCOPES.CHANNELS_READ);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			channel_id: 'P1234567890123456789',
			name: '#Engineering',
			status: 'created',
		});
	});
});

// ---------------------------------------------------------------------------
// update.operation — Simplify (prepends updated: true)
// ---------------------------------------------------------------------------

describe('Channel update — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(MOCK_CHANNEL_RESPONSE);
	});

	it('should return { updated: true, ...fullResponse } in raw mode', async () => {
		const ctx = createUpdateContext({ simplify: false });
		const result = await update.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ updated: true, ...MOCK_CHANNEL_RESPONSE });
	});

	it('should return { updated: true, ...simplifiedFields } in simplified mode', async () => {
		const ctx = createUpdateContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await update.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ updated: true, ...SIMPLIFIED_CHANNEL });
	});

	it('should return { updated: true, channel_id, ...selectedFields } in selectedFields mode', async () => {
		const ctx = createUpdateContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['name', 'level'],
		});
		const result = await update.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			updated: true,
			channel_id: 'P1234567890123456789',
			name: '#Engineering',
			level: 'private',
		});
	});
});

// ---------------------------------------------------------------------------
// changePermission.operation — Simplify (prepends success: true + channel context)
// ---------------------------------------------------------------------------

describe('Channel changePermission — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(MOCK_CHANNEL_RESPONSE);
	});

	it('should return { success: true, channel_id, ...fullResponse } in raw mode', async () => {
		const ctx = createChangePermissionContext({ simplify: false });
		const result = await changePermission.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		const json = result[0].json;
		expect(json.success).toBe(true);
		expect(json.channel_id).toBe('P1234567890123456789');
		// Full response keys are present
		expect(json.name).toBe(MOCK_CHANNEL_RESPONSE.name);
		expect(json.organization_id).toBe(MOCK_CHANNEL_RESPONSE.organization_id);
		expect(json.admin_permission).toEqual(MOCK_CHANNEL_RESPONSE.admin_permission);
	});

	it('should include only the requested permission keys in simplified mode', async () => {
		const ctx = createChangePermissionContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await changePermission.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		const json = result[0].json;
		expect(json.success).toBe(true);
		expect(json.channel_id).toBe('P1234567890123456789');
		expect(json.name).toBe(SIMPLIFIED_CHANNEL.name);
		expect(json.unique_name).toBe(SIMPLIFIED_CHANNEL.unique_name);
		// Only the admin_permission that was in the request body should appear
		// (the mock sets adminPermission = { send_message: false }, moderator/member = {})
		expect(json.admin_permission).toEqual({ send_message: false });
		// Empty permission objects should not be added
		expect(json).not.toHaveProperty('moderator_permission');
		expect(json).not.toHaveProperty('member_permission');
		// Non-simplified keys should be absent
		expect(json).not.toHaveProperty('organization_id');
	});

	it('should return { success: true, channel_id, ...selectedFields } in selectedFields mode', async () => {
		const ctx = createChangePermissionContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['name', 'level'],
		});
		const result = await changePermission.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: true,
			channel_id: 'P1234567890123456789',
			name: '#Engineering',
			level: 'private',
		});
	});
});

// ---------------------------------------------------------------------------
// list.operation — Simplify (list mode, channels array key)
// ---------------------------------------------------------------------------

describe('Channel list — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(MOCK_LIST_RESPONSE);
	});

	it('should return single item with full wrapper in raw mode', async () => {
		const ctx = createListContext({ simplify: false });
		const result = await list.execute.call(ctx, items, SCOPES.CHANNELS_READ);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(MOCK_LIST_RESPONSE);
	});

	it('should return _pagination item first, then individual simplified items', async () => {
		const ctx = createListContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await list.execute.call(ctx, items, SCOPES.CHANNELS_READ);
		expect(result).toHaveLength(2);
		expect(result[0].json).toEqual({
			_pagination: {
				has_more: true,
				next_token: 'next-page-token',
				sync_token: 'sync-token',
			},
		});
		expect(result[1].json).toEqual(SIMPLIFIED_CHANNEL);
	});

	it('should return _pagination + individual items with selected fields only', async () => {
		const ctx = createListContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['name', 'level'],
		});
		const result = await list.execute.call(ctx, items, SCOPES.CHANNELS_READ);
		expect(result).toHaveLength(2);
		expect(result[0].json).toEqual({
			_pagination: {
				has_more: true,
				next_token: 'next-page-token',
				sync_token: 'sync-token',
			},
		});
		expect(result[1].json).toEqual({
			channel_id: 'P1234567890123456789',
			name: '#Engineering',
			level: 'private',
		});
	});
});

// ---------------------------------------------------------------------------
// join.operation — Simplify (fold-in: always includes success/operation/channel_id)
// ---------------------------------------------------------------------------

describe('Channel join — Simplify', () => {
	beforeEach(() => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(MOCK_CHANNEL_RESPONSE);
	});

	it('should return { success, operation, channel_id, ...fullResponse } in raw mode', async () => {
		const ctx = createJoinContext({ simplify: false });
		const result = await join.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		const json = result[0].json;
		expect(json.success).toBe(true);
		expect(json.operation).toBe('join_channel');
		expect(json.channel_id).toBe('P1234567890123456789');
		// Full response keys are present
		expect(json.name).toBe(MOCK_CHANNEL_RESPONSE.name);
		expect(json.organization_id).toBe(MOCK_CHANNEL_RESPONSE.organization_id);
		expect(json.admin_permission).toEqual(MOCK_CHANNEL_RESPONSE.admin_permission);
	});

	it('should return metadata + simplified fields in simplified mode', async () => {
		const ctx = createJoinContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await join.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		const json = result[0].json;
		expect(json.success).toBe(true);
		expect(json.operation).toBe('join_channel');
		expect(json.channel_id).toBe('P1234567890123456789');
		expect(json.name).toBe(SIMPLIFIED_CHANNEL.name);
		expect(json.unique_name).toBe(SIMPLIFIED_CHANNEL.unique_name);
		// Non-simplified keys should be absent
		expect(json).not.toHaveProperty('organization_id');
		expect(json).not.toHaveProperty('admin_permission');
	});

	it('should return metadata + selected fields in selectedFields mode', async () => {
		const ctx = createJoinContext({
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['name', 'level'],
		});
		const result = await join.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: true,
			operation: 'join_channel',
			channel_id: 'P1234567890123456789',
			name: '#Engineering',
			level: 'private',
		});
	});

	it('should return metadata only when API returns empty response', async () => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue('');
		const ctx = createJoinContext({ simplify: true, simplifyMode: 'simplified' });
		const result = await join.execute.call(ctx, items, SCOPES.CHANNELS_UPDATE);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({
			success: true,
			operation: 'join_channel',
			channel_id: 'P1234567890123456789',
		});
	});
});
