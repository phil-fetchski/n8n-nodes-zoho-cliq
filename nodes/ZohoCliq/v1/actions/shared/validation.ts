import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

const zohoEntityIdPattern = /^[a-zA-Z0-9_-]+$/;

export function validateZohoEntityId(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
): string {
	if (typeof value !== 'string' || !value.trim()) {
		throw new NodeOperationError(context.getNode(), `${path} must be a non-empty string`, {
			itemIndex,
		});
	}

	const sanitized = value.trim();
	if (sanitized.length > 200) {
		throw new NodeOperationError(context.getNode(), `${path} is too long`, {
			itemIndex,
		});
	}

	if (!zohoEntityIdPattern.test(sanitized)) {
		throw new NodeOperationError(
			context.getNode(),
			`${path} has an invalid format. Use only letters, numbers, hyphens, and underscores.`,
			{ itemIndex },
		);
	}

	return sanitized;
}
