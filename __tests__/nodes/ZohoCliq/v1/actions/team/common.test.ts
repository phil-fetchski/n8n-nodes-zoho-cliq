import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	ensureSafeObject,
	isTeamAiErrorModeEnabled,
	parseDelimitedIds,
	parseTeamPayloadInput,
	pushTeamRecoverableError,
	resolveTeamEnhancedOutput,
	TEAM_NOT_FOUND_MESSAGE,
	USER_IDS_NOT_FOUND_MESSAGE,
	validateTeamId,
	validateTeamInputMode,
	validateTeamPayload,
	validateZohoEntityId,
} from '../../../../../../nodes/ZohoCliq/v1/actions/team/common';
import {
	normalizeTeamLookupNotFoundError,
	runTeamLookupPreflightGate,
	runTeamUsersPreflightGate,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight';
import { copyLookupErrorMetadata } from '../../../../../../nodes/ZohoCliq/v1/actions/shared/preflight/utils';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

async function preflightTeamLookupIfPossible(
	context: IExecuteFunctions,
	teamId: string,
	itemIndex: number,
	grantedScopes: string,
): Promise<IDataObject | undefined> {
	if (!teamId) {
		return undefined;
	}

	const result = await runTeamLookupPreflightGate(context, itemIndex, grantedScopes, teamId);
	return result.status === 'validated' ? result.entity : undefined;
}

describe('ZohoCliq - Team - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
		mockZohoCliqApiRequest.mockReset();
	});

	describe('validateTeamId', () => {
		it('should trim and return valid team ID', () => {
			const result = validateTeamId(mockExecuteFunctions, '  team_123-abc  ', 0);
			expect(result).toBe('team_123-abc');
		});

		it('should throw for empty team ID', () => {
			expect(() => validateTeamId(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateTeamId(mockExecuteFunctions, '   ', 0)).toThrow('Team ID is required');
		});

		it('should throw for invalid team ID format', () => {
			expect(() => validateTeamId(mockExecuteFunctions, 'team/id', 0)).toThrow(
				'Invalid Team ID format',
			);
		});

		it('should throw for team ID longer than 200 chars', () => {
			expect(() => validateTeamId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Maximum length is 200 characters',
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, null, 0, 'payload')).not.toThrow();
			expect(() => ensureSafeObject(mockExecuteFunctions, undefined, 0, 'payload')).not.toThrow();
		});

		it('should throw when value is not object', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, 'bad', 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when value is an array', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, [], 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should throw when unsafe top-level key is present', () => {
			const payload = { constructor: 'bad' } as unknown as IDataObject;
			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "constructor" is not allowed',
			);
		});

		it('should throw when unsafe nested key is present', () => {
			const payload = {
				config: {
					prototype: 'bad',
				},
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "prototype" is not allowed',
			);
		});

		it('should throw when unsafe nested array object key is present', () => {
			const parsedUnsafe = JSON.parse('{"__proto__":"blocked"}') as IDataObject;
			const payload = { items: [{ ok: true }, parsedUnsafe] } as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "__proto__" is not allowed',
			);
		});

		it('should allow safe nested structures', () => {
			const payload = {
				name: 'Engineering',
				meta: { region: 'US', tags: [{ key: 'core' }] },
			} as unknown as IDataObject;

			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).not.toThrow();
		});
	});

	describe('validateTeamPayload', () => {
		it('should return normalized payload', () => {
			const payload: IDataObject = {
				name: '  Engineering  ',
				description: '  Platform team  ',
			};

			const result = validateTeamPayload(mockExecuteFunctions, payload, 0, 'Team Definition');

			expect(result).toEqual({
				name: 'Engineering',
				description: 'Platform team',
			});
		});

		it('should throw for null payload', () => {
			expect(() =>
				validateTeamPayload(
					mockExecuteFunctions,
					null as unknown as IDataObject,
					0,
					'Team Definition',
				),
			).toThrow('Team Definition cannot be empty');
		});

		it('should throw for empty payload when allowEmpty is false', () => {
			expect(() => validateTeamPayload(mockExecuteFunctions, {}, 0, 'Team Updates')).toThrow(
				'Team Updates cannot be empty',
			);
		});

		it('should allow empty payload when allowEmpty is true', () => {
			const result = validateTeamPayload(mockExecuteFunctions, {}, 0, 'Team Updates', {
				allowEmpty: true,
			});
			expect(result).toEqual({});
		});

		it('should require name when requireName is true', () => {
			expect(() =>
				validateTeamPayload(mockExecuteFunctions, { name: '   ' }, 0, 'Team Definition', {
					requireName: true,
				}),
			).toThrow('Team name is required');
		});

		it('should require name when requireName is true and name field is missing', () => {
			expect(() =>
				validateTeamPayload(
					mockExecuteFunctions,
					{ description: 'Only description' },
					0,
					'Team Definition',
					{
						requireName: true,
					},
				),
			).toThrow('Team name is required');
		});

		it('should throw when name exceeds max length', () => {
			expect(() =>
				validateTeamPayload(
					mockExecuteFunctions,
					{ name: 'a'.repeat(31) } as IDataObject,
					0,
					'Team Definition',
				),
			).toThrow('Team name is too long. Maximum length is 30 characters.');
		});

		it('should drop empty description', () => {
			const result = validateTeamPayload(
				mockExecuteFunctions,
				{ name: 'Engineering', description: '   ' } as IDataObject,
				0,
				'Team Definition',
			);

			expect(result).toEqual({ name: 'Engineering' });
		});

		it('should throw when description exceeds max length', () => {
			expect(() =>
				validateTeamPayload(
					mockExecuteFunctions,
					{ description: 'a'.repeat(1001) } as IDataObject,
					0,
					'Team Updates',
				),
			).toThrow('Description is too long. Maximum length is 1000 characters.');
		});

		it('should throw for unsupported fields when allowlist is provided', () => {
			expect(() =>
				validateTeamPayload(
					mockExecuteFunctions,
					{ joined: true } as IDataObject,
					0,
					'Team Updates',
					{ allowedFields: ['name', 'description'] },
				),
			).toThrow('Team Updates contains unsupported field "joined"');
		});

		it('should allow payload fields that are included in the allowlist', () => {
			const payload = { name: 'Engineering', description: 'Core platform team' } as IDataObject;

			const result = validateTeamPayload(mockExecuteFunctions, payload, 0, 'Team Updates', {
				allowedFields: ['name', 'description'],
			});

			expect(result).toEqual({
				name: 'Engineering',
				description: 'Core platform team',
			});
		});

		it('should validate user_ids arrays', () => {
			const payload: IDataObject = {
				name: 'Engineering',
				user_ids: ['12345', '67890'],
			};

			const result = validateTeamPayload(mockExecuteFunctions, payload, 0, 'Team Definition');
			expect(result.user_ids).toEqual(['12345', '67890']);
		});
	});

	describe('parseTeamPayloadInput', () => {
		it('should throw for null payload input', () => {
			expect(() => parseTeamPayloadInput(mockExecuteFunctions, null, 0, 'Team Definition')).toThrow(
				'Team Definition cannot be empty',
			);
		});

		it('should throw for whitespace-only string payload', () => {
			expect(() =>
				parseTeamPayloadInput(mockExecuteFunctions, '   ', 0, 'Team Definition'),
			).toThrow('Team Definition cannot be empty');
		});

		it('should parse valid JSON string payload', () => {
			const result = parseTeamPayloadInput(
				mockExecuteFunctions,
				'{"name":"Engineering"}',
				0,
				'Team Definition',
			);

			expect(result).toEqual({ name: 'Engineering' });
		});

		it('should throw for invalid JSON string payload', () => {
			expect(() =>
				parseTeamPayloadInput(mockExecuteFunctions, '{invalid', 0, 'Team Definition'),
			).toThrow('Team Definition must be a valid JSON object when provided as text');
		});

		it('should throw when JSON string parses to null', () => {
			expect(() =>
				parseTeamPayloadInput(mockExecuteFunctions, 'null', 0, 'Team Definition'),
			).toThrow('Team Definition must be a JSON object');
		});

		it('should throw when non-string top-level value is not an object', () => {
			expect(() => parseTeamPayloadInput(mockExecuteFunctions, 123, 0, 'Team Definition')).toThrow(
				'Team Definition must be a JSON object',
			);
		});

		it('should accept a safe object payload without reparsing it', () => {
			const payload = { name: 'Engineering', description: 'Core platform team' } as IDataObject;

			const result = parseTeamPayloadInput(mockExecuteFunctions, payload, 0, 'Team Definition');

			expect(result).toBe(payload);
		});
	});

	describe('parseDelimitedIds', () => {
		it('should parse comma-separated IDs', () => {
			expect(parseDelimitedIds(mockExecuteFunctions, '1, 2,3', 0, 'User IDs')).toEqual([
				'1',
				'2',
				'3',
			]);
		});

		it('should throw when input is not a string', () => {
			expect(() => parseDelimitedIds(mockExecuteFunctions, 12345, 0, 'User IDs')).toThrow(
				'User IDs must be a string containing comma-separated IDs',
			);
		});

		it('should throw when parsed IDs are empty', () => {
			expect(() => parseDelimitedIds(mockExecuteFunctions, ' ,  , ', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
		});
	});

	describe('resolveTeamEnhancedOutput', () => {
		it('should default Include Enhanced Output to true and preserve object responses', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex?: number, fallback?: unknown) => fallback,
				),
			} as unknown as IExecuteFunctions;

			const result = resolveTeamEnhancedOutput(mockExecuteFunctions, 0, { status: 'ok' });

			expect(result).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { status: 'ok' },
				responseJson: { status: 'ok' },
			});
		});

		it('should coerce primitive responses and honor disabled enhanced output', () => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'includeEnhancedOutput') return false;
					return undefined;
				}),
			} as unknown as IExecuteFunctions;

			const result = resolveTeamEnhancedOutput(mockExecuteFunctions, 0, '');

			expect(result).toEqual({
				includeEnhancedOutput: false,
				rawResponse: { data: '' },
				responseJson: { data: '' },
			});
		});
	});

	describe('validateTeamInputMode', () => {
		it('should accept structured and raw modes', () => {
			expect(validateTeamInputMode(mockExecuteFunctions, 'structured', 0)).toBe('structured');
			expect(validateTeamInputMode(mockExecuteFunctions, 'raw', 0)).toBe('raw');
		});

		it('should reject unsupported input modes', () => {
			expect(() => validateTeamInputMode(mockExecuteFunctions, 'xml', 0)).toThrow(
				'Input Mode must be either "structured" or "raw"',
			);
		});
	});

	describe('validateZohoEntityId', () => {
		it('should validate valid identifier', () => {
			expect(validateZohoEntityId(mockExecuteFunctions, '44344926', 0, 'user_ids[0]')).toBe(
				'44344926',
			);
		});

		it('should throw for empty identifier', () => {
			expect(() => validateZohoEntityId(mockExecuteFunctions, '   ', 0, 'user_ids[0]')).toThrow(
				'user_ids[0] must be a non-empty string',
			);
		});

		it('should throw for too-long identifier', () => {
			expect(() =>
				validateZohoEntityId(mockExecuteFunctions, 'a'.repeat(201), 0, 'user_ids[0]'),
			).toThrow('user_ids[0] is too long');
		});

		it('should throw for invalid identifier format', () => {
			expect(() => validateZohoEntityId(mockExecuteFunctions, 'bad/id', 0, 'user_ids[0]')).toThrow(
				'user_ids[0] has an invalid format. Use only letters, numbers, hyphens, and underscores.',
			);
		});
	});

	describe('pushTeamRecoverableError', () => {
		it('should merge context fields into a recoverable scope payload', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex?: number, fallback?: unknown) => fallback,
				),
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;

			const handled = pushTeamRecoverableError(
				mockExecuteFunctions,
				returnData,
				0,
				'delete',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						resource: 'team',
						operation: 'delete',
					},
				},
				{
					contextFields: {
						team_id: 'team_123',
					},
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual({
				success: false,
				resource: 'team',
				operation: 'delete',
				team_id: 'team_123',
			});
		});

		it('should preserve a recoverable scope payload when no extra context fields are supplied', () => {
			const returnData: INodeExecutionData[] = [];
			mockExecuteFunctions = {
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex?: number, fallback?: unknown) => fallback,
				),
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			} as unknown as IExecuteFunctions;

			const handled = pushTeamRecoverableError(mockExecuteFunctions, returnData, 0, 'delete', {
				zohoCliqScopeErrorPayload: {
					success: false,
					resource: 'team',
					operation: 'delete',
				},
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual({
				success: false,
				resource: 'team',
				operation: 'delete',
			});
		});
	});

	describe('validateTeamPayload user_ids validation', () => {
		it('should throw when user_ids is not an array', () => {
			expect(() =>
				validateTeamPayload(
					mockExecuteFunctions,
					{ name: 'Engineering', user_ids: '123' as unknown as string[] } as IDataObject,
					0,
					'Team Definition',
				),
			).toThrow('user_ids must be an array of strings');
		});

		it('should throw when user_ids is an empty array', () => {
			expect(() =>
				validateTeamPayload(
					mockExecuteFunctions,
					{ name: 'Engineering', user_ids: [] } as IDataObject,
					0,
					'Team Definition',
				),
			).toThrow('user_ids cannot be empty');
		});
	});

	describe('AI Error Mode + recoverable errors', () => {
		const createRecoverableContext = (
			values: {
				enableAiErrorMode?: unknown;
				continueOnFail?: boolean;
			} = {},
		): IExecuteFunctions => {
			const { enableAiErrorMode = false, continueOnFail = false } = values;

			return {
				getNodeParameter: jest.fn(
					(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
						if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
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

		it('should detect AI Error Mode from node parameter or persisted node settings', () => {
			expect(
				isTeamAiErrorModeEnabled(createRecoverableContext({ enableAiErrorMode: 'true' }), 0),
			).toBe(true);
			expect(
				isTeamAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNodeParameter: jest.fn(() => {
							throw new Error('not available');
						}),
						getNode: jest.fn(() => ({
							name: 'Test Node',
							type: 'n8n-nodes-base.zohoCliq',
							parameters: { enableAiErrorMode: 'true' },
						})),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(true);
			expect(isTeamAiErrorModeEnabled(createRecoverableContext(), 0)).toBe(false);
		});

		it('should return false when getNode is unavailable, invalid, or throws', () => {
			expect(
				isTeamAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNode: jest.fn(() => undefined),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);

			expect(
				isTeamAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNode: undefined,
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);

			expect(
				isTeamAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNode: jest.fn(() => ({
							name: 'Test Node',
							type: 'n8n-nodes-base.zohoCliq',
							parameters: [],
						})),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);

			expect(
				isTeamAiErrorModeEnabled(
					{
						...createRecoverableContext(),
						getNode: jest.fn(() => {
							throw new Error('boom');
						}),
					} as unknown as IExecuteFunctions,
					0,
				),
			).toBe(false);
		});

		it('should return false without continueOnFail or AI Error Mode', () => {
			const context = createRecoverableContext();
			const returnData: INodeExecutionData[] = [];

			expect(pushTeamRecoverableError(context, returnData, 0, 'get', new Error('boom'))).toBe(
				false,
			);
			expect(returnData).toEqual([]);
		});

		it('should preserve scope payloads and merge context fields', () => {
			const context = createRecoverableContext({ enableAiErrorMode: 'true' });
			const returnData: INodeExecutionData[] = [];

			const handled = pushTeamRecoverableError(
				context,
				returnData,
				0,
				'get',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						resource: 'team',
						operation: 'get',
						requiredScopes: ['ZohoCliq.Teams.READ'],
						missingScopes: ['ZohoCliq.Teams.READ'],
					},
				},
				{
					contextFields: { team_id: '53797404' },
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'team',
					operation: 'get',
					requiredScopes: ['ZohoCliq.Teams.READ'],
					missingScopes: ['ZohoCliq.Teams.READ'],
					team_id: '53797404',
				}),
			);
		});

		it('should build a recoverable error payload when continueOnFail is enabled', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			const handled = pushTeamRecoverableError(
				context,
				returnData,
				0,
				'update',
				{ statusCode: 404, message: 'Not Found' },
				{
					contextFields: { team_id: '53797404' },
				},
			);

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'team',
					operation: 'update',
					team_id: '53797404',
					status_code: 404,
					reason: 'NOT_FOUND',
				}),
			);
		});

		it('should ignore non-object scope payloads and fall back to generic recoverable errors', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			const handled = pushTeamRecoverableError(context, returnData, 0, 'list', {
				zohoCliqScopeErrorPayload: 'bad-scope-payload',
				statusCode: 400,
				message: 'Bad Request',
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'team',
					operation: 'list',
					status_code: 400,
					reason: 'BAD_REQUEST',
				}),
			);
		});

		it('should ignore array scope payloads and fall back to generic recoverable errors', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			const handled = pushTeamRecoverableError(context, returnData, 0, 'list', {
				zohoCliqScopeErrorPayload: ['bad-scope-payload'],
				statusCode: 400,
				message: 'Bad Request',
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'team',
					operation: 'list',
					status_code: 400,
					reason: 'BAD_REQUEST',
				}),
			);
		});

		it('should build a generic recoverable payload when the error is undefined', () => {
			const context = createRecoverableContext({ continueOnFail: true });
			const returnData: INodeExecutionData[] = [];

			const handled = pushTeamRecoverableError(context, returnData, 0, 'list', undefined, {
				fallbackMessage: 'Fallback team error',
			});

			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'team',
					operation: 'list',
					message: 'Fallback team error',
				}),
			);
		});
	});

	describe('preflightTeamLookupIfPossible', () => {
		beforeEach(() => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ name: 'Test Node', parameters: { enableAiErrorMode: false } })),
			} as unknown as IExecuteFunctions;
		});

		it('should skip team lookup when read scope is not granted', async () => {
			const result = await preflightTeamLookupIfPossible(
				mockExecuteFunctions,
				'team_123',
				0,
				'ZohoCliq.Teams.UPDATE',
			);

			expect(result).toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return the fetched team object when read scope is granted', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({ team_id: 'team_123', name: 'Engineering' });

			const result = await preflightTeamLookupIfPossible(
				mockExecuteFunctions,
				'team_123',
				0,
				'ZohoCliq.Teams.READ',
			);

			expect(result).toEqual({ team_id: 'team_123', name: 'Engineering' });
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/teams/team_123');
		});

		it('should no-op when team lookup is asked to validate an empty team ID', async () => {
			const result = await preflightTeamLookupIfPossible(
				mockExecuteFunctions,
				'',
				0,
				'ZohoCliq.Teams.READ',
			);

			expect(result).toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should throw a guided not-found error when the team lookup returns 404', async () => {
			mockZohoCliqApiRequest.mockRejectedValue({
				statusCode: 404,
				message: 'team_not_exist',
			});

			let thrownError: unknown;
			try {
				await preflightTeamLookupIfPossible(
					mockExecuteFunctions,
					'team_404',
					0,
					'ZohoCliq.Teams.ALL',
				);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toMatchObject({
				code: 'TEAM_NOT_FOUND',
				message: TEAM_NOT_FOUND_MESSAGE,
			});
		});

		it('should detect a not-found team from response message text and preserve the original response object', async () => {
			const response = {
				status: 400,
				data: { message: 'No team found for the given ID' },
			};
			mockZohoCliqApiRequest.mockRejectedValue({
				response,
			});

			let thrownError: unknown;
			try {
				await preflightTeamLookupIfPossible(
					mockExecuteFunctions,
					'team_missing',
					0,
					'ZohoCliq.Teams.READ',
				);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toMatchObject({
				code: 'TEAM_NOT_FOUND',
				message: TEAM_NOT_FOUND_MESSAGE,
			});
		});

		it('should classify a generic 400 team lookup failure as not found', async () => {
			mockZohoCliqApiRequest.mockRejectedValue({
				statusCode: 400,
				message: 'Request failed with status code 400',
			});

			let thrownError: unknown;
			try {
				await preflightTeamLookupIfPossible(
					mockExecuteFunctions,
					'team_missing',
					0,
					'ZohoCliq.Teams.READ',
				);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toMatchObject({
				code: 'TEAM_NOT_FOUND',
				message: TEAM_NOT_FOUND_MESSAGE,
			});
		});

		it('should detect not-found teams from a does-not-exist response body message', async () => {
			mockZohoCliqApiRequest.mockRejectedValue({
				response: {
					status: 400,
					body: { message: 'This team does not exist' },
				},
			});

			await expect(
				preflightTeamLookupIfPossible(
					mockExecuteFunctions,
					'team_missing',
					0,
					'ZohoCliq.Teams.ALL',
				),
			).rejects.toThrow(TEAM_NOT_FOUND_MESSAGE);
		});

		it.each([
			[
				'response.message',
				{
					response: {
						message: 'This team does not exist',
					},
				},
			],
			[
				'response.error',
				{
					response: {
						error: 'team_not_exist',
					},
				},
			],
			[
				'response.description',
				{
					response: {
						description: 'No team found for the given ID',
					},
				},
			],
			[
				'response.body.error',
				{
					response: {
						body: {
							error: 'team_not_exist',
						},
					},
				},
			],
			[
				'response.body.description',
				{
					response: {
						body: {
							description: 'This team does not exist',
						},
					},
				},
			],
			[
				'response.data.error',
				{
					response: {
						data: {
							error: 'team_not_exist',
						},
					},
				},
			],
			[
				'response.data.description',
				{
					response: {
						data: {
							description: 'No team found for the given ID',
						},
					},
				},
			],
		])('should detect not-found teams from %s', async (_label, lookupError) => {
			mockZohoCliqApiRequest.mockRejectedValue(lookupError);

			await expect(
				preflightTeamLookupIfPossible(
					mockExecuteFunctions,
					'team_missing',
					0,
					'ZohoCliq.Teams.ALL',
				),
			).rejects.toThrow(TEAM_NOT_FOUND_MESSAGE);
		});

		it('should fail an active team preflight when the direct lookup errors inconclusively', async () => {
			mockZohoCliqApiRequest.mockRejectedValue(new Error('temporary lookup failure'));

			await expect(
				preflightTeamLookupIfPossible(mockExecuteFunctions, 'team_123', 0, 'ZohoCliq.Teams.READ'),
			).rejects.toThrow('temporary lookup failure');
		});

		it('should surface primitive direct lookup failures during an active team preflight', async () => {
			mockZohoCliqApiRequest.mockRejectedValue('temporary lookup failure');

			await expect(
				preflightTeamLookupIfPossible(mockExecuteFunctions, 'team_123', 0, 'ZohoCliq.Teams.READ'),
			).rejects.toBe('temporary lookup failure');
		});

		it('should detect not-found teams from a root-level message string', async () => {
			mockZohoCliqApiRequest.mockRejectedValue({
				message: 'Team not found',
			});

			await expect(
				preflightTeamLookupIfPossible(
					mockExecuteFunctions,
					'team_missing',
					0,
					'ZohoCliq.Teams.ALL',
				),
			).rejects.toThrow(TEAM_NOT_FOUND_MESSAGE);
		});

		it('should detect not-found teams from a root-level error string', async () => {
			mockZohoCliqApiRequest.mockRejectedValue({
				error: 'team_not_exist',
				httpCode: 404,
			});

			let thrownError: unknown;
			try {
				await preflightTeamLookupIfPossible(
					mockExecuteFunctions,
					'team_missing',
					0,
					'ZohoCliq.Teams.ALL',
				);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toMatchObject({
				code: 'TEAM_NOT_FOUND',
				message: TEAM_NOT_FOUND_MESSAGE,
			});
		});
	});

	describe('normalizeTeamLookupNotFoundError', () => {
		it('should convert a generic 400 lookup failure into a team-not-found NodeOperationError', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				{
					statusCode: 400,
					message: 'Request failed with status code 400',
				},
				0,
			);

			expect(result).toBeInstanceOf(NodeOperationError);
			expect(result?.message).toBe(TEAM_NOT_FOUND_MESSAGE);
			expect((result as NodeOperationError & { statusCode?: unknown }).statusCode).toBe(400);
		});

		it('should return undefined for non-not-found lookup failures', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				new Error('temporary lookup failure'),
				0,
			);

			expect(result).toBeUndefined();
		});

		it('should return undefined when lookup metadata has no string fragments to classify', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				{
					response: {
						message: { nested: true },
						error: ['team_not_exist'],
					},
				},
				0,
			);

			expect(result).toBeUndefined();
		});

		it('should return undefined when the lookup error is primitive or missing', () => {
			expect(normalizeTeamLookupNotFoundError(mockExecuteFunctions, undefined, 0)).toBeUndefined();
			expect(
				normalizeTeamLookupNotFoundError(
					mockExecuteFunctions,
					'team lookup failed' as unknown as Error,
					0,
				),
			).toBeUndefined();
		});

		it('should safely normalize not-found lookup errors without response metadata', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				{
					message: 'team not found',
				},
				0,
			);

			expect(result).toBeInstanceOf(NodeOperationError);
			expect(result?.message).toBe(TEAM_NOT_FOUND_MESSAGE);
		});

		it('should classify not-found team lookups from nested response status and body fields', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				{
					httpCode: 'not-a-status-code',
					response: {
						statusCode: 404,
						body: {
							message: 'No team found for the given ID',
						},
						data: {
							error: 'team_not_exist',
							description: 'This team does not exist',
						},
					},
				},
				0,
			);

			expect(result).toBeInstanceOf(NodeOperationError);
			expect(result?.message).toBe(TEAM_NOT_FOUND_MESSAGE);
		});

		it('should classify not-found team lookups from nested response body and data messages without status codes', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				{
					response: {
						body: {
							message: 'No team found for this lookup',
						},
						data: {
							description: 'The requested team does not exist',
						},
					},
				},
				0,
			);

			expect(result).toBeInstanceOf(NodeOperationError);
			expect(result?.message).toBe(TEAM_NOT_FOUND_MESSAGE);
		});

		it('should classify not-found team lookups from response-level message fields without body or data', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				{
					response: {
						message: 'Team not found for the supplied identifier',
					},
				},
				0,
			);

			expect(result).toBeInstanceOf(NodeOperationError);
			expect(result?.message).toBe(TEAM_NOT_FOUND_MESSAGE);
		});

		it('should preserve raw response metadata and root httpCode when normalizing not-found lookup errors', () => {
			const result = normalizeTeamLookupNotFoundError(
				mockExecuteFunctions,
				{
					httpCode: 404,
					message: 'team_not_exist',
					response: 'raw-team-response',
				},
				0,
			) as NodeOperationError & { statusCode?: number; response?: unknown };

			expect(result).toBeInstanceOf(NodeOperationError);
			expect(result.message).toBe(TEAM_NOT_FOUND_MESSAGE);
			expect(result.statusCode).toBe(404);
			expect(result.response).toBe('raw-team-response');
		});
	});

	describe('copyLookupErrorMetadata', () => {
		it('should safely ignore malformed non-object lookup sources', () => {
			const target = new NodeOperationError(mockExecuteFunctions.getNode(), 'target', {
				itemIndex: 0,
			}) as NodeOperationError & { statusCode?: number; response?: unknown };

			expect(() => copyLookupErrorMetadata(target, undefined)).not.toThrow();
			expect(target.statusCode).toBeUndefined();
			expect(target.response).toBeUndefined();
		});

		it('should copy root httpCode and raw response metadata when available', () => {
			const target = new NodeOperationError(mockExecuteFunctions.getNode(), 'target', {
				itemIndex: 0,
			}) as NodeOperationError & { statusCode?: number; response?: unknown };

			copyLookupErrorMetadata(target, {
				httpCode: 404,
				response: 'raw-team-response',
			});

			expect(target.statusCode).toBe(404);
			expect(target.response).toBe('raw-team-response');
		});

		it('should copy root statusCode metadata when no response payload is present', () => {
			const target = new NodeOperationError(mockExecuteFunctions.getNode(), 'target', {
				itemIndex: 0,
			}) as NodeOperationError & { statusCode?: number; response?: unknown };

			copyLookupErrorMetadata(target, {
				statusCode: 400,
			});

			expect(target.statusCode).toBe(400);
			expect(target.response).toBeUndefined();
		});
	});

	describe('runTeamUsersPreflightGate', () => {
		beforeEach(() => {
			mockExecuteFunctions = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					if (name === 'enableAiErrorMode') {
						return true;
					}
					return undefined;
				}),
			} as unknown as IExecuteFunctions;
		});

		it('should no-op when team user identifiers normalize to an empty list', async () => {
			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['', ''], 0, 'ZohoCliq.Users.READ'),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should no-op when team user identifiers are provided as a non-array value', async () => {
			await expect(
				runTeamUsersPreflightGate(
					mockExecuteFunctions,
					'not-an-array' as unknown as string[],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should skip user validation when user-read scope is not granted', async () => {
			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['44344926'], 0, 'ZohoCliq.Teams.CREATE'),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should resolve when every requested user ID exists', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				users: [
					{ user_id: '44344926', display_name: 'Olivia Palmer' },
					{ user_id: '54667722', display_name: 'Quinn Rivers' },
				],
			});

			await expect(
				runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['44344926', '54667722'],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/users',
				{},
				{
					limit: 100,
					fields: 'display_name',
				},
			);
		});

		it('should throw a guided error when one or more user IDs are missing', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
				has_more: false,
			});

			let thrownError: unknown;
			try {
				await runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['44344926', '54667722'],
					0,
					'ZohoCliq.Users.ALL',
				);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toContain(USER_IDS_NOT_FOUND_MESSAGE);
		});

		it('should resolve missing active users via an inactive-user fallback when enabled', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					has_more: false,
				})
				.mockResolvedValueOnce({
					users: [{ user_id: 'inactive_54667722', display_name: 'Former User' }],
					has_more: false,
				});

			await expect(
				runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['44344926', 'inactive_54667722'],
					0,
					'ZohoCliq.Users.ALL',
					{ includeInactiveUsers: true },
				),
			).resolves.toBeUndefined();
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
					status: 'inactive',
				},
			);
		});

		it('should throw after checking both active and inactive users when fallback is enabled', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					has_more: false,
				})
				.mockResolvedValueOnce({
					users: [{ user_id: 'inactive_111', display_name: 'Former User' }],
					has_more: false,
				});

			let thrownError: unknown;
			try {
				await runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['44344926', '54667722'],
					0,
					'ZohoCliq.Users.ALL',
					{ includeInactiveUsers: true },
				);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toContain(USER_IDS_NOT_FOUND_MESSAGE);
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

		it('should throw when the inactive-user fallback becomes non-exhaustive', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					has_more: false,
				})
				.mockResolvedValueOnce({
					users: [{ user_id: 'inactive_111', display_name: 'Former User' }],
					has_more: true,
				});

			await expect(
				runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['44344926', '54667722'],
					0,
					'ZohoCliq.Users.ALL',
					{ includeInactiveUsers: true },
				),
			).rejects.toThrow('reported more results without returning a next_token');
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

		it('should accept user lists returned under response.data as an array', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				data: [
					{ user_id: '44344926', display_name: 'Olivia Palmer' },
					{ user_id: '54667722', display_name: 'Quinn Rivers' },
				],
			});

			await expect(
				runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['44344926', '54667722'],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should accept user lists returned under response.data.users', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				data: {
					users: [
						{ id: '44344926', display_name: 'Olivia Palmer' },
						{ zuid: '54667722', display_name: 'Quinn Rivers' },
					],
				},
			});

			await expect(
				runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['44344926', '54667722'],
					0,
					'ZohoCliq.Users.READ',
				),
			).resolves.toBeUndefined();
		});

		it('should throw when the user lookup response is not an object during an active preflight', async () => {
			mockZohoCliqApiRequest.mockResolvedValue('not-an-object' as unknown as IDataObject);

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['44344926'], 0, 'ZohoCliq.Users.READ'),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should throw when the user lookup response has no users collection during an active preflight', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				data: { next_token: 'abc123' },
			});

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['44344926'], 0, 'ZohoCliq.Users.READ'),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});

		it('should throw when pagination repeats the same next_token during an active preflight', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					users: Array.from({ length: 100 }, (_, index) => ({
						user_id: `${index + 1}`,
						display_name: `User ${index + 1}`,
					})),
					next_token: 'dup-token',
				})
				.mockResolvedValueOnce({
					users: [],
					next_token: 'dup-token',
				});

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['missing-user'], 0, 'ZohoCliq.Users.ALL'),
			).rejects.toThrow('repeated next_token "dup-token"');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
			expect(mockZohoCliqApiRequest).toHaveBeenLastCalledWith(
				'GET',
				'/api/v2/users',
				{},
				{
					limit: 100,
					fields: 'display_name',
					next_token: 'dup-token',
				},
			);
		});

		it('should follow a camelCase nextToken field across pages', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					nextToken: 'page-2',
				})
				.mockResolvedValueOnce({
					users: [{ user_id: '54667722', display_name: 'Quinn Rivers' }],
					hasMore: false,
				});

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['54667722'], 0, 'ZohoCliq.Users.ALL'),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).toHaveBeenLastCalledWith(
				'GET',
				'/api/v2/users',
				{},
				{
					limit: 100,
					fields: 'display_name',
					next_token: 'page-2',
				},
			);
		});

		it('should follow a nested next_token field under response.data across pages', async () => {
			mockZohoCliqApiRequest
				.mockResolvedValueOnce({
					data: {
						users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
						next_token: 'nested-page-2',
					},
				})
				.mockResolvedValueOnce({
					data: {
						users: [{ email: 'person@example.com', display_name: 'Quinn Rivers' }],
						has_more: false,
					},
				});

			await expect(
				runTeamUsersPreflightGate(
					mockExecuteFunctions,
					['person@example.com'],
					0,
					'ZohoCliq.Users.ALL',
				),
			).resolves.toBeUndefined();
			expect(mockZohoCliqApiRequest).toHaveBeenLastCalledWith(
				'GET',
				'/api/v2/users',
				{},
				{
					limit: 100,
					fields: 'display_name',
					next_token: 'nested-page-2',
				},
			);
		});

		it('should throw when the API signals has_more without a next_token during an active preflight', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
				has_more: true,
			});

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['54667722'], 0, 'ZohoCliq.Users.ALL'),
			).rejects.toThrow('reported more results without returning a next_token');
		});

		it('should throw when nested data signals hasMore without a next token during an active preflight', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				data: {
					users: [{ user_id: '44344926', display_name: 'Olivia Palmer' }],
					hasMore: true,
				},
			});

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['54667722'], 0, 'ZohoCliq.Users.ALL'),
			).rejects.toThrow('reported more results without returning a next_token');
		});

		it('should throw when pagination metadata is absent but the page is full during an active preflight', async () => {
			mockZohoCliqApiRequest.mockResolvedValue({
				users: Array.from({ length: 100 }, (_, index) => ({
					user_id: `${index + 1}`,
					display_name: `User ${index + 1}`,
				})),
			});

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['missing-user'], 0, 'ZohoCliq.Users.ALL'),
			).rejects.toThrow(
				'could not confirm exhaustive pagination because Zoho Cliq returned a full page without next_token or has_more=false',
			);
		});

		it('should throw when the user lookup request itself fails during an active preflight', async () => {
			mockZohoCliqApiRequest.mockRejectedValue(new Error('lookup failed'));

			await expect(
				runTeamUsersPreflightGate(mockExecuteFunctions, ['44344926'], 0, 'ZohoCliq.Users.READ'),
			).rejects.toThrow(
				'The user roster preflight failed before Zoho Cliq could be scanned exhaustively.',
			);
		});
	});
});
