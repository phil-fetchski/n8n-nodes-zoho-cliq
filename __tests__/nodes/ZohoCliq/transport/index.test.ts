/**
 * Tests for Transport Layer (API request helper)
 * Verifies API requests, error handling, data center URLs, and pagination
 */

import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';
import {
	zohoCliqApiBinaryRequest,
	zohoCliqApiMultipartRequest,
	zohoCliqApiRequest,
} from '../../../../nodes/ZohoCliq/v1/transport';

describe('Transport - zohoCliqApiRequest', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getCredentials: jest.fn(),
			getNode: jest.fn().mockReturnValue({ name: 'Zoho Cliq' }),
			helpers: {
				httpRequestWithAuthentication: jest.fn(),
			},
		} as unknown as IExecuteFunctions;
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Credentials Validation', () => {
		it('should throw error when credentials are missing', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue(null);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow(NodeOperationError);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('No credentials configured');
		});

		it('should validate data center selection', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({
				dc: 'invalid',
			});

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow(NodeOperationError);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('Invalid data center');
		});

		it('should accept all valid data centers', async () => {
			const validDataCenters = ['us', 'eu', 'in', 'au', 'jp', 'cn', 'sa', 'uk', 'ca'];

			for (const dc of validDataCenters) {
				(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc });
				(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
					{ success: true },
				);

				await expect(
					zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
				).resolves.toBeDefined();
			}
		});

		it('should default to US data center when not specified', async () => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({});
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				success: true,
			});

			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.url).toContain('https://cliq.zoho.com');
		});
	});

	describe('Data Center URLs', () => {
		const dataCenterUrls: Record<string, string> = {
			us: 'https://cliq.zoho.com',
			eu: 'https://cliq.zoho.eu',
			in: 'https://cliq.zoho.in',
			au: 'https://cliq.zoho.com.au',
			jp: 'https://cliq.zoho.jp',
			cn: 'https://cliq.zoho.com.cn',
			sa: 'https://cliq.zoho.sa',
			uk: 'https://cliq.zoho.uk',
			ca: 'https://cliq.zohocloud.ca',
		};

		Object.entries(dataCenterUrls).forEach(([dc, expectedUrl]) => {
			it(`should use correct URL for ${dc.toUpperCase()} data center`, async () => {
				(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc });
				(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
					{ success: true },
				);

				await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

				const callOptions = (
					mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock
				).mock.calls[0][1] as IHttpRequestOptions;

				expect(callOptions.url).toBe(`${expectedUrl}/api/v2/channels`);
			});
		});
	});

	describe('Endpoint Validation', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
		});

		it('should throw error if endpoint does not start with /', async () => {
			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', 'api/v2/channels'),
			).rejects.toThrow(NodeOperationError);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', 'api/v2/channels'),
			).rejects.toThrow('Invalid API endpoint');
		});

		it('should accept valid endpoints', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				success: true,
			});

			const validEndpoints = [
				'/api/v2/channels',
				'/api/v2/channels/C123',
				'/api/v2/channelsbyname/test-channel/message',
			];

			for (const endpoint of validEndpoints) {
				await expect(
					zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', endpoint),
				).resolves.toBeDefined();
			}
		});
	});

	describe('HTTP Methods', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				success: true,
			});
		});

		it('should support GET requests', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.method).toBe('GET');
		});

		it('should support POST requests', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'POST', '/api/v2/channels', {
				name: 'Test',
			});

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.method).toBe('POST');
		});

		it('should support PUT requests', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'PUT', '/api/v2/channels/C123', {
				name: 'Updated',
			});

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.method).toBe('PUT');
		});

		it('should support DELETE requests', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'DELETE', '/api/v2/channels/C123');

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.method).toBe('DELETE');
		});
	});

	describe('Request Body', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				success: true,
			});
		});

		it('should include body in POST request', async () => {
			const body = { text: 'Hello World', thread_id: 'T123' };

			await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'POST',
				'/api/v2/channels/C123/message',
				body,
			);

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.body).toEqual(body);
		});

		it('should omit body for GET request', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.body).toBeUndefined();
		});
	});

	describe('Query String Parameters', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				success: true,
			});
		});

		it('should include query string parameters', async () => {
			const qs = { limit: 50, status: 'active' };

			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels', {}, qs);

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.qs).toEqual(qs);
		});

		it('should support boolean query parameters', async () => {
			const qs = { joined: true, pinned: false };

			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels', {}, qs);

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.qs).toEqual(qs);
		});

		it('should support numeric query parameters', async () => {
			const qs = { limit: 100, offset: 50 };

			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels', {}, qs);

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.qs).toEqual(qs);
		});
	});

	describe('Authentication', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				success: true,
			});
		});

		it('should use httpRequestWithAuthentication helper', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			expect(mockExecuteFunctions.helpers.httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		});

		it('should pass credential name to authentication helper', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			expect(mockExecuteFunctions.helpers.httpRequestWithAuthentication).toHaveBeenCalledWith(
				'zohoCliqOAuth2Api',
				expect.any(Object),
			);
		});

		it('should set json flag to true', async () => {
			await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.json).toBe(true);
		});

		it('should support custom headers and text response mode', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				'row1,row2',
			);

			await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/maintenanceapi/v2/chats',
				undefined,
				{ fields: 'title,chat_id' },
				{
					headers: { 'Content-Type': 'text/csv' },
					json: false,
				},
			);

			const callOptions = (mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock)
				.mock.calls[0][1] as IHttpRequestOptions;

			expect(callOptions.headers).toEqual({ 'Content-Type': 'text/csv' });
			expect(callOptions.json).toBe(false);
		});
	});

	describe('Error Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
		});

		it('should wrap API errors in NodeApiError', async () => {
			const apiError = new Error('API request failed');
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow(NodeApiError);
		});

		it('should preserve error context in NodeApiError', async () => {
			const apiError = {
				message: 'Unauthorized',
				statusCode: 401,
				response: { data: { error: 'Invalid token' } },
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			try {
				await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(NodeApiError);
			}
		});

		it('should attach raw debug payload to wrapped NodeApiError', async () => {
			const apiError = {
				message: 'Method invalid',
				statusCode: 405,
				response: {
					status: 405,
					data: {
						message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
					},
					body: {
						debug: 'body',
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			try {
				await zohoCliqApiRequest.call(mockExecuteFunctions, 'DELETE', '/api/v2/channels');
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(NodeApiError);
				expect((error as NodeApiError & { zohoCliqDebug?: unknown }).zohoCliqDebug).toEqual(
					expect.objectContaining({
						original_message: 'Method invalid',
						status_code: 405,
						response_status: 405,
						response_data: expect.objectContaining({
							message: 'The HTTP Method you are trying is invalid. Please check the HTTP method.',
						}),
						response_body: expect.objectContaining({
							debug: 'body',
						}),
					}),
				);
			}
		});

		it('should attach httpCode, response statusCode, and response headers to debug payload', async () => {
			const apiError = {
				message: 'Bad request - please check your parameters',
				httpCode: 400,
				response: {
					statusCode: 400,
					headers: {
						'x-cliq-request-id': 'req_123',
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			try {
				await zohoCliqApiRequest.call(mockExecuteFunctions, 'DELETE', '/api/v2/channels');
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(NodeApiError);
				expect((error as NodeApiError & { zohoCliqDebug?: unknown }).zohoCliqDebug).toEqual(
					expect.objectContaining({
						original_message: 'Bad request - please check your parameters',
						http_code: 400,
						response_status_code: 400,
						response_headers: {
							'x-cliq-request-id': 'req_123',
						},
					}),
				);
			}
		});

		it('should surface nested Zoho message details from response body', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					body: {
						message: 'appkey is required for extension bots',
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			try {
				await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(NodeApiError);
				expect((error as Error).message).toContain('appkey is required for extension bots');
			}
		});

		it('should surface Zoho message details from stringified response body', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					body: '{"message":"custom domain already exists"}',
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			try {
				await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(NodeApiError);
				expect((error as Error).message).toContain('custom domain already exists');
			}
		});

		it('should surface Zoho nested data message details from stringified response body', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					body: '{"data":{"message":"DNS record not found"}}',
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			try {
				await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');
				fail('Should have thrown error');
			} catch (error) {
				expect(error).toBeInstanceOf(NodeApiError);
				expect((error as Error).message).toContain('DNS record not found');
			}
		});

		it('should surface message from response.data.data.message payload', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					data: {
						data: {
							message: 'deep data message',
						},
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('deep data message');
		});

		it('should surface nested error description from response.data.error payload', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					data: {
						error: {
							description: 'nested description',
						},
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('nested description');
		});

		it('should prioritize response.body.error details over response.data.error details', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					body: {
						error: {
							message: 'body error message',
						},
					},
					data: {
						error: {
							message: 'data error message',
						},
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('body error message');
		});

		it('should use root error.message when nested response details are absent', async () => {
			const apiError = {
				error: {
					message: 'root error message',
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('root error message');
		});

		it('should surface serialized raw Zoho response body when no message-like fields exist', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					body: {
						invalid_team_ids: ['TEAM_BAD'],
						status: 'failure',
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('{"invalid_team_ids":["TEAM_BAD"],"status":"failure"}');
		});

		it('should ignore circular raw payloads and continue searching other serialized fallback objects', async () => {
			const circularBody: Record<string, unknown> = {};
			circularBody.self = circularBody;
			const apiError = {
				statusCode: 400,
				response: {
					body: circularBody,
					data: {
						invalid_team_ids: ['TEAM_BAD'],
						status: 'failure',
					},
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow('{"invalid_team_ids":["TEAM_BAD"],"status":"failure"}');
		});

		it('should handle non-object errors', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				'string error',
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow(NodeApiError);
		});

		it('should handle null errors', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				null,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow(NodeApiError);
		});

		it('should handle malformed stringified error payloads gracefully', async () => {
			const apiError = {
				statusCode: 400,
				response: {
					body: '{invalid-json}',
				},
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				apiError,
			);

			await expect(
				zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels'),
			).rejects.toThrow(NodeApiError);
		});
	});

	describe('Response Handling', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
		});

		it('should return API response as IDataObject', async () => {
			const mockResponse = { channel_id: 'C123', name: 'Test Channel' };
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				mockResponse,
			);

			const result = await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/api/v2/channels/C123',
			);

			expect(result).toEqual(mockResponse);
		});

		it('should handle array responses', async () => {
			const mockResponse = { channels: [{ id: 'C1' }, { id: 'C2' }] };
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				mockResponse,
			);

			const result = await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			expect(result).toEqual(mockResponse);
		});

		it('should handle pagination metadata', async () => {
			const mockResponse = {
				channels: [],
				has_more: true,
				next_token: 'token123',
				sync_token: 'sync456',
			};
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				mockResponse,
			);

			const result = await zohoCliqApiRequest.call(mockExecuteFunctions, 'GET', '/api/v2/channels');

			expect(result.has_more).toBe(true);
			expect(result.next_token).toBe('token123');
			expect(result.sync_token).toBe('sync456');
		});

		it('should parse object JSON strings when json mode is disabled', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				'{"ok":true}',
			);

			const result = await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/maintenanceapi/v2/chats',
				undefined,
				undefined,
				{ json: false },
			);

			expect(result).toEqual({ ok: true });
		});

		it('should wrap JSON array strings into data when json mode is disabled', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				'[{"id":"1"},{"id":"2"}]',
			);

			const result = await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/maintenanceapi/v2/chats',
				undefined,
				undefined,
				{ json: false },
			);

			expect(result).toEqual({
				data: [{ id: '1' }, { id: '2' }],
			});
		});

		it('should fall back to csv when JSON parsing fails in json=false mode', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				'{"broken"',
			);

			const result = await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/maintenanceapi/v2/chats',
				undefined,
				undefined,
				{ json: false },
			);

			expect(result).toEqual({ csv: '{"broken"' });
		});

		it('should return csv wrapper for whitespace-only string responses in json=false mode', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				'   ',
			);

			const result = await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/maintenanceapi/v2/chats',
				undefined,
				undefined,
				{ json: false },
			);

			expect(result).toEqual({ csv: '   ' });
		});

		it('should return object responses unchanged when json mode is disabled', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				ok: true,
			});

			const result = await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/maintenanceapi/v2/chats',
				undefined,
				undefined,
				{ json: false },
			);

			expect(result).toEqual({ ok: true });
		});

		it('should wrap non-object non-string responses into data in json=false mode', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				42,
			);

			const result = await zohoCliqApiRequest.call(
				mockExecuteFunctions,
				'GET',
				'/maintenanceapi/v2/chats',
				undefined,
				undefined,
				{ json: false },
			);

			expect(result).toEqual({ data: 42 });
		});
	});

	describe('zohoCliqApiBinaryRequest', () => {
		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
		});

		it('should return binary response body, headers, and status code', async () => {
			const binaryBody = Buffer.from('%PDF-1.7', 'utf8');
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				body: binaryBody,
				headers: { 'content-type': 'application/pdf' },
				statusCode: 200,
			});

			const result = await zohoCliqApiBinaryRequest.call(
				mockExecuteFunctions,
				'GET',
				'/api/v2/files/FILE_1',
			);

			expect(result.data).toEqual(binaryBody);
			expect(result.headers).toEqual({ 'content-type': 'application/pdf' });
			expect(result.statusCode).toBe(200);
			expect(mockExecuteFunctions.helpers.httpRequestWithAuthentication).toHaveBeenCalledWith(
				'zohoCliqOAuth2Api',
				expect.objectContaining({
					method: 'GET',
					url: 'https://cliq.zoho.com/api/v2/files/FILE_1',
					json: false,
					returnFullResponse: true,
					encoding: 'arraybuffer',
				}),
			);
		});

		it('should preserve byteOffset and byteLength when response body is a sliced ArrayBufferView', async () => {
			const source = Buffer.from('0123456789', 'utf8');
			const slicedView = new Uint8Array(source).subarray(3, 7); // "3456"
			const expectedBody = Buffer.from('3456', 'utf8');
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				body: slicedView,
				headers: { 'content-type': 'application/octet-stream' },
				statusCode: 206,
			});

			const result = await zohoCliqApiBinaryRequest.call(
				mockExecuteFunctions,
				'GET',
				'/api/v2/files/FILE_2',
			);

			expect(result.data).toEqual(expectedBody);
			expect(result.headers).toEqual({ 'content-type': 'application/octet-stream' });
			expect(result.statusCode).toBe(206);
			expect(mockExecuteFunctions.helpers.httpRequestWithAuthentication).toHaveBeenCalledWith(
				'zohoCliqOAuth2Api',
				expect.objectContaining({
					method: 'GET',
					url: 'https://cliq.zoho.com/api/v2/files/FILE_2',
					json: false,
					returnFullResponse: true,
					encoding: 'arraybuffer',
				}),
			);
		});

		it('should throw for endpoint missing leading slash', async () => {
			await expect(
				zohoCliqApiBinaryRequest.call(mockExecuteFunctions, 'GET', 'api/v2/files/FILE_1'),
			).rejects.toThrow(NodeOperationError);
		});

		it('should wrap request errors in NodeApiError', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				new Error('request failed'),
			);

			await expect(
				zohoCliqApiBinaryRequest.call(mockExecuteFunctions, 'GET', '/api/v2/files/FILE_1'),
			).rejects.toThrow(NodeApiError);
		});

		it('should handle non-object transport responses by returning empty headers', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				'plain-text',
			);

			const result = await zohoCliqApiBinaryRequest.call(
				mockExecuteFunctions,
				'GET',
				'/api/v2/files/FILE_3',
			);

			expect(result.data).toEqual(Buffer.from(''));
			expect(result.headers).toEqual({});
			expect(result.statusCode).toBeUndefined();
		});

		it('should handle ArrayBuffer body and normalize invalid headers/statusCode shapes', async () => {
			const ab = new ArrayBuffer(4);
			const view = new Uint8Array(ab);
			view[0] = 1;
			view[1] = 2;
			view[2] = 3;
			view[3] = 4;
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				body: ab,
				headers: 'invalid-headers',
				statusCode: '200',
			});

			const result = await zohoCliqApiBinaryRequest.call(
				mockExecuteFunctions,
				'GET',
				'/api/v2/files/FILE_4',
			);

			expect(result.data).toEqual(Buffer.from([1, 2, 3, 4]));
			expect(result.headers).toEqual({});
			expect(result.statusCode).toBeUndefined();
		});

		it('should convert scalar body values using string fallback path', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue({
				body: 42,
				headers: {},
				statusCode: 200,
			});

			const result = await zohoCliqApiBinaryRequest.call(
				mockExecuteFunctions,
				'GET',
				'/api/v2/files/FILE_6',
			);

			expect(result.data).toEqual(Buffer.from('42', 'binary'));
			expect(result.headers).toEqual({});
			expect(result.statusCode).toBe(200);
		});

		it('should wrap non-object errors in NodeApiError', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				'string error',
			);

			await expect(
				zohoCliqApiBinaryRequest.call(mockExecuteFunctions, 'GET', '/api/v2/files/FILE_5'),
			).rejects.toThrow(NodeApiError);
		});
	});

	describe('zohoCliqApiMultipartRequest', () => {
		const bodyBuffer = Buffer.from('file-bytes');

		beforeEach(() => {
			(mockExecuteFunctions.getCredentials as jest.Mock).mockResolvedValue({ dc: 'us' });
		});

		it('should throw when endpoint does not start with /', async () => {
			await expect(
				zohoCliqApiMultipartRequest.call(
					mockExecuteFunctions,
					'POST',
					'api/v2/events/attachments',
					bodyBuffer,
					'multipart/form-data; boundary=test',
				),
			).rejects.toThrow(NodeOperationError);
		});

		it('should throw when content type is empty', async () => {
			await expect(
				zohoCliqApiMultipartRequest.call(
					mockExecuteFunctions,
					'POST',
					'/api/v2/events/attachments',
					bodyBuffer,
					'   ',
				),
			).rejects.toThrow('Content-Type is required for multipart requests');
		});

		it('should issue multipart request with json false and normalize response', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockResolvedValue(
				'{"ok":true}',
			);

			const result = await zohoCliqApiMultipartRequest.call(
				mockExecuteFunctions,
				'POST',
				'/api/v2/events/attachments',
				bodyBuffer,
				'multipart/form-data; boundary=test',
				{ calendar_id: 'cal_1' },
			);

			expect(result).toEqual({ ok: true });
			expect(mockExecuteFunctions.helpers.httpRequestWithAuthentication).toHaveBeenCalledWith(
				'zohoCliqOAuth2Api',
				expect.objectContaining({
					method: 'POST',
					url: 'https://cliq.zoho.com/api/v2/events/attachments',
					body: bodyBuffer,
					qs: { calendar_id: 'cal_1' },
					headers: { 'Content-Type': 'multipart/form-data; boundary=test' },
					json: false,
				}),
			);
		});

		it('should wrap multipart request errors in NodeApiError with extracted message', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue({
				response: {
					body: {
						message: 'multipart upload failed',
					},
				},
			});

			let caughtError: unknown;
			try {
				await zohoCliqApiMultipartRequest.call(
					mockExecuteFunctions,
					'PUT',
					'/api/v2/events/attachments',
					bodyBuffer,
					'multipart/form-data; boundary=test',
				);
			} catch (error) {
				caughtError = error;
			}

			expect(caughtError).toBeInstanceOf(NodeApiError);
			expect((caughtError as Error).message).toContain('multipart upload failed');
		});

		it('should wrap non-object multipart errors in NodeApiError', async () => {
			(mockExecuteFunctions.helpers.httpRequestWithAuthentication as jest.Mock).mockRejectedValue(
				'multipart string error',
			);

			await expect(
				zohoCliqApiMultipartRequest.call(
					mockExecuteFunctions,
					'PUT',
					'/api/v2/events/attachments',
					bodyBuffer,
					'multipart/form-data; boundary=test',
				),
			).rejects.toThrow(NodeApiError);
		});
	});
});
