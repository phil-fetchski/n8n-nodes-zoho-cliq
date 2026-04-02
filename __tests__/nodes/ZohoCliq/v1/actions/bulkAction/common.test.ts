import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	getMaintenanceRequestHeaders,
	getMaintenanceResponseData,
	getMaintenanceScope,
	getOptionalMaintenanceNextToken,
	isBulkActionAiErrorModeEnabled,
	pushBulkActionRecoverableError,
	validateChannelExportFields,
	validateConversationExportFields,
	validateConversationMemberExportFields,
} from '../../../../../../nodes/ZohoCliq/v1/actions/bulkAction/common';

describe('ZohoCliq - BulkAction - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	let returnData: INodeExecutionData[];

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
		returnData = [];
	});

	it('should return maintenance request headers', () => {
		expect(getMaintenanceRequestHeaders()).toEqual({
			'Content-Type': 'text/csv',
		});
	});

	it('should return scope for conversations and members', () => {
		expect(getMaintenanceScope('conversations')).toBe('ZohoCliq.OrganizationChats.READ');
		expect(getMaintenanceScope('conversationMembers')).toBe('ZohoCliq.OrganizationChats.READ');
	});

	it('should return scope for messages', () => {
		expect(getMaintenanceScope('messages')).toBe('ZohoCliq.OrganizationMessages.READ');
	});

	it('should return scope for channels', () => {
		expect(getMaintenanceScope('channels')).toBe('ZohoCliq.OrganizationChannels.READ');
	});

	it('should return undefined for blank maintenance next tokens', () => {
		expect(getOptionalMaintenanceNextToken(mockExecuteFunctions, '   ', 0)).toBeUndefined();
	});

	it('should return undefined for undefined maintenance next tokens', () => {
		expect(getOptionalMaintenanceNextToken(mockExecuteFunctions, undefined, 0)).toBeUndefined();
	});

	it('should validate maintenance next tokens', () => {
		expect(getOptionalMaintenanceNextToken(mockExecuteFunctions, 'next_page_123', 0)).toBe(
			'next_page_123',
		);
	});

	it('should reject overly long maintenance next tokens', () => {
		expect(() =>
			getOptionalMaintenanceNextToken(mockExecuteFunctions, 'a'.repeat(1025), 0),
		).toThrow('Next Token is too long');
	});

	it('should validate conversation fields', () => {
		expect(validateConversationExportFields(mockExecuteFunctions, ['title', 'chat_id'], 0)).toBe(
			'title,chat_id',
		);
	});

	it('should validate channel fields', () => {
		expect(validateChannelExportFields(mockExecuteFunctions, ['name', 'channel_id'], 0)).toBe(
			'name,channel_id',
		);
	});

	it('should reject the unsupported role channel field', () => {
		expect(() => validateChannelExportFields(mockExecuteFunctions, ['name', 'role'], 0)).toThrow(
			'Unsupported Channel Fields value: "role"',
		);
	});

	it('should validate conversation member fields', () => {
		expect(
			validateConversationMemberExportFields(mockExecuteFunctions, ['name', 'email_id'], 0),
		).toBe('name,email_id');
	});

	describe('validator edge cases', () => {
		it('should reject empty fields for all maintenance field validators', () => {
			expect(() => validateConversationExportFields(mockExecuteFunctions, [], 0)).toThrow(
				'Conversation Fields must include at least one field',
			);
			expect(() => validateChannelExportFields(mockExecuteFunctions, [], 0)).toThrow(
				'Channel Fields must include at least one field',
			);
			expect(() => validateConversationMemberExportFields(mockExecuteFunctions, [], 0)).toThrow(
				'Member Fields must include at least one field',
			);
		});

		it('should reject all-whitespace fields for all maintenance field validators', () => {
			expect(() =>
				validateConversationExportFields(mockExecuteFunctions, ['   ', '\t'], 0),
			).toThrow('Conversation Fields must include at least one field');
			expect(() => validateChannelExportFields(mockExecuteFunctions, ['   ', '\t'], 0)).toThrow(
				'Channel Fields must include at least one field',
			);
			expect(() =>
				validateConversationMemberExportFields(mockExecuteFunctions, ['   ', '\t'], 0),
			).toThrow('Member Fields must include at least one field');
		});

		it('should reject unsupported fields for all maintenance field validators', () => {
			expect(() =>
				validateConversationExportFields(mockExecuteFunctions, ['title', 'oops'], 0),
			).toThrow('Unsupported Conversation Fields value: "oops"');
			expect(() => validateChannelExportFields(mockExecuteFunctions, ['name', 'oops'], 0)).toThrow(
				'Unsupported Channel Fields value: "oops"',
			);
			expect(() =>
				validateConversationMemberExportFields(mockExecuteFunctions, ['name', 'oops'], 0),
			).toThrow('Unsupported Member Fields value: "oops"');
		});

		it('should reject duplicate fields for all maintenance field validators', () => {
			expect(() =>
				validateConversationExportFields(mockExecuteFunctions, ['title', 'title'], 0),
			).toThrow('Conversation Fields cannot contain duplicate values');
			expect(() => validateChannelExportFields(mockExecuteFunctions, ['name', 'name'], 0)).toThrow(
				'Channel Fields cannot contain duplicate values',
			);
			expect(() =>
				validateConversationMemberExportFields(mockExecuteFunctions, ['name', 'name'], 0),
			).toThrow('Member Fields cannot contain duplicate values');
		});
	});

	it('should return sanitized maintenance response data', () => {
		const payload = { csv: 'foo,bar' };
		expect(getMaintenanceResponseData(mockExecuteFunctions, payload, 0)).toEqual(payload);
	});

	it('should wrap string maintenance responses under csv', () => {
		expect(getMaintenanceResponseData(mockExecuteFunctions, 'foo,bar', 0)).toEqual({
			csv: 'foo,bar',
		});
	});

	it('should return unmodified maintenance response data when payload contains arrays', () => {
		const payload = {
			rows: [
				{ id: '1', nested: { status: 'ok' } },
				{ id: '2', nested: { status: 'done' } },
			],
		};
		expect(
			getMaintenanceResponseData(mockExecuteFunctions, payload as unknown as IDataObject, 0),
		).toEqual(payload);
	});

	it('should reject prototype pollution keys in maintenance response data', () => {
		expect(() =>
			getMaintenanceResponseData(mockExecuteFunctions, { nested: { constructor: 'bad' } }, 0),
		).toThrow('Unsafe key "constructor" found in maintenance export response');
	});

	it('should reject prototype pollution keys in array elements in maintenance response data', () => {
		const payload = { rows: [{ constructor: 'bad' }] };
		expect(() =>
			getMaintenanceResponseData(mockExecuteFunctions, payload as unknown as IDataObject, 0),
		).toThrow('Unsafe key "constructor" found in maintenance export response');
	});

	it('should reject __proto__ key in maintenance response data', () => {
		const payload = JSON.parse('{"nested":{"__proto__":"bad"}}');
		expect(() => getMaintenanceResponseData(mockExecuteFunctions, payload, 0)).toThrow(
			'Unsafe key "__proto__" found in maintenance export response',
		);
	});

	it('should detect AI Error Mode from the live node parameter', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') {
				return 'yes';
			}
			return false;
		});

		expect(isBulkActionAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
	});

	it('should detect AI Error Mode from stored node parameters when the field is not directly readable', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('Parameter hidden');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: { enableAiErrorMode: true },
		});

		expect(isBulkActionAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
	});

	it('should return false when AI Error Mode fallback cannot access getNode', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('Parameter hidden');
		});
		(mockExecuteFunctions as unknown as { getNode?: unknown }).getNode = undefined;

		expect(isBulkActionAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when AI Error Mode fallback getNode throws', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('Parameter hidden');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockImplementation(() => {
			throw new Error('Node unavailable');
		});

		expect(isBulkActionAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when AI Error Mode fallback finds non-object node parameters', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('Parameter hidden');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: [],
		});

		expect(isBulkActionAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when AI Error Mode fallback getNode returns nothing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('Parameter hidden');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue(undefined);

		expect(isBulkActionAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should not emit a recoverable payload when continueOnFail and AI Error Mode are disabled', () => {
		const handled = pushBulkActionRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'exportConversations',
			new Error('boom'),
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should preserve the scope payload in recoverable mode', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushBulkActionRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'exportChannels',
			{
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'bulkAction',
					operation: 'exportChannels',
					requiredScopes: ['ZohoCliq.OrganizationChannels.READ'],
					missingScopes: ['ZohoCliq.OrganizationChannels.READ'],
				},
			},
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					resource: 'bulkAction',
					operation: 'exportChannels',
					requiredScopes: ['ZohoCliq.OrganizationChannels.READ'],
					missingScopes: ['ZohoCliq.OrganizationChannels.READ'],
				},
			},
		]);
	});

	it('should build a generic recoverable payload when AI Error Mode is enabled', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') {
				return true;
			}
			return false;
		});

		const handled = pushBulkActionRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'exportMessages',
			{
				statusCode: 404,
				message: 'Chat not found',
			},
			{
				contextFields: { chat_id: '1277744317795524707' },
			},
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'bulkAction',
					operation: 'exportMessages',
					chat_id: '1277744317795524707',
					status_code: 404,
					reason: 'NOT_FOUND',
				}),
			},
		]);
	});

	it('should ignore malformed scope payloads and fall back to the generic recoverable payload', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushBulkActionRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'exportChannels',
			{
				zohoCliqScopeErrorPayload: ['bad'],
				message: 'Fallback me',
			},
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'bulkAction',
					operation: 'exportChannels',
					message: 'Fallback me',
				}),
			},
		]);
	});

	it('should build a fallback recoverable payload when the error is undefined', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushBulkActionRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'exportConversations',
			undefined,
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: expect.objectContaining({
					success: false,
					resource: 'bulkAction',
					operation: 'exportConversations',
					message: 'An unexpected issue occurred with the API request',
				}),
			},
		]);
	});
});
