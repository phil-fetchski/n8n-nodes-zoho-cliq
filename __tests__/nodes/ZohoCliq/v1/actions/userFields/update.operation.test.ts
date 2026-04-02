import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/userFields/update.operation';
import {
	USER_FIELD_NOT_FOUND_ERROR_CODE,
	USER_FIELD_NOT_FOUND_HINT,
	USER_FIELD_NOT_FOUND_MESSAGE,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - UserFields - Update Operation', () => {
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

	it('should update user field successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'structured',
				name: 'Employee Number',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				replaceOptions: false,
			};
			return values[name];
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/userfields/UF_123456', {
			name: 'Employee Number',
		});
	});

	it('should update structured booleans and options when replaceOptions is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'structured',
				name: 'Vaccinated',
				mandatoryMode: 'true',
				encryptedMode: 'false',
				editPermissionMode: 'true',
				replaceOptions: true,
				options: {
					values: [
						{ name: 'Yes', id: '11' },
						{ name: 'No', id: '' },
					],
				},
			};
			return values[name];
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/userfields/UF_123456', {
			name: 'Vaccinated',
			mandatory: true,
			encrypted: false,
			edit_permission: true,
			options: [{ name: 'Yes', id: '11' }, { name: 'No' }],
		});
	});

	it('should update field successfully using agent/tool setup dropdown options json', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'agentTool',
				name: 'Vaccinated',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'false',
				replaceOptions: true,
				agentToolOptions: [{ id: '11', name: 'Yes' }, { name: 'Prefer not to say' }],
			};
			return values[name];
		});

		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/userfields/UF_123456', {
			name: 'Vaccinated',
			edit_permission: false,
			options: [{ id: '11', name: 'Yes' }, { name: 'Prefer not to say' }],
		});
	});

	it('should return item error payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'raw',
				updateDefinitionRaw: { type: 'drop_down' },
			};
			return values[name];
		});

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'update',
				field_id: 'UF_123456',
			}),
		);
	});

	it('should return item error payload when transport fails and continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'raw',
				updateDefinitionRaw: { name: 'Updated Label' },
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Network failure'));

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'update',
				field_id: 'UF_123456',
				message: 'Network failure',
			}),
		);
	});

	it('should return a stable user-field-not-found payload when shared preflight blocks update in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_UPDATE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: '9999999999999999999',
				inputMode: 'raw',
				updateDefinitionRaw: { name: 'Updated Label' },
			};
			return values[name];
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				status: 400,
				data: {
					message:
						'Our processor went cold :feeling-cold: <br> Try again in a few minutes to view all user fields.',
				},
			},
		});

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'update',
				field_id: '9999999999999999999',
				message: USER_FIELD_NOT_FOUND_MESSAGE,
				reason: USER_FIELD_NOT_FOUND_ERROR_CODE,
				hint: USER_FIELD_NOT_FOUND_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/userfields/9999999999999999999',
		);
	});

	it('should run shared user-field preflight before update when lookup scope is available', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_UPDATE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'structured',
				name: 'Employee Number',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				replaceOptions: false,
			};
			return values[name];
		});

		mockZohoCliqApiRequest.mockResolvedValueOnce({ data: { id: 'UF_123456' } });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ status: 'success' });

		await update.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/userfields/UF_123456',
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/userfields/UF_123456',
			{
				name: 'Employee Number',
			},
		);
	});

	it('should return a coded invalid-name payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'raw',
				updateDefinitionRaw: { name: 'AT This Name Is Way Too Long For Cliq' },
			};
			return values[name];
		});

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'update',
				field_id: 'UF_123456',
				reason: 'INVALID_USER_FIELD_NAME',
				message: 'name is too long. Maximum length is 30 characters.',
			}),
		);
	});

	it('should validate update payload before field lookup preflight in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = [SCOPES.USER_FIELDS_UPDATE, SCOPES.USERS_READ].join(',');

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: '9999999999999999999',
				inputMode: 'raw',
				updateDefinitionRaw: { name: 'AT This Name Is Way Too Long For Cliq' },
			};
			return values[name];
		});

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'update',
				field_id: '9999999999999999999',
				reason: 'INVALID_USER_FIELD_NAME',
				message: 'name is too long. Maximum length is 30 characters.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a coded empty-dropdown-options payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'raw',
				updateDefinitionRaw: { options: [] },
			};
			return values[name];
		});

		const result = await update.execute.call(mockExecuteFunctions, items, grantedScopes);
		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userFields',
				operation: 'update',
				field_id: 'UF_123456',
				reason: 'EMPTY_DROPDOWN_OPTIONS',
				message: 'options cannot be empty when dropdown options are being replaced.',
			}),
		);
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('userFields', 'update');
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
				hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
			}),
		);
	});

	it('should throw error for empty update payload', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'raw',
				updateDefinitionRaw: {},
			};
			return values[name];
		});

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Update Definition cannot be empty',
		);
	});

	it('should throw error for unsupported field', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'raw',
				updateDefinitionRaw: { type: 'drop_down' },
			};
			return values[name];
		});

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'contains unsupported field "type"',
		);
	});

	it('should fail when replaceOptions is enabled but options are empty', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'structured',
				name: '',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				replaceOptions: true,
				options: {},
			};
			return values[name];
		});

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'options cannot be empty',
		);
	});

	it('should normalize empty option values then fail validation', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'structured',
				name: '',
				mandatoryMode: 'unset',
				encryptedMode: 'unset',
				editPermissionMode: 'unset',
				replaceOptions: true,
				options: { values: [{ name: undefined, id: null }] },
			};
			return values[name];
		});

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'options[0].name is required',
		);
	});

	it('should reject unsupported input mode values', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.USER_FIELDS_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			const values: Record<string, unknown> = {
				fieldId: 'UF_123456',
				inputMode: 'guided',
			};
			return values[name];
		});

		await expect(update.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			'Input Mode must be "structured", "agentTool", or "raw"',
		);
	});

	it('should keep structured dropdown options gated by replaceOptions and expose agent/tool dropdown options separately', () => {
		const dropdownOptionsProperty = update.description.find(
			(property) => property.name === 'options',
		);
		const agentToolDropdownOptionsProperty = update.description.find(
			(property) => property.name === 'agentToolOptions',
		);

		expect(dropdownOptionsProperty).toBeDefined();
		expect(dropdownOptionsProperty?.displayOptions?.show).toMatchObject({
			resource: ['userField'],
			operation: ['update'],
			inputMode: ['structured'],
			replaceOptions: [true],
		});

		expect(agentToolDropdownOptionsProperty).toBeDefined();
		expect(agentToolDropdownOptionsProperty?.displayOptions?.show).toMatchObject({
			resource: ['userField'],
			operation: ['update'],
			inputMode: ['agentTool'],
		});
	});

	it('should not expose the rejected is searchable field', () => {
		const property = update.description.find((entry) => entry.name === 'isSearchableMode');

		expect(property).toBeUndefined();
	});
});
