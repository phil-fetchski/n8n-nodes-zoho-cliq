import type {
	IDataObject,
	IExecuteFunctions,
	INodeProperties,
	INodePropertyOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import {
	EMOJI_SHORTCODE_REGEX,
	validateChatId,
	validateEmojiCode,
	validateMessageId,
} from '../../helpers/utils';

const emojiShortcodes = [
	':smile:',
	':happy:',
	':joy:',
	':grinning:',
	':cool:',
	':love:',
	':curious:',
	':awe:',
	':thinking:',
	':search:',
	':idea:',
	':wink:',
	':razz:',
	':relaxed:',
	':peace:',
	':blush:',
	':yummy:',
	':yuck:',
	':sad:',
	':upset:',
	':anxious:',
	':worry:',
	':stressed-out:',
	':angry:',
	':tensed:',
	':tired:',
	':bored:',
	':sleepy:',
	':jealous:',
	':evil:',
	':facepalm:',
	':doubt:',
	':surprise:',
	':faint:',
	':headache:',
	':sick:',
	':injured:',
	':neutral:',
	':smirk:',
	':keep-quiet:',
	':feeling-warm:',
	':feeling-cold:',
	':thumbsup:',
	':thumbsdown:',
	':namaste:',
	':super:',
	':victory:',
	':yoyo:',
	':raising-hand:',
	':clap:',
	':hi:',
	':bye-bye:',
	':fist:',
	':biceps:',
	':bicycle:',
	':sports-bike:',
	':cruiser-bike:',
	':motor-scooter:',
	':car:',
	':taxi:',
	':bus:',
	':train:',
	':police-car:',
	':ambulance:',
	':fire-engine:',
	':aeroplane:',
	':passenger-ship:',
	':parking:',
	':cafeteria:',
	':garden:',
	':playground:',
	':home:',
	':office:',
	':library:',
	':auditorium:',
	':store:',
	':mail-room:',
	':pharmacy:',
	':gym:',
	':americas:',
	':europe-africa:',
	':asia-pacific:',
	':birthday:',
	':champagne:',
	':christmas-tree:',
	':eid-mubarak:',
	':fireworks:',
	':gift-box:',
	':kaaba:',
	':new-year:',
	':party:',
	':santa-hat:',
	':coffee-cup:',
	':food:',
	':chicken:',
	':fire:',
	':fire-extinguisher:',
	':first-aid-box:',
	':medicine:',
	':poop:',
	':peanuts:',
	':refugee-olympic-team:',
	':target:',
	':task:',
	':report:',
	':bug:',
	':milestone:',
	':calendar:',
	':security:',
	':processor:',
	':laptop:',
	':server:',
	':break-boy:',
	':break-girl:',
	':singing:',
	':man-dancing:',
	':man-cycling:',
	':man-running:',
	':man-swimming:',
	':woman-dancing:',
	':woman-cycling:',
	':woman-running:',
	':woman-swimming:',
	':yoga:',
	':badminton:',
	':baseball:',
	':basketball:',
	':chess:',
	':cricket:',
	':flag:',
	':foosball:',
	':football:',
	':golf:',
	':hockey:',
	':snooker:',
	':table-tennis:',
	':tennis:',
	':volleyball:',
	':gold-medal:',
	':silver-medal:',
	':bronze-medal:',
	':archer:',
	':boxer:',
	':badminton-player:',
	':basketball-player:',
	':batsman:',
	':batter:',
	':bowler:',
	':canoeing:',
	':chess-player:',
	':discus-throw:',
	':diver:',
	':equestrian:',
	':fencer:',
	':football-player:',
	':female-tennis-player:',
	':female-tabletennis-player:',
	':female-volleyball-player:',
	':golfer:',
	':gymnast:',
	':hockey-player:',
	':hammer-throw:',
	':hurdler:',
	':javelin-throw:',
	':judo:',
	':long-jump:',
	':pole-vault:',
	':athlete:',
	':rhythmic-gymnastics:',
	':shooter:',
	':shotput-throw:',
	':high-jump:',
	':karate:',
	':male-tabletennis-player:',
	':male-volleyball-player:',
	':male-tennis-player:',
	':pitcher:',
	':snooker-player:',
	':weightlifting:',
	':wrestling:',
] as const;

const KNOWN_ICON_IDS = [
	'wand',
	'room',
	'more',
	'calendar',
	'qr',
	'setting',
	'dashboard',
	'video',
	'bug',
	'light-bulb',
	'bell',
	'meeting',
	'mic',
	'sun',
	'moon',
	'form',
	'plug',
	'note',
	'heart',
	'upload',
	'finger-up',
	'smile',
	'organization',
	'headset',
	'clock',
	'image',
	'attachment',
	'app',
	'mail',
	'location-pin',
	'edit',
	'loud-speaker',
	'star',
	'globe',
	'eye',
	'thumbs-up',
	'lock',
	'home',
	'add',
	'code-snippet',
	'chat',
	'crown',
	'search',
	'delete',
	'add-user',
	'team',
	'bus',
	'url',
	'tick',
	'preview',
] as const;

const prettifyToken = (token: string): string =>
	token
		.split('-')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');

const knownCliqEmojiShortcodeSet = new Set<string>(emojiShortcodes);

const curatedUnicodeEmojiOptions: INodePropertyOptions[] = [
	{ name: 'Grinning Face', value: '😀' },
	{ name: 'Grinning Face With Big Eyes', value: '😃' },
	{ name: 'Grinning Face With Smiling Eyes', value: '😄' },
	{ name: 'Beaming Face With Smiling Eyes', value: '😁' },
	{ name: 'Grinning Squinting Face', value: '😆' },
	{ name: 'Grinning Face With Sweat', value: '😅' },
	{ name: 'Rolling on the Floor Laughing', value: '🤣' },
	{ name: 'Face With Tears of Joy', value: '😂' },
	{ name: 'Slightly Smiling Face', value: '🙂' },
	{ name: 'Upside-Down Face', value: '🙃' },
	{ name: 'Winking Face', value: '😉' },
	{ name: 'Smiling Face With Smiling Eyes', value: '😊' },
	{ name: 'Smiling Face With Halo', value: '😇' },
	{ name: 'Smiling Face With Hearts', value: '🥰' },
	{ name: 'Smiling Face With Heart-Eyes', value: '😍' },
	{ name: 'Star-Struck', value: '🤩' },
	{ name: 'Face Blowing a Kiss', value: '😘' },
	{ name: 'Kissing Face', value: '😗' },
	{ name: 'Kissing Face With Closed Eyes', value: '😚' },
	{ name: 'Kissing Face With Smiling Eyes', value: '😙' },
	{ name: 'Face Savoring Food', value: '😋' },
	{ name: 'Face With Tongue', value: '😛' },
	{ name: 'Winking Face With Tongue', value: '😜' },
	{ name: 'Zany Face', value: '🤪' },
	{ name: 'Squinting Face With Tongue', value: '😝' },
	{ name: 'Money-Mouth Face', value: '🤑' },
	{ name: 'Hugging Face', value: '🤗' },
	{ name: 'Face With Hand Over Mouth', value: '🤭' },
	{ name: 'Shushing Face', value: '🤫' },
	{ name: 'Thinking Face', value: '🤔' },
	{ name: 'Zipper-Mouth Face', value: '🤐' },
	{ name: 'Face With Raised Eyebrow', value: '🤨' },
	{ name: 'Neutral Face', value: '😐' },
	{ name: 'Expressionless Face', value: '😑' },
	{ name: 'Face Without Mouth', value: '😶' },
	{ name: 'Smirking Face', value: '😏' },
	{ name: 'Unamused Face', value: '😒' },
	{ name: 'Face With Rolling Eyes', value: '🙄' },
	{ name: 'Grimacing Face', value: '😬' },
	{ name: 'Lying Face', value: '🤥' },
	{ name: 'Relieved Face', value: '😌' },
	{ name: 'Pensive Face', value: '😔' },
	{ name: 'Sleepy Face', value: '😪' },
	{ name: 'Drooling Face', value: '🤤' },
	{ name: 'Sleeping Face', value: '😴' },
	{ name: 'Face With Medical Mask', value: '😷' },
	{ name: 'Face With Thermometer', value: '🤒' },
	{ name: 'Face With Head-Bandage', value: '🤕' },
	{ name: 'Nauseated Face', value: '🤢' },
	{ name: 'Face Vomiting', value: '🤮' },
	{ name: 'Sneezing Face', value: '🤧' },
	{ name: 'Hot Face', value: '🥵' },
	{ name: 'Cold Face', value: '🥶' },
	{ name: 'Woozy Face', value: '🥴' },
	{ name: 'Dizzy Face', value: '😵' },
	{ name: 'Exploding Head', value: '🤯' },
	{ name: 'Cowboy Hat Face', value: '🤠' },
	{ name: 'Partying Face', value: '🥳' },
	{ name: 'Smiling Face With Sunglasses', value: '😎' },
	{ name: 'Nerd Face', value: '🤓' },
	{ name: 'Face With Monocle', value: '🧐' },
	{ name: 'Confused Face', value: '😕' },
	{ name: 'Worried Face', value: '😟' },
	{ name: 'Slightly Frowning Face', value: '🙁' },
	{ name: 'Frowning Face', value: '☹️' },
	{ name: 'Face With Open Mouth', value: '😮' },
	{ name: 'Hushed Face', value: '😯' },
	{ name: 'Astonished Face', value: '😲' },
	{ name: 'Flushed Face', value: '😳' },
	{ name: 'Pleading Face', value: '🥺' },
	{ name: 'Frowning Face With Open Mouth', value: '😦' },
	{ name: 'Anguished Face', value: '😧' },
	{ name: 'Fearful Face', value: '😨' },
	{ name: 'Anxious Face With Sweat', value: '😰' },
	{ name: 'Sad but Relieved Face', value: '😥' },
	{ name: 'Crying Face', value: '😢' },
	{ name: 'Loudly Crying Face', value: '😭' },
	{ name: 'Face Screaming in Fear', value: '😱' },
	{ name: 'Confounded Face', value: '😖' },
	{ name: 'Persevering Face', value: '😣' },
	{ name: 'Disappointed Face', value: '😞' },
	{ name: 'Downcast Face With Sweat', value: '😓' },
	{ name: 'Weary Face', value: '😩' },
	{ name: 'Tired Face', value: '😫' },
	{ name: 'Yawning Face', value: '🥱' },
	{ name: 'Face With Steam From Nose', value: '😤' },
	{ name: 'Pouting Face', value: '😡' },
	{ name: 'Angry Face', value: '😠' },
	{ name: 'Face With Symbols on Mouth', value: '🤬' },
	{ name: 'Smiling Face With Horns', value: '😈' },
	{ name: 'Angry Face With Horns', value: '👿' },
	{ name: 'Skull', value: '💀' },
	{ name: 'Skull and Crossbones', value: '☠️' },
	{ name: 'Pile of Poo', value: '💩' },
	{ name: 'Clown Face', value: '🤡' },
	{ name: 'Ogre', value: '👹' },
	{ name: 'Goblin', value: '👺' },
	{ name: 'Ghost', value: '👻' },
	{ name: 'Alien', value: '👽' },
	{ name: 'Robot', value: '🤖' },
	{ name: 'Grinning Cat', value: '😺' },
	{ name: 'Grinning Cat With Smiling Eyes', value: '😸' },
	{ name: 'Cat With Tears of Joy', value: '😹' },
	{ name: 'Smiling Cat With Heart-Eyes', value: '😻' },
	{ name: 'Cat With Wry Smile', value: '😼' },
	{ name: 'Kissing Cat', value: '😽' },
	{ name: 'Weary Cat', value: '🙀' },
	{ name: 'Crying Cat', value: '😿' },
	{ name: 'Pouting Cat', value: '😾' },
	{ name: 'Thumbs Up', value: '👍' },
	{ name: 'Thumbs Down', value: '👎' },
	{ name: 'Oncoming Fist', value: '👊' },
	{ name: 'Raised Fist', value: '✊' },
	{ name: 'Left-Facing Fist', value: '🤛' },
	{ name: 'Right-Facing Fist', value: '🤜' },
	{ name: 'Clapping Hands', value: '👏' },
	{ name: 'Raising Hands', value: '🙌' },
	{ name: 'Folded Hands', value: '🙏' },
	{ name: 'Flexed Biceps', value: '💪' },
	{ name: 'Handshake', value: '🤝' },
	{ name: 'Sign of the Horns', value: '🤘' },
	{ name: 'OK Hand', value: '👌' },
	{ name: 'Victory Hand', value: '✌️' },
	{ name: 'Waving Hand', value: '👋' },
	{ name: 'Saluting Face', value: '🫡' },
	{ name: 'Red Heart', value: '❤️' },
	{ name: 'Orange Heart', value: '🧡' },
	{ name: 'Yellow Heart', value: '💛' },
	{ name: 'Green Heart', value: '💚' },
	{ name: 'Blue Heart', value: '💙' },
	{ name: 'Purple Heart', value: '💜' },
	{ name: 'Black Heart', value: '🖤' },
	{ name: 'Broken Heart', value: '💔' },
	{ name: 'Fire', value: '🔥' },
	{ name: 'Hundred Points', value: '💯' },
	{ name: 'Check Mark Button', value: '✅' },
	{ name: 'Cross Mark', value: '❌' },
	{ name: 'Warning', value: '⚠️' },
	{ name: 'Rocket', value: '🚀' },
	{ name: 'Party Popper', value: '🎉' },
	{ name: 'Direct Hit', value: '🎯' },
	{ name: 'Light Bulb', value: '💡' },
];

const emojiOptions: INodePropertyOptions[] = emojiShortcodes.map((shortcode) => {
	const token = shortcode.slice(1, -1);
	return {
		name: `${shortcode} (${prettifyToken(token)})`,
		value: shortcode,
	};
});

export function isKnownCliqEmojiShortcode(shortcode: string): boolean {
	return knownCliqEmojiShortcodeSet.has(shortcode.trim());
}

const knownIconSet = new Set<string>(KNOWN_ICON_IDS);

const iconOptions: INodePropertyOptions[] = KNOWN_ICON_IDS.map((iconId) => ({
	name: `${iconId} (${prettifyToken(iconId)})`,
	value: iconId,
}));

export const cliqKnownIconIds = KNOWN_ICON_IDS;
export const cliqKnownIconOptions = iconOptions;

export function isKnownCliqIconId(iconId: string): boolean {
	return knownIconSet.has(iconId.trim());
}

type EmojiInputMode = 'unicodePicker' | 'custom' | 'picker';

export function resolveEmojiCodeFromInputMode(
	context: IExecuteFunctions,
	itemIndex: number,
	emojiInputMode: EmojiInputMode,
): string {
	switch (emojiInputMode) {
		case 'unicodePicker':
			return context.getNodeParameter('unicodeEmoji', itemIndex, '😀') as string;
		case 'picker':
			return context.getNodeParameter('emojiShortcode', itemIndex, ':smile:') as string;
		case 'custom':
			return context.getNodeParameter('emojiCode', itemIndex) as string;
		default:
			throw new Error(`Unsupported emoji input mode: ${String(emojiInputMode)}`);
	}
}

export function resolveAndValidateReactionInputs(
	context: IExecuteFunctions,
	itemIndex: number,
	rawInputs: {
		chatId: string;
		messageId: string;
		emojiInputMode: EmojiInputMode;
		emojiCode: string;
	},
	options?: {
		skipChatValidation?: boolean;
		skipMessageValidation?: boolean;
	},
): {
	sanitizedChatId: string;
	sanitizedMessageId: string;
	sanitizedEmojiCode: string;
} {
	const sanitizedChatId = options?.skipChatValidation
		? rawInputs.chatId
		: validateChatId(context, rawInputs.chatId, itemIndex);
	const sanitizedMessageId = options?.skipMessageValidation
		? rawInputs.messageId
		: validateMessageId(context, rawInputs.messageId, itemIndex);
	const sanitizedEmojiCode = validateEmojiCode(context, rawInputs.emojiCode, itemIndex);
	const isShortcode = EMOJI_SHORTCODE_REGEX.test(sanitizedEmojiCode);

	if (
		rawInputs.emojiInputMode === 'custom' &&
		isShortcode &&
		!isKnownCliqEmojiShortcode(sanitizedEmojiCode)
	) {
		throw new NodeOperationError(
			context.getNode(),
			`Unknown Cliq shortcode "${sanitizedEmojiCode}". Use "Pick Cliq Shortcode" for known entries or provide Unicode emoji.`,
			{ itemIndex },
		);
	}

	return { sanitizedChatId, sanitizedMessageId, sanitizedEmojiCode };
}

export function buildEmojiInputProperties(options: {
	customEmojiFieldDescription: string;
	customEmojiFieldDisplayName?: string;
	customEmojiFieldName?: string;
}): INodeProperties[] {
	const {
		customEmojiFieldDescription,
		customEmojiFieldDisplayName = 'Emoji Code',
		customEmojiFieldName = 'emojiCode',
	} = options;

	return [
		{
			displayName: 'Emoji Input Mode',
			name: 'emojiInputMode',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Pick Curated Unicode Emoji', value: 'unicodePicker' },
				{ name: 'Custom (Shortcode or Unicode)', value: 'custom' },
				{ name: 'Pick Cliq Shortcode', value: 'picker' },
			],
			default: 'unicodePicker',
			description: 'Choose whether to enter a custom emoji or pick a known Cliq shortcode',
		},
		{
			displayName: 'Unicode Emoji',
			name: 'unicodeEmoji',
			type: 'options',
			options: curatedUnicodeEmojiOptions,
			default: '😀',
			displayOptions: {
				show: {
					emojiInputMode: ['unicodePicker'],
				},
			},
			description: 'Curated Unicode emoji list for Cliq messages and reactions',
		},
		{
			displayName: 'Emoji Shortcode',
			name: 'emojiShortcode',
			type: 'options',
			options: emojiOptions,
			default: ':smile:',
			displayOptions: {
				show: {
					emojiInputMode: ['picker'],
				},
			},
			description: 'Known Cliq emoji shortcode list',
		},
		{
			displayName: customEmojiFieldDisplayName,
			name: customEmojiFieldName,
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. :smile:',
			displayOptions: {
				show: {
					emojiInputMode: ['custom'],
				},
			},
			description: customEmojiFieldDescription,
		},
	];
}

