import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as setCurrent from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/setCurrent.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserStatus - Set Current Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const createContext = (
		values: {
			statusId?: string;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const { statusId = 'S123', enableAiErrorMode = false, continueOnFail = false } = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'userStatus';
					if (parameterName === 'operation') return 'setCurrent';
					if (parameterName === 'statusId') return statusId;
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

	it('should expose status field followed by docs and AI guide notices', () => {
		expect(setCurrent.description.map((property) => property.name)).toEqual([
			'statusId',
			'setCurrentStatusDocsNotice',
			'setCurrentStatusAiToolGuideNotice',
		]);
		expect(setCurrent.description[2]?.displayName).toContain('AI Tool Setup Guide');
	});

	it('should set current status successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_UPDATE;
		const mockExecuteFunctions = createContext();

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await setCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/statuses/S123/set');
	});

	it('should reject invalid status identifiers', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_UPDATE;
		const mockExecuteFunctions = createContext({ statusId: 'bad status id' });

		await expect(
			setCurrent.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Invalid Status ID format');
	});

	it('should omit status_id from recoverable output when the provided status input is blank', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_UPDATE;
		const mockExecuteFunctions = createContext({
			statusId: '   ',
			continueOnFail: true,
		});

		const result = await setCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'setCurrent',
				message: 'Status ID is required',
			}),
		);
		expect(result[0].json).not.toHaveProperty('status_id');
	});

	it('should throw error for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const mockExecuteFunctions = createContext();

		const requiredScope = getRequiredScopeForOperation('userStatus', 'setCurrent');
		let thrownError: unknown;
		try {
			await setCurrent.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'userStatus',
			operation: 'setCurrent',
			requiredScopes: [requiredScope],
			missingScopes: [requiredScope],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should return per-item error when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_UPDATE;
		const mockExecuteFunctions = createContext({ continueOnFail: true });

		mockZohoCliqApiRequest.mockRejectedValue(new Error('Set current failed'));

		const result = await setCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'userStatus',
					operation: 'setCurrent',
					message: 'Set current failed',
				}),
			},
		]);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/statuses/S123/set');
	});

	it('should rethrow when continueOnFail is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.PROFILE_UPDATE;
		const mockExecuteFunctions = createContext();

		mockZohoCliqApiRequest.mockRejectedValue(new Error('Set current hard failure'));

		await expect(
			setCurrent.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Set current hard failure');
	});

	it('should return STATUS_NOT_FOUND in recoverable mode when the shared user-status preflight cannot verify the reusable status', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.PROFILE_UPDATE, SCOPES.PROFILE_READ].join(',');
		const mockExecuteFunctions = createContext({
			statusId: 'S_missing',
			continueOnFail: true,
		});

		mockZohoCliqApiRequest.mockResolvedValueOnce({
			statuses: [{ id: 'S123', message: 'Available' }],
		});

		const result = await setCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'setCurrent',
				status_id: 'S_missing',
				reason: 'STATUS_NOT_FOUND',
				message:
					"Status not found. The status_id provided does not exist in the authenticated user's saved custom statuses.",
				hint: 'Use Retrieve All Statuses to retrieve a valid status_id before retrying.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/statuses');
	});

	it('should reuse the cached saved-status catalog across batch items during set-current recoverable preflight checks', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		const grantedScopes = [SCOPES.PROFILE_UPDATE, SCOPES.PROFILE_READ].join(',');
		const mockExecuteFunctions = createContext({ continueOnFail: true });

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				statuses: [{ id: 'S123', message: 'Available' }],
			})
			.mockResolvedValue({ status: 'success' });

		const result = await setCurrent.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(2);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(3);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/statuses');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/statuses/S123/set');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(3, 'PUT', '/api/v2/statuses/S123/set');
	});
});
