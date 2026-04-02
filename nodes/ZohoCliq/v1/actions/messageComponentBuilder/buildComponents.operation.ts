import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { createMultiComponentDescription, executeMultiComponentBuilder } from './builders.shared';

export const description: INodeProperties[] = createMultiComponentDescription('buildComponents');

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	_grantedScopes: string,
): Promise<INodeExecutionData[]> {
	void _grantedScopes;
	return executeMultiComponentBuilder.call(this, items);
}
