import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SCOPES } from '../scopeTestScopes';
import { NodeOperationError } from 'n8n-workflow';

import * as common from '../../../../../../nodes/ZohoCliq/v1/actions/customEmail/common';
import * as updateMailConfiguration from '../../../../../../nodes/ZohoCliq/v1/actions/customEmail/updateMailConfiguration.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - CustomEmail - UpdateMailConfiguration Operation', () => {
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

	it('should update mail configuration successfully', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ status: 'success' })
			.mockResolvedValueOnce({ data: { email_id: 'support@example.com' } });

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'PUT',
			'/api/v2/mailconfigurations/global',
			{
				name: 'Support',
				email_id: 'support@example.com',
				cname_status: 'verified',
			},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/mailconfigurations/global',
		);
		expect(result[0].json).toEqual({ updated: true, status: 'success' });
	});

	it('should throw for missing scope', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'verified';
			return false;
		});

		let thrownError: unknown;
		try {
			await updateMailConfiguration.execute.call(mockExecuteFunctions, items, '');
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
			operation: 'updateMailConfiguration',
			requiredScopes: [SCOPES.ORGANISATION_UPDATE],
			missingScopes: [SCOPES.ORGANISATION_UPDATE],
			hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
		});
	});

	it('should throw for invalid cname status', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'pending';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});

		await expect(
			updateMailConfiguration.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Custom Email cname_status must be one of');
	});

	it('should throw for invalid email format', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'not an email';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});

		await expect(
			updateMailConfiguration.execute.call(mockExecuteFunctions, items, grantedScopes),
		).rejects.toThrow('Invalid email format');
	});

	it('should include item metadata for each processed item', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number) => {
				if (name === 'name') return `Support ${itemIndex + 1}`;
				if (name === 'emailId') return `support${itemIndex + 1}@example.com`;
				if (name === 'cnameStatus') return 'verified';
				if (name === 'enableAiErrorMode') return false;
				return undefined;
			},
		);
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ status: 'success-1' })
			.mockResolvedValueOnce({ data: { email_id: 'support1@example.com' } })
			.mockResolvedValueOnce({ status: 'success-2' })
			.mockResolvedValueOnce({ data: { email_id: 'support2@example.com' } });

		await updateMailConfiguration.execute.call(mockExecuteFunctions, items, grantedScopes);

		expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenNthCalledWith(
			1,
			[{ json: { updated: true, status: 'success-1' } }],
			{ itemData: { item: 0 } },
		);
		expect(mockExecuteFunctions.helpers.constructExecutionMetaData).toHaveBeenNthCalledWith(
			2,
			[{ json: { updated: true, status: 'success-2' } }],
			{ itemData: { item: 1 } },
		);
	});

	it('should return a recoverable validation payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'bad email';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					success: false,
					message: 'Invalid email format: bad email',
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					email_id: 'bad email',
					name: 'Support',
					reason: 'INVALID_EMAIL',
					hint: 'Provide a valid sender email address such as support@example.com.',
				},
			},
		]);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should omit empty context fields in recoverable validation payloads', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return undefined;
			if (name === 'emailId') return undefined;
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					success: false,
					message: 'Custom Email name is required',
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					reason: 'INVALID_NAME',
					hint: 'Provide a Custom Email Name between 1 and 120 characters.',
				},
			},
		]);
	});

	it('should return a recoverable invalid cname status payload when continueOnFail is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'bad_status';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					success: false,
					message: 'Custom Email cname_status must be one of: verified, not_verified',
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					name: 'Support',
					email_id: 'support@example.com',
					reason: 'INVALID_CNAME_STATUS',
					hint: 'Use exactly one of these values for CNAME Status: verified or not_verified.',
				},
			},
		]);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should preserve scope payloads in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});

		const result = await updateMailConfiguration.execute.call(mockExecuteFunctions, items, '');

		expect(result).toEqual([
			{
				json: {
					success: false,
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					requiredScopes: [SCOPES.ORGANISATION_UPDATE],
					missingScopes: [SCOPES.ORGANISATION_UPDATE],
					hint: 'Required scopes are not currently granted. Open Zoho Cliq credentials, update Scope Mode / Scope Packs, then reconnect to authorize.',
					name: 'Support',
					email_id: 'support@example.com',
				},
			},
		]);
	});

	it('should return a recoverable API payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return true;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce(
			Object.assign(new Error('Organization admin access required'), {
				statusCode: 403,
			}),
		);

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					details: {
						statusCode: 403,
					},
					success: false,
					message: 'Organization admin access required',
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					name: 'Support',
					email_id: 'support@example.com',
					status_code: 403,
					status_class: '4xx',
					reason: 'ORG_ADMIN_REQUIRED',
					hint: 'Reconnect with a Zoho Cliq Organization Admin OAuth user before retrying this update.',
				},
			},
		]);
	});

	it('should use the operation fallback message for unknown API errors in recoverable mode', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.continueOnFail as jest.Mock).mockReturnValue(true);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest.mockRejectedValueOnce({});

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					success: false,
					message: 'Failed to update custom email configuration in Zoho Cliq.',
					resource: 'customEmail',
					operation: 'updateMailConfiguration',
					name: 'Support',
					email_id: 'support@example.com',
				},
			},
		]);
	});

	it('should append a warning when Zoho Cliq keeps the existing custom email address', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'new@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: {
					email_id: 'current@example.com',
					name: 'Support',
					cname_status: 'verified',
				},
			})
			.mockResolvedValueOnce({ data: { email_id: 'current@example.com' } });

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					updated: true,
					data: {
						email_id: 'current@example.com',
						name: 'Support',
						cname_status: 'verified',
					},
					_warnings: [
						{
							field: 'custom_email_configuration',
							reason:
								'Zoho Cliq accepted the update request but left the existing account-level Custom Email configuration unchanged because a Custom Email is already configured for this organization.',
							action:
								'A Cliq Administrator must first remove the existing Custom Email in the Cliq Admin Panel. The API cannot replace an already-configured Custom Email, so none of the submitted fields are updated until the existing configuration is removed. Only one Custom Email can exist per organization at a time.',
							existing_email_id: 'current@example.com',
							requested_email_id: 'new@example.com',
						},
					],
				},
			},
		]);
	});

	it('should not append a warning when the current configuration response has no email_id', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({
				data: {
					email_id: 'support@example.com',
					name: 'Support',
					cname_status: 'verified',
				},
			})
			.mockResolvedValueOnce({ data: { name: 'Support' } });

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					updated: true,
					data: {
						email_id: 'support@example.com',
						name: 'Support',
						cname_status: 'verified',
					},
				},
			},
		]);
	});

	it('should return the PUT response without warnings when the post-update verification fetch fails', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'new@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ status: 'success' })
			.mockRejectedValueOnce(new Error('temporary read failure'));

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					updated: true,
					status: 'success',
				},
			},
		]);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'PUT',
			'/api/v2/mailconfigurations/global',
			{
				name: 'Support',
				email_id: 'new@example.com',
				cname_status: 'verified',
			},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/mailconfigurations/global',
		);
	});

	it('should wrap a primitive PUT response when post-update verification cannot run', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'new@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockImplementationOnce(async () => 'success' as never)
			.mockRejectedValueOnce(new Error('temporary read failure'));

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					updated: true,
					data: 'success',
				},
			},
		]);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledTimes(2);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			1,
			'PUT',
			'/api/v2/mailconfigurations/global',
			{
				name: 'Support',
				email_id: 'new@example.com',
				cname_status: 'verified',
			},
		);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(
			2,
			'GET',
			'/api/v2/mailconfigurations/global',
		);
	});

	it('should handle a nullish validated email_id when building replacement warnings', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const grantedScopes = SCOPES.ORGANISATION_UPDATE;
		const validateSpy = jest
			.spyOn(common, 'validateCustomEmailPayload')
			.mockReturnValue({ name: 'Support', email_id: undefined, cname_status: 'verified' } as never);

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation((name: string) => {
			if (name === 'name') return 'Support';
			if (name === 'emailId') return 'support@example.com';
			if (name === 'cnameStatus') return 'verified';
			if (name === 'enableAiErrorMode') return false;
			return undefined;
		});
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ status: 'success' })
			.mockResolvedValueOnce({ data: { email_id: 'current@example.com' } });

		const result = await updateMailConfiguration.execute.call(
			mockExecuteFunctions,
			items,
			grantedScopes,
		);

		expect(result).toEqual([
			{
				json: {
					updated: true,
					status: 'success',
					_warnings: [
						{
							field: 'custom_email_configuration',
							reason:
								'Zoho Cliq accepted the update request but left the existing account-level Custom Email configuration unchanged because a Custom Email is already configured for this organization.',
							action:
								'A Cliq Administrator must first remove the existing Custom Email in the Cliq Admin Panel. The API cannot replace an already-configured Custom Email, so none of the submitted fields are updated until the existing configuration is removed. Only one Custom Email can exist per organization at a time.',
							existing_email_id: 'current@example.com',
							requested_email_id: '',
						},
					],
				},
			},
		]);

		validateSpy.mockRestore();
	});

	it('should expose structured required fields plus docs and AI guide notices at the bottom', () => {
		const notice = updateMailConfiguration.description.find(
			(prop) => prop.name === 'updateMailConfigurationDocsNotice',
		);
		const aiGuideNotice = updateMailConfiguration.description.find(
			(prop) => prop.name === 'updateMailConfigurationAiToolGuideNotice',
		);
		const name = updateMailConfiguration.description.find((prop) => prop.name === 'name');
		const emailId = updateMailConfiguration.description.find((prop) => prop.name === 'emailId');
		const cnameStatus = updateMailConfiguration.description.find(
			(prop) => prop.name === 'cnameStatus',
		);
		const descriptionTail = updateMailConfiguration.description.slice(-2).map((prop) => prop.name);

		expect(notice?.type).toBe('notice');
		expect(String(notice?.displayName)).toContain('#update-mail-config');
		expect(String(notice?.displayName)).toContain(SCOPES.ORGANISATION_UPDATE);
		expect(aiGuideNotice?.type).toBe('notice');
		expect(String(aiGuideNotice?.displayName)).toContain('Open Tool Setup Guide');
		expect(name?.required).toBe(true);
		expect(emailId?.required).toBe(true);
		expect(cnameStatus?.required).toBe(true);
		expect(cnameStatus?.type).toBe('options');
		expect(cnameStatus?.noDataExpression).not.toBe(true);
		expect(String(cnameStatus?.description)).toContain('"not_verified"');
		expect(String(name?.description)).toContain(
			'If Verify Custom Email is available, call it first',
		);
		expect(String(emailId?.description)).toContain(
			'Zoho Cliq will not replace an already-configured custom email address',
		);
		expect(String(cnameStatus?.description)).toContain('Do not fabricate or assume this value');
		expect(cnameStatus?.default).toBe('not_verified');
		expect(descriptionTail).toEqual([
			'updateMailConfigurationDocsNotice',
			'updateMailConfigurationAiToolGuideNotice',
		]);
	});
});
