import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

interface IFlexibleUserIdsDependencies {
	parseDelimitedIds: (
		context: IExecuteFunctions,
		value: unknown,
		itemIndex: number,
		path: string,
	) => string[];
	validateUserId: (
		context: IExecuteFunctions,
		value: unknown,
		itemIndex: number,
		path: string,
	) => string;
}

export function parseFlexibleUserIdsInput(
	context: IExecuteFunctions,
	value: unknown,
	itemIndex: number,
	path: string,
	dependencies: IFlexibleUserIdsDependencies,
): string[] {
	const { parseDelimitedIds, validateUserId } = dependencies;

	if (Array.isArray(value)) {
		if (value.length === 0) {
			throw new NodeOperationError(context.getNode(), `${path} must contain at least one ID`, {
				itemIndex,
			});
		}

		return value.map((id, index) => validateUserId(context, id, itemIndex, `${path}[${index}]`));
	}

	if (typeof value !== 'string') {
		throw new NodeOperationError(
			context.getNode(),
			`${path} must be either a JSON array of user IDs or a comma-separated string of user IDs`,
			{ itemIndex },
		);
	}

	const trimmedValue = value.trim();
	if (!trimmedValue) {
		throw new NodeOperationError(context.getNode(), `${path} must contain at least one ID`, {
			itemIndex,
		});
	}

	const looksLikeJsonArray = trimmedValue.startsWith('[') && trimmedValue.endsWith(']');
	if (looksLikeJsonArray) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmedValue);
		} catch {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a valid JSON array when provided in array form`,
				{ itemIndex },
			);
		}

		if (!Array.isArray(parsed)) {
			throw new NodeOperationError(
				context.getNode(),
				`${path} must be a JSON array of user IDs when provided in array form`,
				{ itemIndex },
			);
		}

		if (parsed.length === 0) {
			throw new NodeOperationError(context.getNode(), `${path} must contain at least one ID`, {
				itemIndex,
			});
		}

		return parsed.map((id, index) => validateUserId(context, id, itemIndex, `${path}[${index}]`));
	}

	return parseDelimitedIds(context, trimmedValue, itemIndex, path).map((id, index) =>
		validateUserId(context, id, itemIndex, `${path}[${index}]`),
	);
}
