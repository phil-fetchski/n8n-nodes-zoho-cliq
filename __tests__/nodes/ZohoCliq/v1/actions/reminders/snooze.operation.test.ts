import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as snooze from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/snooze.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Snooze Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			reminderId?: string;
			inputMode?: string;
			snoozeInputMode?: unknown;
			snoozePreset?: number;
			time?: number;
			snoozePayload?: unknown;
			includeEnhancedOutput?: boolean;
		} = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const {
			reminderId = 'rem_123',
			inputMode = 'structured',
			snoozeInputMode = 'preset',
			snoozePreset = 900000,
			time = 600000,
			snoozePayload = { time: 300000 },
			includeEnhancedOutput = true,
		} = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
				if (name === 'inputMode') return inputMode;
				if (name === 'snoozeInputMode') return snoozeInputMode;
				if (name === 'snoozePreset') return snoozePreset;
				if (name === 'time') return time;
				if (name === 'snoozePayload') return snoozePayload;
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

	it('should snooze a reminder successfully in structured preset mode with enhanced output by default', async () => {
		const context = createContext({
			inputMode: 'structured',
			snoozeInputMode: 'preset',
			snoozePreset: 900000,
		});
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123/snooze', {
			time: 900000,
		});
		expect(result[0].json).toEqual({
			data: '',
			success: true,
			resource: 'reminders',
			operation: 'snooze',
			reminder_id: 'rem_123',
			snooze_time_ms: 900000,
		});
	});

	it('should snooze a reminder successfully in structured custom mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			snoozeInputMode: 'custom',
			time: 600000,
		});
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123/snooze', {
			time: 600000,
		});
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				snooze_time_ms: 600000,
			}),
		);
	});

	it('should snooze a reminder successfully in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			snoozePayload: { time: 300000 },
		});
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123/snooze', {
			time: 300000,
		});
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				snooze_time_ms: 300000,
			}),
		);
	});

	it("should return Cliq's standard response when enhanced output is disabled", async () => {
		const context = createContext({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual({ status: 'ok' });
	});

	it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'snooze');

		let thrownError: unknown;
		try {
			await snooze.execute.call(context, items, '');
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

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'snooze',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
	});

	it('should return a recoverable snooze-mode error when continueOnFail is enabled', async () => {
		const context = createContext(
			{ inputMode: 'structured', snoozeInputMode: 123 },
			{ continueOnFail: true },
		);

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'snooze',
				message: 'Snooze Time Mode must be one of: preset, custom',
			}),
		);
	});

	it('should return a recoverable snooze-mode allowlist error in AI Error Mode', async () => {
		const context = createContext(
			{ inputMode: 'structured', snoozeInputMode: 'later' },
			{ enableAiErrorMode: 'true' },
		);

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'snooze',
				message: 'Snooze Time Mode must be one of: preset, custom',
			}),
		);
	});

	it('should return a recoverable invalid-time error in AI Error Mode', async () => {
		const context = createContext(
			{ inputMode: 'raw', snoozePayload: { time: 0 } },
			{ enableAiErrorMode: 'true' },
		);

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'snooze',
				reason: 'INVALID_TIME',
			}),
		);
	});

	it('should return a mapped recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Cannot snooze this mine reminder right now',
		});

		const result = await snooze.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'snooze',
				reminder_id: 'rem_123',
				reason: 'MINE_CATEGORY_ONLY',
				snooze_time_ms: 900000,
			}),
		);
	});

	it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await snooze.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_123');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'snooze',
				reminder_id: 'rem_123',
				reason: 'REMINDER_NOT_FOUND',
				message: 'No reminder found for Reminder ID "rem_123".',
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(snooze.description[snooze.description.length - 2]?.name).toBe(
			'snoozeReminderDocsNotice',
		);
		expect(snooze.description[snooze.description.length - 1]?.name).toBe(
			'snoozeReminderAiToolGuideNotice',
		);
		expect(String(snooze.description[snooze.description.length - 2]?.displayName)).toContain(
			'REQUIRED SCOPES:',
		);
	});
});
