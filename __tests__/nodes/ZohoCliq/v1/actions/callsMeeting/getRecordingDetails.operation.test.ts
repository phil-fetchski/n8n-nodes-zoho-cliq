import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';

import * as getRecordingDetails from '../../../../../../nodes/ZohoCliq/v1/actions/callsMeeting/getRecordingDetails.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - CallsMeeting - GetRecordingDetails Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			continueOnFail: jest.fn(() => false),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should get recording participants and details successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('MS_12345')
			.mockReturnValueOnce({
				limit: 25,
				nextToken: 'next-1',
				filter: 'joined',
				from: 1654794247047,
				to: 1654797815323,
			});
		mockZohoCliqApiRequest.mockResolvedValue({ participants: [] });

		const result = await getRecordingDetails.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions/MS_12345/participants',
			undefined,
			{
				limit: 25,
				next_token: 'next-1',
				filter: 'joined',
				from: 1654794247047,
				to: 1654797815323,
			},
			{
				headers: {
					'X-API-VERSION': '1',
				},
			},
		);
	});

	it('should wrap one-item participant arrays under participants', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(paramName: string, _itemIndex: number, fallback?: unknown) => {
				if (paramName === 'mediaSessionId') return 'MS_12345';
				if (paramName === 'additionalFields') return {};
				return fallback;
			},
		);
		mockZohoCliqApiRequest.mockResolvedValue([{ user_id: '12345' }] as unknown as IDataObject);

		const result = await getRecordingDetails.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result[0].json).toEqual({
			participants: [{ user_id: '12345' }],
		});
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		const requiredScope = getRequiredScopeForOperation('callsMeeting', 'getRecordingDetails');
		let thrownError: unknown;
		try {
			await getRecordingDetails.execute.call(mockExecuteFunctions, items, '');
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

	it('should throw for invalid media session id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('invalid/id')
			.mockReturnValueOnce({});

		await expect(
			getRecordingDetails.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Invalid Media Session ID format');
	});

	it('should include API version header even without query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('MS_12345')
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockResolvedValue({ participants: [] });

		await getRecordingDetails.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions/MS_12345/participants',
			undefined,
			{},
			{
				headers: {
					'X-API-VERSION': '1',
				},
			},
		);
	});

	it('should throw when from time is greater than to time', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('MS_12345')
			.mockReturnValueOnce({ from: 200, to: 100 });

		await expect(
			getRecordingDetails.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('From Time cannot be greater than To Time');
	});

	it('should validate zero timestamps and omit from/to from query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('MS_12345')
			.mockReturnValueOnce({ from: 0, to: 0 });
		mockZohoCliqApiRequest.mockResolvedValue({ participants: [] });

		await getRecordingDetails.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions/MS_12345/participants',
			undefined,
			{},
			{
				headers: {
					'X-API-VERSION': '1',
				},
			},
		);
	});

	it('should omit whitespace-only optional string fields from query params', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('MS_12345')
			.mockReturnValueOnce({ filter: '   ', nextToken: '   ' });
		mockZohoCliqApiRequest.mockResolvedValue({ participants: [] });

		await getRecordingDetails.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/mediasessions/MS_12345/participants',
			undefined,
			{},
			{
				headers: {
					'X-API-VERSION': '1',
				},
			},
		);
	});

	it('should return paired item error when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('MS_12345')
			.mockReturnValueOnce({ from: 200, to: 100 });

		const result = await getRecordingDetails.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'From Time cannot be greater than To Time',
			}),
		);
	});

	it('should return scope payload when continueOnFail is enabled and scope is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((paramName: string) => {
			if (paramName === 'resource') return 'callsMeeting';
			if (paramName === 'operation') return 'getRecordingDetails';
			return undefined;
		});

		const result = await getRecordingDetails.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'callsMeeting',
				operation: 'getRecordingDetails',
			}),
		);
	});

	it('should return generic error when continueOnFail is enabled and non-object error is thrown', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('MS_12345')
			.mockReturnValueOnce({});
		mockZohoCliqApiRequest.mockRejectedValue(null);

		const result = await getRecordingDetails.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'An unexpected issue occurred with the API request',
			}),
		);
	});

	it('should omit media_session_id in recoverable payload when media session id is empty', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.MEDIA_SESSION_READ;
		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);

		(mockExecuteFunctions.getNodeParameter as jest.Mock)
			.mockReturnValueOnce('')
			.mockReturnValueOnce({});

		const result = await getRecordingDetails.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'callsMeeting',
				operation: 'getRecordingDetails',
			}),
		);
		expect(result[0].json).not.toHaveProperty('media_session_id');
	});
});
