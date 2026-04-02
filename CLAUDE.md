# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is included in the public repo so that anyone forking or branching this project can use Claude Code effectively from day one.

## Project

**n8n-nodes-zoho-cliq** is an n8n community node package providing 100% coverage of the Zoho Cliq REST API v2. Single-node architecture, 160+ operations, 25 resources, OAuth2 with multi-data-center support. MIT license.

## Build and Test

```bash
pnpm install             # Install dependencies
pnpm build               # Build via n8n-node CLI (outputs to dist/)
pnpm lint                # Lint via n8n-node CLI (strict n8n community node rules)
pnpm test:unit           # Run all Jest tests
pnpm test:coverage       # Coverage report (project maintains 100% coverage across 5000+ tests)
pnpm test:types          # tsc --noEmit + lint
npx jest __tests__/path/to/file.test.ts   # Single test file
```

---

## Architecture

### File Layout

```
index.ts                              # Exports node + credential classes
credentials/ZohoCliqOAuth2Api.credentials.ts  # OAuth2 credential with scope packs
nodes/ZohoCliq/
  ZohoCliq.node.ts                    # VersionedNodeType (currently v1 only)
  v1/
    ZohoCliqV1.node.ts                # v1 node definition
    transport/index.ts                # zohoCliqApiRequest, multipart, binary
    helpers/
      constants.ts                    # CLIQ_BASE_URL_MAP (9 data centers)
      interfaces.ts                   # API response type guards
      scopeRegistry.ts                # OPERATION_SCOPE_REGISTRY + policy overrides
      utils.ts                        # All validation functions
      linkConstants.ts                # Documentation link constants
      data.ts                         # coerceApiResponseToObject
    methods/                          # loadOptions, listSearch, resourceMapping
    actions/
      router.ts                       # Central dispatcher
      node.type.ts                    # ZohoCliqType union
      types.ts                        # Operation type unions + IOperationHandler
      common.descriptions.ts          # Shared parameter definitions (channelRLC, etc.)
      <resource>/
        <Resource>.resource.ts        # Description + re-exports operations
        <operation>.operation.ts      # description[] + execute()
        common.ts                     # Resource-specific helpers (optional)
        shared.ts                     # Resource-specific error helpers (optional)
      shared/
        errorResponse.ts              # buildCliqRecoverableErrorPayload
        validation.ts                 # Cross-resource validation
        responseOutput.ts             # coerceApiResponseToObject
        richUi.ts                     # Emoji/icon input resolution
        flexibleUserIds.ts            # Multi-format user ID parsing
        preflight/                    # Pre-request resource existence checks
        messagePayload/               # Full message construction subsystem
```

### Router Dispatch

`router.ts` is the single entry point for execution. It:

1. Calls `validateCredentials(this)` once to get `grantedScopes` string
2. Reads `resource` and `operation` from node parameters
3. Looks up the handler from a type-safe `Record<XxxOperations, IOperationHandler>` map
4. Calls `handler.execute.call(this, items, grantedScopes)`
5. Wraps the flat `INodeExecutionData[]` result in `[returnData]` for n8n

The router also handles AI Error Mode at the top level by overriding `continueOnFail` when `enableAiErrorMode` is true, and restoring it in `finally`.

---

## Operation File Conventions

Every operation file exports exactly two things:

### `description: INodeProperties[]`

Built by mapping a local `properties` array through a `displayOptions` spread:

```typescript
const displayOptions = {
  show: {
    resource: ['channel'],
    operation: ['create'],
  },
};

export const description: INodeProperties[] = properties.map((prop) => ({
  ...prop,
  displayOptions: {
    ...displayOptions,
    ...prop.displayOptions,
  },
}));
```

This pattern is mandatory. It ensures every property inherits the resource+operation visibility while allowing individual properties to add additional show/hide conditions.

### `execute(this, items, grantedScopes): Promise<INodeExecutionData[]>`

```typescript
export async function execute(
  this: IExecuteFunctions,
  items: INodeExecutionData[],
  grantedScopes: string,
): Promise<INodeExecutionData[]> {
  const returnData: INodeExecutionData[] = [];

  for (let i = 0; i < items.length; i++) {
    // Declare context variables BEFORE try (used in catch for error context)
    let requestedId: string | undefined;

    try {
      // 1. Scope check
      checkRequiredScope(this, grantedScopes, requiredScope, i);

      // 2. Parameter extraction + validation
      const param = this.getNodeParameter('paramName', i) as string;
      requestedId = param;
      const sanitized = validateXxx(this, param, i);

      // 3. Optional: Preflight validation (if recoverable mode active)
      await runChatLookupPreflightGate(this, i, grantedScopes, sanitized);

      // 4. API call
      const response = await zohoCliqApiRequest.call(this, 'POST', endpoint, body);

      // 5. Response construction
      const executionData = this.helpers.constructExecutionMetaData(
        [{ json: responsePayload }],
        { itemData: { item: i } },
      );
      returnData.push(...executionData);

    } catch (error) {
      // 6. Recoverable error handling
      if (pushXxxRecoverableError(this, returnData, i, 'operationName', error, {
        contextFields: { field: requestedId },
        messageMappings: [...],
      })) {
        continue;
      }
      throw error;
    }
  }

  return returnData;
}
```

