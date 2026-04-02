import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { getRequiredScopeForOperation } from '../../helpers/scopeRegistry';
import { checkRequiredScope, isBoolean, validateEmail, validateUserId } from '../../helpers/utils';
import { zohoCliqApiRequest } from '../../transport';
import { normalizeZohoMessageIdOutput } from '../message/common';
import { appendExecutionData, appendOperationError, applyResourceDisplayOptions } from './common';

type AckMessageTextMode = 'single' | 'randomArray' | 'presetRandom';
type AckMessageStyle = 'standard' | 'bold' | 'heading';
type AckSpinnerSource = 'preset' | 'customUrl';
type AckBotRecipientsMode = 'none' | 'userIds' | 'emailIds';
type AckCardTheme = 'basic' | 'poll' | 'prompt' | 'modern-inline';

interface IAckPayloadBuildResult {
	ackPayload: IDataObject;
	messageText: string;
	spinnerField: 'thumbnail';
	spinnerUrl: string;
	spinnerSource: AckSpinnerSource;
	spinnerPreset?: string;
	spinnerColor?: string;
}

const operationName = 'buildFireAckMessage';
const messagePostScope = getRequiredScopeForOperation('message', 'post');

const presetSpinnerValues = Array.from(
	new Set([
		'svg-spinners/3-dots-bounce',
		'svg-spinners/3-dots-fade',
		'svg-spinners/3-dots-move',
		'svg-spinners/3-dots-rotate',
		'svg-spinners/3-dots-scale',
		'svg-spinners/3-dots-scale-middle',
		'svg-spinners/6-dots-rotate',
		'svg-spinners/6-dots-scale',
		'svg-spinners/6-dots-scale-middle',
		'svg-spinners/8-dots-rotate',
		'svg-spinners/12-dots-scale-rotate',
		'svg-spinners/180-ring',
		'svg-spinners/180-ring-with-bg',
		'svg-spinners/270-ring',
		'svg-spinners/270-ring-with-bg',
		'svg-spinners/90-ring',
		'svg-spinners/90-ring-with-bg',
		'svg-spinners/bars-fade',
		'svg-spinners/bars-rotate-fade',
		'svg-spinners/bars-scale',
		'svg-spinners/bars-scale-fade',
		'svg-spinners/bars-scale-middle',
		'svg-spinners/blocks-scale',
		'svg-spinners/blocks-shuffle-2',
		'svg-spinners/blocks-shuffle-3',
		'svg-spinners/blocks-wave',
		'svg-spinners/bouncing-ball',
		'svg-spinners/clock',
		'svg-spinners/dot-revolve',
		'svg-spinners/eclipse',
		'svg-spinners/eclipse-half',
		'svg-spinners/gooey-balls-1',
		'svg-spinners/gooey-balls-2',
		'svg-spinners/pulse',
		'svg-spinners/pulse-2',
		'svg-spinners/pulse-3',
		'svg-spinners/pulse-multiple',
		'svg-spinners/pulse-ring',
		'svg-spinners/pulse-rings-2',
		'svg-spinners/pulse-rings-3',
		'svg-spinners/pulse-rings-multiple',
		'svg-spinners/ring-resize',
		'svg-spinners/tadpole',
		'svg-spinners/wifi',
		'svg-spinners/wifi-fade',
		'svg-spinners/wind-toy',
	]),
);

const presetSpinnerOptions = presetSpinnerValues.map((value) => ({
	name: toHumanReadableSpinnerName(value),
	value,
}));

const presetAckMessages = [
	'Bribing the servers.. stand by.',
	'Definitely not just Googling this..',
	'Waking up the interns..',
	'Absolutely not panicking..',
	'Turning it off and on again in my head..',
	"Searching the back of my brain.. it's messy in here.",
	'Pretending I already knew that..',
	'Recalculating.. recalculating.. recalculating..',
	'Summoning the answer from the void..',
	'Making it look effortless.. give me a sec.',
	'Checking under the couch cushions..',
	'404 excuse not found.. working on it.',
	"Don't panic. I'm not panicking. We're fine.",
	'Quietly judging the question.. just kidding, on it.',
	"Asking someone smarter.. they're also me, sadly.",
	'Accomplishing...',
	'Actioning...',
	'Actualizing...',
	'Baking...',
	'Brewing...',
	'Calculating...',
	'Cerebrating...',
	'Churning...',
	'Clauding...',
	'Coalescing...',
	'Cogitating...',
	'Computing...',
	'Conjuring...',
	'Considering...',
	'Cooking...',
	'Crafting...',
	'Creating...',
	'Crunching...',
	'Deliberating...',
	'Determining...',
	'Doing...',
	'Effecting...',
	'Finagling...',
	'Forging...',
	'Forming...',
	'Generating...',
	'Hatching...',
	'Herding...',
	'Honking...',
	'Hustling...',
	'Ideating...',
	'Inferring...',
	'Manifesting...',
	'Marinating...',
	'Moseying...',
	'Mulling...',
	'Mustering...',
	'Musing...',
	'Noodling...',
	'Percolating...',
	'Pondering...',
	'Processing...',
	'Puttering...',
	'Reticulating...',
	'Ruminating...',
	'Schlepping...',
	'Shucking...',
	'Simmering...',
	'Smooshing...',
	'Spinning...',
	'Stewing...',
	'Synthesizing...',
	'Thinking...',
	'Transmuting...',
	'Vibing...',
	'Working...',
];

