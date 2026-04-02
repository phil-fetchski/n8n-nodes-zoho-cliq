import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import * as clearMyStatus from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/clearMyStatus.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const userStatusClearMyStatusScope = getRequiredScopeForOperation('userStatus', 'clearMyStatus');

describe('ZohoCliq - UserStatus - Clear My Status Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'userStatus';
					if (parameterName === 'operation') return 'clearMyStatus';
					if (parameterName === 'includeEnhancedOutput') return includeEnhancedOutput;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should expose includeEnhancedOutput plus docs and AI guide notices at the bottom', () => {
		expect(clearMyStatus.description.map((property) => property.name)).toEqual([
			'includeEnhancedOutput',
			'clearMyStatusDocsNotice',
			'clearMyStatusAiToolGuideNotice',
		]);
		expect(clearMyStatus.description[2]?.displayName).toContain('AI Tool Setup Guide');
	});

	it('should clear the current transient status with enhanced output by default', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await clearMyStatus.execute.call(context, items, userStatusClearMyStatusScope);

		expect(result[0].json).toEqual({
			success: true,
			resource: 'userStatus',
			operation: 'clearMyStatus',
			target: 'current_transient_status',
			cleared: true,
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/statuses/ephemeral');
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await clearMyStatus.execute.call(context, items, userStatusClearMyStatusScope);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Delete failed'));

		const result = await clearMyStatus.execute.call(context, items, userStatusClearMyStatusScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Delete failed',
				resource: 'userStatus',
				operation: 'clearMyStatus',
				target: 'current_transient_status',
			}),
		);
	});

	it('should rethrow API failures when recoverable mode is disabled', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Delete hard failure'));

		await expect(
			clearMyStatus.execute.call(context, items, userStatusClearMyStatusScope),
		).rejects.toThrow('Delete hard failure');
	});

	it('should return a recoverable scope payload when AI Error Mode is enabled', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });

		const result = await clearMyStatus.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'clearMyStatus',
				target: 'current_transient_status',
				requiredScopes: [userStatusClearMyStatusScope],
				missingScopes: [userStatusClearMyStatusScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});
});
