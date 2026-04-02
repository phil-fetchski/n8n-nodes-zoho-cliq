import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/role/update.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - Update Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should update role successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return 'Senior Admin';
			if (name === 'description') return 'Senior administrators';
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ role_id: 'role_123', name: 'Senior Admin' });

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/profiles/role_123', {
			name: 'Senior Admin',
			description: 'Senior administrators',
		});
	});

	it('should update with only name in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return 'Senior Admin';
			if (name === 'description') return '';
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/profiles/role_123', {
			name: 'Senior Admin',
		});
	});

	it('should prefill missing name from locator cache when updating description', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'roleId') {
					if (options?.extractValue) {
						return 'role_123';
					}
					return { cachedResultName: 'Existing Role' };
				}
				if (name === 'inputMode') return 'structured';
				if (name === 'prefillRoleName') return true;
				if (name === 'name') return '';
				if (name === 'description') return 'Updated description';
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { title: 'No name in API response' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Existing Role',
			description: 'Updated description',
		});
	});

	it('should fallback to API fetch when locator cachedResultName is blank', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'roleId') {
					if (options?.extractValue) {
						return 'role_123';
					}
					return { cachedResultName: '   ' };
				}
				if (name === 'inputMode') return 'structured';
				if (name === 'prefillRoleName') return true;
				if (name === 'name') return '';
				if (name === 'description') return 'Updated description';
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { name: 'Fetched Name' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Fetched Name',
			description: 'Updated description',
		});
	});

	it('should prefer API name over cached locator name when both are available', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'roleId') {
					if (options?.extractValue) {
						return 'role_123';
					}
					return { cachedResultName: 'Cached Name' };
				}
				if (name === 'inputMode') return 'structured';
				if (name === 'prefillRoleName') return true;
				if (name === 'name') return '';
				if (name === 'description') return 'Updated description';
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { name: 'API Name' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'API Name',
			description: 'Updated description',
		});
	});

	it('should prefill missing name via API fetch when cache name is unavailable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { name: 'Current Role Name' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Current Role Name',
			description: 'Updated description',
		});
	});

	it('should prefill missing name via API fetch when response has direct name', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ name: 'Root Name' })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Root Name',
			description: 'Updated description',
		});
	});

	it('should use recoverable-mode preflight role data to prefill name without an extra fetch', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Prefetched Name' }] })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles', {}, {});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Prefetched Name',
			description: 'Updated description',
		});
	});

	it('should cache fallback detail fetch in recoverable mode without rerunning role roster preflight', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123' }] })
			.mockResolvedValueOnce({ data: { name: 'Fetched Name' } })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(3);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles', {}, {});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(3, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Fetched Name',
			description: 'Updated description',
		});
	});

	it('should allow description-only update when prefill is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return false;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/profiles/role_123', {
			description: 'Updated description',
		});
	});

	it('should fallback to cached locator name when API prefill fetch fails', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_defaultValue?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'roleId') {
					if (options?.extractValue) {
						return 'role_123';
					}
					return { cachedResultName: 'Cached Name' };
				}
				if (name === 'inputMode') return 'structured';
				if (name === 'prefillRoleName') return true;
				if (name === 'name') return '';
				if (name === 'description') return 'Updated description';
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('network issue'))
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles/role_123');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Cached Name',
			description: 'Updated description',
		});
	});

	it('should throw when API prefill response has no resolvable role name', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: { title: 'No name key' } });

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Could not determine current role name for prefill. Provide Name explicitly.',
		);
	});

	it('should include prefill fetch error details when name cannot be resolved', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('network issue'));

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Fetch error: network issue',
		);
	});

	it('should keep generic prefill error message when fetch throws non-Error value', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce('network issue');

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Could not determine current role name for prefill. Provide Name explicitly.',
		);
	});

	it('should throw when API prefill response is not an object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return 'Updated description';
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce('invalid-response' as unknown as never);

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Could not determine current role name for prefill. Provide Name explicitly.',
		);
	});

	it('should throw error when no structured fields are provided', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'structured';
			if (name === 'prefillRoleName') return true;
			if (name === 'name') return '';
			if (name === 'description') return '';
			return undefined;
		});

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Provide at least one field to update',
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'update';
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'raw';
			if (name === 'roleUpdates') return { name: 'Senior Admin', description: 'Senior role' };
			return undefined;
		});

		let thrownError: unknown;
		try {
			await update.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'role',
			operation: 'update',
			requiredScopes: [SCOPES.ORGANISATION_UPDATE],
			missingScopes: [SCOPES.ORGANISATION_UPDATE],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should update role successfully in raw mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'raw';
			if (name === 'roleUpdates') {
				return '{"name":"Senior Admin","description":"Senior administrators"}';
			}
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/profiles/role_123', {
			name: 'Senior Admin',
			description: 'Senior administrators',
		});
	});

	it('should perform recoverable-mode preflight before raw update success', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'raw';
			if (name === 'roleUpdates') return { name: 'Senior Admin' };
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Existing Role' }] })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/profiles', {}, {});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/v2/profiles/role_123', {
			name: 'Senior Admin',
		});
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);
		const grantedScopes = `${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'inputMode') return 'raw';
				if (name === 'roleUpdates') {
					return itemIndex === 0 ? {} : { name: 'Senior Admin' };
				}
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			message: 'Role Updates cannot be empty',
			resource: 'role',
			operation: 'update',
			reason: 'INVALID_ROLE_UPDATES',
			role_id: 'role_123',
		});
		expect(result[1].json).toMatchObject({
			status: 'success',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		const [method, endpoint, payload] = mockZohoCliqApiRequest.mock.calls[1];
		expect(method).toBe('PUT');
		expect(endpoint).toContain('/api/v2/profiles/role_123');
		expect(payload).toEqual({ name: 'Senior Admin' });
	});

	it('should recover invalid input mode when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'inputMode') return 'broken';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'update',
			reason: 'INVALID_INPUT_MODE',
			role_id: 'role_123',
			message: 'Input Mode must be either "structured" or "raw"',
		});
	});

	it('should recover invalid role IDs when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role/invalid';
			if (name === 'inputMode') return 'raw';
			if (name === 'roleUpdates') return { name: 'Senior Admin' };
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'update',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
			message: 'Invalid Role ID format',
		});
	});
});
