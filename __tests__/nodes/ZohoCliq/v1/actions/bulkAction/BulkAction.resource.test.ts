import * as bulkAction from '../../../../../../nodes/ZohoCliq/v1/actions/bulkAction/BulkAction.resource';

describe('ZohoCliq - BulkAction Resource', () => {
	it('should expose all expected operations', () => {
		expect(bulkAction).toHaveProperty('exportConversations');
		expect(bulkAction).toHaveProperty('exportChannels');
		expect(bulkAction).toHaveProperty('exportConversationMembers');
		expect(bulkAction).toHaveProperty('exportMessages');
	});

	it('should define operation selector for bulkAction resource', () => {
		const operationProperty = bulkAction.description.find((prop) => prop.name === 'operation');

		expect(operationProperty).toBeDefined();
		expect(operationProperty?.displayOptions?.show?.resource).toEqual(['bulkAction']);
		expect(operationProperty?.type).toBe('options');
		expect(operationProperty?.default).toBe('exportConversations');
	});

	it('should include admin-only notice', () => {
		const noticeProperty = bulkAction.description.find(
			(prop) => prop.name === 'bulkActionAdminOnlyNotice',
		);

		expect(noticeProperty).toBeDefined();
		expect(noticeProperty?.type).toBe('notice');
		expect(String(noticeProperty?.displayName)).toContain('Organization Admin (Super Admin)');
		expect(String(noticeProperty?.displayName)).toContain('Org Admin (Organization APIs)');
	});
});
