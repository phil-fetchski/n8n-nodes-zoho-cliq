import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import {
	ensureSafeObject,
	isRemindersAiErrorModeEnabled,
	parseReminderDateTimeOrUnixMs,
	parseReminderPayloadInput,
	pushRemindersRecoverableError,
	reminderIdLocator,
	resolveRemindersEnhancedOutput,
	stringifyReminderTimeForApi,
	validateReminderChatIds,
	validateReminderCreateType,
	validateCompletedReminderCategory,
	validateReminderCategory,
	validateReminderContent,
	validateReminderDate,
	validateReminderEntityId,
	validateReminderInputMode,
	validateReminderMessageId,
	validateReminderId,
	validateReminderIdArray,
	validateReminderPayload,
	validateReminderTaskDateTime,
	validateReminderTimeInputMode,
	validateReminderTime,
	validateReminderUserIds,
} from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/common';

describe('ZohoCliq - Reminders - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	describe('validateReminderId', () => {
		it('should expose Reminder ID locator guidance for workflows and AI setup', () => {
			expect(reminderIdLocator.displayName).toBe('Reminder ID');
			expect(String(reminderIdLocator.description)).toContain('reminder');
			expect(String(reminderIdLocator.description)).toContain('expression');
		});

		it('should trim and return valid reminder ID', () => {
			expect(validateReminderId(mockExecuteFunctions, '  reminder_123  ', 0)).toBe('reminder_123');
		});

		it('should throw when reminder ID is empty', () => {
			expect(() => validateReminderId(mockExecuteFunctions, '   ', 0)).toThrow(
				'Reminder ID is required',
			);
		});

		it('should throw when reminder ID is too long', () => {
			expect(() => validateReminderId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Reminder ID is too long',
			);
		});

		it('should throw for invalid format', () => {
			expect(() => validateReminderId(mockExecuteFunctions, 'bad/id', 0)).toThrow(
				'Invalid Reminder ID format',
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined values', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, null, 0, 'payload')).not.toThrow();
			expect(() => ensureSafeObject(mockExecuteFunctions, undefined, 0, 'payload')).not.toThrow();
		});

		it('should reject non-object values and arrays', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, 'bad', 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
			expect(() => ensureSafeObject(mockExecuteFunctions, [], 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});

		it('should reject prototype pollution keys', () => {
			const unsafe = JSON.parse('{"__proto__":"bad"}') as IDataObject;
			expect(() => ensureSafeObject(mockExecuteFunctions, unsafe, 0, 'payload')).toThrow(
				'Unsafe key "__proto__" is not allowed',
			);
		});

		it('should recurse through nested objects in arrays', () => {
			const unsafeNested = {
				items: [{ safe: true }, JSON.parse('{"constructor":"bad"}') as IDataObject],
			};
			expect(() =>
				ensureSafeObject(mockExecuteFunctions, unsafeNested as IDataObject, 0, 'payload'),
			).toThrow('Unsafe key "constructor" is not allowed in payload.items[1]');
		});

		it('should recurse through nested object properties', () => {
			const unsafeNestedObject = {
				parent: JSON.parse('{"prototype":"bad"}') as IDataObject,
			};
			expect(() =>
				ensureSafeObject(mockExecuteFunctions, unsafeNestedObject as IDataObject, 0, 'payload'),
			).toThrow('Unsafe key "prototype" is not allowed in payload.parent');
		});
	});

	describe('parseReminderPayloadInput', () => {
		it('should parse JSON string payload', () => {
			const result = parseReminderPayloadInput(
				mockExecuteFunctions,
				'{"content":"A","time":1767225600000}',
				0,
				'Reminder Definition',
			);
			expect(result).toEqual({ content: 'A', time: 1767225600000 });
		});

		it('should reject invalid json string payload', () => {
			expect(() =>
				parseReminderPayloadInput(mockExecuteFunctions, '{bad', 0, 'Reminder Definition'),
			).toThrow('Reminder Definition must be a valid JSON object when provided as text');
		});

		it('should reject empty payload values', () => {
			expect(() =>
				parseReminderPayloadInput(mockExecuteFunctions, null, 0, 'Reminder Definition'),
			).toThrow('Reminder Definition cannot be empty');
			expect(() =>
				parseReminderPayloadInput(mockExecuteFunctions, '   ', 0, 'Reminder Definition'),
			).toThrow('Reminder Definition cannot be empty');
		});

		it('should accept already-object payload', () => {
			const payload = { content: 'A' };
			expect(
				parseReminderPayloadInput(mockExecuteFunctions, payload, 0, 'Reminder Definition'),
			).toBe(payload);
		});
	});

	describe('content/time validators', () => {
		it('should validate content', () => {
			expect(validateReminderContent(mockExecuteFunctions, '  review this  ', 0)).toBe(
				'review this',
			);
		});

		it('should reject empty content', () => {
			expect(() => validateReminderContent(mockExecuteFunctions, '   ', 0)).toThrow(
				'Content is required',
			);
		});

		it('should reject undefined content', () => {
			expect(() => validateReminderContent(mockExecuteFunctions, undefined, 0)).toThrow(
				'Content is required',
			);
		});

		it('should validate time', () => {
			expect(validateReminderTime(mockExecuteFunctions, 1767225600000, 0)).toBe(1767225600000);
		});

		it('should reject non-positive time', () => {
			expect(() => validateReminderTime(mockExecuteFunctions, 0, 0)).toThrow(
				'Time must be a positive whole-number timestamp in milliseconds',
			);
		});

		it('should reject content that exceeds max length', () => {
			expect(() => validateReminderContent(mockExecuteFunctions, 'a'.repeat(513), 0)).toThrow(
				'Content is too long',
			);
		});

		it('should parse datetime strings into unix milliseconds', () => {
			const timestamp = parseReminderDateTimeOrUnixMs(
				mockExecuteFunctions,
				'2026-03-01T10:00:00Z',
				0,
				'Time',
			);
			expect(timestamp).toBe(1772359200000);
		});

		it('should parse ISO 8601 datetime strings with timezone offsets into unix milliseconds', () => {
			const timestamp = parseReminderDateTimeOrUnixMs(
				mockExecuteFunctions,
				'2026-03-19T09:30:00-04:00',
				0,
				'Time',
			);
			expect(timestamp).toBe(1773927000000);
		});

		it('should parse unix timestamp string and number values', () => {
			expect(parseReminderDateTimeOrUnixMs(mockExecuteFunctions, '1767225600000', 0, 'Time')).toBe(
				1767225600000,
			);
			expect(parseReminderDateTimeOrUnixMs(mockExecuteFunctions, 1767225600000, 0, 'Time')).toBe(
				1767225600000,
			);
		});

		it('should reject invalid datetime input variants', () => {
			expect(() => parseReminderDateTimeOrUnixMs(mockExecuteFunctions, {}, 0, 'Time')).toThrow(
				'Time must be a datetime string or Unix timestamp in milliseconds',
			);
			expect(() => parseReminderDateTimeOrUnixMs(mockExecuteFunctions, '   ', 0, 'Time')).toThrow(
				'Time cannot be empty',
			);
			expect(() =>
				parseReminderDateTimeOrUnixMs(mockExecuteFunctions, 'not-a-date', 0, 'Time'),
			).toThrow('Time must be a valid datetime or Unix timestamp in milliseconds');
			expect(() =>
				parseReminderDateTimeOrUnixMs(mockExecuteFunctions, '0000-01-01T00:00:00Z', 0, 'Time'),
			).toThrow('Time must be a valid datetime or Unix timestamp in milliseconds');
		});

		it('should stringify normalized reminder time values for API requests', () => {
			const payload: IDataObject = { time: 1773927000000 };
			stringifyReminderTimeForApi(payload);
			expect(payload.time).toBe('1773927000000');
		});
	});

	describe('category validators', () => {
		it('should validate reminder categories', () => {
			expect(validateReminderCategory(mockExecuteFunctions, 'mine', 0)).toBe('mine');
			expect(validateReminderCategory(mockExecuteFunctions, 'others-completed', 0)).toBe(
				'others-completed',
			);
		});

		it('should reject invalid reminder category', () => {
			expect(() => validateReminderCategory(mockExecuteFunctions, 'all', 0)).toThrow(
				'Invalid category',
			);
		});

		it('should reject undefined reminder category', () => {
			expect(() => validateReminderCategory(mockExecuteFunctions, undefined, 0)).toThrow(
				'Invalid category',
			);
		});

		it('should validate completed reminder categories', () => {
			expect(validateCompletedReminderCategory(mockExecuteFunctions, 'mine-completed', 0)).toBe(
				'mine-completed',
			);
			expect(validateCompletedReminderCategory(mockExecuteFunctions, 'Mine Completed', 0)).toBe(
				'mine-completed',
			);
			expect(validateCompletedReminderCategory(mockExecuteFunctions, 'others completed', 0)).toBe(
				'others-completed',
			);
			expect(validateCompletedReminderCategory(mockExecuteFunctions, 'Others_Completed', 0)).toBe(
				'others-completed',
			);
		});

		it('should reject invalid completed reminder category', () => {
			expect(() => validateCompletedReminderCategory(mockExecuteFunctions, 'mine', 0)).toThrow(
				'Invalid category',
			);
		});

		it('should reject undefined completed reminder category', () => {
			expect(() => validateCompletedReminderCategory(mockExecuteFunctions, undefined, 0)).toThrow(
				'Invalid category',
			);
		});
	});

	describe('validateReminderTaskDateTime', () => {
		it('should accept strict ISO datetime', () => {
			const result = validateReminderTaskDateTime(mockExecuteFunctions, '2026-03-01T10:00:00Z', 0);
			expect(result).toBe('2026-03-01T10:00:00Z');
		});

		it('should accept positive numeric timestamps', () => {
			expect(validateReminderTaskDateTime(mockExecuteFunctions, 1767225600000, 0)).toBe(
				1767225600000,
			);
		});

		it('should reject invalid task datetime variants', () => {
			expect(() => validateReminderTaskDateTime(mockExecuteFunctions, 0, 0)).toThrow(
				'Task Date Time must be a positive timestamp number',
			);
			expect(() => validateReminderTaskDateTime(mockExecuteFunctions, '   ', 0)).toThrow(
				'Task Date Time cannot be empty',
			);
			expect(() =>
				validateReminderTaskDateTime(mockExecuteFunctions, '2026-03-01T10:00:00', 0),
			).toThrow('Task Date Time must be a strict ISO 8601 datetime');
			expect(() =>
				validateReminderTaskDateTime(mockExecuteFunctions, '2026-13-01T10:00:00Z', 0),
			).toThrow('Task Date Time must be a valid datetime');
			expect(() => validateReminderTaskDateTime(mockExecuteFunctions, false, 0)).toThrow(
				'Task Date Time must be a timestamp number or ISO datetime string',
			);
		});
	});

	describe('validateReminderUserIds', () => {
		it('should validate user_ids array', () => {
			const result = validateReminderUserIds(
				mockExecuteFunctions,
				[' user_1 ', 'user_2'],
				0,
				'user_ids',
			);
			expect(result).toEqual(['user_1', 'user_2']);
		});

		it('should enforce max users', () => {
			expect(() =>
				validateReminderUserIds(
					mockExecuteFunctions,
					['u1', 'u2', 'u3', 'u4', 'u5'],
					0,
					'user_ids',
				),
			).toThrow('user_ids can contain at most 4 user ID(s)');
		});

		it('should enforce minimum users and valid array input', () => {
			expect(() => validateReminderUserIds(mockExecuteFunctions, 'user_1', 0, 'user_ids')).toThrow(
				'user_ids must be an array',
			);
			expect(() => validateReminderUserIds(mockExecuteFunctions, [], 0, 'user_ids')).toThrow(
				'user_ids must contain at least 1 user ID(s)',
			);
		});

		it('should reject invalid user ID format', () => {
			expect(() =>
				validateReminderUserIds(mockExecuteFunctions, ['bad/id'], 0, 'user_ids'),
			).toThrow('Invalid User ID format: bad/id');
		});

		it('should honor explicit min/max options for user IDs', () => {
			const result = validateReminderUserIds(
				mockExecuteFunctions,
				['user_1', 'user_2'],
				0,
				'user_ids',
				{ min: 2, max: 2 },
			);
			expect(result).toEqual(['user_1', 'user_2']);
		});
	});

	describe('validateReminderIdArray', () => {
		it('should validate reminder ID arrays', () => {
			expect(validateReminderIdArray(mockExecuteFunctions, ['r1', 'r2'], 0)).toEqual(['r1', 'r2']);
		});

		it('should enforce reminder ID array structure and bounds', () => {
			expect(() => validateReminderIdArray(mockExecuteFunctions, 'r1', 0)).toThrow(
				'reminder_ids must be an array',
			);
			expect(() => validateReminderIdArray(mockExecuteFunctions, [], 0)).toThrow(
				'reminder_ids must contain at least one ID',
			);
			expect(() =>
				validateReminderIdArray(
					mockExecuteFunctions,
					Array.from({ length: 21 }, (_, i) => `r${i}`),
					0,
				),
			).toThrow('reminder_ids can contain at most 20 IDs');
		});
	});

	describe('chat/message validators', () => {
		it('should validate chat IDs array with max-1 constraint', () => {
			const result = validateReminderChatIds(mockExecuteFunctions, ['CT_123'], 0, 'chat_ids', {
				max: 1,
			});
			expect(result).toEqual(['CT_123']);
		});

		it('should validate generic reminder entity IDs', () => {
			expect(validateReminderEntityId(mockExecuteFunctions, 'MSG_123', 0, 'Message ID')).toBe(
				'MSG_123',
			);
		});

		it('should reject invalid entity IDs', () => {
			expect(() => validateReminderEntityId(mockExecuteFunctions, '', 0, 'Chat ID')).toThrow(
				'Chat ID is required',
			);
			expect(() => validateReminderEntityId(mockExecuteFunctions, undefined, 0, 'Chat ID')).toThrow(
				'Chat ID is required',
			);
			expect(() =>
				validateReminderEntityId(mockExecuteFunctions, 'a'.repeat(256), 0, 'Chat ID'),
			).toThrow('Chat ID is too long');
			expect(() => validateReminderEntityId(mockExecuteFunctions, 'bad/id', 0, 'Chat ID')).toThrow(
				'Invalid Chat ID format',
			);
		});

		it('should validate message_id values in timestamp_uniqueId format', () => {
			expect(validateReminderMessageId(mockExecuteFunctions, '1772395354414_196142356543', 0)).toBe(
				1772395354414,
			);
		});

		it('should validate numeric message_id values from number input', () => {
			expect(validateReminderMessageId(mockExecuteFunctions, 1772395354414, 0)).toBe(1772395354414);
		});

		it('should validate numeric message_id values', () => {
			expect(validateReminderMessageId(mockExecuteFunctions, '1772395354414', 0)).toBe(
				1772395354414,
			);
		});

		it('should reject invalid message_id values', () => {
			expect(() => validateReminderMessageId(mockExecuteFunctions, 'msg_1536853438313', 0)).toThrow(
				'Message ID must be a numeric value or timestamp_uniqueId format',
			);
		});

		it('should reject empty, too long, and non-positive numeric message IDs', () => {
			expect(() => validateReminderMessageId(mockExecuteFunctions, undefined, 0)).toThrow(
				'Message ID is required',
			);
			expect(() => validateReminderMessageId(mockExecuteFunctions, '', 0)).toThrow(
				'Message ID is required',
			);
			expect(() => validateReminderMessageId(mockExecuteFunctions, '9'.repeat(256), 0)).toThrow(
				'Message ID is too long',
			);
			expect(() => validateReminderMessageId(mockExecuteFunctions, '0', 0)).toThrow(
				'Message ID must be a positive whole number',
			);
			expect(() => validateReminderMessageId(mockExecuteFunctions, 0, 0)).toThrow(
				'Message ID must be a positive whole number',
			);
		});

		it('should accept large numeric message IDs within format constraints', () => {
			const value = validateReminderMessageId(mockExecuteFunctions, '9'.repeat(255), 0);
			expect(typeof value).toBe('number');
			expect(Number.isFinite(value)).toBe(true);
		});

		it('should enforce chat ID constraints', () => {
			expect(() => validateReminderChatIds(mockExecuteFunctions, 'CT_123', 0, 'chat_ids')).toThrow(
				'chat_ids must be an array',
			);
			expect(() => validateReminderChatIds(mockExecuteFunctions, [], 0, 'chat_ids')).toThrow(
				'chat_ids must contain at least 1 chat ID(s)',
			);
			expect(() =>
				validateReminderChatIds(mockExecuteFunctions, ['CT_1', 'CT_2'], 0, 'chat_ids', { max: 1 }),
			).toThrow('chat_ids can contain at most 1 chat ID(s)');
		});

		it('should honor explicit min/max options for chat IDs', () => {
			const result = validateReminderChatIds(
				mockExecuteFunctions,
				['CT_1', 'CT_2'],
				0,
				'chat_ids',
				{ min: 2, max: 2 },
			);
			expect(result).toEqual(['CT_1', 'CT_2']);
		});
	});

	describe('validateReminderPayload', () => {
		it('should validate content/time payload', () => {
			const payload: IDataObject = { content: '  Review contract  ', time: 1767225600000 };
			const result = validateReminderPayload(
				mockExecuteFunctions,
				payload,
				0,
				'Reminder Definition',
				{
					requireContent: true,
					allowedFields: ['content', 'time'],
				},
			);
			expect(result.content).toBe('Review contract');
		});

		it('should reject unsupported fields when allowlist is set', () => {
			expect(() =>
				validateReminderPayload(
					mockExecuteFunctions,
					{ content: 'A', foo: 'bar' } as IDataObject,
					0,
					'Reminder Definition',
					{ allowedFields: ['content', 'time'] },
				),
			).toThrow('Reminder Definition contains unsupported field "foo"');
		});

		it('should reject null payload unless allowEmpty is true', () => {
			expect(() =>
				validateReminderPayload(
					mockExecuteFunctions,
					null as unknown as IDataObject,
					0,
					'Reminder Definition',
				),
			).toThrow('Reminder Definition cannot be empty');
		});

		it('should allow empty payload when allowEmpty is true', () => {
			const payload: IDataObject = {};
			const result = validateReminderPayload(
				mockExecuteFunctions,
				payload,
				0,
				'Reminder Definition',
				{ allowEmpty: true },
			);
			expect(result).toEqual({});
		});

		it('should reject empty object payload when allowEmpty is false', () => {
			expect(() =>
				validateReminderPayload(mockExecuteFunctions, {}, 0, 'Reminder Definition'),
			).toThrow('Reminder Definition cannot be empty');
		});

		it('should validate extended reminder payload fields', () => {
			const payload: IDataObject = {
				task_datetime: '2026-03-01T10:00:00Z',
				date: '2026-03-01',
				chat_id: 'CT_123',
				message_id: '1772395354414_196142356543',
				user_ids: ['user_1'],
				chat_ids: ['CT_999'],
			};
			const result = validateReminderPayload(
				mockExecuteFunctions,
				payload,
				0,
				'Reminder Definition',
			);
			expect(result).toEqual({
				task_datetime: '2026-03-01T10:00:00Z',
				date: '2026-03-01',
				chat_id: 'CT_123',
				message_id: 1772395354414,
				user_ids: ['user_1'],
				chat_ids: ['CT_999'],
			});
		});
	});

	describe('date validation helpers', () => {
		it('should validate single date helper and reject empty date', () => {
			expect(validateReminderDate(mockExecuteFunctions, '2026-03-01', 'Date', 0)).toBe(
				'2026-03-01',
			);
			expect(() => validateReminderDate(mockExecuteFunctions, '   ', 'Date', 0)).toThrow(
				'Date cannot be empty',
			);
		});

		it('should reject invalid date format', () => {
			expect(() => validateReminderDate(mockExecuteFunctions, '03/01/2026', 'Date', 0)).toThrow(
				'Date must be in YYYY-MM-DD format',
			);
		});
	});

	describe('Round 2 helper utilities', () => {
		it('should validate reminder input modes, create types, and time input modes', () => {
			expect(validateReminderInputMode(mockExecuteFunctions, ' structured ', 0)).toBe('structured');
			expect(validateReminderCreateType(mockExecuteFunctions, ' users ', 0)).toBe('users');
			expect(validateReminderTimeInputMode(mockExecuteFunctions, ' unix ', 0)).toBe('unix');
		});

		it('should reject invalid reminder input helper values', () => {
			expect(() => validateReminderInputMode(mockExecuteFunctions, 'xml', 0)).toThrow(
				'Input Mode must be one of: structured, raw',
			);
			expect(() => validateReminderCreateType(mockExecuteFunctions, 'group', 0)).toThrow(
				'Create Type must be one of: self, users, chat, message',
			);
			expect(() => validateReminderTimeInputMode(mockExecuteFunctions, 'picker', 0)).toThrow(
				'Time Input Mode must be one of: dateTime, unix',
			);
			expect(() => validateReminderInputMode(mockExecuteFunctions, 1, 0)).toThrow(
				'Input Mode must be one of: structured, raw',
			);
			expect(() => validateReminderCreateType(mockExecuteFunctions, false, 0)).toThrow(
				'Create Type must be one of: self, users, chat, message',
			);
			expect(() => validateReminderTimeInputMode(mockExecuteFunctions, [], 0)).toThrow(
				'Time Input Mode must be one of: dateTime, unix',
			);
		});

		it('should detect AI Error Mode from parameters or node config', () => {
			const parameterContext = {
				getNodeParameter: jest.fn(() => 'true'),
				getNode: jest.fn(() => ({ parameters: {} })),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(parameterContext, 0)).toBe(true);

			const nodeContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: 'true' } })),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(nodeContext, 0)).toBe(true);

			const throwingParameterContext = {
				getNodeParameter: jest.fn(() => {
					throw new Error('parameter lookup failed');
				}),
				getNode: jest.fn(() => ({ parameters: {} })),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(throwingParameterContext, 0)).toBe(false);

			const noGetNodeContext = {
				getNodeParameter: jest.fn(() => false),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(noGetNodeContext, 0)).toBe(false);

			const invalidParametersContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: 'bad' })),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(invalidParametersContext, 0)).toBe(false);

			const missingParametersContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({})),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(missingParametersContext, 0)).toBe(false);

			const undefinedNodeContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => undefined),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(undefinedNodeContext, 0)).toBe(false);

			const throwingNodeContext = {
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => {
					throw new Error('node read failed');
				}),
			} as unknown as IExecuteFunctions;
			expect(isRemindersAiErrorModeEnabled(throwingNodeContext, 0)).toBe(false);
		});

		it('should return false when recoverable mode is disabled', () => {
			const context = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: {} })),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			expect(pushRemindersRecoverableError(context, [], 0, 'list', new Error('fail'))).toBe(false);
		});

		it('should build generic recoverable reminder payloads and merge scope payload context', () => {
			const returnData = [] as Array<{ json: IDataObject }>;
			const context = {
				continueOnFail: jest.fn(() => true),
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: {} })),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			const handled = pushRemindersRecoverableError(context, returnData, 0, 'delete', {
				statusCode: 404,
				message: 'Reminder not found',
			});
			expect(handled).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: 'delete',
					status_code: 404,
					reason: 'NOT_FOUND',
				}),
			);

			const scopeReturnData = [] as Array<{ json: IDataObject }>;
			pushRemindersRecoverableError(
				context,
				scopeReturnData,
				0,
				'get',
				{
					zohoCliqScopeErrorPayload: {
						requiredScopes: ['ZohoCliq.Reminders.READ'],
					},
				},
				{
					contextFields: {
						reminder_id: 'rem_123',
					},
				},
			);
			expect(scopeReturnData[0].json).toEqual({
				requiredScopes: ['ZohoCliq.Reminders.READ'],
				reminder_id: 'rem_123',
			});

			const scopeOnlyReturnData = [] as Array<{ json: IDataObject }>;
			pushRemindersRecoverableError(context, scopeOnlyReturnData, 0, 'get', {
				zohoCliqScopeErrorPayload: {
					requiredScopes: ['ZohoCliq.Reminders.READ'],
				},
			});
			expect(scopeOnlyReturnData[0].json).toEqual({
				requiredScopes: ['ZohoCliq.Reminders.READ'],
			});

			const nonObjectScopeReturnData = [] as Array<{ json: IDataObject }>;
			pushRemindersRecoverableError(context, nonObjectScopeReturnData, 0, 'list', {
				zohoCliqScopeErrorPayload: 'bad-payload',
				statusCode: 400,
				message: 'Bad request',
			});
			expect(nonObjectScopeReturnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: 'list',
					status_code: 400,
				}),
			);

			const arrayScopeReturnData = [] as Array<{ json: IDataObject }>;
			pushRemindersRecoverableError(context, arrayScopeReturnData, 0, 'list', {
				zohoCliqScopeErrorPayload: ['bad-payload'],
				statusCode: 400,
				message: 'Bad request',
			});
			expect(arrayScopeReturnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: 'list',
					status_code: 400,
				}),
			);

			const undefinedErrorReturnData = [] as Array<{ json: IDataObject }>;
			pushRemindersRecoverableError(context, undefinedErrorReturnData, 0, 'list', undefined);
			expect(undefinedErrorReturnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'reminders',
					operation: 'list',
				}),
			);
		});

		it('should coerce minimal responses for enhanced output', () => {
			const context = {
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex: number, fallback: unknown) => fallback,
				),
			} as unknown as IExecuteFunctions;

			expect(resolveRemindersEnhancedOutput(context, 0, '', true)).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { data: '' },
				responseJson: { data: '' },
			});
			expect(resolveRemindersEnhancedOutput(context, 0, { ok: true })).toEqual({
				includeEnhancedOutput: true,
				rawResponse: { ok: true },
				responseJson: { ok: true },
			});
		});
	});
});
