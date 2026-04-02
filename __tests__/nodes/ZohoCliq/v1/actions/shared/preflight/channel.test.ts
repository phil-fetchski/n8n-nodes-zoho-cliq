import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE,
	runChannelIdLookupPreflightGate,
	runChannelUniqueNameLookupPreflightGate,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../../scopeTestScopes';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight channel lookups', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions =>
		({
			getNodeParameter: jest.fn((name: string) => {
				if (name === 'enableAiErrorMode') {
					return values.enableAiErrorMode ?? false;
				}

				return undefined;
			}),
			continueOnFail: values.continueOnFail ? jest.fn(() => true) : undefined,
			getNode: jest.fn(() => ({
				name: 'Zoho Cliq',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: values.enableAiErrorMode ?? false },
			})),
		}) as unknown as IExecuteFunctions;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should skip channel ID preflight when recoverable mode is disabled', async () => {
		await expect(
			runChannelIdLookupPreflightGate(createContext(), 0, SCOPES.CHANNELS_READ, 'CH_123'),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip channel ID preflight when the additional channel-read scope is unavailable', async () => {
		await expect(
			runChannelIdLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.WEBHOOKS_CREATE,
				'CH_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate channel ID preflight when the channel exists', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: 'CH_123' });

		await expect(
			runChannelIdLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.CHANNELS_READ,
				'CH_123',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: { id: 'CH_123' },
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/channels/CH_123');
	});

	it('should throw a normalized CHANNEL_NOT_FOUND error for missing channel unique names', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				statusCode: 404,
				data: { message: 'Request URL is invalid' },
			},
		});

		await expect(
			runChannelUniqueNameLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.CHANNELS_READ,
				'eng-updates',
			),
		).rejects.toMatchObject({
			code: CHANNEL_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: 'No channel found for Channel Unique Name "eng-updates".',
		});
	});

	it('should URL encode channel unique names during the shared preflight lookup', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ unique_name: 'eng updates/ops' });

		await runChannelUniqueNameLookupPreflightGate(
			createContext({ enableAiErrorMode: 'true' }),
			0,
			SCOPES.CHANNELS_READ,
			'eng updates/ops',
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			`/api/v2/channelsbyname/${encodeURIComponent('eng updates/ops')}`,
		);
	});

	it('should rethrow inconclusive channel lookup failures from the shared preflight lookup', async () => {
		const error = new NodeOperationError(
			createContext().getNode(),
			'temporary channel lookup issue',
			{
				itemIndex: 0,
			},
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce(error);

		await expect(
			runChannelIdLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.CHANNELS_READ,
				'CH_123',
			),
		).rejects.toBe(error);
	});

	it('should fall back to an empty accepted-scope list when the scope registry omits channel get scopes', async () => {
		jest.resetModules();
		const isolatedTransportCall = jest.fn();

		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry', () => ({
			listAcceptedScopesForOperation: jest.fn(() => undefined),
		}));
		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/transport', () => ({
			zohoCliqApiRequest: { call: isolatedTransportCall },
		}));

		let isolatedChannelPreflight: typeof import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/channel');
		await jest.isolateModulesAsync(async () => {
			isolatedChannelPreflight =
				await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/channel');
		});

		await expect(
			isolatedChannelPreflight!.runChannelIdLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.CHANNELS_READ,
				'CH_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(isolatedTransportCall).not.toHaveBeenCalled();
		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry');
		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/transport');
		jest.resetModules();
	});
});
