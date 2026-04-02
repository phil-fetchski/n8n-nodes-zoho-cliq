/**
 * Tests for Update Channel Operation
 */

import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/update.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

const TINY_GIF_BASE64 = 'R0lGODdhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=';

describe('Update Channel Operation', () => {
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
		(utils.validateChannelId as jest.Mock).mockImplementation((_, id) => id);
		(utils.validateChannelName as jest.Mock).mockImplementation((_, name) => name.trim());
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ success: true });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should update channel name', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({ name: 'New Name' });

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'New Name',
		});
		expect(result).toHaveLength(1);
	});

	it('should wrap array responses from update-channel under data', async () => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue([
			{ channel_id: 'C123', name: 'New Name' },
		] as unknown as IDataObject);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') return 'C123';
				if (name === 'additionalFields') return { name: 'New Name' };
				if (name === 'simplify') return false;
				return fallback;
			},
		);

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(result[0].json).toEqual({
			updated: true,
			data: [{ channel_id: 'C123', name: 'New Name' }],
		});
	});

	it('should update channel description', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({ description: 'New Description' });

		await execute.call(mockExecuteFunctions, mockItems, `${mockScopes},ZohoCliq.Channels.READ`);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			description: 'New Description',
		});
	});

	it('should update both name and description', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({ name: 'New Name', description: 'New Desc' });

		await execute.call(mockExecuteFunctions, mockItems, `${mockScopes},ZohoCliq.Channels.READ`);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'New Name',
			description: 'New Desc',
		});
	});

	it('should update image_data', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({ image_data: TINY_GIF_BASE64 });

		await execute.call(mockExecuteFunctions, mockItems, `${mockScopes},ZohoCliq.Channels.READ`);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			image_data: TINY_GIF_BASE64,
		});
	});

	it('should update structured config', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				configInputMode: 'structured',
				reply_mode: 'both',
				leave_join_info: 'disable',
			});

		await execute.call(mockExecuteFunctions, mockItems, `${mockScopes},ZohoCliq.Channels.READ`);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			config: {
				reply_mode: 'both',
				leave_join_info: 'disable',
			},
		});
	});

	it('should update raw config JSON', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'additionalFields') {
					return {
						configInputMode: 'raw',
						configJson: '{"reply_mode":"threads","meeting_chat_type":"thread"}',
					};
				}
				if (name === 'additionalFields.configJson') {
					return '{"reply_mode":"threads","meeting_chat_type":"thread"}';
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			config: {
				reply_mode: 'threads',
				meeting_chat_type: 'thread',
			},
		});
	});

	it('should resolve a unique-name locator through shared preflight before updating', async () => {
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
				if (name === 'additionalFields') return { description: 'Updated Description' };
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		(transport.zohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({ channel: { id: 'C123' } })
			.mockResolvedValueOnce({ success: true });

		await execute.call(mockExecuteFunctions, mockItems, `${mockScopes},ZohoCliq.Channels.READ`);

		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(transport.zohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/channels/C123',
			{ description: 'Updated Description' },
		);
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
				if (name === 'additionalFields') return { description: 'Updated Description' };
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
			'PUT',
			'/api/v2/channels/engineering-updates',
			{ description: 'Updated Description' },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'update',
				channel_unique_name: 'engineering-updates',
				status_code: 500,
			}),
		);
	});

	it('should infer raw config mode when configJson is populated but configInputMode is omitted', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'additionalFields') {
					return {
						configJson: {
							reply_mode: 'threads',
							leave_join_info: 'enable',
							add_remove_info: 'enable',
							meeting_chat_type: 'host_choice',
						},
					};
				}
				if (name === 'additionalFields.configJson') {
					return {
						reply_mode: 'threads',
						leave_join_info: 'enable',
						add_remove_info: 'enable',
						meeting_chat_type: 'host_choice',
					};
				}
				if (name === 'additionalFields.configInputMode') {
					return fallback;
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			config: {
				reply_mode: 'threads',
				leave_join_info: 'enable',
				add_remove_info: 'enable',
				meeting_chat_type: 'host_choice',
			},
		});
	});

	it('should honor legacy nested updateFields config paths when additionalFields are absent', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'additionalFields') {
					return undefined;
				}
				if (name === 'additionalFields.configInputMode') {
					return undefined;
				}
				if (name === 'additionalFields.configJson') {
					return undefined;
				}
				if (name === 'updateFields') {
					return {
						name: 'Updated Name',
					};
				}
				if (name === 'updateFields.configInputMode') {
					return 'raw';
				}
				if (name === 'updateFields.configJson') {
					return '{"reply_mode":"threads"}';
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'Updated Name',
			config: {
				reply_mode: 'threads',
			},
		});
	});

	it('should honor nested additionalFields config mode when provided separately', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'additionalFields') {
					return {
						name: 'Updated Name',
					};
				}
				if (name === 'additionalFields.configInputMode') {
					return 'raw';
				}
				if (name === 'additionalFields.configJson') {
					return '{"reply_mode":"threads"}';
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'Updated Name',
			config: {
				reply_mode: 'threads',
			},
		});
	});

	it('should throw error for empty additionalFields', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error for name exceeding 50 characters', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({ name: 'a'.repeat(51) });

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error for description exceeding 10500 characters', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({ description: 'a'.repeat(10501) });

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error for prototype pollution attempt', async () => {
		const payload = {} as Record<string, unknown>;
		Object.defineProperty(payload, 'constructor', {
			value: 'malicious',
			enumerable: true,
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce(payload);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should filter out non-whitelisted fields', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({ name: 'Test', invalid_field: 'value' });

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'Test',
		});
	});

	it('should throw for invalid config key in raw mode', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: '{"bad_key":"value"}',
					};
				}
				if (name === 'updateFields.configJson') {
					return '{"bad_key":"value"}';
				}
				return fallback;
			},
		);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should parse data URI image payload', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				image_data: `data:image/gif;base64,${TINY_GIF_BASE64}`,
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			image_data: TINY_GIF_BASE64,
		});
	});

	it('should throw for invalid base64 image payload', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				image_data: 'data:image/png;base64,%%%bad%%%',
			});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Image Data must be a valid base64-encoded string',
		);
	});

	it('should throw for malformed config json in raw mode', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: '{"reply_mode":',
					};
				}
				if (name === 'updateFields.configJson') {
					return '{"reply_mode":';
				}
				return fallback;
			},
		);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Config JSON must be valid JSON',
		);
	});

	it('should throw when raw config is not an object', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: '["threads"]',
					};
				}
				if (name === 'updateFields.configJson') {
					return '["threads"]';
				}
				return fallback;
			},
		);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Config JSON must be an object',
		);
	});

	it('should throw for blocked key in raw config', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: '{"constructor":"bad"}',
					};
				}
				if (name === 'updateFields.configJson') {
					return '{"constructor":"bad"}';
				}
				return fallback;
			},
		);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Invalid key "constructor" in Config JSON',
		);
	});

	it('should throw for invalid raw config value', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: '{"reply_mode":"invalid"}',
					};
				}
				if (name === 'updateFields.configJson') {
					return '{"reply_mode":"invalid"}';
				}
				return fallback;
			},
		);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Invalid value for "reply_mode"',
		);
	});

	it('should throw for empty structured config value', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				configInputMode: 'structured',
				reply_mode: '   ',
			});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Config field "reply_mode" cannot be empty',
		);
	});

	it('should skip empty raw config json and use other update fields', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						name: 'Updated Name',
						configInputMode: 'raw',
						configJson: '   ',
					};
				}
				if (name === 'updateFields.configJson') {
					return '   ';
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'Updated Name',
		});
	});

	it('should skip undefined raw config and still update other fields', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				description: 'Updated description',
				configInputMode: 'raw',
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			description: 'Updated description',
		});
	});

	it('should accept raw config when configJson is already an object', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: { reply_mode: 'threads' },
					};
				}
				if (name === 'updateFields.configJson') {
					return { reply_mode: 'threads' };
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			config: { reply_mode: 'threads' },
		});
	});

	it('should read raw config json directly from the nested parameter path', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: '[object Object]',
					};
				}
				if (name === 'updateFields.configJson') {
					return { reply_mode: 'threads' };
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			config: { reply_mode: 'threads' },
		});
	});

	it('should throw for invalid configInputMode', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				configInputMode: 'bad-mode',
				name: 'New Name',
			});

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Invalid configInputMode',
		);
	});

	it('should skip empty raw config object and still apply other updates', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						name: 'Renamed',
						configInputMode: 'raw',
						configJson: {},
					};
				}
				if (name === 'updateFields.configJson') {
					return {};
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'Renamed',
		});
	});

	it('should skip default empty raw config object from the nested parameter path', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						name: 'Renamed',
						configInputMode: 'raw',
						configJson: '[object Object]',
					};
				}
				if (name === 'updateFields.configJson') {
					return {};
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'Renamed',
		});
	});

	it('should prefer the collection object when nested raw config is stringified as [object Object]', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: { reply_mode: 'threads' },
					};
				}
				if (name === 'updateFields.configJson') {
					return '[object Object]';
				}
				return fallback;
			},
		);

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			config: { reply_mode: 'threads' },
		});
	});

	it('should treat null config values as empty and reject them', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: { reply_mode: null },
					};
				}
				if (name === 'updateFields.configJson') {
					return { reply_mode: null };
				}
				return fallback;
			},
		);

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Config field "reply_mode" cannot be empty',
		);
	});

	it('should ignore blank image_data when other fields are present', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				name: 'New Name',
				image_data: '   ',
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'New Name',
		});
	});

	it('should ignore blank name when other fields are present', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				name: '   ',
				description: 'New Description',
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			description: 'New Description',
		});
	});

	it('should ignore blank description when other fields are present', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				name: 'New Name',
				description: '   ',
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'New Name',
		});
	});

	it('should return recoverable config guidance for invalid raw config json', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'updateFields') {
					return {
						configInputMode: 'raw',
						configJson: '{"reply_mode":',
					};
				}
				if (name === 'updateFields.configJson') {
					return '{"reply_mode":';
				}
				return fallback;
			},
		);

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'update',
				resource: 'channel',
				reason: 'INVALID_CONFIG_JSON',
			}),
		);
		expect(result[0].json.hint).toContain(
			'reply_mode, leave_join_info, add_remove_info, and meeting_chat_type',
		);
		expect(result[0].json.hint).toContain('{"reply_mode":"normal_reply"');
	});

	it('should return the generic recoverable payload for invalid channel URL errors', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue(
			new Error('Request URL is invalid'),
		);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'additionalFields') {
					return {
						name: 'Updated Name',
					};
				}
				return fallback;
			},
		);

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'update',
				resource: 'channel',
				channel_id: 'C123',
				message: 'Request URL is invalid',
			}),
		);
		expect(result[0].json.reason).toBeUndefined();
		expect(result[0].json.hint).toBeUndefined();
	});

	it('should return broad recoverable guidance for generic 400 update errors', async () => {
		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
			statusCode: 400,
			message: 'Request failed with status code 400',
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return 'C123';
				}
				if (name === 'additionalFields') {
					return {
						name: 'Updated Name',
					};
				}
				return fallback;
			},
		);

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'update',
				resource: 'channel',
				reason: 'CHANNEL_REQUEST_BAD_PARAMETERS',
				hint: 'The request may contain an incorrect parameter value or reference a channel resource this endpoint could not identify. Review all provided inputs for missing, unsupported, or malformed values. If you supplied channel_id, verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
				channel_id: 'C123',
			}),
		);
		expect(result[0].json.message).toBe(
			'Zoho Cliq rejected this channel request because one or more supplied parameters were invalid, unsupported, or referenced a channel resource this endpoint could not identify.',
		);
	});

	it('should skip structured config when no config keys are provided', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				configInputMode: 'structured',
				name: 'New Name',
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'New Name',
		});
	});

	it('should handle undefined name value and keep other updates', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				name: undefined,
				description: 'New Description',
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			description: 'New Description',
		});
	});

	it('should handle undefined description value and keep other updates', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				name: 'New Name',
				description: undefined,
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'New Name',
		});
	});

	it('should handle undefined image_data value and keep other updates', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('C123')
			.mockReturnValueOnce({
				name: 'New Name',
				image_data: undefined,
			});

		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/C123', {
			name: 'New Name',
		});
	});

	it('should throw when channel ID is whitespace only', async () => {
		(utils.validateChannelId as jest.Mock).mockImplementation(() => {
			throw new NodeOperationError({} as never, 'Channel ID is required');
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('   ')
			.mockReturnValueOnce({ name: 'Valid Name' });

		await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
			'Channel ID is required',
		);
	});
});
