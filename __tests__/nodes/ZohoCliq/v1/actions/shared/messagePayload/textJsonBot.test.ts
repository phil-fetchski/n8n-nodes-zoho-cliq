import type { IExecuteFunctions, INodeProperties } from 'n8n-workflow';

import { __testHelpers } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload/descriptions';
import {
	resolveBotUniqueNameQueryParam,
	resolveMessagePayload,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';
import { createContext } from './testUtils';

describe('ZohoCliq - Shared - messagePayload - text/json/bot', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = createContext({});
	});
	it('should resolve text payload and trim whitespace', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: '  Hello from Cliq  ',
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({ text: 'Hello from Cliq' });
	});

	it('should append guided mention tokens to text payload', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Hello from Cliq',
			addMention: true,
			mentionInsertMode: 'append',
			mentions: {
				mention: [{ mentionType: 'available' }, { mentionType: 'participants' }],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'Hello from Cliq {@available} {@participants}',
		});
	});

	it('should prepend guided user mention token to text payload', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Please review',
			addMention: true,
			mentionInsertMode: 'prepend',
			mentions: {
				mention: [{ mentionType: 'user', userIdOrEmail: '667356693' }],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: '{@667356693} Please review',
		});
	});

	it('should build silent user mention token', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Heads up',
			addMention: true,
			mentions: {
				mention: [
					{
						mentionType: 'silentUser',
						silentUserName: 'Jordan',
						silentUserInputType: 'mail',
						silentUserValue: 'jordan@example.com',
					},
				],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'Heads up [Jordan](mail:jordan@example.com)',
		});
	});

	it('should throw when guided mentions are enabled without entries', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Hello',
			addMention: true,
			mentions: {},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Add a Mention is enabled, but no mention entries were provided',
		);
	});

	it('should throw for invalid mention type', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Hello',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'everyone' }],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Mention type at index 0 must be one of',
		);
	});

	it('should throw for invalid mention insert mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Hello',
			addMention: true,
			mentionInsertMode: 'middle',
			mentions: { mention: [{ mentionType: 'participants' }] },
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Mention Insert Mode must be one of: append, prepend',
		);
	});

	it('should throw when mentions collection is not an object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Hello',
			addMention: true,
			mentions: 'invalid-collection-shape',
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Add a Mention is enabled, but no mention entries were provided',
		);
	});

	it('should throw when mention entry is not an object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Hello',
			addMention: true,
			mentions: {
				mention: [123],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Each mention must be a JSON object',
		);
	});

	it('should build legacy all mention token when provided', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Hello',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'all' }],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({ text: 'Hello {@all}' });
	});

	it('should build team mention token', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Heads up',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'team', teamId: 'G123456789' }],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({ text: 'Heads up {@G123456789}' });
	});

	it('should throw when team mention is missing team ID', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Heads up',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'team', teamId: '' }],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Team ID is required for mention at index 0',
		);
	});

	it('should throw when team mention has invalid team ID', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Heads up',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'team', teamId: 'bad team id' }],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Invalid Team ID at index 0',
		);
	});

	it('should build channel mention token', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Join',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'channel', channelId: '1234567890' }],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({ text: 'Join {#1234567890}' });
	});

	it('should throw when channel mention is missing channel ID', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Join',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'channel', channelId: '' }],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Channel ID is required for mention at index 0',
		);
	});

	it('should throw when channel mention has invalid channel ID', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Join',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'channel', channelId: 'channel with spaces' }],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Invalid Channel ID at index 0',
		);
	});

	it('should throw when user mention is missing user identifier', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Ping',
			addMention: true,
			mentions: {
				mention: [{ mentionType: 'user', userIdOrEmail: '' }],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'User ID or Email is required for mention at index 0',
		);
	});

	it('should throw when silent user mention is missing display name', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Ping',
			addMention: true,
			mentions: {
				mention: [
					{
						mentionType: 'silentUser',
						silentUserName: '',
						silentUserInputType: 'zohoid',
						silentUserValue: '667356693',
					},
				],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Silent User Display Name is required for mention at index 0',
		);
	});

	it('should throw when silent user input type is invalid', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Ping',
			addMention: true,
			mentions: {
				mention: [
					{
						mentionType: 'silentUser',
						silentUserName: 'Jordan',
						silentUserInputType: 'phone',
						silentUserValue: '667356693',
					},
				],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Silent User Input Type at index 0 must be one of: zohoid, mail',
		);
	});

	it('should throw when silent user mention is missing value', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Ping',
			addMention: true,
			mentions: {
				mention: [
					{
						mentionType: 'silentUser',
						silentUserName: 'Jordan',
						silentUserInputType: 'zohoid',
						silentUserValue: '',
					},
				],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Silent User Value is required for mention at index 0',
		);
	});

	it('should throw when silent user display name exceeds max length', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Ping',
			addMention: true,
			mentions: {
				mention: [
					{
						mentionType: 'silentUser',
						silentUserName: 'A'.repeat(101),
						silentUserInputType: 'zohoid',
						silentUserValue: '667356693',
					},
				],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Silent User Display Name at index 0 exceeds 100 characters',
		);
	});

	it('should throw when silent user display name contains unsupported characters', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Ping',
			addMention: true,
			mentions: {
				mention: [
					{
						mentionType: 'silentUser',
						silentUserName: 'Jordan]',
						silentUserInputType: 'zohoid',
						silentUserValue: '667356693',
					},
				],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Silent User Display Name at index 0 contains unsupported characters',
		);
	});

	it.each(['[', '(', ')'])('should throw when silent user display name contains "%s"', (char) => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Ping',
			addMention: true,
			mentions: {
				mention: [
					{
						mentionType: 'silentUser',
						silentUserName: `Admin${char}`,
						silentUserInputType: 'zohoid',
						silentUserValue: '667356693',
					},
				],
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Silent User Display Name at index 0 contains unsupported characters',
		);
	});

	it('should throw when text is not a string', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 123,
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow('Text must be a string');
	});

	it('should return a shallow copy when stripMessageTypeDisplayOption has no messageType', () => {
		const property: INodeProperties = {
			displayName: 'Card Title',
			name: 'cardTitle',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					target: ['channel'],
				},
			},
		};

		const result = __testHelpers.stripMessageTypeDisplayOption(property);
		expect(result).toEqual(property);
		expect(result).not.toBe(property);
	});

	it('should throw when text is empty after trimming', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: '   ',
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Text is required and cannot be empty',
		);
	});

	it('should throw when text exceeds max length', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'a'.repeat(41),
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0, { textMaxLength: 40 })).toThrow(
			'Text message is too long',
		);
	});

	it('should resolve json payload and serialize rich fields', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: {
				text: 'hello',
				card: { title: 'Card title' },
				slides: [{ type: 'label', title: 'Slide title' }],
				buttons: [
					{ label: 'Open', action: { type: 'open.url', data: { web: 'https://example.com' } } },
				],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toMatchObject({
			text: 'hello',
			card: JSON.stringify({ title: 'Card title' }),
			slides: JSON.stringify([{ type: 'label', title: 'Slide title' }]),
			buttons: JSON.stringify([
				{ label: 'Open', action: { type: 'open.url', data: { web: 'https://example.com' } } },
			]),
		});
	});

	it('should resolve json payload from JSON string input', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: '{"text":"hello from string"}',
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({ text: 'hello from string' });
	});

	it('should require a top-level text field for raw JSON payloads', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: {
				content: {
					type: 'custom',
					value: 'hello',
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Advanced (JSON) must include a top-level "text" field',
		);
	});

	it('should trim the top-level text field in raw JSON payloads', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: {
				text: '  hello from raw json  ',
				card: { title: 'Card title' },
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'hello from raw json',
			card: JSON.stringify({ title: 'Card title' }),
		});
	});

	it('should require the top-level text field in raw JSON payloads to be a string', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: {
				text: 42,
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Advanced (JSON) "text" must be a string',
		);
	});

	it('should throw when json payload is empty and content is required', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: {},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'JSON payload cannot be empty',
		);
	});

	it('should allow an empty json payload when message content is not required', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: {},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0, {
			requireMessageContent: false,
		});
		expect(payload).toEqual({});
	});

	it('should allow raw json payloads without text when message content is not required', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: {
				content: {
					type: 'custom',
					value: 'hello',
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0, {
			requireMessageContent: false,
		});
		expect(payload).toEqual({
			content: {
				type: 'custom',
				value: 'hello',
			},
		});
	});

	it('should throw for unknown message type', () => {
		mockExecuteFunctions = createContext({
			messageType: 'unexpected',
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow('Invalid message type');
	});

	it('should resolve bot query param for text messages when postAsBot is enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			botUniqueName: 'supportbot',
			text: 'hello',
		});

		const query = resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0);
		expect(query).toEqual({ bot_unique_name: 'supportbot' });
	});

	it('should resolve bot query param from agentBotUniqueName for agent-choice Post as Bot flows', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			agentBotUniqueName: 'supportbot',
			text: 'hello',
		});

		const query = resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0, {
			botUniqueNameFieldName: 'agentBotUniqueName',
			validationContext:
				'Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
		});
		expect(query).toEqual({ bot_unique_name: 'supportbot' });
	});

	it('should include optional bot identity in text payload when postAsBot is enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			botDisplayName: 'Support Bot',
			botImage: 'https://example.com/bot.png',
			text: 'hello',
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'hello',
			bot: {
				name: 'Support Bot',
				image: 'https://example.com/bot.png',
			},
		});
	});

	it('should omit optional bot identity from text payload when includeBotIdentity is false', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			botDisplayName: 'Support Bot',
			botImage: 'https://example.com/bot.png',
			text: 'hello',
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0, {
			includeBotIdentity: false,
		});
		expect(payload).toEqual({
			text: 'hello',
		});
	});

	it('should include optional bot identity in JSON payload when postAsBot is enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			postAsBot: true,
			botDisplayName: 'Support Bot',
			jsonBody: {
				text: 'hello',
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'hello',
			bot: {
				name: 'Support Bot',
			},
		});
	});

	it('should omit optional bot identity from JSON payload when includeBotIdentity is false', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			postAsBot: true,
			botDisplayName: 'Support Bot',
			jsonBody: {
				text: 'hello',
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0, {
			includeBotIdentity: false,
		});
		expect(payload).toEqual({
			text: 'hello',
		});
	});

	it('should merge optional bot identity into existing bot object in JSON payload', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			postAsBot: true,
			botImage: 'https://example.com/bot.png',
			jsonBody: {
				text: 'hello',
				bot: {
					name: 'Existing Name',
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'hello',
			bot: {
				name: 'Existing Name',
				image: 'https://example.com/bot.png',
			},
		});
	});

	it('should throw when JSON payload bot field is not an object and postAsBot is enabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			postAsBot: true,
			botDisplayName: 'Support Bot',
			jsonBody: {
				text: 'hello',
				bot: 'invalid',
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'bot must be a JSON object when provided',
		);
	});

	it('should return undefined bot query param when postAsBot is disabled', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			postAsBot: false,
		});

		const query = resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0);
		expect(query).toBeUndefined();
	});

	it('should throw when postAsBot is enabled without botUniqueName', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			text: 'hello',
		});

		expect(() => resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0)).toThrow(
			'Bot Unique Name is required when Post as Bot is enabled',
		);
	});

	it('should throw a contextual message when agent-choice Post as Bot is enabled without agentBotUniqueName', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			text: 'hello',
		});

		expect(() =>
			resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0, {
				botUniqueNameFieldName: 'agentBotUniqueName',
				validationContext:
					'Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
			}),
		).toThrow(
			'Bot Unique Name is required when Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
		);
	});

	it('should reject underscores and hyphens in bot unique name query param', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			botUniqueName: 'support_bot-v2',
			text: 'hello',
		});

		expect(() => resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0)).toThrow(
			'Bot Unique Name must contain only letters and numbers (no spaces or special characters)',
		);
	});

	it('should reject invalid agent-choice bot unique names with contextual guidance', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			agentBotUniqueName: 'support_bot-v2',
			text: 'hello',
		});

		expect(() =>
			resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0, {
				botUniqueNameFieldName: 'agentBotUniqueName',
				validationContext:
					'Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
			}),
		).toThrow(
			'Bot Unique Name must contain only letters and numbers (no spaces or special characters) when Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
		);
	});

	it('should reject oversized fixed-path bot unique names for post-as-bot query params', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			botUniqueName: 'a'.repeat(101),
			text: 'hello',
		});

		expect(() => resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0)).toThrow(
			'Bot Unique Name is too long. Maximum length is 100 characters when Post as Bot is enabled',
		);
	});

	it('should reject oversized agent-choice bot unique names with contextual guidance', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			postAsBot: true,
			agentBotUniqueName: 'a'.repeat(101),
			text: 'hello',
		});

		expect(() =>
			resolveBotUniqueNameQueryParam(mockExecuteFunctions, 0, {
				botUniqueNameFieldName: 'agentBotUniqueName',
				validationContext:
					'Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
			}),
		).toThrow(
			'Bot Unique Name is too long. Maximum length is 100 characters when Post as Bot is enabled for an Agent Selected Target of Channel (By ID), Channel (By Unique Name), or Chat',
		);
	});
});
