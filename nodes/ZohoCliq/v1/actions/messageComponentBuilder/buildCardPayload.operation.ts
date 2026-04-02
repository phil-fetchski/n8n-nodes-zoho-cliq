/**
 * Build Card Payload operation
 * Creates a Zoho Cliq rich card payload locally (no API call)
 */

import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

import { cardPayloadBuilderDescription, resolveCardPayload } from '../shared/messagePayload';
import {
	appendExecutionData,
	applyResourceDisplayOptions,
	buildDeterministicBuilderErrorPayload,
	createAgentToolRedirectNotice,
} from './common';

const properties: INodeProperties[] = [
	{
		displayName:
			'Build a reusable Cliq card payload. This operation does not send a message. Reuse <code>{{$json.cardJsonPretty}}</code> directly in expression-driven assembly, or use <code>{{$json.cardPayload}}</code> as the drop-in value in Post Message, Edit Message, or Schedule Message raw JSON payload fields.',
		name: 'buildCardPayloadNotice',
		type: 'notice',
		default: '',
	},
	...cardPayloadBuilderDescription,
	createAgentToolRedirectNotice('buildCardPayloadAgentToolRedirectNotice'),
];

export const description: INodeProperties[] = applyResourceDisplayOptions(
	properties,
	'buildCardPayload',
);

export async function execute(
	this: IExecuteFunctions,
	items: INodeExecutionData[],
	_grantedScopes: string,
): Promise<INodeExecutionData[]> {
	void _grantedScopes;
	const returnData: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const resolvedCardPayload = resolveCardPayload(this, i, {
				requireMessageContent: true,
				textTypeErrorMessage: 'Card Text must be a string',
			});
			const json: IDataObject = {
				cardJsonPretty: resolvedCardPayload,
				cardPayload: JSON.stringify(resolvedCardPayload, null, 2),
			};
			appendExecutionData(this, returnData, i, json);
		} catch (error) {
			if (this.continueOnFail()) {
				const message = error instanceof Error ? error.message : 'Unable to build card payload';
				appendExecutionData(
					this,
					returnData,
					i,
					buildDeterministicBuilderErrorPayload(message, 'buildCardPayload'),
				);
				continue;
			}

			if (error instanceof Error) {
				throw error;
			}

			throw new NodeOperationError(this.getNode(), 'Unable to build card payload', {
				itemIndex: i,
			});
		}
	}

	return returnData;
}