This structure is not a suggestion. Every operation in this codebase follows it exactly. Do not deviate.

---

## Error Handling System

### Three-Layer Architecture

1. **Preflight validation** (before API call) -- validates inputs locally and checks resource existence via lightweight API lookups
2. **Transport-layer error normalization** (`transport/index.ts`) -- extracts error text from Zoho's inconsistent response structures
3. **Recoverable error payloads** (`errorResponse.ts`) -- builds structured error output for workflow consumption

### Recoverable Error Pattern

Every resource that makes API calls has a `pushXxxRecoverableError()` function (e.g., `pushChannelRecoverableError`, `pushDatabaseRecoverableError`). This function:

1. Checks if `continueOnFail()` OR `enableAiErrorMode` is active
2. If neither: returns `false` (caller must `throw error`)
3. If either: builds a structured error payload and pushes to `returnData`, returns `true` (caller does `continue`)

The structured error payload always contains:

```typescript
{
  success: false,
  message: string,              // Human-readable error description
  resource: string,             // e.g., 'channel'
  operation: string,            // e.g., 'leave'
  reason?: string,              // Machine-readable code: 'BAD_REQUEST', 'CHANNEL_NOT_FOUND', etc.
  hint?: string,                // Actionable recovery guidance
  status_code?: number,
  status_class?: '2xx' | '4xx' | '5xx' | 'other',
  details?: IDataObject,
  ...contextFields              // Resource-specific context (channel_id, record_id, etc.)
}
```

### Error Message Mappings

Operations define `messageMappings` arrays to match known error patterns to specific machine-readable codes:

```typescript
messageMappings: [
  {
    match: (normalizedMessage) => normalizedMessage.includes('database name is required'),
    reason: 'INVALID_DATABASE_NAME',
    hint: 'Use the exact Zoho Cliq database unique name.',
  },
]
```

The `match` function receives the error message normalized to lowercase. First match wins. When adding new operations, always define mappings for errors you can identify with certainty.

### Machine-Readable Error Codes

HTTP status-based (from `getStatusReasonAndHint`):
`BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`, `NOT_ACCEPTABLE`, `RATE_LIMITED`, `SERVER_ERROR`

Operation-specific codes follow the pattern `INVALID_<FIELD>`, `<RESOURCE>_NOT_FOUND`, `<RESOURCE>_REQUEST_BAD_PARAMETERS`.

### Enhanced Output

For API endpoints returning empty strings on success, operations use the `resolveXxxEnhancedOutput()` pattern:

```typescript
const { includeEnhancedOutput, responseJson, rawResponse } = resolveChannelEnhancedOutput(this, i, response);

const json = includeEnhancedOutput
  ? { success: true, operation: 'leave_channel', channel_id: id, ...responseJson }
  : rawResponse;
```

The `includeEnhancedOutput` toggle defaults to `true` and is exposed as a boolean parameter.

---

## Preflight Validation System

Located in `actions/shared/preflight/`. This system validates that target resources (chats, channels, users) exist BEFORE the main API call, preventing cryptic errors from the Zoho API.

Preflight only runs when ALL conditions are met:
- Recoverable mode is active (`continueOnFail` or `enableAiErrorMode`)
- The credential has the scope required for the lookup endpoint

If either condition is missing, preflight silently skips (returns `{ status: 'skipped' }`). It never errors on its own.

When preflight detects a missing resource, it attaches a `zohoCliqPreflight` object to the error with `code`, `message`, `hint`, and `evidence` fields.

---

## Scope System

### Registry

`helpers/scopeRegistry.ts` contains `OPERATION_SCOPE_REGISTRY` mapping every `resource.operation` to its required OAuth scope(s). When adding a new operation, you must register its scope here.

`OPERATION_SCOPE_POLICY_OVERRIDES` handles edge cases: `matchMode: 'any'`, `disallowedScopes`, `conditionalRequirements`, and `acceptedAlternatives`.

### Runtime Check

`checkRequiredScope()` in `helpers/utils.ts` validates scopes at execution time. It:
- Parses `grantedScopes` (comma-separated string) into a Set
- Checks exact match, then wildcard alternatives (`ZohoCliq.Channels.ALL` satisfies `ZohoCliq.Channels.CREATE`)
- Checks scope aliases (e.g., `ZohoCliq.Webhooks.CREATE` accepts `ZohoCliq.Messages.CREATE`)
- Throws with a `zohoCliqScopeErrorPayload` attached for structured error handling

### Credential Scope Modes

The credential supports three scope modes: `allScopes` (all 53 scopes), `scopePacks` (9 named packs), and `rawCsv` (manual entry). The credential file at `credentials/ZohoCliqOAuth2Api.credentials.ts` contains all scope pack definitions, validation logic, and alias resolution.

---

## Transport Layer

`transport/index.ts` exports three request functions:

