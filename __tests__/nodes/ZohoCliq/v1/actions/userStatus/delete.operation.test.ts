import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/delete.operation';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const userStatusDeleteScope = getRequiredScopeForOperation('userStatus', 'delete');

describe('ZohoCliq - UserStatus - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const recoverableDeleteScopes = [SCOPES.PROFILE_DELETE, SCOPES.PROFILE_READ].join(',');

	const createContext = (
		values: {
			statusId?: string;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			statusId = '1775998000034476000',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'userStatus';
					if (parameterName === 'operation') return 'delete';
					if (parameterName === 'statusId') return statusId;
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

	it('should expose statusId, includeEnhancedOutput, docs, and AI guide notices in order', () => {
		expect(del.description.map((property) => property.name)).toEqual([
			'statusId',
			'includeEnhancedOutput',
			'deleteUserStatusDocsNotice',
			'deleteUserStatusAiToolGuideNotice',
		]);
		expect(del.description[3]?.displayName).toContain('AI Tool Setup Guide');
	});

	it('should delete a reusable status with enhanced output by default', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, userStatusDeleteScope);

		expect(result[0].json).toEqual({
			success: true,
			resource: 'userStatus',
			operation: 'delete',
			status_id: '1775998000034476000',
			deleted: true,
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/statuses/1775998000034476000',
		);
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, userStatusDeleteScope);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should reject invalid reusable status identifiers', async () => {
		const context = createContext({ statusId: 'bad status id' });

		await expect(del.execute.call(context, items, userStatusDeleteScope)).rejects.toThrow(
			'Invalid Status ID format',
		);
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Delete status failed'));

		const result = await del.execute.call(context, items, userStatusDeleteScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Delete status failed',
				resource: 'userStatus',
				operation: 'delete',
				status_id: '1775998000034476000',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/statuses/1775998000034476000',
		);
	});

	it('should rethrow API failures when recoverable mode is disabled', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Delete hard failure'));

		await expect(del.execute.call(context, items, userStatusDeleteScope)).rejects.toThrow(
			'Delete hard failure',
		);
	});

	it('should return STATUS_NOT_FOUND in recoverable mode when the shared user-status preflight cannot verify the reusable status', async () => {
		const context = createContext({
			statusId: '1775998000099999999',
			continueOnFail: true,
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ id: '1775998000034476000', message: 'In a meeting' }],
		});

		const result = await del.execute.call(context, items, recoverableDeleteScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'delete',
				status_id: '1775998000099999999',
				reason: 'STATUS_NOT_FOUND',
				message:
					"Status not found. The status_id provided does not exist in the authenticated user's saved custom statuses.",
				hint: 'Use Retrieve All Statuses to retrieve a valid status_id before retrying.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/statuses');
	});

	it('should invalidate the saved-status catalog cache after each successful delete', async () => {
		const batchItems: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: [{ id: '1775998000034476000', message: 'In a meeting' }],
			})
			.mockResolvedValueOnce('' as unknown as Record<string, never>)
			.mockResolvedValueOnce({
				data: [{ id: '1775998000034476000', message: 'In a meeting' }],
			})
			.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, batchItems, recoverableDeleteScopes);

		expect(result).toHaveLength(2);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(4);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/statuses');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'DELETE',
			'/api/v2/statuses/1775998000034476000',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(3, 'GET', '/api/v2/statuses');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			4,
			'DELETE',
			'/api/v2/statuses/1775998000034476000',
		);
	});

	it('should return a recoverable scope payload when AI Error Mode is enabled', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });

		const result = await del.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'delete',
				requiredScopes: [userStatusDeleteScope],
				missingScopes: [userStatusDeleteScope],
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});
});
