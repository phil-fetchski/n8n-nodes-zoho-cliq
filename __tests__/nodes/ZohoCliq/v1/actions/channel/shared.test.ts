import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import * as utils from '../../../../../../nodes/ZohoCliq/v1/helpers/utils';
import {
	TINY_AVIF_BASE64,
	TINY_AVIF_COMPATIBLE_BRAND_BASE64,
	TINY_BMP_BASE64,
	TINY_GIF_BASE64,
	TINY_ICO_BASE64,
	TINY_JPEG_BASE64,
	TINY_PNG_BASE64,
	TINY_SVG_BASE64,
	TINY_TIFF_BASE64,
	TINY_WEBP_BASE64,
	XML_PREFIXED_TINY_SVG_BASE64,
} from '../../../../../helpers/base64Images';

import {
	CHANNEL_LEVEL_OPTIONS,
	channelConfigJsonExample,
	channelStructuredConfigFields,
	channelStructuredConfigFieldsByName,
	extractChannelIdFromLookupEntity,
	getRequiredStructuredConfigField,
	parseChannelMemberIdentifiers,
	parseChannelStringArray,
	parseRawChannelConfig,
	pushChannelRecoverableError,
	resolveChannelLocatorInput,
	resolveRawChannelConfigInput,
	resolveChannelEnhancedOutput,
	validateChannelConfigValue,
	validateChannelImageData,
	validateChannelLevel,
} from '../../../../../../nodes/ZohoCliq/v1/actions/channel/shared';

