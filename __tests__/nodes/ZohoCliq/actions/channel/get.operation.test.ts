/**
 * Tests for Get Channel Operation
 * Verifies retrieving channel details by ID
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/get.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

// Mock dependencies
jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('Get Channel Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];
	const mockScopes = 'ZohoCliq.Channels.READ';

	beforeEach(() => {
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue(mockItems),
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data, meta) =>
					data.map((d: INodeExecutionData) => ({
						...d,
						pairedItem: meta.itemData,
					})),
				),
			},
		} as unknown as IExecuteFunctions;

		(utils.checkRequiredScope as jest.Mock).mockImplementation(() => {});
		(utils.validateChannelId as jest.Mock).mockImplementation((_, id) => id.trim());
		(utils.validateChannelName as jest.Mock).mockImplementation((_, name) => name.trim());

		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			channel_id: 'C123',
			name: 'Test Channel',
			unique_name: 'test-channel',
			description: 'A test channel',
			level: 'organization',
			status: 'active',
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Basic Functionality', () => {
		it('should get channel by ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('C123');

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/channels/C123');
			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('channel_id', 'C123');
		});

		it('should check required scope', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('C123');

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				mockScopes,
				'ZohoCliq.Channels.READ',
				0,
			);
		});

		it('should validate channel ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('  C123  ');

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.validateChannelId).toHaveBeenCalledWith(mockExecuteFunctions, 'C123', 0);
		});

		it('should URL encode channel ID', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('C-123_test');

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[1]).toBe('/api/v2/channels/C-123_test');
		});

		it('should reuse a validated shared preflight result when getting by unique name', async () => {
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
					if (name === 'enableAiErrorMode') return fallback;
					return fallback;
				},
			);
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValueOnce({
				channel_id: 'C123',
				unique_name: 'engineering-updates',
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/channelsbyname/engineering-updates',
			);
			expect(result[0].json).toMatchObject({
				channel_id: 'C123',
				unique_name: 'engineering-updates',
			});
		});

		it('should call the by-name endpoint when continueOnFail is false', async () => {
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
					if (name === 'enableAiErrorMode') return fallback;
					return fallback;
				},
			);
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValueOnce({
				channel_id: 'C123',
				unique_name: 'engineering-updates',
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/channelsbyname/engineering-updates',
			);
			expect(result[0].json).toMatchObject({
				channel_id: 'C123',
				unique_name: 'engineering-updates',
			});
		});

		it('should reuse a validated shared preflight result when getting by channel ID', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(
					name: string,
					_itemIndex: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'channelId' && options?.extractValue) return 'C123';
					if (name === 'channelId') return { mode: 'id', value: 'C123' };
					if (name === 'enableAiErrorMode') return fallback;
					return fallback;
				},
			);
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValueOnce({
				channel_id: 'C123',
				name: 'Prefetched Channel',
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/channels/C123');
			expect(result[0].json).toMatchObject({
				channel_id: 'C123',
				name: 'Prefetched Channel',
			});
		});
	});

	describe('Response Handling', () => {
		it('should preserve array responses under data', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue([
				{ channel_id: 'C123', name: 'Wrapped Channel' },
			]);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(name: string, _itemIndex: number, fallback?: unknown) => {
					if (name === 'channelId') return 'C123';
					if (name === 'simplify') return false;
					return fallback;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual({
				data: [{ channel_id: 'C123', name: 'Wrapped Channel' }],
			});
		});

		it('should return complete channel details', async () => {
			const mockResponse = {
				channel_id: 'C123',
				name: 'General',
				unique_name: 'general',
				description: 'General discussion',
				level: 'organization',
				status: 'active',
				created_time: 1234567890,
				modified_time: 1234567900,
				members_count: 42,
			};
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('C123');

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(mockResponse);
		});

		it('should preserve all response fields', async () => {
			const mockResponse = {
				channel_id: 'C123',
				name: 'Test',
				custom_field: 'value',
				metadata: { key: 'value' },
			};
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue(mockResponse);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('C123');

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toHaveProperty('custom_field', 'value');
			expect(result[0].json).toHaveProperty('metadata');
		});

		it('should return a recoverable payload for name-mode failures when continueOnFail is enabled', async () => {
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
					if (name === 'enableAiErrorMode') return fallback;
					return fallback;
				},
			);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				statusCode: 500,
				message: 'upstream failure',
			});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'get',
					status_code: 500,
				}),
			);
		});
	});

	describe('Batch Processing', () => {
		it('should process multiple items', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(name: string, itemIndex: number, fallback?: unknown) => {
					if (name === 'channelId') {
						const values = ['C1', 'C2', 'C3'];
						return values[itemIndex] ?? fallback;
					}
					return fallback;
				},
			);

			const result = await execute.call(mockExecuteFunctions, multipleItems, mockScopes);

			expect(result).toHaveLength(3);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledTimes(3);
		});

		it('should construct execution metadata for each item', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(name: string, itemIndex: number, fallback?: unknown) => {
					if (name === 'channelId') {
						const values = ['C1', 'C2'];
						return values[itemIndex] ?? fallback;
					}
					return fallback;
				},
			);

			await execute.call(mockExecuteFunctions, multipleItems, mockScopes);

			expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenCalledTimes(2);
		});

		it('should use correct item index for each request', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(name: string, itemIndex: number, fallback?: unknown) => {
					if (name === 'channelId') {
						const values = ['C1', 'C2'];
						return values[itemIndex] ?? fallback;
					}
					return fallback;
				},
			);

			await execute.call(mockExecuteFunctions, multipleItems, mockScopes);

			expect(mockExecuteFunctions.getNodeParameter).toHaveBeenCalledWith('channelId', 0, undefined);
			expect(mockExecuteFunctions.getNodeParameter).toHaveBeenCalledWith('channelId', 1, undefined);
		});
	});

	describe('Parameter Extraction', () => {
		it('should extract value from resource locator', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(
					name: string,
					_itemIndex: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'channelId' && options?.extractValue) return 'C123';
					if (name === 'channelId') return { mode: 'list' };
					return fallback;
				},
			);

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(mockExecuteFunctions.getNodeParameter).toHaveBeenCalledWith('channelId', 0, undefined);
			expect(mockExecuteFunctions.getNodeParameter).toHaveBeenCalledWith('channelId', 0, '', {
				extractValue: true,
			});
		});
	});
});
