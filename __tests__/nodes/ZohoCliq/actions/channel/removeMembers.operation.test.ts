/**
 * Tests for Remove Members from Channel Operation
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/removeMembers.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('Remove Members from Channel Operation', () => {
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
		(utils.validateUserIdArray as jest.Mock).mockImplementation((_, userIds) =>
			userIds.split(',').map((id: string) => id.trim()),
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ success: true });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should remove members from channel', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user1@example.com,user2@example.com');

		const result = await execute.call(
			mockExecuteFunctions,
			mockItems,
			`${mockScopes},ZohoCliq.Channels.READ`,
		);

		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/channels/C123/members/user1%40example.com',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/channels/C123/members/user2%40example.com',
		);
		expect(result).toHaveLength(1);
	});

	it('should perform a normal single-identifier delete call', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@example.com');

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/channels/C123/members/user%40example.com',
		);
	});

	it('should resolve a unique-name locator through shared preflight before removing members', async () => {
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
		(transport.zohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({ result: { channel_id: 'C123' } })
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
			'DELETE',
			'/api/v2/channels/C123/members/user%40example.com',
		);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_id: 'C123',
			count: 1,
		});
	});

	it('should return a recoverable payload when neither lookup response produces a channel ID', async () => {
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
		(transport.zohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({
				result: { unique_name: 'engineering-updates' },
			})
			.mockResolvedValueOnce({
				data: { unique_name: 'engineering-updates' },
			});

		const result = await execute.call(
			mockExecuteFunctions,
			mockItems,
			`${mockScopes},ZohoCliq.Channels.READ`,
		);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'removeMembers',
				channel_unique_name: 'engineering-updates',
				message:
					'Channel lookup by unique name did not return a usable channel_id. Remove Members requires a valid channel ID for the delete endpoint.',
			}),
		);
	});

	it('should resolve a channel ID through direct by-name lookup when preflight is skipped', async () => {
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

		(transport.zohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({ result: { channel_id: 'C123' } })
			.mockResolvedValueOnce({ success: true });

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/channels/C123/members/user%40example.com',
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				channel_id: 'C123',
				count: 1,
			}),
		);
	});

	it('should throw a clear error when name-mode preflight is skipped because recoverable mode is disabled', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
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
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			},
		);

		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValueOnce({
			result: { unique_name: 'engineering-updates' },
		});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Channel lookup by unique name did not return a usable channel_id. Remove Members requires a valid channel ID for the delete endpoint.',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
	});

	it('should throw error when member identifiers are empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('   ');

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error when identifiers collapse to empty after splitting', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce(' , , ');

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'At least one member identifier is required',
		);
	});

	it('should process more than 100 members without hard cap validation', async () => {
		const manyEmails = Array(101)
			.fill(0)
			.map((_, i) => `user${i}@example.com`);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user0@example.com');
		(utils.parseEmailList as jest.Mock).mockReturnValue(manyEmails);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);
		expect(transport.zohoCliqApiRequest).toHaveBeenCalledTimes(101);
	});

	it('should remove members from channel by user IDs', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('123,456');
		(utils.validateUserIdArray as jest.Mock).mockReturnValue(['123', '456']);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/channels/C123/members/123',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/channels/C123/members/456',
		);
	});

	it('should throw error when parsed email list is empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@example.com');
		(utils.parseEmailList as jest.Mock).mockReturnValue([]);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'At least one email ID is required',
		);
	});

	it('should throw error when parsed user ID list is empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('123,456');
		(utils.validateUserIdArray as jest.Mock).mockReturnValue([]);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'At least one user ID is required',
		);
	});

	it('should treat identifiers containing @ as user IDs when they are not valid emails', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@id,456');
		(utils.validateUserIdArray as jest.Mock).mockReturnValue(['user@id', '456']);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(utils.parseEmailList).not.toHaveBeenCalled();
		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/channels/C123/members/user%40id',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/channels/C123/members/456',
		);
	});

	it('should throw error when identifiers contain mixed email IDs and user IDs', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user@example.com,123456');

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw with failing identifier context when one delete call fails', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce('user1@example.com,user2@example.com');
		(transport.zohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({ ok: true })
			.mockRejectedValueOnce(new Error('Request URL is invalid'));

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Failed to remove member identifier "user2@example.com" from channel "C123"',
		);
	});
});
