import type { INodeExecutionData } from 'n8n-workflow';

import { ZOHO_CLIQ_REQUIRED_SCOPES_HINT } from '../../../../../helpers/constants';
import * as getStatus from '../../../../../../nodes/ZohoCliq/v1/actions/remoteWork/getStatus.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { SCOPES } from '../scopeTestScopes';
import { createRemoteWorkTestContext } from './testUtils';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - RemoteWork - GetStatus Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should get remote work status successfully for each item (raw mode)', async () => {
		const context = createRemoteWorkTestContext({ operation: 'getStatus' });
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		mockZohoCliqApiRequest
			.mockResolvedValueOnce({ checkin_status: true, checkin_status_text: 'Remote In' })
			.mockResolvedValueOnce({ checkin_status: false, checkin_status_text: 'Out' });

		const result = await getStatus.execute.call(context, items, SCOPES.REMOTE_WORK_READ);

		expect(result).toEqual([
			{ json: { checkin_status: true, checkin_status_text: 'Remote In' } },
			{ json: { checkin_status: false, checkin_status_text: 'Out' } },
		]);
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(1, 'GET', '/api/v2/me', undefined, {
			source: 'remote_tools',
		});
		expect(mockZohoCliqApiRequest).toHaveBeenNthCalledWith(2, 'GET', '/api/v2/me', undefined, {
			source: 'remote_tools',
		});
	});

	it('should return simplified output when simplify is enabled', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'getStatus',
			simplify: true,
			simplifyMode: 'simplified',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({
			id: '12345',
			display_name: 'Scott Fisher',
			email_id: 'scott@example.com',
			checkin_status: true,
			checkin_time: 1678080540000,
			checkin_status_text: 'Remote In',
			duration: 15021,
			department: { id: '111', name: 'Marketing' },
			designation: { id: '222', name: 'Engineer' },
			status: { code: '3', message: 'Busy' },
			timezone: 'Asia/Kolkata',
			country: 'IN',
			reportingto: { id: '999', email_id: 'boss@example.com' },
		});

		const result = await getStatus.execute.call(context, items, SCOPES.REMOTE_WORK_READ);

		expect(result[0].json).toEqual({
			id: '12345',
			display_name: 'Scott Fisher',
			email_id: 'scott@example.com',
			checkin_status: true,
			checkin_time: 1678080540000,
			checkin_status_text: 'Remote In',
			duration: 15021,
			department_name: 'Marketing',
			designation_name: 'Engineer',
			status_message: 'Busy',
		});
	});

	it('should return selected fields when simplifyMode is selectedFields', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'getStatus',
			simplify: true,
			simplifyMode: 'selectedFields',
			simplifyFields: ['id', 'checkin_status', 'duration'],
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({
			id: '12345',
			display_name: 'Scott Fisher',
			email_id: 'scott@example.com',
			checkin_status: true,
			duration: 15021,
			department: { id: '111', name: 'Marketing' },
		});

		const result = await getStatus.execute.call(context, items, SCOPES.REMOTE_WORK_READ);

		expect(result[0].json).toEqual({
			id: '12345',
			checkin_status: true,
			duration: 15021,
		});
	});

	it('should return an empty object when the API response is empty', async () => {
		const context = createRemoteWorkTestContext({ operation: 'getStatus' });
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue(
			undefined as unknown as Awaited<ReturnType<typeof transport.zohoCliqApiRequest>>,
		);

		const result = await getStatus.execute.call(context, items, SCOPES.REMOTE_WORK_READ);

		expect(result[0].json).toEqual({});
	});

	it('should return a recoverable API error in AI Error Mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'getStatus',
			enableAiErrorMode: 'true',
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockRejectedValue({
			statusCode: 429,
			message: 'Too many requests',
		});

		const result = await getStatus.execute.call(context, items, SCOPES.REMOTE_WORK_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'getStatus',
				status_code: 429,
				reason: 'RATE_LIMITED',
				hint: 'Too many requests in a short period. Retry with backoff.',
			}),
		);
	});

	it('should return the dedicated scope payload in continue-on-fail mode', async () => {
		const context = createRemoteWorkTestContext({
			operation: 'getStatus',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await getStatus.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'getStatus',
				requiredScopes: [SCOPES.REMOTE_WORK_READ],
				missingScopes: [SCOPES.REMOTE_WORK_READ],
				hint: ZOHO_CLIQ_REQUIRED_SCOPES_HINT,
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should rethrow API errors when recoverable mode is disabled', async () => {
		const context = createRemoteWorkTestContext({ operation: 'getStatus' });
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockRejectedValue(new Error('remote status unavailable'));

		await expect(getStatus.execute.call(context, items, SCOPES.REMOTE_WORK_READ)).rejects.toThrow(
			'remote status unavailable',
		);
	});

	it('should expose docs and AI guide notices at the bottom of the operation fields', () => {
		expect(getStatus.description).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: 'getRemoteStatusDocsNotice', type: 'notice' }),
				expect.objectContaining({ name: 'getRemoteStatusAiToolGuideNotice', type: 'notice' }),
			]),
		);
	});

	it('should expose simplify parameters in the description', () => {
		const paramNames = getStatus.description.map((p) => p.name);
		expect(paramNames).toContain('simplify');
		expect(paramNames).toContain('simplifyMode');
		expect(paramNames).toContain('simplifyFields');
	});
});
