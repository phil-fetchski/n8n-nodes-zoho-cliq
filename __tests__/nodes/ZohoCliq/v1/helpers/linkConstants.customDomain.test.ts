import {
	AI_AGENT_TOOL_DOC_LINKS,
	AI_AGENT_TOOL_DESCRIPTIONS_BASE_URL,
	CUSTOM_DOMAIN_ADD_AGENT_DETAILS_LINK,
	CUSTOM_DOMAIN_DELETE_AGENT_DETAILS_LINK,
	CUSTOM_DOMAIN_GET_AGENT_DETAILS_LINK,
	CUSTOM_DOMAIN_VERIFY_AGENT_DETAILS_LINK,
	GITHUB_REPO_BASE_URL,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants customDomain links', () => {
	it('should expose CustomDomain AI guide links directly and through the grouped registry', () => {
		expect(AI_AGENT_TOOL_DESCRIPTIONS_BASE_URL).toBe(
			`${GITHUB_REPO_BASE_URL}/blob/main/AiAgentToolDescriptions/Resources`,
		);
		expect(CUSTOM_DOMAIN_ADD_AGENT_DETAILS_LINK).toBe(
			`${AI_AGENT_TOOL_DESCRIPTIONS_BASE_URL}/CustomDomain/add.md`,
		);
		expect(CUSTOM_DOMAIN_DELETE_AGENT_DETAILS_LINK).toBe(
			`${AI_AGENT_TOOL_DESCRIPTIONS_BASE_URL}/CustomDomain/delete.md`,
		);
		expect(CUSTOM_DOMAIN_GET_AGENT_DETAILS_LINK).toBe(
			`${AI_AGENT_TOOL_DESCRIPTIONS_BASE_URL}/CustomDomain/get.md`,
		);
		expect(CUSTOM_DOMAIN_VERIFY_AGENT_DETAILS_LINK).toBe(
			`${AI_AGENT_TOOL_DESCRIPTIONS_BASE_URL}/CustomDomain/verify.md`,
		);

		expect(AI_AGENT_TOOL_DOC_LINKS.customDomain).toEqual({
			add: CUSTOM_DOMAIN_ADD_AGENT_DETAILS_LINK,
			delete: CUSTOM_DOMAIN_DELETE_AGENT_DETAILS_LINK,
			get: CUSTOM_DOMAIN_GET_AGENT_DETAILS_LINK,
			verify: CUSTOM_DOMAIN_VERIFY_AGENT_DETAILS_LINK,
		});
	});
});