describe('ZohoCliq - Channel shared recoverable helper', () => {
	const buildContext = (
		continueOnFail: boolean,
		enableAiErrorMode: unknown = false,
	): IExecuteFunctions =>
		({
			continueOnFail: jest.fn(() => continueOnFail),
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'enableAiErrorMode') {
					return enableAiErrorMode;
				}
				return fallback;
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node' })),
		}) as unknown as IExecuteFunctions;

	const validationContext = {
		getNode: jest.fn(() => ({ name: 'Test Node' })),
		getNodeParameter: jest.fn((_name: string, _itemIndex: number, fallback?: unknown) => fallback),
		helpers: {
			constructExecutionMetaData: jest.fn((data) => data),
		},
	} as unknown as IExecuteFunctions;

	it('should expose OpenAPI-backed channel level options and structured config field metadata', () => {
		expect(CHANNEL_LEVEL_OPTIONS).toEqual([
			{ name: 'Organization', value: 'organization' },
			{ name: 'Team', value: 'team' },
			{ name: 'Private', value: 'private' },
			{ name: 'External', value: 'external' },
		]);
		expect(channelStructuredConfigFields).toHaveLength(4);
		expect(channelStructuredConfigFields[0].name).toBe('add_remove_info');
		expect(channelStructuredConfigFields[3].name).toBe('reply_mode');
		expect(channelStructuredConfigFieldsByName.reply_mode.name).toBe('reply_mode');
	});

	it('should fail fast when a required structured config field lookup is missing', () => {
		expect(() => getRequiredStructuredConfigField('not_real_field')).toThrow(
			'Missing required channel structured config field: not_real_field',
		);
	});

	it('should resolve enhanced output defaults and sanitize non-object responses', () => {
		const defaultResult = resolveChannelEnhancedOutput(validationContext, 0, ['bad']);
		expect(defaultResult).toEqual({
			includeEnhancedOutput: true,
			responseJson: { data: ['bad'] },
			rawResponse: { data: ['bad'] },
		});

		(validationContext.getNodeParameter as jest.Mock).mockReturnValueOnce(false);
		const explicitFalse = resolveChannelEnhancedOutput(validationContext, 0, {
			success: true,
		});
		expect(explicitFalse).toEqual({
			includeEnhancedOutput: false,
			responseJson: { success: true },
			rawResponse: { success: true },
		});
	});

	it('should preserve array-shaped raw responses inside enhanced output helpers', () => {
		const result = resolveChannelEnhancedOutput(validationContext, 0, [
			{ channel_id: 'P1234567890123456789' },
		]);

		expect(result.includeEnhancedOutput).toBe(true);
		expect(result.responseJson).toEqual({
			data: [{ channel_id: 'P1234567890123456789' }],
		});
		expect(result.rawResponse).toEqual({
			data: [{ channel_id: 'P1234567890123456789' }],
		});
	});

	it('should validate channel levels and config values', () => {
		expect(validateChannelLevel(validationContext, ' team ', 0)).toBe('team');
		expect(validateChannelConfigValue(validationContext, 'reply_mode', ' both ', 0)).toBe('both');
	});

	it('should reject invalid channel levels and config values', () => {
		expect(() => validateChannelLevel(validationContext, 'invalid', 0)).toThrow('Invalid level');
		expect(() => validateChannelLevel(validationContext, null, 0)).toThrow('Invalid level');
		expect(() => validateChannelConfigValue(validationContext, 'reply_mode', 'invalid', 0)).toThrow(
			'Invalid value for "reply_mode"',
		);
		expect(() => validateChannelConfigValue(validationContext, 'reply_mode', null, 0)).toThrow(
			'Config field "reply_mode" cannot be empty',
		);
		expect(() => validateChannelConfigValue(validationContext, 'reply_mode', '   ', 0)).toThrow(
			'Config field "reply_mode" cannot be empty',
		);
	});

	it('should parse raw channel config from string and object forms', () => {
		expect(parseRawChannelConfig(validationContext, '   ', 0)).toBeUndefined();
		expect(parseRawChannelConfig(validationContext, null, 0)).toBeUndefined();
		expect(parseRawChannelConfig(validationContext, '{"reply_mode":"threads"}', 0)).toEqual({
			reply_mode: 'threads',
		});
		expect(parseRawChannelConfig(validationContext, { meeting_chat_type: 'thread' }, 0)).toEqual({
			meeting_chat_type: 'thread',
		});
		expect(parseRawChannelConfig(validationContext, {}, 0)).toBeUndefined();
	});

	it('should resolve raw channel config input from nested and collection candidates', () => {
		expect(resolveRawChannelConfigInput(undefined, undefined)).toBeUndefined();
		expect(resolveRawChannelConfigInput('[object Object]', {})).toEqual({});
		expect(resolveRawChannelConfigInput('  {}  ', undefined)).toEqual({});
		expect(resolveRawChannelConfigInput('   ', undefined)).toBeUndefined();
		expect(resolveRawChannelConfigInput('[object Object]', { reply_mode: 'threads' })).toEqual({
			reply_mode: 'threads',
		});
		expect(resolveRawChannelConfigInput('{"meeting_chat_type":"thread"}', '[object Object]')).toBe(
			'{"meeting_chat_type":"thread"}',
		);
		expect(resolveRawChannelConfigInput('   ', 0)).toBe(0);
	});

	it('should fall back to extracted locator values when direct locator values are unavailable', () => {
		const locatorContext = {
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'channelId' && options?.extractValue) {
						return 12345;
					}
					if (name === 'channelId') {
						return { mode: 'name' };
					}
					return fallback;
				},
			),
		} as unknown as IExecuteFunctions;

		expect(resolveChannelLocatorInput(locatorContext, 0)).toEqual({
			mode: 'name',
			value: '12345',
		});
		expect(locatorContext.getNodeParameter).toHaveBeenNthCalledWith(1, 'channelId', 0, undefined);
		expect(locatorContext.getNodeParameter).toHaveBeenNthCalledWith(2, 'channelId', 0, '', {
			extractValue: true,
		});
	});

	it('should trim extracted string locator values when the locator object value is non-string', () => {
		const locatorContext = {
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'channelId' && options?.extractValue) {
						return '  engineering-updates  ';
					}
					if (name === 'channelId') {
						return { mode: 'name', value: 12345 };
					}
					return fallback;
				},
			),
		} as unknown as IExecuteFunctions;

		expect(resolveChannelLocatorInput(locatorContext, 0)).toEqual({
			mode: 'name',
			value: 'engineering-updates',
		});
	});

	it('should trim a direct string value from the locator object without falling back to extractValue', () => {
		const locatorContext = {
			getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
				if (name === 'channelId') {
					return { mode: 'name', value: '  engineering-updates  ' };
				}
				return fallback;
			}),
		} as unknown as IExecuteFunctions;

		expect(resolveChannelLocatorInput(locatorContext, 0)).toEqual({
			mode: 'name',
			value: 'engineering-updates',
		});
		expect(locatorContext.getNodeParameter).toHaveBeenCalledTimes(1);
	});

	it('should trim fallback extracted string values when the raw locator is not an object', () => {
		const locatorContext = {
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'channelId' && options?.extractValue) {
						return '  engineering-updates  ';
					}
					if (name === 'channelId') {
						return 12345;
					}
					return fallback;
				},
			),
		} as unknown as IExecuteFunctions;

		expect(resolveChannelLocatorInput(locatorContext, 0)).toEqual({
			mode: 'id',
			value: 'engineering-updates',
		});
	});

	it('should coerce missing extracted locator values to an empty string', () => {
		const locatorContext = {
			getNodeParameter: jest.fn(
				(
					name: string,
					_itemIndex: number,
					fallback?: unknown,
					options?: { extractValue?: boolean },
				) => {
					if (name === 'channelId' && options?.extractValue) {
						return undefined;
					}
					if (name === 'channelId') {
						return { mode: 'name', value: null };
					}
					return fallback;
				},
			),
		} as unknown as IExecuteFunctions;

		expect(resolveChannelLocatorInput(locatorContext, 0)).toEqual({
			mode: 'name',
			value: '',
		});
	});

	it('should extract channel IDs from direct and nested lookup entities', () => {
		expect(extractChannelIdFromLookupEntity({ channel_id: ' CH_123 ' })).toBe('CH_123');
		expect(
			extractChannelIdFromLookupEntity({
				channel: { channel_id: '   ' },
				data: { id: 'CH_456' },
			}),
		).toBe('CH_456');
		expect(extractChannelIdFromLookupEntity({ result: { id: 'CH_789' } })).toBe('CH_789');
		expect(extractChannelIdFromLookupEntity(['CH_123'])).toBeUndefined();
		expect(extractChannelIdFromLookupEntity({ channel: {} })).toBeUndefined();
	});

	it('should reject invalid raw channel config payloads', () => {
		expect(() => parseRawChannelConfig(validationContext, '{"reply_mode":', 0)).toThrow(
			`Config JSON must be valid JSON. Use a JSON object with only these keys: reply_mode, leave_join_info, add_remove_info, meeting_chat_type. Example: ${channelConfigJsonExample}`,
		);
		expect(() => parseRawChannelConfig(validationContext, [], 0)).toThrow(
			`Config JSON must be an object. Example: ${channelConfigJsonExample}`,
		);
		expect(() => parseRawChannelConfig(validationContext, { constructor: 'bad' }, 0)).toThrow(
			`Invalid key "constructor" in Config JSON. Use a JSON object with only these keys: reply_mode, leave_join_info, add_remove_info, meeting_chat_type. Example: ${channelConfigJsonExample}`,
		);
		expect(() => parseRawChannelConfig(validationContext, { bad_key: 'value' }, 0)).toThrow(
			`Unsupported config key "bad_key". Allowed keys: reply_mode, leave_join_info, add_remove_info, meeting_chat_type. Example: ${channelConfigJsonExample}`,
		);
	});

	it('should validate image data and string-array helpers', () => {
		expect(validateChannelImageData(validationContext, TINY_GIF_BASE64, 0)).toBe(TINY_GIF_BASE64);
		expect(
			validateChannelImageData(
				validationContext,
				`  ${TINY_GIF_BASE64.slice(0, 12)} ${TINY_GIF_BASE64.slice(12)}  `,
				0,
			),
		).toBe(TINY_GIF_BASE64);
		expect(
			validateChannelImageData(validationContext, `data:image/gif;base64,${TINY_GIF_BASE64}`, 0),
		).toBe(TINY_GIF_BASE64);
		expect(
			validateChannelImageData(
				validationContext,
				`data:image/gif;base64,${TINY_GIF_BASE64.slice(0, 16)}\n${TINY_GIF_BASE64.slice(16)}`,
				0,
			),
		).toBe(TINY_GIF_BASE64);
		expect(
			validateChannelImageData(
				validationContext,
				`data:image/svg+xml;base64,${TINY_SVG_BASE64}`,
				0,
			),
		).toBe(TINY_SVG_BASE64);
		expect(
			validateChannelImageData(
				validationContext,
				`data:image/svg+xml;charset=utf-8;base64,${TINY_SVG_BASE64}`,
				0,
			),
		).toBe(TINY_SVG_BASE64);
		expect(validateChannelImageData(validationContext, XML_PREFIXED_TINY_SVG_BASE64, 0)).toBe(
			XML_PREFIXED_TINY_SVG_BASE64,
		);
		expect(validateChannelImageData(validationContext, null, 0)).toBeUndefined();
		expect(validateChannelImageData(validationContext, '   ', 0)).toBeUndefined();
		expect(parseChannelStringArray(validationContext, 'A1,B2', 0, 'team_ids')).toEqual([
			'A1',
			'B2',
		]);
		expect(parseChannelStringArray(validationContext, ['A1', ' B2 '], 0, 'team_ids')).toEqual([
			'A1',
			'B2',
		]);
		expect(
			parseChannelStringArray(validationContext, 'user@example.com', 0, 'email_ids', {
				allowEmail: true,
			}),
		).toEqual(['user@example.com']);
		expect(parseChannelStringArray(validationContext, undefined, 0, 'team_ids')).toBeUndefined();
	});

	it('should accept other supported image fixtures without changing the payload bytes', () => {
		expect(validateChannelImageData(validationContext, TINY_PNG_BASE64, 0)).toBe(TINY_PNG_BASE64);
		expect(validateChannelImageData(validationContext, TINY_JPEG_BASE64, 0)).toBe(TINY_JPEG_BASE64);
		expect(validateChannelImageData(validationContext, TINY_WEBP_BASE64, 0)).toBe(TINY_WEBP_BASE64);
		expect(
			validateChannelImageData(
				validationContext,
				`data:image/avif;charset=utf-8;base64,${TINY_AVIF_BASE64}`,
				0,
			),
		).toBe(TINY_AVIF_BASE64);
		expect(validateChannelImageData(validationContext, TINY_AVIF_COMPATIBLE_BRAND_BASE64, 0)).toBe(
			TINY_AVIF_COMPATIBLE_BRAND_BASE64,
		);
		expect(validateChannelImageData(validationContext, TINY_BMP_BASE64, 0)).toBe(TINY_BMP_BASE64);
		expect(validateChannelImageData(validationContext, TINY_TIFF_BASE64, 0)).toBe(TINY_TIFF_BASE64);
		expect(validateChannelImageData(validationContext, TINY_ICO_BASE64, 0)).toBe(TINY_ICO_BASE64);
	});

	it('should reject invalid image data and string-array values', () => {
		expect(() => validateChannelImageData(validationContext, 'aGVsbG8', 0)).toThrow(
			'Image Data must be a valid base64-encoded string',
		);
		expect(() => validateChannelImageData(validationContext, 'aGVsbG8_', 0)).toThrow(
			'Image Data must be a valid base64-encoded string',
		);
		expect(() => validateChannelImageData(validationContext, 'aGVsbG8=', 0)).toThrow(
			'Image Data must decode to a supported image file',
		);
		expect(() => validateChannelImageData(validationContext, '%%%bad%%%', 0)).toThrow(
			'Image Data must be a valid base64-encoded string',
		);
		expect(() =>
			validateChannelImageData(
				validationContext,
				Buffer.from('not-an-image').toString('base64'),
				0,
			),
		).toThrow('Image Data must decode to a supported image file');
		expect(() => validateChannelImageData(validationContext, 'data:text/plain,abcd', 0)).toThrow(
			'Image Data must be a valid base64-encoded string',
		);
		expect(() => parseChannelStringArray(validationContext, 'bad value', 0, 'team_ids')).toThrow(
			'Invalid team_ids value: bad value',
		);
		expect(() =>
			parseChannelStringArray(validationContext, 'not-an-email', 0, 'email_ids', {
				allowEmail: true,
			}),
		).toThrow('Invalid email_ids value: not-an-email');
	});

	it('should parse member identifiers into email_ids or user_ids payloads', () => {
		expect(parseChannelMemberIdentifiers(validationContext, 'user@example.com', 0)).toEqual({
			identifierType: 'email_ids',
			identifiers: ['user@example.com'],
		});
		expect(parseChannelMemberIdentifiers(validationContext, 'user_1,user_2', 0)).toEqual({
			identifierType: 'user_ids',
			identifiers: ['user_1', 'user_2'],
		});
	});

	it('should reject invalid member identifier combinations', () => {
		expect(() => parseChannelMemberIdentifiers(validationContext, '', 0)).toThrow(
			'Member identifiers are required',
		);
		expect(() => parseChannelMemberIdentifiers(validationContext, ' , ', 0)).toThrow(
			'At least one member identifier is required',
		);
		expect(() =>
			parseChannelMemberIdentifiers(validationContext, 'user@example.com,user_1', 0),
		).toThrow('Mixed identifier types are not supported');
	});

	it('should reject empty parse results from delegated member identifier validators', () => {
		const parseEmailListSpy = jest.spyOn(utils, 'parseEmailList').mockReturnValueOnce([]);
		expect(() => parseChannelMemberIdentifiers(validationContext, 'user@example.com', 0)).toThrow(
			'At least one email ID is required',
		);
		parseEmailListSpy.mockRestore();

		const validateUserIdArraySpy = jest.spyOn(utils, 'validateUserIdArray').mockReturnValueOnce([]);
		expect(() => parseChannelMemberIdentifiers(validationContext, 'user_1', 0)).toThrow(
			'At least one user ID is required',
		);
		validateUserIdArraySpy.mockRestore();
	});

	it('should return false when continueOnFail is disabled', () => {
		const result = pushChannelRecoverableError(buildContext(false), [], 0, 'list', new Error('x'));
		expect(result).toBe(false);
	});

	it('should return helper payload when AI Error Mode is enabled and continueOnFail is disabled', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(buildContext(false, true), returnData, 0, 'list', {
			statusCode: 400,
			message: 'Bad request',
		});
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				status_code: 400,
			}),
		);
	});

	it('should replace invalid channel_id guidance when the provided value is a chat ID', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(
			buildContext(true),
			returnData,
			0,
			'get',
			{
				statusCode: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
			},
			{
				contextFields: {
					channel_id: 'CT_2242141513167369284_841692385',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHANNEL_ID',
						hint: 'Use a valid channel ID (for example, P5452022000000451001). This endpoint rejects unique names in AI Tool mode.',
						messageOverride:
							'Zoho Cliq rejected this get-channel request because channel_id must be a valid channel ID for this endpoint. Unique names are not accepted in AI Tool mode.',
					},
				],
			},
		);
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_CHANNEL_ID',
				hint: 'The request may contain an incorrect channel_id value or reference a channel resource this endpoint could not identify. The value provided appears to be a Chat ID, not a Channel ID. Verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
				message:
					'Zoho Cliq rejected this request because a supplied channel_id parameter or related channel resource could not be identified for this endpoint. The value provided appears to be a Chat ID, not a Channel ID. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
			}),
		);
	});

	it('should preserve invalid channel_id guidance for non-chat identifiers', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(
			buildContext(true),
			returnData,
			0,
			'get',
			{
				statusCode: 400,
				message: 'The request URL is invalid. Please check the URL pattern.',
			},
			{
				contextFields: {
					channel_id: 'P5452022000000451001',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHANNEL_ID',
						hint: 'Use a valid channel ID (for example, P5452022000000451001). This endpoint rejects unique names in AI Tool mode.',
						messageOverride:
							'Zoho Cliq rejected this get-channel request because channel_id must be a valid channel ID for this endpoint. Unique names are not accepted in AI Tool mode.',
					},
				],
			},
		);
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				reason: 'INVALID_CHANNEL_ID',
				hint: 'The request may contain an incorrect channel_id value or reference a channel resource this endpoint could not identify. Verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
				message:
					'Zoho Cliq rejected this request because a supplied channel_id parameter or related channel resource could not be identified for this endpoint.',
			}),
		);
	});

	it('should map generic 400 responses to channel-resource guidance for channel-id-only operations', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(
			buildContext(true),
			returnData,
			0,
			'get',
			{
				statusCode: 400,
				message: 'Request failed with status code 400',
			},
			{
				contextFields: {
					channel_id: 'O5452022000000451001',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHANNEL_ID',
						hint: 'Use a valid channel ID (for example, P5452022000000451001). This endpoint rejects unique names in AI Tool mode.',
						messageOverride:
							'Zoho Cliq rejected this get-channel request because channel_id must be a valid channel ID for this endpoint. Unique names are not accepted in AI Tool mode.',
					},
				],
			},
		);
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				reason: 'CHANNEL_RESOURCE_UNIDENTIFIED',
				hint: 'The request may contain an incorrect channel_id value or reference a channel resource this endpoint could not identify. Verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
				message:
					'Zoho Cliq rejected this request because a supplied channel_id parameter or related channel resource could not be identified for this endpoint.',
			}),
		);
	});

	it('should provide broad parameter guidance for generic 400 responses on non-channel-id-only operations', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(
			buildContext(true),
			returnData,
			0,
			'update',
			{
				statusCode: 400,
				message: 'Request failed with status code 400',
			},
			{
				contextFields: {
					channel_id: 'O5452022000000451001',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHANNEL_ID',
						hint: 'Use a valid channel ID (for example, P5452022000000451001). This endpoint rejects unique names in AI Tool mode.',
						messageOverride:
							'Zoho Cliq rejected this get-channel request because channel_id must be a valid channel ID for this endpoint. Unique names are not accepted in AI Tool mode.',
					},
				],
			},
		);
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				reason: 'CHANNEL_REQUEST_BAD_PARAMETERS',
				hint: 'The request may contain an incorrect parameter value or reference a channel resource this endpoint could not identify. Review all provided inputs for missing, unsupported, or malformed values. If you supplied channel_id, verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
				message:
					'Zoho Cliq rejected this channel request because one or more supplied parameters were invalid, unsupported, or referenced a channel resource this endpoint could not identify.',
			}),
		);
	});

	it('should provide chat-specific broad guidance for generic 400 responses on non-channel-id-only operations', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(
			buildContext(true),
			returnData,
			0,
			'update',
			{
				statusCode: 400,
				message: 'Request failed with status code 400',
			},
			{
				contextFields: {
					channel_id: 'CT_5452022000000451001',
				},
				messageMappings: [
					{
						match: (normalizedMessage) => normalizedMessage.includes('request url is invalid'),
						reason: 'INVALID_CHANNEL_ID',
						hint: 'Use a valid channel ID (for example, P5452022000000451001). This endpoint rejects unique names in AI Tool mode.',
						messageOverride:
							'Zoho Cliq rejected this get-channel request because channel_id must be a valid channel ID for this endpoint. Unique names are not accepted in AI Tool mode.',
					},
				],
			},
		);
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				reason: 'CHANNEL_REQUEST_BAD_PARAMETERS',
				hint: 'The request may contain an incorrect parameter value or reference a channel resource this endpoint could not identify. The supplied channel_id appears to be a Chat ID, not a Channel ID. Review all provided inputs for missing, unsupported, or malformed values, and verify that you are passing the actual channel_id returned by Zoho Cliq for the target channel. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
				message:
					'Zoho Cliq rejected this channel request because one or more supplied parameters were invalid, unsupported, or referenced a channel resource this endpoint could not identify. The supplied channel_id appears to be a Chat ID, not a Channel ID. Channel ID prefixes vary by channel level and commonly include P, O, T, or E.',
			}),
		);
	});

	it.each(['true', ' yes ', 'ON', ' TRUE ', 'Yes', 'on'])(
		'should treat string AI Error Mode value %p as enabled',
		(enableAiErrorMode) => {
			const returnData: INodeExecutionData[] = [];
			const result = pushChannelRecoverableError(
				buildContext(false, enableAiErrorMode),
				returnData,
				0,
				'list',
				{
					statusCode: 400,
					message: 'Bad request',
				},
			);
			expect(result).toBe(true);
			expect(returnData[0].json).toEqual(
				expect.objectContaining({
					success: false,
					operation: 'list',
					status_code: 400,
				}),
			);
		},
	);

	it('should treat numeric AI Error Mode value 1 as enabled', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(buildContext(false, 1), returnData, 0, 'list', {
			statusCode: 400,
			message: 'Bad request',
		});
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				status_code: 400,
			}),
		);
	});

	it('should fallback to node parameters when getNodeParameter throws', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(() => {
				throw new Error('parameter unavailable');
			}),
			getNode: jest.fn(() => ({
				parameters: {
					enableAiErrorMode: 'true',
				},
			})),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const result = pushChannelRecoverableError(context, returnData, 0, 'list', {
			statusCode: 400,
			message: 'Bad request',
		});
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				status_code: 400,
			}),
		);
	});

	it('should fallback to node parameters when getNodeParameter is not enabled', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(
				(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
			),
			getNode: jest.fn(() => ({
				parameters: {
					enableAiErrorMode: 'true',
				},
			})),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const result = pushChannelRecoverableError(context, returnData, 0, 'list', {
			statusCode: 400,
			message: 'Bad request',
		});
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				status_code: 400,
			}),
		);
	});

	it('should return false when getNode throws during AI Error Mode fallback', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(
				(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
			),
			getNode: jest.fn(() => {
				throw new Error('node unavailable');
			}),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const result = pushChannelRecoverableError(context, returnData, 0, 'list', new Error('x'));
		expect(result).toBe(false);
		expect(returnData).toHaveLength(0);
	});

	it('should return false when getNode returns undefined during AI Error Mode fallback', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(
				(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
			),
			getNode: jest.fn(() => undefined),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const result = pushChannelRecoverableError(context, returnData, 0, 'list', new Error('x'));
		expect(result).toBe(false);
		expect(returnData).toHaveLength(0);
	});

	it('should return false when getNode is not a function during AI Error Mode fallback', () => {
		const returnData: INodeExecutionData[] = [];
		const context = {
			continueOnFail: jest.fn(() => false),
			getNodeParameter: jest.fn(
				(_name: string, _itemIndex: number, fallback?: unknown) => fallback,
			),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
		} as unknown as IExecuteFunctions;

		const result = pushChannelRecoverableError(context, returnData, 0, 'list', new Error('x'));
		expect(result).toBe(false);
		expect(returnData).toHaveLength(0);
	});

	it('should pass through scope payload object', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(buildContext(true), returnData, 0, 'list', {
			zohoCliqScopeErrorPayload: { success: false, operation: 'list' },
		});
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(expect.objectContaining({ operation: 'list' }));
	});

	it('should ignore non-object scope payload and build helper payload', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(buildContext(true), returnData, 0, 'list', {
			zohoCliqScopeErrorPayload: [],
			statusCode: 429,
			message: 'Too many requests',
		});
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				status_code: 429,
			}),
		);
	});

	it('should build helper payload when scope payload is missing', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(buildContext(true), returnData, 0, 'list', {
			statusCode: 400,
			message: 'Bad request',
		});
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
				status_code: 400,
			}),
		);
	});

	it('should build helper payload when error is null', () => {
		const returnData: INodeExecutionData[] = [];
		const result = pushChannelRecoverableError(buildContext(true), returnData, 0, 'list', null);
		expect(result).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				operation: 'list',
			}),
		);
	});
});
