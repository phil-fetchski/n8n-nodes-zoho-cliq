import * as ThreadResource from '../../../../../../nodes/ZohoCliq/v1/actions/thread/Thread.resource';

describe('ZohoCliq - Thread - Thread.resource', () => {
	it('should expose all thread operations in defined order', () => {
		const operationProperty = ThreadResource.description.find(
			(property) => property.name === 'operation',
		);

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('list');

		const optionValues = ((operationProperty?.options ?? []) as Array<{ value: string }>).map(
			(option) => option.value,
		);

		expect(optionValues).toEqual([
			'addFollowers',
			'autoFollow',
			'create',
			'follow',
			'getFollowers',
			'getMainMessage',
			'getNonFollowers',
			'list',
			'post',
			'removeFollowers',
			'scheduleMessage',
			'unfollow',
			'updateState',
		]);
	});

	it('should adapt shared schedule message fields for the thread resource', () => {
		const threadChatId = ThreadResource.description.find(
			(property) =>
				property.name === 'chatId' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const botDisplayName = ThreadResource.description.find(
			(property) =>
				property.name === 'botDisplayName' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const botImage = ThreadResource.description.find(
			(property) =>
				property.name === 'botImage' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const scheduleGuideNotice = ThreadResource.description.find(
			(property) =>
				property.name === 'scheduleMessageAiToolGuideNotice' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenScheduleFieldVisibility = ThreadResource.description.find(
			(property) =>
				property.name === 'scheduleFieldVisibility' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const scheduleTime = ThreadResource.description.find(
			(property) =>
				property.name === 'scheduleTime' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const scheduleTimezone = ThreadResource.description.find(
			(property) =>
				property.name === 'scheduleTimezone' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const postAsBot = ThreadResource.description.find(
			(property) =>
				property.name === 'postAsBot' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const botUniqueName = ThreadResource.description.find(
			(property) =>
				property.name === 'botUniqueName' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenScheduleMode = ThreadResource.description.find(
			(property) =>
				property.name === 'scheduleMode' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenScheduleStatus = ThreadResource.description.find(
			(property) =>
				property.name === 'scheduleStatus' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenAgentScheduleStatus = ThreadResource.description.find(
			(property) =>
				property.name === 'agentScheduleStatus' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenScheduleStatusConversationNotice = ThreadResource.description.find(
			(property) =>
				property.name === 'scheduleStatusConversationNotice' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenAgentScheduleTime = ThreadResource.description.find(
			(property) =>
				property.name === 'agentScheduleTime' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenAgentScheduleTimezone = ThreadResource.description.find(
			(property) =>
				property.name === 'agentScheduleTimezone' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenAgentPostAsBot = ThreadResource.description.find(
			(property) =>
				property.name === 'agentPostAsBot' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);
		const hiddenAgentBotUniqueName = ThreadResource.description.find(
			(property) =>
				property.name === 'agentBotUniqueName' &&
				property.displayOptions?.show?.resource?.includes('thread') &&
				property.displayOptions?.show?.operation?.includes('scheduleMessage'),
		);

		expect(threadChatId?.displayName).toBe('Thread Chat ID');
		expect(threadChatId?.description).toBe(
			'Thread chat ID where the scheduled message should be posted',
		);
		expect(scheduleGuideNotice?.displayName).toContain('/Thread/schedule-message.md');
		expect(scheduleGuideNotice?.displayName).toContain('Thread/Schedule Message');
		expect(hiddenScheduleFieldVisibility).toBeUndefined();
		expect(scheduleTime?.displayOptions?.show?.scheduleMode).toBeUndefined();
		expect(scheduleTime?.displayOptions?.show?.scheduleFieldVisibility).toBeUndefined();
		expect(scheduleTimezone?.displayOptions?.show?.scheduleMode).toBeUndefined();
		expect(scheduleTimezone?.displayOptions?.show?.scheduleFieldVisibility).toBeUndefined();
		expect(postAsBot?.displayOptions?.show?.scheduleMode).toBeUndefined();
		expect(postAsBot?.displayOptions?.show?.scheduleFieldVisibility).toBeUndefined();
		expect(botUniqueName?.displayOptions?.show?.scheduleMode).toBeUndefined();
		expect(botUniqueName?.displayOptions?.show?.scheduleFieldVisibility).toBeUndefined();
		expect(hiddenScheduleMode).toBeUndefined();
		expect(hiddenScheduleStatus).toBeUndefined();
		expect(hiddenAgentScheduleStatus).toBeUndefined();
		expect(hiddenScheduleStatusConversationNotice).toBeUndefined();
		expect(hiddenAgentScheduleTime).toBeUndefined();
		expect(hiddenAgentScheduleTimezone).toBeUndefined();
		expect(hiddenAgentPostAsBot).toBeUndefined();
		expect(hiddenAgentBotUniqueName).toBeUndefined();
		expect(botDisplayName).toBeUndefined();
		expect(botImage).toBeUndefined();
	});
});
