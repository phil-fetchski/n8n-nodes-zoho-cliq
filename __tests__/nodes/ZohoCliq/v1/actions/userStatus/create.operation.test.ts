import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import * as create from '../../../../../../nodes/ZohoCliq/v1/actions/userStatus/create.operation';
import { getRequiredScopeForOperation } from '../../../../../../nodes/ZohoCliq/v1/helpers/scopeRegistry';
import * as transport from '../../../../../../nodes/ZohoCliq/v1/transport';

jest.mock('../../../../../../nodes/ZohoCliq/v1/transport');

const userStatusCreateScope = getRequiredScopeForOperation('userStatus', 'create');

describe('ZohoCliq - UserStatus - Create Operation', () => {
	const items: INodeExecutionData[] = [{ json: {} }];
	const mockZohoCliqApiRequest = transport.zohoCliqApiRequest as jest.MockedFunction<
		typeof transport.zohoCliqApiRequest
	>;

	const createContext = (
		values: {
			inputMode?: unknown;
			code?: string;
			message?: string;
			statusDefinition?: unknown;
			enableAiErrorMode?: unknown;
			continueOnFail?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			inputMode = 'structured',
			code = 'busy',
			message = 'In a call',
			statusDefinition = '{"code":"available","message":"Heads down"}',
			enableAiErrorMode = false,
			continueOnFail = false,
		} = values;

		return {
			getNodeParameter: jest.fn(
				(parameterName: string, _itemIndex?: number, fallback?: unknown) => {
					if (parameterName === 'resource') return 'userStatus';
					if (parameterName === 'operation') return 'create';
					if (parameterName === 'inputMode') return inputMode;
					if (parameterName === 'code') return code;
					if (parameterName === 'message') return message;
					if (parameterName === 'statusDefinition') return statusDefinition;
					if (parameterName === 'enableAiErrorMode') return enableAiErrorMode;
					return fallback;
				},
			),
			continueOnFail: jest.fn(() => continueOnFail),
			helpers: {
				constructExecutionMetaData: jest.fn((data) => data),
			},
			getNode: jest.fn(() => ({
				name: 'Test Node',
				type: 'n8n-nodes-base.zohoCliq',
				parameters: { enableAiErrorMode },
			})),
		} as unknown as IExecuteFunctions;
	};

	beforeEach(() => {
		mockZohoCliqApiRequest.mockReset();
	});

	it('should expose the docs and AI guide notices at the bottom of the operation fields', () => {
		expect(create.description.map((property) => property.name)).toEqual([
			'inputMode',
			'code',
			'message',
			'statusDefinition',
			'createUserStatusDocsNotice',
			'createUserStatusAiToolGuideNotice',
		]);
		expect(create.description[create.description.length - 1]?.displayName).toContain(
			'AI Tool Setup Guide',
		);
	});

	it('should create a reusable status successfully from structured fields', async () => {
		const context = createContext({ inputMode: 'structured', code: 'busy', message: 'In a call' });
		mockZohoCliqApiRequest.mockResolvedValue({
			data: { id: '1775998000034476000', code: 'busy', message: 'In a call' },
		});

		const result = await create.execute.call(context, items, userStatusCreateScope);

		expect(result[0].json).toEqual({
			data: { id: '1775998000034476000', code: 'busy', message: 'In a call' },
		});
		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/statuses', {
			code: 'busy',
			message: 'In a call',
		});
	});

	it('should create a reusable status successfully from raw JSON input', async () => {
		const context = createContext({
			inputMode: 'raw',
			statusDefinition: '{"code":"AVAILABLE","message":"  Heads down  "}',
		});
		mockZohoCliqApiRequest.mockResolvedValue({
			data: { id: '1775998000034476001', code: 'available', message: 'Heads down' },
		});

		await create.execute.call(context, items, userStatusCreateScope);

		expect(mockZohoCliqApiRequest).toHaveBeenCalledWith('POST', '/api/v2/statuses', {
			code: 'available',
			message: 'Heads down',
		});
	});

	it('should reject unsupported input modes', async () => {
		const context = createContext({ inputMode: 'agentTool' });

		await expect(create.execute.call(context, items, userStatusCreateScope)).rejects.toThrow(
			'Input Mode must be either "structured" or "raw"',
		);
	});

	it('should surface validation failures for invalid payloads', async () => {
		const context = createContext({
			inputMode: 'raw',
			statusDefinition: '{"code":"busy","message":"   "}',
		});

		await expect(create.execute.call(context, items, userStatusCreateScope)).rejects.toThrow(
			'Status Definition.message is required',
		);
	});

	it('should return a recoverable API error when continueOnFail is enabled', async () => {
		const context = createContext({ continueOnFail: true });
		mockZohoCliqApiRequest.mockRejectedValue(new Error('API unavailable'));

		const result = await create.execute.call(context, items, userStatusCreateScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message: 'API unavailable',
				resource: 'userStatus',
				operation: 'create',
				input_mode: 'structured',
				body: {
					code: 'busy',
					message: 'In a call',
				},
			}),
		);
	});

	it('should return a recoverable invalid-code payload when AI Error Mode is enabled', async () => {
		const context = createContext({
			enableAiErrorMode: 'true',
			inputMode: 'structured',
			code: 'on_the_moon',
		});

		const result = await create.execute.call(context, items, userStatusCreateScope);

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				message:
					'Invalid Status Definition.code "on_the_moon". Use one of: available, busy, invisible.',
				reason: 'INVALID_STATUS_CODE',
				hint: 'Provide `code` as one of: available, busy, invisible.',
				resource: 'userStatus',
				operation: 'create',
				input_mode: 'structured',
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});

	it('should throw for missing scope when recoverable mode is disabled', async () => {
		const context = createContext();
		let thrownError: unknown;
		try {
			await create.execute.call(context, items, '');
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).toBeInstanceOf(NodeOperationError);
		expect((thrownError as Error).message).toContain('Missing OAuth scope for');
		expect(
			(thrownError as { zohoCliqScopeErrorPayload?: unknown }).zohoCliqScopeErrorPayload,
		).toEqual(
			expect.objectContaining({
				requiredScopes: [userStatusCreateScope],
				missingScopes: [userStatusCreateScope],
			}),
		);
	});

	it('should return a recoverable scope payload when AI Error Mode is enabled', async () => {
		const context = createContext({ enableAiErrorMode: 'true' });

		const result = await create.execute.call(context, items, '');

		expect(result[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'userStatus',
				operation: 'create',
				requiredScopes: [userStatusCreateScope],
				missingScopes: [userStatusCreateScope],
			}),
		);
		expect(mockZohoCliqApiRequest).not.toHaveBeenCalled();
	});
});