function resolveIconInputModeDescription(options: {
	includePickerOption: boolean;
	includeKnownIconOption: boolean;
	includeIconifyOption: boolean;
}): string {
	const { includePickerOption, includeKnownIconOption, includeIconifyOption } = options;

	if (includePickerOption) {
		if (includeKnownIconOption) {
			if (includeIconifyOption) {
				return 'Pick an n8n icon to map into a Lucide CDN URL, or choose custom/known/Iconify modes';
			}
			return 'Pick an n8n icon to map into a Lucide CDN URL, or choose custom/known modes';
		}
		if (includeIconifyOption) {
			return 'Pick an n8n icon to map into a Lucide CDN URL, or provide a custom or Iconify/Lucide URL';
		}
		return 'Pick an n8n icon to map into a Lucide CDN URL, or provide a custom URL';
	}

	if (includeKnownIconOption) {
		return 'Provide a custom URL or choose a known Cliq icon keyword';
	}
	if (includeIconifyOption) {
		return 'Provide a custom or Iconify/Lucide URL';
	}
	return 'Provide a custom URL';
}

export function buildReactionEmojiInputProperties(options: {
	customEmojiFieldDescription: string;
	customEmojiFieldDisplayName?: string;
	customEmojiFieldName?: string;
}): INodeProperties[] {
	const {
		customEmojiFieldDescription,
		customEmojiFieldDisplayName = 'Emoji Code',
		customEmojiFieldName = 'emojiCode',
	} = options;

	return [
		{
			displayName: 'Emoji Input Mode',
			name: 'emojiInputMode',
			type: 'options',
			noDataExpression: true,
			options: [
				{ name: 'Pick Curated Unicode Emoji', value: 'unicodePicker' },
				{ name: 'Custom (Shortcode or Unicode)', value: 'custom' },
				{ name: 'Pick Cliq Shortcode', value: 'picker' },
			],
			default: 'unicodePicker',
			description: 'Use direct Unicode emoji or Cliq shortcodes like :smile:',
		},
		{
			displayName: 'Unicode Emoji',
			name: 'unicodeEmoji',
			type: 'options',
			options: curatedUnicodeEmojiOptions,
			default: '😀',
			displayOptions: {
				show: {
					emojiInputMode: ['unicodePicker'],
				},
			},
			description: 'Curated Unicode emoji list for Cliq messages and reactions',
		},
		{
			displayName:
				'Tip: On macOS/Windows, open your device emoji picker directly from the input field. Right-click the field and choose Emoji/Emoji & Symbols (or use keyboard shortcut).',
			name: 'customEmojiInputNotice',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					emojiInputMode: ['custom'],
				},
			},
		},
		{
			displayName: 'Emoji Shortcode',
			name: 'emojiShortcode',
			type: 'options',
			options: emojiOptions,
			default: ':smile:',
			displayOptions: {
				show: {
					emojiInputMode: ['picker'],
				},
			},
			description: 'Known Cliq emoji shortcode list',
		},
		{
			displayName: customEmojiFieldDisplayName,
			name: customEmojiFieldName,
			type: 'string',
			default: '',
			required: true,
			placeholder: 'e.g. :smile:',
			displayOptions: {
				show: {
					emojiInputMode: ['custom'],
				},
			},
			description: customEmojiFieldDescription,
		},
	];
}

