import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { TINY_PNG_BASE64 } from '../../../../../helpers/base64Images';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as userCommon from '../../../../../../nodes/ZohoCliq/v1/actions/user/common';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/user/update.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - User - Update Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const TEST_USER_ID = '631830849';
	const MISSING_TEST_USER_ID = 'missing-user-123';
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest
				.fn()
				.mockImplementation((name: string, _itemIndex: number, defaultValue?: unknown) => {
					if (name === 'simplify') return false;
					if (name === 'simplifyMode') return 'simplified';
					if (name === 'simplifyFields') return [];
					return defaultValue;
				}),
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

	function mockAgentToolUpdateParameters(overrides: Record<string, unknown> = {}): void {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'agentTool',
					agentToolEmailId: '',
					agentToolFirstName: '',
					agentToolLastName: '',
					agentToolNormalizeNameCasing: false,
					agentToolEmployeeId: '',
					agentToolDisplayName: '',
					agentToolMobile: '',
					agentToolPhone: '',
					agentToolExtension: '',
					agentToolImageData: undefined,
					agentToolDepartmentId: '',
					agentToolDesignationId: '',
					agentToolReportingToZuid: '',
					agentToolCountry: '',
					agentToolLanguage: '',
					agentToolTimezone: '',
					agentToolWorkLocation: '',
					agentToolCustomFields: {},
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
					...overrides,
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
	}

	it('should update user successfully using structured fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				firstName: 'new',
				lastName: 'NAME',
				normalizeNameCasing: true,
				displayName: 'New Name',
				timezone: 'America/New_York',
				reportingToZuid: '987654321',
			})
			.mockReturnValueOnce({
				custom_field_one: 'value',
			});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			first_name: 'New',
			last_name: 'Name',
			display_name: 'New Name',
			timezone: 'America/New_York',
			reporting_to_zuid: '987654321',
			custom_field_one: 'value',
		});
	});

	it('should build structured payload from top-level fields when legacy collection is empty', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					customFields: {},
					addProfileDetails: true,
					addLocationDetails: true,
					firstName: 'jANE',
					lastName: 'DOE',
					normalizeNameCasing: true,
					displayName: 'JD',
					country: 'us',
					language: 'EN',
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};

				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			first_name: 'Jane',
			last_name: 'Doe',
			display_name: 'JD',
			country: 'US',
			language: 'en',
		});
	});

	it('should ignore null organization/location values when related toggles are enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					firstName: 'Jane',
					addOrganizationDetails: true,
					addLocationDetails: true,
					departmentId: null,
					designationId: null,
					reportingToZuid: null,
					country: null,
					language: null,
					timezone: null,
					workLocation: null,
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			first_name: 'Jane',
		});
	});

	it('should coalesce null basic and profile fields to empty defaults in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					firstName: null,
					lastName: null,
					normalizeNameCasing: null,
					emailId: null,
					employeeId: null,
					addProfileDetails: true,
					addOrganizationDetails: true,
					displayName: null,
					mobile: null,
					phone: null,
					extension: null,
					imageData: undefined,
					departmentId: '12345',
					designationId: null,
					reportingToZuid: null,
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result).toHaveLength(1);
		// Null basic/profile fields coalesce to '' and are omitted; only departmentId is sent
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			department_id: '12345',
		});
	});

	it('should return USER_NOT_FOUND in recoverable mode when shared update preflight confirms no user', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: false },
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: MISSING_TEST_USER_ID,
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const result = await update.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.USERS_UPDATE},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				user_id: MISSING_TEST_USER_ID,
				reason: 'USER_NOT_FOUND',
			}),
		);
		expect(String(result[0].json.message)).toContain('No Zoho Cliq user found');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return BAD_REQUEST when update target preflight is skipped without user read scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: false },
		});
		mockAgentToolUpdateParameters({
			userId: MISSING_TEST_USER_ID,
			agentToolDisplayName: 'Updated Name',
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 400 },
		});

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				user_id: MISSING_TEST_USER_ID,
				reason: 'BAD_REQUEST',
				status_code: 400,
			}),
		);
		expect(String(result[0].json.message)).toContain('Request URL is invalid');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			`/api/v2/users/${MISSING_TEST_USER_ID}`,
			expect.objectContaining({
				display_name: 'Updated Name',
			}),
		);
	});

	it('should return INVALID_DEPARTMENT_ID in recoverable mode for non-numeric department_id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockAgentToolUpdateParameters({
			agentToolDepartmentId: 'DEP_ABC',
			agentToolDisplayName: 'Updated Name',
		});

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				reason: 'INVALID_DEPARTMENT_ID',
				message: 'department_id must be a numeric string.',
				field: 'department_id',
				value: 'DEP_ABC',
				department_id: 'DEP_ABC',
			}),
		);
		expect(String(result[0].json.hint)).toContain('List Departments');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return DESIGNATION_NOT_FOUND in recoverable mode for numeric but missing designation_id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockAgentToolUpdateParameters({
			agentToolDesignationId: '5552022000005555999',
			agentToolDisplayName: 'Updated Name',
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ designations: [] });

		const result = await update.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.USERS_UPDATE},${SCOPES.DESIGNATIONS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				reason: 'DESIGNATION_NOT_FOUND',
				message: 'No designation exists with ID "5552022000005555999".',
				field: 'designation_id',
				value: '5552022000005555999',
				designation_id: '5552022000005555999',
			}),
		);
		expect(String(result[0].json.hint)).toContain('List Designations');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return INVALID_DESIGNATION_ID in recoverable mode for non-numeric designation_id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockAgentToolUpdateParameters({
			agentToolDesignationId: 'DESIGNATION_ABC',
			agentToolDisplayName: 'Updated Name',
		});

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				reason: 'INVALID_DESIGNATION_ID',
				message: 'designation_id must be a numeric string.',
				field: 'designation_id',
				value: 'DESIGNATION_ABC',
				designation_id: 'DESIGNATION_ABC',
			}),
		);
		expect(String(result[0].json.hint)).toContain('List Designations');
	});

	it('should map generic technical errors to DESIGNATION_NOT_FOUND when designation lookup preflight is unavailable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockAgentToolUpdateParameters({
			agentToolDesignationId: '5552022000005555111',
			agentToolDisplayName: 'Updated Name',
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Technical error',
			response: { statusCode: 400 },
		});

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				reason: 'DESIGNATION_NOT_FOUND',
				message: 'No designation exists with ID "5552022000005555111".',
				field: 'designation_id',
				value: '5552022000005555111',
				designation_id: '5552022000005555111',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return DEPARTMENT_NOT_FOUND in recoverable mode for numeric but missing department_id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockAgentToolUpdateParameters({
			agentToolDepartmentId: '5452022000000099999',
			agentToolDisplayName: 'Updated Name',
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ departments: [] });

		const result = await update.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.USERS_UPDATE},${SCOPES.DEPARTMENT_LIST}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				reason: 'DEPARTMENT_NOT_FOUND',
				message: 'No department exists with ID "5452022000000099999".',
				field: 'department_id',
				value: '5452022000000099999',
				department_id: '5452022000000099999',
			}),
		);
		expect(String(result[0].json.hint)).toContain('List Departments');
	});

	it('should map generic technical errors to DEPARTMENT_NOT_FOUND when department lookup preflight is unavailable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockAgentToolUpdateParameters({
			agentToolDepartmentId: '5452022000000010101',
			agentToolDisplayName: 'Updated Name',
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Technical error',
			response: { statusCode: 400 },
		});

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				reason: 'DEPARTMENT_NOT_FOUND',
				message: 'No department exists with ID "5452022000000010101".',
				field: 'department_id',
				value: '5452022000000010101',
				department_id: '5452022000000010101',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should return INVALID_REPORTING_TO in recoverable mode when manager preflight cannot find the ZUID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockAgentToolUpdateParameters({
			agentToolReportingToZuid: '999999999999',
			agentToolDisplayName: 'Updated Name',
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: TEST_USER_ID }).mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const result = await update.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.USERS_UPDATE},${SCOPES.USERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				reason: 'INVALID_REPORTING_TO',
				message: 'No user exists with ZUID "999999999999".',
				field: 'reporting_to_zuid',
				value: '999999999999',
				reporting_to_zuid: '999999999999',
			}),
		);
		expect(String(result[0].json.hint)).toContain('Get_a_user_in_Zoho_Cliq');
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should include organization fields from top-level structured inputs when organization toggle is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					firstName: 'Jane',
					addOrganizationDetails: true,
					departmentId: '5452022000000011111',
					designationId: '5552022000005555055',
					reportingToZuid: '987654321',
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			first_name: 'Jane',
			department_id: '5452022000000011111',
			designation_id: '5552022000005555055',
			reporting_to_zuid: '987654321',
		});
	});

	it('should update user successfully using agent/tool setup fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockAgentToolUpdateParameters({
			agentToolEmailId: 'updated.user@example.com',
			agentToolFirstName: 'jANE',
			agentToolLastName: 'DOE',
			agentToolNormalizeNameCasing: true,
			agentToolDisplayName: 'JD',
			agentToolDepartmentId: '5452022000000011111',
			agentToolDesignationId: '5552022000005555055',
			agentToolReportingToZuid: '987654321',
			agentToolCountry: 'us',
			agentToolLanguage: 'EN',
			agentToolTimezone: 'America/New_York',
			agentToolWorkLocation: 'Remote',
			agentToolCustomFields: { workplace_name: 'Remote HQ' },
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			email_id: 'updated.user@example.com',
			first_name: 'Jane',
			last_name: 'Doe',
			display_name: 'JD',
			department_id: '5452022000000011111',
			designation_id: '5552022000005555055',
			reporting_to_zuid: '987654321',
			country: 'US',
			language: 'en',
			timezone: 'America/New_York',
			work_location: 'Remote',
			workplace_name: 'Remote HQ',
		});
	});

	it('should ignore null optional agent/tool setup values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockAgentToolUpdateParameters({
			agentToolEmailId: null,
			agentToolFirstName: '',
			agentToolLastName: null,
			agentToolNormalizeNameCasing: null,
			agentToolEmployeeId: null,
			agentToolDisplayName: null,
			agentToolMobile: null,
			agentToolPhone: null,
			agentToolExtension: null,
			agentToolImageData: undefined,
			agentToolDepartmentId: null,
			agentToolDesignationId: null,
			agentToolReportingToZuid: null,
			agentToolCountry: null,
			agentToolLanguage: null,
			agentToolTimezone: null,
			agentToolWorkLocation: null,
			agentToolCustomFields: '{}',
		});

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('At least one update field is required');
	});

	it('should omit null agent/tool first name while keeping other updates', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockAgentToolUpdateParameters({
			agentToolFirstName: null,
			agentToolDisplayName: 'Updated Name',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Updated Name',
		});
	});

	it('should treat blank agent/tool custom fields as omitted', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		mockAgentToolUpdateParameters({
			agentToolDisplayName: 'Updated Name',
			agentToolCustomFields: '   ',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Updated Name',
		});
	});

	it('should update user successfully using raw payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ display_name: 'Raw User' });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/users/1234567890', {
			display_name: 'Raw User',
		});
	});

	it('should validate raw payload organization references through shared preflights in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'raw',
					usersPayload: {
						display_name: 'Raw User',
						department_id: '5452022000000011111',
						designation_id: '5552022000005555055',
						reporting_to_zuid: '987654321',
					},
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: TEST_USER_ID })
			.mockResolvedValueOnce({ departments: [{ id: '5452022000000011111' }] })
			.mockResolvedValueOnce({ designations: [{ id: '5552022000005555055' }] })
			.mockResolvedValueOnce({ id: '987654321' })
			.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.USERS_UPDATE},${SCOPES.USERS_READ},${SCOPES.DEPARTMENT_LIST},${SCOPES.DESIGNATIONS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenLastCalledWith(
			'PUT',
			`/api/v2/users/${TEST_USER_ID}`,
			{
				display_name: 'Raw User',
				department_id: '5452022000000011111',
				designation_id: '5552022000005555055',
				reporting_to_zuid: '987654321',
			},
		);
	});

	it('should remove blank raw payload organization references before sending the update', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'raw',
					usersPayload: {
						display_name: 'Raw User',
						department_id: '   ',
						designation_id: '   ',
						reporting_to_zuid: '   ',
					},
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Raw User',
		});
	});

	it('should remove null raw payload organization references before sending the update', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'raw',
					usersPayload: {
						display_name: 'Raw User',
						department_id: null,
						designation_id: null,
						reporting_to_zuid: null,
					},
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Raw User',
		});
	});

	it('should update user successfully using raw JSON string payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"display_name":"Raw String User"}');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/users/1234567890', {
			display_name: 'Raw String User',
		});
	});

	it('should reject unsupported input modes explicitly', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('legacy');

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Input Mode must be one of: structured, agentTool, raw');
	});

	it('should throw a clear error when raw user payload JSON is invalid', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"display_name":');

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('User Payload must be valid JSON');
	});

	it('should reject raw payload when email_id is present but empty', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"email_id":""}');

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Invalid email format');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should accept raw payload when email_id has surrounding whitespace', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce('{"email_id":"  user@example.com  "}');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).resolves.toEqual(expect.any(Array));
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/users/1234567890', {
			email_id: 'user@example.com',
		});
	});

	it('should reject email-shaped update target identifiers', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: 'user@example.com',
					inputMode: 'structured',
					updateFields: { displayName: 'User Name' },
					customFields: {},
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow(
			'Update User requires a Zoho Cliq user ID in the request URL. Email addresses are not supported here.',
		);
	});

	it('should wrap primitive API response without warnings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ displayName: 'User Name' })
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue('ok' as unknown as IDataObject);

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual({ updated: true, data: 'ok' });
	});

	it('should normalize data-URI image_data in structured payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				imageData: `data:image/png;charset=utf-8;base64,${TINY_PNG_BASE64}`,
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.USERS_UPDATE},Profile.orguserphoto.UPDATE`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			image_data: TINY_PNG_BASE64,
		});
	});

	it('should map all supported structured update fields into the request payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				emailId: 'updated.user@example.com',
				phone: '+1-555-3000',
				mobile: '+1-555-4000',
				timezone: 'America/New_York',
				language: 'en',
				country: 'US',
				designationId: '5552022000005555222',
				departmentId: '5452022000000012222',
				reportingToZuid: '987654322',
				workLocation: 'Remote',
				extension: '5678',
				employeeId: 'EMP_2',
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			email_id: 'updated.user@example.com',
			phone: '+1-555-3000',
			mobile: '+1-555-4000',
			timezone: 'America/New_York',
			language: 'en',
			country: 'US',
			designation_id: '5552022000005555222',
			department_id: '5452022000000012222',
			reporting_to_zuid: '987654322',
			work_location: 'Remote',
			extension: '5678',
			employee_id: 'EMP_2',
		});
	});

	it('should keep last_name unchanged when normalizeNameCasing is false', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				lastName: 'McDONALD',
				normalizeNameCasing: false,
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			last_name: 'McDONALD',
		});
	});

	it('should detect image_data scope requirement from raw payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ email_id: 'updated.user@example.com', image_data: TINY_PNG_BASE64 });

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Missing OAuth scope for');
	});

	it('should throw when raw image_data is invalid and no other fields remain', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ image_data: 'invalid-***' });

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('At least one update field is required');
	});

	it('should preserve existing response warnings and append local image warnings for invalid image_data', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ display_name: 'fallback', image_data: 'invalid-***' });
		mockZohoCliqApiRequest.mockResolvedValue({
			status: 'success',
			_warnings: [
				{ field: 'existing.field', reason: 'Existing warning', action: 'Existing action' },
			],
		});

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);
		const warnings = (result[0].json as { _warnings: Array<{ field: string }> })._warnings;

		expect(warnings).toHaveLength(2);
		expect(warnings[0].field).toBe('existing.field');
		expect(warnings[1].field).toBe('image_data');
	});

	it('should strip empty raw image_data without appending warnings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ display_name: 'fallback', image_data: '   ' });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/users/1234567890', {
			display_name: 'fallback',
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should throw error when raw payload is not an object', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce([]);

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('User Payload must be a JSON object');
	});

	it('should reject wrapped users payload format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ users: [] });

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('User Payload must be a single user object (not wrapped in "users")');
	});

	it('should throw error for invalid language format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ language: 'en-US-1' })
			.mockReturnValueOnce({});

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Invalid Language format');
	});

	it('should throw error for invalid country format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ country: 'USA' })
			.mockReturnValueOnce({});

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Invalid Country format');
	});

	it('should throw error when customFields is not an object in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					addCustomFields: true,
					customFields: [],
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Custom Fields must be a JSON object');
	});

	it('should throw error when customFields contains invalid JSON string in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					addCustomFields: true,
					customFields: '{"bad"',
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Custom Fields must be a valid JSON object');
	});

	it('should throw generic customFields parse error when parser throws non-Error value', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const parseSpy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
			throw 'boom';
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					addCustomFields: true,
					customFields: '{"bad"',
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Custom Fields must be a valid JSON object');
		parseSpy.mockRestore();
	});

	it('should strip invalid structured image_data and keep other updates with a warning', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ imageData: 'invalid-***', displayName: 'Fallback Name' })
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Fallback Name',
		});
		expect(result[0].json).toEqual(
			expect.objectContaining({
				_warnings: expect.arrayContaining([
					expect.objectContaining({
						field: 'imageData',
						reason: expect.stringContaining('Removed image_data because validation failed'),
					}),
				]),
			}),
		);
	});

	it('should append a generic warning when image sanitizer throws a non-Error value in structured mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const sanitizeSpy = jest.spyOn(userCommon, 'sanitizeImageDataBase64').mockImplementation(() => {
			throw 'boom';
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ imageData: 'QmFzZTY0', displayName: 'Fallback Name' })
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);
		sanitizeSpy.mockRestore();

		expect(result[0].json).toEqual(
			expect.objectContaining({
				_warnings: expect.arrayContaining([
					expect.objectContaining({
						field: 'imageData',
						reason: 'Removed image_data because validation failed.',
					}),
				]),
			}),
		);
	});

	it('should append a generic warning when image sanitizer throws a non-Error value in raw mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const sanitizeSpy = jest.spyOn(userCommon, 'sanitizeImageDataBase64').mockImplementation(() => {
			throw 'boom';
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ display_name: 'fallback', image_data: 'QmFzZTY0' });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);
		sanitizeSpy.mockRestore();

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/users/1234567890', {
			display_name: 'fallback',
		});
		expect(result[0].json).toEqual(
			expect.objectContaining({
				_warnings: expect.arrayContaining([
					expect.objectContaining({
						field: 'image_data',
						reason: 'Removed image_data because validation failed.',
					}),
				]),
			}),
		);
	});

	it('should strip empty structured imageData and keep other updates without appending warnings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ imageData: '   ', displayName: 'Fallback Name' })
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Fallback Name',
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should throw error when custom field conflicts with reserved update field', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ firstName: 'Reserved' })
			.mockReturnValueOnce({ first_name: 'custom value' });

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('conflicts with a reserved update field');
	});

	it('should require additional profile photo scope when image_data is provided', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				imageData: TINY_PNG_BASE64,
			})
			.mockReturnValueOnce({});
		let thrownError: unknown;
		try {
			await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);
		} catch (error) {
			thrownError = error;
		}

		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(
				thrownError as {
					zohoCliqScopeErrorPayload?: { requiredScopes?: string[]; missingScopes?: string[] };
				}
			).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: expect.arrayContaining(['Profile.orguserphoto.UPDATE']),
				missingScopes: expect.arrayContaining(['Profile.orguserphoto.UPDATE']),
			}),
		);
	});

	it('should allow image_data update when profile photo scope is granted', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				imageData: TINY_PNG_BASE64,
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.USERS_UPDATE},Profile.orguserphoto.UPDATE`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			image_data: TINY_PNG_BASE64,
		});
	});

	it('should use fallback image scope when conditional metadata is unavailable', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		jest.spyOn(scopeRegistry, 'getConditionalScopeRequirement').mockReturnValueOnce(undefined);
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				imageData: TINY_PNG_BASE64,
			})
			.mockReturnValueOnce({});

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('Missing OAuth scope for');
	});

	it('should throw error for missing base OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('user', 'update');
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
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
	});

	it('should throw error when no update fields are provided', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({})
			.mockReturnValueOnce({});

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow('At least one update field is required');
	});

	it('should explain when image_data is removed and no other update fields remain', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ imageData: 'invalid-***' })
			.mockReturnValueOnce({});

		await expect(
			update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE),
		).rejects.toThrow(
			'At least one update field is required. Removed image_data because validation failed',
		);
	});

	it('should skip empty parsed channel_ids and team_ids values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				channelIds: ' , ',
				teamIds: ' , ',
				displayName: 'Name',
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Name',
		});
	});

	it('should ignore structured channelIds/teamIds when provided in legacy update fields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				displayName: 'Name',
				channelIds: 'C1,C2',
				teamIds: 'T1,T2',
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Name',
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should ignore null structured channelIds/teamIds in legacy update fields without warnings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({
				displayName: 'Name',
				channelIds: null,
				teamIds: null,
			})
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Name',
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should strip raw channel_ids and team_ids without appending compatibility warnings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({
				display_name: 'Raw Direct User',
				channel_ids: ['C1'],
				team_ids: ['T1'],
			});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/users/1234567890', {
			display_name: 'Raw Direct User',
		});
		expect((result[0].json as IDataObject)._warnings).toBeUndefined();
	});

	it('should accept raw direct user object payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('1234567890')
			.mockReturnValueOnce('raw')
			.mockReturnValueOnce({ display_name: 'Raw Direct User', mobile: '12345' });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/users/1234567890', {
			display_name: 'Raw Direct User',
			mobile: '12345',
		});
	});

	it('should parse string customFields default object without validation error', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce(TEST_USER_ID)
			.mockReturnValueOnce('structured')
			.mockReturnValueOnce({ displayName: 'Name' })
			.mockReturnValueOnce('{}');
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', `/api/v2/users/${TEST_USER_ID}`, {
			display_name: 'Name',
		});
	});

	it('should continueOnFail with paired item error', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					addCustomFields: true,
					customFields: { '1bad': 'value' },
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: expect.stringContaining('Invalid custom field name'),
				resource: 'user',
				operation: 'update',
				user_id: TEST_USER_ID,
			}),
		);
		expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({
				itemData: { item: 0 },
			}),
		);
	});

	it('should preserve the original lookup error when userId retrieval throws in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'userId') {
					throw new Error('lookup exploded');
				}
				return defaultValue;
			},
		);

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'lookup exploded',
				resource: 'user',
				operation: 'update',
			}),
		);
		expect(result[0].json).not.toHaveProperty('user_id');
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
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					addCustomFields: true,
					customFields: { '1bad': 'value' },
					enableAiErrorMode: true,
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: expect.stringContaining('Invalid custom field name'),
				resource: 'user',
				operation: 'update',
				user_id: TEST_USER_ID,
			}),
		);
	});

	it('should enrich unknown custom field API errors in update recoverable mode when the key came from customFields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					addCustomFields: true,
					customFields: { fake_custom_field: 'test value' },
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
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

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				user_id: TEST_USER_ID,
				reason: 'INVALID_CUSTOM_FIELD',
				message: "Custom field 'fake_custom_field' does not exist in this organization.",
				custom_field: 'fake_custom_field',
				hint: expect.stringContaining(
					'If available, use Retrieve_all_user_field_schema_definitions_in_Zoho_Cliq',
				),
			}),
		);
	});

	it('should not enrich extra-key API errors in update recoverable mode when the key was not supplied via customFields', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'structured',
					updateFields: {},
					addCustomFields: true,
					customFields: { workplace_name: 'HQ' },
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
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

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'update',
				user_id: TEST_USER_ID,
				message: "'display_name' is an extra key in the JSON Object.",
			}),
		);
		expect(result[0].json).not.toHaveProperty('custom_field');
		expect(result[0].json).not.toHaveProperty('reason', 'INVALID_CUSTOM_FIELD');
	});

	it('should return a recoverable raw-payload parse error when AI Error Mode is enabled and parser throws a non-Error value', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const parseSpy = jest.spyOn(JSON, 'parse').mockImplementationOnce(() => {
			throw 'boom';
		});
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				const values: Record<string, unknown> = {
					userId: TEST_USER_ID,
					inputMode: 'raw',
					usersPayload: '{"display_name":',
					enableAiErrorMode: true,
					simplify: false,
					simplifyMode: 'simplified',
					simplifyFields: [],
				};
				return Object.prototype.hasOwnProperty.call(values, name) ? values[name] : defaultValue;
			},
		);

		const result = await update.execute.call(mockExecuteFunctions, items, SCOPES.USERS_UPDATE);
		parseSpy.mockRestore();

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'User Payload must be valid JSON',
				resource: 'user',
				operation: 'update',
				user_id: TEST_USER_ID,
			}),
		);
	});

	it('should expose docs notice with required scopes', () => {
		const docsNotice = update.description.find(
			(property) => property.name === 'updateUserDocsNotice',
		);
		expect(docsNotice).toBeDefined();
		expect(String(docsNotice?.displayName)).toContain('REQUIRED SCOPES:');
		expect(String(docsNotice?.displayName)).toContain('Profile.orguserphoto.UPDATE');
	});

	it('should expose AI setup guide notice for update operation', () => {
		const modeSuggestionNotice = update.description.find(
			(property) => property.name === 'updateUserAiToolModeSuggestionNotice',
		);
		const aiGuideNotice = update.description.find(
			(property) => property.name === 'updateUserAiToolGuideNotice',
		);
		expect(modeSuggestionNotice).toBeDefined();
		expect(aiGuideNotice).toBeDefined();
		expect(String(aiGuideNotice?.displayName)).toContain('Open Tool Setup Guide');
		expect(aiGuideNotice?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['update'],
				inputMode: ['agentTool'],
			}),
		);
	});

	it('should keep resource and operation scoping on mode-specific update fields', () => {
		const firstName = update.description.find((property) => property.name === 'firstName');
		const agentToolFirstName = update.description.find(
			(property) => property.name === 'agentToolFirstName',
		);
		const agentToolCustomFields = update.description.find(
			(property) => property.name === 'agentToolCustomFields',
		);
		const customFields = update.description.find((property) => property.name === 'customFields');
		const usersPayload = update.description.find((property) => property.name === 'usersPayload');
		const channelIds = update.description.find((property) => property.name === 'channelIds');
		const teamIds = update.description.find((property) => property.name === 'teamIds');

		expect(firstName?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['update'],
				inputMode: ['structured'],
			}),
		);
		expect(agentToolFirstName?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['update'],
				inputMode: ['agentTool'],
			}),
		);
		expect(agentToolCustomFields?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['update'],
				inputMode: ['agentTool'],
			}),
		);
		expect(customFields?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['update'],
				inputMode: ['structured'],
			}),
		);
		expect(usersPayload?.displayOptions?.show).toEqual(
			expect.objectContaining({
				resource: ['user'],
				operation: ['update'],
				inputMode: ['raw'],
			}),
		);
		expect(channelIds).toBeUndefined();
		expect(teamIds).toBeUndefined();
	});

	it('should configure user selector as resource locator', () => {
		const userField = update.description.find((property) => property.name === 'userId');
		expect(userField?.type).toBe('resourceLocator');
		expect(userField?.default).toEqual({ mode: 'list', value: '' });

		const modes = (userField?.modes ?? []) as Array<{ name: string; type: string }>;
		expect(modes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'list', type: 'list' }),
				expect.objectContaining({ name: 'id', type: 'string' }),
			]),
		);
	});
});
