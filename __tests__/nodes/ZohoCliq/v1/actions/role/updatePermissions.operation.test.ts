import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import * as n8nWorkflow from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import * as updatePermissions from '../../../../../../nodes/ZohoCliq/v1/actions/role/updatePermissions.operation';
import * as common from '../../../../../../nodes/ZohoCliq/v1/actions/role/common';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import {
	isEmptyOrganisationCustomRuleConfig,
	sanitizePermissionsListForUpdate,
} from '../../../../../../nodes/ZohoCliq/v1/actions/role/updatePermissions.operation';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - Update Permissions Operation (Advanced)', () => {
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

	it('should update role permissions with raw JSON payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'organisation_member', action: 'attachments', status: 'disabled' }],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await updatePermissions.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [{ module: 'organisation_member', action: 'attachments', status: 'disabled' }],
			},
		);
		expect(result[0].json).toMatchObject({
			success: true,
			resource: 'role',
			operation: 'updatePermissions',
			operationIntent: 'updatePermissionsAdvanced',
			roleId: 'role_123',
			permissionCount: 1,
		});
		expect(result[0].json).not.toHaveProperty('payload');
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'updatePermissions';
			if (name === 'roleId') return 'role_123';
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'organisation_member', action: 'attachments', status: 'disabled' }],
				};
			}
			return undefined;
		});

		let thrownError: unknown;
		try {
			await updatePermissions.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toMatch(
			/Missing OAuth scope for|Operation not permitted, make sure you have the right permissions/,
		);
		expect(thrownError).toHaveProperty('zohoCliqScopeErrorPayload');
	});

	it('should return raw API response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const apiResponse = { status: 'success', id: 'resp_1' };

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'permissionUpdates') {
				return '{"list":[{"module":"organisation_member","action":"attachments","status":"disabled"}]}';
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue(apiResponse);

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);
		expect(result[0].json).toEqual({ ...apiResponse, updated: true });
	});

	it('should return enhanced metadata when API responds with an empty string', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') {
				return '{"list":[{"module":"organisation_member","action":"attachments","status":"disabled"}]}';
			}
			return undefined;
		});
		(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue('');

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: true,
			resource: 'role',
			operation: 'updatePermissions',
			operationIntent: 'updatePermissionsAdvanced',
			roleId: 'role_123',
			permissionCount: 1,
			sanitizedPermissionCount: 1,
			filteredOutCount: 0,
			batched: false,
			batchCount: 1,
			apiResponse: { data: '' },
		});
	});

	it('should place Enable Enhanced Output before notices', () => {
		const propertyNames = updatePermissions.description.map((property) => property.name);
		expect(propertyNames).toContain('enableEnhancedOutput');
		expect(propertyNames).toContain('updateRolePermissionsDocsNotice');
		expect(propertyNames).toContain('updateRolePermissionsAiToolGuideNotice');

		const enhancedOutputIndex = propertyNames.indexOf('enableEnhancedOutput');
		const docsNoticeIndex = propertyNames.indexOf('updateRolePermissionsDocsNotice');
		const aiToolNoticeIndex = propertyNames.indexOf('updateRolePermissionsAiToolGuideNotice');

		expect(enhancedOutputIndex).toBeGreaterThanOrEqual(0);
		expect(docsNoticeIndex).toBeGreaterThanOrEqual(0);
		expect(aiToolNoticeIndex).toBeGreaterThanOrEqual(0);
		expect(enhancedOutputIndex).toBeLessThan(docsNoticeIndex);
		expect(enhancedOutputIndex).toBeLessThan(aiToolNoticeIndex);
	});

	it('should set enhanced permissionCount to 0 when validated payload has non-array list', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const validateSpy = jest
			.spyOn(common, 'validateRolePermissionUpdatePayload')
			.mockReturnValue({ list: 'not-array' } as never);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') return { list: [{ module: 'users', status: 'enabled' }] };
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: true,
			permissionCount: 0,
		});

		validateSpy.mockRestore();
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number) => {
				if (name === 'roleId') return 'role_123';
				if (name === 'enableEnhancedOutput') return false;
				if (name === 'permissionUpdates') {
					return itemIndex === 0
						? { list: [] }
						: {
								list: [
									{ module: 'organisation_member', action: 'attachments', status: 'disabled' },
								],
							};
				}
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ profiles: [{ id: 'role_123', name: 'Admin' }] })
			.mockResolvedValueOnce({ status: 'success' });

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'INVALID_PERMISSIONS_UPDATE_PAYLOAD',
			role_id: 'role_123',
			message: 'Permissions Updates must include a non-empty "list" array',
		});
		expect(result[1].json).toEqual({ updated: true, status: 'success' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should split large payload into multiple batch requests when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 2;
			if (name === 'batchWaitMs') return 0;
			if (name === 'permissionUpdates') {
				return {
					list: [
						{ module: 'users', action: 'create', status: 'enabled' },
						{ module: 'users', action: 'delete', status: 'disabled' },
						{ module: 'team_channels', action: 'create', status: 'enabled' },
					],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [
					{ module: 'users', action: 'create', status: 'enabled' },
					{ module: 'users', action: 'delete', status: 'disabled' },
				],
			},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [{ module: 'team_channels', action: 'create', status: 'enabled' }],
			},
		);
		expect(result[0].json).toMatchObject({
			success: true,
			resource: 'role',
			operation: 'updatePermissions',
			batched: true,
			batchSize: 2,
			batchCount: 2,
			permissionCount: 3,
		});
		expect(result[0].json).toHaveProperty('apiResponse');
	});

	it('should wait between batched requests when configured', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const waitSpy = jest.spyOn(n8nWorkflow, 'sleep').mockResolvedValue(undefined as never);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 2;
			if (name === 'batchWaitMs') return 150;
			if (name === 'permissionUpdates') {
				return {
					list: [
						{ module: 'users', action: 'create', status: 'enabled' },
						{ module: 'users', action: 'delete', status: 'disabled' },
						{ module: 'team_channels', action: 'create', status: 'enabled' },
					],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(waitSpy).toHaveBeenCalledTimes(1);
		expect(waitSpy).toHaveBeenCalledWith(150);
		waitSpy.mockRestore();
	});

	it('should filter read-only get actions and custom_admin module before API call', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'enableBatchUpdates') return false;
			if (name === 'permissionUpdates') {
				return {
					list: [
						{ module: 'users', action: 'get', status: 'disabled' },
						{ module: 'custom_admin', action: 'edit', status: 'disabled' },
						{ module: 'users', action: 'create', status: 'enabled' },
					],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [{ module: 'users', action: 'create', status: 'enabled' }],
			},
		);
		expect(result[0].json).toMatchObject({
			success: true,
			permissionCount: 3,
			sanitizedPermissionCount: 1,
			filteredOutCount: 2,
		});
	});

	it('should remove empty organisation_member custom_rule config values before API call', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return false;
			if (name === 'permissionUpdates') {
				return {
					list: [
						{
							module: 'organisation_member',
							status: 'disabled',
							configs: [{ name: 'custom_rule', value: { enabled: [], disabled: [] } }],
						},
					],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [{ module: 'organisation_member', status: 'disabled' }],
			},
		);
	});

	it('should retain non-empty custom_rule configs and non-custom configs', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return false;
			if (name === 'permissionUpdates') {
				return {
					list: [
						{
							module: 'organisation_member',
							status: 'disabled',
							configs: [
								{ name: 'custom_rule', value: { enabled: ['message'], disabled: [] } },
								{ name: 'another_config', value: 'raw' },
							],
						},
					],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [
					{
						module: 'organisation_member',
						status: 'disabled',
						configs: [
							{ name: 'custom_rule', value: { enabled: ['message'], disabled: [] } },
							{ name: 'another_config', value: 'raw' },
						],
					},
				],
			},
		);
	});

	it('should keep custom_rule config when value is not object/array shape', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return false;
			if (name === 'permissionUpdates') {
				return {
					list: [
						{
							module: 'organisation_member',
							status: 'disabled',
							configs: [{ name: 'custom_rule', value: ['invalid-shape'] }],
						},
					],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/profiles/role_123/permissions',
			{
				list: [
					{
						module: 'organisation_member',
						status: 'disabled',
						configs: [{ name: 'custom_rule', value: ['invalid-shape'] }],
					},
				],
			},
		);
	});

	it('should skip API call when all rows are filtered out as unsupported', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'enableBatchUpdates') return false;
			if (name === 'permissionUpdates') {
				return {
					list: [
						{ module: 'users', action: 'get', status: 'disabled' },
						{ module: 'custom_admin', action: 'create', status: 'disabled' },
					],
				};
			}
			return undefined;
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		expect(result[0].json).toMatchObject({
			success: true,
			permissionCount: 2,
			sanitizedPermissionCount: 0,
			filteredOutCount: 2,
			apiResponse: {
				apiCallSkipped: true,
				batchCount: 0,
			},
		});
		expect((result[0].json as { batchCount?: number }).batchCount).toBe(0);
	});

	it('should recover invalid batch size when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 0;
			if (name === 'batchWaitMs') return 0;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'INVALID_BATCH_SIZE',
			role_id: 'role_123',
			message: 'Batch Size must be a whole number greater than 0.',
		});
	});

	it('should recover invalid batch wait when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 1;
			if (name === 'batchWaitMs') return -1;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'INVALID_BATCH_WAIT',
			role_id: 'role_123',
		});
	});

	it('should recover invalid role id when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role/invalid';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'INVALID_ROLE_ID',
			role_id: 'role/invalid',
		});
	});

	it('should recover unsafe payload errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const parseSpy = jest.spyOn(common, 'parseRolePayloadInput').mockImplementationOnce(() => {
			throw new Error('unsafe key detected');
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') return { list: [{ module: 'users', status: 'enabled' }] };
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'UNSAFE_PERMISSIONS_UPDATE_PAYLOAD',
			role_id: 'role_123',
			message: 'unsafe key detected',
		});

		parseSpy.mockRestore();
	});

	it('should recover json-object payload errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const parseSpy = jest.spyOn(common, 'parseRolePayloadInput').mockImplementationOnce(() => {
			throw new Error('payload must be a JSON object');
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') return { list: [{ module: 'users', status: 'enabled' }] };
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'UNSAFE_PERMISSIONS_UPDATE_PAYLOAD',
			role_id: 'role_123',
			message: 'payload must be a JSON object',
		});

		parseSpy.mockRestore();
	});

	it('should recover admin-only API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 403,
				data: { message: 'operation_not_allowed' },
			},
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'ROLE_PERMISSIONS_UPDATE_NOT_ALLOWED',
			role_id: 'role_123',
		});
	});

	it('should recover not-an-organization-admin API errors when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			response: {
				status: 403,
				data: { message: 'not_an_organization_admin' },
			},
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.ORGANISATION_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'ROLE_PERMISSIONS_UPDATE_NOT_ALLOWED',
			role_id: 'role_123',
		});
	});

	it('should recover missing roles as ROLE_NOT_FOUND when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_missing';
			if (name === 'enableEnhancedOutput') return true;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			profiles: [{ id: 'role_123', name: 'Admin' }],
		});

		const result = await updatePermissions.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.ORGANISATION_UPDATE},${SCOPES.ORGANISATION_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'updatePermissions',
			reason: 'ROLE_NOT_FOUND',
			role_id: 'role_missing',
			message: 'Role not found. The role ID provided does not exist in this organization.',
			hint: 'Use List Roles to retrieve valid role IDs and try again.',
		});
	});

	it('should evaluate custom_rule config emptiness helper branches', () => {
		expect(isEmptyOrganisationCustomRuleConfig({ name: 'other', value: {} })).toBe(false);
		expect(isEmptyOrganisationCustomRuleConfig({ value: {} } as never)).toBe(false);
		expect(
			isEmptyOrganisationCustomRuleConfig({ name: 'custom_rule', value: 'bad' as never }),
		).toBe(false);
		expect(isEmptyOrganisationCustomRuleConfig({ name: 'custom_rule', value: ['bad'] })).toBe(
			false,
		);
		expect(
			isEmptyOrganisationCustomRuleConfig({
				name: 'custom_rule',
				value: { disabled: [] },
			}),
		).toBe(false);
		expect(
			isEmptyOrganisationCustomRuleConfig({
				name: 'custom_rule',
				value: { enabled: [] },
			}),
		).toBe(false);
		expect(
			isEmptyOrganisationCustomRuleConfig({
				name: 'custom_rule',
				value: { enabled: 'bad', disabled: [] },
			} as never),
		).toBe(false);
		expect(
			isEmptyOrganisationCustomRuleConfig({
				name: 'custom_rule',
				value: { enabled: [], disabled: 'bad' },
			} as never),
		).toBe(false);
		expect(
			isEmptyOrganisationCustomRuleConfig({
				name: 'custom_rule',
				value: { enabled: ['message'], disabled: [] },
			}),
		).toBe(false);
		expect(
			isEmptyOrganisationCustomRuleConfig({
				name: 'custom_rule',
				value: { enabled: [], disabled: ['message'] },
			}),
		).toBe(false);
		expect(
			isEmptyOrganisationCustomRuleConfig({
				name: 'custom_rule',
				value: { enabled: [], disabled: [] },
			}),
		).toBe(true);
	});

	it('should sanitize list and preserve non-empty configs', () => {
		const result = sanitizePermissionsListForUpdate([
			{ module: 'users', action: 'get', status: 'disabled' },
			{ module: 'custom_admin', action: 'edit', status: 'disabled' },
			{ module: 'custom_admin', status: 'disabled' },
			{ module: undefined, action: 'create', status: 'enabled' },
			{
				module: 'organisation_member',
				status: 'disabled',
				configs: [
					{ name: 'custom_rule', value: { enabled: [], disabled: [] } },
					{ name: 'custom_rule', value: { enabled: ['message'], disabled: [] } },
					{ name: 'other', value: ['kept'] },
				],
			},
			{
				module: 'organisation_member',
				action: 'message',
				configs: [{ name: 'custom_rule', value: { enabled: [], disabled: [] } }],
			},
			{
				module: 'organisation_member',
				configs: [{ name: 'custom_rule', value: { enabled: [], disabled: [] } }],
			},
		] as never);

		expect(result.sanitizedList).toEqual([
			{ module: undefined, action: 'create', status: 'enabled' },
			{
				module: 'organisation_member',
				status: 'disabled',
				configs: [
					{ name: 'custom_rule', value: { enabled: ['message'], disabled: [] } },
					{ name: 'other', value: ['kept'] },
				],
			},
		]);
		expect(result.filteredEntries).toEqual(
			expect.arrayContaining([
				{ module: 'users', action: 'get', reason: 'read_only_action' },
				{ module: 'custom_admin', action: 'edit', reason: 'module_not_updatable' },
				{ module: 'custom_admin', reason: 'module_not_updatable' },
				{ module: 'organisation_member', reason: 'empty_custom_rule_config' },
				{
					module: 'organisation_member',
					action: 'message',
					reason: 'empty_custom_rule_config',
				},
				{ module: 'organisation_member', action: 'message', reason: 'no_effective_update' },
				{ module: 'organisation_member', reason: 'empty_custom_rule_config' },
				{ module: 'organisation_member', reason: 'no_effective_update' },
			]),
		);
	});

	it('should throw for invalid batch size when batching is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 0;
			if (name === 'batchWaitMs') return 0;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			return undefined;
		});

		await expect(
			updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toThrow('Batch Size must be a whole number greater than 0.');
	});

	it('should throw for fractional batch size when batching is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 1.5;
			if (name === 'batchWaitMs') return 0;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			return undefined;
		});

		await expect(
			updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toThrow('Batch Size must be a whole number greater than 0.');
	});

	it('should throw for negative batch wait when batching is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 2;
			if (name === 'batchWaitMs') return -1;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			return undefined;
		});

		await expect(
			updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toThrow(
			'Wait Between Batches (Milliseconds) must be a whole number greater than or equal to 0.',
		);
	});

	it('should throw for fractional batch wait when batching is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'roleId') return 'role_123';
			if (name === 'enableEnhancedOutput') return false;
			if (name === 'enableBatchUpdates') return true;
			if (name === 'batchSize') return 2;
			if (name === 'batchWaitMs') return 1.5;
			if (name === 'permissionUpdates') {
				return {
					list: [{ module: 'users', action: 'create', status: 'enabled' }],
				};
			}
			return undefined;
		});

		await expect(
			updatePermissions.execute.call(mockExecuteFunctions, items, SCOPES.ORGANISATION_UPDATE),
		).rejects.toThrow(
			'Wait Between Batches (Milliseconds) must be a whole number greater than or equal to 0.',
		);
	});
});
