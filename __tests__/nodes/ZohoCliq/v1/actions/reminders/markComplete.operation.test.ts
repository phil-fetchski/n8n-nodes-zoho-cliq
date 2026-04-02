import * as markComplete from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/markComplete.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';
import { runMarkReminderLifecycleOperationTests } from './markReminderLifecycleShared';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

runMarkReminderLifecycleOperationTests({
	title: 'ZohoCliq - Reminders - Mark Complete Operation',
	operationModule: markComplete,
	operationKey: 'markComplete',
	endpointSuffix: '/complete',
	completed: true,
	docsNoticeName: 'markReminderCompleteDocsNotice',
	aiGuideNoticeName: 'markReminderCompleteAiToolGuideNotice',
	apiErrorMessage: 'Cannot mark this mine reminder as complete',
	mockZohoCliqApiRequest: transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>,
});
