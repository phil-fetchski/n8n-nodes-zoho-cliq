import {
	AI_AGENT_TOOL_DOC_LINKS,
	DESIGNATION_ADD_MEMBERS_AGENT_DETAILS_LINK,
	DESIGNATION_CREATE_AGENT_DETAILS_LINK,
	DESIGNATION_DELETE_AGENT_DETAILS_LINK,
	DESIGNATION_GET_AGENT_DETAILS_LINK,
	DESIGNATION_GET_MEMBERS_AGENT_DETAILS_LINK,
	DESIGNATION_LIST_AGENT_DETAILS_LINK,
	DESIGNATION_REMOVE_MEMBERS_AGENT_DETAILS_LINK,
	DESIGNATION_UPDATE_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants designation links', () => {
	it('should expose Designation AI guide links directly and through the grouped registry', () => {
		expect(new URL(DESIGNATION_ADD_MEMBERS_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/add-members.md',
		);
		expect(new URL(DESIGNATION_CREATE_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/create.md',
		);
		expect(new URL(DESIGNATION_DELETE_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/delete.md',
		);
		expect(new URL(DESIGNATION_GET_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/get.md',
		);
		expect(new URL(DESIGNATION_GET_MEMBERS_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/get-members.md',
		);
		expect(new URL(DESIGNATION_LIST_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/list.md',
		);
		expect(new URL(DESIGNATION_REMOVE_MEMBERS_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/remove-members.md',
		);
		expect(new URL(DESIGNATION_UPDATE_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/Designation/update.md',
		);

		expect(AI_AGENT_TOOL_DOC_LINKS.designation).toEqual({
			addMembers: DESIGNATION_ADD_MEMBERS_AGENT_DETAILS_LINK,
			create: DESIGNATION_CREATE_AGENT_DETAILS_LINK,
			delete: DESIGNATION_DELETE_AGENT_DETAILS_LINK,
			get: DESIGNATION_GET_AGENT_DETAILS_LINK,
			getMembers: DESIGNATION_GET_MEMBERS_AGENT_DETAILS_LINK,
			list: DESIGNATION_LIST_AGENT_DETAILS_LINK,
			removeMembers: DESIGNATION_REMOVE_MEMBERS_AGENT_DETAILS_LINK,
			update: DESIGNATION_UPDATE_AGENT_DETAILS_LINK,
		});
	});
});
