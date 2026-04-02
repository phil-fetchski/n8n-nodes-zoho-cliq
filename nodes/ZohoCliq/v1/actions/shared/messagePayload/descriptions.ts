import type { INodeProperties } from 'n8n-workflow';
import { richTextMaxLength, textSlideMaxLength } from './constants';
import { createSlideCollectionValues } from './slideCollectionValues';
import { buildIconInputProperties } from '../richUi';

const buttonCollectionValues: INodeProperties[] = [
	{
		displayName: 'Button Input Mode',
		name: 'buttonInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using JSON', value: 'raw' },
			{ name: 'Using Fields Below', value: 'structured' },
		],
		default: 'structured',
	},
	{
		displayName: 'Button JSON',
		name: 'rawButton',
		type: 'json',
		default: '{}',
		description: 'Raw button object including label/action',
		displayOptions: { show: { buttonInputMode: ['raw'] } },
	},
	{
		displayName: 'Action Type',
		name: 'actionType',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Copy', value: 'copy' },
			{ name: 'Invoke Function', value: 'invoke.function' },
			{ name: 'Open URL', value: 'open.url' },
			{ name: 'Preview URL', value: 'preview.url' },
			{ name: 'System API', value: 'system.api' },
		],
		default: 'open.url',
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName: 'Action Data Input Mode',
		name: 'actionDataInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using Fields Below', value: 'structured' },
			{ name: 'Using JSON', value: 'raw' },
		],
		default: 'structured',
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName: 'Action Data JSON',
		name: 'actionData',
		type: 'json',
		default: '{}',
		description: 'Using JSON object payload for action.data',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['raw'],
			},
		},
	},
	{
		displayName: 'Include',
		name: 'enabled',
		type: 'boolean',
		default: true,
		description: 'Whether to include this button. Supports expressions for IF-like behavior.',
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName: 'Label',
		name: 'label',
		type: 'string',
		typeOptions: { maxLength: 20 },
		default: '',
		required: true,
		description: 'Button label (max 20 characters)',
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName:
			'Pro Tip: The most reliable way to add an icon in a button is to use an emoji in Label (for example: <code>💾 Save</code>).',
		name: 'openUrlEmojiLabelNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionType: ['open.url'],
			},
		},
	},
	{
		displayName: 'Hint',
		name: 'hint',
		type: 'string',
		typeOptions: { maxLength: 100 },
		default: '',
		description: 'Tooltip text shown on hover (max 100 characters)',
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName: 'Key',
		name: 'key',
		type: 'string',
		typeOptions: { maxLength: 100 },
		default: '',
		description:
			'Unique key for button clicks. If empty, one is auto-generated from label and button number.',
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName: 'Type',
		name: 'type',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Neutral', value: '' },
			{ name: 'Positive (+)', value: '+' },
			{ name: 'Negative (-)', value: '-' },
		],
		default: '',
		description: 'Neutral omits button.type; Positive/Negative use + or -',
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName: 'Web URL',
		name: 'openUrlWeb',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['open.url'],
			},
		},
	},
	{
		displayName: 'Add iOS Specific URL',
		name: 'addOpenUrlIos',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['open.url'],
			},
		},
	},
	{
		displayName: 'iOS URL',
		name: 'openUrlIos',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['open.url'],
				addOpenUrlIos: [true],
			},
		},
	},
	{
		displayName: 'Add Android Specific URL',
		name: 'addOpenUrlAndroid',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['open.url'],
			},
		},
	},
	{
		displayName: 'Android URL',
		name: 'openUrlAndroid',
		type: 'string',
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['open.url'],
				addOpenUrlAndroid: [true],
			},
		},
	},
	{
		displayName: 'System API',
		name: 'systemApiAction',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Audio Call', value: 'audiocall' },
			{ name: 'Contact Invite', value: 'invite' },
			{ name: 'Location Access', value: 'locationpermission' },
			{ name: 'Start Chat', value: 'startchat' },
			{ name: 'Video Call', value: 'videocall' },
		],
		default: 'startchat',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['system.api'],
			},
		},
	},
	{
		displayName: 'User ID (ZUID)',
		name: 'systemApiUserId',
		type: 'string',
		default: '',
		description: 'Used as &lt;system_action&gt;/&lt;zuid&gt; for system.api actions',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['system.api'],
				systemApiAction: ['audiocall', 'videocall', 'startchat', 'invite'],
			},
		},
	},
	{
		displayName: 'Deluge Function Name',
		name: 'invokeFunctionName',
		type: 'string',
		default: '',
		required: true,
		description: 'Must match an existing Cliq Deluge function name',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['invoke.function'],
			},
		},
	},
	{
		displayName: 'Copy Text',
		name: 'copyText',
		type: 'string',
		default: '',
		required: true,
		description: 'Text/value copied to clipboard when clicked',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['copy'],
			},
		},
	},
	{
		displayName: 'Preview URL',
		name: 'previewUrl',
		type: 'string',
		default: '',
		required: true,
		description: 'Absolute URL opened for preview',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['preview.url'],
			},
		},
	},
	{
		displayName:
			'Function Name must be a real Deluge function already configured in Zoho Cliq. Do not use a made-up name.',
		name: 'invokeFunctionNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				actionDataInputMode: ['structured'],
				actionType: ['invoke.function'],
			},
		},
	},
	{
		displayName: 'Enable Confirmation Dialog',
		name: 'enableConfirm',
		type: 'boolean',
		default: false,
		displayOptions: { show: { buttonInputMode: ['structured'] } },
	},
	{
		displayName: 'Confirm Title',
		name: 'confirmTitle',
		type: 'string',
		typeOptions: { maxLength: 100 },
		default: '',
		required: true,
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				enableConfirm: [true],
			},
		},
	},
	{
		displayName: 'Confirm Description',
		name: 'confirmDescription',
		type: 'string',
		typeOptions: { maxLength: 100 },
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				enableConfirm: [true],
			},
		},
	},
	{
		displayName: 'Confirm Input Prompt',
		name: 'confirmInput',
		type: 'string',
		typeOptions: { maxLength: 300 },
		default: '',
		required: true,
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				enableConfirm: [true],
			},
		},
	},
	{
		displayName: 'Confirm Button Label',
		name: 'confirmButtonLabel',
		type: 'string',
		typeOptions: { maxLength: 100 },
		default: '',
		required: true,
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				enableConfirm: [true],
			},
		},
	},
	{
		displayName: 'Cancel Button Label',
		name: 'confirmCancelButtonLabel',
		type: 'string',
		typeOptions: { maxLength: 100 },
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				enableConfirm: [true],
			},
		},
	},
	{
		displayName: 'Confirm Emotion',
		name: 'confirmEmotion',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'API Default (Positive)', value: '' },
			{ name: 'Positive', value: 'positive' },
			{ name: 'Neutral', value: 'neutral' },
			{ name: 'Negative', value: 'negative' },
		],
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				enableConfirm: [true],
			},
		},
	},
	{
		displayName: 'Confirm Mandatory Input',
		name: 'confirmMandatory',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'API Default', value: '' },
			{ name: 'True', value: 'true' },
			{ name: 'False', value: 'false' },
		],
		default: '',
		displayOptions: {
			show: {
				buttonInputMode: ['structured'],
				enableConfirm: [true],
			},
		},
	},
];

