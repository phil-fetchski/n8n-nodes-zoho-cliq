import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import * as scheduleMessage from '../../../../../../nodes/ZohoCliq/v1/actions/shared/scheduleMessage.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const MOCK_SCHEDULED_MESSAGE_RESPONSE = {
	id: '987654321',
	time: 1704812400000,
	time_string: '2027-01-09T14:30:00+05:30',
	creator: '15067889',
	created_time: 1704800000000,
	timezone: 'Asia/Kolkata',
	message: {
		msg: 'Hello scheduled world',
		ctype: 'text',
		mtype: 'normal',
		chid: 'CT_123_456',
		meta: { internal: true },
		temp_info: { lang: 'en' },
	},
};

describe('ZohoCliq - Shared - Schedule Message - Simplify Operation Tests', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			chatId?: string;
			simplify?: boolean;
			simplifyMode?: string;
			simplifyFields?: string[];
		} = {},
	): IExecuteFunctions => {
		const {
			chatId = 'CT_123_456',
			simplify = false,
			simplifyMode = 'simplified',
			simplifyFields = [],
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (name === 'chatId') return chatId;
				if (name === 'scheduleFieldVisibility') return 'guided';
				if (name === 'resource') return 'message';
				if (name === 'scheduleMode') return 'time';
				if (name === 'scheduleTime') return '20270109T143000';
				if (name === 'scheduleTimezone') return '';
				if (name === 'messageType') return 'text';
				if (name === 'text') return 'Hello scheduled world';
				if (name === 'postAsBot') return false;
				if (name === 'addMention') return false;
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
		it('scheduleMessage should expose simplify, simplifyMode, simplifyFields params', () => {
			const paramNames = scheduleMessage.description.map((p) => p.name);
			expect(paramNames).toContain('simplify');
			expect(paramNames).toContain('simplifyMode');
			expect(paramNames).toContain('simplifyFields');
		});
	});

	// -----------------------------------------------------------------------
	// Schedule Message - Simplify
	// -----------------------------------------------------------------------

	describe('shared/scheduleMessage simplify', () => {
		it('should return full response as-is in raw mode (simplify=false)', async () => {
			const ctx = createContext({ simplify: false });
			mockZohoCliqApiRequest.mockResolvedValueOnce(MOCK_SCHEDULED_MESSAGE_RESPONSE);

			const result = await scheduleMessage.execute.call(
				ctx,
				items,
				SCOPES.SCHEDULE_MESSAGES_CREATE_WITH_CHAT_LOOKUP,
			);

			expect(result).toHaveLength(1);
			expect(result[0].json).toHaveProperty('id', '987654321');
			expect(result[0].json).toHaveProperty('message');
			expect((result[0].json.message as Record<string, unknown>).msg).toBe('Hello scheduled world');
			expect((result[0].json.message as Record<string, unknown>).ctype).toBe('text');
			expect((result[0].json.message as Record<string, unknown>).meta).toEqual({ internal: true });
		});

		it('should return simplified output with flattened fields when simplify is enabled', async () => {
			const ctx = createContext({ simplify: true, simplifyMode: 'simplified' });
			mockZohoCliqApiRequest.mockResolvedValueOnce(MOCK_SCHEDULED_MESSAGE_RESPONSE);

			const result = await scheduleMessage.execute.call(
				ctx,
				items,
				SCOPES.SCHEDULE_MESSAGES_CREATE_WITH_CHAT_LOOKUP,
			);

			expect(result).toHaveLength(1);
			expect(result[0].json).toEqual({
				id: '987654321',
				time: 1704812400000,
				time_string: '2027-01-09T14:30:00+05:30',
				creator: '15067889',
				created_time: 1704800000000,
				timezone: 'Asia/Kolkata',
				message_text: 'Hello scheduled world',
			});

			// Should NOT have the full message object
			expect(result[0].json).not.toHaveProperty('message');
		});

		it('should return id + selected fields only when simplifyMode is selectedFields', async () => {
			const ctx = createContext({
				simplify: true,
				simplifyMode: 'selectedFields',
				simplifyFields: ['time_string', 'creator'],
			});
			mockZohoCliqApiRequest.mockResolvedValueOnce(MOCK_SCHEDULED_MESSAGE_RESPONSE);

			const result = await scheduleMessage.execute.call(
				ctx,
				items,
				SCOPES.SCHEDULE_MESSAGES_CREATE_WITH_CHAT_LOOKUP,
			);

			expect(result).toHaveLength(1);

			// idKey (id) is always included + selected fields
			expect(result[0].json).toEqual({
				id: '987654321',
				time_string: '2027-01-09T14:30:00+05:30',
				creator: '15067889',
			});

			// Should NOT have unselected keys
			expect(result[0].json).not.toHaveProperty('time');
			expect(result[0].json).not.toHaveProperty('timezone');
			expect(result[0].json).not.toHaveProperty('message_text');
			expect(result[0].json).not.toHaveProperty('message');
		});
	});
});
