import { NodeOperationError } from 'n8n-workflow';

import {
	buildCliqRecoverableErrorPayload,
	extractCliqErrorMessage,
	extractCliqErrorSearchText,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/errorResponse';

describe('ZohoCliq - shared/errorResponse', () => {
	it('should extract global searchable error text from nested fields', () => {
		const text = extractCliqErrorSearchText({
			message: 'Request failed with status code 400',
			response: {
				data: {
					data: {
						code: 'BOT_ALREADY_ASSOCIATED',
					},
				},
			},
		});
		expect(text).toContain('Request failed with status code 400');
		expect(text).toContain('BOT_ALREADY_ASSOCIATED');
	});

	it('should extract a global error message from nested structures', () => {
		const message = extractCliqErrorMessage({
			response: {
				body: {
					error: {
						error_code: 'MEMBER_ALREADY_EXISTS',
					},
				},
			},
		});
		expect(message).toContain('MEMBER_ALREADY_EXISTS');
	});

	it('should include numeric searchable fields in extracted text', () => {
		const text = extractCliqErrorSearchText({
			code: 409,
		});
		expect(text).toContain('409');
	});

	it('should avoid duplicate numeric searchable values', () => {
		const text = extractCliqErrorSearchText({
			code: 409,
			error_code: 409,
		});
		expect(text).toBe('409');
	});

	it('should return empty searchable text for non-object input', () => {
		expect(extractCliqErrorSearchText(123)).toBe('');
	});

	it('should handle duplicate nested references without repeating extracted text', () => {
		const duplicateNode = {
			description: 'duplicate node',
		};
		const text = extractCliqErrorSearchText({
			response: duplicateNode,
			body: duplicateNode,
		});
		expect(text).toContain('duplicate node');
		expect(text.match(/duplicate node/g)?.length).toBe(1);
	});

	it('should build a base payload with resource and operation', () => {
		const payload = buildCliqRecoverableErrorPayload('Simple error', {
			resource: 'callsMeeting',
			operation: 'listCallRecordings',
		});

		expect(payload).toEqual({
			success: false,
			message: 'Simple error',
			resource: 'callsMeeting',
			operation: 'listCallRecordings',
		});
	});

	it('should use fallback message when extracted message is empty', () => {
		const payload = buildCliqRecoverableErrorPayload('   ', {
			resource: 'bot',
			operation: 'getSubscribers',
		});

		expect(payload).toEqual(
			expect.objectContaining({
				success: false,
				message: 'An unexpected issue occurred with the API request',
			}),
		);
	});

	it('should use custom fallback message when provided', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: '   ',
			},
			{
				resource: 'bot',
				operation: 'getSubscribers',
			},
			{
				fallbackMessage: 'Custom fallback',
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				message: 'Custom fallback',
			}),
		);
	});

	it('should read status code from direct statusCode', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'Bad request',
				statusCode: 400,
			},
			{
				resource: 'callsMeeting',
				operation: 'getRecordingDetails',
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				status_code: 400,
				status_class: '4xx',
				reason: 'BAD_REQUEST',
			}),
		);
	});

	it('should read status code from direct httpCode', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'Unauthorized',
				httpCode: 401,
			},
			{
				resource: 'callsMeeting',
				operation: 'getRecordingDetails',
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				status_code: 401,
				status_class: '4xx',
				reason: 'UNAUTHORIZED',
			}),
		);
	});

	it('should read status code from response.statusCode', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'Forbidden',
				response: { statusCode: 403 },
			},
			{
				resource: 'callsMeeting',
				operation: 'getRecordingDetails',
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				status_code: 403,
				status_class: '4xx',
				reason: 'FORBIDDEN',
			}),
		);
	});

	it('should read status code from response.status', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'Not found',
				response: { status: 404 },
			},
			{
				resource: 'callsMeeting',
				operation: 'getRecordingDetails',
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				status_code: 404,
				status_class: '4xx',
				reason: 'NOT_FOUND',
			}),
		);
	});

	it('should include sanitized details for Zoho Cliq-shaped response errors', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'Request failed',
				response: {
					status: 404,
					data: {
						error: 'Not Found',
						message: 'Channel not found',
						code: '404',
						error_code: 'CHANNEL_NOT_FOUND',
						status: 'error',
						access_token: 'secret-token',
					},
				},
			},
			{
				resource: 'message',
				operation: 'post',
			},
		);

		expect(payload.details).toEqual({
			statusCode: 404,
			message: 'Channel not found',
			code: '404',
			error_code: 'CHANNEL_NOT_FOUND',
			status: 'error',
		});
	});

	it('should keep details empty when response exists but no safe fields are available', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'Transport issue',
				response: {
					status: 0,
					data: {
						access_token: 'secret-token',
					},
				},
			},
			{
				resource: 'message',
				operation: 'post',
			},
		);

		expect(payload.details).toBeUndefined();
	});

	it('should map additional status codes and classes', () => {
		const cases: Array<[number, string, string]> = [
			[405, 'METHOD_NOT_ALLOWED', '4xx'],
			[406, 'NOT_ACCEPTABLE', '4xx'],
			[429, 'RATE_LIMITED', '4xx'],
			[500, 'SERVER_ERROR', '5xx'],
			[200, undefined as unknown as string, '2xx'],
			[302, undefined as unknown as string, 'other'],
		];

		for (const [statusCode, reason, statusClass] of cases) {
			const payload = buildCliqRecoverableErrorPayload(
				{
					message: `Error ${statusCode}`,
					statusCode,
				},
				{
					resource: 'callsMeeting',
					operation: 'listCallRecordings',
				},
			);

			expect(payload.status_code).toBe(statusCode);
			expect(payload.status_class).toBe(statusClass);
			if (reason) {
				expect(payload.reason).toBe(reason);
				expect(typeof payload.hint).toBe('string');
			}
		}
	});

	it('should apply message mapping overrides after status metadata', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'The request URL is invalid. Please check the URL pattern.',
				response: { status: 404 },
			},
			{
				resource: 'bot',
				operation: 'getSubscribers',
			},
			{
				contextFields: { bot_unique_name: 'fakebot' },
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						messageOverride: 'Bot unique name is invalid.',
						reason: 'INVALID_BOT_UNIQUE_NAME',
						hint: 'Use bot unique name only.',
					},
				],
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				message: 'Bot unique name is invalid.',
				reason: 'INVALID_BOT_UNIQUE_NAME',
				hint: 'Use bot unique name only.',
				bot_unique_name: 'fakebot',
			}),
		);
	});

	it('should preserve NodeOperationError code and description as recoverable reason and hint', () => {
		const error = new NodeOperationError(
			{ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' } as never,
			'No Zoho Cliq user found for User ID / Email / ZUID "missing@example.com".',
			{
				description:
					'Use Get User or List Users to verify the exact user ID, email address, or ZUID before retrying.',
			},
		);
		(error as NodeOperationError & { code?: string }).code = 'USER_NOT_FOUND';

		const payload = buildCliqRecoverableErrorPayload(error, {
			resource: 'user',
			operation: 'get',
		});

		expect(payload).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'get',
				reason: 'USER_NOT_FOUND',
				hint: 'Use Get User or List Users to verify the exact user ID, email address, or ZUID before retrying.',
			}),
		);
	});

	it('should use the fallback message when a NodeOperationError message is blank', () => {
		const error = new NodeOperationError(
			{ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' } as never,
			'   ',
		);

		expect(extractCliqErrorMessage(error, 'Fallback from blank operation error')).toBe(
			'Fallback from blank operation error',
		);
	});

	it('should keep base message when no mapping matches', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'No mapping should match this',
			},
			{
				resource: 'bot',
				operation: 'triggerCalls',
			},
			{
				messageMappings: [
					{
						match: () => false,
						reason: 'UNUSED',
					},
				],
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				message: 'No mapping should match this',
			}),
		);
		expect(payload.reason).toBeUndefined();
	});

	it('should omit status metadata when response exists without numeric status fields', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'Response object without status',
				response: {
					body: {},
				},
			},
			{
				resource: 'callsMeeting',
				operation: 'listCallRecordings',
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				message: 'Response object without status',
			}),
		);
		expect(payload.status_code).toBeUndefined();
		expect(payload.status_class).toBeUndefined();
	});

	it('should not add hint when matching mapping does not define it', () => {
		const payload = buildCliqRecoverableErrorPayload(
			{
				message: 'trigger custom mapping',
			},
			{
				resource: 'bot',
				operation: 'triggerCalls',
			},
			{
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('custom mapping'),
						reason: 'CUSTOM_REASON',
					},
				],
			},
		);

		expect(payload).toEqual(
			expect.objectContaining({
				reason: 'CUSTOM_REASON',
			}),
		);
		expect(payload.hint).toBeUndefined();
	});
});
