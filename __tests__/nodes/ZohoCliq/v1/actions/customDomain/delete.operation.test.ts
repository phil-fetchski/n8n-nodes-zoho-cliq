import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/customDomain/delete.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const customDomainDeleteScope = getRequiredScopeForOperation('customDomain', 'delete');

describe('ZohoCliq - CustomDomain - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'customDomain';
					if (parameterName === 'operation') return 'delete';
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

	it('should delete the current custom domain with enhanced output by default', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, customDomainDeleteScope);

		expect(result[0].json).toEqual({
			deleted: true,
			success: true,
			resource: 'customDomain',
			operation: 'delete',
			target: 'current_custom_domain',
			data: '',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/customdomain');
	});

	it("should return Cliq's standard delete response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, customDomainDeleteScope);

		expect(result[0].json).toEqual({ deleted: true, data: '' });
	});

	it('should throw for missing scope', async () => {
		const context = createContext();
		let thrownError: unknown;
		try {
			await del.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [customDomainDeleteScope],
				missingScopes: [customDomainDeleteScope],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Custom domain not found',
		});

		const result = await del.execute.call(context, items, customDomainDeleteScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'delete',
				target: 'current_custom_domain',
				status_code: 404,
				reason: 'NOT_FOUND',
			}),
		);
	});

	it('should return a recoverable scope payload in AI Error Mode', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });

		const result = await del.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'customDomain',
				operation: 'delete',
				requiredScopes: [customDomainDeleteScope],
				missingScopes: [customDomainDeleteScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(del.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'deleteCustomDomainDocsNotice', type: 'notice' }),
				expect.objectContaining({
					name: 'deleteCustomDomainAiToolGuideNotice',
					type: 'notice',
				}),
			]),
		);
		expect(del.description[del.description.length - 2]?.name).toBe('deleteCustomDomainDocsNotice');
		expect(del.description[del.description.length - 1]?.name).toBe(
			'deleteCustomDomainAiToolGuideNotice',
		);
	});
});
