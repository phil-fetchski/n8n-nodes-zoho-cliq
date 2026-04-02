import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';

import * as removeBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeBot.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Channel - removeBot operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const items: INodeExecutionData[] = [{ json: {} }];
	const channelId = 'CT_2230642524712404875_64396981';

	const setupParameterMock = (params: Record<string, unknown>) => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				return params[name] !== undefined ? params[name] : fallback;
			},
		);
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockReset();
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });
	});

	it('should remove bot successfully with trimmed bot ID', async () => {
		setupParameterMock({
			channelId,
			botId: '  b-5452022000001911029  ',
		});

		const result = await removeBot.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			`/api/v2/channels/${channelId}/members/b-5452022000001911029`,
		);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_id: channelId,
			removed_bot_id: 'b-5452022000001911029',
		});
	});

	it('should throw when bot ID is empty', async () => {
		setupParameterMock({
			channelId,
			botId: '   ',
		});

		await expect(
			removeBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Bot ID is required');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw when bot ID is too long', async () => {
		setupParameterMock({
			channelId,
			botId: `b-${'a'.repeat(201)}`,
		});

		await expect(
			removeBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Bot ID is too long');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw when bot ID format is invalid', async () => {
		setupParameterMock({
			channelId,
			botId: 'bot id with spaces',
		});

		await expect(
			removeBot.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('Invalid Bot ID format');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw NodeOperationError when scope is missing', async () => {
		setupParameterMock({
			resource: 'channel',
			operation: 'removeBot',
			channelId,
			botId: 'b-5452022000001911029',
		});

		let thrownError: unknown;
		try {
			await removeBot.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'channel',
			operation: 'removeBot',
			requiredScopes: [SCOPES.CHANNELS_UPDATE],
			missingScopes: [SCOPES.CHANNELS_UPDATE],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});
});
