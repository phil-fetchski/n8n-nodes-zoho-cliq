import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/customDomain/get.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const customDomainGetScope = getRequiredScopeForOperation('customDomain', 'get');

describe('ZohoCliq - CustomDomain - Get Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const { enableAiErrorMode = false, continueOnFail = false } = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'customDomain';
					if (parameterName === 'operation') return 'get';
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

	it('should get custom domain settings successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			data: {
				name: 'chat.example.com',
				status: 'active',
				ssl_enabled: true,
			},
		});

		const result = await get.execute.call(context, items, customDomainGetScope);

		expect(result[0].json).toEqual({
			data: {
				name: 'chat.example.com',
				status: 'active',
				ssl_enabled: true,
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/customdomain');
	});

	it('should return a helpful AI-mode message when no custom domain is configured', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValue({
			url: '/api/v2/customdomain',
			data: {},
		});

		const result = await get.execute.call(context, items, customDomainGetScope);

		expect(result[0].json).toEqual({
			url: '/api/v2/customdomain',
			data: {},
			success: true,
			resource: 'customDomain',
			operation: 'get',
			configured: false,
			message: 'No Custom Domain is currently configured for the authenticated Zoho Cliq account.',
		});
	});

	it('should preserve the raw empty response when AI Error Mode is disabled', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({
			url: '/api/v2/customdomain',
			data: {},
		});

		const result = await get.execute.call(context, items, customDomainGetScope);

		expect(result[0].json).toEqual({
			url: '/api/v2/customdomain',
			data: {},
		});
	});

	it('should preserve the raw response in AI Error Mode when the data payload is missing', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValue({
			url: '/api/v2/customdomain',
		});

		const result = await get.execute.call(context, items, customDomainGetScope);

		expect(result[0].json).toEqual({
			url: '/api/v2/customdomain',
		});
	});

	it('should throw for missing scope', async () => {
		const context = createContext();
		let thrownError: unknown;
		try {
			await get.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [customDomainGetScope],
				missingScopes: [customDomainGetScope],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 403,
			message: 'Forbidden',
		});

		const result = await get.execute.call(context, items, customDomainGetScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'get',
				status_code: 403,
				reason: 'FORBIDDEN',
			}),
		);
	});

	it('should return a recoverable scope payload in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });

		const result = await get.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'get',
				requiredScopes: [customDomainGetScope],
				missingScopes: [customDomainGetScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(get.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'getCustomDomainDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'getCustomDomainAiToolGuideNotice', type: 'notice' }),
			]),
		);
		expect(get.description[get.description.length - 2]?.name).toBe('getCustomDomainDocsNotice');
		expect(get.description[get.description.length - 1]?.name).toBe(
			'getCustomDomainAiToolGuideNotice',
		);
	});
});
