import { getSimplifyConfig } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/simplifyOutput';
import type { SimplifyConfigKey } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/simplifyOutput';

const ALL_CONFIG_KEYS: SimplifyConfigKey[] = [
	'user',
	'userTeam',
	'userField',
	'userFieldListItem',
	'department',
	'departmentListItem',
	'remoteWorkStatus',
	'remoteWorkCheck',
	'chatListItem',
	'channel',
	'channelListItem',
	'threadListItem',
	'threadMainMessage',
	'messageListItem',
	'scheduledMessage',
	'callMeetingItem',
	'eventCalendar',
	'event',
];

describe('Simplify Output Configs', () => {
	describe.each(ALL_CONFIG_KEYS)('config: %s', (key) => {
		const config = getSimplifyConfig(key);

		it('should have a non-empty idKey', () => {
			expect(typeof config.idKey).toBe('string');
			expect(config.idKey.length).toBeGreaterThan(0);
		});

		it('should have non-empty simplifiedKeys array', () => {
			expect(Array.isArray(config.simplifiedKeys)).toBe(true);
			expect(config.simplifiedKeys.length).toBeGreaterThan(0);
		});

		it('should have unique simplifiedKeys', () => {
			const unique = new Set(config.simplifiedKeys);
			expect(unique.size).toBe(config.simplifiedKeys.length);
		});

		it('should have non-empty selectableFields array', () => {
			expect(Array.isArray(config.selectableFields)).toBe(true);
			expect(config.selectableFields.length).toBeGreaterThan(0);
		});

		it('should have unique selectable field values', () => {
			const values = config.selectableFields.map((f) => f.value);
			const unique = new Set(values);
			expect(unique.size).toBe(values.length);
		});

		it('should have name and value for each selectable field', () => {
			for (const field of config.selectableFields) {
				expect(typeof field.name).toBe('string');
				expect(field.name.length).toBeGreaterThan(0);
				expect(typeof field.value).toBe('string');
				expect(field.value.length).toBeGreaterThan(0);
			}
		});

		it('should have flattenMap with valid string values if present', () => {
			if (config.flattenMap) {
				for (const [dotPath, outputKey] of Object.entries(config.flattenMap)) {
					expect(typeof dotPath).toBe('string');
					expect(dotPath).toContain('.');
					expect(typeof outputKey).toBe('string');
					expect(outputKey.length).toBeGreaterThan(0);
				}
			}
		});

		it('should not have flattenMap output keys colliding with simplifiedKeys', () => {
			if (config.flattenMap) {
				const simplifiedSet = new Set(config.simplifiedKeys);
				for (const outputKey of Object.values(config.flattenMap)) {
					expect(simplifiedSet.has(outputKey)).toBe(false);
				}
			}
		});
	});

	it('should return the same config for shared shapes', () => {
		// userField and userFieldListItem share the same field set
		const userField = getSimplifyConfig('userField');
		const userFieldListItem = getSimplifyConfig('userFieldListItem');
		expect(userField.idKey).toBe(userFieldListItem.idKey);
		expect(userField.simplifiedKeys).toEqual(userFieldListItem.simplifiedKeys);

		// department and departmentListItem share the same field set
		const department = getSimplifyConfig('department');
		const departmentListItem = getSimplifyConfig('departmentListItem');
		expect(department.idKey).toBe(departmentListItem.idKey);
		expect(department.simplifiedKeys).toEqual(departmentListItem.simplifiedKeys);

		// channel and channelListItem share the same field set
		const channel = getSimplifyConfig('channel');
		const channelListItem = getSimplifyConfig('channelListItem');
		expect(channel.idKey).toBe(channelListItem.idKey);
		expect(channel.simplifiedKeys).toEqual(channelListItem.simplifiedKeys);
	});
});
