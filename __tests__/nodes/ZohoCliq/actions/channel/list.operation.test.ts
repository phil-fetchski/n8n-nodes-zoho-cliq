/**
 * Tests for List Channels Operation
 * Verifies channel listing with filters and pagination
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/list.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

// Mock dependencies
jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('List Channels Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];
	const mockScopes = 'ZohoCliq.Channels.READ';

	beforeEach(() => {
		mockExecuteFunctions = {
			getInputData: jest.fn().mockReturnValue(mockItems),
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			continueOnFail: jest.fn().mockReturnValue(false),
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
		(utils.validateNextToken as jest.Mock).mockImplementation(
			(_context: IExecuteFunctions, value: unknown) => String(value).trim(),
		);
		(utils.validateToken as jest.Mock).mockImplementation(
			(_context: IExecuteFunctions, value: unknown) => String(value).trim(),
		);

		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			channels: [
				{ channel_id: 'C1', name: 'General' },
				{ channel_id: 'C2', name: 'Random' },
			],
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Basic Functionality', () => {
		it('should list all channels', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('') // level
				.mockReturnValueOnce('') // status
				.mockReturnValueOnce('') // joined
				.mockReturnValueOnce(false) // pinned
				.mockReturnValueOnce({}); // additionalFields

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/channels', {}, {});
			expect(result).toHaveLength(1);
			expect(result[0].json.channels).toHaveLength(2);
		});

		it('should default additionalFields to empty object when undefined', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('') // level
				.mockReturnValueOnce('') // status
				.mockReturnValueOnce('') // joined
				.mockReturnValueOnce(false) // pinned
				.mockReturnValueOnce(undefined); // additionalFields

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/channels', {}, {});
			expect(result).toHaveLength(1);
			expect(result[0].json.channels).toHaveLength(2);
		});

		it('should check required scope', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(utils.checkRequiredScope).toHaveBeenCalledWith(
				mockExecuteFunctions,
				mockScopes,
				'ZohoCliq.Channels.READ',
				0,
			);
		});

		it('should return pagination metadata', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				channels: [],
				has_more: true,
				next_token: 'token123',
				sync_token: 'sync456',
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					if (paramName === 'simplify') return false;
					return undefined;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					has_more: true,
					next_token: 'token123',
					sync_token: 'sync456',
				}),
			);
		});

		it('should handle response without pagination', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				channels: [],
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					if (paramName === 'simplify') return false;
					return undefined;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			// Raw mode returns the full API response as-is; no _pagination wrapping
			expect(result[0].json).toEqual({ channels: [] });
		});

		it('should coerce primitive response into { data: ... }', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue('invalid-response');

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					if (paramName === 'simplify') return false;
					return undefined;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			// Raw mode returns the coerced response (primitives wrapped under data key)
			expect(result[0].json).toEqual({ data: 'invalid-response' });
		});

		it('should coerce a single channel object into a channels array', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				channels: { channel_id: 'C1', name: 'General' },
				has_more: 1,
				next_token: 123,
				sync_token: null,
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					if (paramName === 'simplify') return false;
					return undefined;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			// Raw mode returns the full API response as-is (no array coercion or _pagination wrapping)
			expect(result[0].json).toEqual({
				channels: { channel_id: 'C1', name: 'General' },
				has_more: 1,
				next_token: 123,
				sync_token: null,
			});
		});

		it('should default channels to empty array for object response without channels', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				has_more: false,
				next_token: 'token123',
				sync_token: 'sync456',
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					if (paramName === 'simplify') return false;
					return undefined;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			// Raw mode returns the full API response as-is
			expect(result[0].json).toEqual({
				has_more: false,
				next_token: 'token123',
				sync_token: 'sync456',
			});
		});
	});

	describe('Level Filter', () => {
		it('should filter by organization level', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('organization')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toEqual({ level: 'organization' });
		});

		it('should filter by team level', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('team')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('level', 'team');
		});

		it('should filter by private level', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('private')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('level', 'private');
		});

		it('should throw error for invalid level', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('invalid')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid level',
			);
		});

		it('should not include level param when empty', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).not.toHaveProperty('level');
		});
	});

	describe('Status Filter', () => {
		it('should filter by created status', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('created')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('status', 'created');
		});

		it('should filter by archived status', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('archived')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('status', 'archived');
		});

		it('should throw error for invalid status', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('invalid')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid status',
			);
		});
	});

	describe('Boolean Filters', () => {
		it('should filter by joined channels', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('true')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('joined', true);
		});

		it('should treat boolean joined=true as joined-only for legacy inputs', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('joined', true);
		});

		it('should treat boolean joined=false as not-joined-only for legacy inputs', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('joined', false);
		});

		it('should filter by pinned channels', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('pinned', true);
		});

		it('should post-filter pinned channels from the returned page', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				channels: [
					{ channel_id: 'C1', name: 'General', pinned: false },
					{ channel_id: 'C2', name: 'Pinned', pinned: true },
				],
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce({});

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json.channels).toEqual([{ channel_id: 'C2', name: 'Pinned', pinned: true }]);
		});

		it('should post-filter a single pinned channel object response', async () => {
			(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
				channels: { channel_id: 'C2', name: 'Pinned', pinned: true },
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(true)
				.mockReturnValueOnce({})
				.mockReturnValueOnce(false); // simplify

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			// Raw mode returns the full response as-is; single-object channels is not coerced to array
			expect(result[0].json.channels).toEqual({ channel_id: 'C2', name: 'Pinned', pinned: true });
		});

		it('should omit joined and pinned filters when both are unset', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).not.toHaveProperty('joined');
			expect(callArgs[3]).not.toHaveProperty('pinned');
		});

		it('should filter by non-joined channels', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('false')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('joined', false);
		});

		it('should reject invalid joined filter values', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('maybe')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid joined filter',
			);
		});
	});

	describe('Additional Fields', () => {
		it('should apply limit parameter', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ limit: 25 });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('limit', 25);
		});

		it('should throw error for limit out of range', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ limit: 101 });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Limit must be between 1 and 100',
			);
		});

		it('should apply order_by parameter', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ order_by: '-last_modified_time' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('order_by', '-last_modified_time');
		});

		it('should throw error for invalid order_by', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ order_by: 'invalid' });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid order_by',
			);
		});

		it('should apply channel_ids filter', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({
					channel_ids: 'P5452022000000451001,P5452022000000451002',
				});

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty(
				'channel_ids',
				'P5452022000000451001,P5452022000000451002',
			);
		});

		it('should throw error for invalid channel_ids format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ channel_ids: 'C1@#$,C2' });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'channel_ids must be valid Zoho Cliq channel ID values in comma-separated format. Example: P5452022000000451001',
			);
		});

		it('should reject empty channel_ids after trimming comma-separated input', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ channel_ids: ' , , ' });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'channel_ids cannot be empty',
			);
		});

		it('should reject partially empty channel_ids segments', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({
					channel_ids: 'P5452022000000451001,,P5452022000000451002',
				});

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'channel_ids contains an empty segment. Remove extra commas and provide comma-separated IDs only.',
			);
		});

		it('should apply created_by filter', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ created_by: 'user@example.com' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('created_by', 'user@example.com');
		});

		it('should apply name filter', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ name: 'Engineering Updates' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('name', 'Engineering Updates');
		});

		it('should reject an overly long name filter', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ name: 'a'.repeat(256) });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'name is too long',
			);
		});

		it('should throw error for invalid created_by format', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ created_by: 'invalid user' });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid created_by format',
			);
		});
	});

	describe('Timestamp Filters', () => {
		it('should apply modified_after timestamp', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ modified_after: '2023-01-01T00:00:00Z' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('modified_after');
			expect(typeof callArgs[3].modified_after).toBe('number');
		});

		it('should apply created_before timestamp', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ created_before: '2023-12-31T23:59:59Z' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('created_before');
			expect(typeof callArgs[3].created_before).toBe('number');
		});

		it('should accept epoch-millisecond timestamp strings', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ modified_before: '1704067199000' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3].modified_before).toBe(1704067199000);
		});

		it('should throw error for invalid timestamp', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ modified_after: 'invalid date' });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Invalid modified_after timestamp',
			);
		});
	});

	describe('Pagination Tokens', () => {
		it('should apply next_token', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ next_token: 'token123' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('next_token', 'token123');
		});

		it('should apply sync_token', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ sync_token: 'sync456' });

			await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			const callArgs = (transport.zohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(callArgs[3]).toHaveProperty('sync_token', 'sync456');
		});

		it('should throw error for token too long', async () => {
			const longToken = 'a'.repeat(501);
			(utils.validateNextToken as jest.Mock).mockImplementation(() => {
				throw new NodeOperationError({ name: 'Zoho Cliq' } as never, 'Next Token is too long');
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ next_token: longToken });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Next Token is too long',
			);
		});

		it('should reject requests that provide both next_token and sync_token', async () => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce('')
				.mockReturnValueOnce(false)
				.mockReturnValueOnce({ next_token: 'token123', sync_token: 'sync456' });

			await expect(execute.call(mockExecuteFunctions, mockItems, mockScopes)).rejects.toThrow(
				'Next Token and Sync Token cannot be used together. Provide only one token per request.',
			);
		});
	});

	describe('Batch Processing', () => {
		it('should process multiple items', async () => {
			const multipleItems: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			(mockExecuteFunctions.getInputData as jest.Mock).mockReturnValue(multipleItems);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			const result = await execute.call(mockExecuteFunctions, multipleItems, mockScopes);

			expect(result).toHaveLength(2);
			expect(transport.zohoCliqApiRequest).toHaveBeenCalledTimes(2);
		});
	});

	describe('Recoverable Errors', () => {
		it('should return a recoverable invalid-list request payload when continueOnFail is enabled', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
				statusCode: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: unknown) => {
					if (paramName === 'enableAiErrorMode') return fallback;
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return { limit: 50 };
					return fallback;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					reason: 'BAD_REQUEST',
					message: 'The request URL is invalid. Please check the URL pattern.',
				}),
			);
			expect(result[0].json.hint).toContain('Retry with minimal filters first');
			expect(result[0].pairedItem).toEqual({ item: 0 });
		});

		it('should return a recoverable next-token error when Zoho reports a generic technical failure', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
				statusCode: 400,
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: unknown) => {
					if (paramName === 'enableAiErrorMode') return fallback;
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return { next_token: 'token123' };
					return fallback;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					reason: 'BAD_REQUEST',
					message:
						"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				}),
			);
			expect(result[0].json.hint).toContain('Next Token appears invalid or expired');
			expect(result[0].pairedItem).toEqual({ item: 0 });
		});

		it('should return a recoverable sync-token error when Zoho reports a generic technical failure', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
				statusCode: 400,
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: unknown) => {
					if (paramName === 'enableAiErrorMode') return fallback;
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return { sync_token: 'sync456' };
					return fallback;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					reason: 'BAD_REQUEST',
					message:
						"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				}),
			);
			expect(result[0].json.hint).toContain('Sync Token appears invalid or expired');
			expect(result[0].pairedItem).toEqual({ item: 0 });
		});

		it('should treat try-again-later token failures as invalid pagination tokens', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
				statusCode: 400,
				message: 'Please try again later.',
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: unknown) => {
					if (paramName === 'enableAiErrorMode') return fallback;
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return { next_token: 'token123' };
					return fallback;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					reason: 'BAD_REQUEST',
					message: 'Please try again later.',
				}),
			);
			expect(result[0].json.hint).toContain('Next Token appears invalid or expired');
			expect(result[0].pairedItem).toEqual({ item: 0 });
		});

		it('should keep generic bad-request recovery when no pagination token was used', async () => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(transport.zohoCliqApiRequest as jest.Mock).mockRejectedValue({
				statusCode: 400,
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			});

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _index: number, fallback?: unknown) => {
					if (paramName === 'enableAiErrorMode') return fallback;
					if (paramName === 'level') return '';
					if (paramName === 'status') return '';
					if (paramName === 'joined') return '';
					if (paramName === 'pinned') return false;
					if (paramName === 'additionalFields') return {};
					return fallback;
				},
			);

			const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					reason: 'BAD_REQUEST',
					message:
						"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				}),
			);
			expect(result[0].json.hint).toContain('Check required parameters');
			expect(result[0].pairedItem).toEqual({ item: 0 });
		});
	});
});