const properties: INodeProperties[] = [
	{
		displayName:
			'ACK Message Guidance:<ul><li>This operation is designed to build and optionally send an immediate loading-state acknowledgment message, usually right after an Incoming Webhook Trigger fires. The ACK can then be replaced later in the workflow with <b>Edit Message</b> for a smoother Zoho Cliq experience.</li><li>If you want to send this ACK to a different target such as a channel or chat, enable <b>Output Ack Payload Only</b> and map <code>{{$json.ack_payload}}</code> into the Zoho Cliq <b>Post Message</b> operation/tool.</li><li>It is strongly recommended to replace this ACK later in the workflow by passing the returned <code>ack_message_id</code> into <b>Edit Message</b>.</li><li>You can provide one direct ACK message, choose from the built-in preset acknowledgments, or provide a JSON array of possible messages that the node will choose from at random. If no text is supplied, the node falls back to <code>...</code> because Zoho Cliq requires <code>text</code>.</li></ul>',
		name: 'buildFireAckMessageGuidanceNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName: 'Output Ack Payload Only',
		name: 'outputAckPayloadOnly',
		type: 'boolean',
		default: false,
		noDataExpression: true,
		description:
			'Whether to skip posting and only output `ack_payload` so it can be mapped into another Zoho Cliq Post Message step',
	},
	{
		displayName: 'Bot Unique Name',
		name: 'ackBotUniqueName',
		type: 'string',
		default: '',
		placeholder: 'e.g. supportbot',
		required: true,
		description: 'Bot unique name to post the ACK through when Output Ack Payload Only is disabled',
		displayOptions: {
			show: {
				outputAckPayloadOnly: [false],
			},
		},
	},
	{
		displayName: 'App Key',
		name: 'ackBotAppKey',
		type: 'string',
		default: '',
		description:
			'Optional extension app key sent as the `appkey` query parameter when the bot belongs to a marketplace app',
		displayOptions: {
			show: {
				outputAckPayloadOnly: [false],
			},
		},
	},
	{
		displayName: 'Bot Recipients',
		name: 'ackBotRecipientsMode',
		type: 'options',
		default: 'none',
		description:
			'Optionally limit the bot ACK to specific recipients. Leave as Default Delivery to omit `userids`.',
		options: [
			{
				name: 'Default Delivery',
				value: 'none',
				description: 'Do not send `userids`; let the bot endpoint handle delivery normally',
			},
			{
				name: 'Specific User IDs',
				value: 'userIds',
				description: 'Send the ACK to one or more Zoho Cliq user IDs',
			},
			{
				name: 'Specific User Emails',
				value: 'emailIds',
				description: 'Send the ACK to one or more user email addresses',
			},
		],
		displayOptions: {
			show: {
				outputAckPayloadOnly: [false],
			},
		},
	},
	{
		displayName: 'Recipient Values',
		name: 'ackBotRecipients',
		type: 'string',
		default: '',
		placeholder: 'e.g. user1@example.com,user2@example.com',
		description:
			'Comma-separated list or JSON array of recipient values. Validation follows the selected Bot Recipients mode.',
		displayOptions: {
			show: {
				outputAckPayloadOnly: [false],
				ackBotRecipientsMode: ['__legacy'],
			},
		},
	},
	{
		displayName: 'Recipient Values',
		name: 'ackBotRecipientsUserIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. 987654321,987654322',
		description:
			'Comma-separated list or JSON array of Zoho Cliq user IDs. Validation follows the selected Bot Recipients mode.',
		displayOptions: {
			show: {
				outputAckPayloadOnly: [false],
				ackBotRecipientsMode: ['userIds'],
			},
		},
	},
	{
		displayName: 'Recipient Values',
		name: 'ackBotRecipientsEmailIds',
		type: 'string',
		default: '',
		placeholder: 'e.g. user1@example.com,user2@example.com',
		description:
			'Comma-separated list or JSON array of user email addresses. Validation follows the selected Bot Recipients mode.',
		displayOptions: {
			show: {
				outputAckPayloadOnly: [false],
				ackBotRecipientsMode: ['emailIds'],
			},
		},
	},
	{
		displayName: 'Ack Message Source',
		name: 'ackMessageTextMode',
		type: 'options',
		default: 'single',
		options: [
			{
				name: 'Single Message',
				value: 'single',
				description: 'Use one direct text value for the ACK message',
			},
			{
				name: 'Random From JSON Array',
				value: 'randomArray',
				description: 'Choose one ACK message at random from a JSON array of strings',
			},
			{
				name: 'Random From Presets',
				value: 'presetRandom',
				description: 'Choose one ACK message at random from the built-in preset acknowledgments',
			},
		],
		description: 'How the ACK text should be resolved before styling is applied',
	},
	{
		displayName: 'Ack Message',
		name: 'ackMessageText',
		type: 'string',
		default: '',
		placeholder: 'e.g. One moment while I look into that...',
		description:
			'Single ACK message text. Leave blank to fall back to `...` before styling is applied.',
		displayOptions: {
			show: {
				ackMessageTextMode: ['single'],
			},
		},
	},
	{
		displayName: 'Ack Messages JSON',
		name: 'ackMessagesJson',
		type: 'json',
		default: '[]',
		description:
			'JSON array of possible ACK message strings. One entry is chosen at random per item. Example: ["One moment...", "Looking into that now...", "Working on it..."]',
		displayOptions: {
			show: {
				ackMessageTextMode: ['randomArray'],
			},
		},
	},
	{
		displayName: 'Message Style',
		name: 'ackMessageStyle',
		type: 'options',
		default: 'heading',
		description: 'How the resolved ACK message should be styled in Zoho Cliq markdown',
		options: [
			{ name: 'Standard', value: 'standard', description: 'Send the text as-is' },
			{ name: 'Bold', value: 'bold', description: 'Wrap the text in single asterisks' },
			{
				name: 'Heading',
				value: 'heading',
				description: 'Prefix the text with `###` for a heading-style ACK',
			},
		],
	},
	{
		displayName: 'Card Theme',
		name: 'ackCardTheme',
		type: 'options',
		default: 'basic',
		description:
			'Optional Zoho Cliq card theme for the ACK payload. Basic keeps the current card payload without a theme.',
		options: [
			{ name: 'Basic', value: 'basic', description: 'Do not send `card.theme`' },
			{ name: 'Poll', value: 'poll', description: 'Send `card.theme` as `poll`' },
			{ name: 'Prompt', value: 'prompt', description: 'Send `card.theme` as `prompt`' },
			{
				name: 'Modern Inline',
				value: 'modern-inline',
				description: 'Send `card.theme` as `modern-inline`',
			},
		],
	},
	{
		displayName: 'Animated Thumbnail Source',
		name: 'ackSpinnerSource',
		type: 'options',
		default: 'preset',
		description:
			'Choose one preset SVG spinner or provide a fully custom image URL for the ACK thumbnail',
		options: [
			{
				name: 'Preset SVG Spinner',
				value: 'preset',
				description: 'Use one of the built-in Iconify svg-spinners presets as the ACK thumbnail',
			},
			{
				name: 'Custom URL',
				value: 'customUrl',
				description:
					'Use your own hosted image or SVG URL as the ACK thumbnail instead of a preset',
			},
		],
	},
	{
		displayName: 'Preset Spinner',
		name: 'ackSpinnerPreset',
		type: 'options',
		default: 'svg-spinners/3-dots-bounce',
		description:
			'Preset spinner from the svg-spinners Iconify collection used for `card.thumbnail`',
		options: presetSpinnerOptions,
		displayOptions: {
			show: {
				ackSpinnerSource: ['preset'],
			},
		},
	},
	{
		displayName: 'Custom Spinner URL',
		name: 'ackSpinnerCustomUrl',
		type: 'string',
		default: '',
		placeholder: 'e.g. https://example.com/loading.svg',
		description:
			'Full HTTP(S) URL to use for `card.thumbnail` in the ACK payload instead of a preset spinner',
		displayOptions: {
			show: {
				ackSpinnerSource: ['customUrl'],
			},
		},
	},
	{
		displayName: 'Spinner Color',
		name: 'ackSpinnerColor',
		type: 'color',
		default: '#12ea9d',
		description:
			'Hex color used for preset Iconify SVG spinner thumbnails. The node URL-encodes this value before sending it to the Iconify API.',
		displayOptions: {
			show: {
				ackSpinnerSource: ['preset'],
			},
		},
	},
	{
		displayName:
			'Spinner Credits: Powered by <a href="https://icon-sets.iconify.design/svg-spinners/" target="_blank" rel="noopener noreferrer">Iconify</a> and the excellent <a href="https://github.com/n3r4zzurr0/svg-spinners" target="_blank" rel="noopener noreferrer">n3r4zzurr0/svg-spinners</a> MIT library. Browse the animations there and consider starring the GitHub project.',
		name: 'buildFireAckMessageSpinnerCreditsNotice',
		type: 'notice',
		default: '',
	},
	{
		displayName:
			'ACK Send Docs: <a href="https://www.zoho.com/cliq/help/restapi/v2/#Post_Message_Bot" target="_blank" rel="noopener noreferrer">Open Zoho REST API Reference</a> REQUIRED SCOPES FOR DIRECT BOT SEND: <code>ZohoCliq.Webhooks.CREATE</code>. This operation always forces <code>sync_message</code> so the ACK can be edited later.',
		name: 'buildFireAckMessageDocsNotice',
		type: 'notice',
		default: '',
	},
];

