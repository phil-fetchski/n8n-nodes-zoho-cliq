import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	ensureSafeObject,
	extractWidgetMapTickerRecoverableContext,
	isWidgetMapTickerAiErrorModeEnabled,
	parseBooleanFlag,
	parseJsonObjectInput,
	pushWidgetMapTickerRecoverableError,
	resolveWidgetMapTickerEnhancedOutput,
	resolveTickerEndpoint,
	validateAppKey,
	validateDeleteTickerBody,
	validateEntityId,
	validateInputMode,
	validateTickerBody,
	validateTickerId,
} from '../../../../../../nodes/ZohoCliq/v1/actions/widgetMapTicker/common';

describe('ZohoCliq - WidgetMapTicker - common helpers', () => {
	let mockExecuteFunctions: IExecuteFunctions;
	const buildTickerPayload = (
		key: string,
		overrides: Partial<{
			title: string;
			type: string;
			color?: string;
			last_modified_time: number;
			latitude: number;
			longitude: number;
			info?: string;
		}> = {},
	): IDataObject => ({
		tickers: {
			[key]: {
				title: 'Valid Title',
				type: 'van',
				last_modified_time: 1721329461000,
				latitude: 12.84567,
				longitude: 80.06092,
				...overrides,
			},
		},
	});

	beforeEach(() => {
		mockExecuteFunctions = {
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	describe('validateEntityId', () => {
		it('should validate entity id', () => {
			const result = validateEntityId(mockExecuteFunctions, ' MAP_123 ', 'Map ID', 0);
			expect(result).toBe('MAP_123');
		});

		it('should throw for empty id', () => {
			expect(() => validateEntityId(mockExecuteFunctions, '', 'Map ID', 0)).toThrow(
				NodeOperationError,
			);
		});

		it('should throw for invalid format', () => {
			expect(() => validateEntityId(mockExecuteFunctions, 'MAP/123', 'Map ID', 0)).toThrow(
				'Invalid Map ID format',
			);
		});

		it('should throw for id too long', () => {
			expect(() => validateEntityId(mockExecuteFunctions, 'a'.repeat(201), 'Map ID', 0)).toThrow(
				'Map ID is too long',
			);
		});
	});

	describe('validateAppKey', () => {
		it('should validate app key', () => {
			expect(validateAppKey(mockExecuteFunctions, ' app_key_1 ', 0)).toBe('app_key_1');
		});

		it('should throw for empty app key', () => {
			expect(() => validateAppKey(mockExecuteFunctions, '   ', 0)).toThrow(
				'App Key is required when "Map Is Custom Extension" is enabled',
			);
		});

		it('should throw for app key too long', () => {
			expect(() => validateAppKey(mockExecuteFunctions, 'a'.repeat(301), 0)).toThrow(
				'App Key is too long',
			);
		});
	});

	describe('ensureSafeObject', () => {
		it('should allow null and undefined', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, null, 0, 'Payload')).not.toThrow();
			expect(() => ensureSafeObject(mockExecuteFunctions, undefined, 0, 'Payload')).not.toThrow();
		});

		it('should throw for non-object values', () => {
			expect(() => ensureSafeObject(mockExecuteFunctions, 'bad', 0, 'Payload')).toThrow(
				'Payload must be a JSON object',
			);
		});

		it('should recurse arrays and reject unsafe nested keys', () => {
			const unsafeNested = JSON.parse('{"__proto__":{"x":1}}') as IDataObject;
			expect(() =>
				ensureSafeObject(mockExecuteFunctions, [{ safe: true }, unsafeNested], 0, 'Payload'),
			).toThrow('Unsafe key "__proto__" is not allowed');
		});

		it('should recurse objects and reject unsafe keys', () => {
			expect(() =>
				ensureSafeObject(mockExecuteFunctions, { a: { constructor: 'bad' } }, 0, 'Payload'),
			).toThrow('Unsafe key "constructor" is not allowed');
		});

		it('should allow safe nested object', () => {
			expect(() =>
				ensureSafeObject(mockExecuteFunctions, { a: { b: ['x', { c: 'y' }] } }, 0, 'Payload'),
			).not.toThrow();
		});
	});

	describe('resolveTickerEndpoint', () => {
		it('should encode special characters in endpoint paths', () => {
			expect(resolveTickerEndpoint('MAP/1', 'WD 1')).toBe('/api/v2/widgets/WD%201/maps/MAP%2F1');
		});

		it('should resolve extension endpoint without widget id', () => {
			expect(resolveTickerEndpoint('MAP/1', undefined, true)).toBe(
				'/api/v2/extensions/widgets/maps/MAP%2F1',
			);
		});

		it('should throw when widget id is missing for internal endpoints', () => {
			expect(() => resolveTickerEndpoint('MAP_1')).toThrow(
				'Widget ID is required for internal widget map endpoints',
			);
		});
	});

	describe('parseJsonObjectInput', () => {
		it('should parse object input', () => {
			expect(parseJsonObjectInput(mockExecuteFunctions, { tickers: {} }, 0, 'Payload')).toEqual({
				tickers: {},
			});
		});

		it('should parse stringified json input', () => {
			expect(parseJsonObjectInput(mockExecuteFunctions, '{"tickers":{}}', 0, 'Payload')).toEqual({
				tickers: {},
			});
		});

		it('should throw for invalid json input', () => {
			expect(() => parseJsonObjectInput(mockExecuteFunctions, '{', 0, 'Payload')).toThrow(
				'Payload must be valid JSON',
			);
		});

		it('should throw for empty string payload', () => {
			expect(() => parseJsonObjectInput(mockExecuteFunctions, '   ', 0, 'Payload')).toThrow(
				'Payload cannot be empty',
			);
		});

		it('should throw for parsed non-object json payload', () => {
			expect(() => parseJsonObjectInput(mockExecuteFunctions, '[]', 0, 'Payload')).toThrow(
				'Payload must be a JSON object',
			);
		});

		it('should throw for non-string non-object payload', () => {
			expect(() => parseJsonObjectInput(mockExecuteFunctions, 123, 0, 'Payload')).toThrow(
				'Payload must be a JSON object',
			);
		});

		it('should rethrow NodeOperationError from parsed unsafe payload', () => {
			const unsafePayload = '{"__proto__":{"polluted":true}}';
			expect(() => parseJsonObjectInput(mockExecuteFunctions, unsafePayload, 0, 'Payload')).toThrow(
				'Unsafe key "__proto__" is not allowed in Payload',
			);
		});
	});

	describe('validateInputMode', () => {
		it('should accept structured input mode', () => {
			expect(validateInputMode(mockExecuteFunctions, 'structured', 0)).toBe('structured');
		});

		it('should accept raw input mode', () => {
			expect(validateInputMode(mockExecuteFunctions, 'raw', 0)).toBe('raw');
		});

		it('should reject unsupported input mode', () => {
			expect(() => validateInputMode(mockExecuteFunctions, 'custom', 0)).toThrow(
				'Input Mode must be either "structured" or "raw"',
			);
		});

		it('should reject undefined input mode', () => {
			expect(() =>
				validateInputMode(mockExecuteFunctions, undefined as unknown as string, 0),
			).toThrow('Input Mode must be either "structured" or "raw"');
		});
	});

	describe('parseBooleanFlag', () => {
		it('should parse boolean values', () => {
			expect(parseBooleanFlag(mockExecuteFunctions, true, 0, 'Flag')).toBe(true);
			expect(parseBooleanFlag(mockExecuteFunctions, false, 0, 'Flag')).toBe(false);
		});

		it('should parse string booleans', () => {
			expect(parseBooleanFlag(mockExecuteFunctions, 'true', 0, 'Flag')).toBe(true);
			expect(parseBooleanFlag(mockExecuteFunctions, 'FALSE', 0, 'Flag')).toBe(false);
			expect(parseBooleanFlag(mockExecuteFunctions, '  true  ', 0, 'Flag')).toBe(true);
		});

		it('should reject invalid boolean input', () => {
			expect(() => parseBooleanFlag(mockExecuteFunctions, 'yes', 0, 'Flag')).toThrow(
				'Flag must be a boolean value',
			);
		});

		it('should reject non-string non-boolean input', () => {
			expect(() => parseBooleanFlag(mockExecuteFunctions, 1, 0, 'Flag')).toThrow(
				'Flag must be a boolean value',
			);
		});
	});

	describe('validateTickerId', () => {
		it('should validate ticker id', () => {
			expect(validateTickerId(mockExecuteFunctions, ' ticker_1 ', 0)).toBe('ticker_1');
		});

		it('should reject invalid ticker id', () => {
			expect(() => validateTickerId(mockExecuteFunctions, 'ticker/1', 0)).toThrow(
				'Invalid Ticker ID format',
			);
		});

		it('should reject missing ticker id', () => {
			expect(() => validateTickerId(mockExecuteFunctions, '   ', 0)).toThrow(
				'Ticker ID is required',
			);
		});

		it('should reject ticker id over max length', () => {
			expect(() => validateTickerId(mockExecuteFunctions, 'a'.repeat(201), 0)).toThrow(
				'Ticker ID is too long. Maximum length is 200 characters.',
			);
		});
	});

	describe('validateTickerBody', () => {
		it('should validate a ticker payload', () => {
			const result = validateTickerBody(
				mockExecuteFunctions,
				buildTickerPayload('chennai', {
					title: 'TN 07 AL 9916',
					color: 'green',
					info: 'Towards Zoho Corporation',
				}),
				0,
				'Ticker Payload',
			);
			expect(result).toEqual(
				expect.objectContaining({
					tickers: expect.objectContaining({
						chennai: expect.objectContaining({ type: 'van', color: 'green' }),
					}),
				}),
			);
		});

		it('should normalize 10-digit unix seconds to milliseconds', () => {
			const result = validateTickerBody(
				mockExecuteFunctions,
				buildTickerPayload('chennai', {
					last_modified_time: 1721329461,
				}),
				0,
				'Ticker Payload',
			);
			expect(((result.tickers as IDataObject).chennai as IDataObject).last_modified_time).toBe(
				1721329461000,
			);
		});

		it('should preserve existing unix milliseconds timestamps below one trillion', () => {
			const result = validateTickerBody(
				mockExecuteFunctions,
				buildTickerPayload('chennai', {
					last_modified_time: 946684800000,
				}),
				0,
				'Ticker Payload',
			);
			expect(((result.tickers as IDataObject).chennai as IDataObject).last_modified_time).toBe(
				946684800000,
			);
		});

		it('should reject invalid ticker type', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { title: 'X', type: 'boat' }),
					0,
					'Ticker Payload',
				),
			).toThrow('type must be one of');
		});

		it('should reject invalid ticker color', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { color: 'blue' }),
					0,
					'Ticker Payload',
				),
			).toThrow('color must be one of: green, red, yellow');
		});

		it('should reject title above max length', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { title: 'x'.repeat(21) }),
					0,
					'Ticker Payload',
				),
			).toThrow('title cannot exceed 20 characters');
		});

		it('should reject info above max length', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { info: 'x'.repeat(31) }),
					0,
					'Ticker Payload',
				),
			).toThrow('info cannot exceed 30 characters');
		});

		it('should reject non-whole-number last_modified_time', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { last_modified_time: 1721329461.5 }),
					0,
					'Ticker Payload',
				),
			).toThrow(
				'last_modified_time must be a positive whole Unix timestamp in seconds or milliseconds',
			);
		});

		it('should reject timestamps below the valid unix-seconds range', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { last_modified_time: 999999999 }),
					0,
					'Ticker Payload',
				),
			).toThrow(
				'last_modified_time must be a 10-digit Unix seconds timestamp or a Unix milliseconds timestamp',
			);
		});

		it('should reject out-of-range latitude', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { latitude: 95 }),
					0,
					'Ticker Payload',
				),
			).toThrow('latitude must be between -90 and 90');
		});

		it('should reject out-of-range longitude', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { longitude: 190 }),
					0,
					'Ticker Payload',
				),
			).toThrow('longitude must be between -180 and 180');
		});

		it('should reject missing tickers object', () => {
			expect(() => validateTickerBody(mockExecuteFunctions, {}, 0, 'Ticker Payload')).toThrow(
				'Ticker Payload.tickers must be a JSON object',
			);
		});

		it('should reject non-object ticker value', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					{
						tickers: {
							chennai: 'bad',
						},
					},
					0,
					'Ticker Payload',
				),
			).toThrow('Ticker Payload.tickers.chennai must be a JSON object');
		});

		it('should reject missing ticker title', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { title: undefined }),
					0,
					'Ticker Payload',
				),
			).toThrow('Ticker Payload.tickers.chennai.title is required');
		});

		it('should reject empty info when provided', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { info: '   ' }),
					0,
					'Ticker Payload',
				),
			).toThrow('Ticker Payload.tickers.chennai.info cannot be empty when provided');
		});

		it('should reject missing ticker type', () => {
			expect(() =>
				validateTickerBody(
					mockExecuteFunctions,
					buildTickerPayload('chennai', { type: undefined }),
					0,
					'Ticker Payload',
				),
			).toThrow('type must be one of');
		});
	});

	describe('validateDeleteTickerBody', () => {
		it('should validate delete payload', () => {
			expect(
				validateDeleteTickerBody(mockExecuteFunctions, { ids: ['chennai', 'mumbai'] }, 0, 'Body'),
			).toEqual({ ids: ['chennai', 'mumbai'] });
		});

		it('should reject empty ids list', () => {
			expect(() => validateDeleteTickerBody(mockExecuteFunctions, { ids: [] }, 0, 'Body')).toThrow(
				'Body.ids cannot be empty',
			);
		});

		it('should reject non-array ids', () => {
			expect(() =>
				validateDeleteTickerBody(
					mockExecuteFunctions,
					{ ids: 'chennai' as unknown as string[] },
					0,
					'Body',
				),
			).toThrow('Body.ids must be an array of strings');
		});

		it('should deduplicate ids', () => {
			expect(
				validateDeleteTickerBody(mockExecuteFunctions, { ids: ['chennai', 'chennai'] }, 0, 'Body'),
			).toEqual({ ids: ['chennai'] });
		});

		it('should reject non-string id entries', () => {
			expect(() =>
				validateDeleteTickerBody(
					mockExecuteFunctions,
					{ ids: ['chennai', 42 as unknown as string] },
					0,
					'Body',
				),
			).toThrow('Body.ids[1] must be a string ticker ID');
		});
	});

	describe('extractWidgetMapTickerRecoverableContext', () => {
		it('should collect validated raw add context including ticker ids and appkey', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'mapIsCustomExtension':
							return true;
						case 'appKey':
							return ' app_key_1 ';
						case 'inputMode':
							return 'raw';
						case 'tickerPayload':
							return {
								tickers: {
									chennai: { title: 'x' },
									'invalid/id': { title: 'y' },
								},
							};
						default:
							return '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
					supportExtensionEndpoint: true,
				}),
			).toEqual({
				map_id: 'MAP_123',
				appkey: 'app_key_1',
				ticker_ids: ['chennai'],
			});
		});

		it('should omit appkey from recoverable context when map is not a custom extension', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'mapIsCustomExtension':
							return false;
						case 'appKey':
							return ' app_key_1 ';
						case 'inputMode':
							return 'raw';
						case 'tickerPayload':
							return {
								tickers: {
									chennai: { title: 'x' },
								},
							};
						default:
							return '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ticker_ids: ['chennai'],
			});
		});

		it('should collect structured delete ids best-effort when request validation would later fail', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string, _itemIndex: number, defaultValue?: unknown) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'structured';
						case 'tickerIdsEntries':
							return { id: [{ tickerId: 'one' }, { tickerId: 'bad/id' }, 'ignore-me'] };
						default:
							return defaultValue ?? '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'deleteTicker',
					structuredEntriesFieldName: 'tickerIdsEntries',
					structuredEntriesDefault: { id: [] },
					rawPayloadFieldName: 'deleteTickerPayload',
					payloadPath: 'Delete Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ids: ['one'],
			});
		});

		it('should ignore structured add entries when the ticker collection is not an array', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string, _itemIndex: number, defaultValue?: unknown) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'structured';
						case 'tickerEntries':
							return { ticker: { tickerId: 'one' } };
						default:
							return defaultValue ?? '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
			});
		});

		it('should ignore structured delete entries when the id collection is not an array', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string, _itemIndex: number, defaultValue?: unknown) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'structured';
						case 'tickerIdsEntries':
							return { id: { tickerId: 'one' } };
						default:
							return defaultValue ?? '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'deleteTicker',
					structuredEntriesFieldName: 'tickerIdsEntries',
					structuredEntriesDefault: { id: [] },
					rawPayloadFieldName: 'deleteTickerPayload',
					payloadPath: 'Delete Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
			});
		});

		it('should handle undefined structured entry containers safely', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string, _itemIndex: number, defaultValue?: unknown) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'structured';
						case 'tickerEntries':
							return undefined;
						default:
							return defaultValue ?? '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
			});
		});

		it('should fall back to default values when parameter lookup throws', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string, _itemIndex: number, defaultValue?: unknown) => {
					if (name === 'tickerPayload') {
						throw new Error('boom');
					}
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'raw';
						default:
							return defaultValue ?? '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
			});
		});

		it('should ignore raw add payloads whose tickers field is not an object', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'raw';
						case 'tickerPayload':
							return { tickers: [] };
						default:
							return '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
			});
		});

		it('should ignore raw delete payloads whose ids field is not an array', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'raw';
						case 'deleteTickerPayload':
							return { ids: 'one' };
						default:
							return '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'deleteTicker',
					structuredEntriesFieldName: 'tickerIdsEntries',
					structuredEntriesDefault: { id: [] },
					rawPayloadFieldName: 'deleteTickerPayload',
					payloadPath: 'Delete Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
			});
		});

		it('should ignore invalid identifiers, blank appkey, and unsupported input modes', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					switch (name) {
						case 'widgetId':
							return 'bad/id';
						case 'mapId':
							return 'bad/id';
						case 'appKey':
							return '   ';
						case 'inputMode':
							return 'custom';
						default:
							return '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
				}),
			).toEqual({});
		});

		it('should handle undefined optional recoverable-context values safely', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					switch (name) {
						case 'widgetId':
							return undefined;
						case 'mapId':
							return 'MAP_123';
						case 'appKey':
							return undefined;
						case 'inputMode':
							return undefined;
						default:
							return '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'addOrUpdateTicker',
					structuredEntriesFieldName: 'tickerEntries',
					structuredEntriesDefault: { ticker: [] },
					rawPayloadFieldName: 'tickerPayload',
					payloadPath: 'Ticker Payload',
				}),
			).toEqual({
				map_id: 'MAP_123',
			});
		});

		it('should ignore non-string raw delete ids while preserving valid string ids', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => {
					switch (name) {
						case 'widgetId':
							return 'WD_123';
						case 'mapId':
							return 'MAP_123';
						case 'inputMode':
							return 'raw';
						case 'deleteTickerPayload':
							return { ids: ['one', 42] };
						default:
							return '';
					}
				}),
			} as unknown as IExecuteFunctions;

			expect(
				extractWidgetMapTickerRecoverableContext(context, 0, {
					operation: 'deleteTicker',
					structuredEntriesFieldName: 'tickerIdsEntries',
					structuredEntriesDefault: { id: [] },
					rawPayloadFieldName: 'deleteTickerPayload',
					payloadPath: 'Delete Ticker Payload',
				}),
			).toEqual({
				widget_id: 'WD_123',
				map_id: 'MAP_123',
				ids: ['one'],
			});
		});
	});

	describe('recoverable error helpers', () => {
		it('should detect ai error mode from direct node parameter', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) => (name === 'enableAiErrorMode' ? true : false)),
				getNode: jest.fn(() => ({ parameters: {} })),
			} as unknown as IExecuteFunctions;
			expect(isWidgetMapTickerAiErrorModeEnabled(context, 0)).toBe(true);
		});

		it('should detect ai error mode from stored node parameters when direct lookup fails', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => ({ parameters: { enableAiErrorMode: true } })),
			} as unknown as IExecuteFunctions;
			expect(isWidgetMapTickerAiErrorModeEnabled(context, 0)).toBe(true);
		});

		it('should return false when getNode is unavailable', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: undefined,
			} as unknown as IExecuteFunctions;
			expect(isWidgetMapTickerAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNode throws', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => {
					throw new Error('boom');
				}),
			} as unknown as IExecuteFunctions;
			expect(isWidgetMapTickerAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when stored node parameters are missing', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => ({})),
			} as unknown as IExecuteFunctions;
			expect(isWidgetMapTickerAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should return false when getNode returns null', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn(() => {
					throw new Error('not available');
				}),
				getNode: jest.fn(() => null),
			} as unknown as IExecuteFunctions;
			expect(isWidgetMapTickerAiErrorModeEnabled(context, 0)).toBe(false);
		});

		it('should push scope payload directly with context fields', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				...mockExecuteFunctions,
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			const pushed = pushWidgetMapTickerRecoverableError(
				context,
				returnData,
				0,
				'deleteTicker',
				{
					zohoCliqScopeErrorPayload: {
						success: false,
						requiredScopes: ['ZohoCliq.Applications.UPDATE'],
					},
				},
				{
					contextFields: { widget_id: 'WD_123' },
				},
			);

			expect(pushed).toBe(true);
			expect(returnData).toEqual([
				{
					json: {
						success: false,
						requiredScopes: ['ZohoCliq.Applications.UPDATE'],
						widget_id: 'WD_123',
					},
				},
			]);
		});

		it('should push scope payload directly without extra context fields', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				...mockExecuteFunctions,
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			pushWidgetMapTickerRecoverableError(context, returnData, 0, 'deleteTicker', {
				zohoCliqScopeErrorPayload: {
					success: false,
					requiredScopes: ['ZohoCliq.Applications.UPDATE'],
				},
			});

			expect(returnData).toEqual([
				{
					json: {
						success: false,
						requiredScopes: ['ZohoCliq.Applications.UPDATE'],
					},
				},
			]);
		});

		it('should build shared recoverable payload with api details', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				...mockExecuteFunctions,
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			pushWidgetMapTickerRecoverableError(
				context,
				returnData,
				0,
				'addOrUpdateTicker',
				{
					message: 'Request failed',
					response: {
						status: 400,
						data: {
							error: 'invalid_request',
							message: 'Bad input',
							code: '4001',
							error_code: 'E4001',
							status: 'error',
						},
					},
				},
				{
					contextFields: { widget_id: 'WD_123', ticker_ids: ['ticker_1'] },
				},
			);

			expect(returnData).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'widgetMapTicker',
						operation: 'addOrUpdateTicker',
						widget_id: 'WD_123',
						ticker_ids: ['ticker_1'],
						status_code: 400,
						status_class: '4xx',
						reason: 'BAD_REQUEST',
						details: expect.objectContaining({
							statusCode: 400,
							message: 'Bad input',
							code: '4001',
							error_code: 'E4001',
							status: 'error',
						}),
					}),
				},
			]);
		});

		it('should skip recoverable push when neither continueOnFail nor ai error mode is enabled', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				...mockExecuteFunctions,
				continueOnFail: jest.fn(() => false),
				getNodeParameter: jest.fn(() => false),
				getNode: jest.fn(() => ({ parameters: {} })),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			const pushed = pushWidgetMapTickerRecoverableError(
				context,
				returnData,
				0,
				'deleteTicker',
				new Error('boom'),
			);

			expect(pushed).toBe(false);
			expect(returnData).toEqual([]);
		});

		it('should build recoverable payload for primitive errors', () => {
			const returnData: Array<{ json: IDataObject }> = [];
			const context = {
				...mockExecuteFunctions,
				continueOnFail: jest.fn(() => true),
				helpers: {
					constructExecutionMetaData: jest.fn((data) => data),
				},
			} as unknown as IExecuteFunctions;

			pushWidgetMapTickerRecoverableError(context, returnData, 0, 'deleteTicker', 'oops');

			expect(returnData).toEqual([
				{
					json: expect.objectContaining({
						success: false,
						resource: 'widgetMapTicker',
						operation: 'deleteTicker',
						message: 'oops',
					}),
				},
			]);
		});
	});

	describe('resolveWidgetMapTickerEnhancedOutput', () => {
		it('should return enhanced output metadata state and coerce null response', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) =>
					name === 'includeEnhancedOutput' ? true : undefined,
				),
			} as unknown as IExecuteFunctions;

			expect(resolveWidgetMapTickerEnhancedOutput(context, 0, null)).toEqual({
				includeEnhancedOutput: true,
				rawResponse: {},
				responseJson: {},
			});
		});

		it('should return raw object response when enhanced output is disabled', () => {
			const context = {
				...mockExecuteFunctions,
				getNodeParameter: jest.fn((name: string) =>
					name === 'includeEnhancedOutput' ? false : undefined,
				),
			} as unknown as IExecuteFunctions;

			expect(resolveWidgetMapTickerEnhancedOutput(context, 0, { status: 'success' })).toEqual({
				includeEnhancedOutput: false,
				rawResponse: { status: 'success' },
				responseJson: { status: 'success' },
			});
		});
	});
});
