import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import * as createTransient from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/createTransient.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const userStatusCreateTransientScope = getRequiredScopeForOperation(
	'userStatus',
	'createTransient',
);

describe('ZohoCliq - UserStatus - Create Transient Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			inputMode?: unknown;
			code?: string;
			message?: string;
			expiryDateTime?: unknown;
			transientStatusDefinition?: unknown;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			inputMode = 'structured',
			code = 'available',
			message = 'Out for lunch',
			expiryDateTime = '2022-01-11T16:44:36.276Z',
			transientStatusDefinition = '{"code":"busy","message":"In a call","expiry":1641883476276}',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'userStatus';
					if (parameterName === 'operation') return 'createTransient';
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'code') return code;
					if (parameterName === 'message') return message;
					if (parameterName === 'expiryDateTime') return expiryDateTime;
					if (parameterName === 'transientStatusDefinition') return transientStatusDefinition;
					if (parameterName === 'includeEnhancedOutput') return includeEnhancedOutput;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should expose includeEnhancedOutput plus docs and AI guide notices at the bottom', () => {
		expect(createTransient.description.map((property) => property.name)).toEqual([
			'inputMode',
			'code',
			'message',
			'expiryDateTime',
			'transientStatusDefinition',
			'includeEnhancedOutput',
			'createTransientStatusDocsNotice',
			'createTransientStatusAiToolGuideNotice',
		]);
		expect(
			createTransient.description[createTransient.description.length - 1]?.displayName,
		).toContain('AI Tool Setup Guide');
	});

	it('should create a transient status with enhanced output by default', async () => {
		const context = createContext({ inputMode: 'structured' });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await createTransient.execute.call(
			context,
			items,
			userStatusCreateTransientScope,
		);

		expect(result[0].json).toEqual({
			success: true,
			resource: 'userStatus',
			operation: 'createTransient',
			code: 'available',
			message: 'Out for lunch',
			expiry: 1641919476276,
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/statuses/ephemeral', {
			code: 'available',
			message: 'Out for lunch',
			expiry: 1641919476276,
		});
	});

	it('should accept ISO date-time expiry inside raw JSON input', async () => {
		const context = createContext({
			inputMode: 'raw',
			transientStatusDefinition:
				'{"code":"busy","message":"In a call","expiry":"2022-01-11T16:44:36.276Z"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		await createTransient.execute.call(context, items, userStatusCreateTransientScope);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/statuses/ephemeral', {
			code: 'busy',
			message: 'In a call',
			expiry: 1641919476276,
		});
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await createTransient.execute.call(
			context,
			items,
			userStatusCreateTransientScope,
		);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should reject unsupported input modes', async () => {
		const context = createContext({ inputMode: 'agentTool' });

		await expect(
			createTransient.execute.call(context, items, userStatusCreateTransientScope),
		).rejects.toThrow('Input Mode must be either "structured" or "raw"');
	});

	it('should surface validation failures for invalid transient expiry values', async () => {
		const context = createContext({
			inputMode: 'raw',
			transientStatusDefinition: '{"code":"busy","message":"In a call","expiry":"not-a-date"}',
		});

		await expect(
			createTransient.execute.call(context, items, userStatusCreateTransientScope),
		).rejects.toThrow(
			'Transient Status Definition.expiry must be a valid date-time value or Unix timestamp in milliseconds',
		);
	});

	it('should return a recoverable invalid-expiry payload when AI Error Mode is enabled', async () => {
		const context = createContext({
			enableAiErrorMode: 'true',
			inputMode: 'structured',
			expiryDateTime: 'not-a-date',
		});

		const result = await createTransient.execute.call(
			context,
			items,
			userStatusCreateTransientScope,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Expiry must be a valid date-time value or Unix timestamp in milliseconds',
				reason: 'INVALID_EXPIRY_TIME',
				hint: 'Provide a future expiry as an ISO 8601 date-time value or Unix timestamp in milliseconds.',
				resource: 'userStatus',
				operation: 'createTransient',
				input_mode: 'structured',
				expiry: 'not-a-date',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable invalid-code payload when AI Error Mode is enabled', async () => {
		const context = createContext({
			enableAiErrorMode: 'true',
			inputMode: 'structured',
			code: 'on_the_moon',
			expiryDateTime: '1774309625000',
		});

		const result = await createTransient.execute.call(
			context,
			items,
			userStatusCreateTransientScope,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message:
					'Invalid Transient Status Definition.code "on_the_moon". Use one of: available, busy, invisible.',
				reason: 'INVALID_STATUS_CODE',
				hint: 'Provide `code` as one of: available, busy, invisible.',
				resource: 'userStatus',
				operation: 'createTransient',
				input_mode: 'structured',
				expiry: '1774309625000',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should omit expiry from recoverable payloads when the invalid expiry cannot be echoed safely', async () => {
		const context = createContext({
			enableAiErrorMode: 'true',
			inputMode: 'structured',
			expiryDateTime: true,
		});

		const result = await createTransient.execute.call(
			context,
			items,
			userStatusCreateTransientScope,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Expiry must be a valid date-time value or Unix timestamp in milliseconds',
				reason: 'INVALID_EXPIRY_TIME',
				hint: 'Provide a future expiry as an ISO 8601 date-time value or Unix timestamp in milliseconds.',
				resource: 'userStatus',
				operation: 'createTransient',
				input_mode: 'structured',
			}),
		);
		expect(result[0].json).not.toHaveProperty('expiry');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const context = createContext({
			continueOnFail: true,
			inputMode: 'structured',
			code: 'busy',
			message: 'In a call',
			expiryDateTime: 1641883476276,
		});
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Transient update failed'));

		const result = await createTransient.execute.call(
			context,
			items,
			userStatusCreateTransientScope,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Transient update failed',
				resource: 'userStatus',
				operation: 'createTransient',
				input_mode: 'structured',
				presence_code: 'busy',
				status_message: 'In a call',
				expiry: 1641883476276,
			}),
		);
	});

	it('should map past-expiry API failures to machine-readable expiry guidance', async () => {
		const context = createContext({
			continueOnFail: true,
			inputMode: 'structured',
			code: 'busy',
			message: '[AGENT-TEST] Past Expiry Test',
			expiryDateTime: 1577854800000,
		});
		mockZohoCliqApiRequest.mockRejectedValue(
			new Error('The time you have entered is invalid. Enter a future time.'),
		);

		const result = await createTransient.execute.call(
			context,
			items,
			userStatusCreateTransientScope,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'The time you have entered is invalid. Enter a future time.',
				reason: 'INVALID_EXPIRY_TIME',
				hint: 'Provide a future expiry as an ISO 8601 date-time value or Unix timestamp in milliseconds.',
				resource: 'userStatus',
				operation: 'createTransient',
				input_mode: 'structured',
				presence_code: 'busy',
				status_message: '[AGENT-TEST] Past Expiry Test',
				expiry: 1577854800000,
			}),
		);
	});

	it('should rethrow API failures when recoverable mode is disabled', async () => {
		const context = createContext({ continueOnFail: false });
		mockZohoCliqApiRequest.mockRejectedValue(new Error('Transient hard failure'));

		await expect(
			createTransient.execute.call(context, items, userStatusCreateTransientScope),
		).rejects.toThrow('Transient hard failure');
	});

	it('should return a recoverable scope payload when AI Error Mode is enabled', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });

		const result = await createTransient.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'createTransient',
				requiredScopes: [userStatusCreateTransientScope],
				missingScopes: [userStatusCreateTransientScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});
});