export const description: INodeProperties[] = applyResourceDisplayOptions(
	properties,
	operationName,
);

function toHumanReadableSpinnerName(value: string): string {
	const [, spinnerName = value] = value.split('/');
	return spinnerName
		.split('-')
		.filter((segment) => segment.length > 0)
		.map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
		.join(' ');
}

function parseAckMessageTextMode(
	value: unknown,
	itemIndex: number,
	context: IExecuteFunctions,
): AckMessageTextMode {
	if (value === 'single' || value === 'randomArray' || value === 'presetRandom') {
		return value;
	}

	throw new NodeOperationError(context.getNode(), 'Ack Message Source must be a valid option', {
		itemIndex,
	});
}

function parseAckCardTheme(
	value: unknown,
	itemIndex: number,
	context: IExecuteFunctions,
): AckCardTheme {
	if (value === 'basic' || value === 'poll' || value === 'prompt' || value === 'modern-inline') {
		return value;
	}

	throw new NodeOperationError(context.getNode(), 'Card Theme must be a valid option', {
		itemIndex,
	});
}

function parseAckMessageStyle(
	value: unknown,
	itemIndex: number,
	context: IExecuteFunctions,
): AckMessageStyle {
	if (value === 'standard' || value === 'bold' || value === 'heading') {
		return value;
	}

	throw new NodeOperationError(context.getNode(), 'Message Style must be a valid option', {
		itemIndex,
	});
}

