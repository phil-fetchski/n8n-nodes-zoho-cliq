import {
	AI_AGENT_TOOL_DOC_LINKS,
	CUSTOM_EMAIL_UPDATE_MAIL_CONFIGURATION_AGENT_DETAILS_LINK,
	CUSTOM_EMAIL_VERIFY_CUSTOM_EMAIL_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants customEmail links', () => {
	it('should expose CustomEmail AI guide links directly and through the grouped registry', () => {
		expect(new URL(CUSTOM_EMAIL_UPDATE_MAIL_CONFIGURATION_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/CustomEmail/update-mail-configuration.md',
		);
		expect(new URL(CUSTOM_EMAIL_VERIFY_CUSTOM_EMAIL_AGENT_DETAILS_LINK).pathname).toBe(
			'/phil-fetchski/n8n-nodes-zoho-cliq/blob/main/AiAgentToolDescriptions/Resources/CustomEmail/verify-custom-email.md',
		);

		expect(AI_AGENT_TOOL_DOC_LINKS.customEmail).toEqual({
			updateMailConfiguration: CUSTOM_EMAIL_UPDATE_MAIL_CONFIGURATION_AGENT_DETAILS_LINK,
			verifyCustomEmail: CUSTOM_EMAIL_VERIFY_CUSTOM_EMAIL_AGENT_DETAILS_LINK,
		});
	});
});
