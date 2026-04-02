import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import {
	__testHelpers as richUiTestHelpers,
	buildEmojiInputProperties,
	buildReactionEmojiInputProperties,
	buildIconInputProperties,
	isKnownCliqEmojiShortcode,
	resolveAndValidateReactionInputs,
	resolveCliqIconValue,
	resolveEmojiCodeFromInputMode,
} from '../../../../../../nodes/ZohoCliq/v1/actions/shared/richUi';

function createExecuteContext(params: Record<string, unknown>): IExecuteFunctions {
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
			if (params[name] !== undefined) {
				return params[name];
			}
			return fallback;
		}),
		getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
	} as unknown as IExecuteFunctions;
}

describe('ZohoCliq - Shared - richUi', () => {
	it('should build emoji input properties with custom field metadata', () => {
		const properties = buildEmojiInputProperties({
			customEmojiFieldDescription: 'Custom emoji description',
			customEmojiFieldDisplayName: 'Custom Emoji',
			customEmojiFieldName: 'customEmoji',
		});

		expect(properties).toHaveLength(4);
		expect(properties[3]).toMatchObject({
			displayName: 'Custom Emoji',
			name: 'customEmoji',
			description: 'Custom emoji description',
		});
	});

	it('should build emoji input properties with default custom field metadata', () => {
		const properties = buildEmojiInputProperties({
			customEmojiFieldDescription: 'Default emoji description',
		});

		expect(properties[3]).toMatchObject({
			displayName: 'Emoji Code',
			name: 'emojiCode',
			description: 'Default emoji description',
		});
	});

	it('should build reaction emoji input properties with defaults', () => {
		const properties = buildReactionEmojiInputProperties({
			customEmojiFieldDescription: 'Reaction emoji description',
		});

		expect(properties[4]).toMatchObject({
			displayName: 'Emoji Code',
			name: 'emojiCode',
			description: 'Reaction emoji description',
		});
	});

	it('should build icon input properties with custom option names', () => {
		const properties = buildIconInputProperties({
			customIconFieldName: 'cardIcon',
			customIconFieldDisplayName: 'Card Icon',
			customIconFieldDescription: 'Card icon description',
			iconInputModeFieldName: 'cardIconInputMode',
			knownIconFieldName: 'cardKnownIconId',
			iconPickerFieldName: 'cardIconPicker',
		});

		expect(properties).toHaveLength(4);
		expect(properties[0]).toMatchObject({ name: 'cardIconInputMode' });
		expect(properties[1]).toMatchObject({ name: 'cardIconPicker' });
		expect(properties[2]).toMatchObject({ name: 'cardKnownIconId' });
		expect(properties[3]).toMatchObject({
			displayName: 'Card Icon',
			name: 'cardIcon',
			description: 'Card icon description',
		});
	});

	it('should build icon input properties with default option names', () => {
		const properties = buildIconInputProperties();

		expect(properties[0]).toMatchObject({ name: 'iconInputMode' });
		expect(properties[1]).toMatchObject({ name: 'iconPicker' });
		expect(properties[2]).toMatchObject({ name: 'knownIconId' });
		expect(properties[3]).toMatchObject({ name: 'icon', displayName: 'Icon' });
	});

	it('should build URL-only icon input properties without known icon option', () => {
		const properties = buildIconInputProperties({
			includeKnownIconOption: false,
			defaultInputMode: 'picker',
			customInputModeDisplayName: 'Custom URL',
		});
		const iconModeOptions = properties[0].options as Array<{ value: string }>;

		expect(properties).toHaveLength(3);
		expect(properties[0]).toMatchObject({ name: 'iconInputMode', default: 'picker' });
		expect(iconModeOptions.map((option) => option.value)).toEqual(['picker', 'custom']);
		expect(properties[2]).toMatchObject({ name: 'icon' });
	});

	it('should build iconify-first icon input properties without n8n picker', () => {
		const properties = buildIconInputProperties({
			includeKnownIconOption: false,
			includePickerOption: false,
			includeIconifyOption: true,
			defaultInputMode: 'iconify',
			iconifyFieldName: 'cardIconIconify',
			iconifyFieldDisplayName: 'Card Icon (Iconify Prefix/Icon)',
		});
		const iconModeOptions = properties[0].options as Array<{ value: string }>;

		expect(properties).toHaveLength(3);
		expect(iconModeOptions.map((option) => option.value)).toEqual(['iconify', 'custom']);
		expect(properties[1]).toMatchObject({ name: 'cardIconIconify' });
	});

	it('should not mention Iconify in description when iconify mode is disabled', () => {
		const withPicker = buildIconInputProperties({
			includeKnownIconOption: false,
			includePickerOption: true,
			includeIconifyOption: false,
		});
		expect(withPicker[0]).toMatchObject({
			description: 'Pick an n8n icon to map into a Lucide CDN URL, or provide a custom URL',
		});

		const noPicker = buildIconInputProperties({
			includeKnownIconOption: false,
			includePickerOption: false,
			includeIconifyOption: false,
		});
		expect(noPicker[0]).toMatchObject({ description: 'Provide a custom URL' });

		const mixedModes = buildIconInputProperties({
			includeKnownIconOption: true,
			includePickerOption: true,
			includeIconifyOption: true,
		});
		expect(mixedModes[0]).toMatchObject({
			description:
				'Pick an n8n icon to map into a Lucide CDN URL, or choose custom/known/Iconify modes',
		});
	});

	it('should describe picker mode with custom/iconify wording when known icons are disabled', () => {
		const properties = buildIconInputProperties({
			includeKnownIconOption: false,
			includePickerOption: true,
			includeIconifyOption: true,
		});

		expect(properties[0]).toMatchObject({
			description:
				'Pick an n8n icon to map into a Lucide CDN URL, or provide a custom or Iconify/Lucide URL',
		});
	});

	it('should describe non-picker mode with known icons when picker is disabled', () => {
		const properties = buildIconInputProperties({
			includeKnownIconOption: true,
			includePickerOption: false,
			includeIconifyOption: false,
		});

		expect(properties[0]).toMatchObject({
			description: 'Provide a custom URL or choose a known Cliq icon keyword',
		});
	});

	it('should cover icon description branches across picker/known/iconify combinations', () => {
		const combos = [
			{
				includePickerOption: true,
				includeKnownIconOption: false,
				includeIconifyOption: true,
				expected: 'custom or Iconify/Lucide URL',
			},
			{
				includePickerOption: true,
				includeKnownIconOption: false,
				includeIconifyOption: false,
				expected: 'provide a custom URL',
			},
			{
				includePickerOption: false,
				includeKnownIconOption: true,
				includeIconifyOption: false,
				expected: 'known Cliq icon keyword',
			},
			{
				includePickerOption: false,
				includeKnownIconOption: false,
				includeIconifyOption: true,
				expected: 'custom or Iconify/Lucide URL',
			},
		];

		for (const combo of combos) {
			const properties = buildIconInputProperties(combo);
			expect(String(properties[0].description)).toContain(combo.expected);
		}
	});

	it('should resolve icon input mode descriptions for all branch combinations', () => {
		expect(
			richUiTestHelpers.resolveIconInputModeDescription({
				includePickerOption: true,
				includeKnownIconOption: false,
				includeIconifyOption: true,
			}),
		).toContain('custom or Iconify/Lucide URL');

		expect(
			richUiTestHelpers.resolveIconInputModeDescription({
				includePickerOption: false,
				includeKnownIconOption: true,
				includeIconifyOption: false,
			}),
		).toContain('known Cliq icon keyword');
	});

	it('should identify known Cliq shortcodes', () => {
		expect(isKnownCliqEmojiShortcode(':smile:')).toBe(true);
		expect(isKnownCliqEmojiShortcode(':not-real:')).toBe(false);
	});

	it('should resolve emoji code from each input mode', () => {
		const context = createExecuteContext({
			unicodeEmoji: '✅',
			emojiShortcode: ':smile:',
			emojiCode: '🚀',
		});

		expect(resolveEmojiCodeFromInputMode(context, 0, 'unicodePicker')).toBe('✅');
		expect(resolveEmojiCodeFromInputMode(context, 0, 'picker')).toBe(':smile:');
		expect(resolveEmojiCodeFromInputMode(context, 0, 'custom')).toBe('🚀');
	});

	it('should throw for unsupported emoji input mode', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveEmojiCodeFromInputMode(context, 0, 'unsupported' as unknown as 'custom'),
		).toThrow('Unsupported emoji input mode: unsupported');
	});

	it('should resolve and validate reaction inputs for valid custom unicode emoji', () => {
		const context = createExecuteContext({});

		const resolved = resolveAndValidateReactionInputs(context, 0, {
			chatId: 'CT_123456',
			messageId: 'MSG_123456',
			emojiInputMode: 'custom',
			emojiCode: '😀',
		});

		expect(resolved).toEqual({
			sanitizedChatId: 'CT_123456',
			sanitizedMessageId: 'MSG_123456',
			sanitizedEmojiCode: '😀',
		});
	});

	it('should reject unknown shortcode in custom reaction input mode', () => {
		const context = createExecuteContext({});
		const fn = () =>
			resolveAndValidateReactionInputs(context, 0, {
				chatId: 'CT_123456',
				messageId: 'MSG_123456',
				emojiInputMode: 'custom',
				emojiCode: ':not-known-shortcode:',
			});

		expect(fn).toThrow(NodeOperationError);
		expect(fn).toThrow('Unknown Cliq shortcode');
	});

	it('should resolve known icon IDs in known mode', () => {
		const context = createExecuteContext({});
		const icon = resolveCliqIconValue(context, 0, {
			iconInputMode: 'known',
			knownIconId: 'tick',
		});

		expect(icon).toBe('tick');
	});

	it('should reject unknown icon IDs in known mode', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(context, 0, {
				iconInputMode: 'known',
				knownIconId: 'definitely-unknown-icon',
			}),
		).toThrow('icon.knownIconId must be one of the curated known icon IDs');
	});

	it('should reject invalid picker payload shape', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(context, 0, {
				iconInputMode: 'picker',
				iconPicker: 'not-an-object',
			}),
		).toThrow('icon.iconPicker must be a valid n8n icon selection');
	});

	it('should reject picker payload when icon value is missing', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(context, 0, {
				iconInputMode: 'picker',
				iconPicker: { type: 'icon' },
			}),
		).toThrow('icon.iconPicker.value is required');
	});

	it('should reject picker icon values with invalid characters', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(context, 0, {
				iconInputMode: 'picker',
				iconPicker: { type: 'icon', value: 'invalid/icon' },
			}),
		).toThrow('icon.iconPicker.value contains invalid characters');
	});

	it('should reject unsupported icon input mode', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(context, 0, {
				iconInputMode: 'unsupported',
			} as IDataObject),
		).toThrow('icon.iconInputMode must be one of: picker, custom, known');
	});

	it('should reject known icon mode when it is disabled for a context', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(
				context,
				0,
				{
					iconInputMode: 'known',
					knownIconId: 'tick',
				},
				{
					allowKnownMode: false,
				},
			),
		).toThrow('icon.iconInputMode does not support known icon IDs in this context');
	});

	it('should resolve iconify prefix/icon values to iconify API URLs', () => {
		const context = createExecuteContext({});
		const icon = resolveCliqIconValue(
			context,
			0,
			{
				iconInputMode: 'iconify',
				iconifyIcon: 'fluent-color/people-chat-48',
			},
			{
				allowIconifyMode: true,
				iconifyFieldName: 'iconifyIcon',
			},
		);

		expect(icon).toBe('https://api.iconify.design/fluent-color/people-chat-48.svg');
	});

	it('should reject iconify mode when iconify is disabled for this context', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(
				context,
				0,
				{
					iconInputMode: 'iconify',
					iconifyIcon: 'lucide/activity',
				},
				{
					allowIconifyMode: false,
					iconifyFieldName: 'iconifyIcon',
				},
			),
		).toThrow('icon.iconInputMode does not support iconify mode in this context');
	});

	it('should reject malformed iconify values when iconify mode is enabled', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(
				context,
				0,
				{
					iconInputMode: 'iconify',
					iconifyIcon: 'not-a-prefix-icon-value',
				},
				{
					allowIconifyMode: true,
					iconifyFieldName: 'iconifyIcon',
				},
			),
		).toThrow('icon.iconifyIcon must be in the format {prefix}/{icon}');
	});

	it('should include iconify in supported mode list when iconify is enabled', () => {
		const context = createExecuteContext({});

		expect(() =>
			resolveCliqIconValue(
				context,
				0,
				{
					iconInputMode: 'unsupported',
				} as IDataObject,
				{
					allowIconifyMode: true,
					allowKnownMode: false,
				},
			),
		).toThrow('icon.iconInputMode must be one of: picker, iconify, custom');
	});

	it('should return undefined for empty custom icon values', () => {
		const context = createExecuteContext({});

		const icon = resolveCliqIconValue(context, 0, {
			iconInputMode: 'custom',
			icon: '   ',
		});

		expect(icon).toBeUndefined();
	});
});
