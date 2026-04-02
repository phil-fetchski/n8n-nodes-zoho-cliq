import {
	AI_AGENT_TOOL_DOC_LINKS,
	TEAM_ADD_MEMBERS_AGENT_DETAILS_LINK,
	TEAM_CREATE_AGENT_DETAILS_LINK,
	TEAM_DELETE_AGENT_DETAILS_LINK,
	TEAM_GET_AGENT_DETAILS_LINK,
	TEAM_GET_MEMBERS_AGENT_DETAILS_LINK,
	TEAM_LIST_AGENT_DETAILS_LINK,
	TEAM_REMOVE_MEMBERS_AGENT_DETAILS_LINK,
	TEAM_UPDATE_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants team links', () => {
	it('should expose Team AI guide links directly and through the grouped registry', () => {
		expect(new URL(TEAM_ADD_MEMBERS_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/add-members.md',
		);
		expect(new URL(TEAM_CREATE_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/create.md',
		);
		expect(new URL(TEAM_DELETE_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/delete.md',
		);
		expect(new URL(TEAM_GET_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/get.md',
		);
		expect(new URL(TEAM_GET_MEMBERS_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/get-members.md',
		);
		expect(new URL(TEAM_LIST_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/list.md',
		);
		expect(new URL(TEAM_REMOVE_MEMBERS_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/remove-members.md',
		);
		expect(new URL(TEAM_UPDATE_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Team/update.md',
		);

		expect(AI_AGENT_TOOL_DOC_LINKS.team).toEqual({
			addMembers: TEAM_ADD_MEMBERS_AGENT_DETAILS_LINK,
			create: TEAM_CREATE_AGENT_DETAILS_LINK,
			delete: TEAM_DELETE_AGENT_DETAILS_LINK,
			get: TEAM_GET_AGENT_DETAILS_LINK,
			getMembers: TEAM_GET_MEMBERS_AGENT_DETAILS_LINK,
			list: TEAM_LIST_AGENT_DETAILS_LINK,
			removeMembers: TEAM_REMOVE_MEMBERS_AGENT_DETAILS_LINK,
			update: TEAM_UPDATE_AGENT_DETAILS_LINK,
		});
	});
});
