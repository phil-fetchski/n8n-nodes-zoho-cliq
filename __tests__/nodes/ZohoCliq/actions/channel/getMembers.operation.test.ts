/**
 * Tests for Get Channel Members Operation
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { execute } from '../../../../../nodes/ZohoCliq/v1/actions/channel/getMembers.operation';
import * as transport from '../../../../../nodes/ZohoCliq/v1/transport';
import * as utils from '../../../../../nodes/ZohoCliq/v1/helpers/utils';

jest.mock('../../../../../nodes/ZohoCliq/v1/transport');
jest.mock('../../../../../nodes/ZohoCliq/v1/helpers/utils');

describe('Get Channel Members Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockItems: INodeExecutionData[] = [{ json: {} }];
	const mockScopes = 'ZohoCliq.Channels.READ';

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
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue({
			members: [{ email: 'user@example.com' }],
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should get channel members', async () => {
		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(transport.zohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/channels/C123/members',
		);
		expect(result).toHaveLength(1);
	});

	it('should preserve a one-item object array response by default', async () => {
		(transport.zohoCliqApiRequest as jest.Mock).mockResolvedValue([
			{ user_id: '123', email: 'user@example.com' },
		]);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') return 'C123';
				return fallback;
			},
		);

		const result = await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(result[0].json).toEqual({
			members: [{ user_id: '123', email: 'user@example.com' }],
		});
	});

	it('should check required scope', async () => {
		await execute.call(mockExecuteFunctions, mockItems, mockScopes);

		expect(utils.checkRequiredScope).toHaveBeenCalledWith(
			mockExecuteFunctions,
			mockScopes,
			'ZohoCliq.Channels.READ',
			0,
		);
	});
});
