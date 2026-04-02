import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport', () => ({
	zohoCliqApiRequest: jest.fn(),
}));

jest.mock('../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload', () => ({
	messagePayloadDescription: [
		{
			displayName: 'Message Type',
			name: 'messageType',
			type: 'options',
			default: 'text',
			options: [
				{ name: 'Text (Cliq Markdown)', value: 'text' },
				{ name: 'Rich/Card', value: 'rich' },
				{ name: 'Advanced (JSON)', value: 'json' },
			],
		},
		{
			displayName: 'Text',
			name: 'text',
			type: 'string',
			default: '',
			required: true,
			displayOptions: { show: { messageType: ['text'] } },
		},
		{
			displayName: 'Show Cliq Markdown Guidance',
			name: 'showCliqMarkdownGuidance',
			type: 'boolean',
			default: false,
			noDataExpression: true,
			displayOptions: { show: { messageType: ['text'] } },
		},
		{
			displayName: 'Notice',
			name: 'plainTextMarkdownNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { messageType: ['text'], showCliqMarkdownGuidance: [true] } },
		},
		{
			displayName: 'JSON',
			name: 'jsonBody',
			type: 'json',
			default: '{}',
			displayOptions: { show: { messageType: ['json'] } },
		},
		{
			displayName: 'Card Mapping Notice',
			name: 'cardPayloadMappingNotice',
			type: 'notice',
			default: '',
			displayOptions: { show: { messageType: ['json'] } },
		},
		{
			displayName: 'Post as Bot',
			name: 'postAsBot',
			type: 'boolean',
			default: false,
		},
		{
			displayName: 'Bot Unique Name',
			name: 'botUniqueName',
			type: 'string',
			default: '',
			displayOptions: { show: { postAsBot: [true] } },
		},
	],
	resolveMessagePayload: jest.fn(() => ({ text: 'Updated message text' })),
	resolveBotUniqueNameQueryParam: jest.fn(),
}));

import * as editOperation from '../../../../../../nodes/ZohoCliq/v1/actions/message/edit.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import * as messagePayload from '../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';

