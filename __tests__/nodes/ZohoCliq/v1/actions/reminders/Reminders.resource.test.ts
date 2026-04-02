import * as reminders from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/Reminders.resource';
import * as clearCompleted from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/clearCompleted.operation';
import * as del from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/delete.operation';
import * as deleteBatch from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/deleteBatch.operation';
import * as dismissSnooze from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/dismissSnooze.operation';
import * as markComplete from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/markComplete.operation';
import * as markIncomplete from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/markIncomplete.operation';
import * as removeAssignees from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/removeAssignees.operation';
import * as snooze from '../../../../../../nodes/ZohoCliq/v1/actions/reminders/snooze.operation';

describe('ZohoCliq - Reminders Resource', () => {
	it('should expose all expected operations', () => {
		expect(reminders).toHaveProperty('list');
		expect(reminders).toHaveProperty('create');
		expect(reminders).toHaveProperty('get');
		expect(reminders).toHaveProperty('update');
		expect(reminders).toHaveProperty('delete');
		expect(reminders).toHaveProperty('deleteBatch');
		expect(reminders).toHaveProperty('clearCompleted');
		expect(reminders).toHaveProperty('markComplete');
		expect(reminders).toHaveProperty('markIncomplete');
		expect(reminders).toHaveProperty('snooze');
		expect(reminders).toHaveProperty('dismissSnooze');
		expect(reminders).toHaveProperty('assign');
		expect(reminders).toHaveProperty('removeAssignees');
		expect(reminders).toHaveProperty('remindAssignee');
		expect(reminders).toHaveProperty('remindAssignees');
		expect(reminders).not.toHaveProperty('updateTaskDateTime');
	});

	it('should define operation selector for reminder resource', () => {
		const operationProperty = reminders.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['reminder']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('list');

		const options = (operationProperty?.options ?? []) as Array<{ value?: string }>;
		const optionValues = options.map((opt) => opt.value);
		expect(optionValues).toEqual(
			expect.arrayContaining([
				'list',
				'create',
				'get',
				'update',
				'delete',
				'deleteBatch',
				'clearCompleted',
				'markComplete',
				'markIncomplete',
				'snooze',
				'dismissSnooze',
				'assign',
				'removeAssignees',
				'remindAssignee',
				'remindAssignees',
			]),
		);
		expect(optionValues).not.toContain('updateTaskDateTime');
	});

	it('should keep enhanced-output toggles immediately above the docs notices for reminder lifecycle actions', () => {
		const operations = [
			clearCompleted.description,
			del.description,
			deleteBatch.description,
			dismissSnooze.description,
			markComplete.description,
			markIncomplete.description,
			removeAssignees.description,
			snooze.description,
		];

		for (const description of operations) {
			expect(description[description.length - 3]?.name).toBe('includeEnhancedOutput');
		}
	});
});
