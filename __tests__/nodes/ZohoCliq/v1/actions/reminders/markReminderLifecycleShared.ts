import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import type * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

interface IRunMarkReminderLifecycleOperationTestsOptions {
	title: string;
	operationModule: {
		description: INodeProperties[];
		execute: (
			this: IExecuteFunctions,
			items: INodeExecutionData[],
			grantedScopes: string,
		) => Promise<INodeExecutionData[]>;
	};
	operationKey: 'markComplete' | 'markIncomplete';
	endpointSuffix: '/complete' | '/incomplete';
	completed: boolean;
	docsNoticeName: string;
	aiGuideNoticeName: string;
	apiErrorMessage: string;
	mockZohoCliqApiRequest: jest.MockedFunction<typeof transport.zohoCliqApiRequest>;
}

export function runMarkReminderLifecycleOperationTests(
	options: IRunMarkReminderLifecycleOperationTestsOptions,
): void {
	const {
		title,
		operationModule,
		operationKey,
		endpointSuffix,
		completed,
		docsNoticeName,
		aiGuideNoticeName,
		apiErrorMessage,
		mockZohoCliqApiRequest,
	} = options;

	describe(title, () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const createContext = (
			values: { reminderId?: string; includeEnhancedOutput?: boolean } = {},
			extraOptions: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
		): IExecuteFunctions => {
			const { reminderId = 'rem_123', includeEnhancedOutput = true } = values;
			const { continueOnFail = false, enableAiErrorMode = false } = extraOptions;

			return {
				getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
					if (name === 'reminderId') return reminderId;
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

		it('should return enhanced output by default for minimal responses', async () => {
			const context = createContext();
			mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

			const result = await operationModule.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'PUT',
				`/api/v2/reminders/rem_123${endpointSuffix}`,
			);
			expect(result[0].json).toEqual({
				data: '',
				success: true,
				resource: 'reminders',
				operation: operationKey,
				reminder_id: 'rem_123',
				completed,
			});
		});

		it("should return Cliq's standard response when enhanced output is disabled", async () => {
			const context = createContext({ includeEnhancedOutput: false });
			mockZohoCliqApiRequest.mockResolvedValue({ status: 'ok' });

			const result = await operationModule.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

			expect(result[0].json).toEqual({ status: 'ok' });
		});

		it('should throw for missing OAuth scope when recoverable mode is disabled', async () => {
			const context = createContext();
			const requiredScope = getRequiredScopeForOperation('reminders', operationKey);

			let thrownError: unknown;
			try {
				await operationModule.execute.call(context, items, '');
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

			const result = await operationModule.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: operationKey,
					reason: 'INVALID_REMINDER_ID',
				}),
			);
		});

		it('should return a mapped recoverable API error in AI Error Mode', async () => {
			const context = createContext({}, { enableAiErrorMode: 'true' });
			mockZohoCliqApiRequest.mockRejectedValue({
				statusCode: 400,
				message: apiErrorMessage,
			});

			const result = await operationModule.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: operationKey,
					reminder_id: 'rem_123',
					reason: 'MINE_CATEGORY_ONLY',
				}),
			);
		});

		it('should return REMINDER_NOT_FOUND when shared preflight proves the reminder is missing', async () => {
			const context = createContext({}, { enableAiErrorMode: 'true' });
			mockZohoCliqApiRequest.mockRejectedValueOnce({
				statusCode: 404,
				message: 'Reminder not found',
			});

			const result = await operationModule.execute.call(
				context,
				items,
				`${SCOPES.REMINDERS_UPDATE},${getRequiredScopeForOperation('reminders', 'get')}`,
			);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem_123');
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: operationKey,
					reminder_id: 'rem_123',
					reason: 'REMINDER_NOT_FOUND',
					message: 'No reminder found for Reminder ID "rem_123".',
				}),
			);
		});

		it('should return a generic BAD_REQUEST payload when reminder read scope is unavailable and the endpoint later fails', async () => {
			const context = createContext({}, { enableAiErrorMode: 'true' });
			mockZohoCliqApiRequest.mockRejectedValueOnce({
				statusCode: 400,
				message:
					"Sorry, we couldn't process your request due to a technical error. Please try again later.",
			});

			const result = await operationModule.execute.call(context, items, SCOPES.REMINDERS_UPDATE);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'PUT',
				`/api/v2/reminders/rem_123${endpointSuffix}`,
			);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: operationKey,
					reminder_id: 'rem_123',
					reason: 'BAD_REQUEST',
					message:
						"Sorry, we couldn't process your request due to a technical error. Please try again later.",
				}),
			);
		});

		it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
			expect(operationModule.description[operationModule.description.length - 2]?.name).toBe(
				docsNoticeName,
			);
			expect(operationModule.description[operationModule.description.length - 1]?.name).toBe(
				aiGuideNoticeName,
			);
			expect(
				String(operationModule.description[operationModule.description.length - 2]?.displayName),
			).toContain('REQUIRED SCOPES:');
		});
	});
}
