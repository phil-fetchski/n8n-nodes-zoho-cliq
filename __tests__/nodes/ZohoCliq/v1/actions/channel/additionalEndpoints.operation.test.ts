import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';

import * as addBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addBot.operation';
import * as changePermission from '../../../../../../nodes/ZohoCliq/v1/actions/channel/changePermission.operation';
import * as changeRole from '../../../../../../nodes/ZohoCliq/v1/actions/channel/changeRole.operation';
import * as utils from '../../../../../../nodes/ZohoCliq/v1/helpers/utils';
import * as removeBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeBot.operation';
import * as removeMember from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeMember.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Channel - Additional Endpoints Operations', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const items: INodeExecutionData[] = [{ json: {} }];
	const channelId = 'CT_2230642524712404875_64396981';

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
		mockZohoCliqApiRequest.mockResolvedValue({ ok: true });
	});

	it('should execute addBot using POST /api/v2/bots/{botUniqueName}/associate', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/statusbot/associate',
			{
				channel_unique_name: 'engineering-updates',
			},
		);
	});

	it('should resolve unique channel name from selected channel ID when adding bot', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'list', value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ channel_id: channelId, unique_name: 'engineering-updates' })
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			`/api/v2/channels/${channelId}`,
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/bots/statusbot/associate',
			{
				channel_unique_name: 'engineering-updates',
			},
		);
	});

	it('should reuse validated preflight channel data when adding bot by channel ID', async () => {
		const validateChannelNameSpy = jest.spyOn(utils, 'validateChannelName');
		mockExecuteFunctions.continueOnFail = jest.fn(
			() => true,
		) as unknown as IExecuteFunctions['continueOnFail'];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { unique_name: 'engineering-updates' } })
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			`/api/v2/channels/${channelId}`,
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/bots/statusbot/associate',
			{ channel_unique_name: 'engineering-updates' },
		);
		expect(validateChannelNameSpy).toHaveBeenCalledWith(
			mockExecuteFunctions,
			'engineering-updates',
			0,
		);
		validateChannelNameSpy.mockRestore();
	});

	it('should gracefully handle already-associated bot without throwing', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce(
			new Error('Bot is already a member of this channel'),
		);

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_unique_name: 'engineering-updates',
			already_associated: true,
		});
	});

	it('should throw for generic 400 bad request from association endpoint', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request failed with status code 400',
			statusCode: 400,
			response: {
				status: 400,
				data: { code: '400' },
			},
		});

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toBeDefined();
	});

	it('should throw addBot error when API fails with non-400 and non-duplicate error', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Request failed with status code 403'));

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('status code 403');
	});

	it('should throw when channel unique name cannot be resolved from selected channel ID', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockResolvedValueOnce({ channel_id: channelId });

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Could not resolve channel unique name');
	});

	it('should throw validation error for invalid addBot channel unique name', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'bad channel name';
				if (name === 'channelId') return { mode: 'name', value: 'bad channel name' };
				return undefined;
			},
		);

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid Channel Unique Name format');
	});

	it('should throw validation error for invalid addBot bot unique name', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'status bot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid Bot Unique Name format');
	});

	it('should reject addBot bot unique names containing numbers', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot1';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid Bot Unique Name format. Use lowercase letters only');
	});

	it('should throw validation error when addBot bot unique name is empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return '   ';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Bot Unique Name is required');
	});

	it('should throw validation error for too-long addBot bot unique name', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'a'.repeat(121);
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Bot Unique Name is too long');
	});

	it('should resolve channel unique name from nested channel object', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ channel: { unique_name: 'engineering-updates' } })
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/bots/statusbot/associate',
			{ channel_unique_name: 'engineering-updates' },
		);
	});

	it('should skip blank nested unique_name and resolve from next nested candidate', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				channel: { unique_name: '   ' },
				data: { unique_name: 'engineering-updates' },
			})
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/bots/statusbot/associate',
			{ channel_unique_name: 'engineering-updates' },
		);
	});

	it('should resolve channel unique name from nested data object', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { unique_name: 'engineering-updates' } })
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/bots/statusbot/associate',
			{ channel_unique_name: 'engineering-updates' },
		);
	});

	it('should resolve channel unique name from nested result object', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ result: { unique_name: 'engineering-updates' } })
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'POST',
			'/api/v2/bots/statusbot/associate',
			{ channel_unique_name: 'engineering-updates' },
		);
	});

	it('should throw when channel lookup response is non-object', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { mode: 'id', value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockResolvedValueOnce('not-an-object' as unknown as { ok: true });

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Could not resolve channel unique name');
	});

	it('should handle already-associated error when thrown as string', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce('already member');

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result[0].json).toMatchObject({ success: true, already_associated: true });
	});

	it('should handle already-associated error from plain object message', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'bot already has association',
		});

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toMatchObject({ success: true, already_associated: true });
	});

	it('should handle already-associated error using "association" keyword', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				body: {
					details: 'already association present',
				},
			},
		});

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toMatchObject({ success: true, already_associated: true });
	});

	it('should detect already-associated phrase from response data fields', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 1234,
			response: {
				data: {
					error: 'already',
					description: 'member exists',
				},
			},
		});

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result[0].json).toMatchObject({ success: true, already_associated: true });
	});

	it('should detect already-associated phrase using "associated" keyword', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'already associated',
		});

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result[0].json).toMatchObject({ success: true, already_associated: true });
	});

	it('should treat nested response.data.data code signals as already associated', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request failed with status code 400',
			statusCode: 400,
			response: {
				data: {
					data: {
						code: 'BOT_ALREADY_ASSOCIATED',
					},
				},
			},
		});

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toMatchObject({ success: true, already_associated: true });
	});

	it('should treat nested response.body.error code signals as already associated', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request failed with status code 400',
			statusCode: 400,
			response: {
				body: {
					error: {
						error_code: 'MEMBER_ALREADY_EXISTS',
					},
				},
			},
		});

		const result = await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toMatchObject({ success: true, already_associated: true });
	});

	it('should throw when statusCode is 400 but duplicate-association signal is missing', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: '400',
			message: 10,
		});

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toBeDefined();
	});

	it('should throw when error contains "already" without association context', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'already processed request',
		});

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toBeDefined();
	});

	it('should still throw when top-level statusCode string is not a whole number', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: '400.5',
		});

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toBeDefined();
	});

	it('should throw when response.status is 400 but duplicate-association signal is missing', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				status: '400',
			},
		});

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toBeDefined();
	});

	it('should still throw when response.status string is not a whole number', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				status: 'not-a-number',
			},
		});

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toBeDefined();
	});

	it('should throw when response.status is numeric 400 but duplicate-association signal is missing', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				return undefined;
			},
		);

		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				status: 400,
			},
		});

		await expect(
			addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toBeDefined();
	});

	it('should resolve channel unique name when locator object is missing mode', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return { value: channelId };
				return undefined;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ unique_name: 'engineering-updates' })
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			`/api/v2/channels/${channelId}`,
		);
	});

	it('should resolve channel unique name when locator value is not an object', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'botUniqueName') return 'statusbot';
				if (name === 'channelId' && options?.extractValue) return channelId;
				if (name === 'channelId') return 42;
				return undefined;
			},
		);

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ unique_name: 'engineering-updates' })
			.mockResolvedValueOnce({ ok: true });

		await addBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			`/api/v2/channels/${channelId}`,
		);
	});

	it('should execute changeRole using PUT /api/v2/channels/{channelId}/members/{memberId}', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberId') return '123456789';
			if (name === 'role') return 'moderator';
			return undefined;
		});

		const result = await changeRole.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			`/api/v2/channels/${channelId}/members/123456789`,
			{ role: 'moderator' },
		);
	});

	it('should resolve a unique-name locator through shared preflight before changing role', async () => {
		mockExecuteFunctions.continueOnFail = jest.fn(
			() => true,
		) as unknown as IExecuteFunctions['continueOnFail'];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'memberId') return '123456789';
				if (name === 'role') return 'moderator';
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ result: { id: channelId } })
			.mockResolvedValueOnce({ ok: true });

		await changeRole.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			`/api/v2/channels/${channelId}/members/123456789`,
			{ role: 'moderator' },
		);
	});

	it('should return a recoverable payload with channel_unique_name for changeRole when name lookup preflight is skipped', async () => {
		mockExecuteFunctions.continueOnFail = jest.fn(
			() => true,
		) as unknown as IExecuteFunctions['continueOnFail'];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'memberId') return '123456789';
				if (name === 'role') return 'moderator';
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 500,
			message: 'Server exploded',
		});

		const result = await changeRole.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/channels/engineering-updates/members/123456789',
			{ role: 'moderator' },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'changeRole',
				channel_unique_name: 'engineering-updates',
				member_id: '123456789',
				status_code: 500,
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should throw validation error for invalid changeRole role value', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberId') return '123456789';
			if (name === 'role') return 'owner';
			return undefined;
		});

		await expect(
			changeRole.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid role');
	});

	it('should throw validation error when changeRole memberId is missing', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberId') return '   ';
			if (name === 'role') return 'admin';
			return undefined;
		});

		await expect(
			changeRole.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Member ID is required');
	});

	it('should throw validation error when changeRole channelId is invalid', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return 'bad channel id';
			if (name === 'memberId') return '123456789';
			if (name === 'role') return 'admin';
			return undefined;
		});

		await expect(
			changeRole.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid Channel ID format');
	});

	it('should execute removeMember using DELETE /api/v2/channels/{channelId}/members/{identifier}', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberIdentifier') return 'user@example.com';
			return undefined;
		});

		const result = await removeMember.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			`/api/v2/channels/${channelId}/members/user%40example.com`,
		);
	});

	it('should execute removeMember with user ID', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberIdentifier') return 'member_123';
			return undefined;
		});

		await removeMember.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			`/api/v2/channels/${channelId}/members/member_123`,
		);
	});

	it('should throw validation error when removeMember email is invalid', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberIdentifier') return 'bad @example.com';
			return undefined;
		});

		await expect(
			removeMember.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid email format');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw validation error when removeMember member ID is invalid', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberIdentifier') return 'member id';
			return undefined;
		});

		await expect(
			removeMember.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid Member ID format');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw validation error when removeMember identifier is empty', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'memberIdentifier') return '   ';
			return undefined;
		});

		await expect(
			removeMember.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Member identifier is required');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should execute removeBot using DELETE /api/v2/channels/{channelId}/members/{botId}', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'botId') return 'b-5452022000001911029';
			return undefined;
		});

		const result = await removeBot.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			`/api/v2/channels/${channelId}/members/b-5452022000001911029`,
		);
	});

	it('should throw validation error when removeBot botId is invalid', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'botId') return 'bot id';
			return undefined;
		});

		await expect(
			removeBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid Bot ID format');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should execute changePermission using PUT /api/v2/channels/{channelId}', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'structured';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermission') return { send_message: true };
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		const result = await changePermission.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/channels/${channelId}`, {
			admin_permission: { send_message: true },
		});
	});

	it('should resolve a unique-name locator through shared preflight before changing permissions', async () => {
		mockExecuteFunctions.continueOnFail = jest.fn(
			() => true,
		) as unknown as IExecuteFunctions['continueOnFail'];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'adminInputMode') return 'structured';
				if (name === 'moderatorInputMode') return 'structured';
				if (name === 'memberInputMode') return 'structured';
				if (name === 'adminPermission') return { send_message: true };
				if (name === 'moderatorPermission') return {};
				if (name === 'memberPermission') return {};
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ channel: { channel_id: channelId } })
			.mockResolvedValueOnce({ ok: true });

		const result = await changePermission.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			`/api/v2/channels/${channelId}`,
			{ admin_permission: { send_message: true } },
		);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_unique_name: 'engineering-updates',
			channel_id: channelId,
		});
	});

	it('should return a recoverable payload when changePermission cannot resolve a channel ID from a name locator', async () => {
		mockExecuteFunctions.continueOnFail = jest.fn(
			() => true,
		) as unknown as IExecuteFunctions['continueOnFail'];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'adminInputMode') return 'structured';
				if (name === 'moderatorInputMode') return 'structured';
				if (name === 'memberInputMode') return 'structured';
				if (name === 'adminPermission') return { send_message: true };
				if (name === 'moderatorPermission') return {};
				if (name === 'memberPermission') return {};
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			channel: { unique_name: 'engineering-updates' },
		});

		const result = await changePermission.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'changePermission',
				channel_unique_name: 'engineering-updates',
				message:
					'Channel lookup by unique name did not return a usable channel_id. Change Permission requires a valid channel ID for this endpoint.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should throw when changePermission cannot resolve a channel ID and recoverable mode is disabled', async () => {
		mockExecuteFunctions.continueOnFail = jest.fn(
			() => false,
		) as unknown as IExecuteFunctions['continueOnFail'];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'adminInputMode') return 'structured';
				if (name === 'moderatorInputMode') return 'structured';
				if (name === 'memberInputMode') return 'structured';
				if (name === 'adminPermission') return { send_message: true };
				if (name === 'moderatorPermission') return {};
				if (name === 'memberPermission') return {};
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			channel: { unique_name: 'engineering-updates' },
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow(
			'Channel lookup by unique name did not return a usable channel_id. Change Permission requires a valid channel ID for this endpoint.',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
	});

	it('should fall back to direct channel lookup by unique name before changing permissions', async () => {
		mockExecuteFunctions.continueOnFail = jest.fn(
			() => true,
		) as unknown as IExecuteFunctions['continueOnFail'];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'adminInputMode') return 'structured';
				if (name === 'moderatorInputMode') return 'structured';
				if (name === 'memberInputMode') return 'structured';
				if (name === 'adminPermission') return { send_message: true };
				if (name === 'moderatorPermission') return {};
				if (name === 'memberPermission') return {};
				if (name === 'enableAiErrorMode') return fallback;
				return fallback;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ channel: { unique_name: 'engineering-updates' } })
			.mockResolvedValueOnce({ channel: { channel_id: channelId } })
			.mockResolvedValueOnce({ ok: true });

		const result = await changePermission.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.CHANNELS_UPDATE},${SCOPES.CHANNELS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/channelsbyname/engineering-updates',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			3,
			'PUT',
			`/api/v2/channels/${channelId}`,
			{ admin_permission: { send_message: true } },
		);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_unique_name: 'engineering-updates',
			channel_id: channelId,
		});
	});

	it('should execute changePermission with per-role raw JSON payload', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'raw';
			if (name === 'adminPermissionJson') return '{"send_message":true}';
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermissionJson') return '{"send_message":false}';
			return undefined;
		});

		await changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/channels/${channelId}`, {
			admin_permission: { send_message: true },
			member_permission: { send_message: false },
		});
	});

	it('should throw for invalid changePermission input mode', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'invalid';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid adminInputMode');
	});

	it('should skip unchanged raw default payload for a role', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermissionJson') {
				return {
					audio_conference: true,
					leave_channel: true,
					special_mentions: true,
					send_message: true,
					unarchive_channel: true,
					edit_channel_info: true,
					delete_others_message: true,
					sticky_message: true,
					close_thread: true,
					delete_channel: true,
					edit_my_msg: true,
					video_conference: true,
					delete_my_msg: true,
					mention_users: true,
					clear_all_messages: true,
					post_reply: true,
					archive_channel: true,
					add_participant: true,
					prime_time: true,
					remove_participant: true,
				};
			}
			if (name === 'moderatorPermission') return { send_message: false };
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/channels/${channelId}`, {
			moderator_permission: { send_message: false },
		});
	});

	it('should throw validation error for malformed raw permissions JSON', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermissionJson') return '{"send_message":';
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('must be a valid JSON object');
	});

	it('should throw validation error for empty raw permissions JSON text', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermissionJson') return '   ';
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Admin Permission cannot be empty');
	});

	it('should throw validation error for unsafe permission key', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermissionJson') return '{"__proto__":{"polluted":true}}';
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Unsafe key');
	});

	it('should throw validation error for empty structured permissions', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'structured';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermission') return {};
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('At least one permission object must be provided');
	});

	it('should throw validation error for non-object structured permission', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'structured';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermission') return 'true';
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Admin Permission must be a JSON object');
	});

	it('should throw validation error for unsupported raw permission key', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermissionJson') return { random_key: true };
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('unsupported permission');
	});

	it('should throw validation error for non-boolean permission values in raw mode', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermissionJson') return '{"send_message":{"nested":true}}';
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await expect(
			changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Admin Permission.send_message must be a boolean value');
	});

	it('should include raw role payload when it differs from default permissions', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'channelId') return channelId;
			if (name === 'adminInputMode') return 'raw';
			if (name === 'moderatorInputMode') return 'structured';
			if (name === 'memberInputMode') return 'structured';
			if (name === 'adminPermissionJson') {
				return {
					audio_conference: true,
					leave_channel: true,
					special_mentions: true,
					send_message: true,
					unarchive_channel: true,
					edit_channel_info: true,
					delete_others_message: true,
					sticky_message: true,
					close_thread: true,
					delete_channel: true,
					edit_my_msg: true,
					video_conference: true,
					delete_my_msg: true,
					mention_users: true,
					clear_all_messages: false,
					post_reply: true,
					archive_channel: true,
					add_participant: true,
					prime_time: true,
					remove_participant: true,
				};
			}
			if (name === 'moderatorPermission') return {};
			if (name === 'memberPermission') return {};
			return undefined;
		});

		await changePermission.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			`/api/v2/channels/${channelId}`,
			expect.objectContaining({
				admin_permission: expect.objectContaining({
					clear_all_messages: false,
				}),
			}),
		);
	});

	it.each([
		{ label: 'addBot', operation: addBot.execute, scope: SCOPES.CHANNELS_UPDATE },
		{ label: 'changeRole', operation: changeRole.execute, scope: SCOPES.CHANNELS_UPDATE },
		{ label: 'removeBot', operation: removeBot.execute, scope: SCOPES.CHANNELS_UPDATE },
		{ label: 'removeMember', operation: removeMember.execute, scope: SCOPES.CHANNELS_UPDATE },
		{
			label: 'changePermission',
			operation: changePermission.execute,
			scope: SCOPES.CHANNELS_UPDATE,
		},
	])(
		'should throw NodeOperationError for missing scope on $label',
		async ({ operation, label, scope }) => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'resource') return 'channel';
				if (name === 'operation') return label;
				if (name === 'channelId') return channelId;
				return undefined;
			});

			let thrownError: unknown;
			try {
				await operation.call(mockExecuteFunctions, items, '');
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toMatch(
				/Missing OAuth scope for|Operation not permitted, make sure you have the right permissions/,
			);
			expect(
				(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
			).toEqual({
				success: false,
				resource: 'channel',
				operation: label,
				requiredScopes: [scope],
				missingScopes: [scope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		},
	);
});
