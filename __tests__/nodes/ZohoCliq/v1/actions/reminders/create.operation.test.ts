import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/create.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Reminders - Create Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: Record<string, unknown> = {},
		options: { continueOnFail?: boolean; enableAiErrorMode?: unknown } = {},
	): IExecuteFunctions => {
		const { continueOnFail = false, enableAiErrorMode = false } = options;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name in values) return values[name];
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
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

	it('should create a self reminder successfully in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: 'Pay bills',
			time: 1767225600000,
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_123' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Pay bills',
			time: '1767225600000',
		});
	});

	it('should create a message reminder with explicit content and datetime input', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			content: 'Follow up on this',
			time: '2026-03-01T10:00:00Z',
			userIds: 'user_123',
			chatId: 'CT_123',
			messageId: '1772395354414_196142356543',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_901' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Follow up on this',
			time: '1772359200000',
			user_ids: ['user_123'],
			chat_id: 'CT_123',
			message_id: 1772395354414,
		});
	});

	it('should accept a trimmed create type expression for user reminders', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: ' users ',
			content: 'Review draft',
			time: '2026-03-03T12:00:00Z',
			userIds: 'user_123,user_234',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_456' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Review draft',
			time: '1772539200000',
			user_ids: ['user_123', 'user_234'],
		});
	});

	it('should create a user reminder successfully in agent/tool setup mode', async () => {
		const context = createContext({
			inputMode: 'agentTool',
			agentToolCreateType: 'users',
			agentToolContent: 'Review draft',
			agentToolTime: '2026-03-03T12:00:00Z',
			agentToolUserIds: 'user_123,user_234',
			agentToolChatId: '',
			agentToolMessageId: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_556' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Review draft',
			time: '1772539200000',
			user_ids: ['user_123', 'user_234'],
		});
	});

	it('should create a chat reminder in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'chat',
			content: 'Post release notes',
			time: '2026-03-03T12:00:00Z',
			chatId: 'CT_123',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_789' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Post release notes',
			time: '1772539200000',
			chat_ids: ['CT_123'],
		});
	});

	it('should create a chat reminder in agent/tool setup mode using a single chat ID field', async () => {
		const context = createContext({
			inputMode: 'agentTool',
			agentToolCreateType: 'chat',
			agentToolContent: 'Post release notes',
			agentToolTime: '2026-03-03T12:00:00Z',
			agentToolChatId: '1277744356562927809',
			agentToolUserIds: '',
			agentToolMessageId: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_790' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Post release notes',
			time: '1772539200000',
			chat_ids: ['1277744356562927809'],
		});
	});

	it('should create a message reminder in structured mode without content or user IDs', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			content: '   ',
			time: '2026-03-01T10:00:00Z',
			userIds: '   ',
			chatId: 'CT_123',
			messageId: '1772395354414_196142356543',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_900' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			time: '1772359200000',
			chat_id: 'CT_123',
			message_id: 1772395354414,
		});
	});

	it('should create a message reminder in agent/tool setup mode without content', async () => {
		const context = createContext({
			inputMode: 'agentTool',
			agentToolCreateType: 'message',
			agentToolContent: '   ',
			agentToolTime: '2026-03-01T10:00:00Z',
			agentToolUserIds: 'user_123',
			agentToolChatId: 'CT_123',
			agentToolMessageId: '1772395354414_196142356543',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_901' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			time: '1772359200000',
			user_ids: ['user_123'],
			chat_id: 'CT_123',
			message_id: 1772395354414,
		});
	});

	it('should create a message reminder when content is undefined', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			content: undefined,
			time: '2026-03-01T10:00:00Z',
			userIds: 'user_123',
			chatId: 'CT_123',
			messageId: '1772395354414_196142356543',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_902' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			time: '1772359200000',
			user_ids: ['user_123'],
			chat_id: 'CT_123',
			message_id: 1772395354414,
		});
	});

	it('should accept array user IDs and non-string content values in message structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			content: 42,
			time: '2026-03-01T10:00:00Z',
			userIds: ['user_123', 'user_234'],
			chatId: 'CT_123',
			messageId: '1772395354414_196142356543',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_903' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: '42',
			time: '1772359200000',
			user_ids: ['user_123', 'user_234'],
			chat_id: 'CT_123',
			message_id: 1772395354414,
		});
	});

	it('should omit message user_ids when the provided array only contains blank values', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			time: '2026-03-01T10:00:00Z',
			userIds: ['   ', ''],
			chatId: 'CT_123',
			messageId: '1772395354414_196142356543',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_904' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			time: '1772359200000',
			chat_id: 'CT_123',
			message_id: 1772395354414,
		});
	});

	it('should omit message user_ids when the provided array only contains nullish values', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			time: '2026-03-01T10:00:00Z',
			userIds: [undefined, null],
			chatId: 'CT_123',
			messageId: '1772395354414_196142356543',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_905' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			time: '1772359200000',
			chat_id: 'CT_123',
			message_id: 1772395354414,
		});
	});

	it('should create a reminder successfully in raw mode from stringified JSON', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition:
				'{"message_id":"1772395354414_196142356543","chat_id":"CT_123","time":"2026-03-01T10:00:00Z"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_777' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			time: '1772359200000',
			message_id: 1772395354414,
			chat_id: 'CT_123',
		});
	});

	it('should accept an ISO 8601 time string in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: '{"content":"Check launch","time":"2026-03-02T09:30:00Z"}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_778' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Check launch',
			time: '1772443800000',
		});
	});

	it('should accept a Unix-millisecond time value in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: '{"content":"Check launch","time":1772443800000}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_779' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Check launch',
			time: '1772443800000',
		});
	});

	it('should create a chat reminder successfully in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition:
				'{"content":"Post release notes","time":"2026-03-03T12:00:00Z","chat_ids":["CT_123"]}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_780' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Post release notes',
			time: '1772539200000',
			chat_ids: ['CT_123'],
		});
	});

	it('should omit blank time values in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: 'Ship release',
			time: '   ',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_904' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Ship release',
		});
	});

	it('should omit undefined time values in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: 'Ship release',
			time: undefined,
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_907' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Ship release',
		});
	});

	it('should omit blank time values in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: '{"content":"Ship release","time":"   "}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_905' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Ship release',
		});
	});

	it('should omit null time values in raw mode', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: '{"content":"Ship release","time":null}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_906' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Ship release',
		});
	});

	it('should return an empty object when the API returns null', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: 'Check calendar',
		});
		mockZohoCliqApiRequest.mockResolvedValue(null as unknown as Record<string, never>);

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual({});
	});

	it('should pass through primitive create reminder responses unchanged when the API returns a non-object value', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: 'Check calendar',
		});
		mockZohoCliqApiRequest.mockResolvedValue('created' as unknown as Record<string, never>);

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toBe('created');
	});

	it('should normalize encoded nested message msguid fields in create reminder responses for message reminders', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			time: '2026-03-17T16:40:00Z',
			userIds: '839367970',
			chatId: 'CT_2243232129214974797_841692385',
			messageId: '1773676805202_412172172370',
		});
		mockZohoCliqApiRequest.mockResolvedValue([
			{
				id: '5452022000003668009',
				message: {
					msguid: '1773676805202%20412172172370',
					lmsguid: '1773676805167%20407877205039',
					chat_id: 'CT_2243232129214974797_841692385',
				},
			},
		] as unknown as Record<string, never>);

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual([
			{
				id: '5452022000003668009',
				message: {
					msguid: '1773676805202_412172172370',
					lmsguid: '1773676805167_407877205039',
					chat_id: 'CT_2243232129214974797_841692385',
				},
			},
		]);
	});

	it('should leave nested message uid fields unchanged when they are not strings', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			time: '2026-03-17T16:40:00Z',
			userIds: '839367970',
			chatId: 'CT_2243232129214974797_841692385',
			messageId: '1773676805202_412172172370',
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			id: '5452022000003668010',
			message: {
				msguid: 1773676805202,
				lmsguid: null,
				chat_id: 'CT_2243232129214974797_841692385',
			},
		});

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual({
			id: '5452022000003668010',
			message: {
				msguid: 1773676805202,
				lmsguid: null,
				chat_id: 'CT_2243232129214974797_841692385',
			},
		});
	});

	it('should reject reminder definitions that omit both content and message_id after validation', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: { user_ids: ['user_123'] },
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Content is required when create_type is users',
		);
	});

	it('should reject self reminders without content in raw mode when only time is provided', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: { time: '2026-03-01T10:00:00Z' },
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Content is required when create_type is self',
		);
	});

	it('should reject self reminders without content in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: '   ',
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Content is required when create_type is self',
		);
	});

	it('should reject raw user reminders without time after inferring the users variant', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: { content: 'Review draft', user_ids: ['user_123'] },
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Time is required when create_type is users',
		);
	});

	it('should reject raw chat reminders without content after inferring the chat variant', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: { time: '2026-03-03T12:00:00Z', chat_ids: ['CT_123'] },
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Content is required when create_type is chat',
		);
	});

	it('should reject raw chat reminders without time after inferring the chat variant', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: { content: 'Post release notes', chat_ids: ['CT_123'] },
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Time is required when create_type is chat',
		);
	});

	it('should reject raw message reminders without chat ID after inferring the message variant', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: {
				time: '2026-03-01T10:00:00Z',
				message_id: '1772395354414_196142356543',
			},
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Chat ID is required when create_type is message',
		);
	});

	it('should reject raw message reminders without message ID after inferring the message variant', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: { time: '2026-03-01T10:00:00Z', chat_id: 'CT_123' },
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Message ID is required when create_type is message',
		);
	});

	it('should reject raw message reminders without time after inferring the message variant', async () => {
		const context = createContext({
			inputMode: 'raw',
			reminderDefinition: {
				chat_id: 'CT_123',
				message_id: '1772395354414_196142356543',
			},
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Time is required when create_type is message',
		);
	});

	it('should reject user reminders without time in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'users',
			content: 'Review draft',
			userIds: 'user_123',
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Time is required when create_type is users',
		);
	});

	it('should reject chat reminders without time in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'chat',
			content: 'Post release notes',
			chatId: 'CT_123',
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Time is required when create_type is chat',
		);
	});

	it('should reject message reminders without time in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'message',
			userIds: 'user_123',
			chatId: 'CT_123',
			messageId: '1772395354414_196142356543',
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Time is required when create_type is message',
		);
	});

	it('should ignore optional user IDs for chat reminders in agent/tool setup mode', async () => {
		const context = createContext({
			inputMode: 'agentTool',
			agentToolCreateType: 'chat',
			agentToolContent: 'Post release notes',
			agentToolTime: '2026-03-03T12:00:00Z',
			agentToolChatId: '1277744356562927809',
			agentToolUserIds: 'user_123,user_234',
			agentToolMessageId: '',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_791' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Post release notes',
			time: '1772539200000',
			chat_ids: ['1277744356562927809'],
		});
	});

	it('should reject invalid chat IDs in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'chat',
			content: 'Post release notes',
			time: '2026-03-03T12:00:00Z',
			chatId: 'CT_123,CT_456',
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Invalid Chat ID format',
		);
	});

	it('should reject empty chat ID in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'chat',
			content: 'Post release notes',
			time: '2026-03-03T12:00:00Z',
			chatId: '   ',
		});

		await expect(create.execute.call(context, items, SCOPES.REMINDERS_CREATE)).rejects.toThrow(
			'Chat ID is required when create_type is chat',
		);
	});

	it('should expose agent/tool setup mode with always-visible tool fields in the description', () => {
		const inputModeProperty = create.description.find((prop) => prop.name === 'inputMode');
		const inputModeOptions = (inputModeProperty?.options ?? []) as Array<{ value?: string }>;
		const optionValues = inputModeOptions.map((option) => option.value);

		expect(optionValues).toEqual(expect.arrayContaining(['structured', 'agentTool', 'raw']));
		expect(
			create.description.find((prop) => prop.name === 'agentToolCreateType')?.displayOptions?.show
				?.inputMode,
		).toEqual(['agentTool']);
		expect(
			create.description.find((prop) => prop.name === 'agentToolUserIds')?.displayOptions?.show
				?.inputMode,
		).toEqual(['agentTool']);
		expect(create.description.find((prop) => prop.name === 'chatIds')).toBeUndefined();
		expect(create.description.find((prop) => prop.name === 'agentToolChatIds')).toBeUndefined();
		expect(create.description.find((prop) => prop.name === 'includeTime')).toBeUndefined();
		expect(create.description.find((prop) => prop.name === 'agentToolIncludeTime')).toBeUndefined();
		expect(
			create.description.find((prop) => prop.name === 'time')?.displayOptions?.show?.inputMode,
		).toEqual(['structured']);
		expect(
			create.description.find((prop) => prop.name === 'agentToolChatId')?.displayOptions?.show
				?.inputMode,
		).toEqual(['agentTool']);
		expect(
			create.description.find((prop) => prop.name === 'agentToolMessageId')?.displayOptions?.show
				?.inputMode,
		).toEqual(['agentTool']);
	});

	it('should throw error for missing OAuth scope when recoverable mode is disabled', async () => {
		const context = createContext();
		const requiredScope = getRequiredScopeForOperation('reminders', 'create');

		let thrownError: unknown;
		try {
			await create.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
	});

	it('should return a recoverable validation error when continueOnFail is enabled', async () => {
		const context = createContext(
			{
				inputMode: 'agentTool',
				agentToolCreateType: 'unknown',
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				reason: 'INVALID_CREATE_TYPE',
			}),
		);
	});

	it('should return a recoverable missing-time error with create-type context', async () => {
		const context = createContext(
			{
				inputMode: 'structured',
				createType: 'chat',
				content: 'Post release notes',
				chatId: 'CT_123',
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				input_mode: 'structured',
				create_type: 'chat',
				reason: 'MISSING_TIME',
				message: 'Time is required when create_type is chat',
			}),
		);
		expect(result[0].json.hint).toContain('Provide `time`');
	});

	it('should return a recoverable missing-user-ids error for users reminders', async () => {
		const context = createContext(
			{
				inputMode: 'agentTool',
				agentToolCreateType: 'users',
				agentToolContent: 'Review draft',
				agentToolTime: '2026-03-03T12:00:00Z',
				agentToolUserIds: '   ',
			},
			{ enableAiErrorMode: 'true' },
		);

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				input_mode: 'agentTool',
				create_type: 'users',
				reason: 'MISSING_USER_IDS',
				message: 'User IDs are required when create_type is users',
			}),
		);
		expect(result[0].json.hint).toContain('one to four exact Zoho Cliq user IDs');
	});

	it('should return USER_IDS_NOT_FOUND when shared preflight proves users reminder assignees are missing', async () => {
		const context = createContext(
			{
				inputMode: 'structured',
				createType: 'users',
				content: 'Review draft',
				time: '2026-03-03T12:00:00Z',
				userIds: 'user_missing',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [{ id: 'user_other' }],
		});

		const result = await create.execute.call(
			context,
			items,
			[SCOPES.REMINDERS_CREATE, getRequiredScopeForOperation('user', 'list')].join(','),
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			{ limit: 100, fields: 'display_name' },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				create_type: 'users',
				reason: 'USER_IDS_NOT_FOUND',
				message:
					'One or more reminder user IDs were not found. Missing user IDs: ["user_missing"].',
			}),
		);
	});

	it('should return CHAT_NOT_FOUND when shared preflight proves the target chat is missing for chat reminders', async () => {
		const context = createContext(
			{
				inputMode: 'structured',
				createType: 'chat',
				content: 'Post release notes',
				time: '2026-03-03T12:00:00Z',
				chatId: 'CT_missing',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			statusCode: 404,
			message: 'Chat not found',
		});

		const result = await create.execute.call(
			context,
			items,
			[SCOPES.REMINDERS_CREATE, getRequiredScopeForOperation('chat', 'getMembers')].join(','),
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_missing/members',
			{},
			{},
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				create_type: 'chat',
				reason: 'CHAT_NOT_FOUND',
				message: 'No chat found for Chat ID "CT_missing".',
			}),
		);
	});

	it('should return MESSAGE_NOT_FOUND when shared preflight proves the source message is missing', async () => {
		const context = createContext(
			{
				inputMode: 'structured',
				createType: 'message',
				time: '2026-03-01T10:00:00Z',
				chatId: 'CT_123',
				messageId: '1772395354414_196142356543',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({ members: [] }).mockRejectedValueOnce({
			statusCode: 404,
			message: 'Message not found',
		});

		const result = await create.execute.call(
			context,
			items,
			[
				SCOPES.REMINDERS_CREATE,
				getRequiredScopeForOperation('chat', 'getMembers'),
				getRequiredScopeForOperation('message', 'retrieve'),
			].join(','),
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_123/members',
			{},
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/chats/CT_123/messages/1772395354414',
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				create_type: 'message',
				reason: 'MESSAGE_NOT_FOUND',
			}),
		);
	});

	it('should return USER_IDS_NOT_FOUND when shared preflight proves message reminder assignees are missing', async () => {
		const context = createContext(
			{
				inputMode: 'structured',
				createType: 'message',
				time: '2026-03-01T10:00:00Z',
				userIds: 'user_missing',
				chatId: 'CT_123',
				messageId: '1772395354414_196142356543',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockResolvedValueOnce({
			users: [{ id: 'user_other' }],
		});

		const result = await create.execute.call(
			context,
			items,
			[SCOPES.REMINDERS_CREATE, getRequiredScopeForOperation('user', 'list')].join(','),
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users',
			{},
			{ limit: 100, fields: 'display_name' },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				create_type: 'message',
				reason: 'USER_IDS_NOT_FOUND',
				message:
					'One or more reminder user IDs were not found. Missing user IDs: ["user_missing"].',
			}),
		);
	});

	it('should return a recoverable missing-message-id error for message reminders', async () => {
		const context = createContext(
			{
				inputMode: 'structured',
				createType: 'message',
				time: '2026-03-01T10:00:00Z',
				chatId: 'CT_123',
				messageId: '   ',
			},
			{ continueOnFail: true },
		);

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				input_mode: 'structured',
				create_type: 'message',
				reason: 'MISSING_MESSAGE_ID',
				message: 'Message ID is required when create_type is message',
			}),
		);
		expect(result[0].json.hint).toContain('source `message_id`');
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createContext(
			{
				inputMode: 'structured',
				createType: 'self',
				content: 'Pay bills',
			},
			{ enableAiErrorMode: 'true' },
		);
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Bad request',
		});

		const result = await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'reminders',
				operation: 'create',
				status_code: 400,
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should use the single time field for ISO expressions in structured mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: 'Ship release',
			time: '2026-03-02T09:30:00Z',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_903' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Ship release',
			time: '1772443800000',
		});
	});

	it('should accept ISO 8601 time strings with timezone offsets in structured create mode', async () => {
		const context = createContext({
			inputMode: 'structured',
			createType: 'self',
			content: 'Ship release',
			time: '2026-03-19T09:30:00-04:00',
		});
		mockZohoCliqApiRequest.mockResolvedValue({ id: 'rem_908' });

		await create.execute.call(context, items, SCOPES.REMINDERS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/reminders', {
			content: 'Ship release',
			time: '1773927000000',
		});
	});

	it('should expose the docs notices and AI guide notice at the bottom of the operation fields', () => {
		expect(create.description.slice(-6).map((property) => property.name)).toEqual([
			'createSelfReminderDocsNotice',
			'createUserReminderDocsNotice',
			'createChatReminderDocsNotice',
			'createMessageReminderDocsNotice',
			'createReminderAllVariantsDocsNotice',
			'createReminderAiToolGuideNotice',
		]);
		expect(
			create.description.find((property) => property.name === 'createReminderAllVariantsDocsNotice')
				?.displayOptions?.show?.inputMode,
		).toEqual(['agentTool', 'raw']);
		expect(
			String(
				create.description.find((property) => property.name === 'createReminderAiToolGuideNotice')
					?.displayName,
			),
		).toContain('as an AI Tool');
		expect(
			create.description.find((property) => property.name === 'createReminderAiToolGuideNotice')
				?.displayOptions?.show?.inputMode,
		).toEqual(['agentTool']);
		expect(
			String(
				create.description.find(
					(property) => property.name === 'createReminderAllVariantsDocsNotice',
				)?.displayName,
			),
		).toContain('REQUIRED SCOPES:');
	});
});
