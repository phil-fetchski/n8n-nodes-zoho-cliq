import {
	simplifyParameter,
	simplifyModeParameter,
	buildSelectedFieldsParameter,
	getSimplifyParameters,
} from '../../../../../../../nodes/ZohoCliq/v1/actions/shared/simplifyOutput';

describe('simplifyParameter', () => {
	it('should be a boolean toggle defaulting to true', () => {
		expect(simplifyParameter.name).toBe('simplify');
		expect(simplifyParameter.type).toBe('boolean');
		expect(simplifyParameter.default).toBe(true);
	});
});

describe('simplifyModeParameter', () => {
	it('should have correct name and type', () => {
		expect(simplifyModeParameter.name).toBe('simplifyMode');
		expect(simplifyModeParameter.type).toBe('options');
		expect(simplifyModeParameter.default).toBe('simplified');
	});

	it('should have all three mode options', () => {
		const values = (simplifyModeParameter.options as Array<{ value: string }>).map((o) => o.value);
		expect(values).toEqual(['simplified', 'raw', 'selectedFields']);
	});

	it('should be shown only when simplify toggle is ON', () => {
		expect(simplifyModeParameter.displayOptions).toEqual({
			show: { simplify: [true] },
		});
	});
});

describe('buildSelectedFieldsParameter', () => {
	it('should build a multiOptions parameter for a given config', () => {
		const param = buildSelectedFieldsParameter('user');
		expect(param.name).toBe('simplifyFields');
		expect(param.displayName).toBe('Output Fields');
		expect(param.type).toBe('multiOptions');
		expect(param.default).toEqual(['id']);
		expect(param.displayOptions).toEqual({
			show: { simplify: [true], simplifyMode: ['selectedFields'] },
		});
	});

	it('should include all selectable fields from the config', () => {
		const param = buildSelectedFieldsParameter('user');
		const options = param.options as Array<{ name: string; value: string }>;
		expect(options.length).toBeGreaterThan(0);
		const values = options.map((o) => o.value);
		expect(values).toContain('id');
		expect(values).toContain('email_id');
		expect(values).toContain('display_name');
	});

	it('should produce different fields for different configs', () => {
		const userParam = buildSelectedFieldsParameter('user');
		const channelParam = buildSelectedFieldsParameter('channel');
		const userValues = (userParam.options as Array<{ value: string }>).map((o) => o.value);
		const channelValues = (channelParam.options as Array<{ value: string }>).map((o) => o.value);
		expect(userValues).toContain('email_id');
		expect(channelValues).toContain('channel_id');
		expect(userValues).not.toContain('channel_id');
	});
});

describe('getSimplifyParameters', () => {
	it('should return three parameters', () => {
		const params = getSimplifyParameters('user', 'user', 'get');
		expect(params).toHaveLength(3);
	});

	it('should return simplifyParameter as the first item without displayOptions', () => {
		const params = getSimplifyParameters('user', 'user', 'get');
		expect(params[0].name).toBe('simplify');
		expect(params[0].type).toBe('boolean');
		expect(params[0].default).toBe(true);
		expect(params[0].displayOptions).toBeUndefined();
	});

	it('should return Simplify Mode as the second item with resource/operation/simplify displayOptions', () => {
		const params = getSimplifyParameters('user', 'user', 'list');
		const modeParam = params[1];
		expect(modeParam.name).toBe('simplifyMode');
		expect(modeParam.type).toBe('options');
		expect(modeParam.displayOptions).toEqual({
			show: {
				resource: ['user'],
				operation: ['list'],
				simplify: [true],
			},
		});
	});

	it('should return Output Fields as the third item with full displayOptions', () => {
		const params = getSimplifyParameters('user', 'user', 'list');
		const outputFields = params[2];
		expect(outputFields.name).toBe('simplifyFields');
		expect(outputFields.displayName).toBe('Output Fields');
		expect(outputFields.displayOptions).toEqual({
			show: {
				resource: ['user'],
				operation: ['list'],
				simplify: [true],
				simplifyMode: ['selectedFields'],
			},
		});
	});

	it('should scope displayOptions to the given resource and operation', () => {
		const params = getSimplifyParameters('department', 'department', 'create');
		const modeParam = params[1];
		const outputFields = params[2];
		expect(modeParam.displayOptions).toEqual({
			show: {
				resource: ['department'],
				operation: ['create'],
				simplify: [true],
			},
		});
		expect(outputFields.displayOptions).toEqual({
			show: {
				resource: ['department'],
				operation: ['create'],
				simplify: [true],
				simplifyMode: ['selectedFields'],
			},
		});
	});

	it('should use the correct config for selectable fields', () => {
		const params = getSimplifyParameters('channel', 'channel', 'get');
		const outputFields = params[2];
		const values = (outputFields.options as Array<{ value: string }>).map((o) => o.value);
		expect(values).toContain('channel_id');
		expect(values).not.toContain('email_id');
	});
});
