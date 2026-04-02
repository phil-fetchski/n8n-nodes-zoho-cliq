import type { IExecuteFunctions } from 'n8n-workflow';

import {
	REMINDER_IDS_LOOKUP_NOT_FOUND_ERROR_CODE,
	REMINDER_LOOKUP_NOT_FOUND_ERROR_CODE,
	lookupReminderExhaustively,
	lookupReminderIdentifiersExhaustively,
	runReminderIdentifiersPreflightGate,
	runReminderLookupPreflightGate,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../../scopeTestScopes';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight reminder lookups', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions =>
		({
			getNodeParameter: jest.fn((name: string) => {
				if (name === 'enableAiErrorMode') {
					return values.enableAiErrorMode ?? false;
				}

				return undefined;
			}),
			continueOnFail: values.continueOnFail ? jest.fn(() => true) : undefined,
			getNode: jest.fn(() => ({
				name: 'Zoho Cliq',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: values.enableAiErrorMode ?? false },
			})),
		}) as unknown as IExecuteFunctions;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should skip reminder lookup preflight when recoverable mode is disabled', async () => {
		await expect(
			runReminderLookupPreflightGate(createContext(), 0, SCOPES.REMINDERS_READ, 'rem_123'),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip reminder lookup preflight when the reminder read scope is unavailable', async () => {
		await expect(
			runReminderLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_DELETE,
				'rem_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate reminder lookup preflight when the reminder exists', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: 'rem:123' });

		await expect(
			runReminderLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_READ,
				'rem:123',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: { id: 'rem:123' },
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/reminders/rem%3A123');
	});

	it('should mark a reminder lookup as missing when the response identifies a different canonical reminder ID', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: 'rem_actual' });

		await expect(
			lookupReminderExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'rem_requested',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Reminder returned a response, but it did not identify "rem_requested" as one of the canonical reminder identifiers.',
		});
	});

	it('should mark a reminder lookup as missing when the reminder object has no canonical identifiers', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ title: 'Identifierless reminder payload' });

		await expect(
			lookupReminderExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'rem_identifierless',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Reminder returned an object for "rem_identifierless", but the reminder did not include any canonical reminder identifiers.',
		});
	});

	it('should normalize generic technical reminder lookup failures into REMINDER_NOT_FOUND', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 400,
			message:
				"Sorry, we couldn't process your request due to a technical error. Please try again later.",
		});

		await expect(
			runReminderLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_READ,
				'rem_404',
			),
		).rejects.toMatchObject({
			code: REMINDER_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: 'No reminder found for Reminder ID "rem_404".',
		});
	});

	it('should honor custom reminder lookup labels and missing contracts', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		await expect(
			runReminderLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_READ,
				'rem_custom',
				{
					fieldLabel: 'Reminder Target',
					missing: {
						code: 'CUSTOM_REMINDER_NOT_FOUND',
						message: 'Custom reminder lookup failed.',
						hint: 'Use a valid reminder target.',
					},
				},
			),
		).rejects.toMatchObject({
			code: 'CUSTOM_REMINDER_NOT_FOUND',
			message: 'Custom reminder lookup failed.',
		});
	});

	it('should rethrow inconclusive reminder lookup failures from the shared preflight lookup', async () => {
		const error = new Error('temporary reminder lookup issue');
		mockZohoCliqApiRequest.mockRejectedValueOnce(error);

		await expect(
			lookupReminderExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'rem_500',
			}),
		).rejects.toBe(error);
	});

	it('should treat empty reminder identifier arrays as already satisfied', async () => {
		await expect(
			lookupReminderIdentifiersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['', ''],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate reminder identifier batches when every supplied reminder resolves', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ id: 'rem_1' })
			.mockResolvedValueOnce({ reminder_id: 'rem_2' });

		await expect(
			lookupReminderIdentifiersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['rem_1', 'rem_2'],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should surface missing reminder IDs through the shared batch reminder lookup gate', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ id: 'rem_1' }).mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		await expect(
			runReminderIdentifiersPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_READ,
				['rem_1', 'rem_missing'],
			),
		).rejects.toMatchObject({
			code: REMINDER_IDS_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: 'One or more reminder IDs were not found. Missing reminder IDs: ["rem_missing"].',
			zohoCliqMissingReminderIds: ['rem_missing'],
		});

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/reminders/rem_1');
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/reminders/rem_missing',
		);
	});

	it('should return early when the shared batch reminder lookup gate receives no usable reminder IDs', async () => {
		await expect(
			runReminderIdentifiersPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_READ,
				[''],
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return early when the shared batch reminder lookup gate receives a non-array input', async () => {
		await expect(
			runReminderIdentifiersPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_READ,
				undefined as unknown as string[],
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should honor custom batch reminder lookup labels and missing contracts', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Reminder not found',
		});

		await expect(
			runReminderIdentifiersPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.REMINDERS_READ,
				['rem_batch_missing'],
				{
					fieldLabel: 'Batch Reminder Targets',
					missing: {
						code: 'CUSTOM_REMINDER_BATCH_NOT_FOUND',
						message: 'Custom batch reminder lookup failed.',
						hint: 'Use only valid reminder batch targets.',
					},
				},
			),
		).rejects.toMatchObject({
			code: 'CUSTOM_REMINDER_BATCH_NOT_FOUND',
			message: 'Custom batch reminder lookup failed.',
		});
	});

	it('should build the default batch reminder missing message from normalized identifiers when missingIdentifiers are unavailable', async () => {
		jest.resetModules();

		let capturedMessage: string | undefined;

		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/gate', () => ({
			runPreflightGate: jest.fn(async (_context, _itemIndex, _grantedScopes, config) => {
				const missing = config.errors.missing;
				capturedMessage =
					typeof missing.message === 'function'
						? missing.message({
								context: createContext({ continueOnFail: true }),
								itemIndex: 0,
								subject: config.subject,
								missing,
								evidence: 'synthetic missing reminder evidence',
								missingIdentifiers: undefined,
							})
						: missing.message;

				return undefined;
			}),
		}));

		let isolatedReminderModule!: typeof import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/reminder');
		await jest.isolateModulesAsync(async () => {
			isolatedReminderModule =
				await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/reminder');
		});

		await isolatedReminderModule.runReminderIdentifiersPreflightGate(
			createContext({ continueOnFail: true }),
			0,
			SCOPES.REMINDERS_READ,
			['rem_a', 'rem_b'],
		);

		expect(capturedMessage).toBe(
			'One or more reminder IDs were not found. Missing reminder IDs: ["rem_a","rem_b"].',
		);

		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/gate');
		jest.resetModules();
	});
});
