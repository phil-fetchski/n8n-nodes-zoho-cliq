import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import * as autoFollow from '../../../../../../nodes/ZohoCliq/v1/actions/thread/autoFollow.operation';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Thread - Auto Follow Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should update auto follow setting successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'enable';
			return undefined;
		});

		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ status: 'enabled' });

		const result = await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/CH_123', {
			auto_follow_threads: 'enable',
		});
	});

	it('should preflight the channel ID when recoverable mode is enabled and channel-read scope is granted', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`;

		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'enable';
			return undefined;
		});

		(mockZohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({ id: 'CH_123' })
			.mockResolvedValueOnce({ status: 'enabled' });

		await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest.mock.calls).toEqual([
			['GET', '/api/v2/channels/CH_123'],
			['PUT', '/api/v2/channels/CH_123', { auto_follow_threads: 'enable' }],
		]);
	});

	it('should skip channel preflight gracefully when recoverable mode is enabled but channel-read scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'enable';
			return undefined;
		});

		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValueOnce({ status: 'enabled' });

		await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest.mock.calls).toEqual([
			['PUT', '/api/v2/channels/CH_123', { auto_follow_threads: 'enable' }],
		]);
	});

	it('should return CHANNEL_NOT_FOUND when shared channel preflight proves the target is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_404';
			if (name === 'autoFollowThreads') return 'enable';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		(mockZohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
			response: {
				statusCode: 404,
				data: { message: 'Request URL is invalid' },
			},
		});

		const result = await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'autoFollow',
					channel_id: 'CH_404',
					auto_follow_threads: 'enable',
					reason: 'CHANNEL_NOT_FOUND',
					hint: 'Use Get Channel or List Channels to confirm the exact channel ID or channel unique name before retrying.',
				}),
			},
		]);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/channels/CH_404');
	});

	it('should send disable value when selected', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'disable';
			return undefined;
		});

		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ status: 'disabled' });

		await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/CH_123', {
			auto_follow_threads: 'disable',
		});
	});

	it('should coerce boolean true to enable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return true;
			return undefined;
		});

		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ status: 'enabled' });

		await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/CH_123', {
			auto_follow_threads: 'enable',
		});
	});

	it('should coerce boolean false to disable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return false;
			return undefined;
		});

		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ status: 'disabled' });

		await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/channels/CH_123', {
			auto_follow_threads: 'disable',
		});
	});

	it('should throw error for invalid auto follow value', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'maybe';
			return undefined;
		});

		await expect(
			autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Auto Follow Threads must be one of: enable, disable, true, false');
	});

	it('should throw error for non-string and non-boolean auto follow value', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 1;
			return undefined;
		});

		await expect(
			autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Auto Follow Threads must be one of: enable, disable, true, false');
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = '';

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'thread';
			if (paramName === 'operation') return 'autoFollow';
			if (paramName === 'channelId') return 'CH_123';
			if (paramName === 'autoFollowThreads') return 'enable';
			return undefined;
		});

		await expect(
			autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(NodeOperationError);
	});

	it('should throw error for empty channel ID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return '';
			if (name === 'autoFollowThreads') return 'enable';
			return undefined;
		});

		await expect(
			autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(NodeOperationError);
	});

	it('should return a mapped recoverable payload when continueOnFail is enabled for invalid auto-follow input', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'maybe';
			return undefined;
		});

		const result = await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'autoFollow',
					channel_id: 'CH_123',
					auto_follow_threads: 'maybe',
					reason: 'INVALID_AUTO_FOLLOW_VALUE',
				}),
			},
		]);
	});

	it('should not run channel preflight when auto follow input is invalid even if channel-read scope is granted', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`;

		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'maybe';
			return undefined;
		});

		const result = await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'autoFollow',
					channel_id: 'CH_123',
					auto_follow_threads: 'maybe',
					reason: 'INVALID_AUTO_FOLLOW_VALUE',
				}),
			},
		]);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a fallback recoverable payload when AI Error Mode is enabled and the request fails', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.CHANNELS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'CH_123';
			if (name === 'autoFollowThreads') return 'enable';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(undefined);

		const result = await autoFollow.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'autoFollow',
					channel_id: 'CH_123',
					auto_follow_threads: 'enable',
					message: 'Unable to update thread auto-follow settings in Zoho Cliq.',
				}),
			},
		]);
	});

	it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'thread';
			if (paramName === 'operation') return 'autoFollow';
			if (paramName === 'channelId') return 'CH_123';
			if (paramName === 'autoFollowThreads') return 'enable';
			return undefined;
		});

		const result = await autoFollow.execute.call(mockExecuteFunctions, items, '');

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'autoFollow',
				}),
			},
		]);
	});
});