export function buildIconInputProperties(
	options: {
		customIconFieldName?: string;
		customIconFieldDisplayName?: string;
		customIconFieldDescription?: string;
		iconifyFieldName?: string;
		iconifyFieldDisplayName?: string;
		iconifyFieldDescription?: string;
		iconInputModeFieldName?: string;
		knownIconFieldName?: string;
		iconPickerFieldName?: string;
		defaultInputMode?: 'picker' | 'custom' | 'known' | 'iconify';
		includeKnownIconOption?: boolean;
		includePickerOption?: boolean;
		includeIconifyOption?: boolean;
		iconifyInputModeDisplayName?: string;
		customInputModeDisplayName?: string;
	} = {},
): INodeProperties[] {
	/* c8 ignore next */
	/* istanbul ignore next */
	const {
		customIconFieldName = 'icon',
		customIconFieldDisplayName = 'Icon',
		customIconFieldDescription = 'Icon keyword or URL',
		iconifyFieldName = 'iconifyIcon',
		iconifyFieldDisplayName = 'Iconify Icon ({prefix}/{icon})',
		iconifyFieldDescription = 'Paste Iconify identifier in the format {prefix}/{icon}',
		iconInputModeFieldName = 'iconInputMode',
		knownIconFieldName = 'knownIconId',
		iconPickerFieldName = 'iconPicker',
		defaultInputMode = 'custom',
		includeKnownIconOption = true,
		includePickerOption = true,
		includeIconifyOption = false,
		iconifyInputModeDisplayName = 'Iconify Icon ({prefix}/{icon})',
		customInputModeDisplayName = 'Custom Keyword or URL',
	} = options;

	const iconInputModeOptions: Array<{ name: string; value: string }> = [];

	if (includeIconifyOption) {
		iconInputModeOptions.push({ name: iconifyInputModeDisplayName, value: 'iconify' });
	}
	if (includePickerOption) {
		iconInputModeOptions.push({ name: 'Pick N8N Icon (Lucide URL)', value: 'picker' });
	}
	iconInputModeOptions.push({ name: customInputModeDisplayName, value: 'custom' });

	if (includeKnownIconOption) {
		iconInputModeOptions.push({ name: 'Known Cliq Icon', value: 'known' });
	}

	const properties: INodeProperties[] = [
		{
			displayName: 'Icon Input Mode',
			name: iconInputModeFieldName,
			type: 'options',
			noDataExpression: true,
			options: iconInputModeOptions,
			default: defaultInputMode,
			description: resolveIconInputModeDescription({
				includePickerOption,
				includeKnownIconOption,
				includeIconifyOption,
			}),
		},
	];

	if (includeIconifyOption) {
		properties.push({
			displayName: iconifyFieldDisplayName,
			name: iconifyFieldName,
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					[iconInputModeFieldName]: ['iconify'],
				},
			},
			description: iconifyFieldDescription,
		});
	}

	if (includePickerOption) {
		properties.push({
			displayName: 'N8N Icon Picker',
			name: iconPickerFieldName,
			type: 'icon',
			default: { type: 'icon', value: 'smile' },
			displayOptions: {
				show: {
					[iconInputModeFieldName]: ['picker'],
				},
			},
			description: 'Selected icon is converted to a Lucide URL via Iconify CDN',
		});
	}

	if (includeKnownIconOption) {
		properties.push({
			displayName: 'Known Icon',
			name: knownIconFieldName,
			type: 'options',
			options: iconOptions,
			default: 'url',
			displayOptions: {
				show: {
					[iconInputModeFieldName]: ['known'],
				},
			},
			description: 'Cliq icon keywords from docs plus observed extras (tick, preview)',
		});
	}

	properties.push({
		displayName: customIconFieldDisplayName,
		name: customIconFieldName,
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				[iconInputModeFieldName]: ['custom'],
			},
		},
		description: customIconFieldDescription,
	});

	return properties;
}

