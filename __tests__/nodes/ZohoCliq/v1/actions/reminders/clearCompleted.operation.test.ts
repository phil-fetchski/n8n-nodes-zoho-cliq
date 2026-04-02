import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as clearCompleted from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/clearCompleted.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Clear Completed Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			category?: string;
			includeEnhancedOutput?: boolean;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { category = 'mine-completed', includeEnhancedOutput = true } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'category') return category;
				if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
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

	it('should clear completed reminders in structured mode with enhanced output by default', async () => {
		const context = createContext({ category: 'mine-completed' });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await clearCompleted.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/reminders/clearcompleted',
			{ category: 'mine-completed' },
		);
		expect(result[0].json).toEqual({
			data: '',
			success: true,
			resource: 'reminders',
			operation: 'clearCompleted',
			category: 'mine-completed',
		});
	});

	it('should normalize friendly completed-category expressions', async () => {
		const context = createContext({
			category: 'Others Completed',
		});
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await clearCompleted.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'DELETE',
			'/api/v2/reminders/clearcompleted',
			{ category: 'others-completed' },
		);
		expect(result[0].json).toEqual({
			data: '',
			success: true,
			resource: 'reminders',
			operation: 'clearCompleted',
			category: 'others-completed',
		});
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await clearCompleted.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual({ status: 'ok' });
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'clearCompleted');

		let thrownError: unknown;
		try {
			await clearCompleted.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext({ category: 'mine' }, { continueOnFail: true });

		const result = await clearCompleted.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'clearCompleted',
				reason: 'INVALID_CATEGORY',
			}),
		);
	});

	it('should return a recoverable validation error in AI Error Mode for unsupported category values', async () => {
		const context = createContext({ category: 'completed' }, { enableAiErrorMode: 'true' });

		const result = await clearCompleted.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'clearCompleted',
				reason: 'INVALID_CATEGORY',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 429,
			message: 'Too many requests',
		});

		const result = await clearCompleted.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'clearCompleted',
				status_code: 429,
				reason: 'RATE_LIMITED',
				category: 'mine-completed',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(clearCompleted.description.some((field) => field.name === 'inputMode')).toBe(false);
		expect(clearCompleted.description.some((field) => field.name === 'clearCompletedPayload')).toBe(
			false,
		);
		expect(clearCompleted.description[clearCompleted.description.length - 3]?.name).toBe(
			'includeEnhancedOutput',
		);
		expect(clearCompleted.description[clearCompleted.description.length - 2]?.name).toBe(
			'clearCompletedRemindersDocsNotice',
		);
		expect(clearCompleted.description[clearCompleted.description.length - 1]?.name).toBe(
			'clearCompletedRemindersAiToolGuideNotice',
		);
		expect(
			String(clearCompleted.description[clearCompleted.description.length - 2]?.displayName),
		).toContain('REQUIRED SCOPES:');
	});
});
