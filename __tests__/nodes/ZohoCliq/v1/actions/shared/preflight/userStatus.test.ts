import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	invalidateUserStatusCatalogCache,
	lookupUserStatusExhaustively,
	runUserStatusLookupPreflightGate,
	USER_STATUS_NOT_FOUND_ERROR_CODE,
	USER_STATUS_NOT_FOUND_MESSAGE,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../../scopeTestScopes';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight user status lookups', () => {
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

	it('should skip the user-status preflight when recoverable mode is disabled', async () => {
		await expect(
			runUserStatusLookupPreflightGate(createContext(), 0, SCOPES.PROFILE_READ, 'STS_123'),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip the user-status preflight when the additional read scope is unavailable', async () => {
		await expect(
			runUserStatusLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.PROFILE_UPDATE,
				'STS_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate the user-status preflight when the status exists in the saved statuses list', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ id: 'STS_123', message: 'In a meeting' }],
		});

		await expect(
			runUserStatusLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.PROFILE_READ,
				'STS_123',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: { id: 'STS_123', message: 'In a meeting' },
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/statuses');
	});

	it('should validate the user-status preflight when statuses are nested under data.list', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				list: [{ status_id: 'STS_nested', message: 'Heads down' }],
			},
		});

		await expect(
			runUserStatusLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.PROFILE_READ,
				'STS_nested',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: { status_id: 'STS_nested', message: 'Heads down' },
		});
	});

	it('should trim the requested identifier before matching shared user-status entries', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			statuses: [{ id: 'STS_trimmed', message: 'Heads down' }],
		});

		await expect(
			runUserStatusLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.PROFILE_READ,
				'  STS_trimmed  ',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: { id: 'STS_trimmed', message: 'Heads down' },
		});
	});

	it('should use the fallback identifier normalizer path when the requested identifier is blank whitespace', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			statuses: [{ id: 'STS_001', message: 'Available' }],
		});

		await expect(
			lookupUserStatusExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: '   ' as string,
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Retrieve All Statuses did not return status_id "   " after exhaustively scanning the authenticated user\'s saved reusable statuses.',
		});
	});

	it('should continue to later candidate arrays when an earlier array has no usable status objects', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [null, '', 0],
			statuses: [{ id: 'STS_fallback', message: 'Available' }],
		});

		await expect(
			runUserStatusLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.PROFILE_READ,
				'STS_fallback',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: { id: 'STS_fallback', message: 'Available' },
		});
	});

	it('should treat an empty saved-status array as a valid empty scanned catalog', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			statuses: [],
		});

		await expect(
			lookupUserStatusExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'STS_missing',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Retrieve All Statuses did not return status_id "STS_missing" after exhaustively scanning the authenticated user\'s saved reusable statuses.',
		});
	});

	it('should throw a stable STATUS_NOT_FOUND error when the saved statuses list does not contain the requested status', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			statuses: [{ id: 'STS_001', message: 'Available' }],
		});

		await expect(
			runUserStatusLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.PROFILE_READ,
				'STS_missing',
			),
		).rejects.toMatchObject({
			code: USER_STATUS_NOT_FOUND_ERROR_CODE,
			message: USER_STATUS_NOT_FOUND_MESSAGE,
			zohoCliqPreflight: {
				blocked_main_request: true,
				resource: 'userStatus',
				identifier: 'STS_missing',
			},
		});
	});

	it('should throw when the saved statuses list response cannot be verified', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({ ok: true });

		await expect(
			lookupUserStatusExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'STS_123',
			}),
		).rejects.toThrow(
			'The user status preflight did not return a statuses collection that could be verified.',
		);
	});

	it('should treat primitive saved-status list responses as unverifiable during the shared preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce(null as unknown as never);

		await expect(
			lookupUserStatusExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'STS_123',
			}),
		).rejects.toThrow(
			'The user status preflight did not return a statuses collection that could be verified.',
		);
	});

	it('should fall back to an empty accepted-scope list when shared scope-registry entries are unavailable at import time', async () => {
		jest.resetModules();
		const isolatedTransportCall = jest.fn();

		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry', () => ({
			listAcceptedScopesForOperation: jest.fn(() => undefined),
		}));
		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/transport', () => ({
			zohoCliqApiRequest: { call: isolatedTransportCall },
		}));

		let isolatedUserStatusPreflight!: typeof import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/userStatus');
		await jest.isolateModulesAsync(async () => {
			isolatedUserStatusPreflight =
				await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/userStatus');
		});

		await expect(
			isolatedUserStatusPreflight.runUserStatusLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.PROFILE_READ,
				'STS_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(isolatedTransportCall).not.toHaveBeenCalled();
		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry');
		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/transport');
		jest.resetModules();
	});

	it('should wrap saved-status list request failures in a NodeOperationError for the shared preflight', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('temporary outage'));

		await expect(
			lookupUserStatusExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'STS_123',
			}),
		).rejects.toBeInstanceOf(NodeOperationError);
	});

	it('should rethrow NodeOperationError failures from the saved-status shared preflight lookup', async () => {
		const error = new NodeOperationError(createContext().getNode(), 'temporary lookup failure', {
			itemIndex: 0,
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce(error);

		await expect(
			lookupUserStatusExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'STS_123',
			}),
		).rejects.toBe(error);
	});

	it('should reuse the cached saved-status catalog across multiple shared preflight lookups in the same context', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			statuses: [
				{ id: 'STS_001', message: 'Available' },
				{ id: 'STS_002', message: 'Busy' },
			],
		});

		await runUserStatusLookupPreflightGate(context, 0, SCOPES.PROFILE_READ, 'STS_001');
		await runUserStatusLookupPreflightGate(context, 1, SCOPES.PROFILE_READ, 'STS_002');

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/statuses');
	});

	it('should evict the cached saved-status catalog when the shared lookup request rejects', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest
			.mockRejectedValueOnce(new Error('temporary outage'))
			.mockResolvedValueOnce({
				statuses: [{ id: 'STS_recovered', message: 'Recovered' }],
			});

		await expect(
			lookupUserStatusExhaustively(context, 0, {
				identifier: 'STS_missing',
			}),
		).rejects.toBeInstanceOf(NodeOperationError);

		await expect(
			runUserStatusLookupPreflightGate(context, 1, SCOPES.PROFILE_READ, 'STS_recovered'),
		).resolves.toEqual({
			status: 'validated',
			entity: { id: 'STS_recovered', message: 'Recovered' },
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});

	it('should allow manual invalidation of the cached saved-status catalog', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				statuses: [{ id: 'STS_001', message: 'Available' }],
			})
			.mockResolvedValueOnce({
				statuses: [{ id: 'STS_002', message: 'Busy' }],
			});

		await runUserStatusLookupPreflightGate(context, 0, SCOPES.PROFILE_READ, 'STS_001');
		invalidateUserStatusCatalogCache(context);
		await runUserStatusLookupPreflightGate(context, 1, SCOPES.PROFILE_READ, 'STS_002');

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
	});
});
