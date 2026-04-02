import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	buildBotRecoverableErrorPayload,
	ensureSafeObject,
	isBotAiErrorModeEnabled,
	parseBotPayloadInput,
	parseDelimitedIds,
	pushBotRecoverableError,
	validateBotUniqueName,
	validateTriggerCallPayload,
} from '../../../../../../nodes/ZohoCliq/v1/actions/bot/common';

describe('ZohoCliq - Bot - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	describe('validateBotUniqueName', () => {
		it('should trim and return valid bot unique name', () => {
			const result = validateBotUniqueName(mockExecuteFunctions, '  supportbot  ', 0);
			expect(result).toBe('supportbot');
		});

		it('should throw for empty bot unique name', () => {
			expect(() => validateBotUniqueName(mockExecuteFunctions, '', 0)).toThrow(NodeOperationError);
			expect(() => validateBotUniqueName(mockExecuteFunctions, '   ', 0)).toThrow(
				'Bot Unique Name is required',
			);
		});

		it('should throw for invalid bot unique name format', () => {
			expect(() => validateBotUniqueName(mockExecuteFunctions, 'bot/name', 0)).toThrow(
				'Invalid Bot Unique Name format',
			);
		});

		it('should throw for uppercase or numeric bot unique name', () => {
			expect(() => validateBotUniqueName(mockExecuteFunctions, 'Botname', 0)).toThrow(
				'Invalid Bot Unique Name format',
			);
			expect(() => validateBotUniqueName(mockExecuteFunctions, 'bot123', 0)).toThrow(
				'Invalid Bot Unique Name format',
			);
		});

		it('should throw for bot unique name longer than 120 chars', () => {
			expect(() => validateBotUniqueName(mockExecuteFunctions, 'a'.repeat(121), 0)).toThrow(
				'Bot Unique Name is too long. Maximum length is 120 characters.',
			);
		});
	});

	describe('buildBotRecoverableErrorPayload', () => {
		it('should default to An unexpected issue occurred with the API request and omit bot_unique_name when inputs are blank', () => {
			const payload = buildBotRecoverableErrorPayload('   ', '   ');

			expect(payload).toEqual(
				expect.objectContaining({
					success: false,
					message: 'An unexpected issue occurred with the API request',
					resource: 'bot',
					operation: 'unknown',
				}),
			);
			expect(payload).not.toHaveProperty('bot_unique_name');
		});

		it('should omit bot_unique_name when bot name is undefined', () => {
			const payload = buildBotRecoverableErrorPayload('Unknown issue');

			expect(payload).toEqual(
				expect.objectContaining({
					success: false,
					message: 'Unknown issue',
					resource: 'bot',
					operation: 'unknown',
				}),
			);
			expect(payload).not.toHaveProperty('bot_unique_name');
		});

		it('should map invalid URL pattern errors to actionable bot name guidance', () => {
			const payload = buildBotRecoverableErrorPayload(
				'The request URL is invalid. Please check the URL pattern.',
				'bot123',
			);

			expect(payload).toEqual(
				expect.objectContaining({
					success: false,
					reason: 'INVALID_BOT_UNIQUE_NAME',
					bot_unique_name: 'bot123',
					resource: 'bot',
					operation: 'unknown',
				}),
			);
			expect(String(payload.message)).not.toContain('URL');
		});

		it('should classify bot not found errors', () => {
			const payload = buildBotRecoverableErrorPayload(
				"The bot you're looking for couldn't be found.",
				'fakebot',
			);

			expect(payload).toEqual(
				expect.objectContaining({
					success: false,
					reason: 'BOT_NOT_FOUND',
					bot_unique_name: 'fakebot',
					message: "The bot you're looking for couldn't be found.",
					resource: 'bot',
					operation: 'unknown',
				}),
			);
		});
	});

	describe('recoverable helper activation', () => {
		const buildRecoverableContext = (
			continueOnFail: boolean,
			enableAiErrorMode: unknown = false,
		): IExecuteFunctions =>
			({
				continueOnFail: jest.fn(() => continueOnFail),
				getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
					if (name === 'enableAiErrorMode') {
						return enableAiErrorMode;
					}
					return fallback;
				}),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: { enableAiErrorMode },
				})),
			}) as unknown as IExecuteFunctions;

		it('should treat string AI Error Mode values as enabled', () => {
			expect(isBotAiErrorModeEnabled(buildRecoverableContext(false, 'true'), 0)).toBe(true);
			expect(isBotAiErrorModeEnabled(buildRecoverableContext(false, ' yes '), 0)).toBe(true);
		});

		it('should fall back to node parameters when getNodeParameter throws', () => {
			const context = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(() => {
					throw new Error('parameter unavailable');
				}),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: { enableAiErrorMode: 'true' },
				})),
			} as unknown as IExecuteFunctions;

			expect(isBotAiErrorModeEnabled(context, 0)).toBe(true);
		});

		it('should return false when getNode is unavailable or parameters are not object-like', () => {
			const noGetNodeContext = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
				),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			const badParametersContext = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
				),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
					parameters: [],
				})),
			} as unknown as IExecuteFunctions;

			const missingParametersContext = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
				),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => ({
					name: 'Test Node',
					type: 'n8n-nodes-base.zohoCliq',
				})),
			} as unknown as IExecuteFunctions;

			const undefinedNodeContext = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
				),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => undefined),
			} as unknown as IExecuteFunctions;

			expect(isBotAiErrorModeEnabled(noGetNodeContext, 0)).toBe(false);
			expect(isBotAiErrorModeEnabled(badParametersContext, 0)).toBe(false);
			expect(isBotAiErrorModeEnabled(missingParametersContext, 0)).toBe(false);
			expect(isBotAiErrorModeEnabled(undefinedNodeContext, 0)).toBe(false);
		});

		it('should return false when getNode throws during AI Error Mode fallback', () => {
			const context = {
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(
					(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
				),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
				getNode: jest.fn(() => {
					throw new Error('node unavailable');
				}),
			} as unknown as IExecuteFunctions;

			expect(isBotAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return a recoverable payload when only AI Error Mode is enabled', () => {
			const context = buildRecoverableContext(false, 'true');
			const returnData: INodeExecutionData[] = [];

			const handled = pushBotRecoverableError(
				context,
				returnData,
				0,
				{
					response: {
						data: {
							message: 'The request URL is invalid. Please check the URL pattern.',
						},
					},
				},
				'fakebot',
				'getSubscribers',
			);

			expect(handled).toBe(true);
			expect((returnData[0] as { json: IDataObject }).json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'bot',
					operation: 'getSubscribers',
					reason: 'INVALID_BOT_UNIQUE_NAME',
					bot_unique_name: 'fakebot',
				}),
			);
		});

		it('should default the recoverable payload operation to unknown', () => {
			const context = buildRecoverableContext(true, false);
			const returnData: INodeExecutionData[] = [];

			const handled = pushBotRecoverableError(
				context,
				returnData,
				0,
				new Error('Bot helper default operation check'),
				'fakebot',
			);

			expect(handled).toBe(true);
			expect((returnData[0] as { json: IDataObject }).json).toEqual(
				expect.objectContaining({
					success: false,
					resource: 'bot',
					operation: 'unknown',
					bot_unique_name: 'fakebot',
					message: 'Bot helper default operation check',
				}),
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, null, 0, 'payload')).not.toThrow();
			expect(() => ensureSafeObject(mockExecuteFunctions, undefined, 0, 'payload')).not.toThrow();
		});

		it('should throw when unsafe key is present', () => {
			const payload = { constructor: 'bad' } as unknown as IDataObject;
			expect(() => ensureSafeObject(mockExecuteFunctions, payload, 0, 'payload')).toThrow(
				'Unsafe key "constructor" is not allowed',
			);
		});

		it('should throw when value is not an object', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, 'bad', 0, 'payload')).toThrow(
				'payload must be a JSON object',
			);
		});
	});

	describe('validateTriggerCallPayload', () => {
		it('should validate a safe call payload', () => {
			const payload: IDataObject = {
				text: 'Security alert',
				user_ids: ['123', '456'],
				retry: 2,
				loop: 1,
				actions: [
					{
						label: 'View details',
						action: {
							type: 'open.url',
							data: {
								web: 'https://cliq.zoho.com',
							},
						},
					},
				],
			};

			const result = validateTriggerCallPayload(mockExecuteFunctions, payload, 0);
			expect(result).toEqual(payload);
		});

		it('should throw when text is missing', () => {
			expect(() =>
				validateTriggerCallPayload(mockExecuteFunctions, { user_ids: ['123'] } as IDataObject, 0),
			).toThrow('Call Payload text is required');
		});

		it('should throw when payload is not an object', () => {
			expect(() =>
				validateTriggerCallPayload(mockExecuteFunctions, 'bad' as unknown as IDataObject, 0),
			).toThrow('Call Payload must be a JSON object');
		});

		it('should throw when text exceeds max length', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'a'.repeat(501) } as IDataObject,
					0,
				),
			).toThrow('Call Payload text is too long. Maximum length is 500 characters.');
		});

		it('should throw when user_ids exceeds max count', () => {
			const payload: IDataObject = {
				text: 'Test',
				user_ids: Array(11).fill('123'),
			};

			expect(() => validateTriggerCallPayload(mockExecuteFunctions, payload, 0)).toThrow(
				'Call Payload user_ids cannot exceed 10 items',
			);
		});

		it('should throw when user_ids is not an array', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', user_ids: '123' } as unknown as IDataObject,
					0,
				),
			).toThrow('Call Payload user_ids must be an array');
		});

		it('should throw when user_ids has empty values', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', user_ids: [''] } as IDataObject,
					0,
				),
			).toThrow('Call Payload user_ids cannot contain empty values');
		});

		it('should throw when user_ids contains null', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', user_ids: [null] } as unknown as IDataObject,
					0,
				),
			).toThrow('Call Payload user_ids cannot contain empty values');
		});

		it('should throw when user_ids value exceeds max length', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', user_ids: ['a'.repeat(256)] } as IDataObject,
					0,
				),
			).toThrow('Call Payload user_ids values are too long. Maximum length is 255 characters.');
		});

		it('should throw when retry is out of range', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', retry: 4 } as IDataObject,
					0,
				),
			).toThrow('Call Payload retry must be a whole number between 1 and 3');
		});

		it('should throw when retry is below minimum', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', retry: 0 } as IDataObject,
					0,
				),
			).toThrow('Call Payload retry must be a whole number between 1 and 3');
		});

		it('should throw when retry is not a whole number', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', retry: 1.5 } as IDataObject,
					0,
				),
			).toThrow('Call Payload retry must be a whole number between 1 and 3');
		});

		it('should throw when loop is out of range', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', loop: 0 } as IDataObject,
					0,
				),
			).toThrow('Call Payload loop must be a whole number between 1 and 3');
		});

		it('should throw when loop is above maximum', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', loop: 4 } as IDataObject,
					0,
				),
			).toThrow('Call Payload loop must be a whole number between 1 and 3');
		});

		it('should throw when loop is not a whole number', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', loop: 2.2 } as IDataObject,
					0,
				),
			).toThrow('Call Payload loop must be a whole number between 1 and 3');
		});

		it('should throw when actions exceeds max count', () => {
			const payload: IDataObject = {
				text: 'Test',
				actions: Array(6).fill({ type: '2', name: 'Ack' }),
			};

			expect(() => validateTriggerCallPayload(mockExecuteFunctions, payload, 0)).toThrow(
				'Call Payload actions cannot exceed 5 items',
			);
		});

		it('should throw when actions is not an array', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{ text: 'Test', actions: 'bad' } as unknown as IDataObject,
					0,
				),
			).toThrow('Call Payload actions must be an array');
		});

		it('should throw when an action entry is not an object', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [123],
					} as unknown as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0] must be a JSON object');
		});

		it('should throw when action label is missing', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [{ action: { type: 'open.url', data: { web: 'https://cliq.zoho.com' } } }],
					} as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].label is required');
		});

		it('should throw when action label is whitespace only', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: '   ',
								action: { type: 'open.url', data: { web: 'https://cliq.zoho.com' } },
							},
						],
					} as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].label is required');
		});

		it('should throw when open.url action has invalid URL', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: 'View',
								action: { type: 'open.url', data: { web: 'ftp://example.com' } },
							},
						],
					} as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].action.data.web must be a valid HTTP/HTTPS URL');
		});

		it('should throw when open.url action is missing web URL', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: 'View',
								action: { type: 'open.url', data: {} },
							},
						],
					} as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].action.data.web is required for open.url');
		});

		it('should throw when action nested action payload is missing', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [{ label: 'View', action: null }],
					} as unknown as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].action must be a JSON object');
		});

		it('should throw when action type is unsupported', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: 'View',
								action: { type: 'custom.action', data: {} },
							},
						],
					} as IDataObject,
					0,
				),
			).toThrow(
				'Call Payload actions[0].action.type must be one of: open.url, invoke.function, system.api, open.dialog',
			);
		});

		it('should throw when action data is not an object', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: 'View',
								action: { type: 'open.url', data: [] },
							},
						],
					} as unknown as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].action.data must be a JSON object');
		});

		it('should throw when invoke.function action is missing function name', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: 'Ack',
								action: { type: 'invoke.function', data: {} },
							},
						],
					} as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].action.data.name is required for invoke.function');
		});

		it('should throw when system.api action is missing api value', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: 'Delegate',
								action: { type: 'system.api', data: {} },
							},
						],
					} as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].action.data.api is required for system.api');
		});

		it('should allow optional action fields within limits', () => {
			const payload: IDataObject = {
				text: 'Test',
				actions: [
					{
						label: 'View',
						icon: 'tick',
						hint: 'short hint',
						key: 'k1',
						action: { type: 'open.url', data: { web: 'https://cliq.zoho.com' } },
					},
				],
			};

			expect(validateTriggerCallPayload(mockExecuteFunctions, payload, 0)).toEqual(payload);
		});

		it.each(['icon', 'hint', 'key'] as const)(
			'should throw when optional action field %s exceeds max length',
			(field) => {
				const payload: IDataObject = {
					text: 'Test',
					actions: [
						{
							label: 'View',
							action: { type: 'open.url', data: { web: 'https://cliq.zoho.com' } },
							[field]: 'a'.repeat(256),
						},
					],
				};

				expect(() => validateTriggerCallPayload(mockExecuteFunctions, payload, 0)).toThrow(
					`Call Payload actions[0].${field} is too long. Maximum length is 255 characters.`,
				);
			},
		);

		it('should allow action label with exactly 20 characters', () => {
			const payload: IDataObject = {
				text: 'Test',
				actions: [
					{
						label: 'A'.repeat(20),
						action: { type: 'open.url', data: { web: 'https://cliq.zoho.com' } },
					},
				],
			};

			expect(() => validateTriggerCallPayload(mockExecuteFunctions, payload, 0)).not.toThrow();
		});

		it('should throw when action label exceeds 20 characters', () => {
			expect(() =>
				validateTriggerCallPayload(
					mockExecuteFunctions,
					{
						text: 'Test',
						actions: [
							{
								label: 'A'.repeat(21),
								action: { type: 'open.url', data: { web: 'https://cliq.zoho.com' } },
							},
						],
					} as IDataObject,
					0,
				),
			).toThrow('Call Payload actions[0].label is too long. Maximum length is 20 characters.');
		});
	});

	describe('parseBotPayloadInput', () => {
		it('should throw for null payload', () => {
			expect(() => parseBotPayloadInput(mockExecuteFunctions, null, 0, 'Call Payload')).toThrow(
				'Call Payload cannot be empty',
			);
		});

		it('should throw for empty string payload', () => {
			expect(() => parseBotPayloadInput(mockExecuteFunctions, '   ', 0, 'Call Payload')).toThrow(
				'Call Payload cannot be empty',
			);
		});

		it('should parse valid stringified JSON object', () => {
			const result = parseBotPayloadInput(
				mockExecuteFunctions,
				'{"text":"Alert","retry":1}',
				0,
				'Call Payload',
			);
			expect(result).toEqual({ text: 'Alert', retry: 1 });
		});

		it('should throw for malformed JSON string', () => {
			expect(() =>
				parseBotPayloadInput(mockExecuteFunctions, '{"text":', 0, 'Call Payload'),
			).toThrow('Call Payload must be a valid JSON object when provided as text');
		});

		it('should throw for stringified JSON array payload', () => {
			expect(() =>
				parseBotPayloadInput(mockExecuteFunctions, '["a","b"]', 0, 'Call Payload'),
			).toThrow('Call Payload must be a JSON object');
		});

		it('should throw for array payload object', () => {
			expect(() =>
				parseBotPayloadInput(mockExecuteFunctions, ['a', 'b'], 0, 'Call Payload'),
			).toThrow('Call Payload must be a JSON object');
		});

		it('should return object payload as-is when valid', () => {
			const payload = { text: 'Alert', retry: 1 } as IDataObject;
			expect(parseBotPayloadInput(mockExecuteFunctions, payload, 0, 'Call Payload')).toEqual(
				payload,
			);
		});
	});

	describe('parseDelimitedIds', () => {
		it('should throw when input is not a string', () => {
			expect(() => parseDelimitedIds(mockExecuteFunctions, 123, 0, 'User IDs')).toThrow(
				'User IDs must be a string containing comma-separated IDs',
			);
		});

		it('should parse comma-separated IDs', () => {
			const result = parseDelimitedIds(mockExecuteFunctions, '123, 456,789', 0, 'User IDs');
			expect(result).toEqual(['123', '456', '789']);
		});

		it('should throw when no IDs are provided', () => {
			expect(() => parseDelimitedIds(mockExecuteFunctions, ' , ', 0, 'User IDs')).toThrow(
				'User IDs must contain at least one ID',
			);
		});
	});
});
