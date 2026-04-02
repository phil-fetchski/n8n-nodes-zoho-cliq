import type { INodeProperties } from 'n8n-workflow';
import { messagePayloadDescription } from '../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload';
import { __testHelpers } from '../../../../../../nodes/ZohoCliq/v1/actions/shared/messagePayload/descriptions';

describe('messagePayload Description Helpers', () => {
	it('returns a shallow copy when displayOptions is not set', () => {
		const property: INodeProperties = {
			displayName: 'Card Theme',
			name: 'cardTheme',
			type: 'options',
			options: [{ name: 'Basic', value: 'basic' }],
			default: 'basic',
		};

		const result = __testHelpers.stripMessageTypeDisplayOption(property);

		expect(result).toEqual(property);
		expect(result).not.toBe(property);
	});

	it('returns a shallow copy when messageType is not present in display options', () => {
		const property: INodeProperties = {
			displayName: 'Card Title',
			name: 'cardTitle',
			type: 'string',
			default: '',
			displayOptions: {
				show: {
					target: ['channel'],
				},
			},
		};

		const result = __testHelpers.stripMessageTypeDisplayOption(property);

		expect(result).toEqual(property);
		expect(result).not.toBe(property);
	});

	it('removes displayOptions entirely when messageType is the only show option', () => {
		const property: INodeProperties = {
			displayName: 'Raw Rich Payload',
			name: 'richPayloadJson',
			type: 'json',
			default: '{}',
			displayOptions: {
				show: {
					messageType: ['rich'],
				},
			},
		};

		const result = __testHelpers.stripMessageTypeDisplayOption(property);
		expect(result.displayOptions).toBeUndefined();
	});

	it('keeps plain-text markdown guidance order as text -> toggle -> notice -> mention', () => {
		const names = messagePayloadDescription.map((property) => property.name);
		const textIndex = names.indexOf('text');
		const toggleIndex = names.indexOf('showCliqMarkdownGuidance');
		const noticeIndex = names.indexOf('plainTextMarkdownNotice');
		const mentionIndex = names.indexOf('addMention');

		expect(textIndex).toBeGreaterThan(-1);
		expect(toggleIndex).toBeGreaterThan(textIndex);
		expect(noticeIndex).toBeGreaterThan(toggleIndex);
		expect(mentionIndex).toBeGreaterThan(noticeIndex);
	});

	it('allows Message Type expressions while blocking the markdown guidance toggle', () => {
		const messageType = messagePayloadDescription.find(
			(property) => property.name === 'messageType',
		);
		const markdownToggle = messagePayloadDescription.find(
			(property) => property.name === 'showCliqMarkdownGuidance',
		);

		expect(messageType).toBeDefined();
		expect(markdownToggle).toBeDefined();
		expect(messageType?.noDataExpression).toBeUndefined();
		expect(markdownToggle?.noDataExpression).toBe(true);
	});
});
