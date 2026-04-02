import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const RESOURCE_NAME = 'messageComponentBuilder';

export function createAgentToolRedirectNotice(name: string): INodeProperties {
	return {
		displayName:
			'AI Tool Recommendation: For AI-agent workflows, use <b>Agent Card Payload Builder</b> in this same Message Component Builder resource group. This operation is better suited for manual or deterministic workflow assembly.',
		name,
		type: 'notice',
		default: '',
	};
}

export function buildDeterministicBuilderErrorPayload(
	message: string,
	operation: string,
	hint?: string,
): IDataObject {
	let resolvedHint = hint;

	if (!resolvedHint) {
		if (message.includes('includeSlidesWrapper') || message.includes('includeButtonsWrapper')) {
			resolvedHint =
				'Wrapper toggles must resolve to booleans. Enable wrapper output only when composing a raw JSON payload/editor snippet.';
		} else if (operation === 'buildButtons') {
			resolvedHint =
				'Provide one or more valid button objects. Reuse buttonsJsonPretty or buttonsPayload downstream. wrapperPrefixPayload is only for raw JSON editor usage.';
		} else if (operation === 'buildComponents') {
			resolvedHint =
				'Provide one or more valid component objects. Reuse componentsJsonPretty or componentsPayload downstream. wrapperPrefixPayload is only for raw JSON editor usage.';
		} else if (operation === 'buildCardPayload') {
			resolvedHint =
				'Provide valid card fields and required top-level text. Reuse cardJsonPretty or cardPayload in downstream raw JSON payload fields.';
		} else {
			resolvedHint =
				'Provide exactly one valid component matching this builder. Reuse componentJsonPretty or componentPayload downstream. wrapperPrefixPayload is only for raw JSON editor usage.';
		}
	}

	return {
		error: message,
		resource: RESOURCE_NAME,
		operation,
		hint: resolvedHint,
	};
}

export function applyResourceDisplayOptions(
	properties: INodeProperties[],
	operation: string,
): INodeProperties[] {
	return properties.map((property) => ({
		...property,
		displayOptions: {
			...property.displayOptions,
			show: {
				resource: [RESOURCE_NAME],
				operation: [operation],
				...(property.displayOptions?.show ?? {}),
			},
		},
	}));
}

export function appendExecutionData(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	json: IDataObject,
): void {
	const executionData = context.helpers.constructExecutionMetaData([{ json }], {
		itemData: { item: itemIndex },
	});
	returnData.push(...executionData);
}

export function appendOperationError(
	context: IExecuteFunctions,
	returnData: INodeExecutionData[],
	itemIndex: number,
	error: unknown,
	options: {
		fallbackMessage: string;
		operation: string;
		hint?: string;
	},
): never | void {
	if (!context.continueOnFail()) {
		if (error instanceof Error) {
			throw error;
		}
		throw new NodeOperationError(context.getNode(), options.fallbackMessage, {
			itemIndex,
		});
	}

	const message = error instanceof Error ? error.message : options.fallbackMessage;
	appendExecutionData(context, returnData, itemIndex, {
		...buildDeterministicBuilderErrorPayload(message, options.operation, options.hint),
	});
}

export function toPrettyAndStringPayload<T extends IDataObject | IDataObject[]>(
	value: T,
): { pretty: T; payload: string } {
	return {
		pretty: value,
		payload: JSON.stringify(value, null, 2),
	};
}
