import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import {
	cardPayloadBuilderDescription,
	resolveCardPayload,
	resolveMessagePayload,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';
import { createContext } from './testUtils';

describe('ZohoCliq - Shared - messagePayload - raw and edge validations', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = createContext({});
	});
	it('should throw when raw button is missing action object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [{ buttonInputMode: 'raw', rawButton: { label: 'Raw' } }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Raw button at index 0 is missing required object field "action"',
		);
	});

	it('should throw when raw button has invalid action type', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: { label: 'Raw', action: { type: 'invalid.action', data: {} } },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Action Type must be one of: invoke.function, open.url, system.api, copy, preview.url',
		);
	});

	it('should throw when raw button is missing action.data object', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: { label: 'Raw', action: { type: 'open.url' } },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Raw button at index 0 is missing required object field "action.data"',
		);
	});

	it('should throw when raw button has invalid type value', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Raw',
								type: 'neutral',
								action: { type: 'open.url', data: { web: 'https://example.com' } },
							},
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Button Type must be "+", "-", or empty for neutral',
		);
	});

	it('should throw when raw card json is empty string', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardInputMode: 'raw',
				richPayloadJson: '',
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'richPayloadJson cannot be empty',
		);
	});

	it('should throw when label slide has no data', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'label', title: 'No data', data: '' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "label" requires data',
		);
	});

	it('should throw when label slide has no data even if legacy data is provided', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [{ type: 'label', data: '"primitive"' }],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "label" requires data',
		);
	});

	it('should throw when json message body is only whitespace', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: '   ',
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'JSON payload cannot be empty',
		);
	});

	it('should throw when raw card json resolves to null', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardInputMode: 'raw',
				richPayloadJson: 'null',
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'richPayloadJson must be a non-null JSON object/array',
		);
	});

	it('should throw when jsonBody is a non-object primitive', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: 123,
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'jsonBody must be a JSON object',
		);
	});

	it('should validate rich content limits in rich raw mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			cardInputMode: 'raw',
			richPayloadJson: {
				text: 'a'.repeat(4097),
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Card Text exceeds 4096 characters',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			cardInputMode: 'raw',
			richPayloadJson: {
				card: {
					theme: 'invalid',
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Card Theme must be one of: modern-inline, basic, poll, prompt',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			cardInputMode: 'raw',
			richPayloadJson: {
				slides: [{ type: 'bad' }],
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide type at index 0 must be one of: table, list, images, text, label, percentage_chart, graph',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			cardInputMode: 'raw',
			richPayloadJson: {
				slides: [{ type: 'text', data: 'a'.repeat(1001) }],
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Text slide at index 0 exceeds 1000 characters',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			cardInputMode: 'raw',
			richPayloadJson: {
				card: {
					title: 'a'.repeat(10001),
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Rich message payload exceeds 10000 characters',
		);
	});

	it('should resolve card payload directly in builder mode', () => {
		mockExecuteFunctions = createContext({
			cardInputMode: 'structured',
			richText: 'Builder Text',
			cardTitle: 'Builder Card',
			cardTheme: 'modern-inline',
			slides: {
				slide: [
					{
						type: 'text',
						title: 'Component',
						textData: 'Value',
					},
				],
			},
		});

		const payload = resolveCardPayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'Builder Text',
			card: { title: 'Builder Card', theme: 'modern-inline' },
			slides: [{ type: 'text', title: 'Component', data: 'Value' }],
		});
	});

	it('should throw when rich payload contains unsafe object keys', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardInputMode: 'raw',
				richPayloadJson: JSON.parse('{"card":{"title":"X","__proto__":{"polluted":true}}}'),
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			/Unsafe key "__proto__" is not allowed/,
		);
	});

	it('should throw NodeOperationError when json payload has blocked key', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: JSON.parse('{"text":"x","constructor":"bad"}'),
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(NodeOperationError);
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Unsafe key "constructor" is not allowed in jsonBody',
		);
	});

	it('should strip messageType display option in card payload builder description', () => {
		expect(cardPayloadBuilderDescription.length).toBeGreaterThan(0);
		cardPayloadBuilderDescription.forEach((property) => {
			expect(property.displayOptions?.show?.messageType).toBeUndefined();
		});
	});

	it('should throw when jsonBody parses to primitive JSON value', () => {
		mockExecuteFunctions = createContext({
			messageType: 'json',
			jsonBody: '123',
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'jsonBody must be an object',
		);
	});

	it('should accept valid raw button input mode shape', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Open',
								type: '+',
								action: { type: 'open.url', data: { web: 'https://example.com' } },
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.buttons).toBe(
			JSON.stringify([
				{
					label: 'Open',
					type: '+',
					action: { type: 'open.url', data: { web: 'https://example.com' } },
				},
			]),
		);
	});

	it('should treat non-object slide entries in raw payload validation as ignorable', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			cardInputMode: 'raw',
			richPayloadJson: {
				slides: ['bad-entry'],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0) as IDataObject;
		expect(payload.slides).toBe(JSON.stringify(['bad-entry']));
	});

	it('should reject invalid structured card theme before serialization', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				cardTheme: 'neon',
				cardTitle: 'Theme Test',
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Card Theme must be one of: modern-inline, basic, poll, prompt',
		);
	});

	it('should handle non-object or non-array slide data collections as empty', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: 'invalid-collection',
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Rich Message must include at least one of: text, card, slides, or buttons',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: { slide: 'invalid-array' },
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Rich Message must include at least one of: text, card, slides, or buttons',
		);
	});

	it('should handle non-object collection shapes for structured component data as empty', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{ type: 'images', imageUrls: 'invalid' },
						{ type: 'list', listItems: 'invalid' },
						{ type: 'label', labelDataPairs: { pair: 'invalid' } },
						{ type: 'table', tableHeaders: 'invalid', tableRows: 'invalid' },
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "images" requires data',
		);
	});

	it('should throw for non-object label data pair and ignore non-array table collections', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'label',
							labelDataPairs: { pair: ['bad'] },
						},
					],
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'slides.slide[0].labelDataPairs.pair[0] must be a JSON object',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableHeaders: { header: 'invalid' },
							tableRows: { row: 'invalid' },
						},
					],
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "table" requires data',
		);

		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableRows: { row: [{ values: 'invalid' }] },
						},
					],
				},
			},
		});
		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "table" requires data',
		);
	});

	it('should build guided user mention token from email and default silent zohoid mode', () => {
		mockExecuteFunctions = createContext({
			messageType: 'text',
			text: 'Please review',
			addMention: true,
			mentions: {
				mention: [
					{ mentionType: 'user', userIdOrEmail: 'jordan@example.com' },
					{
						mentionType: 'silentUser',
						silentUserName: 'Jordan',
						silentUserValue: '667356693',
					},
				],
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		expect(payload).toEqual({
			text: 'Please review {@jordan@example.com} [Jordan](zohoid:667356693)',
		});
	});

	it('should return raw rich payload object from resolveCardPayload in raw mode', () => {
		mockExecuteFunctions = createContext({
			cardInputMode: 'raw',
			richPayloadJson: {
				text: 'raw card text',
				card: { title: 'Raw Card' },
				slides: [{ type: 'text', data: 'slide data' }],
			},
		});

		const payload = resolveCardPayload(mockExecuteFunctions, 0);
		expect(payload).toMatchObject({
			text: 'raw card text',
			card: { title: 'Raw Card' },
			slides: [{ type: 'text', data: 'slide data' }],
		});
		expect(typeof payload.card).toBe('object');
		expect(Array.isArray(payload.slides)).toBe(true);
	});

	it('should include title in raw shorthand slide and set structured text slide data', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							slideInputMode: 'raw',
							type: 'text',
							title: 'Important',
							rawSlide: { value: 'hello' },
						},
						{
							type: 'text',
							textData: 'text body',
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		const slides = JSON.parse(payload.slides as string);
		expect(slides[0]).toMatchObject({
			type: 'text',
			title: 'Important',
			data: { value: 'hello' },
		});
		expect(slides[1]).toMatchObject({
			type: 'text',
			data: 'text body',
		});
	});

	it('should build label/table data including empty value fallback', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'label',
							labelDataPairs: {
								pair: [{ key: 'status', value: 'open' }],
							},
						},
						{
							type: 'table',
							tableHeaders: {
								header: [{ name: 'name' }],
							},
							tableRows: {
								row: [
									{
										values: {
											entry: [{ key: 'name', value: '' }],
										},
									},
								],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		const slides = JSON.parse(payload.slides as string);
		expect(slides[0].data).toEqual([{ status: 'open' }]);
		expect(slides[1].data).toMatchObject({
			headers: ['name'],
			rows: [{ name: '' }],
		});
	});

	it('should default structured label value to empty string when omitted', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'label',
							labelDataPairs: {
								pair: [{ key: 'status' }],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		const slides = JSON.parse(payload.slides as string);
		expect(slides[0].data).toEqual([{ status: '' }]);
	});

	it('should build table data with rows only when headers are omitted', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'table',
							tableRows: {
								row: [
									{
										values: {
											entry: [{ key: 'name', value: 'Jordan' }],
										},
									},
								],
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		const slides = JSON.parse(payload.slides as string);
		expect(slides[0].data).toEqual({
			rows: [{ name: 'Jordan' }],
		});
	});

	it('should return null label fields for empty label pair array and fail slide data requirement', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				slides: {
					slide: [
						{
							type: 'label',
							labelDataPairs: { pair: [] },
						},
					],
				},
			},
		});

		expect(() => resolveMessagePayload(mockExecuteFunctions, 0)).toThrow(
			'Slide at index 0 with type "label" requires data',
		);
	});

	it('should build invoke/system/copy/preview button action data branches', () => {
		mockExecuteFunctions = createContext({
			messageType: 'rich',
			richMessage: {
				buttons: {
					button: [
						{
							label: 'Run',
							actionType: 'invoke.function',
							invokeFunctionName: 'send_alert',
						},
						{
							label: 'API',
							actionType: 'system.api',
							systemApiAction: 'startchat',
							systemApiUserId: '123456789',
						},
						{
							label: 'Copy',
							actionType: 'copy',
							actionDataInputMode: 'raw',
							actionData: {
								value: 'copied text',
							},
						},
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Preview Raw',
								action: {
									type: 'preview.url',
									data: {
										url: 'https://example.com/preview',
									},
								},
							},
						},
					],
				},
			},
		});

		const payload = resolveMessagePayload(mockExecuteFunctions, 0);
		const buttons = JSON.parse(payload.buttons as string);
		expect(buttons[0].action.data).toMatchObject({ name: 'send_alert' });
		expect(buttons[1].action.data).toMatchObject({ api: 'startchat/123456789' });
		expect(buttons[2].action.data).toMatchObject({ value: 'copied text' });
		expect(buttons[3].action.data).toMatchObject({ url: 'https://example.com/preview' });
	});
});
