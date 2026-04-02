import {
	AI_AGENT_TOOL_DOC_LINKS,
	CHAT_GET_MEMBERS_AGENT_DETAILS_LINK,
	CHAT_GET_PINNED_STICKY_MESSAGE_AGENT_DETAILS_LINK,
	CHAT_LEAVE_AGENT_DETAILS_LINK,
	CHAT_LIST_AGENT_DETAILS_LINK,
	CHAT_MUTE_AGENT_DETAILS_LINK,
	CHAT_PIN_STICKY_MESSAGE_AGENT_DETAILS_LINK,
	CHAT_UNMUTE_AGENT_DETAILS_LINK,
	CHAT_UNPIN_STICKY_MESSAGE_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants chat links', () => {
	it('should expose Chat AI guide links directly and through the grouped registry', () => {
		expect(CHAT_GET_MEMBERS_AGENT_DETAILS_LINK).toContain('/Chat/get-members.md');
		expect(CHAT_GET_PINNED_STICKY_MESSAGE_AGENT_DETAILS_LINK).toContain(
			'/Chat/get-pinned-sticky-message.md',
		);
		expect(CHAT_LEAVE_AGENT_DETAILS_LINK).toContain('/Chat/leave.md');
		expect(CHAT_LIST_AGENT_DETAILS_LINK).toContain('/Chat/list.md');
		expect(CHAT_MUTE_AGENT_DETAILS_LINK).toContain('/Chat/mute.md');
		expect(CHAT_PIN_STICKY_MESSAGE_AGENT_DETAILS_LINK).toContain('/Chat/pin-sticky-message.md');
		expect(CHAT_UNMUTE_AGENT_DETAILS_LINK).toContain('/Chat/unmute.md');
		expect(CHAT_UNPIN_STICKY_MESSAGE_AGENT_DETAILS_LINK).toContain('/Chat/unpin-sticky-message.md');

		expect(AI_AGENT_TOOL_DOC_LINKS.chat).toEqual({
			getMembers: CHAT_GET_MEMBERS_AGENT_DETAILS_LINK,
			getPinnedStickyMessage: CHAT_GET_PINNED_STICKY_MESSAGE_AGENT_DETAILS_LINK,
			leave: CHAT_LEAVE_AGENT_DETAILS_LINK,
			list: CHAT_LIST_AGENT_DETAILS_LINK,
			mute: CHAT_MUTE_AGENT_DETAILS_LINK,
			pinStickyMessage: CHAT_PIN_STICKY_MESSAGE_AGENT_DETAILS_LINK,
			unmute: CHAT_UNMUTE_AGENT_DETAILS_LINK,
			unpinStickyMessage: CHAT_UNPIN_STICKY_MESSAGE_AGENT_DETAILS_LINK,
		});
	});
});
