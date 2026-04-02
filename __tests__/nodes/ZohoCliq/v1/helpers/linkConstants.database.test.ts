import {
	AI_AGENT_TOOL_DOC_LINKS,
	DATABASE_CREATE_AGENT_DETAILS_LINK,
	DATABASE_DELETE_AGENT_DETAILS_LINK,
	DATABASE_GET_AGENT_DETAILS_LINK,
	DATABASE_LIST_AGENT_DETAILS_LINK,
	DATABASE_UPDATE_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants database links', () => {
	it('should expose Database AI guide links directly and through the grouped registry', () => {
		expect(DATABASE_CREATE_AGENT_DETAILS_LINK).toContain('/Database/create.md');
		expect(DATABASE_DELETE_AGENT_DETAILS_LINK).toContain('/Database/delete.md');
		expect(DATABASE_GET_AGENT_DETAILS_LINK).toContain('/Database/get.md');
		expect(DATABASE_LIST_AGENT_DETAILS_LINK).toContain('/Database/list.md');
		expect(DATABASE_UPDATE_AGENT_DETAILS_LINK).toContain('/Database/update.md');

		expect(AI_AGENT_TOOL_DOC_LINKS.database).toEqual({
			create: DATABASE_CREATE_AGENT_DETAILS_LINK,
			delete: DATABASE_DELETE_AGENT_DETAILS_LINK,
			get: DATABASE_GET_AGENT_DETAILS_LINK,
			list: DATABASE_LIST_AGENT_DETAILS_LINK,
			update: DATABASE_UPDATE_AGENT_DETAILS_LINK,
		});
	});
});
