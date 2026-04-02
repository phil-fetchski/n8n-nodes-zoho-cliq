import type { IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import type { IRunPaginatedLookupConfig } from './contracts';

export async function runPaginatedLookupExhaustively<TItem>(
	context: IExecuteFunctions,
	itemIndex: number,
	config: IRunPaginatedLookupConfig<TItem>,
): Promise<void> {
	const seenNextTokens = new Set<string>();
	let nextToken: string | undefined;

	while (true) {
		const response = await config.requestPage(nextToken);
		const page = config.extractPage(response);

		config.onItems(page.items);

		if (config.shouldStop()) {
			return;
		}

		if (page.nextToken) {
			if (seenNextTokens.has(page.nextToken)) {
				throw new NodeOperationError(
					context.getNode(),
					`The ${config.entityLabel} preflight could not finish because Zoho Cliq repeated next_token "${page.nextToken}" before the requested identifiers were resolved.`,
					{ itemIndex },
				);
			}

			seenNextTokens.add(page.nextToken);
			nextToken = page.nextToken;
			continue;
		}

		if (page.hasMore === false) {
			return;
		}

		if (page.hasMore === true) {
			throw new NodeOperationError(
				context.getNode(),
				`The ${config.entityLabel} preflight could not finish because Zoho Cliq reported more results without returning a next_token.`,
				{ itemIndex },
			);
		}

		if (page.items.length < config.pageSize) {
			return;
		}

		throw new NodeOperationError(
			context.getNode(),
			`The ${config.entityLabel} preflight could not confirm exhaustive pagination because Zoho Cliq returned a full page without next_token or has_more=false.`,
			{ itemIndex },
		);
	}
}
