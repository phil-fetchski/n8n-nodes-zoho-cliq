import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	lookupChatExhaustively,
	lookupDepartmentExhaustively,
	lookupDesignationExhaustively,
	lookupDirectTeamExhaustively,
	lookupAssignableReminderTypeExhaustively,
	lookupReminderLastAssigneeRemovalExhaustively,
	lookupTeamMembershipExhaustively,
	lookupRoleExhaustively,
	lookupThreadExhaustively,
	normalizeTeamLookupNotFoundError,
	runChatLookupPreflightGate,
	runThreadLookupPreflightGate,
	runDepartmentEmailsPreflightGate,
	runDepartmentLookupPreflightGate,
	runDepartmentMemberIdentifiersPreflightGate,
	runDepartmentUsersPreflightGate,
	runDesignationUsersPreflightGate,
	runReminderAssignableTypePreflightGate,
	runReminderLastAssigneeRemovalPreflightGate,
	runRoleLookupPreflightGate,
	runRoleUsersPreflightGate,
	runTeamMembershipPreflightGate,
	runUserIdentifiersPreflightGate,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Shared Preflight domain lookups', () => {
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

	it('should resolve chat lookups when Get Chat Members returns a top-level data payload', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ user_id: '123' }],
		});

		await expect(
			lookupChatExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'CT_123_456',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should resolve chat lookups when Get Chat Members returns a members array', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			members: [{ user_id: '123' }],
		});

		await expect(
			lookupChatExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'CT_members_123',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should resolve chat lookups when Get Chat Members returns an empty object', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {},
		});

		await expect(
			lookupChatExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'CT_nested_123',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should resolve chat lookups when Get Chat Members returns a primitive successful payload', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce('ok' as unknown as IDataObject);

		await expect(
			lookupChatExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'CT_primitive_ok',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should treat 400 chat-member lookup failures as confirmed missing results', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 400 },
		});

		await expect(
			lookupChatExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'CT_missing',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Chat Members returned an authoritative invalid-chat response for "CT_missing".',
		});
	});

	it('should treat message-based invalid chat failures as confirmed missing results', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'invalid chat id',
		});

		await expect(
			lookupChatExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'CT_root_meta',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Chat Members returned an authoritative invalid-chat response for "CT_root_meta".',
		});
	});

	it('should use the default chat field label when shared chat preflight options are omitted', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 400 },
		});

		await expect(
			runChatLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Chats.READ',
				'CT_missing',
			),
		).rejects.toMatchObject({
			code: 'CHAT_NOT_FOUND',
			message: 'No chat found for Chat ID "CT_missing".',
		});
	});

	it('should use custom field labels in shared chat preflight errors', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 400 },
		});

		await expect(
			runChatLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Chats.READ',
				'CT_missing',
				{ fieldLabel: 'Conversation Chat ID' },
			),
		).rejects.toMatchObject({
			code: 'CHAT_NOT_FOUND',
			message: 'No chat found for Conversation Chat ID "CT_missing".',
		});
	});

	it('should validate assignable reminder types for users-type reminders', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: 'rem_users',
			users: [{ id: 'user_1' }],
			chats: [],
		});

		await expect(
			lookupAssignableReminderTypeExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'rem_users',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should block assignable reminder preflights for chat-targeted reminders', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: 'rem_chat',
			chats: [{ chat_id: 'CT_123' }],
		});

		await expect(
			runReminderAssignableTypePreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Reminders.READ',
				'rem_chat',
			),
		).rejects.toMatchObject({
			code: 'REMINDER_TYPE_NOT_ASSIGNABLE',
			message:
				'Assign users is supported only for users-type reminders in the Others category. Chat-targeted reminders do not support user assignment.',
		});
	});

	it('should skip reminder assignability preflights when reminder read scope is unavailable', async () => {
		await expect(
			runReminderAssignableTypePreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Reminders.UPDATE',
				'rem_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should fall back to empty accepted scopes when shared scope-registry entries are unavailable at import time', async () => {
		jest.resetModules();
		jest.doMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry', () => ({
			listAcceptedScopesForOperation: jest.fn(() => undefined),
		}));

		try {
			await jest.isolateModulesAsync(async () => {
				const roleModule =
					await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/role');
				const teamModule =
					await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/team');
				const orgModule =
					await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/org');
				const reminderModule =
					await import('../../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/reminder');

				await expect(
					roleModule.runRoleLookupPreflightGate(
						createContext({ continueOnFail: true }),
						0,
						'ZohoCliq.Organisation.READ',
						'role_123',
					),
				).resolves.toEqual({
					status: 'skipped',
					reason: 'scope_unavailable',
				});

				await expect(
					teamModule.runTeamLookupPreflightGate(
						createContext({ continueOnFail: true }),
						0,
						'ZohoCliq.Teams.READ',
						'team_123',
					),
				).resolves.toEqual({
					status: 'skipped',
					reason: 'scope_unavailable',
				});

				await expect(
					orgModule.runDesignationLookupPreflightGate(
						createContext({ continueOnFail: true }),
						0,
						'ZohoCliq.Organisation.READ',
						'designation_123',
					),
				).resolves.toEqual({
					status: 'skipped',
					reason: 'scope_unavailable',
				});

				await expect(
					orgModule.runDepartmentLookupPreflightGate(
						createContext({ continueOnFail: true }),
						0,
						'ZohoCliq.Departments.READ',
						'department_123',
					),
				).resolves.toEqual({
					status: 'skipped',
					reason: 'scope_unavailable',
				});

				await expect(
					reminderModule.runReminderAssignableTypePreflightGate(
						createContext({ continueOnFail: true }),
						0,
						'ZohoCliq.Reminders.READ',
						'rem_123',
					),
				).resolves.toEqual({
					status: 'skipped',
					reason: 'scope_unavailable',
				});
			});
		} finally {
			jest.dontMock('../../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry');
			jest.resetModules();
		}

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should block reminder last-assignee preflights when all assigned users would be removed', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: 'rem_users',
			users: [{ id: 'user_1' }],
		});

		await expect(
			runReminderLastAssigneeRemovalPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Reminders.READ',
				'rem_users',
				['user_1'],
			),
		).rejects.toMatchObject({
			code: 'LAST_ASSIGNEE_REMOVAL_NOT_ALLOWED',
			message:
				'Cannot remove the last remaining assignee from a users-type reminder. Delete the reminder instead if it should no longer exist.',
		});
	});

	it('should allow reminder last-assignee preflights for message reminders', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: 'rem_message',
			message: { message_id: '1772395354414_196142356543' },
			users: [{ id: 'user_1' }],
		});

		await expect(
			lookupReminderLastAssigneeRemovalExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'rem_message',
				userIdsToRemove: ['user_1'],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should throw when reminder business-rule preflights receive malformed reminder payloads', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce(null as unknown as IDataObject);

		await expect(
			lookupAssignableReminderTypeExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'rem_bad',
			}),
		).rejects.toThrow('The reminder preflight did not return an object response.');
	});

	it('should resolve designation lookups from top-level designations arrays', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			designations: [{ id: 'designation_top_level' }],
			next_token: 'next_page',
		});

		await expect(
			lookupDesignationExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'designation_top_level',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should resolve designation lookups from top-level data arrays with root pagination metadata', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ id: 'designation_array_123' }],
			next_token: 'designation_page_2',
		});

		await expect(
			lookupDesignationExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'designation_array_123',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should match numeric designation identifiers during exhaustive org lookups', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ designation_id: 123 }],
			has_more: false,
		});

		await expect(
			lookupDesignationExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: '123',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should fall back to nested org pagination metadata when root lists omit it', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				designations: [{ id: 'designation_other' }],
				data: {
					next_token: 'designation_page_2',
				},
			})
			.mockResolvedValueOnce({
				designations: [{ id: 'designation_nested_meta' }],
			});

		await expect(
			lookupDesignationExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'designation_nested_meta',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should resolve department lookups from nested data.departments payloads', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				departments: [{ id: 'dept_nested_123' }],
				next_token: 'next_department_page',
			},
		});

		await expect(
			lookupDepartmentExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'dept_nested_123',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should match numeric department identifiers during exhaustive org lookups', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ department_id: 456 }],
			has_more: false,
		});

		await expect(
			lookupDepartmentExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: '456',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should treat org pages without supported entity arrays as exhaustive missing results', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				next_token: 'unused_next_page',
			},
		});

		await expect(
			lookupDepartmentExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'dept_missing',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'The requested department ID "dept_missing" was not present after exhaustively scanning the department roster.',
		});
	});

	it('should treat primitive org roster responses as exhaustive missing results when pagination metadata is absent', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce('not-an-object' as unknown as IDataObject);

		await expect(
			lookupDepartmentExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'dept_missing',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'The requested department ID "dept_missing" was not present after exhaustively scanning the department roster.',
		});
	});

	it('should preserve root org pagination metadata even when roster arrays are absent', async () => {
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				next_token: 'dept_page_2',
			})
			.mockResolvedValueOnce({
				departments: [{ id: 'dept_root_meta' }],
			});

		await expect(
			lookupDepartmentExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'dept_root_meta',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should use the default department field label when shared department preflight options are omitted', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [],
		});

		await expect(
			runDepartmentLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Departments.READ',
				'dept_missing',
			),
		).rejects.toMatchObject({
			code: 'DEPARTMENT_NOT_FOUND',
			message: 'No department found for Department ID "dept_missing".',
		});
	});

	it('should fail role lookups when the roster response omits all supported list keys', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: { unexpected: [] },
		});

		await expect(
			lookupRoleExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'role_123',
			}),
		).rejects.toThrow(
			'The role roster preflight failed before Zoho Cliq could be scanned exhaustively.',
		);
	});

	it('should rethrow existing NodeOperationError failures during role lookups', async () => {
		const existingError = new NodeOperationError(
			createContext().getNode(),
			'The role roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			{ itemIndex: 0 },
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce(existingError);

		await expect(
			lookupRoleExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'role_123',
			}),
		).rejects.toBe(existingError);
	});

	it('should use default shared role preflight messaging when no overrides are supplied', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			roles: [{ id: 'role_other', name: 'Other Role' }],
		});

		await expect(
			runRoleLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Organisation.READ',
				'role_missing',
			),
		).rejects.toMatchObject({
			code: 'ROLE_NOT_FOUND',
			message: 'Role not found. The role ID provided does not exist in this organization.',
		});
	});

	it('should throw stable shared errors when role user preflights confirm missing users', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [],
			has_more: false,
		});

		await expect(
			runRoleUsersPreflightGate(
				createContext({ continueOnFail: true }),
				['user_1'],
				0,
				'ZohoCliq.Users.READ',
			),
		).rejects.toMatchObject({
			code: 'USER_IDS_NOT_FOUND',
			message:
				'One or more user IDs were not found. The provided user IDs do not exist in this organization. Missing user IDs: ["user_1"].',
		});
	});

	it('should honor shared role preflight label and messaging overrides', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			profiles: [],
		});

		await expect(
			runRoleLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Organisation.READ',
				'clone_role_missing',
				{
					label: 'Clone Role ID',
					message: 'Clone role missing.',
					hint: 'Use a valid clone source role ID.',
				},
			),
		).rejects.toMatchObject({
			code: 'ROLE_NOT_FOUND',
			message: 'Clone role missing.',
			zohoCliqPreflight: expect.objectContaining({
				label: 'Clone Role ID',
				hint: 'Use a valid clone source role ID.',
			}),
		});
	});

	it('should throw stable shared errors when designation user preflights confirm missing users', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [],
			has_more: false,
		});

		await expect(
			runDesignationUsersPreflightGate(
				createContext({ continueOnFail: true }),
				['user_1'],
				0,
				'ZohoCliq.Users.READ',
			),
		).rejects.toMatchObject({
			code: 'USER_IDS_NOT_FOUND',
			message:
				'The following user ID(s) could not be found: ["user_1"]. Verify user IDs before updating designation members.',
		});
	});

	it('should use default shared department user preflight wording when options are omitted', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [],
			has_more: false,
		});

		await expect(
			runDepartmentUsersPreflightGate(
				createContext({ continueOnFail: true }),
				['user_1'],
				0,
				'ZohoCliq.Users.READ',
			),
		).rejects.toMatchObject({
			code: 'USER_IDS_NOT_FOUND',
			message:
				'The following user IDs could not be found: ["user_1"]. Verify them before continuing with this department operation.',
		});
	});

	it('should use default shared department email preflight wording when options are omitted', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [],
			has_more: false,
		});

		await expect(
			runDepartmentEmailsPreflightGate(
				createContext({ continueOnFail: true }),
				['user@example.com'],
				0,
				'ZohoCliq.Users.READ',
			),
		).rejects.toMatchObject({
			code: 'EMAIL_IDS_NOT_FOUND',
			message:
				'The following email IDs could not be found: ["user@example.com"]. Verify them before continuing with this department operation.',
		});
	});

	it('should route shared department member-identifier preflights through the default user-id path', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [],
			has_more: false,
		});

		await expect(
			runDepartmentMemberIdentifiersPreflightGate(
				createContext({ continueOnFail: true }),
				{
					identifierType: 'user_ids',
					identifiers: ['user_1'],
				},
				0,
				'ZohoCliq.Users.READ',
			),
		).rejects.toMatchObject({
			code: 'USER_IDS_NOT_FOUND',
			message:
				'The following user IDs could not be found: ["user_1"]. Verify them before continuing with this department operation.',
		});
	});

	it('should honor explicitly supplied accepted scopes in the shared user preflight helper', async () => {
		await expect(
			runUserIdentifiersPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Users.READ',
				{
					identifiers: ['user_1'],
					subjectLabel: 'Explicit Scope Users',
					acceptedScopes: ['ZohoCliq.Users.ALL'],
					missing: {
						code: 'USER_IDS_NOT_FOUND',
						message: 'unused',
						hint: 'unused',
					},
				},
			),
		).resolves.toBeUndefined();

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should accept numeric team IDs from direct team lookups', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			id: 1234567890,
			name: 'Numeric Team',
		});

		await expect(
			lookupDirectTeamExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: '1234567890',
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
			entity: {
				id: 1234567890,
				name: 'Numeric Team',
			},
		});
	});

	it('should treat non-object direct team lookup responses as confirmed missing', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce('not-an-object' as unknown as IDataObject);

		await expect(
			lookupDirectTeamExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'team_missing',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence: 'Get Team returned a non-object response for "team_missing".',
		});
	});

	it('should treat mismatched direct team lookup identifiers as confirmed missing', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			team_id: 'team_other',
			name: 'Other Team',
		});

		await expect(
			lookupDirectTeamExhaustively(createContext({ continueOnFail: true }), 0, {
				identifier: 'team_missing',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Get Team returned a response, but it did not identify "team_missing" as one of the canonical team identifiers.',
		});
	});

	it('should normalize authoritative team lookup failures into stable not-found errors', () => {
		const result = normalizeTeamLookupNotFoundError(
			createContext({ continueOnFail: true }),
			{
				response: {
					statusCode: 404,
					body: {
						message: 'No team found for this lookup',
					},
				},
			},
			0,
		);

		expect(result).toBeInstanceOf(NodeOperationError);
		expect(result?.message).toBe(
			'Team not found. The team ID provided does not exist in Zoho Cliq or is not accessible to the authenticated account.',
		);
		expect((result as NodeOperationError & { statusCode?: number })?.statusCode).toBe(404);
	});

	it('should resolve team membership preflights when every requested user is on the team roster', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			members: [
				{ user_id: '44344926', display_name: 'Olivia Palmer' },
				{ id: '54667722', display_name: 'Quinn Rivers' },
			],
		});

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['44344926', '54667722'],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should compare requested team membership identifiers using canonical user identifier normalization', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			members: [{ email_id: 'olivia.palmer@example.com', display_name: 'Olivia Palmer' }],
		});

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['Olivia.Palmer@Example.com'],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should return missing team membership identifiers for users outside the team roster', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: {
				members: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
			},
		});

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['44344926', '54667722'],
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'The requested user IDs are valid Zoho Cliq users but are not current members of team "team_123". Non-member user IDs: ["54667722"].',
			missingIdentifiers: ['54667722'],
		});
	});

	it('should resolve team membership preflights from top-level data arrays', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
		});

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['44344926'],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});
	});

	it('should throw stable shared errors when team membership preflights confirm non-members', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			members: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
		});

		await expect(
			runTeamMembershipPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Teams.READ',
				'team_123',
				['44344926', '54667722'],
			),
		).rejects.toMatchObject({
			code: 'USER_IDS_NOT_TEAM_MEMBERS',
			zohoCliqNonMemberUserIds: ['54667722'],
		});
	});

	it('should skip team membership preflights when team member read scope is unavailable', async () => {
		await expect(
			runTeamMembershipPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Teams.UPDATE',
				'team_123',
				['44344926'],
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should short-circuit team membership lookups when no user IDs were provided', async () => {
		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: [],
			}),
		).resolves.toEqual({
			status: 'confirmed_exists',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should validate the team membership gate immediately when no user IDs were provided', async () => {
		await expect(
			runTeamMembershipPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Teams.READ',
				'team_123',
				[],
			),
		).resolves.toEqual({
			status: 'validated',
		});

		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should fail active team membership preflights when the roster payload is malformed', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			data: { next_token: 'abc123' },
		});

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['44344926'],
			}),
		).rejects.toThrow(
			'The team membership preflight did not return a members collection that could be verified.',
		);
	});

	it('should fail active team membership preflights when a roster row has no usable canonical identifier', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			members: [{ display_name: 'Unverifiable Member' }],
		});

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['44344926'],
			}),
		).rejects.toThrow(
			'The team membership preflight could not verify the roster because Zoho Cliq returned one or more team member rows without a usable user identifier.',
		);
	});

	it('should fail active team membership preflights when the roster payload is not an object', async () => {
		mockZohoCliqApiRequest.mockResolvedValueOnce(undefined as unknown as IDataObject);

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['44344926'],
			}),
		).rejects.toThrow('The team membership preflight did not return an object response.');
	});

	it('should fail active team membership preflights when the roster lookup request fails', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('lookup failed'));

		await expect(
			lookupTeamMembershipExhaustively(createContext({ continueOnFail: true }), 0, {
				teamId: 'team_123',
				userIds: ['44344926'],
			}),
		).rejects.toThrow(
			'The team membership preflight failed before Zoho Cliq could verify the roster for team "team_123".',
		);
	});

	it('should rethrow existing operation errors from the team membership roster lookup', async () => {
		const context = createContext({ continueOnFail: true });
		const existingError = new NodeOperationError(
			context.getNode(),
			'Existing roster lookup failure.',
			{
				itemIndex: 0,
			},
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce(existingError);

		await expect(
			lookupTeamMembershipExhaustively(context, 0, {
				teamId: 'team_123',
				userIds: ['44344926'],
			}),
		).rejects.toBe(existingError);
	});

	it('should skip thread preflight when no supported lookup scope is available', async () => {
		await expect(
			runThreadLookupPreflightGate(
				createContext({ continueOnFail: true }),
				0,
				'ZohoCliq.Webhooks.CREATE',
				'thread_chat_123',
			),
		).resolves.toEqual({
			status: 'skipped',
			reason: 'scope_unavailable',
		});
	});

	it('should map authoritative not-found thread follower lookups to confirmed missing', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		await expect(
			lookupThreadExhaustively(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Chats.READ', {
				identifier: 'thread_chat_123',
			}),
		).resolves.toEqual({
			status: 'confirmed_missing',
			evidence:
				'Zoho Cliq did not confirm the supplied thread chat ID as an existing thread in the authenticated account during the available verification checks.',
		});
	});

	it('should fail thread lookups when every available lookup endpoint errors inconclusively', async () => {
		mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('temporary follower lookup failure'));

		await expect(
			lookupThreadExhaustively(createContext({ continueOnFail: true }), 0, 'ZohoCliq.Chats.READ', {
				identifier: 'thread_chat_123',
			}),
		).rejects.toThrow(
			'The thread preflight failed before Zoho Cliq could verify the supplied thread chat ID.',
		);
	});
});
