import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';

import * as verifyCustomEmail from '../../../../../../nodes/ZohoCliq/v1/actions/customEmail/verifyCustomEmail.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - CustomEmail - VerifyCustomEmail Operation', () => {
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
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: {},
			})),
		} as unknown as IExecuteFunctions;

		mockZohoCliqApiRequest.mockClear();
	});

	it('should verify custom email successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({ cname_status: 'verified' });

		const result = await verifyCustomEmail.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/mailconfigurations/global');
		expect(result[0].json).toEqual({ cname_status: 'verified' });
	});

	it('should return a helpful AI-mode message when no custom email is configured', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			url: '/api/v2/mailconfigurations/global',
			data: {},
		});

		const result = await verifyCustomEmail.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			url: '/api/v2/mailconfigurations/global',
			data: {},
			success: true,
			resource: 'customEmail',
			operation: 'verifyCustomEmail',
			configured: false,
			message: 'No Custom Email is currently configured for the authenticated Zoho Cliq account.',
		});
	});

	it('should preserve the raw empty response when AI Error Mode is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			url: '/api/v2/mailconfigurations/global',
			data: {},
		});

		const result = await verifyCustomEmail.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			url: '/api/v2/mailconfigurations/global',
			data: {},
		});
	});

	it('should preserve the raw response in AI Error Mode when the data payload is missing', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			url: '/api/v2/mailconfigurations/global',
		});

		const result = await verifyCustomEmail.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result[0].json).toEqual({
			url: '/api/v2/mailconfigurations/global',
		});
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(() => false);

		let thrownError: unknown;
		try {
			await verifyCustomEmail.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual({
			success: false,
			resource: 'customEmail',
			operation: 'verifyCustomEmail',
			requiredScopes: [SCOPES.ORGANISATION_READ],
			missingScopes: [SCOPES.ORGANISATION_READ],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should include item metadata for each processed item', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ data: { cname_status: 'verified' } })
			.mockResolvedValueOnce({ data: { cname_status: 'not_verified' } });

		await verifyCustomEmail.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenNthCalledWith(
			1,
			[{ json: { data: { cname_status: 'verified' } } }],
			{ itemData: { item: 0 } },
		);
		expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenNthCalledWith(
			2,
			[{ json: { data: { cname_status: 'not_verified' } } }],
			{ itemData: { item: 1 } },
		);
	});

	it('should preserve scope payloads in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});

		const result = await verifyCustomEmail.execute.call(mockExecuteFunctions, items, '');

		expect(result).toEqual([
			{
				json: {
					success: false,
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
					requiredScopes: [SCOPES.ORGANISATION_READ],
					missingScopes: [SCOPES.ORGANISATION_READ],
					hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
				},
			},
		]);
	});

	it('should return a recoverable API payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue(
			Object.assign(new Error('Org admin only endpoint'), { statusCode: 403 }),
		);

		const result = await verifyCustomEmail.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: {
					details: {
						statusCode: 403,
					},
					success: false,
					message: 'Org admin only endpoint',
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
					status_code: 403,
					status_class: '4xx',
					reason: 'ORG_ADMIN_REQUIRED',
					hint: 'Reconnect with a Zoho Cliq Organization Admin OAuth user before retrying this lookup.',
				},
			},
		]);
	});

	it('should use the operation fallback message for unknown API errors in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_READ;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValue({});

		const result = await verifyCustomEmail.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(result).toEqual([
			{
				json: {
					success: false,
					message:
						'Failed to retrieve the current custom email verification details from Zoho Cliq.',
					resource: 'customEmail',
					operation: 'verifyCustomEmail',
				},
			},
		]);
	});

	it('should expose retrieve docs notice and AI guide notice for discoverability', () => {
		const notice = verifyCustomEmail.description.find(
			(prop) => prop.name === 'verifyCustomEmailDocsNotice',
		);
		const aiGuideNotice = verifyCustomEmail.description.find(
			(prop) => prop.name === 'verifyCustomEmailAiToolGuideNotice',
		);
		expect(notice?.type).toBe('notice');
		expect(String(notice?.displayName)).toContain('#retrieve-mail-config');
		expect(String(notice?.displayName)).toContain(SCOPES.ORGANISATION_READ);
		expect(aiGuideNotice?.type).toBe('notice');
		expect(String(aiGuideNotice?.displayName)).toContain('Open Tool Setup Guide');
		expect(verifyCustomEmail.description.slice(-2).map((prop) => prop.name)).toEqual([
			'verifyCustomEmailDocsNotice',
			'verifyCustomEmailAiToolGuideNotice',
		]);
	});
});
