import type { IExecuteFunctions } from 'n8n-workflow';

export interface IPreflightSubject {
	resource: string;
	identifier: string;
	label: string;
}

export interface IPreflightMissingErrorConfig {
	code: string;
	message: string | ((input: IPreflightMissingErrorInput) => string);
	hint: string | ((input: IPreflightMissingErrorInput) => string);
	attachmentKey?: string;
}

export interface IPreflightShouldRunConfig {
	requiresRecoverableMode: boolean;
	acceptedScopes: string[];
}

export type PreflightSkipReason = 'recoverable_mode_disabled' | 'scope_unavailable';

export type PreflightGateResult<TEntity> =
	| { status: 'skipped'; reason: PreflightSkipReason }
	| { status: 'validated'; entity?: TEntity };

export type ExhaustiveLookupOutcome<TEntity> =
	| { status: 'confirmed_exists'; entity?: TEntity }
	| { status: 'confirmed_missing'; evidence: string; missingIdentifiers?: string[] };

export interface IPreflightGateConfig<TEntity> {
	subject: IPreflightSubject;
	shouldRun: IPreflightShouldRunConfig;
	strategy: () => Promise<ExhaustiveLookupOutcome<TEntity>>;
	errors: {
		missing: IPreflightMissingErrorConfig;
	};
}

export interface IPreflightActivationResult {
	status: 'active' | 'skipped';
	reason?: PreflightSkipReason;
}

export interface IPaginatedLookupPage<TItem> {
	items: TItem[];
	nextToken?: string;
	hasMore?: boolean;
}

export interface IRunPaginatedLookupConfig<TItem> {
	entityLabel: string;
	pageSize: number;
	requestPage: (nextToken?: string) => Promise<unknown>;
	extractPage: (response: unknown) => IPaginatedLookupPage<TItem>;
	onItems: (items: TItem[]) => void;
	shouldStop: () => boolean;
}

export interface IPreflightMissingErrorInput {
	context: IExecuteFunctions;
	itemIndex: number;
	subject: IPreflightSubject;
	missing: IPreflightMissingErrorConfig;
	evidence: string;
	missingIdentifiers?: string[];
}
