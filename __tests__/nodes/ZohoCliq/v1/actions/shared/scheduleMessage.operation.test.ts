import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

// Mock the transport layer
jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

import { NodeOperationError } from 'n8n-workflow';
import * as scheduleMessage from '../../../../../../nodes/ZohoCliq/v1/actions/shared/scheduleMessage.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as scopeRegistry from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as utils from '../../../../../../nodes/ZohoCliq/v1/helpers/utils';
import { createRichMessageParameterMock } from './testUtils';

describe('ZohoCliq - Shared - Schedule Message Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	let mockExecuteFunctions: IExecuteFunctions;
	const scheduleMessageScopes = SCOPES.SCHEDULE_MESSAGES_CREATE_WITH_CHAT_LOOKUP;
	const setupParameterMock = (params: Record<string, unknown>) => {
		createRichMessageParameterMock(mockExecuteFunctions.getNodeParameter as jest.Mock, params);
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe('execute', () => {
		it('should schedule message successfully with all parameters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			const futureTime = Date.now() + 3600000; // 1 hour from now

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello scheduled!';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return futureTime;
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_123',
				chat_id: 'CT_123_456',
				text: 'Hello scheduled!',
				scheduled_time: '2025-12-31T10:00:00Z',
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('scheduled_message_id', 'SM_123');
		});

		it('should throw error for missing OAuth scope', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = '';

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				additionalFields: {},
			});

			const requiredScope = getRequiredScopeForOperation('shared', 'scheduleMessage');
			let thrownError: unknown;
			try {
				await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).toBeInstanceOf(NodeOperationError);
			expect((thrownError as Error).message).toContain(requiredScope);
			expect(
				(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
			).toEqual(
				expect.objectContaining({
					requiredScopes: [requiredScope],
					missingScopes: [requiredScope],
					hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
				}),
			);
		});

		it('should require lowercase messages scope variant', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.SCHEDULE_MESSAGES_CREATE_WRONG_CASE;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(SCOPES.SCHEDULE_MESSAGES_CREATE);
		});

		it('should reject lowercase messages.ALL for schedule message', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.SCHEDULE_MESSAGES_ALL_DISALLOWED;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(`does not support "${SCOPES.SCHEDULE_MESSAGES_ALL_DISALLOWED}"`);
		});

		it('should throw error for empty chat ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: '',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				additionalFields: {},
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw error for empty message text', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: '',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				additionalFields: {},
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw error for invalid schedule time format', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: 'invalid-date',
				additionalFields: {},
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(NodeOperationError);
		});

		it('should process multiple items in batch', async () => {
			const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
			const grantedScopes = scheduleMessageScopes;

			const futureTime1 = Date.now() + 3600000; // 1 hour from now
			const futureTime2 = Date.now() + 7200000; // 2 hours from now

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, itemIndex: number) => {
					if (itemIndex === 0) {
						if (paramName === 'chatId') return 'CT_123_456';
						if (paramName === 'messageType') return 'text';
						if (paramName === 'text') return 'Message 1';
						if (paramName === 'scheduleMode') return 'time';
						if (paramName === 'scheduleTime') return futureTime1;
						if (paramName === 'additionalFields') return {};
					} else if (itemIndex === 1) {
						if (paramName === 'chatId') return 'CT_789_012';
						if (paramName === 'messageType') return 'text';
						if (paramName === 'text') return 'Message 2';
						if (paramName === 'scheduleMode') return 'time';
						if (paramName === 'scheduleTime') return futureTime2;
						if (paramName === 'additionalFields') return {};
					}
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock)
				.mockResolvedValueOnce({ scheduled_message_id: 'SM_1' })
				.mockResolvedValueOnce({ scheduled_message_id: 'SM_2' });

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(2);
			expect(result[0].json).toHaveProperty('scheduled_message_id', 'SM_1');
			expect(result[1].json).toHaveProperty('scheduled_message_id', 'SM_2');
		});

		it('should URL encode chat ID', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			const futureTime = Date.now() + 3600000; // 1 hour from now

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return futureTime;
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);
			const validateChatIdSpy = jest
				.spyOn(utils, 'validateChatId')
				.mockReturnValue('CT special/chars');

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_123',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.stringContaining(encodeURIComponent('CT special/chars')),
				expect.any(Object),
			);
			validateChatIdSpy.mockRestore();
		});

		it('should throw error for non-string text', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 123,
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				additionalFields: {},
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Text must be a string');
		});

		it('should throw error for text exceeding 4096 characters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const longText = 'a'.repeat(4097);

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: longText,
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				additionalFields: {},
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Text message is too long');
		});

		it('should handle top-level scheduleTimezone parameter', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return futureTime;
					if (paramName === 'scheduleTimezone') return 'America/New_York';
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_123',
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_timezone: 'America/New_York',
				}),
			);
		});

		it('should treat whitespace scheduleFieldVisibility as guided mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleFieldVisibility: '   ',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: futureTime,
				scheduleTimezone: 'America/New_York',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_123',
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					text: 'Hello',
					schedule_timezone: 'America/New_York',
				}),
			);
		});

		it('should reject invalid IANA schedule timezones before calling the API', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello scheduled!';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return futureTime;
					if (paramName === 'scheduleTimezone') return 'Fake/Timezone';
					return undefined;
				},
			);

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(
				'Invalid timezone. Provide a valid IANA timezone such as America/New_York, Europe/London, or Asia/Kolkata.',
			);
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should handle scheduleMode status', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return '1234567890';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'status';
					if (paramName === 'scheduleStatus') return 'check_in';
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_123',
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_status: 'check_in',
				}),
			);
		});

		it('should force time-based scheduling for the Thread resource even if scheduleMode is set to status', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string, _itemIndex?: number, fallback?: unknown) => {
					if (paramName === 'resource') return 'thread';
					if (paramName === 'chatId') return 'CT_123_456-T-789';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello thread';
					if (paramName === 'scheduleMode') return 'status';
					if (paramName === 'scheduleStatus') return 'not-a-valid-status';
					if (paramName === 'scheduleTime') return futureTime;
					if (paramName === 'scheduleFieldVisibility') return 'guided';
					return fallback;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_THREAD_123',
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toHaveLength(1);
			expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
				1,
				'POST',
				'/api/v2/chats/CT_123_456-T-789/scheduledmessages',
				expect.objectContaining({
					text: 'Hello thread',
					schedule_time: expect.any(String),
				}),
			);
			expect(mockZohoCliqApiRequest.mock.calls[0][2]).not.toHaveProperty('schedule_status');
		});

		it('should return direct-message chat guidance for bot-conversation chat IDs in status-based scheduling', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_2218621746656928414_841692385-B2';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'status';
					if (paramName === 'scheduleStatus') return 'check_in';
					return undefined;
				},
			);

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toMatchObject({
				success: false,
				reason: 'INVALID_CHAT_ID_FOR_STATUS_SCHEDULE',
				resource: 'message',
				operation: 'scheduleMessage',
				chat_id: 'CT_2218621746656928414_841692385-B2',
				schedule_mode: 'status',
			});
			expect(String(result[0].json.hint)).toContain('starts with a number');
			expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
		});

		it('should return INVALID_CHAT_ID guidance for time-based scheduling when a non-chat identifier is provided', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setupParameterMock({
				chatId: 'P1234567890123456789',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toMatchObject({
				success: false,
				reason: 'INVALID_CHAT_ID',
				resource: 'message',
				operation: 'scheduleMessage',
				chat_id: 'P1234567890123456789',
				schedule_mode: 'time',
			});
			expect(String(result[0].json.hint)).toContain("Chat ID must start with a number or 'CT_'");
		});

		it('should return direct-message chat guidance for status-based scheduling when chat ID starts with CT_', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'status',
				scheduleStatus: 'check_in',
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toMatchObject({
				success: false,
				reason: 'INVALID_CHAT_ID_FOR_STATUS_SCHEDULE',
				resource: 'message',
				operation: 'scheduleMessage',
				chat_id: 'CT_123_456',
				schedule_mode: 'status',
			});
			expect(String(result[0].json.hint)).toContain('starts with a number');
		});

		it('should schedule rich message payload', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'rich',
				richMessage: {
					text: 'Rich scheduled message',
					cardTitle: 'Schedule Card',
					buttons: {
						button: [
							{
								label: 'Open',
								type: '+',
								actionType: 'open.url',
								actionDataInputMode: 'raw',
								actionData: { url: 'https://example.com' },
							},
						],
					},
				},
				scheduleMode: 'time',
				scheduleTime: futureTime,
				additionalFields: {},
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_200',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			const [, , requestBody] = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(requestBody).toMatchObject({
				text: 'Rich scheduled message',
				card: JSON.stringify({ title: 'Schedule Card' }),
			});
			expect(requestBody).toHaveProperty('buttons', expect.any(String));
		});

		it('should parse ISO basic schedule time string', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return '20270109T143000';
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_124',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_time: '20270109T143000',
				}),
			);
		});

		it('should parse ISO extended schedule time string and normalize to ISO basic', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return '2027-01-09T14:30:00';
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_125',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_time: '20270109T143000',
				}),
			);
		});

		it('should parse RFC2822 schedule time string via Date.parse fallback', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return 'Fri, 09 Jan 2027 14:30:00 GMT';
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_126',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_time: '20270109T143000',
				}),
			);
		});

		it('should throw for non-string non-number schedule time', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return true;
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(
				'Schedule Time must be a valid date/time value, Unix timestamp (milliseconds), or yyyyMMddTHHmmss string.',
			);
		});

		it('should throw for empty schedule time string after trimming', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return '   ';
					return undefined;
				},
			);

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Schedule Time is required.');
		});

		it('should parse numeric schedule time provided as a string', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const scheduleTimestamp = Date.UTC(2030, 0, 1, 0, 0, 0);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return String(scheduleTimestamp);
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_126',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_time: '20300101T000000',
				}),
			);
		});

		it('should parse ISO UTC schedule time deterministically', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const scheduleTime = '2027-01-09T14:30:00Z';

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return scheduleTime;
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_127',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_time: '20270109T143000',
				}),
			);
		});

		it('should parse ISO extended schedule time without seconds', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return '2027-01-09T14:30';
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_127A',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_time: '20270109T143000',
				}),
			);
		});

		it('should parse ISO extended schedule time with timezone offset and preserve wall time', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return '2030-01-09T14:30:00.000-05:00';
					if (paramName === 'scheduleTimezone') return 'America/New_York';
					return undefined;
				},
			);

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_127B',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					schedule_time: '20300109T143000',
					schedule_timezone: 'America/New_York',
				}),
			);
		});

		it('should throw for invalid schedule time string', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return 'not-a-time';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Schedule Time must be a valid date/time value or yyyyMMddTHHmmss string.');
		});

		it('should throw for extremely large numeric schedule time strings', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const hugeNumericString = '9'.repeat(400);

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return hugeNumericString;
					return undefined;
				},
			);

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Schedule Time must be a valid date/time value or yyyyMMddTHHmmss string.');
		});

		it('should throw for invalid schedule mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello';
					if (paramName === 'scheduleMode') return 'invalid-mode';
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid schedule mode');
		});

		it('should include bot_unique_name query when scheduling as bot', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello bot schedule',
				scheduleMode: 'time',
				scheduleTime: futureTime,
				postAsBot: true,
				botUniqueName: 'supportbot',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_128',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				expect.any(String),
				expect.objectContaining({
					text: 'Hello bot schedule',
				}),
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should use agent-setup schedule fields when schedule field visibility is agent', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleFieldVisibility: 'agent',
				scheduleMode: 'time',
				agentScheduleTime: futureTime,
				agentScheduleTimezone: 'America/New_York',
				messageType: 'text',
				text: 'Hello agent schedule',
				agentPostAsBot: true,
				agentBotUniqueName: 'supportbot',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_129',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123_456/scheduledmessages',
				expect.objectContaining({
					text: 'Hello agent schedule',
					schedule_timezone: 'America/New_York',
				}),
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should throw for invalid schedule field visibility mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleFieldVisibility: 'invalid',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				messageType: 'text',
				text: 'Hello',
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Invalid schedule field visibility mode');
		});

		it('should require agent bot unique name when agent post-as-bot is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleFieldVisibility: 'agent',
				scheduleMode: 'time',
				agentScheduleTime: Date.now() + 3600000,
				messageType: 'text',
				text: 'Hello',
				agentPostAsBot: true,
				agentBotUniqueName: '',
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow(
				'Bot Unique Name is required when Post as Bot is enabled for a time-based scheduled message',
			);
		});

		it('should reject agent bot unique names with invalid characters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleFieldVisibility: 'agent',
				scheduleMode: 'time',
				agentScheduleTime: Date.now() + 3600000,
				messageType: 'text',
				text: 'Hello',
				agentPostAsBot: true,
				agentBotUniqueName: 'support-bot',
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Bot Unique Name must contain only letters and numbers');
		});

		it('should reject agent bot unique names longer than 100 characters', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleFieldVisibility: 'agent',
				scheduleMode: 'time',
				agentScheduleTime: Date.now() + 3600000,
				messageType: 'text',
				text: 'Hello',
				agentPostAsBot: true,
				agentBotUniqueName: 'a'.repeat(101),
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Bot Unique Name is too long. Maximum length is 100 characters');
		});

		it('should preserve an explicitly provided JSON bot object without merging guided bot identity fields', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				messageType: 'json',
				jsonBody: {
					text: 'Hello agent schedule',
					bot: {
						theme: 'amber',
					},
				},
				postAsBot: true,
				botUniqueName: 'supportbot',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_130',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123_456/scheduledmessages',
				expect.objectContaining({
					text: 'Hello agent schedule',
					bot: {
						theme: 'amber',
					},
				}),
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should not attach a bot payload object when posting as bot from plain text mode', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
				messageType: 'text',
				text: 'Hello guided bot schedule',
				postAsBot: true,
				botUniqueName: 'supportbot',
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_132',
			});

			await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			const [, , requestBody] = (mockZohoCliqApiRequest as jest.Mock).mock.calls[0];
			expect(requestBody).not.toHaveProperty('bot');
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'POST',
				'/api/v2/chats/CT_123_456/scheduledmessages',
				expect.objectContaining({
					text: 'Hello guided bot schedule',
				}),
				{ bot_unique_name: 'supportbot' },
			);
		});

		it('should skip bot-only validation for status mode when postAsBot input is not boolean', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: '1234567890',
				scheduleFieldVisibility: 'agent',
				scheduleMode: 'status',
				agentScheduleStatus: 'check_in',
				messageType: 'text',
				text: 'Hello',
				agentPostAsBot: 'true',
				agentBotUniqueName: '',
				simplify: false,
			});

			(mockZohoCliqApiRequest as jest.Mock).mockResolvedValue({
				scheduled_message_id: 'SM_131',
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toEqual({
				scheduled_message_id: 'SM_131',
			});
		});

		it('should reject Post as Bot for status-based scheduling', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: '1234567890',
				messageType: 'text',
				text: 'Hello bot schedule',
				scheduleMode: 'status',
				scheduleStatus: 'check_in',
				postAsBot: true,
				botUniqueName: 'supportbot',
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Post as Bot is only supported for time-based scheduled messages.');
		});

		it('should throw when postAsBot is not a boolean', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
				(paramName: string) => {
					if (paramName === 'chatId') return 'CT_123_456';
					if (paramName === 'messageType') return 'text';
					if (paramName === 'text') return 'Hello bot schedule';
					if (paramName === 'scheduleMode') return 'time';
					if (paramName === 'scheduleTime') return Date.now() + 3600000;
					if (paramName === 'postAsBot') {
						return 'true';
					}
					if (paramName === 'additionalFields') return {};
					return undefined;
				},
			);

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('postAsBot must be a boolean');
		});

		it('should return raw JSON guidance in recoverable mode when scheduled JSON payload is missing text', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'json',
				jsonBody: {},
				scheduleMode: 'time',
				scheduleTime: Date.now() + 3600000,
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result[0].json).toMatchObject({
				success: false,
				reason: 'INVALID_RAW_JSON_PAYLOAD',
				resource: 'message',
				operation: 'scheduleMessage',
				message_type: 'json',
			});
			expect(String(result[0].json.hint)).toContain('top-level `text` string');
		});

		it('should throw when scope policy is misconfigured', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.SCHEDULE_MESSAGES_CREATE;
			const actualPolicy = scopeRegistry.getOperationScopePolicy('shared', 'scheduleMessage');
			expect(actualPolicy).toBeDefined();

			jest.spyOn(scopeRegistry, 'getOperationScopePolicy').mockReturnValue({
				...actualPolicy!,
				requiredScopes: [],
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Scope registry misconfiguration for shared.scheduleMessage.');
		});

		it('should return scope payload per item when continueOnFail is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = SCOPES.SCHEDULE_MESSAGES_CREATE;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			jest.spyOn(utils, 'checkRequiredScope').mockImplementation(() => {
				throw {
					zohoCliqScopeErrorPayload: {
						success: false,
						requiredScopes: [SCOPES.SCHEDULE_MESSAGES_CREATE],
						missingScopes: [SCOPES.SCHEDULE_MESSAGES_CREATE],
					},
				};
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						requiredScopes: [SCOPES.SCHEDULE_MESSAGES_CREATE],
						missingScopes: [SCOPES.SCHEDULE_MESSAGES_CREATE],
					}),
				},
			]);
		});

		it('should return generic error payload when continueOnFail is enabled and scope payload is missing', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: futureTime,
			});
			mockZohoCliqApiRequest.mockRejectedValue(new Error('Create scheduled message failed'));

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						chat_id: 'CT_123_456',
						success: false,
						message: 'Create scheduled message failed',
						message_type: 'text',
						operation: 'scheduleMessage',
						resource: 'message',
						schedule_field_visibility: 'guided',
						schedule_mode: 'time',
					},
				},
			]);
		});

		it('should return a mapped recoverable payload with schedule timezone context when continueOnFail is enabled', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;
			const futureTime = Date.now() + 3600000;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: futureTime,
				scheduleTimezone: '  America/New_York  ',
			});
			mockZohoCliqApiRequest.mockRejectedValue({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						chat_id: 'CT_123_456',
						success: false,
						hint: 'Use a valid chat ID that belongs to a conversation accessible to the authenticated Zoho Cliq account. If you intended a channel conversation, use the conversation chat ID rather than the channel ID.',
						message: 'No chat found for Chat ID "CT_123_456".',
						message_type: 'text',
						operation: 'scheduleMessage',
						reason: 'CHAT_NOT_FOUND',
						resource: 'message',
						schedule_field_visibility: 'guided',
						schedule_mode: 'time',
						schedule_timezone: 'America/New_York',
					},
				},
			]);
		});

		it('should return CHAT_NOT_FOUND guidance when the schedule-message chat identifier is rejected', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const futureTime = Date.now() + 3600000;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			setupParameterMock({
				chatId: '  CT_missing_chat  ',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: futureTime,
				scheduleTimezone: 'America/New_York',
			});
			mockZohoCliqApiRequest.mockRejectedValueOnce({
				message: 'Request URL is invalid',
				response: { statusCode: 404 },
			});

			const result = await scheduleMessage.execute.call(
				mockExecuteFunctions,
				items,
				scheduleMessageScopes,
			);

			expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
			expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
				'GET',
				'/api/v2/chats/CT_missing_chat/members',
				{},
				{},
			);
			expect(result[0].json).toEqual(
				expect.objectContaining({
					chat_id: 'CT_missing_chat',
					success: false,
					operation: 'scheduleMessage',
					reason: 'CHAT_NOT_FOUND',
				}),
			);
		});

		it('should return generic error payload when continueOnFail is enabled and a non-object error is thrown', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
			jest.spyOn(utils, 'checkRequiredScope').mockImplementation(() => {
				throw 'scope check hard failure';
			});

			const result = await scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes);

			expect(result).toEqual([
				{
					json: {
						success: false,
						message: 'scope check hard failure',
						operation: 'scheduleMessage',
						resource: 'message',
					},
				},
			]);
		});

		it('should throw when ISO-extended schedule time matches pattern but parses to invalid timestamp', async () => {
			const items: INodeExecutionData[] = [{ json: {} }];
			const grantedScopes = scheduleMessageScopes;

			setupParameterMock({
				chatId: 'CT_123_456',
				messageType: 'text',
				text: 'Hello',
				scheduleMode: 'time',
				scheduleTime: '2027-13-09T14:30:00Z',
			});

			await expect(
				scheduleMessage.execute.call(mockExecuteFunctions, items, grantedScopes),
			).rejects.toThrow('Schedule Time must be a valid date/time value or yyyyMMddTHHmmss string.');
		});
	});

	describe('description', () => {
		it('should have required properties', () => {
			expect(scheduleMessage.description).toBeDefined();
			expect(Array.isArray(scheduleMessage.description)).toBe(true);
			expect(scheduleMessage.description.length).toBeGreaterThan(0);
		});

		it('should have chatId parameter', () => {
			const chatIdParam = scheduleMessage.description.find((p) => p.name === 'chatId');
			expect(chatIdParam).toBeDefined();
			expect(chatIdParam?.required).toBe(true);
		});

		it('should have text parameter', () => {
			const textParam = scheduleMessage.description.find((p) => p.name === 'text');
			expect(textParam).toBeDefined();
			expect(textParam?.required).toBe(false);
		});

		it('should define markdown guidance toggle and conditional notice under plain text mode', () => {
			const showGuidanceParam = scheduleMessage.description.find(
				(p) => p.name === 'showCliqMarkdownGuidance',
			);
			const markdownNotice = scheduleMessage.description.find(
				(p) => p.name === 'plainTextMarkdownNotice',
			);
			expect(showGuidanceParam?.type).toBe('boolean');
			expect(showGuidanceParam?.default).toBe(false);
			expect(showGuidanceParam?.displayOptions?.show).toMatchObject({
				messageType: ['text'],
			});
			expect(markdownNotice?.displayOptions?.show).toMatchObject({
				messageType: ['text'],
				showCliqMarkdownGuidance: [true],
			});
		});

		it('should order plain text fields as text -> markdown toggle -> markdown notice -> addMention', () => {
			const names = scheduleMessage.description.map((p) => p.name);
			const textIndex = names.indexOf('text');
			const toggleIndex = names.indexOf('showCliqMarkdownGuidance');
			const noticeIndex = names.indexOf('plainTextMarkdownNotice');
			const addMentionIndex = names.indexOf('addMention');
			expect(textIndex).toBeGreaterThan(-1);
			expect(toggleIndex).toBeGreaterThan(textIndex);
			expect(noticeIndex).toBeGreaterThan(toggleIndex);
			expect(addMentionIndex).toBeGreaterThan(noticeIndex);
		});

		it('should have messageType parameter', () => {
			const messageTypeParam = scheduleMessage.description.find((p) => p.name === 'messageType');
			expect(messageTypeParam).toBeDefined();
		});

		it('should allow expressions for schedule mode and schedule status', () => {
			const scheduleFieldVisibilityParam = scheduleMessage.description.find(
				(p) => p.name === 'scheduleFieldVisibility',
			);
			const scheduleModeParam = scheduleMessage.description.find((p) => p.name === 'scheduleMode');
			const scheduleStatusParam = scheduleMessage.description.find(
				(p) => p.name === 'scheduleStatus',
			);

			expect(scheduleFieldVisibilityParam).toBeDefined();
			expect(scheduleFieldVisibilityParam?.noDataExpression).toBe(true);
			expect(scheduleModeParam).toBeDefined();
			expect(scheduleStatusParam).toBeDefined();
			expect(scheduleModeParam?.noDataExpression).toBeUndefined();
			expect(scheduleStatusParam?.noDataExpression).toBeUndefined();
		});

		it('keeps Text and JSON available when Message Type is expression-driven', () => {
			const textParam = scheduleMessage.description.find((p) => p.name === 'text');
			const jsonParam = scheduleMessage.description.find((p) => p.name === 'jsonBody');

			expect(textParam).toBeDefined();
			expect(jsonParam).toBeDefined();
			expect(textParam?.displayOptions?.show?.messageType).toBeUndefined();
			expect(jsonParam?.displayOptions?.show?.messageType).toBeUndefined();
		});

		it('should have scheduleTime parameter', () => {
			const scheduleTimeParam = scheduleMessage.description.find((p) => p.name === 'scheduleTime');
			expect(scheduleTimeParam).toBeDefined();
			expect(scheduleTimeParam?.required).toBe(true);
			expect(scheduleTimeParam?.type).toBe('dateTime');
		});

		it('keeps guided schedule fields conditionally rendered for standard workflows', () => {
			const scheduleTimeParam = scheduleMessage.description.find((p) => p.name === 'scheduleTime');
			const scheduleTimezoneParam = scheduleMessage.description.find(
				(p) => p.name === 'scheduleTimezone',
			);
			const scheduleStatusParam = scheduleMessage.description.find(
				(p) => p.name === 'scheduleStatus',
			);

			expect(scheduleTimeParam?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['time'],
			});
			expect(scheduleTimezoneParam?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['time'],
			});
			expect(scheduleStatusParam?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['status'],
			});
			expect(scheduleTimeParam?.required).toBe(true);
			expect(scheduleStatusParam?.required).toBe(true);
		});

		it('keeps time and status scheduling fields available in Agent Setup mode', () => {
			const agentScheduleTimeParam = scheduleMessage.description.find(
				(p) => p.name === 'agentScheduleTime',
			);
			const agentScheduleTimezoneParam = scheduleMessage.description.find(
				(p) => p.name === 'agentScheduleTimezone',
			);
			const agentScheduleStatusParam = scheduleMessage.description.find(
				(p) => p.name === 'agentScheduleStatus',
			);

			expect(agentScheduleTimeParam?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['agent'],
			});
			expect(agentScheduleTimezoneParam?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['agent'],
			});
			expect(agentScheduleStatusParam?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['agent'],
			});
			expect(agentScheduleTimeParam?.displayOptions?.show?.scheduleMode).toBeUndefined();
			expect(agentScheduleStatusParam?.displayOptions?.show?.scheduleMode).toBeUndefined();
		});

		it('should define top-level schedule timezone field and notice', () => {
			const scheduleTimezone = scheduleMessage.description.find(
				(p) => p.name === 'scheduleTimezone',
			);
			expect(scheduleTimezone?.type).toBe('string');
			const timezoneNotice = scheduleMessage.description.find(
				(p) => p.name === 'scheduleTimezoneDocsNotice',
			);
			expect(timezoneNotice?.type).toBe('notice');
		});

		it('should define status-mode conversation guidance notice', () => {
			const statusNotice = scheduleMessage.description.find(
				(p) => p.name === 'scheduleStatusConversationNotice',
			);
			expect(statusNotice).toBeDefined();
			expect(statusNotice?.type).toBe('notice');
			expect(statusNotice?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['status'],
			});
			expect(statusNotice?.displayName).toContain('Channel and group chat IDs are not supported');
		});

		it('should hide postAsBot when schedule mode is status', () => {
			const postAsBot = scheduleMessage.description.find((p) => p.name === 'postAsBot');
			expect(postAsBot).toBeDefined();
			expect(postAsBot?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['time'],
			});
		});

		it('should preserve bot identity field visibility rules while adding schedule mode guard', () => {
			const botUniqueName = scheduleMessage.description.find((p) => p.name === 'botUniqueName');
			const botDisplayName = scheduleMessage.description.find((p) => p.name === 'botDisplayName');
			const botImage = scheduleMessage.description.find((p) => p.name === 'botImage');
			const agentBotUniqueName = scheduleMessage.description.find(
				(p) => p.name === 'agentBotUniqueName',
			);
			const agentBotDisplayName = scheduleMessage.description.find(
				(p) => p.name === 'agentBotDisplayName',
			);
			const agentBotImage = scheduleMessage.description.find((p) => p.name === 'agentBotImage');
			expect(botUniqueName).toBeDefined();
			expect(botUniqueName?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['guided'],
				scheduleMode: ['time'],
			});
			expect(botUniqueName?.displayOptions?.show?.postAsBot).toBeUndefined();
			expect(botUniqueName?.required).toBe(false);
			expect(botDisplayName).toBeUndefined();
			expect(botImage).toBeUndefined();
			expect(agentBotUniqueName?.displayOptions?.show).toMatchObject({
				scheduleFieldVisibility: ['agent'],
			});
			expect(agentBotDisplayName).toBeUndefined();
			expect(agentBotImage).toBeUndefined();
		});
	});
});
