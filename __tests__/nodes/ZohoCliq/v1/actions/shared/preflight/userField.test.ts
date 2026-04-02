import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	lookupDirectUserFieldExhaustively,
	normalizeUserFieldLookupNotFoundError,
	runUserFieldCreateLimitPreflight,
	runUserFieldLookupPreflightGate,
	USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE,
	USER_FIELD_CUSTOM_LIMIT_REACHED_MESSAGE,
	USER_FIELD_NOT_FOUND_ERROR_CODE,
	USER_FIELD_NOT_FOUND_HINT,
	USER_FIELD_NOT_FOUND_MESSAGE,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../../scopeTestScopes';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight user field lookups', () => {
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

	it('should skip user field preflight when recoverable mode is disabled', async () => {
		await expect(
			runUserFieldLookupPreflightGate(createContext(), 0, SCOPES.USERS_READ, 'UF_123'),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip user field preflight when the additional read scope is unavailable', async () => {
		await expect(
			runUserFieldLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USER_FIELDS_DELETE,
				'UF_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate user field preflight when the field exists', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: { id: 'UF_123', label: 'Employee Code' },
		});

		await expect(
			runUserFieldLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
				'UF_123',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: {
				data: { id: 'UF_123', label: 'Employee Code' },
			},
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/userfields/UF_123');
	});

	it('should treat primitive successful user field lookups as confirmed exists without an entity payload', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce('ok' as unknown as never);

		await expect(
			lookupDirectUserFieldExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'UF_primitive',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
			entity: undefined,
		});
	});

	it('should treat null successful user field lookups as confirmed exists without an entity payload', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce(null as unknown as never);

		await expect(
			lookupDirectUserFieldExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'UF_null',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
			entity: undefined,
		});
	});

	it('should throw a stable USER_FIELD_NOT_FOUND error for authoritative invalid field responses', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			response: {
				status: 400,
				data: {
					message: 'Our processor went cold :feeling-cold:',
				},
			},
		});

		await expect(
			runUserFieldLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
				'9999999999999999999',
			),
		).rejects.toMatchObject({
			code: USER_FIELD_NOT_FOUND_ERROR_CODE,
			message: USER_FIELD_NOT_FOUND_MESSAGE,
		});
	});

	it('should rethrow inconclusive user field lookup failures from the shared preflight lookup', async () => {
		const error = new NodeOperationError(
			createContext().getNode(),
			'temporary user field lookup issue',
			{
				itemIndex: 0,
			},
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce(error);

		await expect(
			runUserFieldLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
				'UF_123',
			),
		).rejects.toBe(error);
	});

	it('should rethrow inconclusive user field lookup failures from the direct lookup helper', async () => {
		const error = new Error('temporary user field lookup issue');
		mockZohoCliqApiRequest.mockRejectedValueOnce(error);

		await expect(
			lookupDirectUserFieldExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'UF_123',
			}),
		).rejects.toBe(error);
	});

	it('should normalize any get-operation lookup failure into a stable user-field-not-found error', () => {
		const normalizedError = normalizeUserFieldLookupNotFoundError(
			createContext(),
			{
				response: {
					status: 500,
					data: {
						message: 'Server error',
					},
				},
			},
			0,
			{ fieldId: 'UF_missing' },
		);

		expect(normalizedError).toBeInstanceOf(NodeOperationError);
		expect(normalizedError).toMatchObject({
			code: USER_FIELD_NOT_FOUND_ERROR_CODE,
			message: USER_FIELD_NOT_FOUND_MESSAGE,
			description: USER_FIELD_NOT_FOUND_HINT,
			statusCode: 500,
			zohoCliqInvalidUserFieldId: 'UF_missing',
		});
	});

	it('should allow normalized user-field lookup errors without a supplied field ID attachment', () => {
		const normalizedError = normalizeUserFieldLookupNotFoundError(
			createContext(),
			new Error('API failed'),
			0,
		);

		expect(normalizedError).toMatchObject({
			code: USER_FIELD_NOT_FOUND_ERROR_CODE,
			message: USER_FIELD_NOT_FOUND_MESSAGE,
			description: USER_FIELD_NOT_FOUND_HINT,
			zohoCliqInvalidUserFieldId: undefined,
		});
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

		let isolatedUserFieldPreflight!: typeof import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/userField');
		await jest.isolateModulesAsync(async () => {
			isolatedUserFieldPreflight =
				await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/userField');
		});

		await expect(
			isolatedUserFieldPreflight.runUserFieldLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
				'UF_123',
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

	it('should skip create-limit preflight when recoverable mode is disabled', async () => {
		await expect(
			runUserFieldCreateLimitPreflight(createContext(), 0, SCOPES.USERS_READ),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should skip create-limit preflight when the additional read scope is unavailable', async () => {
		await expect(
			runUserFieldCreateLimitPreflight(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USER_FIELDS_CREATE,
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw a stable hard-cap error when 10 custom user fields already exist', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			list: Array.from({ length: 10 }, (_, idx) => ({
				id: `UF_${idx}`,
				system_defined: false,
			})),
		});

		await expect(
			runUserFieldCreateLimitPreflight(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
			),
		).rejects.toMatchObject({
			code: USER_FIELD_CUSTOM_LIMIT_REACHED_ERROR_CODE,
			message: USER_FIELD_CUSTOM_LIMIT_REACHED_MESSAGE,
		});
	});

	it('should fall back to scope_unavailable when create-limit activation skips without an explicit reason', async () => {
		jest.resetModules();
		const isolatedTransportCall = jest.fn();

		try {
			jest.doMock(
				'../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/scopePolicy',
				() => ({
					resolvePreflightActivation: jest.fn(() => ({ status: 'skipped' })),
				}),
			);
			jest.doMock('../../../../../../../nodes/ZohoCliq/v1/transport', () => ({
				zohoCliqApiRequest: { call: isolatedTransportCall },
			}));

			let isolatedUserFieldPreflight!: typeof import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/userField');
			await jest.isolateModulesAsync(async () => {
				isolatedUserFieldPreflight =
					await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/userField');
			});

			await expect(
				isolatedUserFieldPreflight.runUserFieldCreateLimitPreflight(
					createContext({ continueOnFail: true }),
					0,
					SCOPES.USERS_READ,
				),
			).resolves.toEqual({
				status: 'skipped',
				reason: 'scope_unavailable',
			});

			expect(isolatedTransportCall).not.toHaveBeenCalled();
		} finally {
			jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/scopePolicy');
			jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/transport');
			jest.resetModules();
		}
	});

	it('should treat primitive create-limit lookup responses as zero custom fields', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce('ok' as unknown as never);

		await expect(
			runUserFieldCreateLimitPreflight(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
			),
		).resolves.toEqual({
			status: 'validated',
			customFieldCount: 0,
		});
	});

	it('should treat object responses without any list-like arrays as zero custom fields', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			url: '/api/v2/userfields',
		});

		await expect(
			runUserFieldCreateLimitPreflight(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
			),
		).resolves.toEqual({
			status: 'validated',
			customFieldCount: 0,
		});
	});

	it('should count only custom fields from alternate list containers during create-limit preflight', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			userfields: [
				{ id: 'UF_1', system_defined: false },
				{ id: 'UF_2', system_defined: true },
				null,
			],
		});

		await expect(
			runUserFieldCreateLimitPreflight(
				createContext({ continueOnFail: true }),
				0,
				SCOPES.USERS_READ,
			),
		).resolves.toEqual({
			status: 'validated',
			customFieldCount: 1,
		});
	});
});
