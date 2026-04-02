import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as deleteBatch from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/deleteBatch.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Delete Batch Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			inputMode?: string;
			reminderIds?: string;
			deleteBatchPayload?: unknown;
			includeEnhancedOutput?: boolean;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const {
			inputMode = 'structured',
			reminderIds = 'rem_1,rem_2',
			deleteBatchPayload = { reminder_ids: ['rem_1', 'rem_2'] },
			includeEnhancedOutput = true,
		} = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'inputMode') return inputMode;
				if (name === 'reminderIds') return reminderIds;
				if (name === 'deleteBatchPayload') return deleteBatchPayload;
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

	it('should delete reminders in structured mode with enhanced output by default', async () => {
		const context = createContext({ reminderIds: ' rem_1 , rem_2 ' });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await deleteBatch.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/reminders/batch', {
			reminder_ids: ['rem_1', 'rem_2'],
		});
		expect(result[0].json).toEqual({
			data: '',
			deleted: true,
			success: true,
			resource: 'reminders',
			operation: 'deleteBatch',
			reminder_ids: ['rem_1', 'rem_2'],
			reminder_count: 2,
		});
	});

	it('should delete reminders in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			deleteBatchPayload: { reminder_ids: ['rem_9'] },
		});
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await deleteBatch.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/reminders/batch', {
			reminder_ids: ['rem_9'],
		});
		expect(result[0].json).toEqual({
			data: '',
			deleted: true,
			success: true,
			resource: 'reminders',
			operation: 'deleteBatch',
			reminder_ids: ['rem_9'],
			reminder_count: 1,
		});
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await deleteBatch.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual({ deleted: true, status: 'ok' });
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'deleteBatch');

		let thrownError: unknown;
		try {
			await deleteBatch.execute.call(context, items, '');
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
		const context = createContext({ reminderIds: 'bad/id' }, { continueOnFail: true });

		const result = await deleteBatch.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'deleteBatch',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
	});

	it('should return a recoverable batch-size validation error in AI Error Mode', async () => {
		const tooManyIds = Array.from({ length: 21 }, (_, index) => `rem_${index}`).join(',');
		const context = createContext({ reminderIds: tooManyIds }, { enableAiErrorMode: 'true' });

		const result = await deleteBatch.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'deleteBatch',
				reason: 'BATCH_LIMIT_EXCEEDED',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await deleteBatch.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_DELETE},${SCOPES.REMINDERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'deleteBatch',
				reason: 'REMINDER_IDS_NOT_FOUND',
				reminder_ids: ['rem_1', 'rem_2'],
				reminder_count: 2,
			}),
		);
	});

	it('should fall back to generic BAD_REQUEST when batch reminder lookup preflight is skipped', async () => {
		const context = createContext(
			{ reminderIds: 'rem_404,rem_405' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await deleteBatch.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'deleteBatch',
				reminder_ids: ['rem_404', 'rem_405'],
				reminder_count: 2,
				status_code: 400,
				reason: 'BAD_REQUEST',
				hint: 'Check required parameters, field formats, and request constraints.',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(deleteBatch.description[deleteBatch.description.length - 2]?.name).toBe(
			'deleteBatchRemindersDocsNotice',
		);
		expect(deleteBatch.description[deleteBatch.description.length - 1]?.name).toBe(
			'deleteBatchRemindersAiToolGuideNotice',
		);
		expect(
			String(deleteBatch.description[deleteBatch.description.length - 2]?.displayName),
		).toContain('REQUIRED SCOPES:');
	});
});
