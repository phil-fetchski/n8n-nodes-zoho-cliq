import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { TINY_PNG_BASE64 } from '../../../../../helpers/base64Images';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/user/create.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - User - Create Operation', () => {
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
			continueOnFail: jest.fn(() => false),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	function mockStructuredCreateParameters(overrides: Record<string, unknown> = {}): void {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					customFields: {},
					...overrides,
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
	}

	function mockAgentToolCreateParameters(overrides: Record<string, unknown> = {}): void {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'agentTool',
					agentToolEmailId: 'agent.user@example.com',
					agentToolFirstName: '',
					agentToolCustomFields: {},
					...overrides,
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
	}

	it('should create user successfully using structured fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('new')
			.mockReturnValueOnce({
				lastName: 'USER',
				displayName: 'New User',
				teamIds: 'T123,T456',
				channelIds: 'C123,C456',
				normalizeNameCasing: true,
			})
			.mockReturnValueOnce({});

		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U123' }] });

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [
				{
					email_id: 'new.user@example.com',
					first_name: 'New',
					last_name: 'User',
					display_name: 'New User',
					team_ids: ['T123', 'T456'],
					channel_ids: ['C123', 'C456'],
				},
			],
		});
	});

	it('should build structured payload from top-level fields when legacy collection is empty', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'top.level@example.com',
					firstName: 'amy',
					additionalFields: {},
					customFields: {},
					addProfileDetails: true,
					addOrganizationDetails: true,
					addLocationDetails: true,
					lastName: 'SMITH',
					normalizeNameCasing: true,
					displayName: 'Amy S',
					teamIds: '876543210,876543211',
					country: 'us',
					language: 'EN',
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U333' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [
				{
					email_id: 'top.level@example.com',
					first_name: 'Amy',
					last_name: 'Smith',
					display_name: 'Amy S',
					team_ids: ['876543210', '876543211'],
					country: 'US',
					language: 'en',
				},
			],
		});
	});

	it('should create user successfully using agent/tool setup fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockAgentToolCreateParameters({
			agentToolFirstName: 'amy',
			agentToolLastName: 'SMITH',
			agentToolNormalizeNameCasing: true,
			agentToolDisplayName: 'Amy S',
			agentToolDepartmentId: 'DEP_123',
			agentToolDesignationId: 'DES_123',
			agentToolReportingToZuid: 'ZUID_123',
			agentToolTeamIds: 'TEAM_1,TEAM_2',
			agentToolChannelIds: 'CHAN_1,CHAN_2',
			agentToolCountry: 'us',
			agentToolLanguage: 'EN',
			agentToolCustomFields: { workplace_name: 'HQ' },
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ departments: [{ id: 'DEP_123' }] })
			.mockResolvedValueOnce({ designations: [{ id: 'DES_123' }] })
			.mockResolvedValueOnce({ id: 'ZUID_123' })
			.mockResolvedValueOnce({ id: 'TEAM_1' })
			.mockResolvedValueOnce({ id: 'TEAM_2' })
			.mockResolvedValueOnce({ id: 'CHAN_1' })
			.mockResolvedValueOnce({ id: 'CHAN_2' })
			.mockResolvedValueOnce({ users: [{ user_id: 'U444' }] });

		await create.execute.call(
			mockExecuteFunctions,
			items,
			[
				SCOPES.USERS_CREATE,
				SCOPES.DEPARTMENT_LIST,
				SCOPES.DESIGNATIONS_READ,
				SCOPES.USERS_READ,
				SCOPES.TEAMS_READ,
				SCOPES.CHANNELS_READ,
			].join(','),
		);

		expect(mockZohoCliqApiRequest).toHaveBeenLastCalledWith('POST', '/api/v2/users', {
			users: [
				{
					email_id: 'agent.user@example.com',
					first_name: 'Amy',
					last_name: 'Smith',
					display_name: 'Amy S',
					department_id: 'DEP_123',
					designation_id: 'DES_123',
					reporting_to_zuid: 'ZUID_123',
					team_ids: ['TEAM_1', 'TEAM_2'],
					channel_ids: ['CHAN_1', 'CHAN_2'],
					country: 'US',
					language: 'en',
					workplace_name: 'HQ',
				},
			],
		});
	});

	it('should ignore null optional agent/tool setup values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockAgentToolCreateParameters({
			agentToolFirstName: '',
			agentToolLastName: null,
			agentToolNormalizeNameCasing: null,
			agentToolEmployeeId: null,
			agentToolDisplayName: null,
			agentToolMobile: null,
			agentToolPhone: null,
			agentToolExtension: null,
			agentToolImageData: undefined,
			agentToolChannelIds: null,
			agentToolDepartmentId: null,
			agentToolDesignationId: null,
			agentToolReportingToZuid: null,
			agentToolTeamIds: null,
			agentToolCountry: null,
			agentToolLanguage: null,
			agentToolTimezone: null,
			agentToolWorkLocation: null,
			agentToolCustomFields: '{}',
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ users: [{ user_id: 'U445' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'agent.user@example.com' }],
		});
	});

	it('should create user successfully using raw JSON payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({
				users: [{ email_id: 'raw.user@example.com', first_name: 'Raw' }],
			});

		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U999' }] });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'raw.user@example.com', first_name: 'Raw' }],
		});
	});

	it('should create user successfully using raw JSON string payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"users":[{"email_id":"raw.string@example.com"}]}');

		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U1000' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'raw.string@example.com' }],
		});
	});

	it('should reject unsupported input modes explicitly', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValueOnce('legacy');

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Input Mode must be one of: structured, agentTool, raw');
	});

	it('should throw a clear error when raw users payload JSON is invalid', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"users":[');

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Users Payload must be valid JSON');
	});

	it('should wrap primitive API response without warnings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue('ok' as unknown as IDataObject);

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result[0].json).toEqual({ data: 'ok' });
	});

	it('should normalize raw image_data data URLs and include them in the create payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({
				users: [
					{
						email_id: 'raw.user@example.com',
						image_data: `data:image/png;charset=utf-8;base64,${TINY_PNG_BASE64}`,
					},
				],
			});

		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U1001' }] });

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'raw.user@example.com', image_data: TINY_PNG_BASE64 }],
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should include custom fields in structured payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_CREATE;
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: { workplace_name: 'HQ' },
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U101' }] });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'new.user@example.com', workplace_name: 'HQ' }],
		});
	});

	it('should validate optional structured targets through shared preflights when recoverable mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockStructuredCreateParameters({
			additionalFields: {
				departmentId: 'DEP_1',
				designationId: 'DES_1',
				reportingToZuid: 'ZUID_1',
				teamIds: 'TEAM_1',
				channelIds: 'CHAN_1',
			},
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ departments: [{ id: 'DEP_1' }] })
			.mockResolvedValueOnce({ designations: [{ id: 'DES_1' }] })
			.mockResolvedValueOnce({ id: 'ZUID_1' })
			.mockResolvedValueOnce({ id: 'TEAM_1' })
			.mockResolvedValueOnce({ id: 'CHAN_1' })
			.mockResolvedValueOnce({ users: [{ user_id: 'U555' }] });

		await create.execute.call(
			mockExecuteFunctions,
			items,
			[
				SCOPES.USERS_CREATE,
				SCOPES.DEPARTMENT_LIST,
				SCOPES.DESIGNATIONS_READ,
				SCOPES.USERS_READ,
				SCOPES.TEAMS_READ,
				SCOPES.CHANNELS_READ,
			].join(','),
		);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/departments',
			{},
			{ limit: 100 },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/designations',
			{},
			{ limit: 100 },
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(3, 'GET', '/api/v2/users/ZUID_1', {});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(4, 'GET', '/api/v2/teams/TEAM_1');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(5, 'GET', '/api/v2/channels/CHAN_1');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(6, 'POST', '/api/v2/users', {
			users: [
				{
					email_id: 'new.user@example.com',
					department_id: 'DEP_1',
					designation_id: 'DES_1',
					reporting_to_zuid: 'ZUID_1',
					team_ids: ['TEAM_1'],
					channel_ids: ['CHAN_1'],
				},
			],
		});
	});

	it('should skip optional structured preflights when lookup scopes are unavailable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockStructuredCreateParameters({
			additionalFields: {
				departmentId: 'DEP_1',
				designationId: 'DES_1',
				reportingToZuid: 'ZUID_1',
				teamIds: 'TEAM_1',
				channelIds: 'CHAN_1',
			},
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ users: [{ user_id: 'U556' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [
				{
					email_id: 'new.user@example.com',
					department_id: 'DEP_1',
					designation_id: 'DES_1',
					reporting_to_zuid: 'ZUID_1',
					team_ids: ['TEAM_1'],
					channel_ids: ['CHAN_1'],
				},
			],
		});
	});

	it('should parse string customFields default object without validation error', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: '{}',
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U102' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'new.user@example.com' }],
		});
	});

	it('should treat empty-string customFields as an empty object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: '   ',
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U102B' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'new.user@example.com' }],
		});
	});

	it('should ignore null organization/location values when related toggles are enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'nulls.user@example.com',
					firstName: '',
					additionalFields: {},
					addOrganizationDetails: true,
					addLocationDetails: true,
					channelIds: null,
					departmentId: null,
					designationId: null,
					reportingToZuid: null,
					teamIds: null,
					country: null,
					language: null,
					timezone: null,
					workLocation: null,
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U102A' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'nulls.user@example.com' }],
		});
	});

	it('should map all supported structured fields into the request payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USERS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('First')
			.mockReturnValueOnce({
				lastName: 'Last',
				phone: '+1-555-1000',
				mobile: '+1-555-2000',
				timezone: 'America/New_York',
				language: 'en',
				country: 'US',
				designationId: 'DES_1',
				departmentId: 'DEP_1',
				reportingToZuid: 'ZUID_1',
				workLocation: 'HQ',
				extension: '1234',
				employeeId: 'EMP_1',
			})
			.mockReturnValueOnce({});

		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U777' }] });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [
				{
					email_id: 'new.user@example.com',
					first_name: 'First',
					last_name: 'Last',
					phone: '+1-555-1000',
					mobile: '+1-555-2000',
					timezone: 'America/New_York',
					language: 'en',
					country: 'US',
					designation_id: 'DES_1',
					department_id: 'DEP_1',
					reporting_to_zuid: 'ZUID_1',
					work_location: 'HQ',
					extension: '1234',
					employee_id: 'EMP_1',
				},
			],
		});
	});

	it('should throw error when raw payload is not an object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce([]);

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Users Payload must be a JSON object with a "users" array');
	});

	it('should throw error when raw payload users array is empty', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ users: [] });

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Users Payload must include a non-empty "users" array');
	});

	it('should throw error when raw payload user is missing email_id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ users: [{}] });

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('users[0].email_id is required');
	});

	it('should throw error when raw payload contains non-object user record', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ users: ['bad'] });

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('users[0] must be an object');
	});

	it('should throw error for invalid language format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({ language: 'en-US-1' })
			.mockReturnValueOnce({});

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Invalid Language format');
	});

	it('should throw error for invalid country format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({ country: 'USA' })
			.mockReturnValueOnce({});

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Invalid Country format');
	});

	it('should throw error when customFields is not an object in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Custom Fields must be a JSON object');
	});

	it('should throw error when customFields contains invalid JSON string in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: '{"bad"',
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Custom Fields must be a valid JSON object');
	});

	it('should include structured imageData in the create payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({ imageData: `data:image/png;base64,${TINY_PNG_BASE64}` })
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U201' }] });

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'new.user@example.com', image_data: TINY_PNG_BASE64 }],
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should throw when structured imageData is invalid', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({ imageData: 'invalid-***' })
			.mockReturnValueOnce({});

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Image Data must be a valid base64-encoded string');
	});

	it('should throw when raw image_data is invalid', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({
				users: [{ email_id: 'raw.user@example.com', image_data: 'invalid-***' }],
			});

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('users[0].image_data must be a valid base64-encoded string');
	});

	it('should preserve existing API warnings when image_data is valid', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({
				users: [{ email_id: 'raw.user@example.com', image_data: TINY_PNG_BASE64 }],
			});
		mockZohoCliqApiRequest.mockResolvedValue({
			users: [{ user_id: 'U205' }],
			_warnings: [
				{ field: 'existing.field', reason: 'Existing warning', action: 'Existing action' },
			],
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);
		const warnings = (result[0].json as { _warnings: Array<{ field: string }> })._warnings;

		expect(warnings).toHaveLength(1);
		expect(warnings[0].field).toBe('existing.field');
	});

	it('should warn when empty raw image_data is removed', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({
				users: [{ email_id: 'raw.user@example.com', image_data: '   ' }],
			});
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U203' }] });

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'raw.user@example.com' }],
		});
		expect(result[0].json).toEqual(
			expect.objectContaining({
				_warnings: expect.arrayContaining([
					expect.objectContaining({
						field: 'users[0].image_data',
						reason: 'Removed users[0].image_data because it was empty.',
					}),
				]),
			}),
		);
	});

	it('should ignore empty structured imageData without a warning', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({ imageData: '   ' })
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U204' }] });

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'new.user@example.com' }],
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should throw error when custom field conflicts with reserved field', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({ displayName: 'Reserved Name' })
			.mockReturnValueOnce({ display_name: 'custom value' });

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('conflicts with a reserved user field');
	});

	it('should skip team_ids and channel_ids when provided CSV values parse to empty lists', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('new.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({
				teamIds: ' ,  , ',
				channelIds: ' , ',
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ users: [{ user_id: 'U111' }] });

		await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'new.user@example.com' }],
		});
	});

	it.each([
		{
			label: 'department',
			scope: SCOPES.DEPARTMENT_LIST,
			additionalFields: { departmentId: 'DEP_MISSING' },
			mockLookup: () => mockZohoCliqApiRequest.mockResolvedValueOnce({ departments: [] }),
			expectedReason: 'DEPARTMENT_NOT_FOUND',
		},
		{
			label: 'designation',
			scope: SCOPES.DESIGNATIONS_READ,
			additionalFields: { designationId: 'DES_MISSING' },
			mockLookup: () => mockZohoCliqApiRequest.mockResolvedValueOnce({ designations: [] }),
			expectedReason: 'DESIGNATION_NOT_FOUND',
		},
		{
			label: 'reporting user',
			scope: SCOPES.USERS_READ,
			additionalFields: { reportingToZuid: 'USER_MISSING' },
			mockLookup: () =>
				mockZohoCliqApiRequest.mockRejectedValueOnce({
					message: 'Request URL is invalid',
					response: { statusCode: 404 },
				}),
			expectedReason: 'USER_NOT_FOUND',
		},
		{
			label: 'team',
			scope: SCOPES.TEAMS_READ,
			additionalFields: { teamIds: 'TEAM_MISSING' },
			mockLookup: () =>
				mockZohoCliqApiRequest.mockRejectedValueOnce({
					message: 'Team not found',
					response: { statusCode: 404 },
				}),
			expectedReason: 'TEAM_NOT_FOUND',
		},
		{
			label: 'channel',
			scope: SCOPES.CHANNELS_READ,
			additionalFields: { channelIds: 'CHAN_MISSING' },
			mockLookup: () =>
				mockZohoCliqApiRequest.mockRejectedValueOnce({
					message: 'Channel not found',
					response: { statusCode: 404 },
				}),
			expectedReason: 'CHANNEL_NOT_FOUND',
		},
	])(
		'should return a recoverable missing-target error when shared $label create preflight confirms no match',
		async ({ scope, additionalFields, mockLookup, expectedReason }) => {
			const items: INodeExecutionData[] = [{ json: {} }];
			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			mockStructuredCreateParameters({ additionalFields });
			mockLookup();

			const result = await create.execute.call(
				mockExecuteFunctions,
				items,
				[SCOPES.USERS_CREATE, scope].join(','),
			);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'create',
					reason: expectedReason,
					email_id: 'new.user@example.com',
				}),
			);
			expect(result[0].json).not.toHaveProperty('error');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest.mock.calls[0][0]).toBe('GET');
		},
	);

	it('should return an AI Error Mode recoverable payload when the shared reporting-user preflight confirms no match', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockStructuredCreateParameters({
			additionalFields: { reportingToZuid: 'USER_MISSING' },
			enableAiErrorMode: true,
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const result = await create.execute.call(
			mockExecuteFunctions,
			items,
			[SCOPES.USERS_CREATE, SCOPES.USERS_READ].join(','),
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				reason: 'USER_NOT_FOUND',
				email_id: 'new.user@example.com',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(String(result[0].json.message)).toContain('Reporting To ZUID');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should fail validation before optional preflight when a team ID is malformed', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockStructuredCreateParameters({
			additionalFields: { teamIds: 'TEAM_OK,bad/id' },
		});

		const result = await create.execute.call(
			mockExecuteFunctions,
			items,
			[SCOPES.USERS_CREATE, SCOPES.TEAMS_READ].join(','),
		);
		expect(result).toEqual([
			expect.objectContaining({
				json: expect.objectContaining({
					success: false,
					message: 'Invalid team ID format: "bad/id"',
				}),
			}),
		]);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('user', 'create');
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
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should throw error for invalid email', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('invalid email')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({})
			.mockReturnValueOnce({});

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Invalid email format');
	});

	it('should throw error for invalid custom field key', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: { '1bad': 'value' },
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		await expect(
			create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE),
		).rejects.toThrow('Invalid custom field name');
	});

	it('should continueOnFail with paired item error', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValueOnce(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('invalid email')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({})
			.mockReturnValueOnce({});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'INVALID_EMAIL',
				message: expect.stringContaining('Invalid email format'),
				resource: 'user',
				operation: 'create',
				email_id: 'invalid email',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({
				itemData: { item: 0 },
			}),
		);
	});

	it('should return a recoverable payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'invalid email',
					firstName: '',
					additionalFields: {},
					customFields: {},
					enableAiErrorMode: true,
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'INVALID_EMAIL',
				message: expect.stringContaining('Invalid email format'),
				resource: 'user',
				operation: 'create',
				email_id: 'invalid email',
				input_mode: 'structured',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return USER_ALREADY_EXISTS when Zoho reports already_availableusers in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValueOnce(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('existing.user@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				success_users: [],
				failed_users: {},
				already_availableusers: ['existing.user@example.com'],
			},
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				reason: 'USER_ALREADY_EXISTS',
				email_id: 'existing.user@example.com',
				message:
					'A user with email "existing.user@example.com" already exists in this organization.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(String(result[0].json.hint)).toContain('Get_a_user_in_Zoho_Cliq');
	});

	it('should return USER_ALREADY_EXISTS when already_availableusers is an array of objects', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValueOnce(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce('existing.object@example.com')
			.mockReturnValueOnce('')
			.mockReturnValueOnce({})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				already_availableusers: [{ email_id: 'existing.object@example.com' }, { ignored: true }],
			},
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				reason: 'USER_ALREADY_EXISTS',
				email_id: 'existing.object@example.com',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return USER_ALREADY_EXISTS when already_availableusers is an object map', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValueOnce(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'raw',
					usersPayload: '{"users":[{"email_id":"existing.map@example.com"}]}',
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			already_availableusers: {
				'existing.map@example.com': 'already exists',
			},
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				reason: 'USER_ALREADY_EXISTS',
				email_id: 'existing.map@example.com',
				input_mode: 'raw',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should fall back to root already_availableusers entries and ignore blank duplicate email values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValueOnce(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'raw',
					usersPayload: {
						users: [{ email_id: 'first.raw@example.com' }, { email_id: 'second.raw@example.com' }],
					},
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {},
			already_availableusers: [
				{ email: 'existing.fallback@example.com' },
				42,
				'   ',
				{ email_id: '   ' },
			],
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/users', {
			users: [{ email_id: 'first.raw@example.com' }, { email_id: 'second.raw@example.com' }],
		});
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				reason: 'USER_ALREADY_EXISTS',
				email_id: 'existing.fallback@example.com',
				input_mode: 'raw',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should enrich unknown custom field API errors in create recoverable mode when the key came from customFields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValueOnce(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: { fake_custom_field: 'test value' },
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: "'fake_custom_field' is an extra key in the JSON Object.",
			response: {
				status: 400,
				data: {
					message: "'fake_custom_field' is an extra key in the JSON Object.",
				},
			},
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				reason: 'INVALID_CUSTOM_FIELD',
				message: "Custom field 'fake_custom_field' does not exist in this organization.",
				custom_field: 'fake_custom_field',
				hint: expect.stringContaining(
					'If available, use Retrieve_all_user_field_schema_definitions_in_Zoho_Cliq',
				),
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should not enrich extra-key API errors in create recoverable mode when the key was not supplied via customFields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValueOnce(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'structured',
					emailId: 'new.user@example.com',
					firstName: '',
					additionalFields: {},
					addCustomFields: true,
					customFields: { workplace_name: 'HQ' },
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: "'display_name' is an extra key in the JSON Object.",
			response: {
				status: 400,
				data: {
					message: "'display_name' is an extra key in the JSON Object.",
				},
			},
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				message: "'display_name' is an extra key in the JSON Object.",
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json).not.toHaveProperty('custom_field');
		expect(result[0].json).not.toHaveProperty('reason', 'INVALID_CUSTOM_FIELD');
	});

	it('should return agent/tool input_mode context in recoverable payloads', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockAgentToolCreateParameters({
			agentToolEmailId: 'invalid email',
			enableAiErrorMode: true,
		});

		const result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'create',
				email_id: 'invalid email',
				input_mode: 'agentTool',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable raw-payload parse error when AI Error Mode is enabled and parser throws a non-Error value', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const parseSpy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
			throw 'boom';
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					inputMode: 'raw',
					usersPayload: '{"users":[',
					enableAiErrorMode: true,
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		let result: INodeExecutionData[];
		try {
			result = await create.execute.call(mockExecuteFunctions, items, SCOPES.USERS_CREATE);
		} finally {
			parseSpy.mockRestore();
		}

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Users Payload must be valid JSON',
				resource: 'user',
				operation: 'create',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
		expect(result[0].json).not.toHaveProperty('email_id');
	});

	it('should expose docs notice with required scopes', () => {
		const docsNotice = create.description.find(
			(property) => property.name === 'createUserDocsNotice',
		);
		expect(docsNotice).toBeDefined();
		expect(String(docsNotice?.displayName)).toContain('REQUIRED SCOPES:');
		expect(String(docsNotice?.displayName)).toContain('ZohoCliq.Users.CREATE');
	});

	it('should expose Zoho One guidance notice for create operation', () => {
		const zohoOneNotice = create.description.find(
			(property) => property.name === 'createUserZohoOneNotice',
		);
		expect(zohoOneNotice).toBeDefined();
		expect(String(zohoOneNotice?.displayName)).toContain('Zoho One Guidance');
		expect(String(zohoOneNotice?.displayName)).toContain('Zoho One');
	});

	it('should expose AI setup guide notice for create operation', () => {
		const aiGuideNotice = create.description.find(
			(property) => property.name === 'createUserAiToolGuideNotice',
		);
		expect(aiGuideNotice).toBeDefined();
		expect(String(aiGuideNotice?.displayName)).toContain('Open Tool Setup Guide');
	});

	it('should expose AI mode suggestion notice for create operation', () => {
		const aiModeSuggestionNotice = create.description.find(
			(property) => property.name === 'createUserAiToolModeSuggestionNotice',
		);
		expect(aiModeSuggestionNotice).toBeDefined();
		expect(String(aiModeSuggestionNotice?.displayName)).toContain('Agent/Tool Setup Fields');
	});

	it('should keep resource and operation scoping on mode-specific fields', () => {
		const emailField = create.description.find((property) => property.name === 'emailId');
		const agentToolEmailField = create.description.find(
			(property) => property.name === 'agentToolEmailId',
		);
		const payloadField = create.description.find((property) => property.name === 'usersPayload');

		expect(emailField?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['create'],
				inputMode: ['structured'],
			}),
		);
		expect(agentToolEmailField?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['create'],
				inputMode: ['agentTool'],
			}),
		);
		expect(payloadField?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['create'],
				inputMode: ['raw'],
			}),
		);
	});
});