function parseAckSpinnerSource(
	value: unknown,
	itemIndex: number,
	context: IExecuteFunctions,
): AckSpinnerSource {
	if (value === 'preset' || value === 'customUrl') {
		return value;
	}

	throw new NodeOperationError(
		context.getNode(),
		'Animated Thumbnail Source must be a valid option',
		{
			itemIndex,
		},
	);
}

function parseAckBotRecipientsMode(
	value: unknown,
	itemIndex: number,
	context: IExecuteFunctions,
): AckBotRecipientsMode {
	if (value === 'none' || value === 'userIds' || value === 'emailIds') {
		return value;
	}

	throw new NodeOperationError(context.getNode(), 'Bot Recipients must be a valid option', {
		itemIndex,
	});
}

function sanitizeBotUniqueName(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Unique Name is required when Output Ack Payload Only is disabled',
			{ itemIndex },
		);
	}

	const sanitized = value.trim();
	if (!/^[a-zA-Z0-9]+$/.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			'Invalid Bot Unique Name format. Only letters and numbers are allowed.',
			{ itemIndex },
		);
	}

	if (sanitized.length > 100) {
		throw new NodeOperationError(
			context.getNode(),
			'Bot Unique Name is too long. Maximum length is 100 characters.',
			{ itemIndex },
		);
	}

	return sanitized;
}

