import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import * as buildPermissionsJsonPayload from '../../../../../../nodes/ZohoCliq/v1/actions/role/buildPermissionsJsonPayload.operation';
import * as common from '../../../../../../nodes/ZohoCliq/v1/actions/role/common';

describe('ZohoCliq - Role - Build Permissions JSON Payload Operation', () => {
	let mockExecuteFunctions: IExecuteFunctions;

	beforeEach(() => {
		mockExecuteFunctions = {
			getNodeParameter: jest.fn(),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({ name: 'Test Node', type: 'n8n-nodes-base.zohoCliq' })),
		} as unknown as IExecuteFunctions;
	});

	it('should apply default role display options when property has none', () => {
		const result = buildPermissionsJsonPayload.applyBuildPermissionsDisplayOptions({
			displayName: 'Example',
			name: 'example',
			type: 'notice',
			default: '',
		});

		expect(result.displayOptions).toEqual({
			show: {
				resource: ['role'],
				operation: ['buildPermissionsJsonPayload'],
			},
		});
	});

	it('should merge property-specific display options into role defaults', () => {
		const result = buildPermissionsJsonPayload.applyBuildPermissionsDisplayOptions({
			displayName: 'Example',
			name: 'example',
			type: 'notice',
			default: '',
			displayOptions: {
				show: {
					resource: ['customRole'],
					extraToggle: [true],
				},
				hide: {
					debugMode: [false],
				},
			},
		});

		expect(result.displayOptions).toEqual({
			show: {
				resource: ['customRole'],
				operation: ['buildPermissionsJsonPayload'],
				extraToggle: [true],
			},
			hide: {
				debugMode: [false],
			},
		});
	});

	it('should return filtered payload when full template output is disabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return false;
				if (name === 'permissionsTemplate') {
					return {
						list: [
							{ module: 'users', action: 'create', status: '' },
							{ module: 'users', action: 'delete', status: 'enabled' },
							{
								module: 'direct_message',
								status: '',
								configs: [{ name: 'profile_based_restricted_reply_time_frame', value: '' }],
							},
						],
					};
				}
				return defaultValue;
			},
		);

		const result = await buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, '');
		expect(result[0].json).toMatchObject({
			success: true,
			resource: 'role',
			operation: 'buildPermissionsJsonPayload',
			noApiCall: true,
			operationIntent: 'buildPermissionsJsonPayload',
			outputFullTemplatePayload: false,
			includedPermissionCount: 1,
			updatePermissionsPayload: {
				list: [{ module: 'users', action: 'delete', status: 'enabled' }],
			},
		});
	});

	it('should return full template payload when toggle is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const templatePayload = {
			list: [
				{ module: 'users', action: 'create', status: '' },
				{ module: 'users', action: 'delete', status: 'enabled' },
			],
		};
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return true;
				if (name === 'permissionsTemplate') return templatePayload;
				return defaultValue;
			},
		);

		const result = await buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, '');
		expect(result[0].json).toMatchObject({
			success: true,
			resource: 'role',
			operation: 'buildPermissionsJsonPayload',
			outputFullTemplatePayload: true,
			updatePermissionsPayload: templatePayload,
		});
	});

	it('should enforce enabled/disabled status values when provided', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return false;
				if (name === 'permissionsTemplate') {
					return {
						list: [{ module: 'users', action: 'delete', status: 'maybe' }],
					};
				}
				return defaultValue;
			},
		);

		await expect(
			buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, ''),
		).rejects.toBeInstanceOf(NodeOperationError);
	});

	it('should parse JSON string template payload input', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return false;
				if (name === 'permissionsTemplate') {
					return '{"list":[{"module":"users","action":"create","status":"enabled"}]}';
				}
				return defaultValue;
			},
		);

		const result = await buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, '');
		expect(result[0].json).toMatchObject({
			includedPermissionCount: 1,
			updatePermissionsPayload: {
				list: [{ module: 'users', action: 'create', status: 'enabled' }],
			},
		});
	});

	it('should continue on fail per item when enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }, { json: {} }];
		(mockExecuteFunctions as unknown as { continueOnFail: () => boolean }).continueOnFail = jest.fn(
			() => true,
		);
		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return false;
				if (name === 'permissionsTemplate') {
					return itemIndex === 0
						? { list: [{ module: 'users', action: 'delete', status: 'maybe' }] }
						: { list: [{ module: 'users', action: 'delete', status: 'enabled' }] };
				}
				return defaultValue;
			},
		);

		const result = await buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, '');

		expect(result).toHaveLength(2);
		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'buildPermissionsJsonPayload',
			reason: 'INVALID_PERMISSIONS_TEMPLATE',
			message:
				'Permissions Template (JSON).list[0].status must be either "enabled" or "disabled" when provided',
		});
		expect(result[1].json).toMatchObject({
			noApiCall: true,
			includedPermissionCount: 1,
		});
	});

	it('should recover unsafe template payload when AI Error Mode is enabled', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const unsafePayload = JSON.parse(
			'{"list":[{"module":"users","status":"enabled","__proto__":{"polluted":true}}]}',
		) as unknown;

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return false;
				if (name === 'permissionsTemplate') return unsafePayload;
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);

		const result = await buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'buildPermissionsJsonPayload',
			reason: 'UNSAFE_PERMISSIONS_TEMPLATE',
		});
		expect((result[0].json as { message?: string }).message).toContain(
			'Permissions Template (JSON)',
		);
	});

	it('should recover generic unsafe-key errors with the unsafe template reason', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const parseSpy = jest.spyOn(common, 'parseRolePayloadInput').mockImplementationOnce(() => {
			throw new Error('unsafe key detected');
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return false;
				if (name === 'permissionsTemplate')
					return { list: [{ module: 'users', status: 'enabled' }] };
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);

		const result = await buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'buildPermissionsJsonPayload',
			reason: 'UNSAFE_PERMISSIONS_TEMPLATE',
			message: 'unsafe key detected',
		});

		parseSpy.mockRestore();
	});

	it('should recover generic json-object errors with the unsafe template reason', async () => {
		const items: INodeExecutionData[] = [{ json: {} }];
		const parseSpy = jest.spyOn(common, 'parseRolePayloadInput').mockImplementationOnce(() => {
			throw new Error('payload must be a JSON object');
		});

		(mockExecuteFunctions.getNodeParameter as jest.Mock).mockImplementation(
			(name: string, _itemIndex: number, defaultValue?: unknown) => {
				if (name === 'outputFullTemplatePayload') return false;
				if (name === 'permissionsTemplate')
					return { list: [{ module: 'users', status: 'enabled' }] };
				if (name === 'enableAiErrorMode') return true;
				return defaultValue;
			},
		);

		const result = await buildPermissionsJsonPayload.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toMatchObject({
			success: false,
			resource: 'role',
			operation: 'buildPermissionsJsonPayload',
			reason: 'UNSAFE_PERMISSIONS_TEMPLATE',
			message: 'payload must be a JSON object',
		});

		parseSpy.mockRestore();
	});
});
