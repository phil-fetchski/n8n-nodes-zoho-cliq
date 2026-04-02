import type { IExecuteFunctions } from 'n8n-workflow';

export function createReactionTestContext(
	parameters: Record<string, unknown> = {},
	options: {
		continueOnFail?: boolean;
		nodeParameters?: Record<string, unknown>;
	} = {},
): IExecuteFunctions {
	const continueOnFailValue = options.continueOnFail ?? false;
	const nodeParameters = options.nodeParameters ?? parameters;

	return {
		getNodeParameter: jest.fn((name: string, _itemIndex: number, defaultValue?: unknown) =>
			Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : defaultValue,
		),
		continueOnFail: jest.fn(() => continueOnFailValue),
		helpers: {
			constructExecutionMetaData: jest.fn((data) => data),
		},
		getNode: jest.fn(() => ({
			name: 'Test Node',
			type: 'n8n-nodes-base.zohoCliq',
			parameters: nodeParameters,
		})),
	} as unknown as IExecuteFunctions;
}