function parseDelimitedStringArray(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	fieldName: string,
): string[] {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must contain at least one value`,
				{
					itemIndex,
				},
			);
		}

		return value.map((entry, index) => {
			if (typeof entry !== 'string' || !entry.trim()) {
				throw new NodeOperationError(
					context.getNode(),
					`${fieldName}[${index}] must be a non-empty string`,
					{ itemIndex },
				);
			}

			return entry.trim();
		});
	}

	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must be a comma-separated string or JSON array`,
			{ itemIndex },
		);
	}

	const trimmed = value.trim();
	if (!trimmed) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must contain at least one value`,
			{
				itemIndex,
			},
		);
	}

	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must be valid JSON when provided in array form`,
				{ itemIndex },
			);
		}

		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must be a JSON array when provided in array form`,
				{ itemIndex },
			);
		}

		if (parsed.length === 0) {
			throw new NodeOperationError(
				context.getNode(),
				`${fieldName} must contain at least one value`,
				{ itemIndex },
			);
		}

		return parsed.map((entry, index) => {
			if (typeof entry !== 'string' || !entry.trim()) {
				throw new NodeOperationError(
					context.getNode(),
					`${fieldName}[${index}] must be a non-empty string`,
					{ itemIndex },
				);
			}

			return entry.trim();
		});
	}

	const parsedValues = trimmed
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	if (parsedValues.length === 0) {
		throw new NodeOperationError(
			context.getNode(),
			`${fieldName} must contain at least one value`,
			{
				itemIndex,
			},
		);
	}

	return parsedValues;
}

function resolveAckRecipients(
	context: IExecuteFunctions,
	itemIndex: number,
	mode: AckBotRecipientsMode,
): string[] {
	if (mode === 'none') {
		return [];
	}

	const rawRecipients = resolveAckRecipientsInputValue(context, itemIndex, mode);
	const parsedRecipients = parseDelimitedStringArray(
		context,
		rawRecipients,
		itemIndex,
		'Recipient Values',
	);

	return parsedRecipients.map((recipient) =>
		mode === 'emailIds'
			? validateEmail(context, recipient.toLowerCase(), itemIndex)
			: validateUserId(context, recipient, itemIndex),
	);
}

function resolveAckRecipientsInputValue(
	context: IExecuteFunctions,
	itemIndex: number,
	mode: AckBotRecipientsMode,
): unknown {
	if (mode === 'userIds') {
		const userIdsValue = thisGetNodeParameter(context, 'ackBotRecipientsUserIds', itemIndex, '');
		if (Array.isArray(userIdsValue)) {
			return userIdsValue;
		}

		if (typeof userIdsValue === 'string' && userIdsValue.trim()) {
			return userIdsValue;
		}
	}

	if (mode === 'emailIds') {
		const emailIdsValue = thisGetNodeParameter(context, 'ackBotRecipientsEmailIds', itemIndex, '');
		if (Array.isArray(emailIdsValue)) {
			return emailIdsValue;
		}

		if (typeof emailIdsValue === 'string' && emailIdsValue.trim()) {
			return emailIdsValue;
		}
	}

	return thisGetNodeParameter(context, 'ackBotRecipients', itemIndex, '');
}

function validateHexColor(context: IExecuteFunctions, value: unknown, itemIndex: number): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new NodeOperationError(context.getNode(), 'Spinner Color is required', {
			itemIndex,
		});
	}

	const sanitized = value.trim();
	if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			'Spinner Color must be a valid hex color such as #12ea9d',
			{ itemIndex },
		);
	}

	return sanitized;
}

function validateSpinnerCustomUrl(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new NodeOperationError(context.getNode(), 'Custom Spinner URL is required', {
			itemIndex,
		});
	}

	const sanitized = value.trim();
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(sanitized);
	} catch {
		throw new NodeOperationError(context.getNode(), 'Custom Spinner URL must be a valid URL', {
			itemIndex,
		});
	}

	if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
		throw new NodeOperationError(
			context.getNode(),
			'Custom Spinner URL must start with http:// or https://',
			{ itemIndex },
		);
	}

	return parsedUrl.toString();
}

function validateOptionalAppKey(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string {
	if (value === undefined || value === null) {
		return '';
	}

	const sanitized = String(value).trim();
	if (!sanitized) {
		return '';
	}

	if (sanitized.length > 300) {
		throw new NodeOperationError(context.getNode(), 'App Key is too long', {
			itemIndex,
		});
	}

	return sanitized;
}

function parseAckMessagesJson(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
): string[] {
	if (value === undefined || value === null) {
		return [];
	}

	let parsed = value;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) {
			return [];
		}

		try {
			parsed = JSON.parse(trimmed);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				'Ack Messages JSON must be valid JSON array syntax',
				{ itemIndex },
			);
		}
	}

	if (!Array.isArray(parsed)) {
		throw new NodeOperationError(context.getNode(), 'Ack Messages JSON must resolve to an array', {
			itemIndex,
		});
	}

	return parsed.map((entry, index) => {
		if (typeof entry !== 'string') {
			throw new NodeOperationError(
				context.getNode(),
				`Ack Messages JSON[${index}] must be a string`,
				{ itemIndex },
			);
		}

		const trimmedEntry = entry.trim();
		if (!trimmedEntry) {
			throw new NodeOperationError(
				context.getNode(),
				`Ack Messages JSON[${index}] cannot be empty`,
				{ itemIndex },
			);
		}

		if (trimmedEntry.length > 5000) {
			throw new NodeOperationError(
				context.getNode(),
				`Ack Messages JSON[${index}] exceeds the 5000 character Zoho Cliq text limit`,
				{ itemIndex },
			);
		}

		return trimmedEntry;
	});
}

function resolveAckBaseMessage(context: IExecuteFunctions, itemIndex: number): string {
	const messageMode = parseAckMessageTextMode(
		thisGetNodeParameter(context, 'ackMessageTextMode', itemIndex, 'single'),
		itemIndex,
		context,
	);

	if (messageMode === 'single') {
		const rawMessage = thisGetNodeParameter(context, 'ackMessageText', itemIndex, '');
		if (rawMessage === undefined || rawMessage === null) {
			return '...';
		}

		if (typeof rawMessage !== 'string') {
			throw new NodeOperationError(context.getNode(), 'Ack Message must be a string', {
				itemIndex,
			});
		}

		const trimmedMessage = rawMessage.trim();
		if (!trimmedMessage) {
			return '...';
		}

		return trimmedMessage;
	}

	if (messageMode === 'presetRandom') {
		return presetAckMessages[Math.floor(Math.random() * presetAckMessages.length)] as string;
	}

	const messages = parseAckMessagesJson(
		context,
		thisGetNodeParameter(context, 'ackMessagesJson', itemIndex, '[]'),
		itemIndex,
	);

	if (messages.length === 0) {
		return '...';
	}

	return messages[Math.floor(Math.random() * messages.length)];
}

function formatAckMessageText(
	context: IExecuteFunctions,
	itemIndex: number,
	message: string,
): string {
	const style = parseAckMessageStyle(
		thisGetNodeParameter(context, 'ackMessageStyle', itemIndex, 'heading'),
		itemIndex,
		context,
	);

	if (style === 'standard') {
		if (message.length > 5000) {
			throw new NodeOperationError(
				context.getNode(),
				`ack_payload.text exceeds the 5000 character Zoho Cliq text limit after applying ackMessageStyle "${style}"`,
				{ itemIndex },
			);
		}
		return message;
	}

	const styledText = style === 'bold' ? `*${message}*` : `### ${message}`;

	if (styledText.length > 5000) {
		throw new NodeOperationError(
			context.getNode(),
			`ack_payload.text exceeds the 5000 character Zoho Cliq text limit after applying ackMessageStyle "${style}"`,
			{ itemIndex },
		);
	}

	return styledText;
}