function applyParentDisplayOptions(
	property: INodeProperties,
	parentShow: Record<string, string[] | boolean[]>,
): INodeProperties {
	return {
		...property,
		displayOptions: {
			show: {
				...parentShow,
				...(property.displayOptions?.show ?? {}),
			},
		},
	};
}

function applyDisplayNameOverrides(
	property: INodeProperties,
	displayNameOverrides: Record<string, string>,
): INodeProperties {
	const override = displayNameOverrides[property.name];
	if (!override) {
		return property;
	}

	return {
		...property,
		displayName: override,
	};
}

export const messagePayloadDescription: INodeProperties[] = [
	{
		displayName: 'Message Type',
		name: 'messageType',
		type: 'options',
		options: [
			{ name: 'Text (Cliq Markdown)', value: 'text' },
			{ name: 'Rich/Card', value: 'rich' },
			{ name: 'Advanced (JSON)', value: 'json' },
		],
		default: 'text',
		description:
			'Choose how to provide the outgoing message. AI Tool setups should use Text (Cliq Markdown) for normal messages or Advanced (JSON) for card/message-object payloads.',
	},
	{
		displayName: 'Post as Bot',
		name: 'postAsBot',
		type: 'boolean',
		default: false,
		description: 'Whether to post this message as a bot',
	},
	{
		displayName: 'Bot Display Name',
		name: 'botDisplayName',
		type: 'string',
		default: '',
		description: 'Optional value for bot.name in the outgoing payload when posting as a bot',
		displayOptions: { show: { postAsBot: [true] } },
	},
	{
		displayName: 'Bot Unique Name',
		name: 'botUniqueName',
		type: 'string',
		default: '',
		required: true,
		description: 'Unique bot name used for the bot_unique_name query parameter',
		displayOptions: { show: { postAsBot: [true] } },
	},
	{
		displayName: 'Bot Image URL',
		name: 'botImage',
		type: 'string',
		default: '',
		description: 'Optional value for bot.image in the outgoing payload when posting as a bot',
		displayOptions: { show: { postAsBot: [true] } },
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		typeOptions: { rows: 4 },
		default: '',
		required: true,
		displayOptions: { show: { messageType: ['text'] } },
	},
	{
		displayName: 'Show Cliq Markdown Guidance',
		name: 'showCliqMarkdownGuidance',
		type: 'boolean',
		default: false,
		noDataExpression: true,
		description: 'Whether to show Zoho Cliq markdown examples',
		displayOptions: { show: { messageType: ['text'] } },
	},
	{
		displayName:
			'Zoho Cliq Markdown Support:<ul><li><code>*bold*</code></li><li><code># H1</code></li><li><code>### H3</code></li><li><code>_italics_</code></li><li><code>~strike~</code></li><li><code>__underline__</code></li><li><code>`quote`</code></li><li><code>!blockquote</code></li><li><code>[text](URL)</code></li><li><code>```code```</code></li><li><code>---</code> (horizontal line)</li></ul>',
		name: 'plainTextMarkdownNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				messageType: ['text'],
				showCliqMarkdownGuidance: [true],
			},
		},
	},
	{
		displayName: 'Add a Mention',
		name: 'addMention',
		type: 'boolean',
		default: false,
		description: 'Whether to add guided mention tokens to the text message',
		displayOptions: { show: { messageType: ['text'] } },
	},
	{
		displayName: 'Mention Insert Mode',
		name: 'mentionInsertMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Append to Text', value: 'append' },
			{ name: 'Prepend to Text', value: 'prepend' },
		],
		default: 'append',
		displayOptions: {
			show: {
				messageType: ['text'],
				addMention: [true],
			},
		},
	},
	{
		displayName:
			'Mentions Tip: Manual mention syntax is fully supported (for example <code>{@{{ $json.userId }}}</code>). Guided mentions are added directly into Text.',
		name: 'mentionsGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				messageType: ['text'],
				addMention: [true],
			},
		},
	},
	{
		displayName: 'Mentions',
		name: 'mentions',
		type: 'fixedCollection',
		placeholder: 'Add Mention',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: {
			show: {
				messageType: ['text'],
				addMention: [true],
			},
		},
		options: [
			{
				name: 'mention',
				displayName: 'Mention',
				values: [
					{
						displayName: 'Mention Type',
						name: 'mentionType',
						type: 'options',
						noDataExpression: true,
						options: [
							{
								name: 'All Participants in Channel',
								value: 'participants',
								description: 'Mention token syntax: {@participants}',
							},
							{
								name: 'Available Users in Channel',
								value: 'available',
								description: 'Mention token syntax: {@available}',
							},
							{ name: 'Channel ({#CHANNEL_ID})', value: 'channel' },
							{
								name: 'Silent User ([Name](zohoid:ID) / [Name](mail:EMAIL))',
								value: 'silentUser',
							},
							{ name: 'Team ({@GTEAM_ID})', value: 'team' },
							{ name: 'User ({@USER_ID} / {@EMAIL})', value: 'user' },
						],
						default: 'user',
					},
					{
						displayName: 'Silent User Display Name',
						name: 'silentUserName',
						type: 'string',
						default: '',
						placeholder: 'e.g. Jordan Smith',
						description: 'Text label shown for the silent mention',
						displayOptions: {
							show: {
								mentionType: ['silentUser'],
							},
						},
					},
					{
						displayName: 'Silent User Input Type',
						name: 'silentUserInputType',
						type: 'options',
						noDataExpression: true,
						options: [
							{ name: 'User ID (ZohoID)', value: 'zohoid' },
							{ name: 'Email (Mail)', value: 'mail' },
						],
						default: 'zohoid',
						displayOptions: {
							show: {
								mentionType: ['silentUser'],
							},
						},
					},
					{
						displayName: 'Silent User Value',
						name: 'silentUserValue',
						type: 'string',
						default: '',
						placeholder: 'e.g. 873421 or user@example.com',
						description: 'User ID or email for the silent mention target',
						displayOptions: {
							show: {
								mentionType: ['silentUser'],
							},
						},
					},
					{
						displayName: 'Target Channel ID',
						name: 'channelId',
						type: 'string',
						default: '',
						placeholder: 'e.g. 12345678901234567',
						description: 'Channel ID used in {#channel_id}',
						displayOptions: {
							show: {
								mentionType: ['channel'],
							},
						},
					},
					{
						displayName: 'Team ID',
						name: 'teamId',
						type: 'string',
						default: '',
						placeholder: 'e.g. G123456789',
						description: 'Team ID used in {@Gteam_id}',
						displayOptions: {
							show: {
								mentionType: ['team'],
							},
						},
					},
					{
						displayName: 'User ID or Email',
						name: 'userIdOrEmail',
						type: 'string',
						default: '',
						placeholder: 'e.g. 667356693 or user@example.com',
						description: 'User ID (ZUID) or email',
						displayOptions: {
							show: {
								mentionType: ['user'],
							},
						},
					},
				],
			},
		],
	},
	{
		displayName:
			'Build with Zoho Cliq Card Builder Playground: <a href="https://cliq.zoho.com/messagebuilder" target="_blank" rel="noopener noreferrer">Open Message Builder</a>. Use Include fields with expressions for IF logic.',
		name: 'cardBuilderNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { messageType: ['rich'] } },
	},
	{
		displayName: 'Card Input Mode',
		name: 'cardInputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Using JSON', value: 'raw' },
			{ name: 'Using Fields Below', value: 'structured' },
		],
		default: 'structured',
		description: 'Choose how to define the card payload',
		displayOptions: { show: { messageType: ['rich'] } },
	},
	{
		displayName: 'Card Theme',
		name: 'cardTheme',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Basic', value: 'basic' },
			{ name: 'Modern Inline', value: 'modern-inline' },
			{ name: 'Poll', value: 'poll' },
			{ name: 'Prompt', value: 'prompt' },
		],
		default: 'modern-inline',
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
	},
	{
		displayName: 'Card Title',
		name: 'cardTitle',
		type: 'string',
		default: '',
		description: 'Optional message title, rendered to the right of Card Icon when included',
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
	},
	{
		displayName: 'Card Payload JSON',
		name: 'richPayloadJson',
		type: 'json',
		default:
			'{ "text": "Hello from n8n", "card": { "title": "Card title", "theme": "modern-inline" } }',
		description: 'Full rich payload object (for example: text, card, slides, buttons)',
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['raw'] } },
	},
	{
		displayName: 'Card Text',
		name: 'richText',
		type: 'string',
		typeOptions: { rows: 3, maxLength: richTextMaxLength },
		default: '',
		description: 'Top-level card text sent in payload.text (max 4096 chars)',
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
	},
	{
		displayName: 'Add Card Icon',
		name: 'addCardIcon',
		type: 'boolean',
		default: false,
		description:
			'Whether to add a small 16x16 icon at the top-left of the card, inline with the card title',
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
	},
	...buildIconInputProperties({
		iconInputModeFieldName: 'cardIconInputMode',
		knownIconFieldName: 'cardKnownIconId',
		iconifyFieldName: 'cardIconIconify',
		customIconFieldName: 'cardIcon',
		iconifyFieldDisplayName: 'Card Icon (Iconify Prefix/Icon)',
		iconifyFieldDescription:
			'Paste {prefix}/{icon} from Iconify (for example: fluent-color/people-chat-48)',
		customIconFieldDisplayName: 'Card Icon URL',
		customIconFieldDescription: 'Use an absolute HTTPS URL for the card icon image (SVG/PNG/JPG)',
		customInputModeDisplayName: 'Custom URL',
		iconifyInputModeDisplayName: 'Iconify Prefix/Icon',
		defaultInputMode: 'iconify',
		includeKnownIconOption: false,
		includePickerOption: false,
		includeIconifyOption: true,
	})
		.map((property) =>
			applyDisplayNameOverrides(property, {
				cardIconInputMode: 'Card Icon Input Mode',
			}),
		)
		.map((property) =>
			applyParentDisplayOptions(property, {
				messageType: ['rich'],
				cardInputMode: ['structured'],
				addCardIcon: [true],
			}),
		),
	{
		displayName:
			'Find icons on Iconify: <a href="https://icon-sets.iconify.design/" target="_blank" rel="noopener noreferrer">Open Iconify Icon Sets</a><br/>Paste the <code>{prefix}/{icon}</code> value here. The full Iconify URL is built automatically.',
		name: 'cardIconCustomUrlNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				messageType: ['rich'],
				cardInputMode: ['structured'],
				addCardIcon: [true],
				cardIconInputMode: ['iconify'],
			},
		},
	},
	{
		displayName: 'Add Card Thumbnail Image',
		name: 'addCardThumbnail',
		type: 'boolean',
		default: false,
		description: 'Whether to add a larger thumbnail image on the card',
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
	},
	...buildIconInputProperties({
		iconInputModeFieldName: 'cardThumbnailInputMode',
		knownIconFieldName: 'cardThumbnailKnownIconId',
		iconifyFieldName: 'cardThumbnailIconify',
		customIconFieldName: 'cardThumbnail',
		iconifyFieldDisplayName: 'Card Thumbnail (Iconify Prefix/Icon)',
		iconifyFieldDescription:
			'Paste {prefix}/{icon} from Iconify (for example: fluent-color/people-chat-48)',
		customIconFieldDisplayName: 'Card Thumbnail URL',
		customIconFieldDescription: 'Use an absolute HTTPS URL for the thumbnail image (SVG/PNG/JPG)',
		customInputModeDisplayName: 'Custom URL',
		iconifyInputModeDisplayName: 'Iconify Prefix/Icon',
		defaultInputMode: 'iconify',
		includeKnownIconOption: false,
		includePickerOption: false,
		includeIconifyOption: true,
	})
		.map((property) =>
			applyDisplayNameOverrides(property, {
				cardThumbnailInputMode: 'Card Thumbnail Input Mode',
			}),
		)
		.map((property) =>
			applyParentDisplayOptions(property, {
				messageType: ['rich'],
				cardInputMode: ['structured'],
				addCardThumbnail: [true],
			}),
		),
	{
		displayName:
			'Find icons on Iconify: <a href="https://icon-sets.iconify.design/" target="_blank" rel="noopener noreferrer">Open Iconify Icon Sets</a><br/>Paste the <code>{prefix}/{icon}</code> value here. The full Iconify URL is built automatically.',
		name: 'cardThumbnailCustomUrlNotice',
		type: 'notice',
		default: '',
		displayOptions: {
			show: {
				messageType: ['rich'],
				cardInputMode: ['structured'],
				addCardThumbnail: [true],
				cardThumbnailInputMode: ['iconify'],
			},
		},
	},
	{
		displayName: 'Slides',
		name: 'slides',
		type: 'fixedCollection',
		placeholder: 'Add Component',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
		options: [
			{
				name: 'slide',
				displayName: 'Component',
				values: createSlideCollectionValues(buttonCollectionValues, textSlideMaxLength),
			},
		],
	},
	{
		displayName: 'Card Buttons',
		name: 'buttons',
		type: 'fixedCollection',
		placeholder: 'Add Card Button',
		typeOptions: { multipleValues: true },
		default: {},
		displayOptions: { show: { messageType: ['rich'], cardInputMode: ['structured'] } },
		description: 'Buttons shown at the bottom of the card',
		options: [
			{
				name: 'button',
				displayName: 'Button',
				values: buttonCollectionValues,
			},
		],
	},
	{
		displayName:
			'To build a complete message card payload (text/card/slides/buttons) in one step, you can first run ZohoCliq → Build Card Payload, then map its output here (for example: <code>{{ $json.cardPayload }}</code>).',
		name: 'cardPayloadMappingNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { messageType: ['json'] } },
	},
	{
		displayName:
			'You can also compose payloads from individual builder operations (for example: Build Components / Build Buttons). In Using JSON mode, the <code>text</code> key is required. If using wrapper-prefix outputs, paste them into the same object in the JSON editor (for example: <code>{{ $json.wrapperPrefixPayload }}</code>).',
		name: 'rawJsonComposerGuidanceNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { messageType: ['json'] } },
	},
	{
		displayName:
			'Basic payload shape: <br/><code>{ "text": "Message text here", "slides": [...], "buttons": [...] }</code> <br/> Message Object docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Message_Object" target="_blank" rel="noopener noreferrer">Zoho Cliq API Reference</a>.',
		name: 'rawJsonComposerBasicShapeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { messageType: ['json'] } },
	},
	{
		displayName: 'JSON',
		name: 'jsonBody',
		type: 'json',
		default: '{ "text": "Hello from n8n" }',
		displayOptions: { show: { messageType: ['json'] } },
		description:
			'Supports either a JSON object or a JSON string that resolves to an object (for cards, map from Build Card Payload output)',
	},
];

