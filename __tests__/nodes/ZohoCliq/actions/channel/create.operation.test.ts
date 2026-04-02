/**
 * Tests for Create Channel Operation
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/create.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

const TINY_GIF_BASE64 = 'R0lGODdhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=';

describe('Create Channel Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];
	const mockScopes = 'ZohoCliq.Channels.CREATE';

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		(utils.checkRequiredScope as jest.Mock).mockImplementation(() => {});
		(utils.parseEmailList as jest.Mock).mockImplementation((_, emails) =>
			emails.split(',').map((e: string) => e.trim()),
		);
		(utils.validateUserIdArray as jest.Mock).mockImplementation((_, userIds) =>
			String(userIds)
				.split(',')
				.map((id: string) => id.trim()),
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ channel_id: 'C123' });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	/**
	 * Helper to set up getNodeParameter mock for the new top-level parameter layout.
	 * Call order: channelName, channelLevel, configInputMode, additionalFields,
	 * then optionally config keys (structured) or configJson (raw).
	 */
	function mockParams(params: {
		channelName: string;
		channelLevel: string;
		configInputMode?: string;
		additionalFields?: IDataObject;
		configKeys?: Record<string, unknown>;
		configJson?: unknown;
	}): void {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelName') return params.channelName;
				if (name === 'channelLevel') return params.channelLevel;
				if (name === 'configInputMode') return params.configInputMode ?? 'none';
				if (name === 'additionalFields') return params.additionalFields ?? {};
				if (name === 'configJson') return params.configJson ?? fallback;
				if (name === 'simplify') return false;
				// Structured config keys
				if (params.configKeys && name in params.configKeys) {
					return params.configKeys[name];
				}
				return fallback;
			},
		);
	}

	it('should create channel with required fields', async () => {
		mockParams({ channelName: 'Test Channel', channelLevel: 'private' });

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Test Channel',
			level: 'private',
		});
		expect(result).toHaveLength(1);
	});

	it('should wrap array responses from create-channel under data', async () => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue([
			{ channel_id: 'C123', name: 'Test Channel' },
		] as unknown as IDataObject);
		mockParams({ channelName: 'Test Channel', channelLevel: 'private' });

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(result[0].json).toEqual({
			data: [{ channel_id: 'C123', name: 'Test Channel' }],
		});
	});

	it('should check required scope', async () => {
		mockParams({ channelName: 'Test', channelLevel: 'private' });

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(utils.checkRequiredScope).toHaveBeenCalledWith(
			mockExecuteFunctions,
			mockScopes,
			'ZohoCliq.Channels.CREATE',
			0,
		);
	});

	it('should throw error for empty channel name', async () => {
		mockParams({ channelName: '', channelLevel: 'private' });

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error for channel name exceeding 50 characters', async () => {
		mockParams({ channelName: 'a'.repeat(51), channelLevel: 'private' });

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error for invalid level', async () => {
		mockParams({
			channelName: 'Test',
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			channelLevel: 'invalid' as any,
		});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should include description when provided', async () => {
		mockParams({
			channelName: 'Test',
			channelLevel: 'private',
			additionalFields: { description: 'Test description' },
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Test',
			level: 'private',
			description: 'Test description',
		});
	});

	it('should throw error for description exceeding 10500 characters', async () => {
		mockParams({
			channelName: 'Test',
			channelLevel: 'private',
			additionalFields: { description: 'a'.repeat(10501) },
		});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should include invite_only when provided', async () => {
		mockParams({
			channelName: 'Test',
			channelLevel: 'organization',
			additionalFields: { invite_only: true },
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Test',
			level: 'organization',
			invite_only: true,
		});
	});

	it('should reject invite_only for private channels', async () => {
		mockParams({
			channelName: 'Test',
			channelLevel: 'private',
			additionalFields: { invite_only: true },
		});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Invite Only is supported only for organization and team level channels',
		);
	});

	it('should include email_ids when provided', async () => {
		mockParams({
			channelName: 'Test',
			channelLevel: 'private',
			additionalFields: { email_ids: 'user1@example.com,user2@example.com' },
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Test',
			level: 'private',
			email_ids: ['user1@example.com', 'user2@example.com'],
		});
	});

	it('should omit email_ids when parsed list is empty', async () => {
		mockParams({
			channelName: 'Test',
			channelLevel: 'private',
			additionalFields: { email_ids: 'user1@example.com' },
		});
		(utils.parseEmailList as jest.Mock).mockReturnValue([]);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Test',
			level: 'private',
		});
	});

	it('should include user_ids, team_ids, image_data, and structured config when provided', async () => {
		mockParams({
			channelName: 'Team Channel',
			channelLevel: 'team',
			configInputMode: 'structured',
			additionalFields: {
				user_ids: '100100,120001',
				team_ids: '2323334,2328533',
				image_data: TINY_GIF_BASE64,
			},
			configKeys: {
				reply_mode: 'both',
				leave_join_info: 'disable',
			},
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Team Channel',
			level: 'team',
			user_ids: ['100100', '120001'],
			team_ids: ['2323334', '2328533'],
			image_data: TINY_GIF_BASE64,
			config: {
				reply_mode: 'both',
				leave_join_info: 'disable',
			},
		});
	});

	it('should throw when level is team and team_ids are omitted', async () => {
		mockParams({ channelName: 'Team Channel', channelLevel: 'team' });

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Team IDs are required when level is set to team',
		);
	});

	it('should include both email_ids and user_ids when both are provided', async () => {
		mockParams({
			channelName: 'Team Channel',
			channelLevel: 'team',
			additionalFields: {
				email_ids: 'user1@example.com,user2@example.com',
				user_ids: '100100,120001',
				team_ids: '2323334',
			},
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Team Channel',
			level: 'team',
			email_ids: ['user1@example.com', 'user2@example.com'],
			user_ids: ['100100', '120001'],
			team_ids: ['2323334'],
		});
	});

	it('should include raw config when provided', async () => {
		mockParams({
			channelName: 'Team Channel',
			channelLevel: 'team',
			configInputMode: 'raw',
			additionalFields: { team_ids: '2323334' },
			configJson: '{"meeting_chat_type":"thread"}',
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Team Channel',
			level: 'team',
			team_ids: ['2323334'],
			config: {
				meeting_chat_type: 'thread',
			},
		});
	});

	it('should handle raw config as parsed object', async () => {
		mockParams({
			channelName: 'Team Channel',
			channelLevel: 'team',
			configInputMode: 'raw',
			additionalFields: { team_ids: '2323334' },
			configJson: { meeting_chat_type: 'thread' },
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Team Channel',
			level: 'team',
			team_ids: ['2323334'],
			config: {
				meeting_chat_type: 'thread',
			},
		});
	});

	it('should skip empty raw config object', async () => {
		mockParams({
			channelName: 'Team Channel',
			channelLevel: 'team',
			configInputMode: 'raw',
			additionalFields: { team_ids: '2323334' },
			configJson: {},
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Team Channel',
			level: 'team',
			team_ids: ['2323334'],
		});
	});

	it('should skip config when mode is none', async () => {
		mockParams({
			channelName: 'Private Skunkworks',
			channelLevel: 'private',
			configInputMode: 'none',
		});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/channels', {
			name: 'Private Skunkworks',
			level: 'private',
		});
	});

	it('should throw for invalid configInputMode', async () => {
		mockParams({
			channelName: 'Team Channel',
			channelLevel: 'team',
			configInputMode: 'bad-mode',
		});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Invalid configInputMode',
		);
	});

	it('should return recoverable config guidance for invalid raw config json', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		mockParams({
			channelName: 'Team Channel',
			channelLevel: 'team',
			configInputMode: 'raw',
			additionalFields: { team_ids: '2323334' },
			configJson: '{"reply_mode":',
		});

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'create',
				resource: 'channel',
				reason: 'INVALID_CONFIG_JSON',
			}),
		);
		expect(result[0].json.hint).toContain(
			'reply_mode, leave_join_info, add_remove_info, and meeting_chat_type',
		);
		expect(result[0].json.hint).toContain('{"reply_mode":"normal_reply"');
	});
});
