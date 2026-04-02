import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/userFields/create.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserFields - Create Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

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

	it('should create user field successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'structured',
				name: 'Employee Code',
				type: 'text_field',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				dropdownOptions: '',
			};
			return values[name];
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success', id: 'UF123' });

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/userfields', {
			name: 'Employee Code',
			type: 'text_field',
		});
	});

	it('should create drop_down field with optional booleans and options', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'structured',
				name: 'Vaccinated',
				type: 'drop_down',
				mandatoryMode: 'true',
				encryptedMode: 'false',
				editPermissionMode: 'true',
				dropdownOptions: 'Yes, No, Yes',
			};
			return values[name];
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success', id: 'UF123' });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/userfields', {
			name: 'Vaccinated',
			type: 'drop_down',
			mandatory: true,
			encrypted: false,
			edit_permission: true,
			options: ['Yes', 'No'],
		});
	});

	it('should create drop_down field successfully in agent/tool setup mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'agentTool',
				name: 'Vaccinated',
				type: 'drop_down',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'true',
				agentToolDropdownOptions: 'Yes, No, Prefer not to say',
			};
			return values[name];
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success', id: 'UF124' });

		await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/userfields', {
			name: 'Vaccinated',
			type: 'drop_down',
			edit_permission: true,
			options: ['Yes', 'No', 'Prefer not to say'],
		});
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('userFields', 'create');
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

	it('should throw error for empty payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'raw',
				fieldDefinitionRaw: {},
			};
			return values[name];
		});

		await expect(create.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Field Definition cannot be empty',
		);
	});

	it('should throw error for unsafe keys in payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'raw',
				fieldDefinitionRaw: {
					constructor: 'bad',
				},
			};
			return values[name];
		});

		await expect(create.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Unsafe key',
		);
	});

	it('should return item error payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'structured',
				name: '',
				type: 'text_field',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				dropdownOptions: '',
			};
			return values[name];
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
			}),
		);
	});

	it('should return a coded missing-required-field payload for a raw create payload that omits name', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'raw',
				fieldDefinitionRaw: {
					type: 'text_field',
				},
			};
			return values[name];
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
				reason: 'MISSING_REQUIRED_FIELD',
				message: 'name is required',
			}),
		);
	});

	it('should return a coded invalid-type payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'raw',
				fieldDefinitionRaw: {
					name: 'Website',
					type: 'invalid_type',
				},
			};
			return values[name];
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
				reason: 'INVALID_USER_FIELD_TYPE',
				message: 'Invalid type. Use one of: text_field, number, url, date_picker, drop_down.',
			}),
		);
	});

	it('should return a coded hard-cap payload when recoverable mode and read scope allow create-limit preflight', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_CREATE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'structured',
				name: 'Website',
				type: 'url',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				dropdownOptions: '',
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			list: Array.from({ length: 10 }, (_, idx) => ({
				id: `UF_${idx}`,
				system_defined: false,
			})),
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
				reason: 'FIELD_MAX_CUSTOM_FIELD_LIMIT_REACHED',
				message:
					'The maximum of 10 custom user fields has been reached. Delete an existing custom field before creating a new one.',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/userfields');
	});

	it('should continue to POST when advisory create-limit preflight fails transiently', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_CREATE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'structured',
				name: 'Website',
				type: 'url',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				dropdownOptions: '',
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('Transient list failure'));
		mockZohoCliqApiRequest.mockResolvedValueOnce({ status: 'success', id: 'UF125' });

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/userfields');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/v2/userfields', {
			name: 'Website',
			type: 'url',
		});
	});

	it('should return a coded missing-dropdown-options payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'structured',
				name: 'Vaccinated',
				type: 'drop_down',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				dropdownOptions: '',
			};
			return values[name];
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
				reason: 'DROPDOWN_OPTIONS_REQUIRED',
				message: 'options are required when type is "drop_down"',
			}),
		);
	});

	it('should return a coded dropdown-options-not-allowed payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'structured',
				name: 'Department',
				type: 'text_field',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				dropdownOptions: 'A, B, C',
			};
			return values[name];
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
				reason: 'DROPDOWN_OPTIONS_NOT_ALLOWED',
				message: 'options are only supported when type is "drop_down"',
			}),
		);
	});

	it('should return a coded empty-dropdown-options payload when continueOnFail is enabled for raw input', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'raw',
				fieldDefinitionRaw: {
					name: 'Vaccinated',
					type: 'drop_down',
					options: [],
				},
			};
			return values[name];
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
				reason: 'EMPTY_DROPDOWN_OPTIONS',
				message: 'options cannot be empty',
			}),
		);
	});

	it('should return a coded invalid-input-mode payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'guided',
			};
			return values[name];
		});

		const result = await create.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'create',
				reason: 'INVALID_INPUT_MODE',
				message: 'Input Mode must be "structured", "agentTool", or "raw"',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should reject unsupported input mode values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_CREATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				inputMode: 'guided',
			};
			return values[name];
		});

		await expect(create.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Input Mode must be "structured", "agentTool", or "raw"',
		);
	});

	it('should keep structured dropdown options gated by type and expose agent/tool dropdown options separately', () => {
		const dropdownOptionsProperty = create.description.find(
			(property) => property.name === 'dropdownOptions',
		);
		const agentToolDropdownOptionsProperty = create.description.find(
			(property) => property.name === 'agentToolDropdownOptions',
		);

		expect(dropdownOptionsProperty).toBeDefined();
		expect(dropdownOptionsProperty?.displayOptions?.show).toMatchObject({
			resource: ['userField'],
			operation: ['create'],
			inputMode: ['structured'],
			type: ['drop_down'],
		});

		expect(agentToolDropdownOptionsProperty).toBeDefined();
		expect(agentToolDropdownOptionsProperty?.displayOptions?.show).toMatchObject({
			resource: ['userField'],
			operation: ['create'],
			inputMode: ['agentTool'],
		});
	});

	it('should not expose the rejected is searchable field', () => {
		const property = create.description.find((entry) => entry.name === 'isSearchableMode');

		expect(property).toBeUndefined();
	});
});
