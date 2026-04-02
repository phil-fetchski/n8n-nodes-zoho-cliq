import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as verify from '../../../../../../nodes/ZohoCliq/v1/actions/customDomain/verify.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const customDomainVerifyScope = getRequiredScopeForOperation('customDomain', 'verify');

describe('ZohoCliq - CustomDomain - Verify Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			inputMode?: unknown;
			status?: unknown;
			customDomainPayload?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			inputMode = 'structured',
			status = 'active',
			customDomainPayload = { status: 'inactive' },
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'customDomain';
					if (parameterName === 'operation') return 'verify';
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'status') return status;
					if (parameterName === 'customDomainPayload') return customDomainPayload;
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

	it('should verify custom domain successfully with structured fields', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			data: {
				name: 'chat.example.com',
				status: 'active',
				ssl_enabled: true,
			},
		});

		const result = await verify.execute.call(context, items, customDomainVerifyScope);

		expect(result[0].json).toEqual({
			data: {
				name: 'chat.example.com',
				status: 'active',
				ssl_enabled: true,
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/customdomain', {
			status: 'active',
		});
	});

	it('should verify custom domain using a raw object payload', async () => {
		const context = createContext({
			inputMode: 'raw',
			customDomainPayload: { status: 'inactive' },
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await verify.execute.call(context, items, customDomainVerifyScope);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/customdomain', {
			status: 'inactive',
		});
	});

	it('should verify custom domain using a raw stringified payload', async () => {
		const context = createContext({
			inputMode: 'raw',
			customDomainPayload: '{"status":"ACTIVE"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'success' });

		await verify.execute.call(context, items, customDomainVerifyScope);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/customdomain', {
			status: 'active',
		});
	});

	it('should throw for missing scope', async () => {
		const context = createContext();
		let thrownError: unknown;
		try {
			await verify.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [customDomainVerifyScope],
				missingScopes: [customDomainVerifyScope],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	});

	it('should reject invalid status values', async () => {
		const context = createContext({ status: 'pending' });

		await expect(verify.execute.call(context, items, customDomainVerifyScope)).rejects.toThrow(
			'Status must be either "active" or "inactive"',
		);
	});

	it('should reject invalid input modes', async () => {
		const context = createContext({ inputMode: 'legacy' });

		await expect(verify.execute.call(context, items, customDomainVerifyScope)).rejects.toThrow(
			'Input Mode must be either "structured" or "raw"',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ status: 'pending', continueOnFail: true });

		const result = await verify.execute.call(context, items, customDomainVerifyScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'verify',
				reason: 'INVALID_STATUS',
				hint: 'Use exactly one of these values for status: active or inactive.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable input-mode error in AI Error Mode', async () => {
		const context = createContext({ inputMode: 'legacy', enableAiErrorMode: 'true' });

		const result = await verify.execute.call(context, items, customDomainVerifyScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'verify',
				reason: 'INVALID_INPUT_MODE',
				hint: 'Set Input Mode to Using Fields Below or Using JSON.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 429,
			message: 'Too many requests',
		});

		const result = await verify.execute.call(context, items, customDomainVerifyScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'verify',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(verify.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'verifyCustomDomainDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'verifyCustomDomainAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
		expect(verify.description[verify.description.length - 2]?.name).toBe(
			'verifyCustomDomainDocsNotice',
		);
		expect(verify.description[verify.description.length - 1]?.name).toBe(
			'verifyCustomDomainAiToolGuideNotice',
		);
	});
});
