import type { IExecuteFunctions } from 'n8n-workflow';

import {
	extractButtons,
	extractButtonsFromCollection,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload/buttons';

const createContext = (): IExecuteFunctions =>
	({
		getNode: jest.fn(() => ({ name: 'Test Node' })),
	}) as unknown as IExecuteFunctions;

describe('ZohoCliq - Shared - messagePayload - buttons', () => {
	let context: IExecuteFunctions;

	beforeEach(() => {
		context = createContext();
	});

	it('should return empty array for invalid button collection shapes', () => {
		expect(extractButtonsFromCollection(context, null, 0, 'buttons')).toEqual([]);
		expect(extractButtonsFromCollection(context, { button: {} }, 0, 'buttons')).toEqual([]);
		expect(extractButtons(context, null, 0)).toEqual([]);
	});

	it('should throw when a button entry is not an object', () => {
		expect(() =>
			extractButtonsFromCollection(context, { button: ['bad-entry'] }, 0, 'buttons'),
		).toThrow('Each button must be a JSON object');
	});

	it('should throw when enabled is not a boolean', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [{ enabled: 'yes', label: 'Open', actionType: 'open.url' }],
				},
				0,
				'buttons',
			),
		).toThrow('buttons.button[0].enabled must resolve to a boolean');
	});

	it('should throw for invalid button input mode', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [{ buttonInputMode: 'unsupported', label: 'Open', actionType: 'open.url' }],
				},
				0,
				'buttons',
			),
		).toThrow('Button Input Mode at index 0 must be one of: structured, raw');
	});

	it('should build structured button with confirm payload', () => {
		const buttons = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						label: 'Approve',
						actionType: 'open.url',
						actionDataInputMode: 'structured',
						openUrlWeb: 'https://example.com',
						enableConfirm: true,
						confirmTitle: 'Confirm',
						confirmInput: 'Proceed?',
						confirmButtonLabel: 'Yes',
						confirmDescription: 'Extra details',
						confirmCancelButtonLabel: 'No',
						confirmEmotion: 'positive',
						confirmMandatory: 'true',
					},
				],
			},
			0,
			'buttons',
		);

		expect(buttons[0]).toEqual({
			label: 'Approve',
			action: {
				type: 'open.url',
				data: { web: 'https://example.com' },
				confirm: {
					title: 'Confirm',
					input: 'Proceed?',
					button_label: 'Yes',
					description: 'Extra details',
					cancel_button_label: 'No',
					emotion: 'positive',
					mandatory: 'true',
				},
			},
		});
	});

	it('should validate structured confirm emotion and mandatory values', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'Approve',
							actionType: 'open.url',
							actionDataInputMode: 'structured',
							openUrlWeb: 'https://example.com',
							enableConfirm: true,
							confirmTitle: 'Confirm',
							confirmInput: 'Proceed?',
							confirmButtonLabel: 'Yes',
							confirmEmotion: 'happy',
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow(
			'buttons.button[0].action.confirm.emotion must be one of: positive, neutral, negative',
		);

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'Approve',
							actionType: 'open.url',
							actionDataInputMode: 'structured',
							openUrlWeb: 'https://example.com',
							enableConfirm: true,
							confirmTitle: 'Confirm',
							confirmInput: 'Proceed?',
							confirmButtonLabel: 'Yes',
							confirmMandatory: 'maybe',
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('buttons.button[0].action.confirm.mandatory must be one of: true, false');
	});

	it('should throw when structured action data input mode is invalid', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'Open',
							actionType: 'open.url',
							actionDataInputMode: 'invalid',
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Action Data Input Mode at button index 0 must be one of: structured, raw');
	});

	it('should validate structured system.api configuration and raw system api format', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'System',
							actionType: 'system.api',
							actionDataInputMode: 'structured',
							systemApiAction: 'unsupported',
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Button at index 0 has unsupported system.api action "unsupported"');

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'System',
							actionType: 'system.api',
							actionDataInputMode: 'raw',
							actionData: { api: 'startchat/' },
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow(
			'Button at index 0 with action type system.api expects api format "<system_action>/<zuid>" or "locationpermission"',
		);
	});

	it('should validate copy and preview.url action data requirements in structured mode', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [{ label: 'Copy', actionType: 'copy', actionDataInputMode: 'structured' }],
				},
				0,
				'buttons',
			),
		).toThrow('Button at index 0 with action type copy requires a non-empty action.data object');

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'Preview',
							actionType: 'preview.url',
							actionDataInputMode: 'structured',
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Button at index 0 with action type preview.url requires action data field "url"');
	});

	it('should reject preview.url action data using non-https URLs', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'Preview HTTP',
							actionType: 'preview.url',
							actionDataInputMode: 'raw',
							actionData: { url: 'http://example.com/preview' },
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow(
			'Button at index 0 with action type preview.url requires a valid absolute HTTPS URL in action data field "url"',
		);
	});

	it('should build structured copy action data from copyValue fallback', () => {
		const buttons = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						label: 'Copy',
						actionType: 'copy',
						actionDataInputMode: 'structured',
						copyValue: 'fallback copy value',
					},
				],
			},
			0,
			'buttons',
		);

		expect(buttons[0]).toEqual({
			label: 'Copy',
			action: {
				type: 'copy',
				data: { text: 'fallback copy value' },
			},
		});
	});

	it('should default actionDataInputMode by action type when omitted', () => {
		const copyButton = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						label: 'Copy',
						actionType: 'copy',
						actionData: { value: 'copied via default raw mode' },
					},
				],
			},
			0,
			'buttons',
		);
		expect(copyButton[0]).toEqual({
			label: 'Copy',
			action: { type: 'copy', data: { value: 'copied via default raw mode' } },
		});

		const openUrlButton = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						label: 'Open',
						actionType: 'open.url',
						openUrlWeb: 'https://example.com/default-structured',
					},
				],
			},
			0,
			'buttons',
		);
		expect(openUrlButton[0]).toEqual({
			label: 'Open',
			action: { type: 'open.url', data: { web: 'https://example.com/default-structured' } },
		});
	});

	it('should auto-generate unique key when generated key collides with an existing key', () => {
		const buttons = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						label: 'First',
						key: 'run_2',
						actionType: 'open.url',
						actionDataInputMode: 'raw',
						actionData: { web: 'https://example.com/1' },
					},
					{
						label: 'Run',
						actionType: 'open.url',
						actionDataInputMode: 'raw',
						actionData: { web: 'https://example.com/2' },
					},
				],
			},
			0,
			'buttons',
			{ autoGenerateButtonKey: true },
		);

		expect(buttons[0].key).toBe('run_2');
		expect(buttons[1].key).toBe('run_2_2');
	});

	it('should fall back to "button" slug when label has no alphanumeric characters', () => {
		const buttons = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						label: '!!!',
						actionType: 'open.url',
						actionDataInputMode: 'raw',
						actionData: { web: 'https://example.com/symbols' },
					},
				],
			},
			0,
			'buttons',
			{ autoGenerateButtonKey: true },
		);

		expect(buttons[0].key).toBe('button_1');
	});

	it('should throw for duplicate explicit structured keys', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'A',
							key: 'duplicate',
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com/1' },
						},
						{
							label: 'B',
							key: 'duplicate',
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com/2' },
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Button Key "duplicate" must be unique within the same button collection');
	});

	it('should preserve raw key behavior when auto generation is disabled', () => {
		const buttons = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						buttonInputMode: 'raw',
						rawButton: {
							label: 'Raw No Key',
							action: { type: 'open.url', data: { web: 'https://example.com/raw' } },
						},
					},
					{
						label: 'Structured',
						key: 'raw_no_key_1',
						actionType: 'open.url',
						actionDataInputMode: 'raw',
						actionData: { web: 'https://example.com/structured' },
					},
				],
			},
			0,
			'buttons',
			{ autoGenerateButtonKey: false },
		);

		expect(buttons[0].key).toBeUndefined();
		expect(buttons[1].key).toBe('raw_no_key_1');
	});

	it('should validate raw button max lengths and confirm type shape', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Raw',
								hint: 'h'.repeat(101),
								action: { type: 'open.url', data: { web: 'https://example.com' } },
							},
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Button Hint exceeds 100 characters');

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Raw',
								key: 'k'.repeat(101),
								action: { type: 'open.url', data: { web: 'https://example.com' } },
							},
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Button Key exceeds 100 characters');

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Raw',
								action: {
									type: 'open.url',
									data: { web: 'https://example.com' },
									confirm: 'invalid-confirm',
								},
							},
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Raw button at index 0 field "action.confirm" must be an object');
	});

	it('should require raw confirm title, input, and button_label fields', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Missing Title',
								action: {
									type: 'open.url',
									data: { web: 'https://example.com' },
									confirm: { input: 'Proceed?', button_label: 'Yes' },
								},
							},
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('buttons.button[0].action.confirm.title is required');

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Missing Input',
								action: {
									type: 'open.url',
									data: { web: 'https://example.com' },
									confirm: { title: 'Confirm', button_label: 'Yes' },
								},
							},
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('buttons.button[0].action.confirm.input is required');

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Missing Btn Label',
								action: {
									type: 'open.url',
									data: { web: 'https://example.com' },
									confirm: { title: 'Confirm', input: 'Proceed?' },
								},
							},
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('buttons.button[0].action.confirm.button_label is required');
	});

	it('should throw when structured key exceeds max length', () => {
		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							label: 'Open',
							key: 'k'.repeat(101),
							actionType: 'open.url',
							actionDataInputMode: 'raw',
							actionData: { web: 'https://example.com' },
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Button Key exceeds 100 characters');
	});

	it('should keep valid raw confirm object and enforce raw duplicate key uniqueness', () => {
		const validButtons = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						buttonInputMode: 'raw',
						rawButton: {
							label: 'Raw Confirm',
							key: 'raw-key-1',
							type: '+',
							action: {
								type: 'open.url',
								data: { web: 'https://example.com' },
								confirm: {
									title: 'Confirm',
									input: 'Proceed?',
									button_label: 'Yes',
								},
							},
						},
					},
				],
			},
			0,
			'buttons',
		);

		expect(validButtons[0]).toEqual({
			label: 'Raw Confirm',
			key: 'raw-key-1',
			type: '+',
			action: {
				type: 'open.url',
				data: { web: 'https://example.com' },
				confirm: {
					title: 'Confirm',
					input: 'Proceed?',
					button_label: 'Yes',
				},
			},
		});

		expect(() =>
			extractButtonsFromCollection(
				context,
				{
					button: [
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Raw A',
								key: 'raw-key',
								action: { type: 'open.url', data: { web: 'https://example.com/a' } },
							},
						},
						{
							buttonInputMode: 'raw',
							rawButton: {
								label: 'Raw B',
								key: 'raw-key',
								action: { type: 'open.url', data: { web: 'https://example.com/b' } },
							},
						},
					],
				},
				0,
				'buttons',
			),
		).toThrow('Raw button at index 1 has duplicate key "raw-key"');
	});

	it('should auto-generate a key for raw buttons when enabled and key is missing', () => {
		const buttons = extractButtonsFromCollection(
			context,
			{
				button: [
					{
						buttonInputMode: 'raw',
						rawButton: {
							label: 'Auto Raw',
							action: { type: 'open.url', data: { web: 'https://example.com' } },
						},
					},
				],
			},
			0,
			'buttons',
			{ autoGenerateButtonKey: true },
		);

		expect(buttons[0].key).toBe('auto_raw_1');
	});
});
