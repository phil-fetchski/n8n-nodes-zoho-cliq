import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as dismissSnooze from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/dismissSnooze.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Dismiss Snooze Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { reminderId?: string; includeEnhancedOutput?: boolean } = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { reminderId = 'rem_123', includeEnhancedOutput = true } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
				if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: { constructExecutionMetaData: jest.fn((data) => data) },
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

	it('should return enhanced output by default for minimal dismiss-snooze responses', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await dismissSnooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/reminders/rem_123/dismisssnooze',
		);
		expect(result[0].json).toEqual({
			data: '',
			success: true,
			resource: 'reminders',
			operation: 'dismissSnooze',
			reminder_id: 'rem_123',
			snooze_dismissed: true,
		});
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await dismissSnooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual({ status: 'ok' });
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'dismissSnooze');

		let thrownError: unknown;
		try {
			await dismissSnooze.execute.call(context, items, '');
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

		const result = await dismissSnooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'dismissSnooze',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
	});

	it('should return a mapped recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Dismiss snooze works only for reminders that are snoozed',
		});

		const result = await dismissSnooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'dismissSnooze',
				reminder_id: 'rem_123',
				reason: 'SNOOZE_STATE_REQUIRED',
			}),
		);
	});

	it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
		const context = createContext({ reminderId: 'rem_404' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await dismissSnooze.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'dismissSnooze',
				reminder_id: 'rem_404',
				reason: 'REMINDER_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should fall back to generic BAD_REQUEST when dismiss-snooze preflight is skipped', async () => {
		const context = createContext({ reminderId: 'rem_404' }, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await dismissSnooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'dismissSnooze',
				reminder_id: 'rem_404',
				status_code: 400,
				reason: 'BAD_REQUEST',
				hint: 'Check required parameters, field formats, and request constraints.',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(dismissSnooze.description[dismissSnooze.description.length - 2]?.name).toBe(
			'dismissSnoozeReminderDocsNotice',
		);
		expect(dismissSnooze.description[dismissSnooze.description.length - 1]?.name).toBe(
			'dismissSnoozeReminderAiToolGuideNotice',
		);
		expect(
			String(dismissSnooze.description[dismissSnooze.description.length - 2]?.displayName),
		).toContain('REQUIRED SCOPES:');
	});
});
