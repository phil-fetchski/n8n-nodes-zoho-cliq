import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as utils from '../../../../../../nodes/ZohoCliq/v1/helpers/utils';
import { execute } from '../../../../../../nodes/ZohoCliq/v1/actions/channel/addBot.operation';
import * as preflight from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight', () => ({
	runChannelIdLookupPreflightGate: jest.fn(),
}));

describe('ZohoCliq - Channel - AddBot shared preflight fast path', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const items: INodeExecutionData[] = [{ json: {} }];
	const channelId = 'CT_2230642524712404875_64396981';
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const mockRunChannelIdLookupPreflightGate =
		preflight.runChannelIdLookupPreflightGate as jest.MockedFunction<
			typeof preflight.runChannelIdLookupPreflightGate
		>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(
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
			),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockReset();
		mockZohoCliqApiRequest.mockResolvedValue({ ok: true });
		mockRunChannelIdLookupPreflightGate.mockReset();
	});

	it('should use the validated preflight entity unique name without a fallback lookup GET', async () => {
		const validateChannelNameSpy = jest.spyOn(utils, 'validateChannelName');
		mockRunChannelIdLookupPreflightGate.mockResolvedValueOnce({
			status: 'validated',
			entity: { data: { unique_name: 'engineering-updates' } },
		});

		await execute.call(mockExecuteFunctions, items, SCOPES.CHANNELS_UPDATE);

		expect(mockRunChannelIdLookupPreflightGate).toHaveBeenCalledWith(
			mockExecuteFunctions,
			0,
			SCOPES.CHANNELS_UPDATE,
			channelId,
		);
		expect(validateChannelNameSpy).toHaveBeenCalledWith(
			mockExecuteFunctions,
			'engineering-updates',
			0,
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/statusbot/associate',
			{ channel_unique_name: 'engineering-updates' },
		);
		validateChannelNameSpy.mockRestore();
	});
});
