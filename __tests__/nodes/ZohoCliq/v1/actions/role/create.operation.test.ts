import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/role/create.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Role - Create Operation', () => {
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

	it('should create role successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_CREATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'structured';
			if (name === 'name') return 'Admin';
			if (name === 'profileType') return 'Members';
			if (name === 'description') return 'Leadership role';
			if (name === 'cloneId') return '';
			if (name === 'userIds') return '';
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ role_id: 'role_123' });

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/profiles', {
			name: 'Admin',
			profile_type: 'Members',
			description: 'Leadership role',
		});
	});

	it('should throw error when role profile type is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_CREATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'structured';
			if (name === 'name') return 'Admin';
			if (name === 'profileType') return '';
			if (name === 'description') return '';
			if (name === 'cloneId') return '';
			if (name === 'userIds') return '';
			return undefined;
		});

		await expect(create.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Profile Type is required',
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'resource') return 'role';
			if (name === 'operation') return 'create';
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') return { name: 'Admin', profile_type: 'Members' };
			return undefined;
		});

		let thrownError: unknown;
		try {
			await create.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'create',
			requiredScopes: [SCOPES.ORGANISATION_CREATE],
			missingScopes: [SCOPES.ORGANISATION_CREATE],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should include optional clone ID and user IDs in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_CREATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'structured';
			if (name === 'name') return 'Admin';
			if (name === 'profileType') return 'Cliq Admin';
			if (name === 'description') return '';
			if (name === 'cloneId') return ' role_123 ';
			if (name === 'userIds') return '62913657,63569660';
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ role_id: 'role_123' });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/profiles', {
			name: 'Admin',
			profile_type: 'Cliq Admin',
			clone_id: 'role_123',
			user_ids: ['62913657', '63569660'],
		});
	});

	it('should create role successfully in raw mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_CREATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') {
				return '{"name":"Admin","profile_type":"Members"}';
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ role_id: 'role_123' });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/profiles', {
			name: 'Admin',
			profile_type: 'Members',
		});
	});

	it('should preserve raw user_ids arrays from JSON input', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_CREATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') {
				return {
					name: 'Admin',
					profile_type: 'Members',
					user_ids: ['62913657', '63569660'],
				};
			}
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ role_id: 'role_123' });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/profiles', {
			name: 'Admin',
			profile_type: 'Members',
			user_ids: ['62913657', '63569660'],
		});
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);
		const grantedScopes = SCOPES.ORGANISATION_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number) => {
				if (name === 'inputMode') return 'structured';
				if (name === 'name') return 'Admin';
				if (name === 'profileType') return itemIndex === 0 ? '' : 'Members';
				if (name === 'description') return '';
				if (name === 'cloneId') return '';
				if (name === 'userIds') return '';
				return undefined;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ role_id: 'role_123' });

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			message: 'Profile Type is required',
			resource: 'role',
			operation: 'create',
			reason: 'INVALID_PROFILE_TYPE',
		});
		expect(result[1].json).toMatchObject({
			role_id: 'role_123',
		});
	});

	it('should recover invalid input mode when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'broken';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'create',
			reason: 'INVALID_INPUT_MODE',
			hint: 'Use either Using Fields Below or Using JSON for the role create request.',
			message: 'Input Mode must be either "structured" or "raw"',
		});
	});

	it('should recover invalid role payload details when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') return { unsupported: true };
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'create',
			reason: 'INVALID_ROLE_PAYLOAD',
		});
	});

	it('should recover invalid clone ID input when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') {
				return {
					name: 'Admin',
					profile_type: 'Members',
					clone_id: 'role/invalid',
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'create',
			reason: 'INVALID_ROLE_RELATION_INPUT',
			clone_id: 'role/invalid',
		});
	});

	it('should recover missing clone source roles when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_CREATE},${SCOPES.ORGANISATION_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') {
				return {
					name: 'Admin',
					profile_type: 'Members',
					clone_id: 'role_404',
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ profiles: [{ id: 'role_123', name: 'Admin' }] });

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'create',
			reason: 'CLONE_ROLE_NOT_FOUND',
			clone_id: 'role_404',
			message: 'Clone source role not found. The clone_role_id provided does not exist.',
			hint: 'Use List Roles to retrieve a valid role ID to clone from.',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/profiles', {}, {});
	});

	it('should recover invalid user IDs when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') {
				return {
					name: 'Admin',
					profile_type: 'Members',
					user_ids: ['bad/id'],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'create',
			reason: 'INVALID_ROLE_RELATION_INPUT',
			user_ids: 'bad/id',
		});
	});

	it('should recover missing user IDs via Users endpoint preflight when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = `${SCOPES.ORGANISATION_CREATE},${SCOPES.USERS_READ}`;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'inputMode') return 'raw';
			if (name === 'roleDefinition') {
				return {
					name: 'Admin',
					profile_type: 'Members',
					user_ids: ['62913657', '63569660'],
				};
			}
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockImplementation(async (method, endpoint) => {
			if (method === 'GET' && endpoint === '/api/v2/users') {
				return {
					users: [{ user_id: '62913657', display_name: 'Valid User' }],
				};
			}
			throw new Error(`Unexpected request: ${method} ${endpoint}`);
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'create',
			reason: 'USER_IDS_NOT_FOUND',
			user_ids: ['62913657', '63569660'],
			invalid_user_ids: ['63569660'],
			message:
				'One or more user IDs were not found. The provided user IDs do not exist in this organization.',
			hint: 'Use Get User or List Users to retrieve valid user IDs and try again.',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalledWith(
			'POST',
			'/api/v2/profiles',
			expect.anything(),
		);
	});
});
