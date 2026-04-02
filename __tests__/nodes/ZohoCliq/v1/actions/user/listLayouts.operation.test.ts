import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { SCOPES } from '../scopeTestScopes';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import { USER_ALLOWED_LAYOUT_UNIQUE_NAMES } from '../../../../../../nodes/ZohoCliq/v1/actions/user/common';
import * as listLayouts from '../../../../../../nodes/ZohoCliq/v1/actions/user/listLayouts.operation';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

describe('ZohoCliq - User - List Layouts Operation', () => {
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;
	const requiredScope = getRequiredScopeForOperation('user', 'listLayouts');

	const createContext = (
		values: {
			uniqueName?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const { uniqueName, enableAiErrorMode = false, continueOnFail = false } = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'user';
					if (parameterName === 'operation') return 'listLayouts';
					if (parameterName === 'uniqueName') return uniqueName;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
			helpers: {
				constructExecutionMetaData: jest.fn((data: INodeExecutionData[], metadata) =>
					data.map((item: INodeExecutionData) => ({
						...item,
						pairedItem: metadata?.itemData,
						pairedItemIndex: metadata?.itemData?.item,
					})),
				),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
			continueOnFail: jest.fn(() => continueOnFail),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should list user layouts successfully with unique name filter', async () => {
		const mockExecuteFunctions = createContext({ uniqueName: 'profile_details_web' });
		const items: INodeExecutionData[] = [{ json: {} }];

		mockZohoCliqApiRequest.mockResolvedValue({ data: [{ unique_name: 'profile_details_web' }] });

		const result = await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result).toHaveLength(1);
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith(
			'GET',
			'/api/v2/users/layout',
			{},
			{ unique_name: 'profile_details_web' },
		);
	});

	it('should list user layouts successfully without unique name filter', async () => {
		const mockExecuteFunctions = createContext({ uniqueName: '' });
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/users/layout', {}, {});
	});

	it('should ignore uniqueName when value is whitespace only', async () => {
		const mockExecuteFunctions = createContext({ uniqueName: '   ' });
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/users/layout', {}, {});
	});

	it('should ignore uniqueName when value is null', async () => {
		const mockExecuteFunctions = createContext({ uniqueName: null });
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockResolvedValue({ data: [] });

		await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('GET', '/api/v2/users/layout', {}, {});
	});

	it('should throw error for missing OAuth scope', async () => {
		const mockExecuteFunctions = createContext({ uniqueName: '' });
		const items: INodeExecutionData[] = [{ json: {} }];

		let thrownError: unknown;
		try {
			await listLayouts.execute.call(mockExecuteFunctions, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
	});

	it('should continueOnFail with paired item error', async () => {
		const mockExecuteFunctions = createContext({
			uniqueName: 'invalid_layout',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(
			expect.objectContaining({
				pairedItem: { item: 0 },
				json: expect.objectContaining({
					success: false,
					resource: 'user',
					operation: 'listLayouts',
					reason: 'INVALID_LAYOUT_NAME',
					unique_name: 'invalid_layout',
					message:
						'Invalid layout unique name "invalid_layout". Must be one of: quick_view, profile_details_android, profile_details_ios, profile_details_web',
					hint: 'Use one of: quick_view, profile_details_android, profile_details_ios, profile_details_web.',
				}),
			}),
		);
		expect((result[0] as INodeExecutionData & { pairedItemIndex?: number }).pairedItemIndex).toBe(
			0,
		);
	});

	it('should recover API errors without unique_name context when the filter is blank', async () => {
		const mockExecuteFunctions = createContext({
			uniqueName: '   ',
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockRejectedValue({ statusCode: 429, message: 'Too Many Requests' });

		const result = await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'listLayouts',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('unique_name');
	});

	it('should recover API errors without unique_name context when the filter is undefined', async () => {
		const mockExecuteFunctions = createContext({
			uniqueName: undefined,
			continueOnFail: true,
		});
		const items: INodeExecutionData[] = [{ json: {} }];
		mockZohoCliqApiRequest.mockRejectedValue({ statusCode: 429, message: 'Too Many Requests' });

		const result = await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'listLayouts',
				status_code: 429,
				reason: 'RATE_LIMITED',
			}),
		);
		expect(result[0].json).not.toHaveProperty('unique_name');
	});

	it('should preserve the original lookup error when uniqueName retrieval throws', async () => {
		const mockExecuteFunctions = {
			...createContext({ continueOnFail: true }),
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'user';
					if (parameterName === 'operation') return 'listLayouts';
					if (parameterName === 'uniqueName') throw new Error('lookup exploded');
					return fallback;
				},
			),
		} as unknown as IExecuteFunctions;
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await listLayouts.execute.call(mockExecuteFunctions, items, SCOPES.USERS_READ);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'listLayouts',
				message: 'lookup exploded',
			}),
		);
		expect(result[0].json).not.toHaveProperty('unique_name');
	});

	it('should return a recoverable scope payload in AI Error Mode', async () => {
		const mockExecuteFunctions = createContext({ enableAiErrorMode: true });
		const items: INodeExecutionData[] = [{ json: {} }];

		const result = await listLayouts.execute.call(mockExecuteFunctions, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'user',
				operation: 'listLayouts',
				requiredScopes: [requiredScope],
				missingScopes: [requiredScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should expose docs and AI guide notices with required scopes', () => {
		const docsNotice = listLayouts.description.find(
			(property) => property.name === 'listUserLayoutsDocsNotice',
		);
		const aiGuideNotice = listLayouts.description.find(
			(property) => property.name === 'listUserLayoutsAiToolGuideNotice',
		);
		expect(docsNotice).toBeDefined();
		expect(aiGuideNotice).toBeDefined();
		expect(String(docsNotice?.displayName)).toContain('REQUIRED SCOPES:');
		expect(listLayouts.description[listLayouts.description.length - 2]?.name).toBe(
			'listUserLayoutsDocsNotice',
		);
		expect(listLayouts.description[listLayouts.description.length - 1]?.name).toBe(
			'listUserLayoutsAiToolGuideNotice',
		);
	});

	it('should build unique name options from shared allowed layout constant', () => {
		const uniqueNameField = listLayouts.description.find(
			(property) => property.name === 'uniqueName',
		);
		const uniqueNameOptions = (uniqueNameField?.options ?? []) as Array<{
			name: string;
			value: string;
		}>;

		expect(uniqueNameOptions[0]).toEqual(expect.objectContaining({ name: 'All', value: '' }));

		const optionValues = uniqueNameOptions.map((option) => String(option.value));
		for (const allowed of USER_ALLOWED_LAYOUT_UNIQUE_NAMES) {
			expect(optionValues).toContain(allowed);
		}
	});
});
