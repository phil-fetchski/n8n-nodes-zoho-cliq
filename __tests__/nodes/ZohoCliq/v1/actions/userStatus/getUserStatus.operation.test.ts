import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as getUserStatus from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/getUserStatus.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserStatus - Get User Status Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const setGetNodeParameterMock = () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex?: number, _defaultValue?: unknown, options?: IDataObject) => {
				if (name === 'userId' && options?.extractValue) return 'U123456';
				if (name === 'userId') return { mode: 'id', value: 'U123456' };
				return undefined;
			},
		);
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should expose user field followed by docs and AI guide notices', () => {
		expect(getUserStatus.description.map((property) => property.name)).toEqual([
			'userId',
			'getUserStatusDocsNotice',
			'getUserStatusAiToolGuideNotice',
		]);
		expect(getUserStatus.description[2]?.displayName).toContain('AI Tool Setup Guide');
	});

	it('should get user status successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		setGetNodeParameterMock();
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'U123456', chat_status: { status: 'busy' } });

		await getUserStatus.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users/U123456',
			{},
			{ fields: 'chat_status' },
		);
	});

	it('should reuse the initially captured userId instead of reading the extractValue parameter twice', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;
		let extractValueCallCount = 0;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex?: number, _defaultValue?: unknown, options?: IDataObject) => {
				if (name === 'userId' && options?.extractValue) {
					extractValueCallCount += 1;
					return 'U123456';
				}
				if (name === 'userId') return { mode: 'id', value: 'U123456' };
				return undefined;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'U123456', chat_status: { status: 'busy' } });

		await getUserStatus.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(extractValueCallCount).toBe(1);
	});

	it('should reject blank user identifiers', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex?: number, _defaultValue?: unknown, options?: IDataObject) => {
				if (name === 'userId' && options?.extractValue) return '   ';
				if (name === 'userId') return { mode: 'id', value: '   ' };
				return undefined;
			},
		);

		await expect(
			getUserStatus.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('User ID is required');
	});

	it('should still return a recoverable error when initial user-id capture throws before execution', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		let extractValueCallCount = 0;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex?: number, _defaultValue?: unknown, options?: IDataObject) => {
				if (name === 'userId' && options?.extractValue) {
					extractValueCallCount += 1;
					if (extractValueCallCount === 1) {
						throw new Error('preview lookup unavailable');
					}

					return 'U123456';
				}

				if (name === 'userId') return { mode: 'id', value: 'U123456' };
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'U123456', email_id: 'user@example.com' })
			.mockRejectedValueOnce(new Error('Get user status failed'));

		const result = await getUserStatus.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'getUserStatus',
				message: 'Get user status failed',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_id');
	});

	it('should return USER_NOT_FOUND in recoverable mode when the shared user preflight confirms no user', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		setGetNodeParameterMock();
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				statusCode: 404,
				data: { message: 'Request URL is invalid' },
			},
		});

		const result = await getUserStatus.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'getUserStatus',
				user_id: 'U123456',
				reason: 'USER_NOT_FOUND',
				message:
					'No Zoho Cliq user found for User ID / Email / ZUID "U123456". Verify the user exists before retrying.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/users/U123456', {});
	});

	it('should throw error for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'userStatus';
			if (name === 'operation') return 'getUserStatus';
			return undefined;
		});

		const requiredScope = getRequiredScopeForOperation('userStatus', 'getUserStatus');
		let thrownError: unknown;
		try {
			await getUserStatus.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'getUserStatus',
			requiredScopes: [requiredScope],
			missingScopes: [requiredScope],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should fail per-item with continueOnFail when API request fails', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		setGetNodeParameterMock();
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'U123456', email_id: 'user@example.com' })
			.mockRejectedValueOnce(new Error('Get user status failed'));

		const result = await getUserStatus.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'userStatus',
					operation: 'getUserStatus',
					message: 'Get user status failed',
				}),
			},
		]);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/users/U123456', {});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/users/U123456',
			{},
			{ fields: 'chat_status' },
		);
	});

	it('should rethrow when continueOnFail is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
		setGetNodeParameterMock();
		mockZohoCliqApiRequest.mockRejectedValue(new Error('User status hard failure'));

		await expect(
			getUserStatus.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('User status hard failure');
	});
});
