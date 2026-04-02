import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import * as listCallRecordings from '../../../../../../nodes/ZohoCliq/v1/actions/callsMeeting/listCallRecordings.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const MOCK_CALL_RECORDING_LIST_RESPONSE = {
	data: [
		{
			id: '123456789',
			session_id: 'SESSION_123456789',
			type: 'audio_conference',
			title: 'Incident Bridge',
			scope: 'organization',
			start_time: 1741276800000,
			end_time: 1741278600000,
			host: {
				id: '987654321',
				name: 'Alex Rivera',
			},
			participant_count: 6,
			recording: true,
			notes: 'Important call',
			is_partial: false,
			nrs_id: 'NRS_123456789',
			chat_id: 'CT_999',
			chat: {
				id: 'CT_999',
				name: 'Bridge Chat',
			},
		},
	],
	next_token: 'next-page-token',
	sync_token: 'sync-cursor-token',
};

describe('ZohoCliq - CallsMeeting - Simplify Operation Tests', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			additionalFields?: IDataObject;
			simplify?: boolean;
			simplifyMode?: string;
			simplifyFields?: string[];
		} = {},
	): IExecuteFunctions => {
		const {
			additionalFields = {},
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'additionalFields') return additionalFields;
				if (name === 'simplify') return simplify;
				if (name === 'simplifyMode') return simplifyMode;
				if (name === 'simplifyFields') return simplifyFields;
				if (name === 'enableAiErrorMode') return false;
				return fallback;
			}),
			continueOnFail: jest.fn(() => false),
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
		it('listCallRecordings should expose simplify, simplifyMode, simplifyFields params', () => {
			const paramNames = listCallRecordings.description.map((p) => p.name);
			expect(paramNames).toContain('simplify');
			expect(paramNames).toContain('simplifyMode');
			expect(paramNames).toContain('simplifyFields');
		});
	});

	// -----------------------------------------------------------------------
	// List Call Recordings - Simplify
	// -----------------------------------------------------------------------

	describe('callsMeeting/listCallRecordings simplify', () => {
		it('should return single item with full wrapper response in raw mode (simplify=false)', async () => {
			const ctx = createContext({ simplify: false });
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_CALL_RECORDING_LIST_RESPONSE);

			const result = await listCallRecordings.execute.call(ctx, items, SCOPES.MEDIA_SESSION_READ);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('data');
			expect(result[0].json).toHaveProperty('next_token', 'next-page-token');
			expect(result[0].json).toHaveProperty('sync_token', 'sync-cursor-token');
			expect(result[0].json.data as IDataObject[]).toHaveLength(1);
		});

		it('should return _pagination item + individual simplified items when simplify is enabled', async () => {
			const ctx = createContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_CALL_RECORDING_LIST_RESPONSE);

			const result = await listCallRecordings.execute.call(ctx, items, SCOPES.MEDIA_SESSION_READ);

			// First item is _pagination, second is the simplified call item
			expect(result).toHaveLength(2);

			// Pagination item
			expect(result[0].json).toEqual({
				_pagination: {
					next_token: 'next-page-token',
					sync_token: 'sync-cursor-token',
				},
			});

			// Simplified call item
			const callItem = result[1].json;
			expect(callItem).toEqual({
				id: '123456789',
				session_id: 'SESSION_123456789',
				type: 'audio_conference',
				title: 'Incident Bridge',
				scope: 'organization',
				start_time: 1741276800000,
				end_time: 1741278600000,
				host_name: 'Alex Rivera',
				participant_count: 6,
				recording: true,
			});

			// Should NOT contain non-simplified keys
			expect(callItem).not.toHaveProperty('host');
			expect(callItem).not.toHaveProperty('notes');
			expect(callItem).not.toHaveProperty('is_partial');
			expect(callItem).not.toHaveProperty('nrs_id');
			expect(callItem).not.toHaveProperty('chat');
			expect(callItem).not.toHaveProperty('chat_id');
		});

		it('should return _pagination + items with only id + selected fields', async () => {
			const ctx = createContext({
				simplify: true,
				simplifyMode: 'selectedFields',
				simplifyFields: ['title', 'type', 'host'],
			});
			mockZohoCliqApiRequest.mockResolvedValue(MOCK_CALL_RECORDING_LIST_RESPONSE);

			const result = await listCallRecordings.execute.call(ctx, items, SCOPES.MEDIA_SESSION_READ);

			expect(result).toHaveLength(2);

			// Pagination item
			expect(result[0].json).toEqual({
				_pagination: {
					next_token: 'next-page-token',
					sync_token: 'sync-cursor-token',
				},
			});

			// Selected fields item: idKey (id) is always included + selected fields
			expect(result[1].json).toEqual({
				id: '123456789',
				title: 'Incident Bridge',
				type: 'audio_conference',
				host: {
					id: '987654321',
					name: 'Alex Rivera',
				},
			});

			// Should NOT have unselected keys
			expect(result[1].json).not.toHaveProperty('session_id');
			expect(result[1].json).not.toHaveProperty('scope');
			expect(result[1].json).not.toHaveProperty('host_name');
			expect(result[1].json).not.toHaveProperty('recording');
		});

		it('should omit _pagination when no pagination keys are present in the response', async () => {
			const noPaginationResponse = {
				data: [...MOCK_CALL_RECORDING_LIST_RESPONSE.data],
			};
			const ctx = createContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValue(noPaginationResponse);

			const result = await listCallRecordings.execute.call(ctx, items, SCOPES.MEDIA_SESSION_READ);

			// Only the simplified items, no _pagination
			expect(result).toHaveLength(1);
			expect(result[0].json).not.toHaveProperty('_pagination');
			expect(result[0].json).toHaveProperty('id');
		});

		it('should return empty array when data is empty in simplified mode', async () => {
			const ctx = createContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

			const result = await listCallRecordings.execute.call(ctx, items, SCOPES.MEDIA_SESSION_READ);

			expect(result).toHaveLength(0);
		});
	});
});
