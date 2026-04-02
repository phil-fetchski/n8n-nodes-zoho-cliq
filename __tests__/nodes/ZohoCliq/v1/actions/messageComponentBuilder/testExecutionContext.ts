import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

export type TestContextOptions = {
	params?: Record<string, unknown>;
	continueOnFail?: boolean;
	helperOverrides?: {
		constructExecutionMetaData?: (
			data: INodeExecutionData[],
			meta: { itemData: { item: number } },
		) => INodeExecutionData[];
	};
};

const defaultConstructExecutionMetaData = (
	data: INodeExecutionData[],
	meta: { itemData: { item: number } },
) =>
	data.map((entry: INodeExecutionData) => ({
		...entry,
		pairedItem: meta.itemData,
	}));

export function createTestExecutionContext({
	params = {},
	continueOnFail = false,
	helperOverrides = {},
}: TestContextOptions = {}): IExecuteFunctions {
	return {
		getNodeParameter: jest.fn((name: string, _itemIndex: number, fallback?: unknown) => {
			if (params[name] !== undefined) {
				return params[name];
			}
			return fallback;
		}),
		getNode: jest.fn(() => ({ name: 'Zoho Cliq' })),
		continueOnFail: jest.fn(() => continueOnFail),
		helpers: {
			constructExecutionMetaData: jest.fn(
				helperOverrides.constructExecutionMetaData ?? defaultConstructExecutionMetaData,
			),
		},
	} as unknown as IExecuteFunctions;
}
