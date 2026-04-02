import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as add from '../../../../../../nodes/ZohoCliq/v1/actions/customDomain/add.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const customDomainAddScope = getRequiredScopeForOperation('customDomain', 'add');

describe('ZohoCliq - CustomDomain - Add Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			name?: string;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			name = 'portal.example.com',
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'customDomain';
					if (parameterName === 'operation') return 'add';
					if (parameterName === 'name') return name;
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

	it('should add custom domain successfully', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValueOnce({}).mockResolvedValueOnce({
			data: {
				name: 'portal.example.com',
				status: 'inactive',
				ssl_enabled: false,
			},
		});

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual({
			data: {
				name: 'portal.example.com',
				status: 'inactive',
				ssl_enabled: false,
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/customdomain');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/v2/customdomain', {
			name: 'portal.example.com',
		});
	});

	it('should throw for missing scope', async () => {
		const context = createContext();
		let thrownError: unknown;
		try {
			await add.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [customDomainAddScope],
				missingScopes: [customDomainAddScope],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	});

	it('should reject invalid domain values', async () => {
		const context = createContext({ name: 'bad_domain' });

		await expect(add.execute.call(context, items, customDomainAddScope)).rejects.toThrow(
			'Invalid Custom Domain format',
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ name: 'bad_domain', continueOnFail: true });

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'add',
				custom_domain_name: 'bad_domain',
				reason: 'INVALID_CUSTOM_DOMAIN',
				hint: 'Use a valid fully qualified domain name such as chat.example.com.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should omit custom_domain_name from recoverable errors when the supplied value is blank', async () => {
		const context = createContext({ name: '   ', continueOnFail: true });

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'add',
				reason: 'INVALID_CUSTOM_DOMAIN',
			}),
		);
		expect(result[0].json).not.toHaveProperty('custom_domain_name');
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should preserve custom_domain_name on recoverable scope payloads', async () => {
		const context = createContext({ name: 'portal.example.com', enableAiErrorMode: 'true' });

		const result = await add.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'add',
				requiredScopes: [customDomainAddScope],
				missingScopes: [customDomainAddScope],
				custom_domain_name: 'portal.example.com',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message: 'The custom domain value is invalid.',
		});

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'add',
				custom_domain_name: 'portal.example.com',
				status_code: 400,
			}),
		);
	});

	it('should skip add and return friendly response when another custom domain already exists', async () => {
		const context = createContext({ name: 'zohocliq.glencadia.com' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				name: 'cliq.glencadia.com',
				status: 'active',
			},
		});

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual({
			skipped: true,
			action: 'addCustomDomain',
			reason: 'A custom domain is already configured. Remove it before adding a different domain.',
			requestedName: 'zohocliq.glencadia.com',
			existingCustomDomain: {
				name: 'cliq.glencadia.com',
				status: 'active',
			},
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should skip add when the requested custom domain is already configured', async () => {
		const context = createContext({ name: 'CLIQ.GLENCADIA.COM' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				name: 'cliq.glencadia.com',
				status: 'active',
			},
		});

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual({
			skipped: true,
			action: 'addCustomDomain',
			reason: 'The requested custom domain is already configured.',
			requestedName: 'cliq.glencadia.com',
			existingCustomDomain: {
				name: 'cliq.glencadia.com',
				status: 'active',
			},
		});
	});

	it('should proceed with add when pre-check data has no valid custom domain name', async () => {
		const context = createContext();
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { status: 'active' } })
			.mockResolvedValueOnce({ status: 'success' });

		await add.execute.call(context, items, customDomainAddScope);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/v2/customdomain', {
			name: 'portal.example.com',
		});
	});

	it('should continue with add when the pre-check request fails', async () => {
		const context = createContext();
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('Pre-check failed'))
			.mockResolvedValueOnce({ status: 'success' });

		await add.execute.call(context, items, customDomainAddScope);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/v2/customdomain', {
			name: 'portal.example.com',
		});
	});

	it('should proceed with add when pre-check has a blank existing domain name', async () => {
		const context = createContext();
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { name: '   ', status: 'active' } })
			.mockResolvedValueOnce({ status: 'success' });

		await add.execute.call(context, items, customDomainAddScope);

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/v2/customdomain', {
			name: 'portal.example.com',
		});
	});

	it('should skip add and omit status when the existing domain status is blank', async () => {
		const context = createContext({ name: 'other.example.com' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				name: 'configured.example.com',
				status: '   ',
			},
		});

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual({
			skipped: true,
			action: 'addCustomDomain',
			reason: 'A custom domain is already configured. Remove it before adding a different domain.',
			requestedName: 'other.example.com',
			existingCustomDomain: {
				name: 'configured.example.com',
			},
		});
	});

	it('should skip add and omit status when the existing domain status is missing', async () => {
		const context = createContext({ name: 'other.example.com' });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				name: 'configured.example.com',
			},
		});

		const result = await add.execute.call(context, items, customDomainAddScope);

		expect(result[0].json).toEqual({
			skipped: true,
			action: 'addCustomDomain',
			reason: 'A custom domain is already configured. Remove it before adding a different domain.',
			requestedName: 'other.example.com',
			existingCustomDomain: {
				name: 'configured.example.com',
			},
		});
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(add.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'addCustomDomainDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'addCustomDomainAiToolGuideNotice', type: 'notice' }),
			]),
		);
		expect(add.description[add.description.length - 2]?.name).toBe('addCustomDomainDocsNotice');
		expect(add.description[add.description.length - 1]?.name).toBe(
			'addCustomDomainAiToolGuideNotice',
		);
	});
});
