/**
 * Tests for Interface Type Guards
 * Verifies type guard functions for API responses
 */

import {
	isZohoCliqErrorResponse,
	isZohoCliqChannelListResponse,
} from '../../../../nodes/ZohoCliq/v1/helpers/interfaces';

describe('Helper Interfaces', () => {
	describe('isZohoCliqErrorResponse', () => {
		it('should return true for valid error response', () => {
			const errorResponse = {
				error: 'INVALID_REQUEST',
				message: 'Invalid channel ID',
				code: '400',
			};

			expect(isZohoCliqErrorResponse(errorResponse)).toBe(true);
		});

		it('should return true for minimal error response', () => {
			const errorResponse = {
				error: 'ERROR',
			};

			expect(isZohoCliqErrorResponse(errorResponse)).toBe(true);
		});

		it('should return false for non-object input', () => {
			expect(isZohoCliqErrorResponse(null)).toBe(false);
			expect(isZohoCliqErrorResponse(undefined)).toBe(false);
			expect(isZohoCliqErrorResponse('string')).toBe(false);
			expect(isZohoCliqErrorResponse(123)).toBe(false);
		});

		it('should return false when error property is missing', () => {
			const response = {
				message: 'Some message',
				code: '400',
			};

			expect(isZohoCliqErrorResponse(response)).toBe(false);
		});

		it('should return false when error property is not a string', () => {
			const response = {
				error: 123,
				message: 'Some message',
			};

			expect(isZohoCliqErrorResponse(response)).toBe(false);
		});

		it('should handle error responses with all fields', () => {
			const errorResponse = {
				error: 'AUTHORIZATION_ERROR',
				message: 'Missing required scope',
				code: 'AUTH_001',
				error_code: '403',
				status: 'error',
				details: { scope_required: 'ZohoCliq.Channels.READ' },
			};

			expect(isZohoCliqErrorResponse(errorResponse)).toBe(true);
		});
	});

	describe('isZohoCliqChannelListResponse', () => {
		it('should return true for valid channel list response', () => {
			const response = {
				channels: [
					{ channel_id: 'C1', name: 'Channel 1' },
					{ channel_id: 'C2', name: 'Channel 2' },
				],
			};

			expect(isZohoCliqChannelListResponse(response)).toBe(true);
		});

		it('should return true for empty channel list', () => {
			const response = {
				channels: [],
			};

			expect(isZohoCliqChannelListResponse(response)).toBe(true);
		});

		it('should return true for channel list with pagination', () => {
			const response = {
				channels: [{ channel_id: 'C1' }],
				has_more: true,
				next_token: 'token123',
				sync_token: 'sync456',
			};

			expect(isZohoCliqChannelListResponse(response)).toBe(true);
		});

		it('should return false for non-object input', () => {
			expect(isZohoCliqChannelListResponse(null)).toBe(false);
			expect(isZohoCliqChannelListResponse(undefined)).toBe(false);
			expect(isZohoCliqChannelListResponse('string')).toBe(false);
			expect(isZohoCliqChannelListResponse([])).toBe(false);
		});

		it('should return false when channels property is missing', () => {
			const response = {
				has_more: false,
			};

			expect(isZohoCliqChannelListResponse(response)).toBe(false);
		});

		it('should return false when channels property is not an array', () => {
			const response = {
				channels: 'not an array',
			};

			expect(isZohoCliqChannelListResponse(response)).toBe(false);
		});

		it('should return false when channels property is an object', () => {
			const response = {
				channels: { channel_id: 'C1' },
			};

			expect(isZohoCliqChannelListResponse(response)).toBe(false);
		});

		it('should handle response with additional metadata', () => {
			const response = {
				channels: [],
				has_more: false,
				next_token: null,
				sync_token: 'sync123',
				total_count: 0,
			};

			expect(isZohoCliqChannelListResponse(response)).toBe(true);
		});
	});

	describe('Type Guard Integration', () => {
		it('should correctly differentiate error from success response', () => {
			const errorResponse = { error: 'ERROR', message: 'Failed' };
			const successResponse = { channels: [] };

			expect(isZohoCliqErrorResponse(errorResponse)).toBe(true);
			expect(isZohoCliqChannelListResponse(errorResponse)).toBe(false);

			expect(isZohoCliqErrorResponse(successResponse)).toBe(false);
			expect(isZohoCliqChannelListResponse(successResponse)).toBe(true);
		});

		it('should handle ambiguous responses safely', () => {
			const ambiguousResponse = {
				error: 'ERROR',
				channels: [],
			};

			// Response has both error and channels - type guards should handle this
			expect(isZohoCliqErrorResponse(ambiguousResponse)).toBe(true);
			expect(isZohoCliqChannelListResponse(ambiguousResponse)).toBe(true);
		});
	});
});
