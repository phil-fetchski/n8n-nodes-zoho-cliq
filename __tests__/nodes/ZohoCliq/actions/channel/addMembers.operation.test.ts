/**
 * Tests for Add Members to Channel Operation
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/addMembers.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('Add Members to Channel Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];
	const mockScopes = 'ZohoCliq.Channels.UPDATE';

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		(utils.checkRequiredScope as jest.Mock).mockImplementation(() => {});
		(utils.validateChannelId as jest.Mock).mockImplementation((_, id) => id.trim());
		(utils.validateChannelName as jest.Mock).mockImplementation((_, name) => name.trim());
		(utils.parseEmailList as jest.Mock).mockImplementation((_, emails) =>
			emails.split(',').map((e: string) => e.trim()),
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ success: true });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should add members to channel', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user1@example.com,user2@example.com');

		const result = await execute.call(
			mockExecuteFunctions,
			mockItems,
			`${mockScopes},ZohoCliq.Channels.READ`,
		);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/C123/members',
			{ email_ids: ['user1@example.com', 'user2@example.com'] },
		);
		expect(result).toHaveLength(1);
	});

	it('should add user IDs to channel', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('12345,67890');

		(utils.validateUserIdArray as jest.Mock).mockReturnValue(['12345', '67890']);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/C123/members',
			{ user_ids: ['12345', '67890'] },
		);
	});

	it('should resolve a unique-name locator through shared preflight before adding members', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'memberIdentifiers') return 'user1@example.com,user2@example.com';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		(transport.zohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({ data: { id: 'C123' } })
			.mockResolvedValueOnce({ success: true });

		const result = await execute.call(
			mockExecuteFunctions,
			mockItems,
			`${mockScopes},ZohoCliq.Channels.READ`,
		);

		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/channels/engineering-updates/members',
			{ email_ids: ['user1@example.com', 'user2@example.com'] },
		);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_unique_name: 'engineering-updates',
			channel_id: 'C123',
			added_count: 2,
		});
	});

	it('should return a recoverable payload with channel_unique_name when name lookup preflight is skipped', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'memberIdentifiers') return 'user@example.com';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
			statusCode: 500,
			message: 'Server exploded',
		});

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/engineering-updates/members',
			{ email_ids: ['user@example.com'] },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'addMembers',
				channel_unique_name: 'engineering-updates',
				status_code: 500,
			}),
		);
	});

	it('should return success output with only channel_unique_name when name-mode addMembers does not resolve a channel ID', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'memberIdentifiers') return 'user@example.com';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValueOnce({ success: true });

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/engineering-updates/members',
			{ email_ids: ['user@example.com'] },
		);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_unique_name: 'engineering-updates',
			added_count: 1,
		});
		expect(result[0].json).not.toHaveProperty('channel_id');
	});

	it('should check required scope', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@example.com');

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(utils.checkRequiredScope).toHaveBeenCalledWith(
			mockExecuteFunctions,
			mockScopes,
			'ZohoCliq.Channels.UPDATE',
			0,
		);
	});

	it('should throw error when email list is empty after parsing', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@example.com');
		(utils.parseEmailList as jest.Mock).mockReturnValue([]);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error when adding more than 100 members', async () => {
		const manyEmails = Array(101)
			.fill(0)
			.map((_, i) => `user${i}@example.com`);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@example.com');
		(utils.parseEmailList as jest.Mock).mockReturnValue(manyEmails);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it.each([
		['', 'Member identifiers are required'],
		['   ', 'Member identifiers are required'],
		[' , , ', 'At least one member identifier is required'],
	])(
		'should throw validation error for invalid identifier input: %p',
		async (identifierInput, expectedMessage) => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('C123')
				.mockReturnValueOnce(identifierInput);

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				expectedMessage,
			);
		},
	);

	it('should throw error when parsed user ID list is empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('id_1,id_2');
		(utils.validateUserIdArray as jest.Mock).mockReturnValue([]);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'At least one user ID is required',
		);
	});

	it('should throw error when identifier types are mixed', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@example.com,12345');

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Mixed identifier types are not supported',
		);
	});
});