type ResolveCliqIconOptions = {
	modeFieldName?: string;
	pickerFieldName?: string;
	knownFieldName?: string;
	customFieldName?: string;
	iconifyFieldName?: string;
	pathPrefix?: string;
	defaultMode?: 'picker' | 'custom' | 'known' | 'iconify';
	allowKnownMode?: boolean;
	allowIconifyMode?: boolean;
};

function asTrimmedString(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}

	const normalized = String(value).trim();
	return normalized.length > 0 ? normalized : undefined;
}

function normalizeLucideIconName(iconName: string): string {
	return iconName
		.trim()
		.toLowerCase()
		.replace(/[_\s]+/g, '-');
}

export function resolveCliqIconValue(
	context: IExecuteFunctions,
	itemIndex: number,
	entry: IDataObject,
	options: ResolveCliqIconOptions = {},
): string | undefined {
	const {
		modeFieldName = 'iconInputMode',
		pickerFieldName = 'iconPicker',
		knownFieldName = 'knownIconId',
		customFieldName = 'icon',
		iconifyFieldName = 'iconifyIcon',
		pathPrefix = 'icon',
		defaultMode = 'custom',
		allowKnownMode = true,
		allowIconifyMode = false,
	} = options;

	const mode = asTrimmedString(entry[modeFieldName]) ?? defaultMode;

	if (mode === 'known') {
		if (!allowKnownMode) {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${modeFieldName} does not support known icon IDs in this context`,
				{ itemIndex },
			);
		}
		const knownIconId = asTrimmedString(entry[knownFieldName]);
		if (!knownIconId || !knownIconSet.has(knownIconId)) {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${knownFieldName} must be one of the curated known icon IDs`,
				{ itemIndex },
			);
		}
		return knownIconId;
	}

	if (mode === 'custom') {
		return asTrimmedString(entry[customFieldName]);
	}

	if (mode === 'iconify') {
		if (!allowIconifyMode) {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${modeFieldName} does not support iconify mode in this context`,
				{ itemIndex },
			);
		}
		const iconifyValue = asTrimmedString(entry[iconifyFieldName]);
		if (!iconifyValue) {
			return undefined;
		}
		const match = iconifyValue.match(/^([a-z0-9-]+)\/([a-z0-9._-]+)$/i);
		if (!match) {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${iconifyFieldName} must be in the format {prefix}/{icon}`,
				{ itemIndex },
			);
		}
		const [, prefix, iconName] = match;
		return `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(iconName)}.svg`;
	}

	if (mode === 'picker') {
		const pickerValue = entry[pickerFieldName];
		if (!pickerValue || typeof pickerValue !== 'object') {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${pickerFieldName} must be a valid n8n icon selection`,
				{ itemIndex },
			);
		}

		const picker = pickerValue as IDataObject;
		const pickerType = asTrimmedString(picker.type);
		const pickerName = asTrimmedString(picker.value);

		if (!pickerName) {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${pickerFieldName}.value is required`,
				{ itemIndex },
			);
		}

		if (pickerType !== 'icon') {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${pickerFieldName} must be an icon selection (not emoji)`,
				{ itemIndex },
			);
		}

		const lucideIcon = normalizeLucideIconName(pickerName);
		if (!/^[a-z0-9-]+$/.test(lucideIcon)) {
			throw new NodeOperationError(
				context.getNode(),
				`${pathPrefix}.${pickerFieldName}.value contains invalid characters`,
				{ itemIndex },
			);
		}

		return `https://api.iconify.design/lucide/${encodeURIComponent(lucideIcon)}.svg`;
	}

	const supportedModes: string[] = ['custom'];
	if (allowIconifyMode) {
		supportedModes.unshift('iconify');
	}
	supportedModes.unshift('picker');
	if (allowKnownMode) {
		supportedModes.push('known');
	}
	throw new NodeOperationError(
		context.getNode(),
		`${pathPrefix}.${modeFieldName} must be one of: ${supportedModes.join(', ')}`,
		{ itemIndex },
	);
}

export const __testHelpers = Object.freeze({
	resolveIconInputModeDescription,
});
