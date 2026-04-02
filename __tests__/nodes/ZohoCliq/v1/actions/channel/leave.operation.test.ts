import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';

import * as leave from '../../../../../../nodes/ZohoCliq/v1/actions/channel/leave.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Channel - leave operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const items: INodeExecutionData[] = [{ json: {} }];
	const channelId = 'CT_2230642524712404875_64396981';

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(() => channelId),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockReset();
	});

	it('should execute leave successfully', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await leave.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			`/api/v2/channels/${channelId}/leave`,
		);
		expect(result[0].json).toMatchObject({
			success: true,
			channel_id: channelId,
			status: 'ok',
		});
	});

	it('should throw when required UPDATE scope is missing', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'channel';
			if (paramName === 'operation') return 'leave';
			if (paramName === 'channelId') return channelId;
			return undefined;
		});

		let thrownError: unknown;
		try {
			await leave.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_READ);
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
			operation: 'leave',
			requiredScopes: [SCOPES.CHANNELS_UPDATE],
			missingScopes: [SCOPES.CHANNELS_UPDATE],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should convert super-admin restriction to skipped success for message text', async () => {
		mockZohoCliqApiRequest.mockRejectedValue(
			'Please assign a super admin before you leave this channel',
		);

		const result = await leave.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result[0].json).toMatchObject({
			success: true,
			status: 'skipped_super_admin',
			is_super_admin: true,
		});
		expect(result[0].json).toHaveProperty('api_error');
	});

	it('should convert super-admin restriction to skipped success from response body details', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request failed with status code 400',
			response: {
				body: {
					message: 'Current super admin cannot leave this channel',
				},
			},
		});

		const result = await leave.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result[0].json).toMatchObject({
			success: true,
			status: 'skipped_super_admin',
			is_super_admin: true,
		});
	});

	it('should convert super-admin restriction to skipped success from response data details', async () => {
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				data: {
					description: 'Please assign a super admin before you leave this channel',
				},
			},
		});

		const result = await leave.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(result[0].json).toMatchObject({
			success: true,
			status: 'skipped_super_admin',
			is_super_admin: true,
		});
	});

	it('should rethrow non super-admin API errors', async () => {
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Request failed with status code 403'));

		await expect(
			leave.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toThrow('status code 403');
	});

	it('should rethrow plain object errors that do not match super-admin restriction', async () => {
		const apiError = {
			code: 'BAD_REQUEST',
			response: {
				body: {
					message: 'Channel cannot be left right now',
				},
			},
		};
		mockZohoCliqApiRequest.mockRejectedValue(apiError);

		await expect(
			leave.execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE),
		).rejects.toEqual(apiError);
	});
});
