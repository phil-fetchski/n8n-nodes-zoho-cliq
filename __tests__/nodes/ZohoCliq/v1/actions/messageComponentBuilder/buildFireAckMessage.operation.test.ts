import type { INodeExecutionData } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport', () => ({
	zohoCliqApiRequest: jest.fn(),
}));

import * as buildFireAckMessage from '../../../../../../nodes/ZohoCliq/v1/actions/messageComponentBuilder/buildFireAckMessage.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { createTestExecutionContext } from './testExecutionContext';

const mockItems: INodeExecutionData[] = [{ json: {} }];

describe('Message Component Builder - Build/Fire ACK Message', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const createAckContext = (params: Record<string, unknown>, continueOnFail = false) =>
		createTestExecutionContext({
			params: {
				outputAckPayloadOnly: true,
				ackMessageTextMode: 'single',
				ackMessageText: 'One moment while I look into that...',
				ackMessageStyle: 'standard',
				ackSpinnerSource: 'preset',
				ackSpinnerPreset: 'svg-spinners/3-dots-bounce',
				ackSpinnerColor: '#12ea9d',
				...params,
			},
			continueOnFail,
		});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should format spinner labels even when no collection prefix is present', () => {
		expect(buildFireAckMessage.__testHelpers.toHumanReadableSpinnerName('bouncing-ball')).toBe(
			'Bouncing Ball',
		);
	});

	it('should expose app key placement and recipient placeholders in the UI description', () => {
		const botUniqueNameIndex = buildFireAckMessage.description.findIndex(
			(property) => property.name === 'ackBotUniqueName',
		);
		const appKeyIndex = buildFireAckMessage.description.findIndex(
			(property) => property.name === 'ackBotAppKey',
		);
		const userIdRecipientsField = buildFireAckMessage.description.find(
			(property) => property.name === 'ackBotRecipientsUserIds',
		);
		const emailRecipientsField = buildFireAckMessage.description.find(
			(property) => property.name === 'ackBotRecipientsEmailIds',
		);
		const spinnerSizeField = buildFireAckMessage.description.find(
			(property) => property.name === 'ackSpinnerSize',
		);

		expect(appKeyIndex).toBe(botUniqueNameIndex + 1);
		expect(userIdRecipientsField?.placeholder).toBe('e.g. 987654321,987654322');
		expect(emailRecipientsField?.placeholder).toBe('e.g. user1@example.com,user2@example.com');
		expect(spinnerSizeField).toBeUndefined();
	});

	it('should build a payload-only ACK with the default heading text and preset thumbnail spinner', async () => {
		const context = createTestExecutionContext({
			params: {
				outputAckPayloadOnly: true,
				ackMessageTextMode: 'single',
				ackMessageText: '',
				ackMessageStyle: 'heading',
				ackSpinnerSource: 'preset',
				ackSpinnerPreset: 'svg-spinners/3-dots-bounce',
				ackSpinnerColor: '#12ea9d',
			},
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect(result[0].json).toMatchObject({
			ack_delivery_mode: 'payloadOnly',
			ack_text: '### ...',
		});
		expect((result[0].json as Record<string, unknown>).ack_payload).toEqual({
			text: '### ...',
			card: {
				thumbnail: 'https://api.iconify.design/svg-spinners/3-dots-bounce.svg?color=%2312ea9d',
			},
			sync_message: true,
		});
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should include card.theme when a non-basic ACK card theme is selected', async () => {
		const context = createAckContext({
			ackCardTheme: 'prompt',
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');

		expect((result[0].json as Record<string, unknown>).ack_payload).toMatchObject({
			card: {
				theme: 'prompt',
				thumbnail: 'https://api.iconify.design/svg-spinners/3-dots-bounce.svg?color=%2312ea9d',
			},
		});
	});

	it('should build a payload-only ACK with a custom icon URL and bold text', async () => {
		const context = createTestExecutionContext({
			params: {
				outputAckPayloadOnly: true,
				ackMessageTextMode: 'single',
				ackMessageText: 'Hold on while I look into that',
				ackMessageStyle: 'bold',
				ackSpinnerSource: 'customUrl',
				ackSpinnerCustomUrl: 'https://example.com/spinner.svg',
			},
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect((result[0].json as Record<string, unknown>).ack_payload).toEqual({
			text: '*Hold on while I look into that*',
			card: {
				thumbnail: 'https://example.com/spinner.svg',
			},
			sync_message: true,
		});
		expect((result[0].json as Record<string, unknown>).ack_spinner).toMatchObject({
			source: 'customUrl',
			field: 'thumbnail',
			url: 'https://example.com/spinner.svg',
		});
	});

	it('should build a payload-only ACK from the built-in preset message source', async () => {
		jest.spyOn(Math, 'random').mockReturnValue(0);

		const context = createAckContext({
			ackMessageTextMode: 'presetRandom',
			ackMessageStyle: 'standard',
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		const expectedMessage = buildFireAckMessage.__testHelpers.presetAckMessages[0];

		expect((result[0].json as Record<string, unknown>).ack_text).toBe(expectedMessage);
		expect((result[0].json as Record<string, unknown>).ack_payload).toMatchObject({
			text: expectedMessage,
			sync_message: true,
		});
	});

	it('should reject ACK text when ackMessageStyle makes ack_payload.text exceed 5000 characters', async () => {
		const context = createAckContext({
			ackMessageText: 'x'.repeat(4999),
			ackMessageStyle: 'bold',
		});

		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			'ack_payload.text exceeds the 5000 character Zoho Cliq text limit after applying ackMessageStyle "bold"',
		);
	});

	it('should reject standard-style ACK text when ack_payload.text exceeds 5000 characters', async () => {
		const context = createAckContext({
			ackMessageText: 'x'.repeat(5001),
			ackMessageStyle: 'standard',
		});

		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			'ack_payload.text exceeds the 5000 character Zoho Cliq text limit after applying ackMessageStyle "standard"',
		);
	});

	it('should send the ACK to a bot and normalize sync_message response fields', async () => {
		jest.spyOn(Math, 'random').mockReturnValue(0.99);
		mockZohoCliqApiRequest.mockResolvedValue({
			user_ids: ['alerts@example.com'],
			message_details: {
				'alerts@example.com': {
					chat_id: 'CT_1203304812000146098_55622663-B2',
					message_id: '1709038327622%2029706114886',
				},
			},
		});

		const context = createTestExecutionContext({
			params: {
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'emailIds',
				ackBotRecipientsEmailIds: 'Alerts@Example.com',
				ackMessageTextMode: 'randomArray',
				ackMessagesJson: '["One moment while I look into that...","Working on it now..."]',
				ackMessageStyle: 'standard',
				ackSpinnerSource: 'preset',
				ackSpinnerPreset: 'svg-spinners/pulse',
				ackSpinnerColor: '#12ea9d',
			},
		});

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/message',
			{
				text: 'Working on it now...',
				card: {
					thumbnail: 'https://api.iconify.design/svg-spinners/pulse.svg?color=%2312ea9d',
				},
				sync_message: true,
				userids: 'alerts@example.com',
			},
			{},
		);
		expect(result[0].json).toMatchObject({
			ack_delivery_mode: 'sentToBot',
			ack_text: 'Working on it now...',
			ack_message_id: '1709038327622_29706114886',
			ack_chat_id: 'CT_1203304812000146098_55622663-B2',
			ack_user_ids: ['alerts@example.com'],
		});
		expect((result[0].json as Record<string, unknown>).ack_message_details).toEqual({
			'alerts@example.com': {
				chat_id: 'CT_1203304812000146098_55622663-B2',
				ack_message_id: '1709038327622_29706114886',
			},
		});
		expect((result[0].json as Record<string, unknown>).ack_sent_to).toMatchObject({
			type: 'bot',
			bot_unique_name: 'supportbot',
			recipient_mode: 'emailIds',
			recipients: ['alerts@example.com'],
		});
	});

	it('should send the ACK with appkey query support for marketplace bots', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1709038327612%20712605914940',
			chat_id: 'CT_MARKETPLACE_CHAT',
			user_ids: ['987654321', '987654322'],
		});

		const context = createTestExecutionContext({
			params: {
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotAppKey: 'marketplace-app-key',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipientsUserIds: '987654321,987654322',
				ackMessageTextMode: 'presetRandom',
				ackMessageStyle: 'standard',
				ackSpinnerSource: 'preset',
				ackSpinnerPreset: 'svg-spinners/3-dots-bounce',
				ackSpinnerColor: '#12ea9d',
			},
		});

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/message',
			expect.objectContaining({
				userids: '987654321,987654322',
				sync_message: true,
			}),
			{ appkey: 'marketplace-app-key' },
		);
		expect((result[0].json as Record<string, unknown>).ack_sent_to).toMatchObject({
			type: 'bot',
			bot_unique_name: 'supportbot',
			appkey: 'marketplace-app-key',
			recipient_mode: 'userIds',
			recipients: ['987654321', '987654322'],
		});
	});

	it('should enforce message-post scope before sending directly to a bot', async () => {
		const context = createTestExecutionContext({
			params: {
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'none',
				ackMessageTextMode: 'single',
				ackMessageText: 'One moment...',
				ackMessageStyle: 'standard',
				ackSpinnerSource: 'preset',
				ackSpinnerPreset: 'svg-spinners/3-dots-bounce',
				ackSpinnerColor: '#12ea9d',
			},
		});

		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			'Missing OAuth scope for',
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return recoverable builder output on continueOnFail errors', async () => {
		const context = createAckContext(
			{
				ackSpinnerSource: 'customUrl',
				ackSpinnerCustomUrl: 'not-a-url',
			},
			true,
		);

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect(result[0].json).toMatchObject({
			error: 'Custom Spinner URL must be a valid URL',
			resource: 'messageComponentBuilder',
			operation: 'buildFireAckMessage',
		});
		expect(String((result[0].json as Record<string, unknown>).hint)).toContain('Webhook');
	});

	it('should fall back to plain ellipsis when random-array input resolves to an empty array', async () => {
		const context = createAckContext({
			ackMessageTextMode: 'randomArray',
			ackMessagesJson: '[]',
			ackMessageStyle: 'standard',
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect((result[0].json as Record<string, unknown>).ack_text).toBe('...');
		expect((result[0].json as Record<string, unknown>).ack_payload).toMatchObject({
			text: '...',
		});
	});

	it.each([
		['ackMessageTextMode', 'invalid', 'Ack Message Source must be a valid option'],
		['ackMessageStyle', 'invalid', 'Message Style must be a valid option'],
		['ackCardTheme', 'invalid', 'Card Theme must be a valid option'],
		['ackSpinnerSource', 'invalid', 'Animated Thumbnail Source must be a valid option'],
		['ackBotRecipientsMode', 'invalid', 'Bot Recipients must be a valid option'],
	])(
		'should reject invalid option values for %s',
		async (fieldName, fieldValue, expectedMessage) => {
			const context = createAckContext({
				outputAckPayloadOnly: fieldName === 'ackBotRecipientsMode' ? false : true,
				ackBotUniqueName: 'supportbot',
				[fieldName]: fieldValue,
			});

			await expect(
				buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(expectedMessage);
		},
	);

	it.each([
		[
			'invalid JSON syntax',
			{
				ackMessageTextMode: 'randomArray',
				ackMessagesJson: '[invalid',
			},
			'Ack Messages JSON must be valid JSON array syntax',
		],
		[
			'non-array JSON',
			{
				ackMessageTextMode: 'randomArray',
				ackMessagesJson: '{"message":"hi"}',
			},
			'Ack Messages JSON must resolve to an array',
		],
		[
			'non-string array members',
			{
				ackMessageTextMode: 'randomArray',
				ackMessagesJson: '["ok", 42]',
			},
			'Ack Messages JSON[1] must be a string',
		],
		[
			'blank array members',
			{
				ackMessageTextMode: 'randomArray',
				ackMessagesJson: '["   "]',
			},
			'Ack Messages JSON[0] cannot be empty',
		],
		[
			'single-mode non-string message',
			{
				ackMessageTextMode: 'single',
				ackMessageText: 42,
			},
			'Ack Message must be a string',
		],
	])('should reject invalid ACK text input: %s', async (_label, params, expectedMessage) => {
		const context = createAckContext(params);
		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			expectedMessage,
		);
	});

	it.each([
		[
			'custom spinner with unsupported protocol',
			{
				ackSpinnerSource: 'customUrl',
				ackSpinnerCustomUrl: 'ftp://example.com/spinner.svg',
			},
			'Custom Spinner URL must start with http:// or https://',
		],
		[
			'missing preset spinner',
			{
				ackSpinnerPreset: '   ',
			},
			'Preset Spinner is required',
		],
		[
			'unsupported preset spinner',
			{
				ackSpinnerPreset: 'svg-spinners/not-real',
			},
			'Preset Spinner must be one of the supported options',
		],
		[
			'missing spinner color',
			{
				ackSpinnerColor: '   ',
			},
			'Spinner Color is required',
		],
		[
			'invalid spinner color',
			{
				ackSpinnerColor: '#12ea9z',
			},
			'Spinner Color must be a valid hex color such as #12ea9d',
		],
	])('should reject invalid spinner configuration: %s', async (_label, params, expectedMessage) => {
		const context = createAckContext(params);
		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			expectedMessage,
		);
	});

	it.each([
		[
			'missing bot unique name',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: '   ',
			},
			'Bot Unique Name is required when Output Ack Payload Only is disabled',
		],
		[
			'invalid bot unique name format',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'support-bot',
			},
			'Invalid Bot Unique Name format. Only letters and numbers are allowed.',
		],
		[
			'too-long bot unique name',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'a'.repeat(101),
			},
			'Bot Unique Name is too long. Maximum length is 100 characters.',
		],
		[
			'too-long app key',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotAppKey: 'x'.repeat(301),
			},
			'App Key is too long',
		],
	])(
		'should reject invalid direct-send bot configuration: %s',
		async (_label, params, expectedMessage) => {
			const context = createAckContext(params);
			await expect(
				buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(expectedMessage);
		},
	);

	it.each([
		[
			'user-id recipients must validate input type',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipients: { invalid: true },
			},
			'Recipient Values must be a comma-separated string or JSON array',
		],
		[
			'user-id recipients must validate array members',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipients: '["validUser", "   "]',
			},
			'Recipient Values[1] must be a non-empty string',
		],
		[
			'user-id recipients must reject blank string input',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipients: '   ',
			},
			'Recipient Values must contain at least one value',
		],
		[
			'user-id recipients must reject invalid JSON syntax',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipients: '[invalid]',
			},
			'Recipient Values must be valid JSON when provided in array form',
		],
		[
			'user-id recipients must reject empty arrays',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipients: '[]',
			},
			'Recipient Values must contain at least one value',
		],
		[
			'user-id recipients must reject comma-only lists',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipients: ' , , ',
			},
			'Recipient Values must contain at least one value',
		],
		[
			'email recipients must validate email syntax',
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'emailIds',
				ackBotRecipients: 'not-an-email',
			},
			'Invalid email format: not-an-email',
		],
	])(
		'should reject invalid recipient configuration: %s',
		async (_label, params, expectedMessage) => {
			const context = createAckContext(params);
			await expect(
				buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE),
			).rejects.toThrow(expectedMessage);
		},
	);

	it('should reject recipient JSON values that do not resolve to an array', async () => {
		const parseSpy = jest
			.spyOn(JSON, 'parse')
			.mockImplementationOnce(() => ({ id: '123' }) as never);
		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'userIds',
			ackBotRecipients: '[1]',
		});

		await expect(
			buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Recipient Values must be a JSON array when provided in array form');
		parseSpy.mockRestore();
	});

	it('should accept native recipient arrays without requiring JSON.stringify', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: 'ACK_ARRAY_RECIPIENTS',
			chat_id: 'CT_ARRAY_RECIPIENTS',
		});

		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'userIds',
			ackBotRecipientsUserIds: ['55743307', ' 55622727 '],
		});

		await buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/message',
			{
				text: 'One moment while I look into that...',
				card: {
					thumbnail: 'https://api.iconify.design/svg-spinners/3-dots-bounce.svg?color=%2312ea9d',
				},
				sync_message: true,
				userids: '55743307,55622727',
			},
			{},
		);
	});

	it('should accept native email recipient arrays without requiring JSON.stringify', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: 'ACK_EMAIL_ARRAY_RECIPIENTS',
			chat_id: 'CT_EMAIL_ARRAY_RECIPIENTS',
		});

		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'emailIds',
			ackBotRecipientsEmailIds: ['Alerts@Example.com', ' second@example.com '],
		});

		await buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/message',
			expect.objectContaining({
				userids: 'alerts@example.com,second@example.com',
			}),
			{},
		);
	});

	it('should reject invalid native recipient array members using the entry-specific message', async () => {
		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'userIds',
			ackBotRecipients: ['55743307', 42],
		});

		await expect(
			buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Recipient Values[1] must be a non-empty string');
	});

	it('should reject empty native recipient arrays', async () => {
		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'userIds',
			ackBotRecipients: [],
		});

		await expect(
			buildFireAckMessage.execute.call(context, mockItems, SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Recipient Values must contain at least one value');
	});

	it('should require a custom spinner URL when custom icon mode is selected', async () => {
		const context = createAckContext({
			ackSpinnerSource: 'customUrl',
			ackSpinnerCustomUrl: '   ',
		});

		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			'Custom Spinner URL is required',
		);
	});

	it('should fall back to ellipsis when random-array ACK messages input is null', async () => {
		const context = createAckContext({
			ackMessageTextMode: 'randomArray',
			ackMessagesJson: null,
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect((result[0].json as Record<string, unknown>).ack_text).toBe('...');
	});

	it('should fall back to ellipsis when random-array ACK messages input is blank string', async () => {
		const context = createAckContext({
			ackMessageTextMode: 'randomArray',
			ackMessagesJson: '   ',
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect((result[0].json as Record<string, unknown>).ack_text).toBe('...');
	});

	it('should accept ACK message arrays passed directly as parameter values', async () => {
		jest.spyOn(Math, 'random').mockReturnValue(0);
		const context = createAckContext({
			ackMessageTextMode: 'randomArray',
			ackMessagesJson: ['Direct array message', 'Second option'],
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect((result[0].json as Record<string, unknown>).ack_text).toBe('Direct array message');
	});

	it('should reject oversized entries in random-array ACK messages', async () => {
		const context = createAckContext({
			ackMessageTextMode: 'randomArray',
			ackMessagesJson: JSON.stringify(['x'.repeat(5001)]),
		});

		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			'Ack Messages JSON[0] exceeds the 5000 character Zoho Cliq text limit',
		);
	});

	it('should fall back to ellipsis when single ACK message input is null', async () => {
		const context = createAckContext({
			ackMessageTextMode: 'single',
			ackMessageText: null,
		});

		const result = await buildFireAckMessage.execute.call(context, mockItems, '');
		expect((result[0].json as Record<string, unknown>).ack_text).toBe('...');
	});

	it('should reject oversized single ACK messages', async () => {
		const context = createAckContext({
			ackMessageTextMode: 'single',
			ackMessageText: 'x'.repeat(5001),
			ackMessageStyle: 'heading',
		});

		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			'ack_payload.text exceeds the 5000 character Zoho Cliq text limit after applying ackMessageStyle "heading"',
		);
	});

	it('should send user-id recipients and normalize root-level sync_message response fields', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: '1709038327612%20712605914940',
			chat_id: 'CT_ROOT_CHAT',
			user_ids: ['55743307', '', 123],
		});

		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'userIds',
			ackBotRecipients: '["55743307","55622727"]',
		});

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/message',
			{
				text: 'One moment while I look into that...',
				card: {
					thumbnail: 'https://api.iconify.design/svg-spinners/3-dots-bounce.svg?color=%2312ea9d',
				},
				sync_message: true,
				userids: '55743307,55622727',
			},
			{},
		);
		expect(result[0].json).toMatchObject({
			ack_message_id: '1709038327612_712605914940',
			ack_chat_id: 'CT_ROOT_CHAT',
			ack_user_ids: ['55743307'],
		});
		expect((result[0].json as Record<string, unknown>).ack_message_details).toBeUndefined();
	});

	it('should send without userids when recipient mode is none and preserve malformed encoded message IDs', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: 'bad%ZZ20id',
			chat_id: 'CT_NONE_MODE',
		});

		const context = createAckContext({
			outputAckPayloadOnly: null,
			ackBotUniqueName: 'supportbot',
			ackBotAppKey: null,
			ackBotRecipientsMode: 'none',
		});

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/supportbot/message',
			{
				text: 'One moment while I look into that...',
				card: {
					thumbnail: 'https://api.iconify.design/svg-spinners/3-dots-bounce.svg?color=%2312ea9d',
				},
				sync_message: true,
			},
			{},
		);
		expect(result[0].json).toMatchObject({
			ack_message_id: 'bad%ZZ20id',
			ack_chat_id: 'CT_NONE_MODE',
		});
		expect((result[0].json as Record<string, unknown>).ack_sent_to).toMatchObject({
			recipient_mode: 'none',
			recipients: [],
		});
	});

	it('should preserve plain message IDs that do not require decoding', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_id: 'ACK_MSG_12345',
			chat_id: 'CT_PLAIN_ID',
		});

		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'none',
		});

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toMatchObject({
			ack_message_id: 'ACK_MSG_12345',
			ack_chat_id: 'CT_PLAIN_ID',
		});
	});

	it('should normalize plus-encoded message IDs and omit empty chat/user metadata collections', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_details: {
				'55743307': {
					chat_id: '   ',
					message_id: 'ack+message',
				},
			},
			user_ids: ['', 123],
		});

		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'userIds',
			ackBotRecipients: '55743307',
		});

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toMatchObject({
			ack_message_id: 'ack_message',
		});
		expect((result[0].json as Record<string, unknown>).ack_chat_id).toBeUndefined();
		expect((result[0].json as Record<string, unknown>).ack_chat_ids).toBeUndefined();
		expect((result[0].json as Record<string, unknown>).ack_user_ids).toBeUndefined();
		expect((result[0].json as Record<string, unknown>).ack_message_details).toEqual({
			'55743307': {
				chat_id: '   ',
				ack_message_id: 'ack_message',
			},
		});
	});

	it('should normalize multi-recipient sync responses into ack_message_ids and ack_chat_ids arrays', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_details: {
				'55743307': {
					chat_id: 'CT_A',
					message_id: '1709038327622%2029706114886',
				},
				'55622727': {
					chat_id: ' CT_B ',
					message_id: '1709038327612%20712605914940',
				},
				ignored: 'not-an-object',
			},
		});

		const context = createAckContext({
			outputAckPayloadOnly: false,
			ackBotUniqueName: 'supportbot',
			ackBotRecipientsMode: 'userIds',
			ackBotRecipients: '55743307,55622727',
		});

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);

		expect((result[0].json as Record<string, unknown>).ack_message_ids).toEqual(
			expect.arrayContaining(['1709038327622_29706114886', '1709038327612_712605914940']),
		);
		expect((result[0].json as Record<string, unknown>).ack_chat_ids).toEqual(
			expect.arrayContaining(['CT_A', 'CT_B']),
		);
		expect(((result[0].json as Record<string, unknown>).ack_message_ids as unknown[]).length).toBe(
			2,
		);
		expect(((result[0].json as Record<string, unknown>).ack_chat_ids as unknown[]).length).toBe(2);
		expect((result[0].json as Record<string, unknown>).ack_message_details).toEqual({
			'55743307': {
				chat_id: 'CT_A',
				ack_message_id: '1709038327622_29706114886',
			},
			'55622727': {
				chat_id: 'CT_B',
				ack_message_id: '1709038327612_712605914940',
			},
		});
		expect((result[0].json as Record<string, unknown>).ack_message_id).toBeUndefined();
		expect((result[0].json as Record<string, unknown>).ack_chat_id).toBeUndefined();
	});

	it('should surface a meaningful error when sync_message metadata is missing from the send response', async () => {
		mockZohoCliqApiRequest.mockResolvedValue({
			message_details: {
				'55743307': {
					chat_id: 'CT_A',
				},
			},
		});

		const context = createAckContext(
			{
				outputAckPayloadOnly: false,
				ackBotUniqueName: 'supportbot',
				ackBotRecipientsMode: 'userIds',
				ackBotRecipients: '55743307',
			},
			true,
		);

		const result = await buildFireAckMessage.execute.call(
			context,
			mockItems,
			SCOPES.WEBHOOKS_CREATE,
		);
		expect(result[0].json).toMatchObject({
			error: 'Zoho Cliq did not return any ACK message IDs even though sync_message was enabled',
			operation: 'buildFireAckMessage',
		});
	});

	it('should reject non-boolean outputAckPayloadOnly values before processing', async () => {
		const context = createAckContext({
			outputAckPayloadOnly: 'true',
		});

		await expect(buildFireAckMessage.execute.call(context, mockItems, '')).rejects.toThrow(
			'Output Ack Payload Only must be a boolean',
		);
	});
});
