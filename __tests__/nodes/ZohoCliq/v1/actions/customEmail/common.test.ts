import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	appendCustomEmailWarningsToResponse,
	extractCustomEmailIdFromResponse,
	isCustomEmailAiErrorModeEnabled,
	pushCustomEmailRecoverableError,
	validateCustomEmailCnameStatus,
	validateCustomEmailPayload,
} from '../../../../../../nodes/ZohoCliq/v1/actions/customEmail/common';

describe('ZohoCliq - CustomEmail - common helpers', () => {
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

	it('should validate and normalize custom email payload', () => {
		const result = validateCustomEmailPayload(
			mockExecuteFunctions,
			{
				name: '  Support  ',
				email_id: 'support@example.com',
				cname_status: 'verified',
			},
			0,
		);

		expect(result).toEqual({
			name: 'Support',
			email_id: 'support@example.com',
			cname_status: 'verified',
		});
	});

	it('should allow not_verified cname status', () => {
		const result = validateCustomEmailPayload(
			mockExecuteFunctions,
			{
				name: 'Support',
				email_id: 'support@example.com',
				cname_status: 'not_verified',
			},
			0,
		);

		expect(result.cname_status).toBe('not_verified');
	});

	it('should normalize cname status case-insensitively', () => {
		const result = validateCustomEmailPayload(
			mockExecuteFunctions,
			{
				name: 'Support',
				email_id: 'support@example.com',
				cname_status: 'VeRiFiEd',
			},
			0,
		);

		expect(result.cname_status).toBe('verified');
	});

	it('should normalize unverified alias to not_verified', () => {
		const result = validateCustomEmailPayload(
			mockExecuteFunctions,
			{
				name: 'Support',
				email_id: 'support@example.com',
				cname_status: 'UNVERIFIED',
			},
			0,
		);

		expect(result.cname_status).toBe('not_verified');
	});

	it('should validate cname status directly', () => {
		expect(validateCustomEmailCnameStatus(mockExecuteFunctions, ' VERIFIED ', 0)).toBe('verified');
	});

	it('should extract email_id from a nested custom email response', () => {
		expect(extractCustomEmailIdFromResponse({ data: { email_id: 'support@example.com' } })).toBe(
			'support@example.com',
		);
	});

	it('should return undefined when extracting email_id from a primitive response', () => {
		expect(extractCustomEmailIdFromResponse('support@example.com')).toBeUndefined();
	});

	it('should prefer top-level email_id when extracting the current custom email', () => {
		expect(
			extractCustomEmailIdFromResponse({
				email_id: 'top@example.com',
				data: { email_id: 'nested@example.com' },
			}),
		).toBe('top@example.com');
	});

	it('should return undefined when nested data is not an object', () => {
		expect(extractCustomEmailIdFromResponse({ data: 'support@example.com' })).toBeUndefined();
	});

	it('should return undefined when the response has no email_id at any level', () => {
		expect(extractCustomEmailIdFromResponse({ data: { name: 'Support' } })).toBeUndefined();
	});

	it('should append custom email warnings to an object response', () => {
		expect(
			appendCustomEmailWarningsToResponse({ data: { email_id: 'support@example.com' } }, [
				{
					field: 'email_id',
					reason: 'Existing email remains configured.',
				},
			]),
		).toEqual({
			data: { email_id: 'support@example.com' },
			_warnings: [
				{
					field: 'email_id',
					reason: 'Existing email remains configured.',
				},
			],
		});
	});

	it('should return the base response unchanged when no custom email warnings are present', () => {
		expect(
			appendCustomEmailWarningsToResponse({ data: { email_id: 'support@example.com' } }, []),
		).toEqual({
			data: { email_id: 'support@example.com' },
		});
	});

	it('should wrap primitive responses when appending custom email warnings', () => {
		expect(
			appendCustomEmailWarningsToResponse('success', [
				{
					field: 'email_id',
					reason: 'Existing email remains configured.',
				},
			]),
		).toEqual({
			data: 'success',
			_warnings: [
				{
					field: 'email_id',
					reason: 'Existing email remains configured.',
				},
			],
		});
	});

	it('should append custom email warnings to existing warning arrays', () => {
		expect(
			appendCustomEmailWarningsToResponse(
				{
					data: { email_id: 'support@example.com' },
					_warnings: [{ field: 'existing', reason: 'Existing warning' }],
				},
				[{ field: 'email_id', reason: 'New warning' }],
			),
		).toEqual({
			data: { email_id: 'support@example.com' },
			_warnings: [
				{ field: 'existing', reason: 'Existing warning' },
				{ field: 'email_id', reason: 'New warning' },
			],
		});
	});

	it('should throw for non-object payload', () => {
		expect(() =>
			validateCustomEmailPayload(mockExecuteFunctions, 'bad' as unknown as never, 0),
		).toThrow('Custom Email Payload must be a JSON object');
	});

	it('should throw for unsafe payload key', () => {
		const unsafe = JSON.parse('{"__proto__":"polluted"}') as Record<string, string>;
		expect(() => validateCustomEmailPayload(mockExecuteFunctions, unsafe, 0)).toThrow(
			'Unsafe key "__proto__" is not allowed',
		);
	});

	it('should throw for unsupported payload field', () => {
		expect(() =>
			validateCustomEmailPayload(
				mockExecuteFunctions,
				{
					name: 'Support',
					email_id: 'support@example.com',
					cname_status: 'verified',
					extra: 'nope',
				},
				0,
			),
		).toThrow('Custom Email Payload contains unsupported field "extra"');
	});

	it('should throw for missing name', () => {
		expect(() =>
			validateCustomEmailPayload(
				mockExecuteFunctions,
				{ email_id: 'a@b.com', cname_status: 'verified' },
				0,
			),
		).toThrow('Custom Email name is required');
	});

	it('should throw for name too long', () => {
		expect(() =>
			validateCustomEmailPayload(
				mockExecuteFunctions,
				{ name: 'a'.repeat(121), email_id: 'a@b.com', cname_status: 'verified' },
				0,
			),
		).toThrow('Custom Email name is too long');
	});

	it('should throw for missing email', () => {
		expect(() =>
			validateCustomEmailPayload(
				mockExecuteFunctions,
				{ name: 'Support', cname_status: 'verified' },
				0,
			),
		).toThrow('Custom Email email_id is required');
	});

	it('should throw for missing cname status', () => {
		expect(() =>
			validateCustomEmailPayload(mockExecuteFunctions, { name: 'Support', email_id: 'a@b.com' }, 0),
		).toThrow('Custom Email cname_status is required');
	});

	it('should throw for invalid email format', () => {
		expect(() =>
			validateCustomEmailPayload(
				mockExecuteFunctions,
				{ name: 'Support', email_id: 'bad email', cname_status: 'verified' },
				0,
			),
		).toThrow('Invalid email format');
	});

	it('should throw for invalid cname status', () => {
		expect(() => validateCustomEmailCnameStatus(mockExecuteFunctions, 'pending', 0)).toThrow(
			'Custom Email cname_status must be one of',
		);
	});

	it('should detect AI Error Mode from the parameter directly', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(true);

		expect(isCustomEmailAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
	});

	it('should detect AI Error Mode from node parameters when getNodeParameter lookup fails', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not configured');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: {
				enableAiErrorMode: 'true',
			},
		});

		expect(isCustomEmailAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(true);
	});

	it('should return false when AI Error Mode is not enabled anywhere', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(false);

		expect(isCustomEmailAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when fallback node parameters are missing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not configured');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
		});

		expect(isCustomEmailAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when fallback getNode returns undefined', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not configured');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockReturnValue(undefined);

		expect(isCustomEmailAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode is unavailable during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not configured');
		});
		delete (mockExecuteFunctions as Partial<IExecuteFunctions>).getNode;

		expect(isCustomEmailAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should return false when getNode throws during AI Error Mode fallback lookup', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => {
			throw new Error('not configured');
		});
		(mockExecuteFunctions.getNode as jest.Mock).mockImplementation(() => {
			throw new Error('boom');
		});

		expect(isCustomEmailAiErrorModeEnabled(mockExecuteFunctions, 0)).toBe(false);
	});

	it('should not push a recoverable error when continueOnFail and AI Error Mode are disabled', () => {
		const handled = pushCustomEmailRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'verifyCustomEmail',
			new Error('boom'),
		);

		expect(handled).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should preserve dedicated scope payloads in recoverable mode', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushCustomEmailRecoverableError(mockExecuteFunctions, returnData, 0, 'x', {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'customEmail',
				operation: 'updateMailConfiguration',
			},
		});

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					success: false,
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
				},
			},
		]);
	});

	it('should let canonical scope payload metadata win over context field collisions', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		pushCustomEmailRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'updateMailConfiguration',
			{
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
				},
			},
			{
				contextFields: {
					resource: 'wrong',
					operation: 'wrong',
					email_id: 'support@example.com',
				},
			},
		);

		expect(returnData).toEqual([
			{
				json: {
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					email_id: 'support@example.com',
					success: false,
				},
			},
		]);
	});

	it('should fall back to the generic recoverable payload when scope payload is not an object', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		pushCustomEmailRecoverableError(mockExecuteFunctions, returnData, 0, 'verifyCustomEmail', {
			zohoCliqScopeErrorPayload: 'bad',
			message: 'Recoverable generic path',
		});

		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'Recoverable generic path',
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
				},
			},
		]);
	});

	it('should fall back to the generic recoverable payload when error is undefined', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		pushCustomEmailRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'verifyCustomEmail',
			undefined,
			{
				fallbackMessage: 'Undefined recoverable error',
			},
		);

		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'Undefined recoverable error',
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
				},
			},
		]);
	});

	it('should build a mapped recoverable payload with context fields', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const handled = pushCustomEmailRecoverableError(
			mockExecuteFunctions,
			returnData,
			0,
			'updateMailConfiguration',
			Object.assign(new Error('Invalid email format'), { statusCode: 400 }),
			{
				contextFields: {
					email_id: 'bad email',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('invalid email format'),
						reason: 'INVALID_EMAIL',
						hint: 'Use a valid sender email address.',
					},
				],
			},
		);

		expect(handled).toBe(true);
		expect(returnData).toEqual([
			{
				json: {
					details: {
						statusCode: 400,
					},
					success: false,
					message: 'Invalid email format',
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					email_id: 'bad email',
					status_code: 400,
					status_class: '4xx',
					reason: 'INVALID_EMAIL',
					hint: 'Use a valid sender email address.',
				},
			},
		]);
	});

	it('should use the fallback message for unknown recoverable errors', () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		pushCustomEmailRecoverableError(
			mockExecuteFunctions,
			returnData,
			1,
			'verifyCustomEmail',
			{},
			{
				fallbackMessage: 'Fallback custom email error',
			},
		);

		expect(returnData).toEqual([
			{
				json: {
					success: false,
					message: 'Fallback custom email error',
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
				},
			},
		]);
		expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenCalledWith(
			[
				{
					json: {
						success: false,
						message: 'Fallback custom email error',
						resource: 'customEmail',
						operation: 'verifyCustomEmail',
					},
				},
			],
			{ itemData: { item: 1 } },
		);
	});
});