function resolveAckSpinnerUrl(
	context: IExecuteFunctions,
	itemIndex: number,
): Pick<IAckPayloadBuildResult, 'spinnerUrl' | 'spinnerSource' | 'spinnerPreset' | 'spinnerColor'> {
	const spinnerSource = parseAckSpinnerSource(
		thisGetNodeParameter(context, 'ackSpinnerSource', itemIndex, 'preset'),
		itemIndex,
		context,
	);

	if (spinnerSource === 'customUrl') {
		return {
			spinnerSource,
			spinnerUrl: validateSpinnerCustomUrl(
				context,
				thisGetNodeParameter(context, 'ackSpinnerCustomUrl', itemIndex, ''),
				itemIndex,
			),
		};
	}

	const spinnerPresetRaw = thisGetNodeParameter(
		context,
		'ackSpinnerPreset',
		itemIndex,
		'svg-spinners/3-dots-bounce',
	);
	if (typeof spinnerPresetRaw !== 'string' || !spinnerPresetRaw.trim()) {
		throw new NodeOperationError(context.getNode(), 'Preset Spinner is required', {
			itemIndex,
		});
	}

	const spinnerPreset = spinnerPresetRaw.trim();
	if (!presetSpinnerValues.includes(spinnerPreset)) {
		throw new NodeOperationError(
			context.getNode(),
			'Preset Spinner must be one of the supported options',
			{
				itemIndex,
			},
		);
	}

	const spinnerColor = validateHexColor(
		context,
		thisGetNodeParameter(context, 'ackSpinnerColor', itemIndex, '#12ea9d'),
		itemIndex,
	);

	return {
		spinnerSource,
		spinnerPreset,
		spinnerColor,
		spinnerUrl: `https://api.iconify.design/${spinnerPreset}.svg?color=${encodeURIComponent(
			spinnerColor,
		)}`,
	};
}

