import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

import {
	isRemoteWorkAiErrorModeEnabled,
	pushRemoteWorkRecoverableError,
} from '../../../../../../nodes/ZohoCliq/v1/actions/remoteWork/common';

describe('ZohoCliq - RemoteWork common helpers', () => {
	const createContext = (
		values: {
			continueOnFail?: boolean;
			enableAiErrorMode?: unknown;
			getNodeParameterThrows?: boolean;
		} = {},
	): IExecuteFunctions => {
		const {
			continueOnFail = false,
			enableAiErrorMode = false,
			getNodeParameterThrows = false,
		} = values;

		return {
			getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
				if (getNodeParameterThrows && name === 'enableAiErrorMode') {
					throw new Error('parameter unavailable');
				}
				if (name === 'enableAiErrorMode') return enableAiErrorMode;
				return fallback;
			}),
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

	it('should detect AI Error Mode from node parameters when direct lookup is unavailable', () => {
		const context = createContext({
			enableAiErrorMode: 'true',
			getNodeParameterThrows: true,
		});

		expect(isRemoteWorkAiErrorModeEnabled(context, 0)).toBe(true);
	});

	it('should return false when getNode is unavailable', () => {
		const context = {
			...createContext(),
			getNode: undefined,
		} as unknown as IExecuteFunctions;

		expect(isRemoteWorkAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when node parameters are missing or invalid', () => {
		const context = {
			...createContext(),
			getNode: jest.fn(() => ({ parameters: 'invalid' })),
		} as unknown as IExecuteFunctions;

		expect(isRemoteWorkAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when node parameters are an array', () => {
		const context = {
			...createContext(),
			getNode: jest.fn(() => ({ parameters: [] })),
		} as unknown as IExecuteFunctions;

		expect(isRemoteWorkAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when getNode returns no node object', () => {
		const context = {
			...createContext(),
			getNode: jest.fn(() => undefined),
		} as unknown as IExecuteFunctions;

		expect(isRemoteWorkAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when reading node parameters throws', () => {
		const context = {
			...createContext(),
			getNode: jest.fn(() => {
				throw new Error('node unavailable');
			}),
		} as unknown as IExecuteFunctions;

		expect(isRemoteWorkAiErrorModeEnabled(context, 0)).toBe(false);
	});

	it('should return false when neither continue-on-fail nor AI Error Mode is enabled', () => {
		const context = createContext();
		const returnData: INodeExecutionData[] = [];

		expect(
			pushRemoteWorkRecoverableError(context, returnData, 0, 'getStatus', new Error('boom')),
		).toBe(false);
		expect(returnData).toEqual([]);
	});

	it('should preserve and merge scope payloads before generic recoverable handling', () => {
		const context = createContext({ continueOnFail: true });
		const returnData: INodeExecutionData[] = [];
		const error = {
			zohoCliqScopeErrorPayload: {
				success: false,
				resource: 'remoteWork',
				operation: 'checkIn',
				missingScopes: ['ZohoCliq.Profile.UPDATE'],
			},
		};

		expect(
			pushRemoteWorkRecoverableError(context, returnData, 0, 'checkIn', error, {
				contextFields: { phase: 'scope-check' },
			}),
		).toBe(true);
		expect(returnData[0].json).toEqual({
			success: false,
			resource: 'remoteWork',
			operation: 'checkIn',
			missingScopes: ['ZohoCliq.Profile.UPDATE'],
			phase: 'scope-check',
		});
	});

	it('should build a generic recoverable payload in AI Error Mode', () => {
		const context = createContext({ enableAiErrorMode: 'true' });
		const returnData: INodeExecutionData[] = [];
		const error = {
			statusCode: 404,
			message: 'Remote work status not found',
		};

		expect(
			pushRemoteWorkRecoverableError(context, returnData, 0, 'getStatus', error, {
				contextFields: { source: 'remote_tools' },
			}),
		).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining<IDataObject>({
				success: false,
				resource: 'remoteWork',
				operation: 'getStatus',
				source: 'remote_tools',
				status_code: 404,
				reason: 'NOT_FOUND',
			}),
		);
	});

	it('should fall back to generic handling when a scope payload is present but invalid', () => {
		const context = createContext({ continueOnFail: true });
		const returnData: INodeExecutionData[] = [];
		const error = {
			statusCode: 400,
			message: 'Invalid remote work request',
			zohoCliqScopeErrorPayload: [],
		};

		expect(pushRemoteWorkRecoverableError(context, returnData, 0, 'checkIn', error)).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'checkIn',
				status_code: 400,
			}),
		);
	});

	it('should fall back to generic handling when a scope payload is truthy but not an object', () => {
		const context = createContext({ continueOnFail: true });
		const returnData: INodeExecutionData[] = [];
		const error = {
			statusCode: 400,
			message: 'Invalid remote work request',
			zohoCliqScopeErrorPayload: 'invalid',
		};

		expect(pushRemoteWorkRecoverableError(context, returnData, 0, 'checkOut', error)).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'checkOut',
				status_code: 400,
			}),
		);
	});

	it('should fall back to generic handling when the error itself is undefined', () => {
		const context = createContext({ continueOnFail: true });
		const returnData: INodeExecutionData[] = [];

		expect(
			pushRemoteWorkRecoverableError(context, returnData, 0, 'getStatus', undefined, {
				fallbackMessage: 'Unable to retrieve remote work status.',
			}),
		).toBe(true);
		expect(returnData[0].json).toEqual(
			expect.objectContaining({
				success: false,
				resource: 'remoteWork',
				operation: 'getStatus',
				message: 'Unable to retrieve remote work status.',
			}),
		);
	});
});
