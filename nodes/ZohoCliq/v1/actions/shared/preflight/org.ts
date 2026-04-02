import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { asDataObject } from '../../../helpers/data';
import { listAcceptedScopesForOperation } from '../../../helpers/scopeRegistry';
import { zohoCliqApiRequest } from '../../../transport';

import type {
	ExhaustiveLookupOutcome,
	IPaginatedLookupPage,
	IPreflightMissingErrorConfig,
	PreflightGateResult,
} from './contracts';
import { runPreflightGate } from './gate';
import { runPaginatedLookupExhaustively } from './pagination';
import { runUserIdentifiersPreflightGate, userListLookupScopes } from './users';

const designationListLookupScopes = listAcceptedScopesForOperation('designation', 'list') ?? [];
const departmentListLookupScopes = listAcceptedScopesForOperation('department', 'list') ?? [];

export const DESIGNATION_NOT_FOUND_HINT =
	'Use List Designations to discover valid IDs before retrying.';
export const DEPARTMENT_NOT_FOUND_HINT =
	'Use List Departments to discover valid IDs before retrying.';

function getFirstString(value: unknown): string | undefined {
	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}

	if (typeof value === 'number' || typeof value === 'bigint') {
		return String(value);
	}

	return undefined;
}

function getOrgNextToken(
	root: IDataObject | undefined,
	nestedData: IDataObject | undefined,
): string | undefined {
	if (root) {
		const rootNextToken = getFirstString(root.next_token);
		if (rootNextToken) {
			return rootNextToken;
		}
	}

	if (nestedData) {
		return getFirstString(nestedData.next_token);
	}

	return undefined;
}

function asOrgPage(
	response: unknown,
	config: {
		rootKey: 'designations' | 'departments';
		itemLabelKey: 'designation_id' | 'department_id';
	},
): IPaginatedLookupPage<IDataObject> {
	const root = asDataObject(response);
	const nestedData = root ? asDataObject(root.data) : undefined;
	const nextToken = getOrgNextToken(root, nestedData);
	let rootItems: unknown;
	let rootDataItems: unknown;
	let nestedItems: unknown;

	if (root) {
		rootItems = root[config.rootKey];
		if (Array.isArray(root.data)) {
			rootDataItems = root.data;
		}
	}

	if (nestedData) {
		nestedItems = nestedData[config.rootKey];
	}

	const candidateLists = [rootItems, rootDataItems, nestedItems];

	for (const candidate of candidateLists) {
		if (!Array.isArray(candidate)) {
			continue;
		}

		return {
			items: candidate.filter(
				(entry): entry is IDataObject =>
					Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry),
			),
			nextToken,
		};
	}

	return {
		items: [],
		nextToken,
	};
}

function extractOrgIdentifiers(
	item: IDataObject,
	config: {
		fallbackKey: 'designation_id' | 'department_id';
	},
): string[] {
	return [getFirstString(item.id), getFirstString(item[config.fallbackKey])].filter(
		(value): value is string => Boolean(value),
	);
}

async function lookupOrgEntityExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		entityLabel: string;
		endpoint: '/api/v2/designations' | '/api/v2/departments';
		identifier: string;
		rootKey: 'designations' | 'departments';
		fallbackKey: 'designation_id' | 'department_id';
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	let found = false;

	try {
		await runPaginatedLookupExhaustively(context, itemIndex, {
			entityLabel: `${config.entityLabel} roster`,
			pageSize: 100,
			requestPage: async (nextToken?: string) =>
				await zohoCliqApiRequest.call(
					context,
					'GET',
					config.endpoint,
					{},
					{
						limit: 100,
						...(nextToken ? { next_token: nextToken } : {}),
					},
				),
			extractPage: (response) =>
				asOrgPage(response, {
					rootKey: config.rootKey,
					itemLabelKey: config.fallbackKey,
				}),
			onItems: (items) => {
				found = items.some((item) =>
					extractOrgIdentifiers(item, {
						fallbackKey: config.fallbackKey,
					}).includes(config.identifier),
				);
			},
			shouldStop: () => found,
		});
	} catch (error) {
		if (error instanceof NodeOperationError) {
			throw error;
		}

		throw new NodeOperationError(
			context.getNode(),
			`The ${config.entityLabel} roster preflight failed before Zoho Cliq could be scanned exhaustively.`,
			{ itemIndex },
		);
	}

	if (found) {
		return { status: 'confirmed_exists' };
	}

	return {
		status: 'confirmed_missing',
		evidence: `The requested ${config.entityLabel} ID "${config.identifier}" was not present after exhaustively scanning the ${config.entityLabel} roster.`,
	};
}

export async function lookupDesignationExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	return await lookupOrgEntityExhaustively(context, itemIndex, {
		entityLabel: 'designation',
		endpoint: '/api/v2/designations',
		identifier: config.identifier,
		rootKey: 'designations',
		fallbackKey: 'designation_id',
	});
}

export async function lookupDepartmentExhaustively(
	context: IExecuteFunctions,
	itemIndex: number,
	config: {
		identifier: string;
	},
): Promise<ExhaustiveLookupOutcome<void>> {
	return await lookupOrgEntityExhaustively(context, itemIndex, {
		entityLabel: 'department',
		endpoint: '/api/v2/departments',
		identifier: config.identifier,
		rootKey: 'departments',
		fallbackKey: 'department_id',
	});
}

