import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as list from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/list.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - List Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		additionalFields: Record<string, unknown> = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'additionalFields') return additionalFields;
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

	it('should list reminders successfully with trimmed optional values', async () => {
		const context = createContext({
			category: ' mine ',
			limit: 25,
			nextSetToken: ' next_123 ',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ list: [] });

		await list.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/reminders',
			{},
			{
				category: 'mine',
				limit: 25,
				next_set_token: 'next_123',
			},
		);
	});

	it('should omit blank optional values', async () => {
		const context = createContext({
			category: '   ',
			nextSetToken: '   ',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ list: [] });

		await list.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders', {}, {});
	});

	it('should throw error for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'list');

		let thrownError: unknown;
		try {
			await list.execute.call(context, items, '');
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
		const context = createContext({ category: 'all' }, { continueOnFail: true });

		const result = await list.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'list',
				reason: 'INVALID_CATEGORY',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return INVALID_PAGINATION_TOKEN when next_set_token fails validation', async () => {
		const context = createContext({ nextSetToken: 'x'.repeat(1025) }, { continueOnFail: true });

		const result = await list.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'list',
				next_set_token: 'x'.repeat(1025),
				reason: 'INVALID_PAGINATION_TOKEN',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext({}, { enableAiErrorMode: 'true' });
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 429,
			message: 'Too many requests',
		});

		const result = await list.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'list',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should map generic technical next_set_token failures to actionable pagination guidance', async () => {
		const context = createContext(
			{ nextSetToken: 'opaque_bad_token' },
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		const result = await list.execute.call(context, items, SCOPES.REMINDERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'list',
				next_set_token: 'opaque_bad_token',
				reason: 'INVALID_PAGINATION_TOKEN',
				hint: 'The next_set_token may be expired or malformed. Re-list from the beginning without a token.',
				message:
					'Zoho Cliq could not continue this reminder list request with the supplied next_set_token. The pagination token may be expired, malformed, or no longer valid for this query.',
			}),
		);
		expect(result[0].json).not.toHaveProperty('error');
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(list.description[list.description.length - 2]?.name).toBe('listRemindersDocsNotice');
		expect(list.description[list.description.length - 1]?.name).toBe(
			'listRemindersAiToolGuideNotice',
		);
		expect(String(list.description[list.description.length - 2]?.displayName)).toContain(
			'REQUIRED SCOPES:',
		);
	});
});
