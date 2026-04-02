import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/get.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Get Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: { reminderId?: string } = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { reminderId = 'rem:123' } = values;
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'reminderId') return reminderId;
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

	it('should get reminder successfully and URL-encode the reminder ID', async () => {
		const context = createContext();
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem:123' });

		await get.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem%3A123');
	});

	it('should throw error for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'get');

		let thrownError: unknown;
		try {
			await get.execute.call(context, items, '');
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

		const result = await get.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'get',
				reason: 'INVALID_REMINDER_ID',
			}),
		);
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({ reminderId: 'rem_123' }, { enableAiErrorMode: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Reminder not found',
		});

		const result = await get.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'get',
				reminder_id: 'rem_123',
				reason: 'REMINDER_NOT_FOUND',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should preserve shared reminder preflight misses for generic technical reminder lookup failures', async () => {
		const context = createContext({ reminderId: 'rem_404' }, { enableAiErrorMode: true });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await get.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'get',
				reminder_id: 'rem_404',
				reason: 'REMINDER_NOT_FOUND',
				hint: 'Use List Reminders to discover valid reminder IDs before retrying.',
				message: 'No reminder found for Reminder ID "rem_404".',
			}),
		);
	});

	it('should reuse the shared preflight entity in recoverable mode instead of issuing a second GET', async () => {
		const context = createContext({ reminderId: 'rem_123' }, { continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: 'rem_123', content: 'From preflight' });

		const result = await get.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual({ id: 'rem_123', content: 'From preflight' });
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_123');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(get.description[get.description.length - 2]?.name).toBe('getReminderDocsNotice');
		expect(get.description[get.description.length - 1]?.name).toBe('getReminderAiToolGuideNotice');
		expect(String(get.description[get.description.length - 2]?.displayName)).toContain(
			'REQUIRED SCOPES:',
		);
	});
});
