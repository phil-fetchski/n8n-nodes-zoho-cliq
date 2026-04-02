import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as leave from '../../../../../../nodes/ZohoCliq/v1/actions/chat/leave.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - Chat - Leave Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const leaveGrantedScopes = SCOPES.CHATS_UPDATE_WITH_READ;
	let mockExecuteFunctions: IExecuteFunctions;
	const setNodeParameters = (
		values: {
			chatId?: string;
			includeEnhancedOutput?: boolean;
			enableAiErrorMode?: unknown;
		} = {},
	) => {
		const {
			chatId = 'CT_123_456',
			includeEnhancedOutput = true,
			enableAiErrorMode = false,
		} = values;
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'chatId') return chatId;
			if (name === 'includeEnhancedOutput') return includeEnhancedOutput;
			if (name === 'enableAiErrorMode') return enableAiErrorMode;
			return undefined;
		});
	};

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			continueOnFail: jest.fn(() => false),
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should leave group chat successfully with enhanced output by default', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = leaveGrantedScopes;

		setNodeParameters();
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await leave.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				operation: 'leave',
				chat_id: 'CT_123_456',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/chats/CT_123_456/leave');
	});

	it('should return the raw response when enhanced output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		setNodeParameters({ includeEnhancedOutput: false });
		mockZohoCliqApiRequest.mockResolvedValue('' as unknown as Record<string, never>);

		const result = await leave.execute.call(mockExecuteFunctions, items, leaveGrantedScopes);

		expect(result[0].json).toEqual({ data: '' });
	});

	it('should throw error for missing OAuth scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		setNodeParameters();

		const requiredScope = getRequiredScopeForOperation('chat', 'leave');
		let thrownError: unknown;
		try {
			await leave.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
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

	it('should throw error for empty chat ID', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = leaveGrantedScopes;

		setNodeParameters({ chatId: '' });

		await expect(leave.execute.call(mockExecuteFunctions, items, grantedScopes)).rejects.toThrow(
			NodeOperationError,
		);
	});

	it('should return a recoverable mapped API error when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		setNodeParameters();
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'The request URL is invalid. Please check the URL pattern.',
		});

		const result = await leave.execute.call(mockExecuteFunctions, items, leaveGrantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'leave',
				resource: 'chat',
				reason: 'CHAT_NOT_FOUND',
				chat_id: 'CT_123_456',
			}),
		);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/chats/CT_123_456/members',
			{},
			{},
		);
	});

	it('should return a recoverable validation error in AI Error Mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		setNodeParameters({ chatId: '', enableAiErrorMode: 'true' });

		const result = await leave.execute.call(mockExecuteFunctions, items, leaveGrantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'leave',
				resource: 'chat',
			}),
		);
		expect(result[0].json.message).toContain('Chat ID is required');
	});

	it('should reject channel-like IDs before calling the leave API', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		setNodeParameters({ chatId: 'P1234567890' });

		await expect(
			leave.execute.call(mockExecuteFunctions, items, SCOPES.CHATS_UPDATE),
		).rejects.toThrow(
			'This operation requires a chat ID, but the provided identifier looks like a channel ID.',
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should return a recoverable channel-id error in AI Error Mode for leave', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		setNodeParameters({ chatId: 'O1234567890', enableAiErrorMode: 'true' });

		const result = await leave.execute.call(mockExecuteFunctions, items, leaveGrantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'leave',
				resource: 'chat',
				chat_id: 'O1234567890',
				reason: 'CHANNEL_ID_DETECTED',
				message:
					'This operation requires a chat ID. The supplied identifier looks like a channel ID, so the leave request was not sent.',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should include docs and AI guide notices in the description', () => {
		const propertyNames = leave.description.map((property) => property.name);
		expect(propertyNames.slice(-2)).toEqual([
			'leaveGroupChatDocsNotice',
			'leaveGroupChatAiToolGuideNotice',
		]);
	});

	it('should preserve synthetic success fields when the API response contains overlapping keys', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		setNodeParameters();
		mockZohoCliqApiRequest.mockResolvedValue({
			success: false,
			operation: 'remote_value',
			chat_id: 'wrong_value',
			status: 'ok',
		});

		const result = await leave.execute.call(mockExecuteFunctions, items, leaveGrantedScopes);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: true,
				operation: 'leave',
				chat_id: 'CT_123_456',
				status: 'ok',
			}),
		);
	});
});