export async function runDesignationLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	designationId: string,
	options: {
		fieldLabel?: string;
		missing?: IPreflightMissingErrorConfig;
	} = {},
): Promise<PreflightGateResult<void>> {
	const fieldLabel = options.fieldLabel ?? 'Designation ID';

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'designation',
			identifier: designationId,
			label: fieldLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: designationListLookupScopes,
		},
		strategy: async () =>
			await lookupDesignationExhaustively(context, itemIndex, {
				identifier: designationId,
			}),
		errors: {
			missing: options.missing ?? {
				code: 'DESIGNATION_NOT_FOUND',
				message: `No designation found with ID "${designationId}".`,
				hint: DESIGNATION_NOT_FOUND_HINT,
			},
		},
	});
}

export async function runDepartmentLookupPreflightGate(
	context: IExecuteFunctions,
	itemIndex: number,
	grantedScopes: string,
	departmentId: string,
	options: {
		fieldLabel?: string;
		missing?: IPreflightMissingErrorConfig;
	} = {},
): Promise<PreflightGateResult<void>> {
	const fieldLabel = options.fieldLabel ?? 'Department ID';

	return await runPreflightGate(context, itemIndex, grantedScopes, {
		subject: {
			resource: 'department',
			identifier: departmentId,
			label: fieldLabel,
		},
		shouldRun: {
			requiresRecoverableMode: true,
			acceptedScopes: departmentListLookupScopes,
		},
		strategy: async () =>
			await lookupDepartmentExhaustively(context, itemIndex, {
				identifier: departmentId,
			}),
		errors: {
			missing: options.missing ?? {
				code: 'DEPARTMENT_NOT_FOUND',
				message: `No department found for ${fieldLabel} "${departmentId}".`,
				hint: DEPARTMENT_NOT_FOUND_HINT,
			},
		},
	});
}

export async function runDesignationUsersPreflightGate(
	context: IExecuteFunctions,
	userIds: string[],
	itemIndex: number,
	grantedScopes: string,
): Promise<void> {
	await runUserIdentifiersPreflightGate(context, itemIndex, grantedScopes, {
		identifiers: userIds,
		subjectLabel: 'Designation Member User IDs',
		acceptedScopes: userListLookupScopes,
		missing: {
			code: 'USER_IDS_NOT_FOUND',
			message: ({ missingIdentifiers }) =>
				`The following user ID(s) could not be found: ${JSON.stringify(
					missingIdentifiers,
				)}. Verify user IDs before updating designation members.`,
			hint: 'Use Get User or List Users to verify the exact member user IDs before updating designation membership.',
		},
	});
}

export async function runDepartmentUsersPreflightGate(
	context: IExecuteFunctions,
	userIds: string[],
	itemIndex: number,
	grantedScopes: string,
	options: {
		identifierLabel?: string;
		actionDescription?: string;
	} = {},
): Promise<void> {
	const identifierLabel = options.identifierLabel ?? 'user IDs';
	const actionDescription =
		options.actionDescription ?? 'continuing with this department operation';

	await runUserIdentifiersPreflightGate(context, itemIndex, grantedScopes, {
		identifiers: userIds,
		subjectLabel: `Department ${identifierLabel}`,
		acceptedScopes: userListLookupScopes,
		missing: {
			code: 'USER_IDS_NOT_FOUND',
			message: ({ missingIdentifiers }) =>
				`The following ${identifierLabel} could not be found: ${JSON.stringify(
					missingIdentifiers,
				)}. Verify them before ${actionDescription}.`,
			hint: `Use Get User or List Users to verify the exact ${identifierLabel} before ${actionDescription}.`,
		},
	});
}

export async function runDepartmentEmailsPreflightGate(
	context: IExecuteFunctions,
	emailIds: string[],
	itemIndex: number,
	grantedScopes: string,
	options: {
		identifierLabel?: string;
		actionDescription?: string;
	} = {},
): Promise<void> {
	const identifierLabel = options.identifierLabel ?? 'email IDs';
	const actionDescription =
		options.actionDescription ?? 'continuing with this department operation';

	await runUserIdentifiersPreflightGate(context, itemIndex, grantedScopes, {
		identifiers: emailIds,
		subjectLabel: `Department ${identifierLabel}`,
		acceptedScopes: userListLookupScopes,
		missing: {
			code: 'EMAIL_IDS_NOT_FOUND',
			message: ({ missingIdentifiers }) =>
				`The following ${identifierLabel} could not be found: ${JSON.stringify(
					missingIdentifiers,
				)}. Verify them before ${actionDescription}.`,
			hint: `Use Get User or List Users to verify the exact ${identifierLabel} before ${actionDescription}.`,
		},
	});
}

export async function runDepartmentMemberIdentifiersPreflightGate(
	context: IExecuteFunctions,
	parsedIdentifiers: {
		identifierType: 'email_ids' | 'user_ids';
		identifiers: string[];
	},
	itemIndex: number,
	grantedScopes: string,
	options: {
		actionDescription?: string;
	} = {},
): Promise<void> {
	if (parsedIdentifiers.identifierType === 'email_ids') {
		await runDepartmentEmailsPreflightGate(
			context,
			parsedIdentifiers.identifiers,
			itemIndex,
			grantedScopes,
			{
				identifierLabel: 'email IDs',
				actionDescription: options.actionDescription,
			},
		);
		return;
	}

	await runDepartmentUsersPreflightGate(
		context,
		parsedIdentifiers.identifiers,
		itemIndex,
		grantedScopes,
		{
			identifierLabel: 'user IDs',
			actionDescription: options.actionDescription,
		},
	);
}
