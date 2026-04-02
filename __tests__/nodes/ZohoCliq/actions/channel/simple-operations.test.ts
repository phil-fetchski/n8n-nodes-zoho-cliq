/**
 * Tests for simple channel operations (approve, archive, unarchive, join, leave, reject, delete)
 * These operations share similar patterns: channelId parameter + API call
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { execute as approveExecute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/approve.operation';
import { execute as archiveExecute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/archive.operation';
import { execute as unarchiveExecute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/unarchive.operation';
import { execute as joinExecute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/join.operation';
import { execute as leaveExecute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/leave.operation';
import { execute as rejectExecute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/reject.operation';
import { execute as deleteExecute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/delete.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('Simple Channel Operations', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn().mockReturnValue('C123'),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		(utils.checkRequiredScope as jest.Mock).mockImplementation(() => {});
		(utils.validateChannelId as jest.Mock).mockImplementation((_, id) => id);
		(utils.extractErrorText as jest.Mock).mockImplementation((error: unknown) => {
			if (typeof error === 'string') return error;
			if (error && typeof error === 'object') {
				const record = error as Record<string, unknown>;
				const response = record.response as Record<string, unknown> | undefined;
				const responseData = response?.data as Record<string, unknown> | undefined;
				const responseBody = response?.body as Record<string, unknown> | undefined;
				return String(
					responseData?.message ??
						responseBody?.message ??
						record.message ??
						record.description ??
						'An unexpected issue occurred with the API request',
				);
			}
			return 'An unexpected issue occurred with the API request';
		});
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({ success: true });
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Approve Operation', () => {
		it('should approve channel', async () => {
			const result = await approveExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.UPDATE',
			);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/C123/approve',
			);
			expect(result).toHaveLength(1);
		});

		it('should check required scope', async () => {
			await approveExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE');

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ZohoCliq.Channels.UPDATE',
				'ZohoCliq.Channels.UPDATE',
				0,
			);
		});

		it('should throw clear error when channel is not pending', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Channel is in created state',
			});

			await expect(
				approveExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE'),
			).rejects.toThrow('not in pending state');
		});

		it('should rethrow original approve error when state signal is absent', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce(
				new Error('Some other API error'),
			);

			await expect(
				approveExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE'),
			).rejects.toThrow('Some other API error');
		});
	});

	describe('Archive Operation', () => {
		it('should archive channel', async () => {
			const result = await archiveExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.UPDATE',
			);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/C123/archive',
			);
			expect(result).toHaveLength(1);
		});

		it('should check required scope', async () => {
			await archiveExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE');

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ZohoCliq.Channels.UPDATE',
				'ZohoCliq.Channels.UPDATE',
				0,
			);
		});
	});

	describe('Unarchive Operation', () => {
		it('should unarchive channel', async () => {
			const result = await unarchiveExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.UPDATE',
			);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/C123/unarchive',
			);
			expect(result).toHaveLength(1);
		});

		it('should check required scope', async () => {
			await unarchiveExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE');

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ZohoCliq.Channels.UPDATE',
				'ZohoCliq.Channels.UPDATE',
				0,
			);
		});
	});

	describe('Join Operation', () => {
		it('should join channel', async () => {
			const result = await joinExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.UPDATE',
			);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/C123/join',
			);
			expect(result).toHaveLength(1);
		});

		it('should check required scope', async () => {
			await joinExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE');

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ZohoCliq.Channels.UPDATE',
				'ZohoCliq.Channels.UPDATE',
				0,
			);
		});
	});

	describe('Leave Operation', () => {
		it('should leave channel', async () => {
			const result = await leaveExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.UPDATE',
			);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/C123/leave',
			);
			expect(result).toHaveLength(1);
		});

		it('should check required scope', async () => {
			await leaveExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE');

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ZohoCliq.Channels.UPDATE',
				'ZohoCliq.Channels.UPDATE',
				0,
			);
		});

		it('should return success payload when current user is channel super admin', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Bad request - please check your parameters',
				response: {
					data: {
						message:
							'Please assign a Super Admin from the current participants, to leave this channel.',
					},
				},
			});

			const result = await leaveExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.UPDATE',
			);

			expect(result).toHaveLength(1);
			expect(result[0].json).toMatchObject({
				success: true,
				status: 'skipped_super_admin',
				is_super_admin: true,
			});
		});
	});

	describe('Reject Operation', () => {
		it('should reject channel', async () => {
			const result = await rejectExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.UPDATE',
			);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/channels/C123/reject',
			);
			expect(result).toHaveLength(1);
		});

		it('should check required scope', async () => {
			await rejectExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE');

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ZohoCliq.Channels.UPDATE',
				'ZohoCliq.Channels.UPDATE',
				0,
			);
		});

		it('should throw clear error when channel is not pending', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				message: 'Channel is in created state',
			});

			await expect(
				rejectExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE'),
			).rejects.toThrow('not in pending state');
		});

		it('should detect pending/created state from structured error fields', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				response: {
					data: {
						error: {
							status: 'pending_state',
						},
					},
				},
			});

			await expect(
				rejectExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE'),
			).rejects.toThrow('not in pending state');
		});

		it('should detect pending/created state from response body error fields', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				response: {
					body: {
						error: {
							code: 'created_state',
						},
					},
				},
			});

			await expect(
				rejectExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE'),
			).rejects.toThrow('not in pending state');
		});

		it('should detect pending/created state from response body message text', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce({
				response: {
					body: {
						message: 'Channel is pending approval',
					},
				},
			});

			await expect(
				rejectExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE'),
			).rejects.toThrow('not in pending state');
		});

		it('should rethrow original reject error when no state signal is present', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValueOnce('Random failure');

			await expect(
				rejectExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.UPDATE'),
			).rejects.toEqual('Random failure');
		});
	});

	describe('Delete Operation', () => {
		it('should delete channel', async () => {
			const result = await deleteExecute.call(
				mockExecuteFunctions,
				mockItems,
				'ZohoCliq.Channels.DELETE',
			);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/channels/C123');
			expect(result).toHaveLength(1);
		});

		it('should check required scope', async () => {
			await deleteExecute.call(mockExecuteFunctions, mockItems, 'ZohoCliq.Channels.DELETE');

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				'ZohoCliq.Channels.DELETE',
				'ZohoCliq.Channels.DELETE',
				0,
			);
		});
	});
});
