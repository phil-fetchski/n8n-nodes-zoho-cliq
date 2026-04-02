import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';

import {
	applySimplifyMode,
	applySimplifyModeToList,
	resolveSimplifyMode,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/simplifyOutput';
import type { ISimplifyConfig } from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/simplifyOutput';

// ---------------------------------------------------------------------------
// Test config
// ---------------------------------------------------------------------------

const testConfig: ISimplifyConfig = {
	idKey: 'id',
	simplifiedKeys: ['id', 'name', 'email'],
	flattenMap: {
		'department.name': 'department_name',
		'nested.deep.value': 'deep_value',
	},
	selectableFields: [
		{ name: 'ID', value: 'id' },
		{ name: 'Name', value: 'name' },
		{ name: 'Email', value: 'email' },
		{ name: 'Phone', value: 'phone' },
		{ name: 'Department', value: 'department' },
	],
};

const noFlattenConfig: ISimplifyConfig = {
	idKey: 'chat_id',
	simplifiedKeys: ['chat_id', 'title', 'status'],
	selectableFields: [
		{ name: 'Chat ID', value: 'chat_id' },
		{ name: 'Title', value: 'title' },
		{ name: 'Status', value: 'status' },
		{ name: 'Extra', value: 'extra' },
	],
};

// ---------------------------------------------------------------------------
// resolveSimplifyMode
// ---------------------------------------------------------------------------

describe('resolveSimplifyMode', () => {
	function createContext(
		simplify: boolean,
		simplifyMode: string = 'simplified',
		simplifyFields: unknown = [],
	): IExecuteFunctions {
		return {
			getNodeParameter: jest.fn((param: string) => {
				if (param === 'simplify') return simplify;
				if (param === 'simplifyMode') return simplifyMode;
				if (param === 'simplifyFields') return simplifyFields;
				return undefined;
			}),
		} as unknown as IExecuteFunctions;
	}

	it('should return raw mode when simplify toggle is OFF', () => {
		const result = resolveSimplifyMode(createContext(false), 0);
		expect(result).toEqual({ mode: 'raw', selectedFields: [] });
	});

	it('should not read simplifyMode when simplify toggle is OFF', () => {
		const ctx = createContext(false, 'selectedFields', ['id']);
		const result = resolveSimplifyMode(ctx, 0);
		expect(result).toEqual({ mode: 'raw', selectedFields: [] });
		expect(ctx.getNodeParameter).not.toHaveBeenCalledWith(
			'simplifyMode',
			expect.anything(),
			expect.anything(),
		);
	});

	it('should return simplified mode when toggle ON and mode is simplified', () => {
		const result = resolveSimplifyMode(createContext(true, 'simplified'), 0);
		expect(result).toEqual({ mode: 'simplified', selectedFields: [] });
	});

	it('should return raw mode when toggle ON and mode is raw', () => {
		const result = resolveSimplifyMode(createContext(true, 'raw'), 0);
		expect(result).toEqual({ mode: 'raw', selectedFields: [] });
	});

	it('should return selectedFields mode with array fields', () => {
		const result = resolveSimplifyMode(createContext(true, 'selectedFields', ['id', 'name']), 0);
		expect(result).toEqual({ mode: 'selectedFields', selectedFields: ['id', 'name'] });
	});

	it('should parse CSV string for selectedFields', () => {
		const result = resolveSimplifyMode(createContext(true, 'selectedFields', 'id, name, email'), 0);
		expect(result).toEqual({ mode: 'selectedFields', selectedFields: ['id', 'name', 'email'] });
	});

	it('should parse stringified JSON array for selectedFields', () => {
		const result = resolveSimplifyMode(
			createContext(true, 'selectedFields', '["id", "name", "email"]'),
			0,
		);
		expect(result).toEqual({ mode: 'selectedFields', selectedFields: ['id', 'name', 'email'] });
	});

	it('should handle stringified JSON array with extra whitespace', () => {
		const result = resolveSimplifyMode(createContext(true, 'selectedFields', ' ["id","name"] '), 0);
		expect(result).toEqual({ mode: 'selectedFields', selectedFields: ['id', 'name'] });
	});

	it('should handle malformed JSON array gracefully', () => {
		const result = resolveSimplifyMode(createContext(true, 'selectedFields', '[invalid json'), 0);
		expect(result).toEqual({ mode: 'selectedFields', selectedFields: [] });
	});

	it('should handle empty CSV string', () => {
		const result = resolveSimplifyMode(createContext(true, 'selectedFields', ''), 0);
		expect(result).toEqual({ mode: 'selectedFields', selectedFields: [] });
	});
});

// ---------------------------------------------------------------------------
// applySimplifyMode — raw
// ---------------------------------------------------------------------------

describe('applySimplifyMode — raw', () => {
	it('should return the response as-is', () => {
		const response: IDataObject = {
			id: '1',
			name: 'Test',
			email: 'test@example.com',
			phone: '555-1234',
			department: { name: 'Engineering', code: 'ENG' },
			extra_field: 'extra',
		};
		const result = applySimplifyMode(response, 'raw', testConfig);
		expect(result).toBe(response);
	});
});

// ---------------------------------------------------------------------------
// applySimplifyMode — unwrapKey
// ---------------------------------------------------------------------------

describe('applySimplifyMode — unwrapKey', () => {
	it('should unwrap data key in simplified mode', () => {
		const response: IDataObject = {
			data: { id: '1', name: 'Alice', email: 'a@b.com', phone: '555' },
		};
		const result = applySimplifyMode(response, 'simplified', testConfig, undefined, 'data');
		expect(result).toEqual({ id: '1', name: 'Alice', email: 'a@b.com' });
	});

	it('should unwrap data key in selectedFields mode', () => {
		const response: IDataObject = {
			data: { id: '1', name: 'Alice', email: 'a@b.com', phone: '555' },
		};
		const result = applySimplifyMode(response, 'selectedFields', testConfig, ['email'], 'data');
		expect(result).toEqual({ id: '1', email: 'a@b.com' });
	});

	it('should return full wrapper in raw mode even with unwrapKey', () => {
		const response: IDataObject = {
			data: { id: '1', name: 'Alice' },
		};
		const result = applySimplifyMode(response, 'raw', testConfig, undefined, 'data');
		expect(result).toBe(response);
	});

	it('should flatten nested paths from unwrapped object', () => {
		const response: IDataObject = {
			data: { id: '1', name: 'Alice', department: { name: 'Eng' } },
		};
		const result = applySimplifyMode(response, 'simplified', testConfig, undefined, 'data');
		expect(result).toEqual({ id: '1', name: 'Alice', department_name: 'Eng' });
	});

	it('should fall back to response when unwrapKey target is not an object', () => {
		const response: IDataObject = { data: 'not-an-object', id: '1', name: 'Test' };
		const result = applySimplifyMode(response, 'simplified', testConfig, undefined, 'data');
		expect(result).toEqual({ id: '1', name: 'Test' });
	});

	it('should fall back to response when unwrapKey is missing', () => {
		const response: IDataObject = { id: '1', name: 'Test', email: 'a@b.com' };
		const result = applySimplifyMode(response, 'simplified', testConfig, undefined, 'data');
		expect(result).toEqual({ id: '1', name: 'Test', email: 'a@b.com' });
	});
});

// ---------------------------------------------------------------------------
// applySimplifyMode — simplified
// ---------------------------------------------------------------------------

describe('applySimplifyMode — simplified', () => {
	it('should keep only simplified keys', () => {
		const response: IDataObject = {
			id: '1',
			name: 'Test',
			email: 'test@example.com',
			phone: '555-1234',
			extra: 'removed',
		};
		const result = applySimplifyMode(response, 'simplified', testConfig);
		expect(result).toEqual({ id: '1', name: 'Test', email: 'test@example.com' });
	});

	it('should flatten nested objects', () => {
		const response: IDataObject = {
			id: '1',
			name: 'Test',
			email: 'test@example.com',
			department: { name: 'Engineering', code: 'ENG' },
		};
		const result = applySimplifyMode(response, 'simplified', testConfig);
		expect(result).toEqual({
			id: '1',
			name: 'Test',
			email: 'test@example.com',
			department_name: 'Engineering',
		});
	});

	it('should handle deeply nested flatten paths', () => {
		const response: IDataObject = {
			id: '1',
			name: 'Test',
			nested: { deep: { value: 42 } },
		};
		const result = applySimplifyMode(response, 'simplified', testConfig);
		expect(result).toEqual({ id: '1', name: 'Test', deep_value: 42 });
	});

	it('should skip missing simplified keys', () => {
		const response: IDataObject = { id: '1' };
		const result = applySimplifyMode(response, 'simplified', testConfig);
		expect(result).toEqual({ id: '1' });
	});

	it('should skip missing flatten paths', () => {
		const response: IDataObject = { id: '1', name: 'Test' };
		const result = applySimplifyMode(response, 'simplified', testConfig);
		expect(result).toEqual({ id: '1', name: 'Test' });
	});

	it('should work without flattenMap', () => {
		const response: IDataObject = { chat_id: 'c1', title: 'Chat', status: 'active', extra: 'x' };
		const result = applySimplifyMode(response, 'simplified', noFlattenConfig);
		expect(result).toEqual({ chat_id: 'c1', title: 'Chat', status: 'active' });
	});
});

// ---------------------------------------------------------------------------
// applySimplifyMode — selectedFields
// ---------------------------------------------------------------------------

describe('applySimplifyMode — selectedFields', () => {
	it('should keep only selected fields plus ID', () => {
		const response: IDataObject = {
			id: '1',
			name: 'Test',
			email: 'test@example.com',
			phone: '555-1234',
		};
		const result = applySimplifyMode(response, 'selectedFields', testConfig, ['name', 'phone']);
		expect(result).toEqual({ id: '1', name: 'Test', phone: '555-1234' });
	});

	it('should always include ID key even if not in selectedFields', () => {
		const response: IDataObject = { id: '1', name: 'Test', email: 'test@example.com' };
		const result = applySimplifyMode(response, 'selectedFields', testConfig, ['email']);
		expect(result).toEqual({ id: '1', email: 'test@example.com' });
	});

	it('should return only ID when no fields selected', () => {
		const response: IDataObject = { id: '1', name: 'Test' };
		const result = applySimplifyMode(response, 'selectedFields', testConfig, []);
		expect(result).toEqual({ id: '1' });
	});

	it('should skip fields not present in response', () => {
		const response: IDataObject = { id: '1' };
		const result = applySimplifyMode(response, 'selectedFields', testConfig, ['name', 'phone']);
		expect(result).toEqual({ id: '1' });
	});

	it('should handle nested objects in selected fields', () => {
		const response: IDataObject = {
			id: '1',
			department: { name: 'Eng', code: 'ENG' },
		};
		const result = applySimplifyMode(response, 'selectedFields', testConfig, ['department']);
		expect(result).toEqual({ id: '1', department: { name: 'Eng', code: 'ENG' } });
	});

	it('should handle undefined selectedFields parameter', () => {
		const response: IDataObject = { id: '1', name: 'Test' };
		const result = applySimplifyMode(response, 'selectedFields', testConfig);
		expect(result).toEqual({ id: '1' });
	});

	it('should drop fields not in config selectableFields allow-list', () => {
		const response: IDataObject = {
			id: '1',
			name: 'Test',
			secret_internal_field: 'should_not_appear',
		};
		const result = applySimplifyMode(response, 'selectedFields', testConfig, [
			'name',
			'secret_internal_field',
		]);
		expect(result).toEqual({ id: '1', name: 'Test' });
		expect(result).not.toHaveProperty('secret_internal_field');
	});

	it('should not inject ID key when config idKey is empty', () => {
		const emptyIdConfig: ISimplifyConfig = {
			idKey: '',
			simplifiedKeys: ['name'],
			selectableFields: [{ name: 'Name', value: 'name' }],
		};
		const response: IDataObject = { id: '1', name: 'Test' };
		const result = applySimplifyMode(response, 'selectedFields', emptyIdConfig, ['name']);
		expect(result).toEqual({ name: 'Test' });
		expect(result).not.toHaveProperty('id');
	});
});

// ---------------------------------------------------------------------------
// applySimplifyModeToList
// ---------------------------------------------------------------------------

describe('applySimplifyModeToList', () => {
	it('should simplify each item in the array', () => {
		const response: IDataObject = {
			data: [
				{ id: '1', name: 'Alice', email: 'a@b.com', phone: '111' },
				{ id: '2', name: 'Bob', email: 'b@b.com', phone: '222' },
			],
		};
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toEqual([
			{ id: '1', name: 'Alice', email: 'a@b.com' },
			{ id: '2', name: 'Bob', email: 'b@b.com' },
		]);
	});

	it('should return the full API response wrapper as a single item in raw mode', () => {
		const response: IDataObject = {
			data: [
				{ id: '1', name: 'Alice', extra: 'x' },
				{ id: '2', name: 'Bob', extra: 'y' },
			],
			has_more: true,
			next_token: 'abc',
		};
		const result = applySimplifyModeToList(response, 'data', 'raw', testConfig);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(response);
	});

	it('should prepend a _pagination item as the first element when pagination keys are present', () => {
		const response: IDataObject = {
			data: [
				{ id: '1', name: 'Alice' },
				{ id: '2', name: 'Bob' },
			],
			next_token: 'abc123',
			has_more: true,
		};
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({ _pagination: { next_token: 'abc123', has_more: true } });
		expect(result[1]).toEqual({ id: '1', name: 'Alice' });
		expect(result[2]).toEqual({ id: '2', name: 'Bob' });
	});

	it('should include sync_token in the _pagination item', () => {
		const response: IDataObject = {
			data: [{ id: '1', name: 'Test' }],
			sync_token: 'sync_xyz',
		};
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ _pagination: { sync_token: 'sync_xyz' } });
		expect(result[1]).toEqual({ id: '1', name: 'Test' });
	});

	it('should not append _pagination item when no pagination keys are present', () => {
		const response: IDataObject = {
			data: [{ id: '1', name: 'Alice' }],
		};
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ id: '1', name: 'Alice' });
	});

	it('should handle empty array with pagination', () => {
		const response: IDataObject = { data: [], next_token: 'abc' };
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({ _pagination: { next_token: 'abc' } });
	});

	it('should handle empty array without pagination', () => {
		const response: IDataObject = { data: [] };
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toEqual([]);
	});

	it('should fall back to single-object simplify when arrayKey is not an array', () => {
		const response: IDataObject = { id: '1', name: 'Test', phone: '555' };
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toEqual([{ id: '1', name: 'Test' }]);
	});

	it('should handle different array keys', () => {
		const response: IDataObject = {
			channels: [{ chat_id: 'c1', title: 'General', status: 'active', extra: 'x' }],
		};
		const result = applySimplifyModeToList(response, 'channels', 'simplified', noFlattenConfig);
		expect(result).toEqual([{ chat_id: 'c1', title: 'General', status: 'active' }]);
	});

	it('should apply selectedFields mode to list items', () => {
		const response: IDataObject = {
			data: [
				{ id: '1', name: 'Alice', email: 'a@b.com', phone: '111' },
				{ id: '2', name: 'Bob', email: 'b@b.com', phone: '222' },
			],
		};
		const result = applySimplifyModeToList(response, 'data', 'selectedFields', testConfig, [
			'phone',
		]);
		expect(result).toEqual([
			{ id: '1', phone: '111' },
			{ id: '2', phone: '222' },
		]);
	});

	it('should prepend a _pagination item in selectedFields mode when pagination keys are present', () => {
		const response: IDataObject = {
			data: [
				{ id: '1', name: 'Alice', phone: '111' },
				{ id: '2', name: 'Bob', phone: '222' },
			],
			next_token: 'page2',
			has_more: true,
		};
		const result = applySimplifyModeToList(response, 'data', 'selectedFields', testConfig, [
			'phone',
		]);
		expect(result).toHaveLength(3);
		expect(result[0]).toEqual({ _pagination: { next_token: 'page2', has_more: true } });
		expect(result[1]).toEqual({ id: '1', phone: '111' });
		expect(result[2]).toEqual({ id: '2', phone: '222' });
	});

	it('should include sync_token in _pagination for selectedFields mode', () => {
		const response: IDataObject = {
			data: [{ id: '1', name: 'Test', phone: '555' }],
			sync_token: 'sync_abc',
		};
		const result = applySimplifyModeToList(response, 'data', 'selectedFields', testConfig, [
			'name',
		]);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ _pagination: { sync_token: 'sync_abc' } });
		expect(result[1]).toEqual({ id: '1', name: 'Test' });
	});

	it('should flatten nested fields in list items during simplified mode', () => {
		const response: IDataObject = {
			data: [
				{ id: '1', name: 'Alice', department: { name: 'Eng' } },
				{ id: '2', name: 'Bob', department: { name: 'Sales' } },
			],
		};
		const result = applySimplifyModeToList(response, 'data', 'simplified', testConfig);
		expect(result).toEqual([
			{ id: '1', name: 'Alice', department_name: 'Eng' },
			{ id: '2', name: 'Bob', department_name: 'Sales' },
		]);
	});
});
