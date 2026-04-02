import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import * as getMainMessage from '../../../../../../nodes/ZohoCliq/v1/actions/thread/getMainMessage.operation';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Thread - Get Main Message Operation', () => {
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

	it('should get main message successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MESSAGES_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('CT_123-T-456');
		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({ id: 'MSG_1' });

		const result = await getMainMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/threads/CT_123-T-456/messages/main',
		);
	});

	it('should decode the parent and latest thread message ids in the response', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MESSAGES_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('CT_123-T-456');
		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
			id: '1773676805202%20412172172370',
			thread_message: {
				id: '1774046958557%208815399901',
				msguid: '1774046958557%208815399901',
				lmsguid: '1774046948326%204520422374',
			},
			thread_information: {
				thread_message_id: '1773676805202%20412172172370',
				chat_id: 'CT_123-T-456',
			},
		});

		const result = await getMainMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			id: '1773676805202_412172172370',
			thread_message: {
				id: '1774046958557_8815399901',
				msguid: '1774046958557_8815399901',
				lmsguid: '1774046948326_4520422374',
			},
			thread_information: {
				thread_message_id: '1773676805202_412172172370',
				chat_id: 'CT_123-T-456',
			},
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'thread';
			if (paramName === 'operation') return 'getMainMessage';
			if (paramName === 'threadChatId') return 'CT_123-T-456';
			return undefined;
		});

		await expect(getMainMessage.execute.call(mockExecuteFunctions, items, '')).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should throw error for empty thread chat ID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MESSAGES_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('');

		await expect(
			getMainMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow(NodeOperationError);
	});

	it('should return per-item error when continueOnFail is enabled and request fails', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MESSAGES_READ;

		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('CT_123-T-456');
		(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(undefined);

		const result = await getMainMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'getMainMessage',
					thread_chat_id: 'CT_123-T-456',
					message: 'Unable to get the thread main message in Zoho Cliq.',
				}),
			},
		]);
	});

	it('should preflight the thread chat ID in recoverable mode before requesting the main message', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.MESSAGES_READ},${SCOPES.CHATS_READ}`;

		(mockExecuteFunctions as unknown as { continueOnFail: jest.Mock }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('CT_123-T-456');
		(mockZohoCliqApiRequest as jest.Mock)
			.mockResolvedValueOnce({ data: [] })
			.mockResolvedValueOnce({ id: 'MSG_1' });

		await getMainMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest.mock.calls).toEqual([
			['GET', '/api/v2/chats/CT_123-T-456/members', {}, {}],
			['GET', '/api/v2/threads/CT_123-T-456/messages/main'],
		]);
	});

	it('should return THREAD_NOT_FOUND when shared preflight proves the thread chat ID is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.MESSAGES_READ},${SCOPES.CHATS_READ}`;

		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: 'true' },
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('CT_123-T-456');
		(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue({
			response: {
				statusCode: 404,
				data: { message: 'Request URL is invalid' },
			},
		});

		const result = await getMainMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'getMainMessage',
					thread_chat_id: 'CT_123-T-456',
					message: 'The supplied thread chat ID could not be found in Zoho Cliq.',
					reason: 'THREAD_NOT_FOUND',
					hint: 'Use List Threads for Channel or Get Main Message to discover a valid thread chat ID in the authenticated account before retrying.',
				}),
			},
		]);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123-T-456/members',
			{},
			{},
		);
	});

	it('should return a recoverable API payload in AI Error Mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MESSAGES_READ;

		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: 'true' },
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('CT_123-T-456');
		(mockZohoCliqApiRequest as jest.Mock).mockRejectedValue(
			new Error('Main message lookup failed'),
		);

		const result = await getMainMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'getMainMessage',
					thread_chat_id: 'CT_123-T-456',
					message: 'Main message lookup failed',
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
			if (paramName === 'operation') return 'getMainMessage';
			if (paramName === 'threadChatId') return 'CT_123-T-456';
			return undefined;
		});

		const result = await getMainMessage.execute.call(mockExecuteFunctions, items, '');

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'thread',
					operation: 'getMainMessage',
				}),
			},
		]);
	});

	it('should expose docs and AI guide notices at the bottom of the description', () => {
		const names = getMainMessage.description.map((property) => property.name);
		expect(names.slice(-2)).toEqual([
			'getThreadMainMessageDocsNotice',
			'getThreadMainMessageAiToolGuideNotice',
		]);
	});
});