describe('Message - Edit Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const mockResolveMessagePayload = messagePayload.resolveMessagePayload as jest.MockedFunction<
		typeof messagePayload.resolveMessagePayload
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			continueOnFail: jest.fn(() => false),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockReset();
		mockResolveMessagePayload.mockReset();
		mockResolveMessagePayload.mockReturnValue({ text: 'Updated message text' });
	});

	it('should edit a text message using the shared payload resolver', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			if (paramName === 'outputEnhancedResponse') return true;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ ok: true });

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(mockResolveMessagePayload).toHaveBeenCalledWith(mockExecuteFunctions, 0, {
			textMaxLength: 5000,
			textTypeErrorMessage: 'Invalid text message: must be a string',
			requireMessageContent: true,
			includeBotIdentity: false,
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/chats/CT_1234567890_1234567890/messages/MSG_1234567890_1234567890',
			{ text: 'Updated message text', notify_edit: false },
		);
		expect(result[0].json).toEqual({
			updated: true,
			success: true,
			resource: 'message',
			operation: 'edit',
			chat_id: 'CT_1234567890_1234567890',
			message_id: 'MSG_1234567890_1234567890',
			message_type: 'text',
			edited_text: 'Updated message text',
			notify_edit: false,
			ok: true,
		});
	});

	it('should edit a raw JSON payload and preserve structured message content', async () => {
		mockResolveMessagePayload.mockReturnValue({
			text: 'Updated rich message',
			card: { title: 'Updated Card' },
			slides: [{ type: 'text', data: 'Supporting text' }],
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'json';
			if (paramName === 'notifyEdit') return true;
			if (paramName === 'outputEnhancedResponse') return true;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ ok: true });

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/chats/CT_1234567890_1234567890/messages/MSG_1234567890_1234567890',
			{
				text: 'Updated rich message',
				card: { title: 'Updated Card' },
				slides: [{ type: 'text', data: 'Supporting text' }],
				notify_edit: true,
			},
		);
		expect(result[0].json).toEqual({
			updated: true,
			success: true,
			resource: 'message',
			operation: 'edit',
			chat_id: 'CT_1234567890_1234567890',
			message_id: 'MSG_1234567890_1234567890',
			message_type: 'json',
			edited_text: 'Updated rich message',
			notify_edit: true,
			ok: true,
		});
	});

	it('should only run chat preflight once before editing when chat lookup scope is available', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			if (paramName === 'outputEnhancedResponse') return true;
			return undefined;
		});

		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ members: [{ user_id: 'U1' }] })
			.mockResolvedValueOnce({ ok: true });

		const items: INodeExecutionData[] = [{ json: {} }];
		await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.MESSAGES_UPDATE},${SCOPES.CHATS_READ}`,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'GET',
			'/api/v2/chats/CT_1234567890_1234567890/members',
			{},
			{},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'PUT',
			'/api/v2/chats/CT_1234567890_1234567890/messages/MSG_1234567890_1234567890',
			{ text: 'Updated message text', notify_edit: false },
		);
	});

	it('should omit edited_text and default notify_edit to false when the resolver returns no top-level text', async () => {
		mockResolveMessagePayload.mockReturnValue({
			card: { title: 'Updated Card' },
			slides: [{ type: 'text', data: 'Supporting text' }],
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'json';
			if (paramName === 'notifyEdit') return undefined;
			if (paramName === 'outputEnhancedResponse') return true;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ ok: true });

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'PUT',
			'/api/v2/chats/CT_1234567890_1234567890/messages/MSG_1234567890_1234567890',
			{
				card: { title: 'Updated Card' },
				slides: [{ type: 'text', data: 'Supporting text' }],
				notify_edit: false,
			},
		);
		expect(result[0].json).toEqual({
			updated: true,
			success: true,
			resource: 'message',
			operation: 'edit',
			chat_id: 'CT_1234567890_1234567890',
			message_id: 'MSG_1234567890_1234567890',
			message_type: 'json',
			notify_edit: false,
			ok: true,
		});
		expect(result[0].json).not.toHaveProperty('edited_text');
	});

	it('should return raw JSON guidance in recoverable mode when the JSON payload is missing text', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'json';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});
		mockResolveMessagePayload.mockImplementation(() => {
			throw new Error(
				'Advanced (JSON) must include a top-level "text" field. Use a non-empty string for "text".',
			);
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_RAW_JSON_PAYLOAD',
			resource: 'message',
			operation: 'edit',
			message_type: 'json',
		});
		expect(String(result[0].json.hint)).toContain('top-level `text` string');
	});

	it('should return message-content guidance in recoverable mode when replacement text is invalid', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});
		mockResolveMessagePayload.mockImplementation(() => {
			throw new Error('Text is too long. Maximum length is 5000 characters.');
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_MESSAGE_CONTENT',
			resource: 'message',
			operation: 'edit',
			message_type: 'text',
		});
		expect(String(result[0].json.hint)).toContain('character limits');
	});

	it('should return chat-id guidance when a non-chat identifier is provided', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'P1234567890123456789';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'INVALID_CHAT_ID',
			resource: 'message',
			operation: 'edit',
		});
		expect(String(result[0].json.hint)).toContain("Chat ID must start with a number or 'CT_'");
	});

	it('should return a generic recoverable payload when target attribution cannot run', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'NOT_FOUND',
			resource: 'message',
			operation: 'edit',
			chat_id: 'CT_1234567890_1234567890',
			message_id: 'MSG_1234567890_1234567890',
			message_type: 'text',
		});
		expect(String(result[0].json.message)).toBe('Request URL is invalid');
	});

	it('should return CHAT_NOT_FOUND guidance when the chat identifier is rejected for edit', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_missing_chat';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({
			message: 'Request URL is invalid',
			response: { statusCode: 404 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			`${SCOPES.MESSAGES_UPDATE},${SCOPES.CHATS_READ}`,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'CHAT_NOT_FOUND',
			resource: 'message',
			operation: 'edit',
			chat_id: 'CT_missing_chat',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_missing_chat/members',
			{},
			{},
		);
	});

	it('should return edit-window guidance when Zoho Cliq rejects editing permissions in recoverable mode', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'organisation admin has disabled your permission to edit messages',
			response: { statusCode: 400 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'EDIT_NOT_ALLOWED',
			resource: 'message',
			operation: 'edit',
			message_type: 'text',
		});
		expect(String(result[0].json.hint)).toContain('account-configured edit window');
	});

	it('should map file system errors to EDIT_REJECTED in recoverable mode', async () => {
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			message: 'File system error while processing edit request',
			response: { statusCode: 500 },
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(result[0].json).toMatchObject({
			success: false,
			reason: 'EDIT_REJECTED',
			resource: 'message',
			operation: 'edit',
			chat_id: 'CT_1234567890_1234567890',
			message_id: 'MSG_1234567890_1234567890',
			message_type: 'text',
		});
		expect(String(result[0].json.hint)).toContain('account-configured edit window');
	});

	it('should throw when notifyEdit is not boolean', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return 'true';
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];

		await expect(
			editOperation.execute.call(mockExecuteFunctions, items, SCOPES.MESSAGES_UPDATE),
		).rejects.toThrow('Invalid notifyEdit value: must be a boolean');
	});

	it('should return the raw API response when enhanced output is disabled', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			if (paramName === 'outputEnhancedResponse') return false;
			return undefined;
		});

		mockZohoCliqApiRequest.mockResolvedValue({ ok: true, edited: true });

		const items: INodeExecutionData[] = [{ json: {} }];
		const result = await editOperation.execute.call(
			mockExecuteFunctions,
			items,
			SCOPES.MESSAGES_UPDATE,
		);

		expect(result[0].json).toEqual({ updated: true, ok: true, edited: true });
	});

	it('should expose shared message-building fields while omitting bot sender fields', () => {
		const textField = editOperation.description.find((property) => property.name === 'text');
		const jsonField = editOperation.description.find((property) => property.name === 'jsonBody');
		const postAsBotField = editOperation.description.find(
			(property) => property.name === 'postAsBot',
		);
		const botUniqueNameField = editOperation.description.find(
			(property) => property.name === 'botUniqueName',
		);

		expect(textField).toBeDefined();
		expect(jsonField).toBeDefined();
		expect(textField?.required).toBe(false);
		expect(textField?.displayOptions?.show?.messageType).toBeUndefined();
		expect(jsonField?.displayOptions?.show?.messageType).toBeUndefined();
		expect(postAsBotField).toBeUndefined();
		expect(botUniqueNameField).toBeUndefined();
	});

	it('should keep markdown guidance immediately after text', () => {
		const names = editOperation.description.map((property) => property.name);
		const textIndex = names.indexOf('text');
		const toggleIndex = names.indexOf('showCliqMarkdownGuidance');
		const noticeIndex = names.indexOf('plainTextMarkdownNotice');

		expect(textIndex).toBeGreaterThan(-1);
		expect(toggleIndex).toBe(textIndex + 1);
		expect(noticeIndex).toBe(toggleIndex + 1);
	});

	it('should validate outputEnhancedResponse as a boolean', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			if (paramName === 'outputEnhancedResponse') return 'true';
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		await expect(
			editOperation.execute.call(mockExecuteFunctions, items, SCOPES.MESSAGES_UPDATE),
		).rejects.toThrow('Invalid outputEnhancedResponse value: must be a boolean');
	});

	it('should throw when Chat ID is not a string', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 12345;
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		await expect(
			editOperation.execute.call(mockExecuteFunctions, items, SCOPES.MESSAGES_UPDATE),
		).rejects.toThrow('Invalid Chat ID: must be a string');
	});

	it('should throw when Message ID is not a string', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 12345;
			if (paramName === 'messageType') return 'text';
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		await expect(
			editOperation.execute.call(mockExecuteFunctions, items, SCOPES.MESSAGES_UPDATE),
		).rejects.toThrow('Invalid Message ID: must be a string');
	});

	it('should enforce the update scope', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'chatId') return 'CT_1234567890_1234567890';
			if (paramName === 'messageId') return 'MSG_1234567890_1234567890';
			if (paramName === 'messageType') return 'text';
			if (paramName === 'notifyEdit') return false;
			return undefined;
		});

		const items: INodeExecutionData[] = [{ json: {} }];
		await expect(
			editOperation.execute.call(mockExecuteFunctions, items, SCOPES.MESSAGES_READ),
		).rejects.toBeInstanceOf(NodeOperationError);
	});
});
