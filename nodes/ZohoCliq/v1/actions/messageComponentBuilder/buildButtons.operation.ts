import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';

import { createButtonsDescription, executeButtonsBuilder } from './builders.shared';

export const description: INodeProperties[] = createButtonsDescription('buildButtons');

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	_grantedScopes: string,
): Promise<INodeExecutionData[]> {
	void _grantedScopes;
	return executeButtonsBuilder.call(this, items);
}
