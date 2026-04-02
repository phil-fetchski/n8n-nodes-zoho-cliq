import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import {
	ensureSafeObject,
	isDesignationAiErrorModeEnabled,
	parseDelimitedIds,
	parseDesignationPayloadInput,
	parseFlexibleUserIdsInput,
	pushDesignationRecoverableError,
	resolveDesignationEnhancedOutput,
	rethrowDesignationApiError,
	validateDesignationId,
	validateDesignationInputMode,
	validateDesignationPayload,
} from '../../../../../../nodes/ZohoCliq/v1/actions/designation/common';
import {
	runDesignationLookupPreflightGate,
	runDesignationUsersPreflightGate,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

async function validateDesignationExistsIfPossible(
	context: IExecuteFunctions,
	designationId: string,
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	if (!designationId) {
		return;
	}

	await runDesignationLookupPreflightGate(context, itemIndex, grantedScopes, designationId);
}

describe('ZohoCliq - Designation - common helpers', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			enableAiErrorMode?: unknown;
			includeEnhancedOutput?: boolean;
			continueOnFail?: boolean;
			throwOnEnableAiErrorModeLookup?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			enableAiErrorMode = false,
			includeEnhancedOutput = true,
			continueOnFail = false,
			throwOnEnableAiErrorModeLookup = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'enableAiErrorMode') {
						if (throwOnEnableAiErrorModeLookup) {
							throw new Error('lookup failed');
						}
						return enableAiErrorMode;
					}
					if (parameterName === 'includeEnhancedOutput') {
						return includeEnhancedOutput;
					}
					return fallback;
				},
			),
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

	describe('validateDesignationId', () => {
		it('should trim and return valid designation ID', () => {
			expect(validateDesignationId(createContext(), '  designation_123-abc  ', 0)).toBe(
				'designation_123-abc',
			);
		});

		it('should throw for empty designation ID', () => {
			expect(() => validateDesignationId(createContext(), '   ', 0)).toThrow(
				'Designation ID is required',
			);
		});

		it('should throw for overly long designation ID', () => {
			expect(() => validateDesignationId(createContext(), 'a'.repeat(201), 0)).toThrow(
				'Designation ID is too long',
			);
		});

		it('should throw for invalid designation ID format', () => {
			expect(() => validateDesignationId(createContext(), 'designation/id', 0)).toThrow(
				'Designation ID has an invalid format',
			);
		});
	});

	describe('validateDesignationInputMode', () => {
		it('should accept structured and raw input modes', () => {
			expect(validateDesignationInputMode(createContext(), 'structured', 0)).toBe('structured');
			expect(validateDesignationInputMode(createContext(), 'raw', 0)).toBe('raw');
		});

		it('should reject unsupported input modes', () => {
			expect(() => validateDesignationInputMode(createContext(), 'xml', 0)).toThrow(
				'Input Mode must be either "structured" or "raw"',
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined', () => {
			expect(() => ensureSafeObject(createContext(), null, 0, 'payload')).not.toThrow();
			expect(() => ensureSafeObject(createContext(), undefined, 0, 'payload')).not.toThrow();
		});

		it('should reject non-object and array values', () => {
			expect(() => ensureSafeObject(createContext(), 'bad', 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
			expect(() => ensureSafeObject(createContext(), [], 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should reject unsafe nested keys including array objects', () => {
			const parsedUnsafe = JSON.parse('{"__proto__":"blocked"}') as IDataObject;
			expect(() =>
				ensureSafeObject(createContext(), { items: [{ ok: true }, parsedUnsafe] }, 0, 'payload'),
			).toThrow('Unsafe key "__proto__" is not allowed');
		});

		it('should allow safe nested plain objects', () => {
			expect(() =>
				ensureSafeObject(createContext(), { meta: { child: { ok: true } } }, 0, 'payload'),
			).not.toThrow();
		});
	});

	describe('parseDesignationPayloadInput', () => {
		it('should accept object and stringified object payloads', () => {
			expect(
				parseDesignationPayloadInput(
					createContext(),
					{ name: 'Leadership' },
					0,
					'Designation Definition',
				),
			).toEqual({ name: 'Leadership' });
			expect(
				parseDesignationPayloadInput(
					createContext(),
					'{"name":"Leadership"}',
					0,
					'Designation Definition',
				),
			).toEqual({ name: 'Leadership' });
		});

		it('should reject empty, invalid, and array JSON payloads', () => {
			expect(() =>
				parseDesignationPayloadInput(createContext(), '   ', 0, 'Designation Definition'),
			).toThrow('Designation Definition cannot be empty');
			expect(() =>
				parseDesignationPayloadInput(createContext(), null, 0, 'Designation Definition'),
			).toThrow('Designation Definition cannot be empty');
			expect(() =>
				parseDesignationPayloadInput(createContext(), '{bad}', 0, 'Designation Definition'),
			).toThrow('Designation Definition must be a valid JSON object when provided as text');
			expect(() =>
				parseDesignationPayloadInput(createContext(), '[]', 0, 'Designation Definition'),
			).toThrow('Designation Definition must be a JSON object');
		});
	});

	describe('parseDelimitedIds', () => {
		it('should parse and trim comma-delimited IDs', () => {
			expect(parseDelimitedIds(createContext(), ' 123 , 456 ', 0, 'User IDs')).toEqual([
				'123',
				'456',
			]);
		});

		it('should reject invalid input types and empty ID lists', () => {
			expect(() => parseDelimitedIds(createContext(), 1, 0, 'User IDs')).toThrow(
				'User IDs must be a string containing comma-separated IDs',
			);
			expect(() => parseDelimitedIds(createContext(), ' , ', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
		});
	});

	describe('parseFlexibleUserIdsInput', () => {
		it('should accept literal arrays, JSON array strings, and CSV strings', () => {
			expect(parseFlexibleUserIdsInput(createContext(), ['123', '456'], 0, 'User IDs')).toEqual([
				'123',
				'456',
			]);
			expect(parseFlexibleUserIdsInput(createContext(), '["123","456"]', 0, 'User IDs')).toEqual([
				'123',
				'456',
			]);
			expect(parseFlexibleUserIdsInput(createContext(), '123,456', 0, 'User IDs')).toEqual([
				'123',
				'456',
			]);
		});

		it('should reject empty arrays, blank strings, and unsupported input types', () => {
			expect(() => parseFlexibleUserIdsInput(createContext(), [], 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
			expect(() => parseFlexibleUserIdsInput(createContext(), '   ', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
			expect(() => parseFlexibleUserIdsInput(createContext(), 1, 0, 'User IDs')).toThrow(
				'User IDs must be either a JSON array of user IDs or a comma-separated string of user IDs',
			);
		});

		it('should reject invalid JSON array forms', () => {
			expect(() => parseFlexibleUserIdsInput(createContext(), '["123",]', 0, 'User IDs')).toThrow(
				'User IDs must be a valid JSON array when provided in array form',
			);
			const parseSpy = jest.spyOn(JSON, 'parse').mockReturnValueOnce({ id: '123' } as unknown);
			expect(() =>
				parseFlexibleUserIdsInput(createContext(), '[forced-non-array]', 0, 'User IDs'),
			).toThrow('User IDs must be a JSON array of user IDs when provided in array form');
			parseSpy.mockRestore();
			expect(() => parseFlexibleUserIdsInput(createContext(), '[]', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
		});
	});

	describe('validateDesignationPayload', () => {
		it('should normalize valid payloads', () => {
			expect(
				validateDesignationPayload(
					createContext(),
					{ name: ' Leaders ', user_ids: ['123', '456'] },
					0,
					'Designation Definition',
				),
			).toEqual({ name: 'Leaders', user_ids: ['123', '456'] });
		});

		it('should enforce payload constraints', () => {
			expect(() =>
				validateDesignationPayload(createContext(), null as unknown as IDataObject, 0, 'Payload'),
			).toThrow('Payload cannot be empty');
			expect(() => validateDesignationPayload(createContext(), {}, 0, 'Payload')).toThrow(
				'Payload cannot be empty',
			);
			expect(
				validateDesignationPayload(createContext(), {}, 0, 'Payload', { allowEmpty: true }),
			).toEqual({});
			expect(() =>
				validateDesignationPayload(createContext(), {}, 0, 'Payload', {
					requireName: true,
					allowEmpty: true,
				}),
			).toThrow('Designation name is required');
			expect(() =>
				validateDesignationPayload(createContext(), { name: 'x'.repeat(31) }, 0, 'Payload'),
			).toThrow('Designation name is too long');
			expect(() =>
				validateDesignationPayload(
					createContext(),
					{ name: 'Leaders', extra: true },
					0,
					'Payload',
					{ allowedFields: ['name'] },
				),
			).toThrow('unsupported field "extra"');
			expect(() =>
				validateDesignationPayload(
					createContext(),
					{ name: 'Leaders', user_ids: '123' } as unknown as IDataObject,
					0,
					'Payload',
				),
			).toThrow('user_ids must be an array of strings');
			expect(() =>
				validateDesignationPayload(createContext(), { user_ids: [] }, 0, 'Payload'),
			).toThrow('user_ids cannot be empty');
			expect(() =>
				validateDesignationPayload(createContext(), { user_ids: ['bad/id'] }, 0, 'Payload'),
			).toThrow('user_ids[0] has an invalid format');
		});
	});

	describe('validateDesignationExistsIfPossible', () => {
		const recoverableContext = () => createContext({ continueOnFail: true });

		it('should skip designation lookup when read scope is unavailable', async () => {
			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_123',
					0,
					'ZohoCliq.Designations.UPDATE',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should no-op when designation lookup is asked to validate an empty designation ID', async () => {
			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'',
					0,
					'ZohoCliq.Designations.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should accept known designation IDs from the list endpoint', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ id: 'designation_123', name: 'Leaders' }],
			});

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_123',
					0,
					'ZohoCliq.Designations.READ',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/designations',
				{},
				{ limit: 100 },
			);
		});

		it('should accept designation IDs from the response.designations shape too', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				designations: [{ id: 'designation_123', name: 'Leaders' }],
			});

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_123',
					0,
					'ZohoCliq.Designations.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should accept designation IDs from the designation_id field too', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ designation_id: 'designation_123', name: 'Leaders' }],
			});

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_123',
					0,
					'ZohoCliq.Designations.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should accept designation IDs resolved across paginated designation listings', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: [{ id: 'designation_001' }],
					next_token: 'next_designations_page',
				})
				.mockResolvedValueOnce({
					data: [{ id: 'designation_123' }],
				});

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_123',
					0,
					'ZohoCliq.Designations.READ',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/designations',
				{},
				{ limit: 100 },
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/designations',
				{},
				{ limit: 100, next_token: 'next_designations_page' },
			);
		});

		it('should reject unknown designation IDs when the lookup result is exhaustive', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_missing',
					0,
					'ZohoCliq.Designations.READ',
				),
			).rejects.toThrow('No designation found with ID "designation_missing".');
		});

		it('should fail an active designation preflight when the roster lookup fails', async () => {
			mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('lookup failed'));
			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_123',
					0,
					'ZohoCliq.Designations.READ',
				),
			).rejects.toThrow(
				'The designation roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should continue pagination when next_token is nested under data', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: {
						next_token: 'designation_page_2',
					},
				})
				.mockResolvedValueOnce({
					data: [{ id: 'designation_missing' }],
				});

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_missing',
					0,
					'ZohoCliq.Designations.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should fail an active designation preflight when Zoho Cliq repeats next_token', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: [{ id: 'designation_001' }],
					next_token: 'designation_page_2',
				})
				.mockResolvedValueOnce({
					data: [{ id: 'designation_002' }],
					next_token: 'designation_page_2',
				});

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_123',
					0,
					'ZohoCliq.Designations.READ',
				),
			).rejects.toThrow('repeated next_token "designation_page_2"');
		});

		it('should treat responses without designation arrays as exhaustive empty results', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({});

			await expect(
				validateDesignationExistsIfPossible(
					recoverableContext(),
					'designation_missing',
					0,
					'ZohoCliq.Designations.READ',
				),
			).rejects.toThrow('No designation found with ID "designation_missing".');
		});
	});

	describe('runDesignationUsersPreflightGate', () => {
		it('should no-op when designation user identifiers normalize to an empty list', async () => {
			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['', ''],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should no-op when designation user identifiers are provided as a non-array value', async () => {
			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					'not-an-array' as unknown as string[],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should skip user lookup when user-read scope is unavailable', async () => {
			await expect(
				runDesignationUsersPreflightGate(
					createContext(),
					['123'],
					0,
					'ZohoCliq.Designations.UPDATE',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should accept user IDs resolved across paginated user listings', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: [{ id: '123' }],
					next_token: 'next_users_page',
				})
				.mockResolvedValueOnce({
					data: [{ id: '456' }],
				});

			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123', '456'],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();

			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'GET',
				'/api/v2/users',
				{},
				{ limit: 100, fields: 'display_name' },
			);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				2,
				'GET',
				'/api/v2/users',
				{},
				{ limit: 100, fields: 'display_name', next_token: 'next_users_page' },
			);
		});

		it('should accept user IDs resolved from the response.users shape', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				users: [{ user_id: '123' }],
			});

			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123'],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should accept user IDs resolved from the nested data.users shape', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: { users: [{ email_id: 'user@example.com' }] },
			});

			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['user@example.com'],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should reject unresolved user IDs after user-list traversal', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				data: [{ id: '123' }],
			});

			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123', 'bad_user'],
					0,
					'ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The following user ID(s) could not be found: ["bad_user"]. Verify user IDs before updating designation members.',
			);
		});

		it('should throw when the active user lookup fails', async () => {
			mockZohoCliqApiRequest.mockRejectedValueOnce(new Error('lookup failed'));

			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['123'],
					0,
					'ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should throw when no user array is returned during an active preflight', async () => {
			mockZohoCliqApiRequest.mockResolvedValueOnce({});

			await expect(
				runDesignationUsersPreflightGate(
					createContext({ enableAiErrorMode: true }),
					['missing_user'],
					0,
					'ZohoCliq.Users.READ',
				),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});
	});

	describe('isDesignationAiErrorModeEnabled', () => {
		it('should read AI error mode from parameters or node fallback', () => {
			expect(isDesignationAiErrorModeEnabled(createContext({ enableAiErrorMode: 'true' }), 0)).toBe(
				true,
			);
			expect(
				isDesignationAiErrorModeEnabled(
					createContext({
						enableAiErrorMode: 'true',
						throwOnEnableAiErrorModeLookup: true,
					}),
					0,
				),
			).toBe(true);
			expect(isDesignationAiErrorModeEnabled(createContext(), 0)).toBe(false);
			expect(isDesignationAiErrorModeEnabled({} as IExecuteFunctions, 0)).toBe(false);
			expect(
				isDesignationAiErrorModeEnabled(
					{
						getNodeParameter: jest.fn(() => false),
						getNode: jest.fn(() => ({ parameters: [] })),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
			expect(
				isDesignationAiErrorModeEnabled(
					{
						getNodeParameter: jest.fn(() => false),
						getNode: undefined,
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
			expect(
				isDesignationAiErrorModeEnabled(
					{
						getNodeParameter: jest.fn(() => false),
						getNode: jest.fn(() => undefined),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
			expect(
				isDesignationAiErrorModeEnabled(
					{
						getNodeParameter: jest.fn(() => false),
						getNode: jest.fn(() => {
							throw new Error('boom');
						}),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
		});
	});

	describe('pushDesignationRecoverableError', () => {
		it('should return false when recoverable modes are disabled', () => {
			const returnData: INodeExecutionData[] = [];
			expect(
				pushDesignationRecoverableError(createContext(), returnData, 0, 'get', new Error('boom')),
			).toBe(false);
			expect(returnData).toEqual([]);
		});

		it('should preserve scope payloads in recoverable mode', () => {
			const returnData: INodeExecutionData[] = [];
			pushDesignationRecoverableError(
				createContext({ continueOnFail: true }),
				returnData,
				0,
				'get',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						missingScopes: ['ZohoCliq.Designations.READ'],
					},
				},
				{
					contextFields: { designation_id: '1901' },
				},
			);

			expect(returnData[0].json).toEqual({
				success: false,
				missingScopes: ['ZohoCliq.Designations.READ'],
				designation_id: '1901',
			});
		});

		it('should build generic recoverable payloads', () => {
			const returnData: INodeExecutionData[] = [];
			pushDesignationRecoverableError(
				createContext({ continueOnFail: true }),
				returnData,
				0,
				'list',
				{ statusCode: 500, message: 'designation_list_failed' },
				{
					contextFields: { search: 'leaders' },
				},
			);

			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'designation',
					operation: 'list',
					search: 'leaders',
					status_code: 500,
					reason: 'SERVER_ERROR',
				}),
			);
		});

		it('should fall back to generic payloads when scope payload is not an object', () => {
			const returnData: INodeExecutionData[] = [];
			pushDesignationRecoverableError(
				createContext({ continueOnFail: true }),
				returnData,
				0,
				'list',
				{
					zohoCliqScopeErrorPayload: 'bad-payload',
					message: 'designation_list_failed',
				},
			);

			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'designation',
					operation: 'list',
				}),
			);
		});

		it('should handle undefined errors in recoverable mode', () => {
			const returnData: INodeExecutionData[] = [];
			pushDesignationRecoverableError(
				createContext({ continueOnFail: true }),
				returnData,
				0,
				'list',
				undefined,
			);

			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'designation',
					operation: 'list',
				}),
			);
		});

		it('should preserve scope payloads without extra context fields too', () => {
			const returnData: INodeExecutionData[] = [];
			pushDesignationRecoverableError(
				createContext({ continueOnFail: true }),
				returnData,
				0,
				'get',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						missingScopes: ['ZohoCliq.Designations.READ'],
					},
				},
			);

			expect(returnData[0].json).toEqual({
				success: false,
				missingScopes: ['ZohoCliq.Designations.READ'],
			});
		});
	});

	describe('resolveDesignationEnhancedOutput', () => {
		it('should normalize raw responses and expose toggle state', () => {
			expect(resolveDesignationEnhancedOutput(createContext(), 0, ['a']).rawResponse).toEqual({
				data: ['a'],
			});
			expect(
				resolveDesignationEnhancedOutput(
					createContext({ includeEnhancedOutput: false }),
					0,
					undefined,
				).includeEnhancedOutput,
			).toBe(false);
		});
	});

	describe('rethrowDesignationApiError', () => {
		it('should map known designation API errors', () => {
			expect(() =>
				rethrowDesignationApiError(
					createContext(),
					{
						response: {
							data: {
								error_code: 'designation_already_exist',
								message: 'already exists',
							},
						},
					},
					0,
					'Create designation',
				),
			).toThrow('Create designation failed: A designation with this name already exists.');
		});

		it('should map stringified and fallback delete errors', () => {
			expect(() =>
				rethrowDesignationApiError(
					createContext(),
					'{"response":{"data":{"error_code":"department_delete_failed"}}}',
					0,
					'Delete designation',
				),
			).toThrow(
				'Delete designation failed: Zoho Cliq failed to delete the designation due to an internal error.',
			);
		});

		it('should map nested body/error variants and rethrow non-object JSON strings', () => {
			expect(() =>
				rethrowDesignationApiError(
					createContext(),
					{
						response: {
							body: {
								data: { code: 'designation_create_failed' },
								error: {
									error_code: 'designation_create_failed',
									message: 'edit failed',
								},
							},
						},
					},
					0,
					'Update designation',
				),
			).toThrow(
				'Update designation failed: Zoho Cliq failed to create the designation due to an internal error.',
			);
			expect(() => rethrowDesignationApiError(createContext(), '[]', 0, 'Get designation')).toThrow(
				'[]',
			);
			expect(() =>
				rethrowDesignationApiError(
					createContext(),
					{
						response: {
							data: {
								data: {
									error_code: 'designation_create_failed',
									description: 'nested description',
								},
							},
						},
					},
					0,
					'Create designation',
				),
			).toThrow(
				'Create designation failed: Zoho Cliq failed to create the designation due to an internal error.',
			);
			expect(() =>
				rethrowDesignationApiError(
					createContext(),
					{
						error: {
							code: 'designation_edit_failed',
							description: 'root error description',
						},
					},
					0,
					'Update designation',
				),
			).toThrow(
				'Update designation failed: Zoho Cliq failed to update the designation due to an internal error.',
			);
		});

		it('should rethrow unknown errors unchanged', () => {
			expect(() =>
				rethrowDesignationApiError(createContext(), 'plain-text-error', 0, 'Get designation', {
					designationId: 'designation_missing',
				}),
			).toThrow('plain-text-error');
			expect(() =>
				rethrowDesignationApiError(
					createContext(),
					{
						response: {
							status: 400,
						},
						message: 'Request failed with status code 400',
					},
					0,
					'Get designation',
					{ designationId: 'designation_missing' },
				),
			).toThrow('Request failed with status code 400');
			expect(() =>
				rethrowDesignationApiError(
					createContext(),
					{
						response: {
							status: 500,
						},
						message: 'Request failed with status code 500',
					},
					0,
					'Get designation',
					{ designationId: 'designation_missing' },
				),
			).toThrow('Request failed with status code 500');
			expect(() =>
				rethrowDesignationApiError(createContext(), new Error('boom'), 0, 'Get designation'),
			).toThrow('boom');
			expect(() =>
				rethrowDesignationApiError(createContext(), 'plain-text-error', 0, 'Get designation'),
			).toThrow('plain-text-error');
			expect(() =>
				rethrowDesignationApiError(createContext(), '{bad}', 0, 'Get designation'),
			).toThrow('{bad}');
		});
	});
});
