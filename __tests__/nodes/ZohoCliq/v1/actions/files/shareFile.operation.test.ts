import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';

import * as shareFile from '../../../../../../nodes/ZohoCliq/v1/actions/files/shareFile.operation';
import * as utils from '../../../../../../nodes/ZohoCliq/v1/helpers/utils';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Files - Share File Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	let currentParams: Record<string, unknown>;
	let mockGetBinaryDataBuffer: jest.Mock;
	let mockGetBinaryMetadata: jest.Mock;
	let mockGetBinaryStream: jest.Mock;
	let mockBinaryToBuffer: jest.Mock;
	const mockZohoCliqApiMultipartRequest =
		transport.zohoCliqApiMultipartRequest as jest.MockedFunction<
			typeof transport.zohoCliqApiMultipartRequest
		>;

	const createItem = (
		content = 'hello',
		fileName = 'note.txt',
		mimeType = 'text/plain',
	): INodeExecutionData => ({
		json: {},
		binary: {
			data: {
				data: Buffer.from(content).toString('base64'),
				fileName,
				mimeType,
			},
		},
	});

	const createMappedEntries = (
		...entries: Array<{ binaryProperty?: string; comment?: string }>
	) => ({
		fileEntry: entries,
	});

	const buildMissingScopePayload = (
		requiredScope: string,
		resource = 'files',
		operation = 'shareFile',
	) => ({
		success: false,
		resource,
		operation,
		requiredScopes: [requiredScope],
		missingScopes: [requiredScope],
		hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
	});

	const configureParameters = (overrides: Record<string, unknown> = {}) => {
		const defaults: Record<string, unknown> = {
			shareTarget: 'chat',
			agentSelectedShareTarget: 'chat',
			agentPostAsBot: false,
			agentChannelId: '',
			agentChannelUniqueName: '',
			agentChatId: '',
			agentBotUniqueName: '',
			agentBotDisplayName: '',
			agentBotImageUrl: '',
			agentBuddyUserId: '',
			agentBuddyEmail: '',
			fileInputMode: 'mapped',
			fileEntries: createMappedEntries({ binaryProperty: 'data', comment: '' }),
			fileEntriesRaw: '[]',
			markAsRead: false,
			postAsBot: false,
			chatId: 'CT_12345',
			channelId: 'CH_12345',
			channelUniqueName: 'eng_updates',
			botUniqueName: '',
			buddyIdentifierType: 'userId',
			buddyUserId: '66578893',
			buddyEmail: 'person@example.com',
			postAsBotUniqueName: '',
			botDisplayName: '',
			botImageUrl: '',
			botSubscriberUserIds: '',
			includeEnhancedOutput: true,
			enableAiErrorMode: false,
		};

		const params = {
			...defaults,
			...overrides,
		};
		currentParams = params;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'channelId' && options?.extractValue) {
					return params.channelId;
				}

				if (name in params) {
					return params[name];
				}

				return fallback;
			},
		);
	};

	beforeEach(() => {
		currentParams = {};
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
			fileName: `${binaryHandleId}.pdf`,
			mimeType: 'application/pdf',
			fileSize: 7,
		}));
		mockGetBinaryStream = jest.fn(async (binaryHandleId: string) =>
			Buffer.from(`file:${binaryHandleId}`, 'utf8'),
		);
		mockBinaryToBuffer = jest.fn(async (body: Buffer) => body);

		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn().mockReturnValue(false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
				getBinaryDataBuffer: mockGetBinaryDataBuffer,
				getBinaryMetadata: mockGetBinaryMetadata,
				getBinaryStream: mockGetBinaryStream,
				binaryToBuffer: mockBinaryToBuffer,
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode: currentParams.enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiMultipartRequest.mockClear();
		mockZohoCliqApiMultipartRequest.mockResolvedValue({ status: 'ok' });
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should share file to channel by ID using mapped entries', async () => {
		configureParameters({
			shareTarget: 'channelId',
			markAsRead: true,
			fileEntries: createMappedEntries({ binaryProperty: 'data', comment: 'Quarterly report' }),
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/CH_12345/files',
			expect.any(Buffer),
			expect.stringContaining('multipart/form-data; boundary='),
			undefined,
		);

		const body = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString('utf8');
		expect(body).toContain('name="comments"');
		expect(body).toContain('Quarterly report');
		expect(body).toContain('name="mark_as_read"');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				resource: 'files',
				operation: 'shareFile',
				share_target: 'channelId',
				target_identifier: 'CH_12345',
				file_count: 1,
				binary_properties: ['data'],
				mark_as_read: true,
			}),
		);
	});

	it('should share file using Agent Choice chat routing', async () => {
		configureParameters({
			shareTarget: 'agentChoice',
			agentSelectedShareTarget: 'chat',
			agentChatId: 'CT_98765',
			fileEntries: createMappedEntries({ binaryProperty: 'data', comment: 'AI-routed file' }),
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/chats/CT_98765/files',
			expect.any(Buffer),
			expect.stringContaining('multipart/form-data; boundary='),
			undefined,
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				share_target: 'chat',
				target_identifier: 'CT_98765',
			}),
		);
	});

	it('should share file using Agent Choice user email routing', async () => {
		configureParameters({
			shareTarget: 'agentChoice',
			agentSelectedShareTarget: 'buddy',
			agentBuddyEmail: 'person@example.com',
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/buddies/person%40example.com/files',
			expect.any(Buffer),
			expect.any(String),
			undefined,
		);
	});

	it('should treat undefined postAsBot as false for channel targets', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: undefined,
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				share_target: 'channelId',
				target_identifier: 'CH_12345',
				success: true,
			}),
		);
		expect(result[0].json).not.toHaveProperty('post_as_bot');
	});

	it('should preserve the raw API response when enhanced output is disabled', async () => {
		configureParameters({
			includeEnhancedOutput: false,
		});
		mockZohoCliqApiMultipartRequest.mockResolvedValue('' as unknown as IDataObject);

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should parse string false for includeEnhancedOutput and skip enhanced metadata', async () => {
		configureParameters({
			includeEnhancedOutput: 'false',
		});
		mockZohoCliqApiMultipartRequest.mockResolvedValue('' as unknown as IDataObject);

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should include empty comment placeholders to preserve file index order', async () => {
		configureParameters({
			fileEntries: createMappedEntries(
				{ binaryProperty: 'data', comment: 'First comment' },
				{ binaryProperty: 'data2', comment: '' },
			),
		});

		const item: INodeExecutionData = {
			json: {},
			binary: {
				data: {
					data: Buffer.from('a').toString('base64'),
					fileName: 'a.txt',
					mimeType: 'text/plain',
				},
				data2: {
					data: Buffer.from('b').toString('base64'),
					fileName: 'b.txt',
					mimeType: 'text/plain',
				},
			},
		};

		await shareFile.execute.call(mockExecuteFunctions, [item], SCOPES.WEBHOOKS_CREATE);

		const body = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString('utf8');
		expect(body).toContain('["First comment",""]');
	});

	it('should ignore empty mapped rows (graceful expression fallback behavior)', async () => {
		configureParameters({
			fileEntries: createMappedEntries(
				{ binaryProperty: 'data', comment: 'Only one real file' },
				{ binaryProperty: '', comment: '' },
				{ binaryProperty: '   ', comment: '   ' },
			),
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledTimes(1);
	});

	it('should ignore mapped rows with omitted binaryProperty when at least one valid row exists', async () => {
		configureParameters({
			fileEntries: createMappedEntries({}, { binaryProperty: 'data', comment: 'Only valid row' }),
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledTimes(1);
	});

	it('should fail when mapped fileEntries.fileEntry is not an array', async () => {
		configureParameters({
			fileEntries: { fileEntry: { binaryProperty: 'data' } },
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Provide at least one file entry with a non-empty Binary Property.');
	});

	it('should throw missing-scope error payload contract when OAuth scope is missing', async () => {
		const requiredScope = getRequiredScopeForOperation('files', 'shareFile');
		configureParameters({
			resource: 'files',
			operation: 'shareFile',
		});

		let thrownError: unknown;
		try {
			await shareFile.execute.call(mockExecuteFunctions, [createItem()], '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(buildMissingScopePayload(requiredScope));
	});

	it('should return structured scope payload when continueOnFail is enabled and scope is missing', async () => {
		const requiredScope = getRequiredScopeForOperation('files', 'shareFile');
		configureParameters({
			resource: 'files',
			operation: 'shareFile',
		});
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		const result = await shareFile.execute.call(mockExecuteFunctions, [createItem()], '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(buildMissingScopePayload(requiredScope));
		expect(mockZohoCliqApiMultipartRequest).not.toHaveBeenCalled();
	});

	it('should throw when mapped row has comment but empty binary property', async () => {
		configureParameters({
			fileEntries: createMappedEntries({ binaryProperty: '', comment: 'orphan comment' }),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('binaryProperty is required when comment is provided');
	});

	it('should throw clear error when mapped binary property resolves to a binary object', async () => {
		configureParameters({
			fileEntries: createMappedEntries({
				binaryProperty: {
					mimeType: 'application/pdf',
					data: 'filesystem-v2',
				} as unknown as string,
				comment: 'from expression',
			}),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('must be a string property name');
	});

	it('should throw when all mapped rows are empty', async () => {
		configureParameters({
			fileEntries: createMappedEntries({ binaryProperty: '', comment: '' }),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Provide at least one file entry with a non-empty Binary Property.');
	});

	it('should throw when duplicate binary properties are used', async () => {
		configureParameters({
			fileEntries: createMappedEntries(
				{ binaryProperty: 'data', comment: 'a' },
				{ binaryProperty: 'data', comment: 'b' },
			),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Duplicate Binary Property "data" is not allowed.');
	});

	it('should parse advanced raw JSON file entries', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify([{ binaryProperty: 'data', comment: 'From raw' }]),
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledTimes(1);
	});

	it('should share files from binaryHandleId entries in raw mode', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify([
				{ binaryHandleId: 'opaque-handle', comment: 'From get file' },
			]),
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[{ json: {} }],
			SCOPES.WEBHOOKS_CREATE,
		);

		const body = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString('utf8');
		expect(mockGetBinaryMetadata).toHaveBeenCalledWith('opaque-handle');
		expect(mockGetBinaryStream).toHaveBeenCalledWith('opaque-handle');
		expect(mockBinaryToBuffer).toHaveBeenCalled();
		expect(body).toContain('filename="opaque-handle.pdf"');
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				file_count: 1,
				binary_handle_ids: ['opaque-handle'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('binary_properties');
	});

	it('should allow raw entries with null comments and omit comments field', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify([{ binaryProperty: 'data', comment: null }]),
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		const body = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString('utf8');
		expect(body).not.toContain('name="comments"');
	});

	it('should throw for invalid advanced raw JSON shape', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify({ binaryProperty: 'data' }),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('File Entries (JSON) must be an array of objects.');
	});

	it('should throw for unsupported fields in advanced raw entries', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify([{ binaryProperty: 'data', extra: true }]),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Allowed fields: binaryProperty, binaryHandleId, comment');
	});

	it('should throw when raw entry includes both binaryProperty and binaryHandleId', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify([{ binaryProperty: 'data', binaryHandleId: 'opaque-handle' }]),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('must include exactly one of binaryProperty or binaryHandleId, not both');
	});

	it('should throw when raw entry includes neither binaryProperty nor binaryHandleId', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify([{ comment: 'orphan comment' }]),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow(
			'must include either binaryProperty or binaryHandleId when comment is provided',
		);
	});

	it('should throw for unsafe prototype keys in advanced raw entries', async () => {
		configureParameters({ fileInputMode: 'raw' });
		const parsedUnsafe = JSON.parse('{"__proto__":"blocked"}') as IDataObject;
		const rawEntries = [parsedUnsafe];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'shareTarget') return 'chat';
			if (name === 'fileInputMode') return 'raw';
			if (name === 'fileEntriesRaw') return rawEntries;
			if (name === 'markAsRead') return false;
			if (name === 'postAsBot') return false;
			if (name === 'chatId') return 'CT_12345';
			if (name === 'botDisplayName') return '';
			if (name === 'botImageUrl') return '';
			if (name === 'botSubscriberUserIds') return '';
			return undefined;
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Unsafe key "__proto__" is not allowed');
	});

	it('should append bot_unique_name query and form-data when postAsBot is enabled for channel targets', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: 'helperbot',
			botDisplayName: 'Helper Bot',
			botImageUrl: 'https://example.com/bot.png',
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/CH_12345/files',
			expect.any(Buffer),
			expect.stringContaining('multipart/form-data; boundary='),
			{ bot_unique_name: 'helperbot' },
		);

		const body = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString('utf8');
		expect(body).toContain('name="bot_unique_name"');
		expect(body).toContain('helperbot');
	});

	it('should support Agent Choice channelId routing with Bot Unique Name when Post as Bot is enabled', async () => {
		configureParameters({
			shareTarget: 'agentChoice',
			agentSelectedShareTarget: 'channelId',
			agentPostAsBot: true,
			agentChannelId: 'CH_98765',
			agentBotUniqueName: 'helperbot',
			agentBotDisplayName: 'Helper Bot',
			agentBotImageUrl: 'https://example.com/bot.png',
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/channels/CH_98765/files',
			expect.any(Buffer),
			expect.stringContaining('multipart/form-data; boundary='),
			{ bot_unique_name: 'helperbot' },
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				share_target: 'channelId',
				target_identifier: 'CH_98765',
				post_as_bot: true,
				bot_unique_name: 'helperbot',
			}),
		);
	});

	it('should ignore postAsBot for chat target', async () => {
		configureParameters({
			shareTarget: 'chat',
			postAsBot: true,
			botUniqueName: 'helperbot',
			botDisplayName: 'Helper Bot',
			botImageUrl: 'https://example.com/bot.png',
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				share_target: 'chat',
				target_identifier: 'CT_12345',
				success: true,
			}),
		);
		expect(result[0].json).not.toHaveProperty('post_as_bot');
	});

	it('should fan out to multiple bot API calls when multiple subscriber user IDs are provided', async () => {
		configureParameters({
			shareTarget: 'bot',
			botUniqueName: 'statusbot',
			botSubscriberUserIds: '998877,887766',
		});

		mockZohoCliqApiMultipartRequest
			.mockResolvedValueOnce({ user_ids: ['998877'] })
			.mockResolvedValueOnce({ user_ids: ['887766'] });

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledTimes(2);

		const requestBody1 = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString(
			'utf8',
		);
		const requestBody2 = (mockZohoCliqApiMultipartRequest.mock.calls[1][2] as Buffer).toString(
			'utf8',
		);

		expect(requestBody1).toContain('name="user_id"');
		expect(requestBody1).toContain('998877');
		expect(requestBody2).toContain('name="user_id"');
		expect(requestBody2).toContain('887766');
		expect(requestBody1).not.toContain('name="mark_as_read"');
		expect(requestBody2).not.toContain('name="mark_as_read"');
	});

	it('should keep single bot API call when only one subscriber user ID is provided', async () => {
		configureParameters({
			shareTarget: 'bot',
			botUniqueName: 'statusbot',
			botSubscriberUserIds: '998877',
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledTimes(1);
		const requestBody = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString(
			'utf8',
		);
		expect(requestBody).toContain('name="user_id"');
		expect(requestBody).toContain('998877');
	});

	it('should share to user target via email', async () => {
		configureParameters({
			shareTarget: 'buddy',
			buddyIdentifierType: 'email',
			buddyEmail: 'person@example.com',
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/buddies/person%40example.com/files',
			expect.any(Buffer),
			expect.any(String),
			undefined,
		);
	});

	it('should not read channel bot sender fields for non-channel share targets', async () => {
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(
				name: string,
				_itemIndex?: number,
				fallback?: unknown,
				options?: { extractValue?: boolean },
			) => {
				if (name === 'shareTarget') return 'chat';
				if (name === 'fileInputMode') return 'mapped';
				if (name === 'fileEntries') {
					return createMappedEntries({ binaryProperty: 'data', comment: '' });
				}
				if (name === 'markAsRead') return false;
				if (name === 'chatId') return 'CT_12345';
				if (name === 'includeEnhancedOutput') return true;
				if (name === 'enableAiErrorMode') return false;
				if (name === 'channelId' && options?.extractValue) return 'CH_12345';
				if (['postAsBot', 'postAsBotUniqueName', 'botDisplayName', 'botImageUrl'].includes(name)) {
					throw new Error(`unexpected parameter access: ${name}`);
				}
				return fallback;
			},
		);

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).resolves.toHaveLength(1);
	});

	it('should throw when bot image URL protocol is unsupported', async () => {
		configureParameters({
			shareTarget: 'channelId',
			botImageUrl: 'ftp://example.com/avatar.png',
			postAsBot: true,
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Bot Image URL must use HTTP or HTTPS');
	});

	it('should throw when share target is missing', async () => {
		configureParameters({
			shareTarget: '',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Share Target is required');
	});

	it('should throw when share target is outside the allowlist', async () => {
		configureParameters({
			shareTarget: 'legacy-target',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Share Target must be one of');
	});

	it('should throw when Agent Choice target is missing', async () => {
		configureParameters({
			shareTarget: 'agentChoice',
			agentSelectedShareTarget: '   ',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Agent Selected Share Target is required');
	});

	it('should throw when Agent Choice target conflicts with provided identifiers', async () => {
		configureParameters({
			shareTarget: 'agentChoice',
			agentSelectedShareTarget: 'chat',
			agentChatId: 'CT_12345',
			agentChannelId: 'CH_12345',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('only the matching target identifier field(s) may be provided');
	});

	it('should use Bot Unique Name for Agent Choice bot routing', async () => {
		configureParameters({
			shareTarget: 'agentChoice',
			agentSelectedShareTarget: 'bot',
			agentBotUniqueName: 'helperbot',
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/bots/helperbot/files',
			expect.any(Buffer),
			expect.stringContaining('multipart/form-data; boundary='),
			undefined,
		);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				share_target: 'bot',
				target_identifier: 'helperbot',
			}),
		);
	});

	it('should return recoverable Agent Choice validation errors in AI Error Mode', async () => {
		configureParameters({
			shareTarget: 'agentChoice',
			agentSelectedShareTarget: 'buddy',
			agentBuddyUserId: '66578893',
			agentBuddyEmail: 'person@example.com',
			enableAiErrorMode: true,
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'files',
				operation: 'shareFile',
				share_target_selection: 'agentChoice',
				agent_selected_share_target: 'buddy',
			}),
		);
		expect(String(result[0].json.message)).toContain(
			'provide either User ID or User Email, not both',
		);
	});

	it('should throw when file input mode is outside the allowlist', async () => {
		configureParameters({
			fileInputMode: 'legacy',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('File Input Mode must be either "mapped" or "raw".');
	});

	it('should throw when buddy identifier type is outside the allowlist', async () => {
		configureParameters({
			shareTarget: 'buddy',
			buddyIdentifierType: 'legacy',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('User Identifier Type must be either "userId" or "email".');
	});

	it('should throw when Bot Unique Name is empty for channel post-as-bot', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: '   ',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Bot Unique Name is required');
	});

	it('should throw when Bot Unique Name has invalid characters for channel post-as-bot', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: 'bad.bot',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Bot Unique Name has an invalid format');
	});

	it('should throw when Bot Unique Name exceeds maximum length for channel post-as-bot', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: 'a'.repeat(101),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Bot Unique Name is too long. Maximum length is 100 characters.');
	});

	it('should throw when bot display name exceeds maximum length', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: 'helperbot',
			botDisplayName: 'a'.repeat(101),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Bot Display Name is too long. Maximum length is 100 characters.');
	});

	it('should throw when bot image URL is not a valid URL', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: 'helperbot',
			botImageUrl: 'not-a-url',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Bot Image URL must be a valid URL');
	});

	it('should throw when bot image URL exceeds maximum length', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: 'helperbot',
			botImageUrl: `https://example.com/${'a'.repeat(600)}`,
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Bot Image URL is too long. Maximum length is 500 characters.');
	});

	it('should throw when mapped comment exceeds maximum length', async () => {
		configureParameters({
			fileEntries: createMappedEntries({ binaryProperty: 'data', comment: 'a'.repeat(1001) }),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('must be 1000 characters or fewer.');
	});

	it('should throw when raw entries JSON text is empty', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: '   ',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('File Entries (JSON) cannot be empty. Provide a JSON array.');
	});

	it('should throw when raw entries JSON text is invalid', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: '[{',
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('File Entries (JSON) must be valid JSON when provided as text.');
	});

	it('should throw when raw entries value is not an array', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: { binaryProperty: 'data' } as unknown as string,
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('File Entries (JSON) must be an array of objects.');
	});

	it('should throw when a raw entry is not an object', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify(['data']),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('must be a JSON object');
	});

	it('should throw when more than 10 file entries are provided', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify(
				Array.from({ length: 11 }, (_, i) => ({ binaryProperty: `data${i}`, comment: '' })),
			),
		});

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('You can upload at most 10 files per request.');
	});

	it('should URL encode channel unique name endpoint values', async () => {
		configureParameters({
			shareTarget: 'channelUniqueName',
			channelUniqueName: 'eng_updates',
		});
		const validateChannelNameSpy = jest
			.spyOn(utils, 'validateChannelName')
			.mockReturnValue('eng release/notes');

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			`/api/v2/channelsbyname/${encodeURIComponent('eng release/notes')}/files`,
			expect.any(Buffer),
			expect.any(String),
			undefined,
		);
		validateChannelNameSpy.mockRestore();
	});

	it('should share to user target via user ID endpoint', async () => {
		configureParameters({
			shareTarget: 'buddy',
			buddyIdentifierType: 'userId',
			buddyUserId: '66578893',
		});

		await shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledWith(
			'POST',
			'/api/v2/buddies/66578893/files',
			expect.any(Buffer),
			expect.any(String),
			undefined,
		);
	});

	it('should throw when file exceeds 50MB', async () => {
		configureParameters();
		const oversizedBuffer = Buffer.alloc(50 * 1024 * 1024 + 1, 1);
		mockGetBinaryDataBuffer.mockResolvedValueOnce(oversizedBuffer);
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: {
					data: {
						data: Buffer.from('small', 'utf8').toString('base64'),
						fileName: 'big.bin',
						mimeType: 'application/octet-stream',
					},
				},
			},
		];

		await expect(
			shareFile.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('File in binary property "data" exceeds 50 MB.');
	});

	it('should throw when binary data is missing', async () => {
		configureParameters();

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [{ json: {} }], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow(NodeOperationError);
	});

	it('should use getBinaryDataBuffer helper for filesystem-backed binary data', async () => {
		configureParameters();
		const getBinaryDataBuffer = jest.fn().mockResolvedValue(Buffer.from('PDF_CONTENT', 'utf8'));
		(
			mockExecuteFunctions.helpers as unknown as {
				getBinaryDataBuffer?: (itemIndex: number, propertyName: string) => Promise<Buffer>;
			}
		).getBinaryDataBuffer = getBinaryDataBuffer;

		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: {
					data: {
						data: 'filesystem-v2',
						id: 'filesystem-v2:path',
						fileName: 'doc.pdf',
						mimeType: 'application/pdf',
					},
				},
			},
		];

		await shareFile.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

		expect(getBinaryDataBuffer).toHaveBeenCalledWith(0, 'data');
		const requestBody = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString(
			'utf8',
		);
		expect(requestBody).toContain('PDF_CONTENT');
	});

	it('should use binary property name and default mime type when metadata is missing', async () => {
		configureParameters();
		const items: INodeExecutionData[] = [
			{
				json: {},
				binary: {
					data: {
						data: Buffer.from('raw').toString('base64'),
						fileName: '',
						mimeType: '',
					},
				},
			},
		];

		await shareFile.execute.call(mockExecuteFunctions, items, SCOPES.WEBHOOKS_CREATE);

		const requestBody = (mockZohoCliqApiMultipartRequest.mock.calls[0][2] as Buffer).toString(
			'utf8',
		);
		expect(requestBody).toContain('filename="data"');
		expect(requestBody).toContain('Content-Type: application/octet-stream');
	});

	it('should return paired error item when continueOnFail is enabled', async () => {
		configureParameters();
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiMultipartRequest.mockRejectedValue(new Error('Multipart request failed'));

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Multipart request failed',
				resource: 'files',
				operation: 'shareFile',
				share_target: 'chat',
				target_identifier: 'CT_12345',
				file_input_mode: 'mapped',
				binary_properties: ['data'],
			}),
		);
	});

	it('should stringify non-Error multipart failures in continueOnFail payload', async () => {
		configureParameters();
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiMultipartRequest.mockRejectedValue('Multipart failed');

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Multipart failed',
				resource: 'files',
				operation: 'shareFile',
			}),
		);
	});

	it('should stringify undefined multipart failures in continueOnFail payload', async () => {
		configureParameters();
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiMultipartRequest.mockRejectedValue(undefined);

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'Failed to share file(s) in Zoho Cliq.',
				resource: 'files',
				operation: 'shareFile',
			}),
		);
	});

	it('should return a recoverable API payload in AI Error Mode', async () => {
		configureParameters({
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiMultipartRequest.mockRejectedValue({
			statusCode: 404,
			message: 'Target chat not found',
		});

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'files',
				operation: 'shareFile',
				status_code: 404,
				reason: 'NOT_FOUND',
				share_target: 'chat',
				target_identifier: 'CT_12345',
			}),
		);
	});

	it('should include bot_unique_name in recoverable payloads for post-as-bot channel errors', async () => {
		configureParameters({
			shareTarget: 'channelId',
			postAsBot: true,
			botUniqueName: 'helperbot',
		});
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiMultipartRequest.mockRejectedValue(new Error('Channel post failed'));

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				bot_unique_name: 'helperbot',
				post_as_bot: true,
			}),
		);
	});

	it('should include subscriber_user_ids in recoverable payloads for bot fan-out errors', async () => {
		configureParameters({
			shareTarget: 'bot',
			botUniqueName: 'statusbot',
			botSubscriberUserIds: '998877,887766',
		});
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiMultipartRequest.mockRejectedValue(new Error('Bot delivery failed'));

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[createItem()],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				subscriber_user_ids: ['998877', '887766'],
			}),
		);
	});

	it('should include binary_handle_ids in recoverable payloads for handle-based share errors', async () => {
		configureParameters({
			fileInputMode: 'raw',
			fileEntriesRaw: JSON.stringify([
				{ binaryHandleId: 'opaque-handle', comment: 'From get file' },
			]),
		});
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		mockZohoCliqApiMultipartRequest.mockRejectedValueOnce(new Error('Multipart request failed'));

		const result = await shareFile.execute.call(
			mockExecuteFunctions,
			[{ json: {} }],
			SCOPES.WEBHOOKS_CREATE,
		);

		expect(mockZohoCliqApiMultipartRequest).toHaveBeenCalledTimes(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'files',
				operation: 'shareFile',
				file_input_mode: 'raw',
				binary_handle_ids: ['opaque-handle'],
			}),
		);
		expect(result[0].json).not.toHaveProperty('binary_properties');
	});

	it('should rethrow multipart failures when continueOnFail is disabled', async () => {
		configureParameters();
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(false);
		mockZohoCliqApiMultipartRequest.mockRejectedValue(new Error('Multipart request failed'));

		await expect(
			shareFile.execute.call(mockExecuteFunctions, [createItem()], SCOPES.WEBHOOKS_CREATE),
		).rejects.toThrow('Multipart request failed');
	});

	it('should expose default mapped mode and advanced guidance fields in description', () => {
		const inputModeField = shareFile.description.find((field) => field.name === 'fileInputMode');
		expect(inputModeField?.default).toBe('mapped');
		expect(
			shareFile.description.some((field) => field.name === 'mappedEntriesGuidanceNotice'),
		).toBe(true);
		expect(shareFile.description.some((field) => field.name === 'rawEntriesGuidanceNotice')).toBe(
			true,
		);
	});
});
