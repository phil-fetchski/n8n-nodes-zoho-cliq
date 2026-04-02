import type { INodeExecutionData } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as checkOut from '../../../../../../nodes/ZohoCliq/v1/actions/remoteWork/checkOut.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';
import { createRemoteWorkTestContext } from './testUtils';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - RemoteWork - CheckOut Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should always include success and operation metadata in raw mode', async () => {
		const context = createRemoteWorkTestContext({ operation: 'checkOut' });
		mockZohoCliqApiRequest.mockResolvedValue({
			checkin_allowed: true,
			checkin_status: false,
			checkin_status_text: 'Out',
		});

		const result = await checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkOut',
			checkin_allowed: true,
			checkin_status: false,
			checkin_status_text: 'Out',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/me/checkout');
	});

	it('should return simplified output with metadata when simplify is enabled', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkOut',
			simplify: true,
			simplifyMode: 'simplified',
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			checkin_allowed: true,
			checkin_status: false,
			checkin_status_text: 'Out',
			checkin_time: 1678080540000,
			duration: 9600,
			location: false,
			live_feed_status: 'disabled',
			user_status_preference: { is_onboarded: '1' },
		});

		const result = await checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkOut',
			checkin_status: false,
			checkin_time: 1678080540000,
			checkin_status_text: 'Out',
			checkin_allowed: true,
			duration: 9600,
			location: false,
			live_feed_status: 'disabled',
		});
		expect(result[0].json).not.toHaveProperty('user_status_preference');
	});

	it('should return selected fields with metadata when simplifyMode is selectedFields', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkOut',
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['checkin_status', 'duration'],
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			checkin_allowed: true,
			checkin_status: false,
			checkin_status_text: 'Out',
			duration: 9600,
			location: false,
		});

		const result = await checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkOut',
			checkin_status: false,
			duration: 9600,
		});
	});

	it('should return metadata-only output when the API response is empty', async () => {
		const context = createRemoteWorkTestContext({ operation: 'checkOut' });
		mockZohoCliqApiRequest.mockResolvedValue(
			undefined as unknown as Awaited<ReturnType<typeof transport.zohoCliqApiRequest>>,
		);

		const result = await checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkOut',
		});
	});

	it('should return a mapped recoverable API error in AI Error Mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkOut',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'User not checked in for the day',
		});

		const result = await checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'checkOut',
				reason: 'NOT_CHECKED_IN',
				hint: 'Use Get Remote Work Status first, then only call Check Out after a successful remote check-in.',
			}),
		);
	});

	it('should map alternate already-checked-out message variants in AI Error Mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkOut',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'User is already checkout for today',
		});

		const result = await checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'ALREADY_CHECKED_OUT',
			}),
		);
	});

	it('should map alternate not-checked-in message variants in AI Error Mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkOut',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'no checkin found for today',
		});

		const result = await checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'NOT_CHECKED_IN',
			}),
		);
	});

	it('should return the dedicated scope payload in continue-on-fail mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkOut',
			continueOnFail: true,
		});

		const result = await checkOut.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'checkOut',
				requiredScopes: [SCOPES.REMOTE_WORK_UPDATE],
				missingScopes: [SCOPES.REMOTE_WORK_UPDATE],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should rethrow API errors when recoverable mode is disabled', async () => {
		const context = createRemoteWorkTestContext({ operation: 'checkOut' });
		mockZohoCliqApiRequest.mockRejectedValue(new Error('remote work checkout failed'));

		await expect(checkOut.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE)).rejects.toThrow(
			'remote work checkout failed',
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(checkOut.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'checkOutDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'checkOutAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});

	it('should expose simplify parameters and not include enhanced output in the description', () => {
		const paramNames = checkOut.description.map((p) => p.name);
		expect(paramNames).toContain('simplify');
		expect(paramNames).toContain('simplifyMode');
		expect(paramNames).toContain('simplifyFields');
		expect(paramNames).not.toContain('includeEnhancedOutput');
	});
});
