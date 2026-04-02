import type { IExecuteFunctions } from 'n8n-workflow';

type BulkActionOperation = 'exportConversationMembers' | 'exportMessages';

interface IBulkActionContextValues {
	chatId?: string;
	memberFields?: string[];
	nextToken?: string;
}

interface IBulkActionContextOptions {
	continueOnFail?: boolean;
	enableAiErrorMode?: unknown;
}

export function createBulkActionTestContext(
	operation: BulkActionOperation,
	values: IBulkActionContextValues = {},
	options: IBulkActionContextOptions = {},
): IExecuteFunctions {
	const chatId = Object.prototype.hasOwnProperty.call(values, 'chatId')
		? values.chatId
		: '1277744317795524707';
	const memberFields = Object.prototype.hasOwnProperty.call(values, 'memberFields')
		? values.memberFields
		: ['name', 'email_id'];
	const nextToken = Object.prototype.hasOwnProperty.call(values, 'nextToken')
		? values.nextToken
		: '';
	const { continueOnFail = false, enableAiErrorMode = false } = options;

	return {
		getNodeParameter: jest.fn((name: string, _itemIndex?: number, fallback?: unknown) => {
			if (name === 'chatId') return chatId;
			if (name === 'memberFields') return memberFields;
			if (name === 'nextToken') return nextToken;
			if (name === 'enableAiErrorMode') return enableAiErrorMode;
			if (name === 'resource') return 'bulkAction';
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
