import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import * as get from '../../../../../../nodes/ZohoCliq/v1/actions/message/get.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const MOCK_MESSAGE_LIST_RESPONSE = {
	data: [
		{
			id: '1629426730589_40288830613',
			time: '1629426730589',
			type: 'text',
			sender: {
				name: 'Zylker',
				id: '15067889',
			},
			content: {
				text: 'Hello world',
			},
		},
		{
			id: '1629426730590_40288830614',
			time: '1629426730590',
			type: 'file',
			sender: {
				name: 'Alex',
				id: '15067890',
			},
			content: {
				text: '',
				file: {
					name: 'report.pdf',
					blur_data: 'base64...',
				},
			},
		},
	],
};

describe('ZohoCliq - Message - Simplify Operation Tests', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createGetContext = (
		values: {
			chatId?: string;
			optionalFilters?: IDataObject;
			simplify?: boolean;
			simplifyMode?: string;
			simplifyFields?: string[];
		} = {},
	): IExecuteFunctions => {
		const {
			chatId = 'CT_123_456',
			optionalFilters = {},
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'chatId') return chatId;
				if (name === 'optionalFilters') return optionalFilters;
				if (name === 'simplify') return simplify;
				if (name === 'simplifyMode') return simplifyMode;
				if (name === 'simplifyFields') return simplifyFields;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	// -----------------------------------------------------------------------
	// Description tests
	// -----------------------------------------------------------------------

	describe('description', () => {
		it('get should expose simplify, simplifyMode, simplifyFields params', () => {
			const paramNames = get.description.map((p) => p.name);
			expect(paramNames).toContain('simplify');
			expect(paramNames).toContain('simplifyMode');
			expect(paramNames).toContain('simplifyFields');
		});
	});

	// -----------------------------------------------------------------------
	// Message Get - Simplify
	// -----------------------------------------------------------------------

	describe('message/get simplify', () => {
		it('should return single item with full wrapper response in raw mode (simplify=false)', async () => {
			const ctx = createGetContext({ simplify: false });
			mockZohoCliqApiRequest.mockResolvedValueOnce(MOCK_MESSAGE_LIST_RESPONSE);

			const result = await get.execute.call(ctx, items, SCOPES.MESSAGES_READ_WITH_CHAT_LOOKUP);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('data');
			expect(result[0].json.data as IDataObject[]).toHaveLength(2);
		});

		it('should return individual simplified items when simplify is enabled', async () => {
			const ctx = createGetContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValueOnce(MOCK_MESSAGE_LIST_RESPONSE);

			const result = await get.execute.call(ctx, items, SCOPES.MESSAGES_READ_WITH_CHAT_LOOKUP);

			// Two message items (no _pagination since Get Messages has no pagination keys)
			expect(result).toHaveLength(2);

			// First simplified message
			expect(result[0].json).toEqual({
				id: '1629426730589_40288830613',
				time: '1629426730589',
				type: 'text',
				sender_name: 'Zylker',
				sender_id: '15067889',
				content_text: 'Hello world',
			});

			// Second simplified message (file type — content_file_name flattened)
			expect(result[1].json).toEqual({
				id: '1629426730590_40288830614',
				time: '1629426730590',
				type: 'file',
				sender_name: 'Alex',
				sender_id: '15067890',
				content_text: '',
				content_file_name: 'report.pdf',
			});

			// Should NOT contain non-simplified keys
			expect(result[0].json).not.toHaveProperty('sender');
			expect(result[0].json).not.toHaveProperty('content');
		});

		it('should return items with only id + selected fields', async () => {
			const ctx = createGetContext({
				simplify: true,
				simplifyMode: 'selectedFields',
				simplifyFields: ['time', 'type'],
			});
			mockZohoCliqApiRequest.mockResolvedValueOnce(MOCK_MESSAGE_LIST_RESPONSE);

			const result = await get.execute.call(ctx, items, SCOPES.MESSAGES_READ_WITH_CHAT_LOOKUP);

			expect(result).toHaveLength(2);

			// idKey (id) is always included + selected fields
			expect(result[0].json).toEqual({
				id: '1629426730589_40288830613',
				time: '1629426730589',
				type: 'text',
			});

			// Should NOT have unselected keys
			expect(result[0].json).not.toHaveProperty('sender_name');
			expect(result[0].json).not.toHaveProperty('content_text');
		});

		it('should fall back to single simplified item when response has no data array', async () => {
			const ctx = createGetContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValueOnce({
				messages: [
					{
						id: '1629426730589_40288830613',
						time: '1629426730589',
						type: 'text',
						sender: { name: 'Zylker', id: '15067889' },
						content: { text: 'Hello world' },
					},
					{
						id: '1629426730590_40288830614',
						time: '1629426730590',
						type: 'file',
						sender: { name: 'Alex', id: '15067890' },
						content: { text: '', file: { name: 'report.pdf' } },
					},
				],
			});

			const result = await get.execute.call(ctx, items, SCOPES.MESSAGES_READ_WITH_CHAT_LOOKUP);

			// Falls back to applySimplifyMode on the whole response — no simplified keys at top level
			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({});
		});

		it('should return single empty item when response is an empty object in simplified mode', async () => {
			const ctx = createGetContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValueOnce({});

			const result = await get.execute.call(ctx, items, SCOPES.MESSAGES_READ_WITH_CHAT_LOOKUP);

			// No data array → falls back to applySimplifyMode on empty object
			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({});
		});

		it('should return empty array when data is empty in simplified mode', async () => {
			const ctx = createGetContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValueOnce({ data: [] });

			const result = await get.execute.call(ctx, items, SCOPES.MESSAGES_READ_WITH_CHAT_LOOKUP);

			expect(result).toHaveLength(0);
		});
	});
});
