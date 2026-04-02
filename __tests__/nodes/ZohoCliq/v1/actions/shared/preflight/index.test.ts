import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE,
	directUserLookupScopes,
	extractCanonicalUserIdentifiers,
	lookupDirectUserExhaustively,
	mapDirectMessageUserNotFoundErrorIfPossible,
	lookupUsersExhaustively,
	runDirectUserLookupPreflightGate,
	runPreflightGate,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import { isAuthoritativeNotFoundError } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/direct';
import { buildPreflightMissingError } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/errors';
import { resolvePreflightActivation } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/scopePolicy';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight', () => {
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

	it('should skip the preflight gate when recoverable mode is disabled', async () => {
		const strategy = jest.fn(async () => ({ status: 'confirmed_exists' as const }));

		await expect(
			runPreflightGate(createContext(), 0, 'ZohoCliq.Users.READ', {
				subject: {
					resource: 'user',
					identifier: '123',
					label: 'Test User',
				},
				shouldRun: {
					requiresRecoverableMode: true,
					acceptedScopes: ['ZohoCliq.Users.READ'],
				},
				strategy,
				errors: {
					missing: {
						code: 'USER_NOT_FOUND',
						message: 'Missing user.',
						hint: 'Retry with a valid user.',
					},
				},
			}),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});

		expect(strategy).not.toHaveBeenCalled();
	});

	it('should skip the preflight gate when accepted scopes are unavailable', async () => {
		const strategy = jest.fn(async () => ({ status: 'confirmed_exists' as const }));

		await expect(
			runPreflightGate(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Webhooks.CREATE', {
				subject: {
					resource: 'user',
					identifier: '123',
					label: 'Test User',
				},
				shouldRun: {
					requiresRecoverableMode: true,
					acceptedScopes: ['ZohoCliq.Users.READ'],
				},
				strategy,
				errors: {
					missing: {
						code: 'USER_NOT_FOUND',
						message: 'Missing user.',
						hint: 'Retry with a valid user.',
					},
				},
			}),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(strategy).not.toHaveBeenCalled();
	});

	it('should default skipped preflight reasons to scope_unavailable when activation omits a reason', async () => {
		jest.resetModules();
		jest.doMock(
			'../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/scopePolicy',
			() => ({
				resolvePreflightActivation: jest.fn(() => ({ status: 'skipped' })),
			}),
		);

		let isolatedRunPreflightGate!: typeof runPreflightGate;
		await jest.isolateModulesAsync(async () => {
			({ runPreflightGate: isolatedRunPreflightGate } =
				await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/gate'));
		});

		await expect(
			isolatedRunPreflightGate(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Users.READ', {
				subject: {
					resource: 'user',
					identifier: '123',
					label: 'Test User',
				},
				shouldRun: {
					requiresRecoverableMode: true,
					acceptedScopes: ['ZohoCliq.Users.READ'],
				},
				strategy: async () => ({ status: 'confirmed_exists' as const }),
				errors: {
					missing: {
						code: 'USER_NOT_FOUND',
						message: 'Missing user.',
						hint: 'Retry with a valid user.',
					},
				},
			}),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/scopePolicy');
		jest.resetModules();
	});

	it('should return validated when the shared gate confirms existence', async () => {
		await expect(
			runPreflightGate(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Users.READ', {
				subject: {
					resource: 'user',
					identifier: '123',
					label: 'Test User',
				},
				shouldRun: {
					requiresRecoverableMode: true,
					acceptedScopes: ['ZohoCliq.Users.READ'],
				},
				strategy: async () => ({
					status: 'confirmed_exists',
					entity: { id: '123' },
				}),
				errors: {
					missing: {
						code: 'USER_NOT_FOUND',
						message: 'Missing user.',
						hint: 'Retry with a valid user.',
					},
				},
			}),
		).resolves.toEqual({
			status: 'validated',
			entity: { id: '123' },
		});
	});

	it('should throw a stable missing error when the shared gate confirms a missing entity', async () => {
		let thrownError: unknown;

		try {
			await runPreflightGate(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Users.READ', {
				subject: {
					resource: 'user',
					identifier: 'missing@example.com',
					label: 'Direct Message Recipient',
				},
				shouldRun: {
					requiresRecoverableMode: true,
					acceptedScopes: ['ZohoCliq.Users.READ'],
				},
				strategy: async () => ({
					status: 'confirmed_missing',
					evidence: 'The requested identifier was not present in the roster scan.',
				}),
				errors: {
					missing: {
						code: 'USER_NOT_FOUND',
						message: 'No Zoho Cliq user found.',
						hint: 'Use Get User or List Users before retrying.',
					},
				},
			});
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(thrownError).toMatchObject({
			code: 'USER_NOT_FOUND',
			message: 'No Zoho Cliq user found.',
			zohoCliqPreflight: {
				blocked_main_request: true,
				resource: 'user',
				identifier: 'missing@example.com',
				label: 'Direct Message Recipient',
				code: 'USER_NOT_FOUND',
			},
		});
	});

	it('should resolve dynamic missing error content from the actual unresolved identifiers', async () => {
		let thrownError: unknown;

		try {
			await runPreflightGate(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Users.READ', {
				subject: {
					resource: 'user',
					identifier: 'user_1,missing_user',
					label: 'Role User IDs',
				},
				shouldRun: {
					requiresRecoverableMode: true,
					acceptedScopes: ['ZohoCliq.Users.READ'],
				},
				strategy: async () => ({
					status: 'confirmed_missing',
					evidence: 'Missing user identifiers remained after an exhaustive scan.',
					missingIdentifiers: ['missing_user'],
				}),
				errors: {
					missing: {
						code: 'USER_IDS_NOT_FOUND',
						message: ({ missingIdentifiers }) =>
							`Missing user IDs: ${JSON.stringify(missingIdentifiers)}.`,
						hint: ({ missingIdentifiers }) =>
							`Retry after verifying ${missingIdentifiers?.length ?? 0} unresolved user IDs.`,
					},
				},
			});
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toMatchObject({
			code: 'USER_IDS_NOT_FOUND',
			message: 'Missing user IDs: ["missing_user"].',
			zohoCliqPreflight: expect.objectContaining({
				message: 'Missing user IDs: ["missing_user"].',
				hint: 'Retry after verifying 1 unresolved user IDs.',
			}),
		});
	});

	it('should attach custom missing identifier metadata when the preflight config requests it', async () => {
		let thrownError: unknown;

		try {
			await runPreflightGate(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Teams.READ', {
				subject: {
					resource: 'team_membership',
					identifier: 'team_123:user_1,user_2',
					label: 'Team Member User IDs',
				},
				shouldRun: {
					requiresRecoverableMode: true,
					acceptedScopes: ['ZohoCliq.Teams.READ'],
				},
				strategy: async () => ({
					status: 'confirmed_missing',
					evidence: 'One or more requested users are not current team members.',
					missingIdentifiers: ['user_2'],
				}),
				errors: {
					missing: {
						code: 'USER_IDS_NOT_TEAM_MEMBERS',
						message: 'Some users are not team members.',
						hint: 'Retry with only current team members.',
						attachmentKey: 'zohoCliqNonMemberUserIds',
					},
				},
			});
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toMatchObject({
			code: 'USER_IDS_NOT_TEAM_MEMBERS',
			zohoCliqNonMemberUserIds: ['user_2'],
		});
	});

	it('should attach custom missing identifier metadata in direct preflight missing errors', () => {
		const error = buildPreflightMissingError({
			context: createContext({ continueOnFail: true }),
			itemIndex: 0,
			subject: {
				resource: 'team_membership',
				identifier: 'team_123:user_1,user_2',
				label: 'Team Member User IDs',
			},
			evidence: 'One or more requested users are not current team members.',
			missingIdentifiers: ['user_2'],
			missing: {
				code: 'USER_IDS_NOT_TEAM_MEMBERS',
				message: 'Some users are not team members.',
				hint: 'Retry with only current team members.',
				attachmentKey: 'zohoCliqNonMemberUserIds',
			},
		});

		expect(error).toMatchObject({
			code: 'USER_IDS_NOT_TEAM_MEMBERS',
			zohoCliqNonMemberUserIds: ['user_2'],
		});
		expect(
			(error as NodeOperationError & { zohoCliqMissingUserIds?: string[] }).zohoCliqMissingUserIds,
		).toBeUndefined();
	});

	it('should not attach custom missing identifier metadata when no identifiers were supplied', () => {
		const error = buildPreflightMissingError({
			context: createContext({ continueOnFail: true }),
			itemIndex: 0,
			subject: {
				resource: 'team_membership',
				identifier: 'team_123:user_1,user_2',
				label: 'Team Member User IDs',
			},
			evidence: 'One or more requested users are not current team members.',
			missing: {
				code: 'USER_IDS_NOT_TEAM_MEMBERS',
				message: 'Some users are not team members.',
				hint: 'Retry with only current team members.',
				attachmentKey: 'zohoCliqNonMemberUserIds',
			},
		});

		expect(
			(error as NodeOperationError & { zohoCliqNonMemberUserIds?: string[] })
				.zohoCliqNonMemberUserIds,
		).toBeUndefined();
		expect(
			(error as NodeOperationError & { zohoCliqMissingUserIds?: string[] }).zohoCliqMissingUserIds,
		).toBeUndefined();
	});

	it('should deduplicate canonical user identifiers', () => {
		expect(
			extractCanonicalUserIdentifiers({
				user_id: '123',
				id: '123',
				zuid: '123',
				email_id: 'person@example.com',
				email: 'person@example.com',
			}),
		).toEqual(['123', 'person@example.com']);
	});

	it('should compare canonical email identifiers case-insensitively', () => {
		expect(
			extractCanonicalUserIdentifiers({
				email_id: 'Person@Example.com',
				email: 'PERSON@example.com',
			}),
		).toEqual(['person@example.com']);
	});

	it('should skip recoverable-mode activation when enableAiErrorMode lookup throws and getNode is unavailable', () => {
		const context = {
			getNodeParameter: jest.fn(() => {
				throw new Error('hidden');
			}),
		} as unknown as IExecuteFunctions;

		expect(
			resolvePreflightActivation(context, 0, 'ZohoCliq.Users.READ', {
				requiresRecoverableMode: true,
				acceptedScopes: ['ZohoCliq.Users.READ'],
			}),
		).toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});
	});

	it('should skip recoverable-mode activation when getNode throws during AI mode fallback', () => {
		const context = {
			getNodeParameter: jest.fn(() => {
				throw new Error('hidden');
			}),
			getNode: jest.fn(() => {
				throw new Error('node unavailable');
			}),
		} as unknown as IExecuteFunctions;

		expect(
			resolvePreflightActivation(context, 0, 'ZohoCliq.Users.READ', {
				requiresRecoverableMode: true,
				acceptedScopes: ['ZohoCliq.Users.READ'],
			}),
		).toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});
	});

	it('should skip recoverable-mode activation when getNode returns null during AI mode fallback', () => {
		const context = {
			getNodeParameter: jest.fn(() => {
				throw new Error('hidden');
			}),
			getNode: jest.fn(() => null),
		} as unknown as IExecuteFunctions;

		expect(
			resolvePreflightActivation(context, 0, 'ZohoCliq.Users.READ', {
				requiresRecoverableMode: true,
				acceptedScopes: ['ZohoCliq.Users.READ'],
			}),
		).toEqual({
			status: 'skipped',
			reason: 'recoverable_mode_disabled',
		});
	});

	it('should treat top-level httpCode 400 values as authoritative not-found errors', () => {
		expect(
			isAuthoritativeNotFoundError({ message: 'Lookup failed', httpCode: 400 }, [
				'request url is invalid',
			]),
		).toBe(true);
	});

	it('should resolve empty user preflight identifier sets without calling the API', async () => {
		await expect(
			lookupUsersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: [],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should resolve users exhaustively across multiple pages', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				users: [{ user_id: '123' }],
				next_token: 'page_2',
			})
			.mockResolvedValueOnce({
				data: {
					users: [{ email_id: 'person@example.com' }],
					has_more: false,
				},
			});

		await expect(
			lookupUsersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['123', 'person@example.com'],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/users',
			{},
			{
				limit: 100,
				fields: 'display_name',
			},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/users',
			{},
			{
				limit: 100,
				fields: 'display_name',
				next_token: 'page_2',
			},
		);
	});

	it('should run an inactive-user second pass only when enabled and needed', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				users: [{ user_id: '123' }],
				has_more: false,
			})
			.mockResolvedValueOnce({
				users: [{ email_id: 'inactive@example.com' }],
				has_more: false,
			});

		await expect(
			lookupUsersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['123', 'inactive@example.com'],
				includeInactiveUsers: true,
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});

		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/users',
			{},
			{
				limit: 100,
				fields: 'display_name',
				status: 'inactive',
			},
		);
	});

	it('should skip the inactive-user second pass when the active scan already resolves everything', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [{ user_id: '123' }, { email_id: 'person@example.com' }],
			has_more: false,
		});

		await expect(
			lookupUsersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['123', 'person@example.com'],
				includeInactiveUsers: true,
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
	});

	it('should wrap inactive-roster lookup failures when the inactive pass is enabled and needed', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				users: [{ user_id: '123' }],
				has_more: false,
			})
			.mockRejectedValueOnce(new Error('inactive lookup failed'));

		await expect(
			lookupUsersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['123', 'inactive@example.com'],
				includeInactiveUsers: true,
			}),
		).rejects.toThrow(
			'The inactive user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
		);
	});

	it('should throw when pagination repeats the same next_token before resolution', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				users: [{ user_id: '123' }],
				next_token: 'repeat_page',
			})
			.mockResolvedValueOnce({
				users: [{ user_id: '123' }],
				next_token: 'repeat_page',
			});

		await expect(
			lookupUsersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['missing-user'],
			}),
		).rejects.toThrow('repeated next_token "repeat_page"');
	});

	it('should throw when a full page has no pagination metadata', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: Array.from({ length: 100 }, (_, index) => ({ user_id: `${index}` })),
		});

		await expect(
			lookupUsersExhaustively(createContext({ continueOnFail: true }), 0, {
				identifiers: ['missing-user'],
			}),
		).rejects.toThrow(
			'could not confirm exhaustive pagination because Zoho Cliq returned a full page without next_token or has_more=false',
		);
	});

	it('should return confirmed_missing when a direct lookup succeeds but does not identify the requested user', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: '123',
			display_name: 'Someone Else',
		});

		await expect(
			lookupDirectUserExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'person@example.com',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get User returned a response, but it did not identify "person@example.com" as one of the canonical user identifiers.',
		});
	});

	it('should resolve direct email lookups case-insensitively', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: '123',
			email_id: 'alerts+ops@example.com',
			display_name: 'Alerts Ops',
		});

		await expect(
			lookupDirectUserExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'Alerts+Ops@Example.com',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
			entity: {
				id: '123',
				email_id: 'alerts+ops@example.com',
				display_name: 'Alerts Ops',
			},
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users/alerts%2Bops%40example.com',
			{},
		);
	});

	it('should throw when a direct lookup returns a non-object payload', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce('not-an-object' as unknown as IDataObject);

		await expect(
			lookupDirectUserExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'person@example.com',
			}),
		).rejects.toThrow('The Get User preflight did not return an object response.');
	});

	it('should map authoritative direct-user not-found responses to confirmed_missing', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		await expect(
			lookupDirectUserExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'missing@example.com',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence: 'Get User returned an authoritative not-found response for "missing@example.com".',
		});
	});

	it('should return confirmed_missing when a nested data object lacks canonical user identifiers', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				display_name: 'Person Example',
			},
		});

		await expect(
			lookupDirectUserExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'person@example.com',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get User returned a response, but it did not identify "person@example.com" as one of the canonical user identifiers.',
		});
	});

	it('should return confirmed_missing when a top-level object lacks canonical user identifiers and has no nested data object', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			display_name: 'Person Example',
		});

		await expect(
			lookupDirectUserExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'person@example.com',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get User returned a response, but it did not identify "person@example.com" as one of the canonical user identifiers.',
		});
	});

	it('should validate direct-user preflight targets in recoverable mode', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: '123',
			email_id: 'person@example.com',
		});

		await expect(
			runDirectUserLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Users.READ',
				'person@example.com',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: {
				id: '123',
				email_id: 'person@example.com',
			},
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users/person%40example.com',
			{},
		);
		expect(directUserLookupScopes).toContain('ZohoCliq.Users.READ');
	});

	it('should validate direct-user preflight targets when the user record is nested under data', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				id: '123',
				email_id: 'person@example.com',
			},
		});

		await expect(
			runDirectUserLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Users.READ',
				'person@example.com',
			),
		).resolves.toEqual({
			status: 'validated',
			entity: {
				id: '123',
				email_id: 'person@example.com',
			},
		});

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users/person%40example.com',
			{},
		);
	});

	it('should honor accepted-scope and missing-config overrides in the shared direct-user preflight gate', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		await expect(
			runDirectUserLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Users.ALL',
				'missing@example.com',
				{
					subjectLabel: 'Reporting To User',
					acceptedScopes: ['ZohoCliq.Users.ALL'],
					missing: {
						code: 'REPORTING_TO_USER_NOT_FOUND',
						message: 'Reporting user could not be found.',
						hint: 'Use List Users to verify the reporting user before retrying.',
					},
				},
			),
		).rejects.toMatchObject({
			code: 'REPORTING_TO_USER_NOT_FOUND',
			zohoCliqPreflight: expect.objectContaining({
				label: 'Reporting To User',
				code: 'REPORTING_TO_USER_NOT_FOUND',
				message: 'Reporting user could not be found.',
			}),
		});
	});

	it('should throw USER_NOT_FOUND from the shared direct-user preflight gate when the user is missing', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		await expect(
			runDirectUserLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Users.READ',
				'missing@example.com',
			),
		).rejects.toMatchObject({
			code: 'USER_NOT_FOUND',
			zohoCliqPreflight: expect.objectContaining({
				code: 'USER_NOT_FOUND',
				blocked_main_request: true,
			}),
		});
	});

	it('should leave direct-message errors unchanged when the target is not a user or the identifier is missing', () => {
		const context = createContext({ continueOnFail: true });
		const originalError = { message: 'Request URL is invalid' };

		expect(
			mapDirectMessageUserNotFoundErrorIfPossible(context, originalError, 0, 'chat', 'CT_123'),
		).toBe(originalError);
		expect(
			mapDirectMessageUserNotFoundErrorIfPossible(context, originalError, 0, 'user', undefined),
		).toBe(originalError);
	});

	it('should leave neutral direct-message errors unchanged when no user-not-found evidence is present', () => {
		const context = createContext({ continueOnFail: true });
		const originalError = { message: 'Rate limit exceeded', response: { statusCode: 429 } };

		expect(
			mapDirectMessageUserNotFoundErrorIfPossible(
				context,
				originalError,
				0,
				'user',
				'missing@example.com',
			),
		).toBe(originalError);
	});

	it('should convert direct-message user-not-found responses into the shared guided error contract', () => {
		const context = createContext({ continueOnFail: true });

		const mappedError = mapDirectMessageUserNotFoundErrorIfPossible(
			context,
			{ message: 'No user found', response: { statusCode: 400 } },
			2,
			'user',
			'missing@example.com',
		);

		expect(mappedError).toBeInstanceOf(NodeOperationError);
		expect(mappedError).toMatchObject({
			code: DIRECT_MESSAGE_RECIPIENT_NOT_FOUND_ERROR_CODE,
			message:
				'No Zoho Cliq user found for Email ID / ZUID "missing@example.com". Verify the recipient exists before posting a direct message.',
			description:
				'Zoho Cliq rejected the direct-message target. Verify the recipient email ID or ZUID exists and is accessible to the authenticated account.',
		});
	});

	it('should ignore blank direct-lookup message fragments', () => {
		expect(isAuthoritativeNotFoundError({ message: 'Request URL is invalid' }, ['   ', ''])).toBe(
			false,
		);
	});
});
