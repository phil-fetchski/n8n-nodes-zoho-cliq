import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

export const RESOURCE_NAME = 'oauthHelper';

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

export function buildOAuthHelperErrorPayload(
	message: string,
	operation: string,
	hint?: string,
): IDataObject {
	let resolvedHint = hint;

	if (!resolvedHint) {
		if (operation === 'getGrantedScopes') {
			resolvedHint =
				'Connect valid Zoho Cliq OAuth2 credentials and rerun the helper. Use this output to inspect the scopes stored on the current token.';
		} else if (operation === 'checkScopePack') {
			resolvedHint =
				'Select one valid scope pack from the Pack Name options, or set Pack Name by expression in AI Tool mode, and compare the reported missingScopes against the operation you want to run next.';
		} else {
			resolvedHint =
				'Use this helper to compare your current granted scopes against the node scope-pack catalog before attempting scope-sensitive operations.';
		}
	}

	return {
		success: false,
		resource: RESOURCE_NAME,
		operation,
		reason: message,
		hint: resolvedHint,
	};
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
		...buildOAuthHelperErrorPayload(message, options.operation, options.hint),
	});
}
