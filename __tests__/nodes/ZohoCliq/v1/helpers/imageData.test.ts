import type { IExecuteFunctions } from 'n8n-workflow';

import { TINY_PNG_BASE64 } from '../../../../helpers/base64Images';
import {
	DEFAULT_MAX_BASE64_LENGTH,
	sanitizeBase64ImageData,
	SUPPORTED_BASE64_IMAGE_FORMATS_TEXT,
} from '../../../../../nodes/ZohoCliq/v1/helpers/imageData';

describe('ZohoCliq - Image Data Helper', () => {
	let mockContext: IExecuteFunctions;

	beforeEach(() => {
		mockContext = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	it('should sanitize valid image content with default messages', () => {
		expect(sanitizeBase64ImageData(mockContext, TINY_PNG_BASE64, 0)).toBe(TINY_PNG_BASE64);
	});

	it('should use the default unsupported format message when an avif-like file has no avif brand', () => {
		const nonAvifIsoBmffBase64 = Buffer.from([
			0x00, 0x00, 0x00, 0x40, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x69, 0x66, 0x31, 0x00, 0x00, 0x00,
			0x00, 0x6d, 0x69, 0x66, 0x31, 0x6d, 0x69, 0x61, 0x66,
		]).toString('base64');

		expect(() => sanitizeBase64ImageData(mockContext, nonAvifIsoBmffBase64, 0)).toThrow(
			`Image Data must decode to a supported image file. Supported formats: ${SUPPORTED_BASE64_IMAGE_FORMATS_TEXT}. Provide Base64 from the original image file, not arbitrary Base64 text, HTML, or an image URL.`,
		);
	});

	it('should use the default unsupported format message for valid base64 that is not an image', () => {
		expect(() => sanitizeBase64ImageData(mockContext, 'QmFzZTY0', 0)).toThrow(
			`Image Data must decode to a supported image file. Supported formats: ${SUPPORTED_BASE64_IMAGE_FORMATS_TEXT}. Provide Base64 from the original image file, not arbitrary Base64 text, HTML, or an image URL.`,
		);
	});

	it('should reject malformed bmp headers even when they start with BM', () => {
		expect(() =>
			sanitizeBase64ImageData(mockContext, Buffer.from('BM1234', 'ascii').toString('base64'), 0),
		).toThrow(
			`Image Data must decode to a supported image file. Supported formats: ${SUPPORTED_BASE64_IMAGE_FORMATS_TEXT}. Provide Base64 from the original image file, not arbitrary Base64 text, HTML, or an image URL.`,
		);
	});

	it('should honor custom validation messages', () => {
		expect(() =>
			sanitizeBase64ImageData(mockContext, '%%%bad%%%', 0, {
				invalidBase64Message: 'Custom invalid base64 message',
			}),
		).toThrow('Custom invalid base64 message');

		expect(() =>
			sanitizeBase64ImageData(mockContext, Buffer.from('not-an-image').toString('base64'), 0, {
				unsupportedFormatMessage: 'Custom unsupported image message',
			}),
		).toThrow('Custom unsupported image message');
	});

	it('should enforce the default max base64 length before decoding', () => {
		const overLimitBase64 = 'A'.repeat(DEFAULT_MAX_BASE64_LENGTH + 4);

		expect(() => sanitizeBase64ImageData(mockContext, overLimitBase64, 0)).toThrow(
			`Image Data is too long. Maximum length is ${DEFAULT_MAX_BASE64_LENGTH} characters.`,
		);
	});
});
