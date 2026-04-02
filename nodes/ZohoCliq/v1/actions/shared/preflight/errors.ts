import { NodeOperationError } from 'n8n-workflow';

import type { IPreflightMissingErrorInput } from './contracts';

export function buildPreflightMissingError(input: IPreflightMissingErrorInput): NodeOperationError {
	const message =
		typeof input.missing.message === 'function'
			? input.missing.message(input)
			: input.missing.message;
	const hint =
		typeof input.missing.hint === 'function' ? input.missing.hint(input) : input.missing.hint;

	const error = new NodeOperationError(input.context.getNode(), message, {
		itemIndex: input.itemIndex,
		description: hint,
	});

	(error as NodeOperationError & { code?: string }).code = input.missing.code;

	Object.assign(error as unknown as Record<string, unknown>, {
		zohoCliqPreflight: {
			success: false,
			blocked_main_request: true,
			resource: input.subject.resource,
			identifier: input.subject.identifier,
			label: input.subject.label,
			code: input.missing.code,
			message,
			hint,
			evidence: input.evidence,
		},
	});

	if (input.missing.attachmentKey && input.missingIdentifiers?.length) {
		Object.assign(error as unknown as Record<string, unknown>, {
			[input.missing.attachmentKey]: input.missingIdentifiers,
		});
	} else if (input.subject.resource === 'user' && input.missingIdentifiers?.length) {
		Object.assign(error as unknown as Record<string, unknown>, {
			zohoCliqMissingUserIds: input.missingIdentifiers,
		});
	}

	return error;
}
