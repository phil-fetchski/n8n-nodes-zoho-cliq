import type { IExecuteFunctions } from 'n8n-workflow';

import {
	DATABASE_RECORD_LOOKUP_NOT_FOUND_ERROR_CODE,
	extractDatabaseRecordDetailsFromLookupResponse,
	lookupDatabaseRecordExhaustively,
	runDatabaseRecordLookupPreflightGate,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../../scopeTestScopes';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight database record lookups', () => {
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

	it('should skip database record lookup preflight when recoverable mode is disabled', async () => {
		await expect(
			runDatabaseRecordLookupPreflightGate(
				createContext(),
				0,
				SCOPES.DATABASE_READ,
				'orders',
				'REC_1',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip database record lookup preflight when the database read scope is unavailable', async () => {
		await expect(
			runDatabaseRecordLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.DATABASE_UPDATE,
				'orders',
				'REC_1',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should fall back to an empty accepted-scope list when the database lookup registry entry is unavailable', async () => {
		jest.resetModules();
		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry', () => ({
			listAcceptedScopesForOperation: jest.fn(() => undefined),
		}));

		let isolatedRunDatabaseRecordLookupPreflightGate!: typeof runDatabaseRecordLookupPreflightGate;
		await jest.isolateModulesAsync(async () => {
			({ runDatabaseRecordLookupPreflightGate: isolatedRunDatabaseRecordLookupPreflightGate } =
				await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/database'));
		});

		await expect(
			isolatedRunDatabaseRecordLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.DATABASE_READ,
				'orders',
				'REC_1',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();

		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry');
		jest.resetModules();
	});

	it('should validate database record lookup preflight when the record exists', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			status: 'SUCCESS',
			object: { id: 'REC_1', status: 'open' },
		});

		await expect(
			runDatabaseRecordLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.DATABASE_READ,
				'orders',
				'REC_1',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: {
				status: 'SUCCESS',
				object: { id: 'REC_1', status: 'open' },
			},
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/storages/orders/records/REC_1',
		);
	});

	it('should return undefined when extracting database record details from a non-object lookup response', () => {
		expect(extractDatabaseRecordDetailsFromLookupResponse(null)).toBeUndefined();
	});

	it('should extract the first database record details object from an object-backed lookup response', () => {
		expect(
			extractDatabaseRecordDetailsFromLookupResponse({
				status: 'SUCCESS',
				object: { id: 'REC_1', status: 'open' },
			}),
		).toEqual({
			id: 'REC_1',
			status: 'open',
		});
	});

	it('should extract the first database record details object from a data-backed lookup response', () => {
		expect(
			extractDatabaseRecordDetailsFromLookupResponse({
				status: 'SUCCESS',
				data: { record_id: 'REC_1', status: 'open' },
			}),
		).toEqual({
			record_id: 'REC_1',
			status: 'open',
		});
	});

	it('should fall back to the root response when canonical record identifiers are present there', () => {
		expect(
			extractDatabaseRecordDetailsFromLookupResponse({
				id: 'REC_1',
				status: 'open',
			}),
		).toEqual({
			id: 'REC_1',
			status: 'open',
		});
	});

	it('should mark a database record lookup as missing when the response identifies a different canonical record ID', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			object: { id: 'REC_actual' },
		});

		await expect(
			lookupDatabaseRecordExhaustively(createContext({ continueOnFail: true }), 0, {
				tableName: 'orders',
				recordId: 'REC_requested',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Record returned a response, but it did not identify "REC_requested" as one of the canonical record identifiers in Database Name "orders".',
		});
	});

	it('should mark a database record lookup as missing when the API returns a non-object response body', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce([] as unknown as Record<string, never>);

		await expect(
			lookupDatabaseRecordExhaustively(createContext({ continueOnFail: true }), 0, {
				tableName: 'orders',
				recordId: 'REC_missing',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Record returned a non-object response for Record ID "REC_missing" in Database Name "orders".',
		});
	});

	it('should treat identifierless object responses as confirmed existing lookup results', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			status: 'SUCCESS',
			meta: { source: 'lookup' },
		});

		await expect(
			lookupDatabaseRecordExhaustively(createContext({ continueOnFail: true }), 0, {
				tableName: 'orders',
				recordId: 'REC_identifierless_root',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
			entity: {
				status: 'SUCCESS',
				meta: { source: 'lookup' },
			},
		});
	});

	it('should treat details objects without canonical identifiers as confirmed existing lookup results', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			object: { status: 'open', owner: 'zuid_1' },
		});

		await expect(
			lookupDatabaseRecordExhaustively(createContext({ continueOnFail: true }), 0, {
				tableName: 'orders',
				recordId: 'REC_identifierless_details',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
			entity: {
				object: { status: 'open', owner: 'zuid_1' },
			},
		});
	});

	it('should normalize authoritative database record lookup misses into DATABASE_RECORD_NOT_FOUND', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Record not found',
		});

		await expect(
			runDatabaseRecordLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.DATABASE_READ,
				'orders',
				'REC_missing',
			),
		).rejects.toMatchObject({
			code: DATABASE_RECORD_LOOKUP_NOT_FOUND_ERROR_CODE,
			message: 'No database record found for Record ID "REC_missing" in Database Name "orders".',
		});
	});

	it('should honor custom database record lookup labels and missing contracts', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Record not found',
		});

		await expect(
			runDatabaseRecordLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.DATABASE_READ,
				'orders',
				'REC_missing',
				{
					fieldLabel: 'Database Record Target',
					missing: {
						code: 'CUSTOM_DATABASE_RECORD_NOT_FOUND',
						message: 'Custom database record lookup failed.',
						hint: 'Use a valid database record target.',
					},
				},
			),
		).rejects.toMatchObject({
			code: 'CUSTOM_DATABASE_RECORD_NOT_FOUND',
			message: 'Custom database record lookup failed.',
		});
	});

	it('should rethrow inconclusive database record lookup failures from the shared preflight lookup', async () => {
		const error = new Error('temporary database lookup issue');
		mockZohoCliqApiRequest.mockRejectedValueOnce(error);

		await expect(
			lookupDatabaseRecordExhaustively(createContext({ continueOnFail: true }), 0, {
				tableName: 'orders',
				recordId: 'REC_500',
			}),
		).rejects.toBe(error);
	});
});
