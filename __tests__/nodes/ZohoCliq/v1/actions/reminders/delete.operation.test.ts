import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/delete.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Delete Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { includeEnhancedOutput?: boolean; reminderId?: string } = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { reminderId = 'rem:123' } = values;
		const hasIncludeEnhancedOutput = 'includeEnhancedOutput' in values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				if (name === 'includeEnhancedOutput' && hasIncludeEnhancedOutput) {
					return values.includeEnhancedOutput;
				}
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

	it('should return enhanced output by default for minimal delete responses', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('DELETE', '/api/v2/reminders/rem%3A123');
		expect(result[0].json).toEqual({
			data: '',
			deleted: true,
			success: true,
			resource: 'reminders',
			operation: 'delete',
			reminder_id: 'rem:123',
		});
	});

	it('should return enhanced output when explicitly enabled for minimal delete responses', async () => {
		const context = createContext({ includeEnhancedOutput: true });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await del.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual({
			data: '',
			deleted: true,
			success: true,
			resource: 'reminders',
			operation: 'delete',
			reminder_id: 'rem:123',
		});
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false, reminderId: 'rem_123' });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await del.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual({ deleted: true, status: 'ok' });
	});

	it('should throw error for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'delete');

		let thrownError: unknown;
		try {
			await del.execute.call(context, items, '');
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
		const context = createContext({ reminderId: 'bad/id' }, { continueOnFail: true });

		const result = await del.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'delete',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ reminderId: 'rem_123' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await del.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_DELETE},${SCOPES.REMINDERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'delete',
				reminder_id: 'rem_123',
				reason: 'REMINDER_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should fall back to generic BAD_REQUEST when reminder lookup preflight is skipped for delete', async () => {
		const context = createContext({ reminderId: 'rem_404' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await del.execute.call(context, items, SCOPES.REMINDERS_DELETE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'delete',
				reminder_id: 'rem_404',
				status_code: 400,
				reason: 'BAD_REQUEST',
				hint: 'Check required parameters, field formats, and request constraints.',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(del.description[del.description.length - 2]?.name).toBe('deleteReminderDocsNotice');
		expect(del.description[del.description.length - 1]?.name).toBe(
			'deleteReminderAiToolGuideNotice',
		);
		expect(String(del.description[del.description.length - 2]?.displayName)).toContain(
			'REQUIRED SCOPES:',
		);
	});
});
