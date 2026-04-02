import * as markIncomplete from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/markIncomplete.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { runMarkReminderLifecycleOperationTests } from './markReminderLifecycleShared';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

runMarkReminderLifecycleOperationTests({
	title: 'ZohoCliq - Reminders - Mark Incomplete Operation',
	operationModule: markIncomplete,
	operationKey: 'markIncomplete',
	endpointSuffix: '/incomplete',
	completed: false,
	docsNoticeName: 'markReminderIncompleteDocsNotice',
	aiGuideNoticeName: 'markReminderIncompleteAiToolGuideNotice',
	apiErrorMessage: 'Cannot mark this mine reminder as incomplete',
	mockZohoCliqApiRequest: transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>,
});
