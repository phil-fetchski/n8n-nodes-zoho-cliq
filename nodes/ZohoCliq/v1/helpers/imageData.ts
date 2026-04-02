import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const SUPPORTED_BASE64_IMAGE_FORMATS = [
	'PNG',
	'JPEG',
	'GIF',
	'WebP',
	'AVIF',
	'BMP',
	'TIFF',
	'ICO',
	'SVG',
] as const;

export const DEFAULT_MAX_BASE64_LENGTH = 4_000_000;
export const SUPPORTED_BASE64_IMAGE_FORMATS_TEXT = SUPPORTED_BASE64_IMAGE_FORMATS.join(', ');

const BASE64_IMAGE_DATA_PATTERN =
	/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const BASE64_IMAGE_DATA_URL_PREFIX_PATTERN =
	/^data:image\/[a-zA-Z0-9.+-]+(?:;[^\s;=]+(?:=[^;,\s]+)?)*;base64,/i;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const GIF87A_SIGNATURE = Buffer.from('GIF87a', 'ascii');
const GIF89A_SIGNATURE = Buffer.from('GIF89a', 'ascii');
const BMP_SIGNATURE = Buffer.from('BM', 'ascii');
const TIFF_LE_SIGNATURE = Buffer.from([0x49, 0x49, 0x2a, 0x00]);
const TIFF_BE_SIGNATURE = Buffer.from([0x4d, 0x4d, 0x00, 0x2a]);
const ICO_SIGNATURE = Buffer.from([0x00, 0x00, 0x01, 0x00]);
const AVIF_BRANDS = new Set(['avif', 'avis']);

export interface IBase64ImageValidationOptions {
	fieldLabel?: string;
	invalidBase64Message?: string;
	maxLength?: number;
	unsupportedFormatMessage?: string;
}

function bufferStartsWith(buffer: Buffer, signature: Buffer): boolean {
	return (
		buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
	);
}

function looksLikeSvgImage(buffer: Buffer): boolean {
	const leadingText = buffer
		.subarray(0, Math.min(buffer.length, 512))
		.toString('utf8')
		.trimStart()
		.toLowerCase();

	return (
		leadingText.startsWith('<svg') ||
		(leadingText.startsWith('<?xml') && leadingText.includes('<svg'))
	);
}

function looksLikeAvifImage(buffer: Buffer): boolean {
	if (buffer.length < 16 || buffer.subarray(4, 8).toString('ascii') !== 'ftyp') {
		return false;
	}

	const majorBrand = buffer.subarray(8, 12).toString('ascii');
	if (AVIF_BRANDS.has(majorBrand)) {
		return true;
	}

	const declaredBoxSize = buffer.readUInt32BE(0);
	const boxEnd =
		declaredBoxSize >= 16 && declaredBoxSize <= buffer.length
			? declaredBoxSize
			: Math.min(buffer.length, 32);

	for (let offset = 16; offset + 4 <= boxEnd; offset += 4) {
		const compatibleBrand = buffer.subarray(offset, offset + 4).toString('ascii');
		if (AVIF_BRANDS.has(compatibleBrand)) {
			return true;
		}
	}

	return false;
}

function looksLikeBmpImage(buffer: Buffer): boolean {
	if (!bufferStartsWith(buffer, BMP_SIGNATURE) || buffer.length < 14) {
		return false;
	}

	const declaredFileSize = buffer.readUInt32LE(2);
	const pixelDataOffset = buffer.readUInt32LE(10);

	return (
		declaredFileSize >= 14 &&
		declaredFileSize <= buffer.length &&
		pixelDataOffset >= 14 &&
		pixelDataOffset <= buffer.length
	);
}

function detectSupportedImageFormat(buffer: Buffer): string | undefined {
	if (bufferStartsWith(buffer, PNG_SIGNATURE)) {
		return 'PNG';
	}
	if (bufferStartsWith(buffer, JPEG_SIGNATURE)) {
		return 'JPEG';
	}
	if (bufferStartsWith(buffer, GIF87A_SIGNATURE) || bufferStartsWith(buffer, GIF89A_SIGNATURE)) {
		return 'GIF';
	}
	if (
		buffer.length >= 12 &&
		buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
		buffer.subarray(8, 12).toString('ascii') === 'WEBP'
	) {
		return 'WebP';
	}
	if (looksLikeAvifImage(buffer)) {
		return 'AVIF';
	}
	if (looksLikeBmpImage(buffer)) {
		return 'BMP';
	}
	if (bufferStartsWith(buffer, TIFF_LE_SIGNATURE) || bufferStartsWith(buffer, TIFF_BE_SIGNATURE)) {
		return 'TIFF';
	}
	if (bufferStartsWith(buffer, ICO_SIGNATURE)) {
		return 'ICO';
	}
	if (looksLikeSvgImage(buffer)) {
		return 'SVG';
	}

	return undefined;
}

function buildUnsupportedFormatMessage(fieldLabel: string): string {
	return `${fieldLabel} must decode to a supported image file. Supported formats: ${SUPPORTED_BASE64_IMAGE_FORMATS_TEXT}. Provide Base64 from the original image file, not arbitrary Base64 text, HTML, or an image URL.`;
}

export function sanitizeBase64ImageData(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	options: IBase64ImageValidationOptions = {},
): string | undefined {
	const fieldLabel = options.fieldLabel ?? 'Image Data';
	const maxLength = options.maxLength ?? DEFAULT_MAX_BASE64_LENGTH;
	const raw = String(value ?? '').trim();
	if (!raw) {
		return undefined;
	}

	const normalized = raw.replace(BASE64_IMAGE_DATA_URL_PREFIX_PATTERN, '').replace(/\s+/g, '');

	if (!normalized || !BASE64_IMAGE_DATA_PATTERN.test(normalized)) {
		throw new NodeOperationError(
			context.getNode(),
			options.invalidBase64Message ?? `${fieldLabel} must be a valid base64-encoded string`,
			{ itemIndex },
		);
	}

	if (normalized.length > maxLength) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldLabel} is too long. Maximum length is ${maxLength} characters.`,
			{ itemIndex },
		);
	}

	const imageBuffer = Buffer.from(normalized, 'base64');
	if (!imageBuffer.length || !detectSupportedImageFormat(imageBuffer)) {
		throw new NodeOperationError(
			context.getNode(),
			options.unsupportedFormatMessage ?? buildUnsupportedFormatMessage(fieldLabel),
			{ itemIndex },
		);
	}

	return normalized;
}
