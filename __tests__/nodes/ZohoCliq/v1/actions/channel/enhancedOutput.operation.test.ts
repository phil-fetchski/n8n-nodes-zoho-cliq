import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';

import * as addBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addBot.operation';
import * as addMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addMembers.operation';
import * as approve from '../../../../../../nodes/ZohoCliq/v1/actions/channel/approve.operation';
import * as archive from '../../../../../../nodes/ZohoCliq/v1/actions/channel/archive.operation';
import * as channelDelete from '../../../../../../nodes/ZohoCliq/v1/actions/channel/delete.operation';
import * as join from '../../../../../../nodes/ZohoCliq/v1/actions/channel/join.operation';
import * as leave from '../../../../../../nodes/ZohoCliq/v1/actions/channel/leave.operation';
import * as reject from '../../../../../../nodes/ZohoCliq/v1/actions/channel/reject.operation';
import * as removeBot from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeBot.operation';
import * as removeMember from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeMember.operation';
import * as removeMembers from '../../../../../../nodes/ZohoCliq/v1/actions/channel/removeMembers.operation';
import * as unarchive from '../../../../../../nodes/ZohoCliq/v1/actions/channel/unarchive.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Channel - Enhanced output toggles', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		resolver: (name: string, options?: { extractValue?: boolean }, fallback?: unknown) => unknown,
	): IExecuteFunctions =>
		({
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex?: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => resolver(name, options, fallback),
			),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		}) as unknown as IExecuteFunctions;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it("should return enhanced output for addBot by default and Cliq's standard output when disabled", async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ api_status: 'ok' });

		const defaultContext = createContext((name, options, fallback) => {
			if (name === 'botUniqueName') return 'statusbot';
			if (name === 'channelId' && options?.extractValue) return 'engineering';
			if (name === 'channelId') return { mode: 'name', value: 'engineering' };
			return fallback;
		});
		const defaultResult = await addBot.execute.call(defaultContext, items, SCOPES.CHANNELS_UPDATE);
		expect(defaultResult[0].json).toMatchObject({
			success: true,
			operation: 'add_bot_to_channel',
			bot_unique_name: 'statusbot',
			channel_locator: 'engineering',
			channel_unique_name: 'engineering',
			api_status: 'ok',
		});

		mockZohoCliqApiRequest.mockResolvedValueOnce({ api_status: 'ok' });
		const rawContext = createContext((name, options, fallback) => {
			if (name === 'botUniqueName') return 'statusbot';
			if (name === 'channelId' && options?.extractValue) return 'engineering';
			if (name === 'channelId') return { mode: 'name', value: 'engineering' };
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});
		const rawResult = await addBot.execute.call(rawContext, items, SCOPES.CHANNELS_UPDATE);
		expect(rawResult[0].json).toEqual({ api_status: 'ok' });

		mockZohoCliqApiRequest.mockResolvedValueOnce([{ api_status: 'ok' }] as unknown as IDataObject);
		const wrappedArrayContext = createContext((name, options, fallback) => {
			if (name === 'botUniqueName') return 'statusbot';
			if (name === 'channelId' && options?.extractValue) return 'engineering';
			if (name === 'channelId') return { mode: 'name', value: 'engineering' };
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});
		const wrappedArrayResult = await addBot.execute.call(
			wrappedArrayContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(wrappedArrayResult[0].json).toEqual({
			data: [{ api_status: 'ok' }],
		});

		mockZohoCliqApiRequest.mockImplementationOnce(async () => undefined as unknown as IDataObject);
		const undefinedResponseContext = createContext((name, options, fallback) => {
			if (name === 'botUniqueName') return 'statusbot';
			if (name === 'channelId' && options?.extractValue) return 'engineering';
			if (name === 'channelId') return { mode: 'name', value: 'engineering' };
			return fallback;
		});
		const undefinedResponseResult = await addBot.execute.call(
			undefinedResponseContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(undefinedResponseResult[0].json).toMatchObject({
			success: true,
			operation: 'add_bot_to_channel',
			bot_unique_name: 'statusbot',
			channel_locator: 'engineering',
			channel_unique_name: 'engineering',
		});
	});

	it('should return enhanced output for addMembers and include counts', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({});

		const context = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifiers') return 'alex@example.com,sam@example.com';
			return fallback;
		});

		const result = await addMembers.execute.call(context, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toMatchObject({
			success: true,
			operation: 'add_channel_members',
			channel_id: 'P1234567890123456789',
			identifier_type: 'email_ids',
			member_identifiers: ['alex@example.com', 'sam@example.com'],
			added_count: 2,
		});

		mockZohoCliqApiRequest.mockResolvedValueOnce({ status: 'ok' });
		const rawContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifiers') return 'alex@example.com,sam@example.com';
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});
		const rawResult = await addMembers.execute.call(rawContext, items, SCOPES.CHANNELS_UPDATE);
		expect(rawResult[0].json).toEqual({ status: 'ok' });

		mockZohoCliqApiRequest.mockResolvedValueOnce([{ status: 'ok' }] as unknown as IDataObject);
		const wrappedArrayContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifiers') return 'alex@example.com,sam@example.com';
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});
		const wrappedArrayResult = await addMembers.execute.call(
			wrappedArrayContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(wrappedArrayResult[0].json).toEqual({
			data: [{ status: 'ok' }],
		});

		mockZohoCliqApiRequest.mockImplementationOnce(async () => null as unknown as IDataObject);
		const nullResponseContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifiers') return 'alex@example.com,sam@example.com';
			return fallback;
		});
		const nullResponseResult = await addMembers.execute.call(
			nullResponseContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(nullResponseResult[0].json).toMatchObject({
			success: true,
			operation: 'add_channel_members',
			channel_id: 'P1234567890123456789',
		});
	});

	it("should return Cliq's standard output for removeBot when enhanced output is disabled", async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ api_status: 'ok' });

		const context = createContext((name, _options, fallback) => {
			if (name === 'channelId') return 'P1234567890123456789';
			if (name === 'botId') return 'b-1234567890123456789';
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});

		const result = await removeBot.execute.call(context, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toEqual({ deleted: true, api_status: 'ok' });

		mockZohoCliqApiRequest.mockImplementationOnce(async () => undefined as unknown as IDataObject);
		const undefinedResponseContext = createContext((name, _options, fallback) => {
			if (name === 'channelId') return 'P1234567890123456789';
			if (name === 'botId') return 'b-1234567890123456789';
			return fallback;
		});
		const undefinedResponseResult = await removeBot.execute.call(
			undefinedResponseContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(undefinedResponseResult[0].json).toMatchObject({
			deleted: true,
			success: true,
			operation: 'remove_bot_from_channel',
			channel_id: 'P1234567890123456789',
			removed_bot_id: 'b-1234567890123456789',
		});
	});

	it("should return enhanced and Cliq's standard output for removeMember based on toggle", async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({});

		const context = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifier') return '7654321';
			return fallback;
		});

		const result = await removeMember.execute.call(context, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toMatchObject({
			deleted: true,
			success: true,
			operation: 'remove_single_channel_member',
			channel_id: 'P1234567890123456789',
			identifier_type: 'user_ids',
			removed_member: '7654321',
		});

		mockZohoCliqApiRequest.mockResolvedValueOnce({});
		const rawContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifier') return '7654321';
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});
		const rawResult = await removeMember.execute.call(rawContext, items, SCOPES.CHANNELS_UPDATE);
		expect(rawResult[0].json).toEqual({ deleted: true });

		mockZohoCliqApiRequest.mockImplementationOnce(async () => null as unknown as IDataObject);
		const nullResponseContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifier') return '7654321';
			return fallback;
		});
		const nullResponseResult = await removeMember.execute.call(
			nullResponseContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(nullResponseResult[0].json).toMatchObject({
			deleted: true,
			success: true,
			operation: 'remove_single_channel_member',
			channel_id: 'P1234567890123456789',
			removed_member: '7654321',
		});
	});

	it("should return enhanced output for removeMembers and Cliq's standard output when disabled", async () => {
		const enhancedContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifiers') return '1234567,7654321';
			return fallback;
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ first: true }).mockResolvedValueOnce({
			last: true,
		});
		const enhancedResult = await removeMembers.execute.call(
			enhancedContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'DELETE',
			'/api/v2/channels/P1234567890123456789/members/1234567',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/channels/P1234567890123456789/members/7654321',
		);
		expect(enhancedResult[0].json).toMatchObject({
			deleted: true,
			success: true,
			operation: 'remove_channel_members',
			channel_id: 'P1234567890123456789',
			identifier_type: 'user_ids',
			removed_identifiers: ['1234567', '7654321'],
			count: 2,
			api_call_count: 2,
			delete_member_endpoint_used: true,
			last: true,
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ api_status: 'first' })
			.mockResolvedValueOnce({ api_status: 'ok' });
		const rawContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifiers') return '1234567,7654321';
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});
		const rawResult = await removeMembers.execute.call(rawContext, items, SCOPES.CHANNELS_UPDATE);
		expect(rawResult[0].json).toEqual({ deleted: true, api_status: 'ok' });

		mockZohoCliqApiRequest.mockImplementationOnce(async () => undefined as unknown as IDataObject);
		const undefinedResponseContext = createContext((name, options, fallback) => {
			if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
			if (name === 'channelId') return { mode: 'id', value: 'P1234567890123456789' };
			if (name === 'memberIdentifiers') return '1234567,7654321';
			if (name === 'includeEnhancedOutput') return false;
			return fallback;
		});
		const undefinedResponseResult = await removeMembers.execute.call(
			undefinedResponseContext,
			items,
			SCOPES.CHANNELS_UPDATE,
		);
		expect(undefinedResponseResult[0].json).toEqual({ deleted: true });
	});

	it.each([
		{
			label: 'approve',
			run: approve.execute,
			scope: SCOPES.CHANNELS_UPDATE,
			operation: 'approve_channel',
		},
		{
			label: 'archive',
			run: archive.execute,
			scope: SCOPES.CHANNELS_UPDATE,
			operation: 'archive_channel',
		},
		{
			label: 'leave',
			run: leave.execute,
			scope: SCOPES.CHANNELS_UPDATE,
			operation: 'leave_channel',
		},
		{
			label: 'reject',
			run: reject.execute,
			scope: SCOPES.CHANNELS_UPDATE,
			operation: 'reject_channel',
		},
		{
			label: 'unarchive',
			run: unarchive.execute,
			scope: SCOPES.CHANNELS_UPDATE,
			operation: 'unarchive_channel',
		},
		{
			label: 'delete',
			run: channelDelete.execute,
			scope: SCOPES.CHANNELS_DELETE,
			operation: 'delete_channel',
			isDelete: true,
		},
	])(
		"should return enhanced output for $label by default and Cliq's standard output when disabled",
		async ({ run, scope, operation, isDelete }) => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({ api_status: 'ok' });
			const enhancedContext = createContext((name, options, fallback) => {
				if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (name === 'channelId') return 'P1234567890123456789';
				return fallback;
			});
			const enhancedResult = await run.call(enhancedContext, items, scope);
			expect(enhancedResult[0].json).toMatchObject({
				...(isDelete ? { deleted: true } : {}),
				success: true,
				operation,
				channel_id: 'P1234567890123456789',
				api_status: 'ok',
			});

			mockZohoCliqApiRequest.mockResolvedValueOnce({ api_status: 'ok' });
			const rawContext = createContext((name, options, fallback) => {
				if (name === 'channelId' && options?.extractValue) return 'P1234567890123456789';
				if (name === 'channelId') return 'P1234567890123456789';
				if (name === 'includeEnhancedOutput') return false;
				return fallback;
			});
			const rawResult = await run.call(rawContext, items, scope);
			expect(rawResult[0].json).toEqual(
				isDelete ? { deleted: true, api_status: 'ok' } : { api_status: 'ok' },
			);
		},
	);

	it('should always include success, operation, and channel_id metadata in join (fold-in)', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ api_status: 'ok' });
		const context = createContext((name, _options, fallback) => {
			if (name === 'channelId') return 'P1234567890123456789';
			if (name === 'simplify') return false;
			return fallback;
		});

		const result = await join.execute.call(context, items, SCOPES.CHANNELS_UPDATE);
		expect(result[0].json).toMatchObject({
			success: true,
			operation: 'join_channel',
			channel_id: 'P1234567890123456789',
			api_status: 'ok',
		});
	});
});
