import type { IExecuteFunctions } from 'n8n-workflow';

interface IRemoteWorkTestContextOptions {
	continueOnFail?: boolean;
	enableAiErrorMode?: unknown;
	simplify?: unknown;
	simplifyMode?: unknown;
	simplifyFields?: unknown;
	operation: 'checkIn' | 'checkOut' | 'getStatus';
}

export function createRemoteWorkTestContext(
	values: IRemoteWorkTestContextOptions,
): IExecuteFunctions {
	const {
		continueOnFail = false,
		enableAiErrorMode = false,
		simplify = false,
		simplifyMode = 'simplified',
		simplifyFields = [],
		operation,
	} = values;

	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'enableAiErrorMode') return enableAiErrorMode;
			if (name === 'simplify') return simplify;
			if (name === 'simplifyMode') return simplifyMode;
			if (name === 'simplifyFields') return simplifyFields;
			if (name === 'resource') return 'remoteWork';
			if (name === 'operation') return operation;
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
}
