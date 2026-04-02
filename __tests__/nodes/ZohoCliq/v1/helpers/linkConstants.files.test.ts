import {
	AI_AGENT_TOOL_DOC_LINKS,
	FILES_GET_AGENT_DETAILS_LINK,
	FILES_SHARE_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants files links', () => {
	it('should expose Files AI guide links directly and through the grouped registry', () => {
		expect(FILES_GET_AGENT_DETAILS_LINK).toContain('/Files/get-file.md');
		expect(FILES_SHARE_AGENT_DETAILS_LINK).toContain('/Files/share-files.md');

		expect(AI_AGENT_TOOL_DOC_LINKS.files).toEqual({
			getFile: FILES_GET_AGENT_DETAILS_LINK,
			shareFile: FILES_SHARE_AGENT_DETAILS_LINK,
		});
	});
});
