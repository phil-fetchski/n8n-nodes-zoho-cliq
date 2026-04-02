/**
 * Tests for Helper Utilities
 * Verifies validation functions, sanitization, and scope checking
 */

import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	validateCredentials,
	checkRequiredScope,
	extractErrorText,
	validateChannelId,
	validateMemberId,
	validateChannelName,
	validateThreadId,
	sanitizeJsonBody,
	validateEmail,
	normalizeNameCase,
	parseEmailList,
	isNonEmptyString,
	isBoolean,
	isValidNumber,
	validateChatId,
	validateMessageId,
	validateEmojiCode,
	validateFileId,
	validateCommentId,
	validateLimit,
	validateNextToken,
	validateToken,
	validateScheduleTime,
	validateScheduleStatus,
	validateTimezone,
	validateThreadChatId,
	validateUserId,
	validateUserIdArray,
	validateThreadStateFilter,
	validateThreadTypeFilter,
	validateThreadAction,
} from '../../../../nodes/ZohoCliq/v1/helpers/utils';
import * as credentials from '../../../../credentials/ZohoCliqOAuth2Api.credentials';

const actualCredentials = jest.requireActual(
	'../../../../credentials/ZohoCliqOAuth2Api.credentials',
) as {
	hasRequiredScope: typeof credentials.hasRequiredScope;
};

// Mock credentials module
jest.mock('../../../../credentials/ZohoCliqOAuth2Api.credentials');

