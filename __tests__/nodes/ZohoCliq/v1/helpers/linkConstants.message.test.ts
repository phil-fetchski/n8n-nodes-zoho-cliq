import {
	AI_AGENT_TOOL_DOC_LINKS,
	MESSAGE_DELETE_AGENT_DETAILS_LINK,
	MESSAGE_EDIT_AGENT_DETAILS_LINK,
	MESSAGE_GET_AGENT_DETAILS_LINK,
	MESSAGE_COMPONENT_BUILDER_AGENT_CARD_PAYLOAD_AGENT_DETAILS_LINK,
	MESSAGE_POST_AGENT_DETAILS_LINK,
	MESSAGE_RETRIEVE_AGENT_DETAILS_LINK,
	MESSAGE_SCHEDULE_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants message links', () => {
	it('should expose Message AI guide links directly and through the grouped registry', () => {
		expect(MESSAGE_DELETE_AGENT_DETAILS_LINK).toContain('/Message/delete.md');
		expect(MESSAGE_EDIT_AGENT_DETAILS_LINK).toContain('/Message/edit.md');
		expect(MESSAGE_GET_AGENT_DETAILS_LINK).toContain('/Message/get.md');
		expect(MESSAGE_POST_AGENT_DETAILS_LINK).toContain('/Message/post.md');
		expect(MESSAGE_RETRIEVE_AGENT_DETAILS_LINK).toContain('/Message/retrieve.md');
		expect(MESSAGE_SCHEDULE_AGENT_DETAILS_LINK).toContain('/Message/schedule-message.md');
		expect(MESSAGE_COMPONENT_BUILDER_AGENT_CARD_PAYLOAD_AGENT_DETAILS_LINK).toContain(
			'/MessageComponentBuilder/agent-card-payload-builder.md',
		);

		expect(AI_AGENT_TOOL_DOC_LINKS.message).toEqual({
			delete: MESSAGE_DELETE_AGENT_DETAILS_LINK,
			edit: MESSAGE_EDIT_AGENT_DETAILS_LINK,
			get: MESSAGE_GET_AGENT_DETAILS_LINK,
			post: MESSAGE_POST_AGENT_DETAILS_LINK,
			retrieve: MESSAGE_RETRIEVE_AGENT_DETAILS_LINK,
			scheduleMessage: MESSAGE_SCHEDULE_AGENT_DETAILS_LINK,
		});
		expect(AI_AGENT_TOOL_DOC_LINKS.messageComponentBuilder).toEqual({
			buildAgentCardPayload: MESSAGE_COMPONENT_BUILDER_AGENT_CARD_PAYLOAD_AGENT_DETAILS_LINK,
		});
	});
});
