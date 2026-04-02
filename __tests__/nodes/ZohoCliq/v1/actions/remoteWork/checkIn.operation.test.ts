import type { INodeExecutionData } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as checkIn from '../../../../../../nodes/ZohoCliq/v1/actions/remoteWork/checkIn.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';
import { createRemoteWorkTestContext } from './testUtils';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - RemoteWork - CheckIn Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should always include success and operation metadata in raw mode', async () => {
		const context = createRemoteWorkTestContext({ operation: 'checkIn' });
		mockZohoCliqApiRequest.mockResolvedValue({
			checkin_allowed: true,
			checkin_status: true,
			checkin_status_text: 'Remote In',
		});

		const result = await checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkIn',
			checkin_allowed: true,
			checkin_status: true,
			checkin_status_text: 'Remote In',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('PUT', '/api/v2/me/checkin');
	});

	it('should return simplified output with metadata when simplify is enabled', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkIn',
			simplify: true,
			simplifyMode: 'simplified',
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			checkin_allowed: true,
			checkin_status: true,
			checkin_status_text: 'Remote In',
			checkin_time: 1678080540000,
			duration: 9564,
			location: false,
			live_feed_status: 'disabled',
			user_status_preference: { is_onboarded: '1' },
		});

		const result = await checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkIn',
			checkin_status: true,
			checkin_time: 1678080540000,
			checkin_status_text: 'Remote In',
			checkin_allowed: true,
			duration: 9564,
			location: false,
			live_feed_status: 'disabled',
		});
		expect(result[0].json).not.toHaveProperty('user_status_preference');
	});

	it('should return selected fields with metadata when simplifyMode is selectedFields', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkIn',
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['checkin_status', 'duration'],
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			checkin_allowed: true,
			checkin_status: true,
			checkin_status_text: 'Remote In',
			duration: 9564,
			location: false,
		});

		const result = await checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkIn',
			checkin_status: true,
			duration: 9564,
		});
	});

	it('should return metadata-only output when the API response is empty', async () => {
		const context = createRemoteWorkTestContext({ operation: 'checkIn' });
		mockZohoCliqApiRequest.mockResolvedValue(
			undefined as unknown as Awaited<ReturnType<typeof transport.zohoCliqApiRequest>>,
		);

		const result = await checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual({
			success: true,
			operation: 'checkIn',
		});
	});

	it('should return a mapped recoverable API error in AI Error Mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkIn',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'Already checked in for the day',
		});

		const result = await checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'checkIn',
				reason: 'ALREADY_CHECKED_IN',
				hint: 'Use Get Remote Work Status to confirm the current remote attendance state before retrying check-in.',
			}),
		);
	});

	it('should map alternate already-checked-in message variants in AI Error Mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkIn',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'User is already checked-in remotely',
		});

		const result = await checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'ALREADY_CHECKED_IN',
			}),
		);
	});

	it('should map compact already-checkin message variants in AI Error Mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkIn',
			enableAiErrorMode: 'true',
		});
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 400,
			message: 'already checkin today',
		});

		const result = await checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				reason: 'ALREADY_CHECKED_IN',
			}),
		);
	});

	it('should return the dedicated scope payload in continue-on-fail mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'checkIn',
			continueOnFail: true,
		});

		const result = await checkIn.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'checkIn',
				requiredScopes: [SCOPES.REMOTE_WORK_UPDATE],
				missingScopes: [SCOPES.REMOTE_WORK_UPDATE],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should rethrow API errors when recoverable mode is disabled', async () => {
		const context = createRemoteWorkTestContext({ operation: 'checkIn' });
		mockZohoCliqApiRequest.mockRejectedValue(new Error('remote service unavailable'));

		await expect(checkIn.execute.call(context, items, SCOPES.REMOTE_WORK_UPDATE)).rejects.toThrow(
			'remote service unavailable',
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(checkIn.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'checkInDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'checkInAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});

	it('should expose simplify parameters and not include enhanced output in the description', () => {
		const paramNames = checkIn.description.map((p) => p.name);
		expect(paramNames).toContain('simplify');
		expect(paramNames).toContain('simplifyMode');
		expect(paramNames).toContain('simplifyFields');
		expect(paramNames).not.toContain('includeEnhancedOutput');
	});
});