const cardPayloadBuilderFieldNames = new Set([
	'cardBuilderNotice',
	'cardInputMode',
	'cardTheme',
	'cardTitle',
	'richPayloadJson',
	'richText',
	'addCardIcon',
	'cardIconInputMode',
	'cardIconIconify',
	'cardIcon',
	'cardIconCustomUrlNotice',
	'addCardThumbnail',
	'cardThumbnailInputMode',
	'cardThumbnailIconify',
	'cardThumbnail',
	'cardThumbnailCustomUrlNotice',
	'slides',
	'buttons',
]);

const cardPayloadBuilderFieldOrder = [
	'cardBuilderNotice',
	'cardInputMode',
	'cardTheme',
	'cardTitle',
	'richText',
	'addCardIcon',
	'cardIconInputMode',
	'cardIconIconify',
	'cardIcon',
	'cardIconCustomUrlNotice',
	'addCardThumbnail',
	'cardThumbnailInputMode',
	'cardThumbnailIconify',
	'cardThumbnail',
	'cardThumbnailCustomUrlNotice',
	'richPayloadJson',
	'slides',
	'buttons',
];

function stripMessageTypeDisplayOption(property: INodeProperties): INodeProperties {
	const showOptions = property.displayOptions?.show;
	if (!showOptions || !('messageType' in showOptions)) {
		return { ...property };
	}

	const remainingShowOptions = { ...showOptions };
	delete (remainingShowOptions as Record<string, unknown>).messageType;
	const hasRemainingShowOptions = Object.keys(remainingShowOptions).length > 0;

	if (!hasRemainingShowOptions) {
		return {
			...property,
			displayOptions: undefined,
		};
	}

	return {
		...property,
		displayOptions: {
			...property.displayOptions,
			show: remainingShowOptions,
		},
	};
}

export const __testHelpers = Object.freeze({
	stripMessageTypeDisplayOption,
});

export const cardPayloadBuilderDescription: INodeProperties[] = cardPayloadBuilderFieldOrder
	.map((fieldName) => messagePayloadDescription.find((property) => property.name === fieldName))
	.filter((property): property is INodeProperties => property !== undefined)
	.filter((property) => cardPayloadBuilderFieldNames.has(property.name))
	.map(stripMessageTypeDisplayOption)
	.map((property) => {
		if (property.name !== 'richText') {
			return property;
		}

		return {
			...property,
			required: true,
			description: 'Required top-level card text shown with the card content (max 4096 chars)',
		};
	});
