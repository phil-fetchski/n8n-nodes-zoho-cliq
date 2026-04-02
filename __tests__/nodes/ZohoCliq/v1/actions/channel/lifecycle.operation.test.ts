import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';

import * as approve from '../../../../../../nodes/ZohoCliq/v1/actions/channel/approve.operation';
import * as archive from '../../../../../../nodes/ZohoCliq/v1/actions/channel/archive.operation';
import * as channelDelete from '../../../../../../nodes/ZohoCliq/v1/actions/channel/delete.operation';
import * as join from '../../../../../../nodes/ZohoCliq/v1/actions/channel/join.operation';
import * as leave from '../../../../../../nodes/ZohoCliq/v1/actions/channel/leave.operation';
import * as reject from '../../../../../../nodes/ZohoCliq/v1/actions/channel/reject.operation';
import * as unarchive from '../../../../../../nodes/ZohoCliq/v1/actions/channel/unarchive.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

type ChannelOperation = {
	label: string;
	execute: (
		this: IExecuteFunctions,
		items: INodeExecutionData[],
		grantedScopes: string,
	) => Promise<INodeExecutionData[]>;
	method: 'POST' | 'DELETE';
	path: string;
	scope: string;
};

describe('ZohoCliq - Channel - Lifecycle Operations', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const items: INodeExecutionData[] = [{ json: {} }];
	const channelId = 'CT_2230642524712404875_64396981';

	const operations: ChannelOperation[] = [
		{
			label: 'approve',
			execute: approve.execute,
			method: 'POST',
			path: `/api/v2/channels/${channelId}/approve`,
			scope: SCOPES.CHANNELS_UPDATE,
		},
		{
			label: 'archive',
			execute: archive.execute,
			method: 'POST',
			path: `/api/v2/channels/${channelId}/archive`,
			scope: SCOPES.CHANNELS_UPDATE,
		},
		{
			label: 'unarchive',
			execute: unarchive.execute,
			method: 'POST',
			path: `/api/v2/channels/${channelId}/unarchive`,
			scope: SCOPES.CHANNELS_UPDATE,
		},
		{
			label: 'join',
			execute: join.execute,
			method: 'POST',
			path: `/api/v2/channels/${channelId}/join`,
			scope: SCOPES.CHANNELS_UPDATE,
		},
		{
			label: 'leave',
			execute: leave.execute,
			method: 'POST',
			path: `/api/v2/channels/${channelId}/leave`,
			scope: SCOPES.CHANNELS_UPDATE,
		},
		{
			label: 'reject',
			execute: reject.execute,
			method: 'POST',
			path: `/api/v2/channels/${channelId}/reject`,
			scope: SCOPES.CHANNELS_UPDATE,
		},
		{
			label: 'delete',
			execute: channelDelete.execute,
			method: 'DELETE',
			path: `/api/v2/channels/${channelId}`,
			scope: SCOPES.CHANNELS_DELETE,
		},
	];

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'resource') return 'channel';
				if (name === 'operation') return 'unknown';
				if (name === 'channelId') return channelId;
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'simplify') return false;
				if (name === 'simplifyMode') return 'simplified';
				if (name === 'simplifyFields') return [];
				return fallback;
			}),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
		mockZohoCliqApiRequest.mockResolvedValue({ ok: true });
	});

	it.each(operations)(
		'should execute $label using $method $path',
		async ({ execute, method, path, scope }) => {
			const result = await execute.call(mockExecuteFunctions, items, scope);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(method, path);
		},
	);

	it.each([
		{ label: 'archive', execute: archive.execute, action: 'archive' },
		{ label: 'unarchive', execute: unarchive.execute, action: 'unarchive' },
	])(
		'should resolve unique-name locators through shared preflight before $label',
		async ({ execute, action }) => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(
					name: string,
					_itemIndex?: number,
					_fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'resource') return 'channel';
					if (name === 'operation') return action;
					if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
					if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
					if (name === 'includeEnhancedOutput') return true;
					if (name === 'enableAiErrorMode') return false;
					return undefined;
				},
			);
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({ data: { id: channelId } })
				.mockResolvedValueOnce({ ok: true });

			const result = await execute.call(
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
				'POST',
				`/api/v2/channels/${action === 'unarchive' ? 'engineering-updates' : channelId}/${action}`,
			);
			if (action === 'unarchive') {
				expect(result[0].json).toMatchObject({
					channel_unique_name: 'engineering-updates',
					channel_id: channelId,
				});
			}
		},
	);

	it.each([
		{ label: 'archive', execute: archive.execute, action: 'archive' },
		{ label: 'unarchive', execute: unarchive.execute, action: 'unarchive' },
	])(
		'should return recoverable payloads with channel_unique_name when name lookup preflight is skipped for $label',
		async ({ execute, label, action }) => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(
					name: string,
					_itemIndex?: number,
					_fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'resource') return 'channel';
					if (name === 'operation') return label;
					if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
					if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
					if (name === 'includeEnhancedOutput') return true;
					if (name === 'enableAiErrorMode') return false;
					return undefined;
				},
			);
			mockZohoCliqApiRequest.mockRejectedValueOnce({
				statusCode: 500,
				message: 'Server exploded',
			});

			const result = await execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				`/api/v2/channels/engineering-updates/${action}`,
			);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: label,
					channel_unique_name: 'engineering-updates',
					status_code: 500,
				}),
			);
		},
	);

	it('should return success output with only channel_unique_name when unarchive does not resolve a channel ID', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'resource') return 'channel';
				if (name === 'operation') return 'unarchive';
				if (name === 'channelId' && options?.extractValue) return 'engineering-updates';
				if (name === 'channelId') return { mode: 'name', value: 'engineering-updates' };
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return false;
				return undefined;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({ ok: true });

		const result = await unarchive.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.CHANNELS_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/engineering-updates/unarchive',
		);
		expect(result[0].json).toMatchObject({
			success: true,
			operation: 'unarchive_channel',
			channel_unique_name: 'engineering-updates',
			ok: true,
		});
		expect(result[0].json).not.toHaveProperty('channel_id');
	});

	it.each(operations)(
		'should throw NodeOperationError for missing scope on $label',
		async ({ execute, label, scope }) => {
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'resource') return 'channel';
				if (name === 'operation') return label;
				if (name === 'channelId') return channelId;
				if (name === 'includeEnhancedOutput') return true;
				throw new Error(`Unexpected getNodeParameter call: ${name}`);
			});

			let thrownError: unknown;
			try {
				await execute.call(mockExecuteFunctions, items, '');
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
				operation: label,
				requiredScopes: [scope],
				missingScopes: [scope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			});
		},
	);

	it.each(operations)(
		'should return recoverable scope payload for missing scope on $label when continueOnFail is enabled',
		async ({ execute, label, scope }) => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'resource') return 'channel';
				if (name === 'operation') return label;
				if (name === 'channelId') return channelId;
				if (name === 'includeEnhancedOutput') return true;
				throw new Error(`Unexpected getNodeParameter call: ${name}`);
			});

			const result = await execute.call(mockExecuteFunctions, items, '');
			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'channel',
					operation: label,
					requiredScopes: [scope],
					missingScopes: [scope],
				}),
			);
		},
	);

	it.each(operations)(
		'should return helper recoverable payload for API failure on $label when continueOnFail is enabled',
		async ({ execute, label, scope }) => {
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
				if (name === 'resource') return 'channel';
				if (name === 'operation') return label;
				if (name === 'channelId') return channelId;
				if (name === 'includeEnhancedOutput') return true;
				throw new Error(`Unexpected getNodeParameter call: ${name}`);
			});
			mockZohoCliqApiRequest.mockRejectedValueOnce({
				statusCode: 404,
				message: 'Request failed with status code 404',
			});

			const result = await execute.call(mockExecuteFunctions, items, scope);
			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'channel',
					operation: label,
					status_code: 404,
				}),
			);
		},
	);
});