function buildAckPayload(context: IExecuteFunctions, itemIndex: number): IAckPayloadBuildResult {
	const messageText = formatAckMessageText(
		context,
		itemIndex,
		resolveAckBaseMessage(context, itemIndex),
	);
	const cardTheme = parseAckCardTheme(
		thisGetNodeParameter(context, 'ackCardTheme', itemIndex, 'basic'),
		itemIndex,
		context,
	);
	const spinnerField = 'thumbnail';
	const spinnerConfig = resolveAckSpinnerUrl(context, itemIndex);
	const cardPayload: IDataObject = {
		...(cardTheme !== 'basic' ? { theme: cardTheme } : {}),
		thumbnail: spinnerConfig.spinnerUrl,
	};
	const ackPayload: IDataObject = {
		text: messageText,
		card: cardPayload,
		sync_message: true,
	};

	return {
		ackPayload,
		messageText,
		spinnerField,
		spinnerUrl: spinnerConfig.spinnerUrl,
		spinnerSource: spinnerConfig.spinnerSource,
		spinnerPreset: spinnerConfig.spinnerPreset,
		spinnerColor: spinnerConfig.spinnerColor,
	};
}

function normalizeAckMessageIdValue(value: unknown): string | undefined {
	if (typeof value !== 'string' || !value.trim()) {
		return undefined;
	}

	let normalized = value.trim();
	if (normalized.includes('%') || normalized.includes('+')) {
		try {
			normalized = decodeURIComponent(normalized.replace(/\+/g, '%20'));
		} catch {
			normalized = value.trim();
		}
	}

	return normalizeZohoMessageIdOutput(normalized);
}

function toDataObject(value: unknown): IDataObject {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {};
	}

	return value as IDataObject;
}

