import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	buildBinaryPropertiesAndComments,
	buildMultipartBody,
	parseBotSubscriberUserIds,
	parseMappedFileEntries,
	parseRawFileEntries,
	resolveConfiguredShareTarget,
	resolveShareEndpoint,
	resolveShareTargetIdentifier,
	validateBuddyIdentifierType,
	validateConfiguredBotUniqueName,
	validateFileInputMode,
	validateShareTarget,
	validateShareTargetSelection,
} from '../../../../../../nodes/ZohoCliq/v1/actions/files/shareFile.helpers';

describe('ZohoCliq - Files - shareFile helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	let mockGetBinaryDataBuffer: jest.Mock;
	let mockGetBinaryMetadata: jest.Mock;
	let mockGetBinaryStream: jest.Mock;
	let mockBinaryToBuffer: jest.Mock;

	beforeEach(() => {
		mockGetBinaryDataBuffer = jest.fn(async (_itemIndex: number, propertyName: string) => {
			if (propertyName === 'data') {
				return Buffer.from('hello', 'utf8');
			}

			if (propertyName === 'data2') {
				return Buffer.from('b', 'utf8');
			}

			return Buffer.from('fallback', 'utf8');
		});
		mockGetBinaryMetadata = jest.fn(async (binaryHandleId: string) => ({
			fileName: `${binaryHandleId}.txt`,
			mimeType: 'text/plain',
			fileSize: 11,
		}));
		mockGetBinaryStream = jest.fn(async (binaryHandleId: string) =>
			Buffer.from(`stream:${binaryHandleId}`, 'utf8'),
		);
		mockBinaryToBuffer = jest.fn(async (body: Buffer) => body);

		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
			getNodeParameter: jest.fn(),
			helpers: {
				getBinaryDataBuffer: mockGetBinaryDataBuffer,
				getBinaryMetadata: mockGetBinaryMetadata,
				getBinaryStream: mockGetBinaryStream,
				binaryToBuffer: mockBinaryToBuffer,
			},
		} as unknown as IExecuteFunctions;
	});

	it('should parse mapped entries and ignore empty rows', () => {
		const result = parseMappedFileEntries(
			mockExecuteFunctions,
			{
				fileEntry: [
					{ binaryProperty: 'data', comment: 'one' },
					{ binaryProperty: '   ', comment: '' },
				],
			},
			0,
		);

		expect(result).toEqual([{ binaryProperty: 'data', comment: 'one' }]);
	});

	it('should parse raw JSON string entries', () => {
		const result = parseRawFileEntries(
			mockExecuteFunctions,
			JSON.stringify([{ binaryProperty: 'data', comment: 'raw' }]),
			0,
		);

		expect(result).toEqual([{ binaryProperty: 'data', comment: 'raw' }]);
	});

	it('should parse raw JSON entries with binaryHandleId', () => {
		const result = parseRawFileEntries(
			mockExecuteFunctions,
			JSON.stringify([{ binaryHandleId: 'opaque-handle', comment: 'raw' }]),
			0,
		);

		expect(result).toEqual([{ binaryHandleId: 'opaque-handle', comment: 'raw' }]);
	});

	it('should reject raw entries that provide both binaryProperty and binaryHandleId', () => {
		expect(() =>
			parseRawFileEntries(
				mockExecuteFunctions,
				JSON.stringify([{ binaryProperty: 'data', binaryHandleId: 'opaque-handle' }]),
				0,
			),
		).toThrow('must include exactly one of binaryProperty or binaryHandleId, not both');
	});

	it('should reject raw entries that provide neither binaryProperty nor binaryHandleId', () => {
		expect(() =>
			parseRawFileEntries(mockExecuteFunctions, JSON.stringify([{ comment: 'orphan' }]), 0),
		).toThrow('must include either binaryProperty or binaryHandleId when comment is provided');
	});

	it('should reject non-string binaryHandleId values', () => {
		expect(() =>
			parseRawFileEntries(mockExecuteFunctions, JSON.stringify([{ binaryHandleId: 123 }]), 0),
		).toThrow('must be a string opaque binary handle returned by Files/Get File');
	});

	it('should reject blank binaryHandleId entries when no other source is provided', () => {
		expect(() =>
			parseRawFileEntries(mockExecuteFunctions, JSON.stringify([{ binaryHandleId: '   ' }]), 0),
		).toThrow('must include exactly one of binaryProperty or binaryHandleId.');
	});

	it('should treat an undefined configured bot unique name as blank input', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockReturnValue(undefined);

		expect(() =>
			validateConfiguredBotUniqueName(
				mockExecuteFunctions,
				0,
				'Bot Unique Name',
				'agentBotUniqueName',
			),
		).toThrow('Bot Unique Name is required');
	});

	it('should reject oversized binaryHandleId values', () => {
		expect(() =>
			parseRawFileEntries(
				mockExecuteFunctions,
				JSON.stringify([{ binaryHandleId: 'x'.repeat(1025) }]),
				0,
			),
		).toThrow('binaryHandleId is too long');
	});

	it('should reject binaryHandleId values with invalid characters', () => {
		expect(() =>
			parseRawFileEntries(
				mockExecuteFunctions,
				JSON.stringify([{ binaryHandleId: 'opaque-handle\nbad' }]),
				0,
			),
		).toThrow('binaryHandleId contains invalid characters');
	});

	it('should reject duplicate binaryHandleId entries', () => {
		expect(() =>
			parseRawFileEntries(
				mockExecuteFunctions,
				JSON.stringify([{ binaryHandleId: 'opaque-handle' }, { binaryHandleId: 'opaque-handle' }]),
				0,
			),
		).toThrow('Duplicate Binary Handle ID "opaque-handle" is not allowed.');
	});

	it('should reject unsupported fields in mapped entries using the mapped contract wording', () => {
		expect(() =>
			parseMappedFileEntries(
				mockExecuteFunctions,
				{
					fileEntry: [{ binaryProperty: 'data', extra: true }],
				},
				0,
			),
		).toThrow('Allowed fields: binaryProperty, comment');
	});

	it('should reject empty raw file entry arrays with the handle-aware wording', () => {
		expect(() => parseRawFileEntries(mockExecuteFunctions, '[]', 0)).toThrow(
			'Provide at least one file entry with a non-empty Binary Property or Binary Handle ID.',
		);
	});

	it('should resolve share endpoint for buddy email target', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'buddyIdentifierType') return 'email';
			if (name === 'buddyEmail') return 'person@example.com';
			return undefined;
		});

		const endpoint = resolveShareEndpoint(mockExecuteFunctions, 0, 'buddy');
		expect(endpoint).toBe('/api/v2/buddies/person%40example.com/files');
	});

	it('should validate share target, file input mode, and buddy identifier type allowlists', () => {
		expect(validateShareTarget(mockExecuteFunctions, 'chat', 0)).toBe('chat');
		expect(validateShareTargetSelection(mockExecuteFunctions, 'agentChoice', 0)).toBe(
			'agentChoice',
		);
		expect(validateFileInputMode(mockExecuteFunctions, 'mapped', 0)).toBe('mapped');
		expect(validateBuddyIdentifierType(mockExecuteFunctions, 'email', 0)).toBe('email');
	});

	it('should reject non-string share targets before trim', () => {
		expect(() =>
			validateShareTarget(mockExecuteFunctions, undefined as unknown as string, 0),
		).toThrow('Share Target is required');
	});

	it('should reject blank and invalid share targets', () => {
		expect(() => validateShareTarget(mockExecuteFunctions, '   ', 0)).toThrow(
			'Share Target is required',
		);
		expect(() => validateShareTarget(mockExecuteFunctions, 'legacy', 0)).toThrow(
			'Share Target must be one of',
		);
	});

	it('should reject blank and invalid share target selections', () => {
		expect(() => validateShareTargetSelection(mockExecuteFunctions, undefined, 0)).toThrow(
			'Share Target is required',
		);
		expect(() => validateShareTargetSelection(mockExecuteFunctions, '   ', 0)).toThrow(
			'Share Target is required',
		);
		expect(() => validateShareTargetSelection(mockExecuteFunctions, 'legacy', 0)).toThrow(
			'Share Target must be one of',
		);
	});

	it('should resolve share target identifiers using the validated target contract', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'chatId') return 'CT_12345';
				if (name === 'channelId' && options?.extractValue) return 'CH_12345';
				if (name === 'channelUniqueName') return 'eng_updates';
				if (name === 'botUniqueName') return 'helpbot';
				if (name === 'buddyIdentifierType') return 'email';
				if (name === 'buddyEmail') return 'person@example.com';
				return undefined;
			},
		);

		expect(resolveShareTargetIdentifier(mockExecuteFunctions, 0, 'chat')).toBe('CT_12345');
		expect(resolveShareTargetIdentifier(mockExecuteFunctions, 0, 'channelId')).toBe('CH_12345');
		expect(resolveShareTargetIdentifier(mockExecuteFunctions, 0, 'channelUniqueName')).toBe(
			'eng_updates',
		);
		expect(resolveShareTargetIdentifier(mockExecuteFunctions, 0, 'bot')).toBe('helpbot');
		expect(resolveShareTargetIdentifier(mockExecuteFunctions, 0, 'buddy')).toBe(
			'person@example.com',
		);
	});

	it('should resolve configured share target for manual selection', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				_fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'chatId') return 'CT_12345';
				if (name === 'channelId' && options?.extractValue) return 'CH_12345';
				return undefined;
			},
		);

		expect(resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'chat')).toEqual({
			shareTarget: 'chat',
			endpoint: '/api/v2/chats/CT_12345/files',
			targetIdentifier: 'CT_12345',
		});
	});

	it('should resolve configured share target for Agent Choice chat routing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'chat';
			if (name === 'agentChatId') return 'CT_12345';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toEqual({
			shareTarget: 'chat',
			endpoint: '/api/v2/chats/CT_12345/files',
			targetIdentifier: 'CT_12345',
		});
	});

	it('should resolve configured share target for Agent Choice channel ID routing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'channelId';
			if (name === 'agentChannelId') return 'CH_12345';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toEqual({
			shareTarget: 'channelId',
			endpoint: '/api/v2/channels/CH_12345/files',
			targetIdentifier: 'CH_12345',
		});
	});

	it('should resolve configured share target for Agent Choice channel unique name routing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'channelUniqueName';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return 'eng_updates';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toEqual({
			shareTarget: 'channelUniqueName',
			endpoint: '/api/v2/channelsbyname/eng_updates/files',
			targetIdentifier: 'eng_updates',
		});
	});

	it('should allow Agent Choice channel unique name routing with Post as Bot and Bot Unique Name', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'channelUniqueName';
			if (name === 'agentPostAsBot') return true;
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return 'eng_updates';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return 'helpbot';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toEqual({
			shareTarget: 'channelUniqueName',
			endpoint: '/api/v2/channelsbyname/eng_updates/files',
			targetIdentifier: 'eng_updates',
		});
	});

	it('should resolve configured share target for Agent Choice bot routing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'bot';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return 'helpbot';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toEqual({
			shareTarget: 'bot',
			endpoint: '/api/v2/bots/helpbot/files',
			targetIdentifier: 'helpbot',
		});
	});

	it('should resolve configured share target for Agent Choice buddy user ID routing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'buddy';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '66578893';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toEqual({
			shareTarget: 'buddy',
			endpoint: '/api/v2/buddies/66578893/files',
			targetIdentifier: '66578893',
		});
	});

	it('should reject missing Agent Choice selected share target', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return null;
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'Agent Selected Share Target is required',
		);
	});

	it('should reject invalid Agent Choice selected share target', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'legacy';
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'Agent Selected Share Target must be one of',
		);
	});

	it('should reject extra identifier fields in Agent Choice mode', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'chat';
			if (name === 'agentChatId') return 'CT_12345';
			if (name === 'agentChannelId') return 'CH_12345';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'only the matching target identifier field(s) may be provided',
		);
	});

	it('should require Chat ID when Agent Choice target is chat', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'chat';
			if (name === 'agentChatId') return '   ';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'Chat ID is required when Agent Selected Share Target is "chat"',
		);
	});

	it('should require Channel ID when Agent Choice target is channelId', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'channelId';
			if (name === 'agentChannelId') return undefined;
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'Channel ID is required when Agent Selected Share Target is "channelId"',
		);
	});

	it('should require Channel Unique Name when Agent Choice target is channelUniqueName', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'channelUniqueName';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'Channel Unique Name is required when Agent Selected Share Target is "channelUniqueName"',
		);
	});

	it('should require Bot Unique Name when Agent Choice target is bot', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'bot';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentChatId') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '';
			if (name === 'agentBuddyEmail') return '';
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'Bot Unique Name is required',
		);
	});

	it('should require exactly one user identifier in Agent Choice buddy routing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'buddy';
			if (name === 'agentChatId') return '';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return '66578893';
			if (name === 'agentBuddyEmail') return 'person@example.com';
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'provide either User ID or User Email, not both',
		);
	});

	it('should require one buddy identifier in Agent Choice buddy routing', () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'agentSelectedShareTarget') return 'buddy';
			if (name === 'agentChatId') return '';
			if (name === 'agentChannelId') return '';
			if (name === 'agentChannelUniqueName') return '';
			if (name === 'agentBotUniqueName') return '';
			if (name === 'agentBuddyUserId') return null;
			if (name === 'agentBuddyEmail') return undefined;
			return undefined;
		});

		expect(() => resolveConfiguredShareTarget(mockExecuteFunctions, 0, 'agentChoice')).toThrow(
			'provide either User ID or User Email.',
		);
	});

	it('should parse bot subscriber IDs only when input is not empty', () => {
		expect(parseBotSubscriberUserIds(mockExecuteFunctions, '998877, 887766', 0)).toEqual([
			'998877',
			'887766',
		]);
		expect(parseBotSubscriberUserIds(mockExecuteFunctions, '   ', 0)).toBeUndefined();
	});

	it('should parse bot subscriber IDs from fixedCollection input', () => {
		const input = {
			subscriber: [{ userId: '998877' }, { userId: ' 887766 ' }, { userId: '' }],
		};

		expect(parseBotSubscriberUserIds(mockExecuteFunctions, input, 0)).toEqual(['998877', '887766']);
	});

	it('should return undefined for unsupported bot subscriber input shapes', () => {
		expect(parseBotSubscriberUserIds(mockExecuteFunctions, ['bad'], 0)).toBeUndefined();
		expect(
			parseBotSubscriberUserIds(mockExecuteFunctions, { subscriber: 'bad' }, 0),
		).toBeUndefined();
		expect(
			parseBotSubscriberUserIds(mockExecuteFunctions, { subscriber: [{ userId: 123 }] }, 0),
		).toBeUndefined();
		expect(
			parseBotSubscriberUserIds(mockExecuteFunctions, { subscriber: [null, { userId: '' }] }, 0),
		).toBeUndefined();
	});

	it('should build binary properties and preserve empty comment placeholders', () => {
		const result = buildBinaryPropertiesAndComments([
			{ binaryProperty: 'data', comment: 'first' },
			{ binaryProperty: 'data2', comment: '' },
		]);

		expect(result).toEqual({
			binaryProperties: ['data', 'data2'],
			comments: ['first', ''],
		});
	});

	it('should build multipart body with files and mark_as_read for chat target', async () => {
		const item: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello', 'utf8').toString('base64'),
					fileName: 'note.txt',
					mimeType: 'text/plain',
				},
			},
		};

		const multipart = await buildMultipartBody(
			mockExecuteFunctions,
			item,
			0,
			[{ binaryProperty: 'data', comment: 'comment' }],
			true,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);

		const body = multipart.body.toString('utf8');
		expect(body).toContain('name="file"; filename="note.txt"');
		expect(body).toContain('name="comments"');
		expect(body).toContain('name="mark_as_read"');
	});

	it('should build multipart body from inline base64 when getBinaryDataBuffer is unavailable', async () => {
		const contextWithoutBinaryBufferHelper = {
			...mockExecuteFunctions,
			helpers: {
				getBinaryMetadata: mockGetBinaryMetadata,
				getBinaryStream: mockGetBinaryStream,
				binaryToBuffer: mockBinaryToBuffer,
			},
		} as unknown as IExecuteFunctions;
		const item: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello', 'utf8').toString('base64'),
					fileName: 'note.txt',
					mimeType: 'text/plain',
				},
			},
		};

		const multipart = await buildMultipartBody(
			contextWithoutBinaryBufferHelper,
			item,
			0,
			[{ binaryProperty: 'data' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);

		expect(multipart.body.toString('utf8')).toContain('filename="note.txt"');
	});

	it('should build multipart body from binaryHandleId entries', async () => {
		const multipart = await buildMultipartBody(
			mockExecuteFunctions,
			{ json: {} },
			0,
			[{ binaryHandleId: 'opaque-handle', comment: 'from handle' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);

		const body = multipart.body.toString('utf8');
		expect(mockGetBinaryMetadata).toHaveBeenCalledWith('opaque-handle');
		expect(mockGetBinaryStream).toHaveBeenCalledWith('opaque-handle');
		expect(mockBinaryToBuffer).toHaveBeenCalled();
		expect(body).toContain('filename="opaque-handle.txt"');
		expect(body).toContain('from handle');
	});

	it('should reject binaryHandleId uploads when runtime helpers are missing', async () => {
		const unsupportedContext = {
			...mockExecuteFunctions,
			helpers: {},
		} as unknown as IExecuteFunctions;

		await expect(
			buildMultipartBody(
				unsupportedContext,
				{ json: {} },
				0,
				[{ binaryHandleId: 'opaque-handle' }],
				false,
				'chat',
				undefined,
				undefined,
				undefined,
				undefined,
			),
		).rejects.toThrow('Binary handle uploads are not supported by this n8n runtime.');
	});

	it('should reject oversized binaryHandleId uploads before reading the stream', async () => {
		mockGetBinaryMetadata.mockResolvedValueOnce({
			fileName: 'opaque-handle.txt',
			mimeType: 'text/plain',
			fileSize: 50 * 1024 * 1024 + 1,
		});

		await expect(
			buildMultipartBody(
				mockExecuteFunctions,
				{ json: {} },
				0,
				[{ binaryHandleId: 'opaque-handle' }],
				false,
				'chat',
				undefined,
				undefined,
				undefined,
				undefined,
			),
		).rejects.toThrow('File for binaryHandleId "opaque-handle" exceeds 50 MB.');
		expect(mockGetBinaryStream).not.toHaveBeenCalled();
	});

	it('should fall back to a synthetic filename when binary handle metadata has no fileName', async () => {
		mockGetBinaryMetadata.mockResolvedValueOnce({
			fileName: undefined,
			mimeType: 'text/plain',
			fileSize: 11,
		});

		const multipart = await buildMultipartBody(
			mockExecuteFunctions,
			{ json: {} },
			0,
			[{ binaryHandleId: 'opaque-handle' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);

		expect(multipart.body.toString('utf8')).toContain('filename="file-opaque-handle"');
	});

	it('should wrap unexpected binaryHandleId resolution errors', async () => {
		mockGetBinaryMetadata.mockRejectedValueOnce(new Error('lookup failed'));

		await expect(
			buildMultipartBody(
				mockExecuteFunctions,
				{ json: {} },
				0,
				[{ binaryHandleId: 'opaque-handle' }],
				false,
				'chat',
				undefined,
				undefined,
				undefined,
				undefined,
			),
		).rejects.toThrow('Unable to resolve binaryHandleId "opaque-handle". lookup failed');
	});

	it('should stringify non-Error binaryHandleId resolution failures', async () => {
		mockGetBinaryMetadata.mockRejectedValueOnce('lookup failed');

		await expect(
			buildMultipartBody(
				mockExecuteFunctions,
				{ json: {} },
				0,
				[{ binaryHandleId: 'opaque-handle' }],
				false,
				'chat',
				undefined,
				undefined,
				undefined,
				undefined,
			),
		).rejects.toThrow('Unable to resolve binaryHandleId "opaque-handle". lookup failed');
	});

	it('should sanitize invalid mime type values in multipart content headers', async () => {
		const item: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello', 'utf8').toString('base64'),
					fileName: 'note.txt',
					mimeType: 'text/plain\r\nX-Injected: 1',
				},
			},
		};

		const multipart = await buildMultipartBody(
			mockExecuteFunctions,
			item,
			0,
			[{ binaryProperty: 'data' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);

		const body = multipart.body.toString('utf8');
		expect(body).toContain('Content-Type: application/octet-stream');
		expect(body).not.toContain('X-Injected');
	});

	it('should sanitize non-string and control-character mime types', async () => {
		const numericMimeItem: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello', 'utf8').toString('base64'),
					fileName: 'note.txt',
					mimeType: 123 as unknown as string,
				},
			},
		};

		const controlCharMimeItem: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello', 'utf8').toString('base64'),
					fileName: 'note.txt',
					mimeType: `text/plain${String.fromCharCode(1)}`,
				},
			},
		};

		const multipartNumeric = await buildMultipartBody(
			mockExecuteFunctions,
			numericMimeItem,
			0,
			[{ binaryProperty: 'data' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);
		const multipartControl = await buildMultipartBody(
			mockExecuteFunctions,
			controlCharMimeItem,
			0,
			[{ binaryProperty: 'data' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);

		expect(multipartNumeric.body.toString('utf8')).toContain(
			'Content-Type: application/octet-stream',
		);
		expect(multipartControl.body.toString('utf8')).toContain(
			'Content-Type: application/octet-stream',
		);
	});

	it('should preserve valid mime type and reject invalid non-control mime strings', async () => {
		const validMimeItem: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello', 'utf8').toString('base64'),
					fileName: 'note.txt',
					mimeType: 'application/json',
				},
			},
		};

		const invalidMimeItem: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('hello', 'utf8').toString('base64'),
					fileName: 'note.txt',
					mimeType: 'not-a-valid-mime',
				},
			},
		};

		const multipartValid = await buildMultipartBody(
			mockExecuteFunctions,
			validMimeItem,
			0,
			[{ binaryProperty: 'data' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);
		const multipartInvalid = await buildMultipartBody(
			mockExecuteFunctions,
			invalidMimeItem,
			0,
			[{ binaryProperty: 'data' }],
			false,
			'chat',
			undefined,
			undefined,
			undefined,
			undefined,
		);

		expect(multipartValid.body.toString('utf8')).toContain('Content-Type: application/json');
		expect(multipartInvalid.body.toString('utf8')).toContain(
			'Content-Type: application/octet-stream',
		);
	});
});
