import {
	AI_AGENT_TOOL_DOC_LINKS,
	REMOTE_WORK_CHECK_IN_AGENT_DETAILS_LINK,
	REMOTE_WORK_CHECK_OUT_AGENT_DETAILS_LINK,
	REMOTE_WORK_GET_STATUS_AGENT_DETAILS_LINK,
} from '../../../../../nodes/ZohoCliq/v1/helpers/linkConstants';

describe('ZohoCliq - linkConstants remoteWork links', () => {
	it('should expose RemoteWork AI guide links directly and through the grouped registry', () => {
		expect(REMOTE_WORK_CHECK_IN_AGENT_DETAILS_LINK).toContain('/RemoteWork/check-in.md');
		expect(REMOTE_WORK_CHECK_OUT_AGENT_DETAILS_LINK).toContain('/RemoteWork/check-out.md');
		expect(REMOTE_WORK_GET_STATUS_AGENT_DETAILS_LINK).toContain('/RemoteWork/get-status.md');

		expect(AI_AGENT_TOOL_DOC_LINKS.remoteWork).toEqual({
			checkIn: REMOTE_WORK_CHECK_IN_AGENT_DETAILS_LINK,
			checkOut: REMOTE_WORK_CHECK_OUT_AGENT_DETAILS_LINK,
			getStatus: REMOTE_WORK_GET_STATUS_AGENT_DETAILS_LINK,
		});
	});
});