function normalizeAckSendResponse(
	context: IExecuteFunctions,
	response: unknown,
	itemIndex: number,
) {
	const responseObject = toDataObject(response);
	const rootAckMessageId = normalizeAckMessageIdValue(responseObject.message_id);
	const rootChatId =
		typeof responseObject.chat_id === 'string' && responseObject.chat_id.trim()
			? responseObject.chat_id.trim()
			: undefined;
	const rawMessageDetails = toDataObject(responseObject.message_details);
	const ackMessageDetails: IDataObject = {};
	const uniqueAckMessageIds = new Set<string>();
	const uniqueChatIds = new Set<string>();

	if (rootAckMessageId) {
		uniqueAckMessageIds.add(rootAckMessageId);
	}

	if (rootChatId) {
		uniqueChatIds.add(rootChatId);
	}

	for (const [recipientKey, detailValue] of Object.entries(rawMessageDetails)) {
		if (!detailValue || typeof detailValue !== 'object' || Array.isArray(detailValue)) {
			continue;
		}

		const detailObject = { ...(detailValue as IDataObject) };
		const ackMessageId = normalizeAckMessageIdValue(detailObject.message_id);
		delete detailObject.message_id;

		if (ackMessageId) {
			detailObject.ack_message_id = ackMessageId;
			uniqueAckMessageIds.add(ackMessageId);
		}

		if (typeof detailObject.chat_id === 'string' && detailObject.chat_id.trim()) {
			detailObject.chat_id = detailObject.chat_id.trim();
			uniqueChatIds.add(detailObject.chat_id);
		}

		ackMessageDetails[recipientKey] = detailObject;
	}

	if (uniqueAckMessageIds.size === 0) {
		throw new NodeOperationError(
			context.getNode(),
			'Zoho Cliq did not return any ACK message IDs even though sync_message was enabled',
			{ itemIndex },
		);
	}

	const ackMessageIds = Array.from(uniqueAckMessageIds);
	const ackChatIds = Array.from(uniqueChatIds);
	const normalizedOutput: IDataObject = {};

	if (ackMessageIds.length === 1) {
		normalizedOutput.ack_message_id = ackMessageIds[0];
	} else {
		normalizedOutput.ack_message_ids = ackMessageIds;
	}

	if (ackChatIds.length === 1) {
		normalizedOutput.ack_chat_id = ackChatIds[0];
	} else if (ackChatIds.length > 1) {
		normalizedOutput.ack_chat_ids = ackChatIds;
	}

	if (Object.keys(ackMessageDetails).length > 0) {
		normalizedOutput.ack_message_details = ackMessageDetails;
	}

	if (Array.isArray(responseObject.user_ids)) {
		const ackUserIds = responseObject.user_ids.filter(
			(entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
		);
		if (ackUserIds.length > 0) {
			normalizedOutput.ack_user_ids = ackUserIds;
		}
	}

	return normalizedOutput;
}

function thisGetNodeParameter(
	context: IExecuteFunctions,
	name: string,
	itemIndex: number,
	fallback?: unknown,
): unknown {
	return context.getNodeParameter(name, itemIndex, fallback);
}

export const __testHelpers = Object.freeze({
	presetAckMessages,
	toHumanReadableSpinnerName,
});

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	grantedScopes: string,
): Promise<INodeExecutionData[]> {
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const outputAckPayloadOnlyRaw = this.getNodeParameter('outputAckPayloadOnly', i, false);
			const outputAckPayloadOnly = outputAckPayloadOnlyRaw ?? false;
			if (!isBoolean(outputAckPayloadOnly)) {
				throw new NodeOperationError(this.getNode(), 'Output Ack Payload Only must be a boolean', {
					itemIndex: i,
				});
			}

			const ackBuildResult = buildAckPayload(this, i);
			const ackBuiltAt = new Date().toISOString();
			const baseOutput: IDataObject = {
				ack_payload: ackBuildResult.ackPayload,
				ack_payload_json: JSON.stringify(ackBuildResult.ackPayload, null, 2),
				ack_text: ackBuildResult.messageText,
				ack_built_at: ackBuiltAt,
				ack_spinner: {
					source: ackBuildResult.spinnerSource,
					field: ackBuildResult.spinnerField,
					url: ackBuildResult.spinnerUrl,
					...(ackBuildResult.spinnerPreset ? { preset: ackBuildResult.spinnerPreset } : {}),
					...(ackBuildResult.spinnerColor ? { color: ackBuildResult.spinnerColor } : {}),
				},
			};

			if (outputAckPayloadOnly) {
				appendExecutionData(this, returnData, i, {
					...baseOutput,
					ack_delivery_mode: 'payloadOnly',
					ack_sent_to: {
						type: 'deferred',
						note: 'Map {{$json.ack_payload}} into Zoho Cliq Post Message to target a bot, chat, channel, or thread later in the workflow.',
					},
				});
				continue;
			}

			checkRequiredScope(this, grantedScopes, messagePostScope, i, {
				scopeContext: {
					resource: 'messageComponentBuilder',
					operation: operationName,
				},
			});

			const botUniqueName = sanitizeBotUniqueName(
				this,
				this.getNodeParameter('ackBotUniqueName', i, ''),
				i,
			);
			const requestedAppKey = validateOptionalAppKey(
				this,
				this.getNodeParameter('ackBotAppKey', i, ''),
				i,
			);
			const recipientsMode = parseAckBotRecipientsMode(
				this.getNodeParameter('ackBotRecipientsMode', i, 'none'),
				i,
				this,
			);
			const recipients = resolveAckRecipients(this, i, recipientsMode);
			const requestBody: IDataObject = { ...ackBuildResult.ackPayload };

			if (recipients.length > 0) {
				requestBody.userids = recipients.join(',');
			}

			const qs: Record<string, string> = {};
			if (requestedAppKey) {
				qs.appkey = requestedAppKey;
			}

			const response = await zohoCliqApiRequest.call(
				this,
				'POST',
				`/api/v2/bots/${encodeURIComponent(botUniqueName)}/message`,
				requestBody,
				qs,
			);
			const ackSentAt = new Date().toISOString();
			const normalizedResponse = normalizeAckSendResponse(this, response, i);

			appendExecutionData(this, returnData, i, {
				...baseOutput,
				...normalizedResponse,
				ack_delivery_mode: 'sentToBot',
				ack_sent_at: ackSentAt,
				ack_sent_to: {
					type: 'bot',
					bot_unique_name: botUniqueName,
					...(requestedAppKey ? { appkey: requestedAppKey } : {}),
					recipient_mode: recipientsMode,
					recipients,
				},
			});
		} catch (error) {
			appendOperationError(this, returnData, i, error, {
				fallbackMessage: 'Unable to build or send the ACK message payload.',
				operation: operationName,
				hint: 'Verify the ACK text inputs, spinner configuration, and bot delivery settings. When sending directly, the connected credential also needs ZohoCliq.Webhooks.CREATE.',
			});
		}
	}

	return returnData;
}
