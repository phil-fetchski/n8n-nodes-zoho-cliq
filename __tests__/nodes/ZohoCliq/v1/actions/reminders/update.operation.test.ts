import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as update from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/update.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Update Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: Record<string, unknown> = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name in values) return values[name];
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

	it('should update a reminder successfully in structured mode and URL-encode the reminder ID', async () => {
		const context = createContext({
			reminderId: 'rem:123',
			inputMode: 'structured',
			content: 'Updated content',
			time: 1767225600000,
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem:123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem%3A123', {
			content: 'Updated content',
			time: '1767225600000',
		});
	});

	it('should update reminder time only with a single structured time field', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'structured',
			time: '2026-03-01T10:00:00Z',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			time: '1772359200000',
		});
	});

	it('should accept ISO 8601 time strings with timezone offsets in structured update mode', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'structured',
			time: '2026-03-19T09:30:00-04:00',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			time: '1773927000000',
		});
	});

	it('should omit time when updating content only in structured mode', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'structured',
			content: 'Updated content only',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			content: 'Updated content only',
		});
	});

	it('should omit content when updating time only in structured mode', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'structured',
			content: '   ',
			time: '2026-03-01T10:00:00Z',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			time: '1772359200000',
		});
	});

	it('should omit undefined content when updating time only in structured mode', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'structured',
			content: undefined,
			time: '2026-03-01T10:00:00Z',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			time: '1772359200000',
		});
	});

	it('should omit time in raw mode when only content is provided', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'raw',
			reminderUpdates: '{"content":"Updated content"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			content: 'Updated content',
		});
	});

	it('should omit blank time in raw update mode', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'raw',
			reminderUpdates: { content: 'Updated content', time: '   ' },
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			content: 'Updated content',
		});
	});

	it('should update a reminder successfully in raw mode with both content and time', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'raw',
			reminderUpdates: '{"content":"Updated content","time":"2026-03-01T10:00:00Z"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			content: 'Updated content',
			time: '1772359200000',
		});
	});

	it('should accept an ISO 8601 time string in raw update mode', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'raw',
			reminderUpdates: '{"time":"2026-03-01T10:00:00Z"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			time: '1772359200000',
		});
	});

	it('should accept a Unix-millisecond time value in raw update mode', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'raw',
			reminderUpdates: '{"time":1772359200000}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/reminders/rem_123', {
			time: '1772359200000',
		});
	});

	it('should throw error for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'update');

		let thrownError: unknown;
		try {
			await update.execute.call(context, items, '');
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
		const context = createContext(
			{
				reminderId: 'rem_123',
				inputMode: 'structured',
				content: '   ',
				time: '',
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'update',
				reminder_id: 'rem_123',
				reason: 'EMPTY_UPDATE',
			}),
		);
	});

	it('should return a recoverable invalid reminder ID error when continueOnFail is enabled', async () => {
		const context = createContext(
			{
				reminderId: 'bad/id',
				inputMode: 'structured',
				content: 'Updated content',
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'update',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
	});

	it('should throw when both structured update inputs are blank', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'structured',
			content: '   ',
			time: '',
		});

		await expect(update.execute.call(context, items, SCOPES.REMINDERS_UPDATE)).rejects.toThrow(
			'Provide content, time, or both.',
		);
	});

	it('should return a recoverable empty-update error when continueOnFail is enabled', async () => {
		const context = createContext(
			{
				reminderId: 'rem_123',
				inputMode: 'raw',
				reminderUpdates: {},
			},
			{ continueOnFail: true },
		);

		const result = await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'update',
				reminder_id: 'rem_123',
				reason: 'EMPTY_UPDATE',
			}),
		);
	});

	it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
		const context = createContext(
			{
				reminderId: 'rem_404',
				inputMode: 'structured',
				content: 'Updated content',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await update.execute.call(
			context,
			items,
			`${SCOPES.REMINDERS_UPDATE},${SCOPES.REMINDERS_READ}`,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'update',
				reminder_id: 'rem_404',
				reason: 'REMINDER_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should fall back to generic BAD_REQUEST when update preflight is skipped', async () => {
		const context = createContext(
			{
				reminderId: 'rem_404',
				inputMode: 'structured',
				content: 'Updated content',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await update.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'update',
				reminder_id: 'rem_404',
				status_code: 400,
				reason: 'BAD_REQUEST',
				hint: 'Check required parameters, field formats, and request constraints.',
			}),
		);
	});

	it('should throw when reminder updates omit both content and time after validation', async () => {
		const context = createContext({
			reminderId: 'rem_123',
			inputMode: 'raw',
			reminderUpdates: { content: undefined, time: undefined },
		});

		await expect(update.execute.call(context, items, SCOPES.REMINDERS_UPDATE)).rejects.toThrow(
			'Provide content, time, or both.',
		);
	});

	it('should expose always-visible structured content and time fields with no update selector', () => {
		expect(update.description.find((property) => property.name === 'updateFields')).toBeUndefined();
		expect(
			update.description.find((property) => property.name === 'timeInputMode'),
		).toBeUndefined();
		expect(update.description.find((property) => property.name === 'timeDateTime')).toBeUndefined();
		expect(update.description.find((property) => property.name === 'timeUnix')).toBeUndefined();
		expect(
			update.description.find((property) => property.name === 'content')?.displayOptions?.show,
		).toEqual(
			expect.objectContaining({
				inputMode: ['structured'],
			}),
		);
		expect(
			update.description.find((property) => property.name === 'time')?.displayOptions?.show,
		).toEqual(
			expect.objectContaining({
				inputMode: ['structured'],
			}),
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(update.description[update.description.length - 2]?.name).toBe(
			'updateReminderDocsNotice',
		);
		expect(update.description[update.description.length - 1]?.name).toBe(
			'updateReminderAiToolGuideNotice',
		);
		expect(String(update.description[update.description.length - 2]?.displayName)).toContain(
			'REQUIRED SCOPES:',
		);
	});
});