describe('Helper Utils', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getCredentials: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
		} as unknown as IExecuteFunctions;

		(credentials.hasRequiredScope as jest.Mock).mockImplementation(
			actualCredentials.hasRequiredScope,
		);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('validateCredentials', () => {
		it('should return token-granted scopes when credentials are valid', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				scope: 'ZohoCliq.Channels.READ,ZohoCliq.Channels.CREATE',
				oauthTokenData: {
					access_token: 'valid_token',
					scope: 'ZohoCliq.Channels.READ ZohoCliq.Channels.CREATE',
				},
			});

			const scopes = await validateCredentials(mockExecuteFunctions);

			expect(scopes).toBe('ZohoCliq.Channels.READ,ZohoCliq.Channels.CREATE');
		});

		it('should throw error when credentials are missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue(null);

			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(NodeOperationError);
			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(
				'No credentials configured',
			);
		});

		it('should throw error when OAuth token is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				scope: 'ZohoCliq.Channels.READ',
				oauthTokenData: undefined,
			});

			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(NodeOperationError);
			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(
				'OAuth token not found',
			);
		});

		it('should throw error when access token is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				scope: 'ZohoCliq.Channels.READ',
				oauthTokenData: {},
			});

			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(NodeOperationError);
		});

		it('should throw error when access token is not a string', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				scope: 'ZohoCliq.Channels.READ',
				oauthTokenData: { access_token: 123, scope: 'ZohoCliq.Channels.READ' },
			});

			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(
				'OAuth token not found',
			);
		});

		it('should throw error when token scope data is missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				scope: '',
				oauthTokenData: { access_token: 'token', scope: '' },
			});

			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(NodeOperationError);
			await expect(validateCredentials(mockExecuteFunctions)).rejects.toThrow(
				'OAuth token scope data is missing',
			);
		});

		it('should parse token scope arrays', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				scope: '',
				oauthTokenData: {
					access_token: 'token',
					scope: ['ZohoCliq.Channels.READ', 'ZohoCliq.Messages.CREATE ZohoCliq.Channels.READ'],
				},
			});

			const scopes = await validateCredentials(mockExecuteFunctions);

			expect(scopes).toBe('ZohoCliq.Channels.READ,ZohoCliq.Messages.CREATE');
		});

		it('should merge token scope string and token scopes array without duplicates', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				scope: 'ZohoCliq.Users.READ,ZohoCliq.Organisation.UPDATE',
				oauthTokenData: {
					access_token: 'token',
					scope: 'ZohoCliq.Users.READ ZohoCliq.Messages.CREATE',
					scopes: ['ZohoCliq.Organisation.UPDATE', 'ZohoCliq.Users.ALL'],
				},
			});

			const scopes = await validateCredentials(mockExecuteFunctions);

			expect(scopes).toBe(
				'ZohoCliq.Users.READ,ZohoCliq.Messages.CREATE,ZohoCliq.Organisation.UPDATE,ZohoCliq.Users.ALL',
			);
		});
	});

	describe('checkRequiredScope', () => {
		it('should not throw when required scope is granted', () => {
			(credentials.hasRequiredScope as jest.Mock).mockReturnValue(true);

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Channels.READ,ZohoCliq.Channels.CREATE',
					'ZohoCliq.Channels.READ',
					0,
				),
			).not.toThrow();
		});

		it('should throw error when required scope is missing', () => {
			(credentials.hasRequiredScope as jest.Mock).mockReturnValue(false);

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Channels.READ',
					'ZohoCliq.Channels.CREATE',
					0,
				),
			).toThrow(NodeOperationError);

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Channels.READ',
					'ZohoCliq.Channels.CREATE',
					0,
				),
			).toThrow('Missing OAuth scope for');
		});

		it('should include item index in error', () => {
			(credentials.hasRequiredScope as jest.Mock).mockReturnValue(false);

			try {
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Channels.READ',
					'ZohoCliq.Channels.CREATE',
					5,
				);
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(NodeOperationError);
				// NodeOperationError includes itemIndex in context
			}
		});

		it('should include scope name in error description', () => {
			(credentials.hasRequiredScope as jest.Mock).mockReturnValue(false);

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Channels.READ',
					'ZohoCliq.Messages.CREATE',
					0,
				),
			).toThrow('Missing OAuth scope for');
		});

		it('should support list-based scope checks', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.messages.CREATE',
					['ZohoCliq.messages.CREATE', 'zohoCliq.messages.create'],
					0,
				),
			).not.toThrow();
		});

		it('should support case-insensitive list-based scope checks', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'zohoCliq.messages.create',
					['ZohoCliq.messages.CREATE'],
					0,
					{ caseInsensitive: true },
				),
			).not.toThrow();
		});

		it('should support wildcard grants for list-based scope checks', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Organisation.ALL',
					['ZohoCliq.Organisation.UPDATE', 'ZohoCliq.Organisation.DELETE'],
					0,
				),
			).not.toThrow();
		});

		it('should require exact match for single-item list-based scope checks', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Organisation.ALL',
					['ZohoCliq.Organisation.UPDATE'],
					0,
				),
			).toThrow('Missing OAuth scope for');
		});

		it('should reject disallowed scopes during list-based scope checks', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.messages.ALL,ZohoCliq.messages.CREATE',
					['ZohoCliq.messages.CREATE'],
					0,
					{
						disallowedScopes: ['ZohoCliq.messages.ALL'],
						disallowedScopeMessage: 'messages.ALL is not supported',
					},
				),
			).toThrow('messages.ALL is not supported');
		});

		it('should reject disallowed scopes with case-insensitive matching', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'zohocliq.messages.all',
					['ZohoCliq.messages.CREATE'],
					0,
					{
						caseInsensitive: true,
						disallowedScopes: ['ZohoCliq.messages.ALL'],
					},
				),
			).toThrow('OAuth scope "ZohoCliq.messages.ALL" is not supported for this operation.');
		});

		it('should not throw when disallowed scopes are configured but not granted', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.messages.CREATE',
					['ZohoCliq.messages.CREATE'],
					0,
					{
						disallowedScopes: ['ZohoCliq.messages.ALL'],
					},
				),
			).not.toThrow();
		});

		it('should use default disallowed scope message when custom message is not provided', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.messages.ALL',
					['ZohoCliq.messages.CREATE'],
					0,
					{
						disallowedScopes: ['ZohoCliq.messages.ALL'],
					},
				),
			).toThrow('OAuth scope "ZohoCliq.messages.ALL" is not supported for this operation.');
		});

		it('should resolve scope context from node parameters for list-based missing scope checks', () => {
			(mockExecuteFunctions as unknown as { getNodeParameter: jest.Mock }).getNodeParameter = jest
				.fn()
				.mockImplementation((paramName: string) => {
					if (paramName === 'resource') return 'remoteWork';
					if (paramName === 'operation') return 'checkIn';
					return undefined;
				});

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Profile.READ',
					['ZohoCliq.Profile.UPDATE'],
					0,
				),
			).toThrow('Missing OAuth scope for remoteWork.checkIn');
		});

		it('should resolve unknown context when node parameter lookup throws', () => {
			(mockExecuteFunctions as unknown as { getNodeParameter: jest.Mock }).getNodeParameter = jest
				.fn()
				.mockImplementation(() => {
					throw new Error('no parameter');
				});
			(credentials.hasRequiredScope as jest.Mock).mockReturnValue(false);

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Channels.READ',
					'ZohoCliq.Channels.CREATE',
					0,
				),
			).toThrow('Missing OAuth scope for unknown.unknown');
		});

		it('should resolve unknown context when resource and operation values are empty', () => {
			(mockExecuteFunctions as unknown as { getNodeParameter: jest.Mock }).getNodeParameter = jest
				.fn()
				.mockReturnValue('');
			(credentials.hasRequiredScope as jest.Mock).mockReturnValue(false);

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Channels.READ',
					'ZohoCliq.Channels.CREATE',
					0,
				),
			).toThrow('Missing OAuth scope for unknown.unknown');
		});

		it('should honor provided scopeContext and missingScopeMessage for list-based missing scope', () => {
			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Profile.READ',
					['ZohoCliq.Profile.UPDATE'],
					0,
					{
						scopeContext: { resource: 'remoteWork', operation: 'checkIn' },
						missingScopeMessage: 'custom array scope error',
					},
				),
			).toThrow('custom array scope error');
		});

		it('should honor provided scopeContext and missingScopeMessage for single missing scope', () => {
			(credentials.hasRequiredScope as jest.Mock).mockReturnValue(false);

			expect(() =>
				checkRequiredScope(
					mockExecuteFunctions,
					'ZohoCliq.Profile.READ',
					'ZohoCliq.Profile.UPDATE',
					0,
					{
						scopeContext: { resource: 'remoteWork', operation: 'checkOut' },
						missingScopeMessage: 'custom single scope error',
					},
				),
			).toThrow('custom single scope error');
		});
	});

	describe('extractErrorText', () => {
		it('should return string error as-is', () => {
			expect(extractErrorText('plain error')).toBe('plain error');
		});

		it('should prefer response.data.message when present', () => {
			const message = extractErrorText({
				response: {
					data: {
						message: 'data message',
					},
				},
				message: 'fallback message',
			});

			expect(message).toBe('data message');
		});

		it('should read response.body.message from transport-shaped errors', () => {
			const message = extractErrorText({
				response: {
					body: {
						message: 'body message',
					},
				},
				message: 'fallback message',
			});

			expect(message).toBe('body message');
		});

		it('should fallback to top-level message then description then unknown', () => {
			expect(extractErrorText({ message: 'top-level message' })).toBe('top-level message');
			expect(extractErrorText({ description: 'description message' })).toBe('description message');
			expect(extractErrorText({})).toBe('An unexpected issue occurred with the API request');
		});

		it('should return unknown api error for non-object non-string values', () => {
			expect(extractErrorText(123)).toBe('An unexpected issue occurred with the API request');
		});
	});

	describe('validateMemberId', () => {
		it('should throw error for empty member id', () => {
			expect(() => validateMemberId(mockExecuteFunctions, '   ', 0)).toThrow(
				'Member ID is required',
			);
		});

		it('should throw error for member id that exceeds max length', () => {
			expect(() => validateMemberId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Member ID is too long',
			);
		});

		it('should throw error for invalid member id format', () => {
			expect(() => validateMemberId(mockExecuteFunctions, 'member id', 0)).toThrow(
				'Invalid Member ID format',
			);
		});

		it('should return sanitized member id for valid input', () => {
			expect(validateMemberId(mockExecuteFunctions, '  member_123  ', 0)).toBe('member_123');
		});
	});

	describe('validateChannelId', () => {
		it('should return sanitized channel ID', () => {
			const result = validateChannelId(mockExecuteFunctions, '  C1234567890  ', 0);
			expect(result).toBe('C1234567890');
		});

		it('should throw error for empty channel ID', () => {
			expect(() => validateChannelId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateChannelId(mockExecuteFunctions, '   ', 0)).toThrow(NodeOperationError);
		});

		it('should throw error for invalid characters', () => {
			expect(() => validateChannelId(mockExecuteFunctions, 'C123@#$', 0)).toThrow(
				NodeOperationError,
			);
			expect(() => validateChannelId(mockExecuteFunctions, 'C 123', 0)).toThrow(NodeOperationError);
		});

		it('should throw error for too long channel ID', () => {
			const longId = 'C' + '1'.repeat(100);
			expect(() => validateChannelId(mockExecuteFunctions, longId, 0)).toThrow(NodeOperationError);
		});

		it('should accept alphanumeric, hyphens, and underscores', () => {
			const validIds = ['C123', 'channel-123', 'test_channel', 'ABC-xyz_123'];

			validIds.forEach((id) => {
				expect(() => validateChannelId(mockExecuteFunctions, id, 0)).not.toThrow();
			});
		});
	});

	describe('validateChannelName', () => {
		it('should return sanitized channel name', () => {
			const result = validateChannelName(mockExecuteFunctions, '  test-channel  ', 0);
			expect(result).toBe('test-channel');
		});

		it('should throw error for empty channel name', () => {
			expect(() => validateChannelName(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateChannelName(mockExecuteFunctions, '   ', 0)).toThrow(
				'Channel Unique Name is required',
			);
		});

		it('should throw error for invalid characters', () => {
			expect(() => validateChannelName(mockExecuteFunctions, 'test@channel', 0)).toThrow(
				NodeOperationError,
			);
			expect(() => validateChannelName(mockExecuteFunctions, 'test channel', 0)).toThrow(
				'Invalid Channel Unique Name format',
			);
		});

		it('should throw error for too long channel name', () => {
			const longName = 'a'.repeat(101);
			expect(() => validateChannelName(mockExecuteFunctions, longName, 0)).toThrow(
				NodeOperationError,
			);
			expect(() => validateChannelName(mockExecuteFunctions, longName, 0)).toThrow(
				'Maximum length is 100 characters',
			);
		});

		it('should accept valid channel names', () => {
			const validNames = ['test-channel', 'my_channel', 'channel123', 'ABC-xyz_123'];

			validNames.forEach((name) => {
				expect(() => validateChannelName(mockExecuteFunctions, name, 0)).not.toThrow();
			});
		});
	});

	describe('validateThreadId', () => {
		it('should return sanitized thread ID', () => {
			const result = validateThreadId(mockExecuteFunctions, '  T1234567890  ', 0);
			expect(result).toBe('T1234567890');
		});

		it('should throw error for invalid characters', () => {
			expect(() => validateThreadId(mockExecuteFunctions, 'T123@#$', 0)).toThrow(
				NodeOperationError,
			);
			expect(() => validateThreadId(mockExecuteFunctions, 'T 123', 0)).toThrow(
				'Invalid Thread ID format',
			);
		});

		it('should throw error for too long thread ID', () => {
			const longId = 'T' + '1'.repeat(100);
			expect(() => validateThreadId(mockExecuteFunctions, longId, 0)).toThrow(NodeOperationError);
			expect(() => validateThreadId(mockExecuteFunctions, longId, 0)).toThrow(
				'Maximum length is 100 characters',
			);
		});

		it('should accept valid thread IDs', () => {
			const validIds = ['T123', 'thread-123', 'test_thread', 'ABC-xyz_123'];

			validIds.forEach((id) => {
				expect(() => validateThreadId(mockExecuteFunctions, id, 0)).not.toThrow();
			});
		});
	});

	describe('sanitizeJsonBody', () => {
		it('should preserve provided fields while sanitizing recursively', () => {
			const input = {
				text: 'Hello',
				thread_id: 'T123',
				card: { title: 'Test' },
				custom_field: 'should stay',
			};

			const result = sanitizeJsonBody(mockExecuteFunctions, input, 0);

			expect(result).toHaveProperty('text', 'Hello');
			expect(result).toHaveProperty('thread_id', 'T123');
			expect(result).toHaveProperty('card');
			expect(result).toHaveProperty('custom_field', 'should stay');
		});

		it('should sanitize non-empty array entries recursively', () => {
			const result = sanitizeJsonBody(
				mockExecuteFunctions,
				{
					buttons: [{ label: 'OK', action: { data: { value: 'x' } } }],
				},
				0,
			);

			expect(result).toEqual({
				buttons: [{ label: 'OK', action: { data: { value: 'x' } } }],
			});
		});

		// __proto__ is automatically filtered by Object.keys() (non-enumerable)
		// So it doesn't appear in the keys and thus doesn't throw an error
		it('should not enumerate __proto__ (inherent JS protection)', () => {
			const input = { __proto__: { polluted: true }, text: 'Hello' };

			// Object.keys() naturally filters out __proto__
			const result = sanitizeJsonBody(mockExecuteFunctions, input, 0);
			expect(result).toEqual({ text: 'Hello' });
			// Check that __proto__ is not an own property (it exists in prototype chain)
			expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
		});

		it('should prevent constructor pollution', () => {
			const input = { constructor: { polluted: true }, text: 'Hello' };

			expect(() => sanitizeJsonBody(mockExecuteFunctions, input, 0)).toThrow(NodeOperationError);
		});

		it('should prevent prototype key pollution', () => {
			const input = { prototype: { polluted: true }, text: 'Hello' };

			expect(() => sanitizeJsonBody(mockExecuteFunctions, input, 0)).toThrow(NodeOperationError);
		});

		it('should throw error for non-object input', () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(() => sanitizeJsonBody(mockExecuteFunctions, 'string' as any, 0)).toThrow(
				NodeOperationError,
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(() => sanitizeJsonBody(mockExecuteFunctions, null as any, 0)).toThrow(
				NodeOperationError,
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			expect(() => sanitizeJsonBody(mockExecuteFunctions, [] as any, 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should keep common message fields', () => {
			const input = {
				text: 'Hello',
				thread_id: 'T123',
				bot_name: 'mybot',
				card: {},
				slides: [],
				buttons: [],
				broadcast: true,
				temporary: false,
				bot: {},
			};

			const result = sanitizeJsonBody(mockExecuteFunctions, input, 0);

			expect(Object.keys(result)).toHaveLength(9);
			expect(result).toHaveProperty('text');
			expect(result).toHaveProperty('thread_id');
			expect(result).toHaveProperty('bot_name');
			expect(result).toHaveProperty('card');
			expect(result).toHaveProperty('slides');
			expect(result).toHaveProperty('buttons');
			expect(result).toHaveProperty('broadcast');
			expect(result).toHaveProperty('temporary');
			expect(result).toHaveProperty('bot');
		});

		it('should keep non-standard top-level fields instead of dropping them', () => {
			const input = { unsafe1: 'value1', unsafe2: 'value2' };

			const result = sanitizeJsonBody(mockExecuteFunctions, input, 0);

			expect(result).toEqual(input);
		});

		it('should reject constructor key in nested objects', () => {
			const input = {
				card: {
					constructor: { polluted: true },
				},
			};

			expect(() => sanitizeJsonBody(mockExecuteFunctions, input, 0)).toThrow(NodeOperationError);
		});
	});

	describe('validateEmail', () => {
		it('should return sanitized email', () => {
			const result = validateEmail(mockExecuteFunctions, '  user@example.com  ', 0);
			expect(result).toBe('user@example.com');
		});

		it('should accept valid email formats', () => {
			const validEmails = [
				'user@example.com',
				'test.user@example.com',
				'user-name@example.com',
				'user_name@example.com',
				'alerts+ops@example.com',
			];

			validEmails.forEach((email) => {
				expect(() => validateEmail(mockExecuteFunctions, email, 0)).not.toThrow();
			});
		});

		it('should throw error for invalid characters', () => {
			expect(() => validateEmail(mockExecuteFunctions, 'user!@example.com', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for multiple @ symbols', () => {
			expect(() => validateEmail(mockExecuteFunctions, 'test@@example.com', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for plus signs in the domain', () => {
			expect(() => validateEmail(mockExecuteFunctions, 'test@example+invalid.com', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for consecutive dots in the domain', () => {
			expect(() => validateEmail(mockExecuteFunctions, 'test@example..com', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for domains that start with a dot', () => {
			expect(() => validateEmail(mockExecuteFunctions, 'test@.example.com', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for domain labels that start with a hyphen', () => {
			expect(() => validateEmail(mockExecuteFunctions, 'test@-example.com', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for domain labels that end with a hyphen', () => {
			expect(() => validateEmail(mockExecuteFunctions, 'test@example-.com', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for too long email', () => {
			const longEmail = 'a'.repeat(256) + '@example.com';
			expect(() => validateEmail(mockExecuteFunctions, longEmail, 0)).toThrow(NodeOperationError);
		});
	});

	describe('normalizeNameCase', () => {
		it('should normalize mixed-case input', () => {
			expect(normalizeNameCase(' aLIce ')).toBe('Alice');
		});

		it('should return empty string when input is blank', () => {
			expect(normalizeNameCase('   ')).toBe('');
		});
	});

	describe('parseEmailList', () => {
		it('should parse comma-separated emails', () => {
			const result = parseEmailList(mockExecuteFunctions, 'user1@test.com,user2@test.com', 0);

			expect(result).toEqual(['user1@test.com', 'user2@test.com']);
		});

		it('should trim whitespace from emails', () => {
			const result = parseEmailList(mockExecuteFunctions, ' user1@test.com , user2@test.com ', 0);

			expect(result).toEqual(['user1@test.com', 'user2@test.com']);
		});

		it('should filter out empty entries', () => {
			const result = parseEmailList(mockExecuteFunctions, 'user1@test.com,,user2@test.com', 0);

			expect(result).toEqual(['user1@test.com', 'user2@test.com']);
		});

		it('should validate each email', () => {
			expect(() =>
				parseEmailList(mockExecuteFunctions, 'valid@test.com,invalid!@test.com', 0),
			).toThrow(NodeOperationError);
		});

		it('should handle single email', () => {
			const result = parseEmailList(mockExecuteFunctions, 'user@test.com', 0);

			expect(result).toEqual(['user@test.com']);
		});

		it('should return empty array for empty string', () => {
			const result = parseEmailList(mockExecuteFunctions, '', 0);

			expect(result).toEqual([]);
		});
	});

	describe('isNonEmptyString', () => {
		it('should return true for non-empty string', () => {
			expect(isNonEmptyString('test')).toBe(true);
			expect(isNonEmptyString('hello world')).toBe(true);
			expect(isNonEmptyString('123')).toBe(true);
		});

		it('should return false for empty string', () => {
			expect(isNonEmptyString('')).toBe(false);
		});

		it('should return false for whitespace-only string', () => {
			expect(isNonEmptyString('   ')).toBe(false);
			expect(isNonEmptyString('\t')).toBe(false);
			expect(isNonEmptyString('\n')).toBe(false);
		});

		it('should return false for non-string types', () => {
			expect(isNonEmptyString(123)).toBe(false);
			expect(isNonEmptyString(true)).toBe(false);
			expect(isNonEmptyString(null)).toBe(false);
			expect(isNonEmptyString(undefined)).toBe(false);
			expect(isNonEmptyString({})).toBe(false);
			expect(isNonEmptyString([])).toBe(false);
		});
	});

	describe('isBoolean', () => {
		it('should return true for boolean values', () => {
			expect(isBoolean(true)).toBe(true);
			expect(isBoolean(false)).toBe(true);
		});

		it('should return false for non-boolean types', () => {
			expect(isBoolean(1)).toBe(false);
			expect(isBoolean(0)).toBe(false);
			expect(isBoolean('true')).toBe(false);
			expect(isBoolean('false')).toBe(false);
			expect(isBoolean(null)).toBe(false);
			expect(isBoolean(undefined)).toBe(false);
			expect(isBoolean({})).toBe(false);
			expect(isBoolean([])).toBe(false);
		});
	});

	describe('isValidNumber', () => {
		it('should return true for valid numbers', () => {
			expect(isValidNumber(0)).toBe(true);
			expect(isValidNumber(123)).toBe(true);
			expect(isValidNumber(-456)).toBe(true);
			expect(isValidNumber(3.14)).toBe(true);
			expect(isValidNumber(-2.718)).toBe(true);
		});

		it('should return false for NaN', () => {
			expect(isValidNumber(NaN)).toBe(false);
			expect(isValidNumber(Number.NaN)).toBe(false);
		});

		it('should return false for Infinity', () => {
			expect(isValidNumber(Infinity)).toBe(false);
			expect(isValidNumber(-Infinity)).toBe(false);
			expect(isValidNumber(Number.POSITIVE_INFINITY)).toBe(false);
			expect(isValidNumber(Number.NEGATIVE_INFINITY)).toBe(false);
		});

		it('should return false for non-number types', () => {
			expect(isValidNumber('123')).toBe(false);
			expect(isValidNumber(true)).toBe(false);
			expect(isValidNumber(null)).toBe(false);
			expect(isValidNumber(undefined)).toBe(false);
			expect(isValidNumber({})).toBe(false);
			expect(isValidNumber([])).toBe(false);
		});
	});

	describe('validateChatId', () => {
		it('should throw for empty chat ID', () => {
			expect(() => validateChatId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for too long chat ID', () => {
			expect(() => validateChatId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized chat ID for valid input', () => {
			expect(validateChatId(mockExecuteFunctions, '  CT_123_456  ', 0)).toBe('CT_123_456');
		});

		it('should throw for invalid chat id format', () => {
			expect(() => validateChatId(mockExecuteFunctions, 'chat id', 0)).toThrow(
				'Invalid Chat ID format',
			);
		});

		it('should use the provided field name in chat-conversation mode errors', () => {
			expect(() =>
				validateChatId(mockExecuteFunctions, 'P1234567890123456789', 0, {
					mode: 'chatConversation',
					fieldName: 'Thread Chat ID',
				}),
			).toThrow(
				'Thread Chat ID must start with a number or "CT_". It appears a Channel ID or other non-chat identifier was provided.',
			);
		});

		it('should reject non-numeric direct-message chat IDs for status scheduling', () => {
			expect(() =>
				validateChatId(mockExecuteFunctions, 'CT_123_456', 0, {
					mode: 'directMessage',
				}),
			).toThrow(
				'Chat ID must start with a number because status-based scheduling requires a direct-message Chat ID. Channel and group chat IDs are not supported.',
			);
		});

		it('should reject bot-conversation chat IDs for status scheduling', () => {
			expect(() =>
				validateChatId(mockExecuteFunctions, 'CT_2218621746656928414_841692385-B2', 0, {
					mode: 'directMessage',
				}),
			).toThrow(
				'Chat ID must start with a number because status-based scheduling requires a direct-message Chat ID. Channel and group chat IDs are not supported.',
			);
		});
	});

	describe('validateMessageId', () => {
		it('should throw for empty message ID', () => {
			expect(() => validateMessageId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for too long message ID', () => {
			expect(() => validateMessageId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized message ID for valid input', () => {
			expect(validateMessageId(mockExecuteFunctions, '  MSG_123  ', 0)).toBe('MSG_123');
		});

		it('should allow percent-encoded message IDs', () => {
			expect(validateMessageId(mockExecuteFunctions, '1709038327612%20712605914940', 0)).toBe(
				'1709038327612%20712605914940',
			);
		});

		it('should throw for invalid message id format', () => {
			expect(() => validateMessageId(mockExecuteFunctions, 'MSG 123', 0)).toThrow(
				'Invalid Message ID format',
			);
		});
	});

	describe('validateEmojiCode', () => {
		it('should throw for empty emoji code', () => {
			expect(() => validateEmojiCode(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for invalid emoji format', () => {
			expect(() => validateEmojiCode(mockExecuteFunctions, 'invalid emoji', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw for too long emoji code', () => {
			expect(() => validateEmojiCode(mockExecuteFunctions, ':' + 'a'.repeat(100) + ':', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized emoji code for valid Zomoji', () => {
			expect(validateEmojiCode(mockExecuteFunctions, '  :smile:  ', 0)).toBe(':smile:');
		});

		it('should return sanitized emoji code for valid Unicode emoji', () => {
			expect(validateEmojiCode(mockExecuteFunctions, '😀', 0)).toBe('😀');
		});
	});

	describe('validateFileId', () => {
		it('should throw for empty file ID', () => {
			expect(() => validateFileId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for too long file ID', () => {
			expect(() => validateFileId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized file ID for valid input', () => {
			expect(validateFileId(mockExecuteFunctions, '  FILE_123  ', 0)).toBe('FILE_123');
		});
	});

	describe('validateCommentId', () => {
		it('should throw for empty comment ID', () => {
			expect(() => validateCommentId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for too long comment ID', () => {
			expect(() => validateCommentId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized comment ID for valid input', () => {
			expect(validateCommentId(mockExecuteFunctions, '  CMT:123.abc  ', 0)).toBe('CMT:123.abc');
		});
	});

	describe('validateLimit', () => {
		it('should throw for out-of-range limit', () => {
			expect(() => validateLimit(mockExecuteFunctions, 0, 0)).toThrow(
				'Limit must be a whole number between 1 and 100',
			);
			expect(() => validateLimit(mockExecuteFunctions, 101, 0)).toThrow(
				'Limit must be a whole number between 1 and 100',
			);
		});

		it('should return normalized whole-number limit for valid input', () => {
			expect(validateLimit(mockExecuteFunctions, '25', 0)).toBe(25);
		});
	});

	describe('validateNextToken', () => {
		it('should throw for empty next token', () => {
			expect(() => validateNextToken(mockExecuteFunctions, '   ', 0)).toThrow(NodeOperationError);
		});

		it('should throw for too long next token', () => {
			expect(() => validateNextToken(mockExecuteFunctions, 'a'.repeat(1025), 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized next token for valid input', () => {
			expect(validateNextToken(mockExecuteFunctions, '  next_abc  ', 0)).toBe('next_abc');
		});
	});

	describe('validateToken', () => {
		it('should use field name in empty-token error', () => {
			expect(() => validateToken(mockExecuteFunctions, '   ', 0, 'Sync Token')).toThrow(
				'Sync Token cannot be empty',
			);
		});

		it('should use field name in max-length error', () => {
			expect(() => validateToken(mockExecuteFunctions, 'a'.repeat(1025), 0, 'Sync Token')).toThrow(
				'Sync Token is too long',
			);
		});

		it('should return sanitized token for valid input', () => {
			expect(validateToken(mockExecuteFunctions, '  sync_abc  ', 0, 'Sync Token')).toBe('sync_abc');
		});
	});

	describe('validateScheduleTime', () => {
		it('should throw for invalid schedule time number values', () => {
			expect(() => validateScheduleTime(mockExecuteFunctions, Number.NaN, 0)).toThrow(
				'Schedule Time must be a valid number',
			);
			expect(() => validateScheduleTime(mockExecuteFunctions, Number.POSITIVE_INFINITY, 0)).toThrow(
				'Schedule Time must be a valid number',
			);
		});

		it('should throw for zero timestamp', () => {
			expect(() => validateScheduleTime(mockExecuteFunctions, 0, 0)).toThrow(
				'Schedule Time must be in the future',
			);
		});

		it('should throw for negative timestamp', () => {
			expect(() => validateScheduleTime(mockExecuteFunctions, -1000, 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw for past timestamp', () => {
			const pastTime = Date.now() - 1000;
			expect(() => validateScheduleTime(mockExecuteFunctions, pastTime, 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return timestamp for valid future time', () => {
			const futureTime = Date.now() + 10000;
			expect(validateScheduleTime(mockExecuteFunctions, futureTime, 0)).toBe(futureTime);
		});
	});

	describe('validateScheduleStatus', () => {
		it('should throw for invalid status', () => {
			expect(() => validateScheduleStatus(mockExecuteFunctions, 'invalid', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return valid status for valid input', () => {
			expect(validateScheduleStatus(mockExecuteFunctions, 'check_in', 0)).toBe('check_in');
			expect(validateScheduleStatus(mockExecuteFunctions, 'user_available', 0)).toBe(
				'user_available',
			);
			expect(validateScheduleStatus(mockExecuteFunctions, 'call_end', 0)).toBe('call_end');
			expect(validateScheduleStatus(mockExecuteFunctions, 'check_out', 0)).toBe('check_out');
		});

		it('should normalize whitespace and casing for valid status', () => {
			expect(validateScheduleStatus(mockExecuteFunctions, '  CHECK_IN  ', 0)).toBe('check_in');
		});

		it('should throw for non-string status values', () => {
			expect(() =>
				validateScheduleStatus(mockExecuteFunctions, 123 as unknown as string, 0),
			).toThrow('Invalid Schedule Status');
		});
	});

	describe('validateTimezone', () => {
		it('should throw for empty timezone', () => {
			expect(() => validateTimezone(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for too long timezone', () => {
			expect(() => validateTimezone(mockExecuteFunctions, 'a'.repeat(101), 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized timezone for valid input', () => {
			expect(validateTimezone(mockExecuteFunctions, '  America/New_York  ', 0)).toBe(
				'America/New_York',
			);
		});

		it('should throw for invalid IANA timezone values even when the format is valid', () => {
			expect(() => validateTimezone(mockExecuteFunctions, 'Fake/Timezone', 0)).toThrow(
				'Invalid timezone. Provide a valid IANA timezone such as America/New_York, Europe/London, or Asia/Kolkata.',
			);
		});
	});

	describe('validateThreadChatId', () => {
		it('should throw for empty thread chat ID', () => {
			expect(() => validateThreadChatId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for too long thread chat ID', () => {
			expect(() => validateThreadChatId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized thread chat ID for valid input', () => {
			expect(validateThreadChatId(mockExecuteFunctions, '  TH_123  ', 0)).toBe('TH_123');
		});
	});

	describe('validateUserIdArray', () => {
		it('should throw when userIds is neither string nor array', () => {
			expect(() =>
				validateUserIdArray(mockExecuteFunctions, 123 as unknown as string[], 0),
			).toThrow('User IDs must be a string or array');
		});

		it('should parse comma-delimited user id string and remove empty entries', () => {
			expect(validateUserIdArray(mockExecuteFunctions, 'user1,  user2 ,, user3 ', 0)).toEqual([
				'user1',
				'user2',
				'user3',
			]);
		});

		it('should throw for empty array', () => {
			expect(() => validateUserIdArray(mockExecuteFunctions, [], 0)).toThrow(NodeOperationError);
		});

		it('should filter out empty user IDs and succeed if at least one valid', () => {
			expect(validateUserIdArray(mockExecuteFunctions, ['user1', ''], 0)).toEqual(['user1']);
		});

		it('should throw for array with only empty user IDs', () => {
			expect(() => validateUserIdArray(mockExecuteFunctions, ['', '  '], 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw for array with too long user ID', () => {
			expect(() =>
				validateUserIdArray(mockExecuteFunctions, ['user1', 'a'.repeat(256)], 0),
			).toThrow(NodeOperationError);
		});

		it('should return sanitized user ID array for valid input', () => {
			expect(validateUserIdArray(mockExecuteFunctions, ['  user1  ', 'user2'], 0)).toEqual([
				'user1',
				'user2',
			]);
		});
	});

	describe('validateUserId', () => {
		it('should throw for empty user ID', () => {
			expect(() => validateUserId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
		});

		it('should throw for invalid user ID format', () => {
			expect(() => validateUserId(mockExecuteFunctions, 'invalid user!', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return sanitized user ID for valid input', () => {
			expect(validateUserId(mockExecuteFunctions, '  user@example.com  ', 0)).toBe(
				'user@example.com',
			);
		});
	});

	describe('validateThreadStateFilter', () => {
		it('should throw for invalid state', () => {
			expect(() => validateThreadStateFilter(mockExecuteFunctions, 'invalid', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return valid state for valid input', () => {
			expect(validateThreadStateFilter(mockExecuteFunctions, 'followed', 0)).toBe('followed');
			expect(validateThreadStateFilter(mockExecuteFunctions, 'not_followed', 0)).toBe(
				'not_followed',
			);
			expect(validateThreadStateFilter(mockExecuteFunctions, 'all', 0)).toBe('all');
		});
	});

	describe('validateThreadTypeFilter', () => {
		it('should throw for invalid type', () => {
			expect(() => validateThreadTypeFilter(mockExecuteFunctions, 'invalid', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return valid type for valid input', () => {
			expect(validateThreadTypeFilter(mockExecuteFunctions, 'open', 0)).toBe('open');
			expect(validateThreadTypeFilter(mockExecuteFunctions, 'closed', 0)).toBe('closed');
		});
	});

	describe('validateThreadAction', () => {
		it('should throw for invalid action', () => {
			expect(() => validateThreadAction(mockExecuteFunctions, 'invalid', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should return valid action for valid input', () => {
			expect(validateThreadAction(mockExecuteFunctions, 'close', 0)).toBe('close');
			expect(validateThreadAction(mockExecuteFunctions, 'reopen', 0)).toBe('reopen');
		});
	});
});
