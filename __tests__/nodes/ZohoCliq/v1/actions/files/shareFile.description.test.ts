import { channelIdOnlyRLC } from '../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions';
import { description } from '../../../../../../nodes/ZohoCliq/v1/actions/files/shareFile.description';

describe('ZohoCliq - Files - shareFile description', () => {
	it('should generate docs notices for all file share targets', () => {
		const expected = [
			['shareFileAgentChoiceDocsNotice', 'agentChoice'],
			['shareFileChannelIdDocsNotice', 'channelId'],
			['shareFileChannelUniqueNameDocsNotice', 'channelUniqueName'],
			['shareFileChatDocsNotice', 'chat'],
			['shareFileBotDocsNotice', 'bot'],
			['shareFileBuddyDocsNotice', 'buddy'],
		] as const;

		for (const [name, target] of expected) {
			const field = description.find((entry) => entry.name === name);
			expect(field).toBeDefined();
			expect(field?.type).toBe('notice');
			expect(field?.displayOptions?.show?.shareTarget).toEqual([target]);
		}
	});

	it('should expose Agent Choice routing fields only for the Agent Choice path', () => {
		const fieldNames = [
			'agentSelectedShareTarget',
			'agentPostAsBot',
			'agentBotUniqueName',
			'agentBotDisplayName',
			'agentBotImageUrl',
			'agentChannelId',
			'agentChannelUniqueName',
			'agentChatId',
			'agentBuddyUserId',
			'agentBuddyEmail',
		] as const;

		for (const name of fieldNames) {
			const field = description.find((entry) => entry.name === name);
			expect(field).toBeDefined();
			expect(field?.displayOptions?.show?.shareTarget).toEqual(['agentChoice']);
		}
	});

	it('should expose a single Bot Unique Name field across bot, channel, and Agent Choice paths', () => {
		const field = description.find((entry) => entry.name === 'botUniqueName');
		expect(field).toBeDefined();
		expect(field?.displayName).toBe('Bot Unique Name');
		expect(field?.displayOptions?.show?.shareTarget).toEqual([
			'bot',
			'channelId',
			'channelUniqueName',
		]);
	});

	it('should expose agent-choice Bot Unique Name directly under Agent Selected Share Target controls', () => {
		const field = description.find((entry) => entry.name === 'agentBotUniqueName');
		expect(field).toBeDefined();
		expect(field?.displayName).toBe('Bot Unique Name');
		expect(field?.displayOptions?.show?.shareTarget).toEqual(['agentChoice']);
	});

	it('should merge display options when extending channelIdOnlyRLC', () => {
		const channelField = description.find(
			(entry) => entry.name === 'channelId' && entry.type === 'resourceLocator',
		);

		expect(channelField).toBeDefined();
		expect(channelField?.displayOptions?.show?.shareTarget).toEqual(['channelId']);

		if (channelIdOnlyRLC.displayOptions?.show) {
			for (const key of Object.keys(channelIdOnlyRLC.displayOptions.show)) {
				if (key === 'shareTarget') {
					continue;
				}
				expect(channelField?.displayOptions?.show?.[key]).toEqual(
					channelIdOnlyRLC.displayOptions.show[key],
				);
			}
		}
	});

	it('should preserve inherited show keys from channelIdOnlyRLC in channelId field', () => {
		const channelField = description.find(
			(entry) => entry.name === 'channelId' && entry.type === 'resourceLocator',
		);
		expect(channelField).toBeDefined();

		const inheritedShow = channelIdOnlyRLC.displayOptions?.show ?? {};
		for (const key of Object.keys(inheritedShow)) {
			if (key === 'shareTarget') {
				continue;
			}
			expect(channelField?.displayOptions?.show?.[key]).toEqual(inheritedShow[key]);
		}
		expect(channelField?.displayOptions?.show?.shareTarget).toEqual(['channelId']);
	});

	it('should merge channelIdOnlyRLC displayOptions.show when present', async () => {
		jest.resetModules();
		jest.doMock('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions', () => ({
			channelIdOnlyRLC: {
				displayName: 'Channel',
				name: 'channelId',
				type: 'resourceLocator',
				default: { mode: 'list', value: '' },
				required: true,
				modes: [],
				displayOptions: {
					show: {
						resource: ['channel'],
					},
				},
			},
		}));

		const isolatedModule =
			await import('../../../../../../nodes/ZohoCliq/v1/actions/files/shareFile.description');
		const isolatedDescription = isolatedModule.description;
		const channelField = isolatedDescription.find(
			(entry) => entry.name === 'channelId' && entry.type === 'resourceLocator',
		);

		expect(channelField?.displayOptions?.show?.resource).toEqual(['channel']);
		expect(channelField?.displayOptions?.show?.shareTarget).toEqual(['channelId']);

		jest.dontMock('../../../../../../nodes/ZohoCliq/v1/actions/common.descriptions');
		jest.resetModules();
	});

	it('should expose botSubscriberUserIds as fixedCollection multiple values', () => {
		const field = description.find((entry) => entry.name === 'botSubscriberUserIds');
		expect(field).toBeDefined();
		expect(field?.type).toBe('fixedCollection');
		expect(field?.typeOptions?.multipleValues).toBe(true);
		const options = field?.options as Array<{ name: string; values?: Array<{ name: string }> }>;
		expect(options[0].name).toBe('subscriber');
		expect(options[0].values?.[0].name).toBe('userId');
	});

	it('should keep the docs notices and AI guide notice at the bottom of the field list', () => {
		const trailingNames = description.slice(-7).map((entry) => entry.name);

		expect(trailingNames).toEqual([
			'shareFileChannelIdDocsNotice',
			'shareFileChannelUniqueNameDocsNotice',
			'shareFileChatDocsNotice',
			'shareFileBotDocsNotice',
			'shareFileBuddyDocsNotice',
			'shareFileAgentChoiceDocsNotice',
			'shareFileAiToolGuideNotice',
		]);
	});

	it('should expose includeEnhancedOutput with a default of true', () => {
		const field = description.find((entry) => entry.name === 'includeEnhancedOutput');

		expect(field).toBeDefined();
		expect(field?.type).toBe('boolean');
		expect(field?.default).toBe(true);
	});

	it('should include Agent Choice in the Share Target options', () => {
		const field = description.find((entry) => entry.name === 'shareTarget');
		const optionValues = (
			(field?.options ?? []) as Array<{
				value?: string;
			}>
		).map((option) => option.value);

		expect(optionValues).toContain('agentChoice');
	});

	it('should avoid static required flags on conditionally displayed routing fields', () => {
		const conditionallyValidatedFields = [
			'channelId',
			'channelUniqueName',
			'chatId',
			'botUniqueName',
			'buddyUserId',
			'buddyEmail',
		] as const;

		for (const name of conditionallyValidatedFields) {
			const field = description.find((entry) => entry.name === name);
			expect(field).toBeDefined();
			expect(field?.required ?? false).toBe(false);
		}
	});
});
