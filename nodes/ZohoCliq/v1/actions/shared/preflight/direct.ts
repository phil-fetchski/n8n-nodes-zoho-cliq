import { extractCliqErrorSearchText } from '../errorResponse';

export function isAuthoritativeNotFoundError(error: unknown, messageFragments: string[]): boolean {
	const response = (error as { response?: { statusCode?: number; status?: number } } | undefined)
		?.response;
	const statusCode = Number(
		response?.statusCode ??
			response?.status ??
			(error as { statusCode?: number; status?: number; httpCode?: number } | undefined)
				?.statusCode ??
			(error as { statusCode?: number; status?: number; httpCode?: number } | undefined)?.status ??
			(error as { statusCode?: number; httpCode?: number } | undefined)?.httpCode,
	);

	if (statusCode === 400) {
		return true;
	}

	const normalizedMessage = extractCliqErrorSearchText(error).toLowerCase();
	const normalizedFragments = messageFragments
		.map((fragment) => fragment.trim().toLowerCase())
		.filter((fragment) => fragment.length > 0);
	if (!normalizedFragments.length) {
		return false;
	}

	return normalizedFragments.some((fragment) => normalizedMessage.includes(fragment));
}