- **`zohoCliqApiRequest(method, endpoint, body?, qs?)`** -- primary JSON requests via `httpRequestWithAuthentication`
- **`zohoCliqApiMultipartRequest`** -- multipart/form-data (file uploads)
- **`zohoCliqApiBinaryRequest`** -- returns Buffer + headers

All functions resolve the base URL from the credential's `dc` (data center) field using `CLIQ_BASE_URL_MAP`. Endpoints must start with `/`. Errors are wrapped in `NodeApiError` with extracted Zoho error context.

---

## Validation Conventions

All validation functions live in `helpers/utils.ts` and follow strict naming:

- **`validateXxx(context, value, itemIndex)`** -- validates and returns sanitized value, throws `NodeOperationError` with `{ itemIndex }` on failure
- **`parseXxx(context, value, itemIndex, path)`** -- parses complex inputs (JSON, arrays, delimited strings) into typed output
- **`resolveXxx(context, itemIndex, ...)`** -- resolves computed values from multiple parameters
- **`isXxx(value)`** -- type guards, return boolean

Existing validators: `validateChannelId`, `validateChatId`, `validateMessageId`, `validateUserId`, `validateUserIdArray`, `validateEmail`, `validateEmailList`, `validateEmojiCode`, `validateFileId`, `validateCommentId`, `validateThreadId`, `validateChannelName`, `validateMemberId`, `validateLimit`, `validateNextToken`, `validateScheduleTime`, `validateScheduleStatus`, `validateTimezone`, `validateThreadStateFilter`, `validateThreadTypeFilter`, `validateThreadAction`.

When adding a new operation that accepts user-provided IDs or strings, always use an existing validator or create one following the same pattern. Never pass raw user input to API endpoints.

---

## Message Payload Subsystem

`actions/shared/messagePayload/` handles all message construction. The resolution chain:

1. **`resolveMessagePayload()`** (in `resolvers.ts`) -- entry point, branches on `messageType`:
   - `'text'` -- validates text, applies mention tokens, returns `{ text: ... }`
   - `'json'` -- parses and sanitizes raw JSON, requires `text` key
   - `'rich'` -- calls `resolveRichMessagePayload()`
2. **`resolveRichMessagePayload()`** (in `rich.ts`) -- branches on `cardInputMode`:
   - `'raw'` -- parses JSON, sanitizes
   - `'structured'` -- extracts card, slides, buttons from individual fields
3. **Extractors** -- `extractCard()`, `extractSlides()`, `extractButtons()`, `extractBot()`
4. **Validation** -- `validateRichPayloadContentLimits()`, total payload max 10,000 chars

Key constants in `common.ts`: `richTextMaxLength = 4096`, `textSlideMaxLength = 1000`, `richPayloadMaxLength = 10_000`, `allowedCardThemes`, `allowedSlideTypes`, `allowedButtonActions`.

Do not modify this subsystem without reading `resolvers.ts`, `rich.ts`, `common.ts`, and `index.ts` first.

---

## Resource File Conventions

Each `<Resource>.resource.ts` file:

1. Imports all operation modules: `import * as post from './post.operation'`
2. Re-exports them: `export { post, edit, deleteOp as delete, ... }`
3. Exports a `description: INodeProperties[]` array with the operation selector dropdown

The resource module itself serves as the operation map. The router accesses it as `Record<XxxOperations, IOperationHandler>`.

### Adding a New Operation

1. Create `<operation>.operation.ts` with `description` and `execute` exports
2. Register the operation in `<Resource>.resource.ts` (import, re-export, add to dropdown)
3. Add the operation type to the union in `actions/types.ts`
4. Register the required scope in `helpers/scopeRegistry.ts`
5. Add error message mappings for identifiable failure cases
6. Write tests mirroring the source path in `__tests__/`

---

## Test Conventions

Tests live in `__tests__/` mirroring the source structure. Jest with ts-jest, config in `jest.config.cjs`.

- `clearMocks`, `resetMocks`, `restoreMocks` are all `true` in config
- Mock `transport.zohoCliqApiRequest` via `jest.mock`
- Use a `createContext()` factory returning mock `IExecuteFunctions`
- `testUtils.ts` provides `createRichMessageParameterMock()` for message payload tests
- Test both success paths and error paths (validation failures, scope errors, recoverable errors)
- This project maintains 100% test coverage (branches, functions, lines, statements) across 5000+ tests. Any new code must include tests that maintain this standard

---

## n8n Community Node Rules

This project uses the `@n8n/node-cli` ESLint config which enforces n8n community node conventions. Key rules:

- Node class must implement `INodeType` with correct `description` shape
- Credential class must implement `ICredentialType`
- Icon validation, display name conventions, parameter naming
- `eslint.config.mjs` extends the base config and adds `coverage/` to global ignores
- `strict: false` is set in `package.json` to allow extending the ESLint config

---

## TypeScript

Strict mode. Target ES2019, CommonJS. All strict flags enabled: `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noImplicitReturns`. `skipLibCheck: true` for dependency types.

## CI

GitHub Actions in `.github/workflows/`. Runs lint, type-check, and tests.
